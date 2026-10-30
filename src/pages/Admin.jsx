import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../data/supabaseClient';
import { api } from '../services/api';
import { sanitizeUser, hashPassword } from '../utils/security';
import XLSX from 'xlsx-js-style';
import { 
  Megaphone, 
  Users, 
  Package, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Plus, 
  Download, 
  ChevronDown, 
  Check, 
  UserPlus, 
  UserMinus, 
  Shield, 
  X, 
  Building2, 
  User, 
  Search, 
  UserCheck,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

const CAMPUS_BUILDINGS = [
  { id: 'Dimasalang', name: 'Dimasalang Building' },
  { id: 'Silang', name: 'Silang Building' },
  { id: 'Phinma', name: 'Phinma Building' }
];

const ADMIN_TABS = [
  { id: 'staff', label: 'Staff' },
  { id: 'notice', label: 'Notice' },
  { id: 'stock', label: 'Stock' },
  { id: 'shift', label: 'Shift' }
];

export default function Admin({
  rooms = [],
  setRooms,
  supplies = [],
  setSupplies,
  assignments = {},
  setAssignments,
  broadcast = {},
  setBroadcast,
  setLogs,
  onlineUsers = []
}) {
  const [activeTab, setActiveTab] = useState('staff');
  const [toastMessage, setToastMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [staffRoster, setStaffRoster] = useState([]);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [staffAvatars, setStaffAvatars] = useState({});

  const [openBuildings, setOpenBuildings] = useState({
    Dimasalang: false,
    Silang: false,
    Phinma: false
  });

  const [activeAssignSlot, setActiveAssignSlot] = useState(null);
  const [stagedStaffIds, setStagedStaffIds] = useState([]);
  const [staffPickerSearch, setStaffPickerSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newUserRole, setNewUserRole] = useState('staff');
  const [newUserAccessLevel, setNewUserAccessLevel] = useState(1);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUserToDelete, setSelectedUserToDelete] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Reactive state for Profile Settings Animation Toggle
  const [animationsDisabled, setAnimationsDisabled] = useState(() => {
    try {
      return localStorage.getItem('sjc_animations_disabled') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleAnimToggle = () => {
      try {
        setAnimationsDisabled(localStorage.getItem('sjc_animations_disabled') === 'true');
      } catch (_) {}
    };

    window.addEventListener('storage', handleAnimToggle);
    window.addEventListener('sjc_animation_preference_changed', handleAnimToggle);
    return () => {
      window.removeEventListener('storage', handleAnimToggle);
      window.removeEventListener('sjc_animation_preference_changed', handleAnimToggle);
    };
  }, []);

  const [noticeText, setNoticeText] = useState(broadcast.message || '');
  const [isUpdatingNotice, setIsUpdatingNotice] = useState(false);

  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Chemicals');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('bottles');
  const [newItemThreshold, setNewItemThreshold] = useState('5');
  const [isAddingSupply, setIsAddingSupply] = useState(false);

  const tabBarRef = useRef(null);
  const pointerStartRef = useRef(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(null);
  const lastTabRef = useRef(activeTab);

  useEffect(() => {
    lastTabRef.current = activeTab;
  }, [activeTab]);

  const updateTabScrub = (clientX) => {
    if (!tabBarRef.current) return;
    const rect = tabBarRef.current.getBoundingClientRect();
    const N = ADMIN_TABS.length;
    const relX = clientX - rect.left;
    const t = Math.max(0, Math.min(1, relX / rect.width));
    const targetIndex = Math.min(N - 1, Math.max(0, Math.floor(t * N)));

    const w = 1 / N;
    const leftFrac = Math.max(0, Math.min(1 - w, t - w / 2));
    const unitPos = leftFrac * N;
    setScrubPosition(unitPos);

    if (ADMIN_TABS[targetIndex].id !== lastTabRef.current) {
      lastTabRef.current = ADMIN_TABS[targetIndex].id;
      setActiveTab(ADMIN_TABS[targetIndex].id);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(12); } catch (_) {}
      }
    }
  };

  const handlePointerDown = (e) => {
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId
    };
  };

  const handlePointerMove = (e) => {
    if (!pointerStartRef.current) return;

    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);

    if (!isScrubbing) {
      if (dx > 8 && dx > dy) {
        setIsScrubbing(true);
        try {
          e.currentTarget.setPointerCapture(pointerStartRef.current.pointerId);
        } catch (_) {}
        updateTabScrub(e.clientX);
      }
    } else {
      updateTabScrub(e.clientX);
    }
  };

  const handlePointerUp = (e) => {
    if (isScrubbing) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setIsScrubbing(false);
      setScrubPosition(null);
    }
    pointerStartRef.current = null;
  };

  const activeTabIndex = ADMIN_TABS.findIndex((t) => t.id === activeTab);
  const effectiveOffset = isScrubbing && scrubPosition !== null
    ? scrubPosition
    : activeTabIndex !== -1
    ? activeTabIndex
    : 0;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 3500);
  };

  const getStaffName = (staffObj) => {
    if (!staffObj) return 'Unassigned';
    return staffObj.name || `Staff ${staffObj.id}`;
  };

  const toggleBuilding = (buildingId) => {
    setOpenBuildings((prev) => ({
      ...prev,
      [buildingId]: !prev[buildingId]
    }));
  };

  const fetchUsersAndAvatars = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, access_level, avatar')
        .order('id', { ascending: true });

      if (!error && data && data.length > 0) {
        const validUsers = data.filter((u) => !String(u.id).startsWith('supply_img_'));
        setStaffRoster(validUsers.map(sanitizeUser));

        const avatarMap = {};
        validUsers.forEach((item) => {
          if (item.avatar) avatarMap[item.id] = item.avatar;
        });
        setStaffAvatars(avatarMap);
      }
    } catch (err) {
      console.warn('Could not load user roster from database:', err);
    }
  };

  useEffect(() => {
    fetchUsersAndAvatars();
  }, []);

  const getAssignedStaffList = (building, floor) => {
    const compositeKey = `${building}_${floor}`;
    const raw = assignments[compositeKey] || (building === 'Dimasalang' ? assignments[floor] : null);
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === 'string') {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [String(raw)];
  };

  const getRoomsForFloor = (building, floor) => {
    const offset = building === 'Silang' ? 40 : building === 'Phinma' ? 20 : 0;
    return [1, 2, 3, 4, 5].map((rm) => `${floor * 100 + offset + rm}`).join(', ');
  };

  const handleOpenAssignModal = (buildingId, floorNum) => {
    const currentList = getAssignedStaffList(buildingId, floorNum);
    setStagedStaffIds(currentList);
    setActiveAssignSlot({ building: buildingId, floor: floorNum });
    setStaffPickerSearch('');
  };

  const handleToggleStagedStaff = (staffId) => {
    if (staffId === '') {
      setStagedStaffIds([]);
      return;
    }

    setStagedStaffIds((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleApplyAssignments = async () => {
    if (!activeAssignSlot) return;

    const { building, floor } = activeAssignSlot;
    const nextList = stagedStaffIds;
    const compositeKey = `${building}_${floor}`;

    const nextMap = { ...assignments, [compositeKey]: nextList };
    if (building === 'Dimasalang') nextMap[floor] = nextList;
    if (setAssignments) setAssignments(nextMap);

    const assignedNames = nextList
      .map((id) => {
        const staffObj = staffRoster.find((s) => String(s.id) === String(id));
        return staffObj ? getStaffName(staffObj) : `Staff ${id}`;
      })
      .join(', ');

    const syncStaffText = assignedNames || 'Unassigned';

    if (setRooms) {
      setRooms((prev) =>
        prev.map((r) => {
          const roomBuilding = r.building || 'Dimasalang';
          if (roomBuilding === building && Number(r.floor) === Number(floor)) {
            return { ...r, staff: syncStaffText };
          }
          return r;
        })
      );
    }

    setActiveAssignSlot(null);
    setStaffPickerSearch('');
    showToast('Floor assignments updated!');

    try {
      await supabase
        .from('assignments')
        .delete()
        .match({ building: building, floor: floor });

      if (nextList.length > 0) {
        const insertRows = nextList.map((id) => ({
          building: building,
          floor: floor,
          staff_id: id
        }));
        await supabase.from('assignments').insert(insertRows);
      }

      await supabase
        .from('rooms')
        .update({ staff: syncStaffText })
        .match({ building: building, floor: floor });
    } catch (err) {
      console.error('Failed to sync assignments:', err);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    const cleanId = newUserId.trim();
    const cleanName = newUserName.trim();
    const cleanEmail = newUserEmail.trim();
    const cleanPassword = newUserPassword.trim();

    if (!cleanId || !cleanName || !cleanEmail || !cleanPassword) {
      showError('Please provide Staff ID, Full Name, Email, and Initial Password.');
      return;
    }

    setIsCreatingAccount(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
          id: cleanId,
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
          role: newUserRole,
          access_level: Number(newUserAccessLevel),
          is_first_login: true
        }])
        .select('id, name, email, role, access_level, avatar');

      if (error) throw error;

      // Also store local hash fallback for instant offline capability
      try {
        const hashed = await hashPassword(cleanPassword);
        localStorage.setItem(`sjc_pass_hash_${cleanId.toLowerCase()}`, hashed);
        localStorage.setItem(`sjc_pass_${cleanId}`, cleanPassword);
      } catch (_) {}

      if (data && data[0]) {
        setStaffRoster((prev) => [...prev, sanitizeUser(data[0])]);
      }

      showToast(`Account created & saved to database for ${cleanName}!`);
      setNewUserId('');
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setShowNewUserPassword(false);
      setShowCreateModal(false);
    } catch (err) {
      showError(err.message || 'Error creating account in database.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedUserToDelete) return;
    setIsDeletingAccount(true);

    const targetId = selectedUserToDelete;
    const targetUser = staffRoster.find((s) => s.id === targetId);
    const targetName = getStaffName(targetUser);

    try {
      await supabase.from('profiles').delete().eq('id', targetId);
      await supabase.from('assignments').delete().eq('staff_id', targetId);

      const updated = { ...assignments };
      Object.keys(updated).forEach((k) => {
        if (Array.isArray(updated[k])) {
          updated[k] = updated[k].filter((id) => id !== targetId);
        } else if (updated[k] === targetId) {
          delete updated[k];
        }
      });
      if (setAssignments) setAssignments(updated);

      setStaffRoster((prev) => prev.filter((s) => s.id !== targetId));
      showToast(`Account for ${targetName} was deleted.`);
      setShowDeleteModal(false);
      setSelectedUserToDelete('');
    } catch (err) {
      showError(err.message || 'Failed to delete user.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleSaveBroadcast = async (e) => {
    e.preventDefault();
    if (!noticeText.trim()) return;
    setIsUpdatingNotice(true);

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = {
      active: true,
      message: noticeText.trim(),
      posted_by: 'Facilities Supervisor',
      updated_at: now
    };

    try {
      await supabase.from('broadcast').upsert({ id: 1, ...payload });
      if (setBroadcast) {
        setBroadcast({
          active: true,
          message: noticeText.trim(),
          postedBy: 'Facilities Supervisor',
          updatedAt: now
        });
      }
      showToast('Supervisor announcement broadcasted live across campus!');
    } catch {
      showError('Failed to publish announcement.');
    } finally {
      setIsUpdatingNotice(false);
    }
  };

  const handleClearBroadcast = async () => {
    try {
      await supabase.from('broadcast').update({ active: false, message: '' }).eq('id', 1);
      if (setBroadcast) {
        setBroadcast({ active: false, message: '', postedBy: '', updatedAt: '' });
      }
      setNoticeText('');
      showToast('Supervisor notice deactivated.');
    } catch {
      showError('Could not deactivate broadcast.');
    }
  };

  const handleAddSupplyItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setIsAddingSupply(true);
    const newSupplyObj = {
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: parseInt(newItemQty, 10) || 0,
      unit: newItemUnit.trim() || 'pcs',
      threshold: parseInt(newItemThreshold, 10) || 1
    };

    try {
      const { data, error } = await supabase.from('supplies').insert([newSupplyObj]).select();
      if (error) throw error;
      if (data && setSupplies) setSupplies((prev) => [...prev, data[0]]);
      setNewItemName('');
      setNewItemQty('');
      showToast(`Added ${newSupplyObj.name} to storage!`);
    } catch {
      showError('Could not save supply item.');
    } finally {
      setIsAddingSupply(false);
    }
  };

  const handleUpdateQuantity = async (supplyId, delta) => {
    const target = supplies.find((s) => s.id === supplyId);
    if (!target) return;

    const updatedQty = Math.max(0, target.quantity + delta);
    if (setSupplies) {
      setSupplies((prev) => prev.map((s) => (s.id === supplyId ? { ...s, quantity: updatedQty } : s)));
    }

    try {
      await supabase.from('supplies').update({ quantity: updatedQty }).eq('id', supplyId);
    } catch (err) {
      console.warn('Update quantity error:', err);
    }
  };

  const handleDeleteSupply = async (supplyId, name) => {
    if (!window.confirm(`Delete "${name}" from inventory?`)) return;
    if (setSupplies) setSupplies((prev) => prev.filter((s) => s.id !== supplyId));

    try {
      await supabase.from('supplies').delete().eq('id', supplyId);
      showToast(`Removed "${name}" from stock records.`);
    } catch {
      showToast(`Removed "${name}" from stock records.`);
    }
  };

  const handleResetDay = async () => {
    if (!window.confirm('Reset all classrooms across all campus buildings back to "Pending"?')) return;

    if (setRooms) {
      setRooms((prev) =>
        prev.map((r) => ({
          ...r,
          status: 'pending',
          staff: 'Unassigned',
          lastCleaned: '',
          recleanReason: null,
          hasStudents: false
        }))
      );
    }

    try {
      await supabase
        .from('rooms')
        .update({
          status: 'pending',
          staff: 'Unassigned',
          last_cleaned: null,
          reclean_reason: null,
          has_students: false
        })
        .neq('id', 'placeholder_bypass');
      showToast('Daily inspection checklist reset for all campus buildings!');
    } catch {
      showError('Could not reset room records.');
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Delete all handover logs & incident notes?')) return;
    if (setLogs) setLogs([]);
    await supabase.from('logs').delete().neq('id', 'keep_table_structure');
    showToast('Shift handover logs cleared.');
  };

  // 📊 EXECUTIVE STYLED EXCEL EXPORT (MATCHES SUPPLIES AESTHETIC EXACTLY)
  const handleExportExcel = () => {
    try {
      const PALETTE = {
        campusGreen: '176E57',
        titleSubBg: '0F4C3A',
        titleSubText: 'A7F3D0',
        white: 'FFFFFF',
        slateDark: '1E293B',
        slateLight: 'F8FAFC',
        borderSoft: 'E2E8F0',

        // Inspection Status Badges
        cleanedFill: 'D1FAE5',
        cleanedText: '065F46',
        inProgressFill: 'E0F2FE',
        inProgressText: '075985',
        pendingFill: 'FEF3C7',
        pendingText: '92400E',
        recleanFill: 'FEE2E2',
        recleanText: '991B1B',

        // Building Section Banners
        dimasalangFill: 'CCFBF1',
        dimasalangText: '115E59',
        silangFill: 'E0F2FE',
        silangText: '075985',
        phinmaFill: 'F3E8FF',
        phinmaText: '581C87',
        generalFill: 'F1F5F9',
        generalText: '334155'
      };

      const thinBorder = {
        top: { style: 'thin', color: { rgb: PALETTE.borderSoft } },
        bottom: { style: 'thin', color: { rgb: PALETTE.borderSoft } },
        left: { style: 'thin', color: { rgb: PALETTE.borderSoft } },
        right: { style: 'thin', color: { rgb: PALETTE.borderSoft } }
      };

      // --- SHEET 1: CAMPUS CLASSROOM INSPECTION AUDIT ---
      const buildingOrder = ['Dimasalang', 'Silang', 'Phinma'];
      const groupedRooms = {};
      buildingOrder.forEach((b) => { groupedRooms[b] = []; });

      rooms.forEach((r) => {
        const b = r.building || 'Dimasalang';
        if (!groupedRooms[b]) groupedRooms[b] = [];
        groupedRooms[b].push(r);
      });

      const rows = [];
      const cellStyles = {};
      const merges = [];

      const setCellStyle = (r, c, style) => {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        cellStyles[cellRef] = style;
      };

      // Header Banner (Title)
      rows.push(['PHINMA SAINT JUDE COLLEGE — CAMPUS FACILITIES & SHIFT INSPECTION AUDIT', '', '', '', '', '', '', '', '']);
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } });
      for (let c = 0; c <= 8; c++) {
        setCellStyle(0, c, {
          fill: { fgColor: { rgb: PALETTE.campusGreen } },
          font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: PALETTE.white } },
          alignment: { vertical: 'center', horizontal: 'left', indent: 1 }
        });
      }

      // Metadata Banner
      const now = new Date();
      const dateFormatted = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      rows.push([`Audit Date: ${dateFormatted} at ${timeFormatted} | Campus: Dimasalang, Silang, Phinma | Auditor: Facilities Administration`, '', '', '', '', '', '', '', '']);
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 8 } });
      for (let c = 0; c <= 8; c++) {
        setCellStyle(1, c, {
          fill: { fgColor: { rgb: PALETTE.titleSubBg } },
          font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: PALETTE.titleSubText } },
          alignment: { vertical: 'center', horizontal: 'left', indent: 1 }
        });
      }

      // Spacer
      rows.push(['', '', '', '', '', '', '', '', '']);

      // Column Headers
      rows.push([
        'BUILDING',
        'ROOM #',
        'FLOOR',
        'INSPECTION STATUS',
        'ASSIGNED STAFF',
        'LAST VERIFIED',
        'FACILITY CONTROLS (AC / LIGHTS / LOCK)',
        'ACTIVE SESSION',
        'HANDOVER / INCIDENT NOTES'
      ]);
      for (let c = 0; c <= 8; c++) {
        setCellStyle(3, c, {
          fill: { fgColor: { rgb: PALETTE.slateDark } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: PALETTE.white } },
          alignment: { vertical: 'center', horizontal: (c === 1 || c === 4 || c === 8) ? 'left' : 'center' },
          border: thinBorder
        });
      }

      let currentRow = 4;

      buildingOrder.forEach((bldg) => {
        const bldgRooms = groupedRooms[bldg];
        if (!bldgRooms || bldgRooms.length === 0) return;

        let bannerBg = PALETTE.generalFill;
        let bannerTxt = PALETTE.generalText;
        let bldgLabel = `🏢 ${bldg.toUpperCase()} BUILDING`;

        if (bldg === 'Dimasalang') {
          bannerBg = PALETTE.dimasalangFill;
          bannerTxt = PALETTE.dimasalangText;
          bldgLabel = '🏛️ DIMASALANG BUILDING (Main Academic Wing)';
        } else if (bldg === 'Silang') {
          bannerBg = PALETTE.silangFill;
          bannerTxt = PALETTE.silangText;
          bldgLabel = '🏫 SILANG BUILDING (Science & Laboratory Wing)';
        } else if (bldg === 'Phinma') {
          bannerBg = PALETTE.phinmaFill;
          bannerTxt = PALETTE.phinmaText;
          bldgLabel = '🏢 PHINMA BUILDING (Allied Health & Nursing Wing)';
        }

        // Section Banner Row
        rows.push([bldgLabel, '', '', '', '', '', '', '', `${bldgRooms.length} rooms audited`]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });

        for (let c = 0; c <= 7; c++) {
          setCellStyle(currentRow, c, {
            fill: { fgColor: { rgb: bannerBg } },
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: bannerTxt } },
            alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
            border: thinBorder
          });
        }
        setCellStyle(currentRow, 8, {
          fill: { fgColor: { rgb: bannerBg } },
          font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: bannerTxt } },
          alignment: { vertical: 'center', horizontal: 'center' },
          border: thinBorder
        });
        currentRow++;

        // Data Rows
        bldgRooms.forEach((rm, rIdx) => {
          const rawStatus = (rm.status || 'pending').toLowerCase();
          let statusText = 'PENDING';
          let statusBg = PALETTE.pendingFill;
          let statusFg = PALETTE.pendingText;

          if (rawStatus === 'cleaned' || rawStatus === 'completed') {
            statusText = 'CLEANED';
            statusBg = PALETTE.cleanedFill;
            statusFg = PALETTE.cleanedText;
          } else if (rawStatus === 'in_progress') {
            statusText = 'IN PROGRESS';
            statusBg = PALETTE.inProgressFill;
            statusFg = PALETTE.inProgressText;
          } else if (rawStatus === 'reclean' || rm.recleanReason) {
            statusText = 'NEEDS RECLEAN';
            statusBg = PALETTE.recleanFill;
            statusFg = PALETTE.recleanText;
          }

          const controlsSummary = `AC: ${rm.acChecked ? 'OFF' : 'ON'} | LIGHTS: ${rm.lightsChecked ? 'OFF' : 'ON'} | LOCKED: ${rm.doorChecked ? 'YES' : 'NO'}`;
          const occupancy = rm.hasStudents ? 'CLASS IN SESSION' : 'ROOM VACANT';
          const zebraBg = rIdx % 2 === 1 ? PALETTE.slateLight : PALETTE.white;

          rows.push([
            bldg,
            `Room ${rm.id}`,
            `Floor ${rm.floor}`,
            statusText,
            rm.staff || 'Unassigned',
            rm.lastCleaned || 'Pending Verification',
            controlsSummary,
            occupancy,
            rm.notes || rm.recleanReason || ''
          ]);

          // Building
          setCellStyle(currentRow, 0, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 10, color: { rgb: '475569' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Room #
          setCellStyle(currentRow, 1, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
            alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
            border: thinBorder
          });

          // Floor
          setCellStyle(currentRow, 2, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 9, color: { rgb: '64748B' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Status Badge
          setCellStyle(currentRow, 3, {
            fill: { fgColor: { rgb: statusBg } },
            font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: statusFg } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Staff Assigned
          setCellStyle(currentRow, 4, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 10, bold: rm.staff && rm.staff !== 'Unassigned', color: { rgb: '0F172A' } },
            alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
            border: thinBorder
          });

          // Last Verified
          setCellStyle(currentRow, 5, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 9, color: { rgb: '64748B' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Controls (AC / Lights / Locked)
          setCellStyle(currentRow, 6, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 9, fontMono: true, color: { rgb: '334155' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Occupancy Status
          setCellStyle(currentRow, 7, {
            fill: { fgColor: { rgb: rm.hasStudents ? 'FEF3C7' : zebraBg } },
            font: { name: 'Calibri', sz: 9, bold: rm.hasStudents, color: { rgb: rm.hasStudents ? '92400E' : '64748B' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Notes
          setCellStyle(currentRow, 8, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '475569' } },
            alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
            border: thinBorder
          });

          currentRow++;
        });

        // Blank spacer between buildings
        rows.push(['', '', '', '', '', '', '', '', '']);
        currentRow++;
      });

      const wb = XLSX.utils.book_new();
      const wsRooms = XLSX.utils.aoa_to_sheet(rows);

      wsRooms['!merges'] = merges;
      wsRooms['!cols'] = [
        { wch: 18 }, // Building
        { wch: 16 }, // Room #
        { wch: 12 }, // Floor
        { wch: 18 }, // Status
        { wch: 28 }, // Staff
        { wch: 20 }, // Last Verified
        { wch: 38 }, // Controls Summary
        { wch: 20 }, // Occupancy
        { wch: 34 }  // Notes
      ];

      wsRooms['!rows'] = [
        { hpt: 28 }, // Title
        { hpt: 18 }, // Meta
        { hpt: 8  }, // Spacer
        { hpt: 24 }  // Header
      ];

      Object.keys(cellStyles).forEach((k) => {
        if (wsRooms[k]) wsRooms[k].s = cellStyles[k];
      });

      XLSX.utils.book_append_sheet(wb, wsRooms, 'Campus Classroom Audit');

      // --- SHEET 2: CAMPUS SUPPLIES INVENTORY AUDIT ---
      const supplyRows = [];
      const supplyStyles = {};
      const supplyMerges = [];

      const setSupplyStyle = (r, c, style) => {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        supplyStyles[cellRef] = style;
      };

      supplyRows.push(['PHINMA SAINT JUDE COLLEGE — CAMPUS STORAGE INVENTORY AUDIT', '', '', '', '', '', '']);
      supplyMerges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } });
      for (let c = 0; c <= 6; c++) {
        setSupplyStyle(0, c, {
          fill: { fgColor: { rgb: PALETTE.campusGreen } },
          font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: PALETTE.white } },
          alignment: { vertical: 'center', horizontal: 'left', indent: 1 }
        });
      }

      supplyRows.push([`Inventory Generated: ${dateFormatted} at ${timeFormatted} | Facilities Storage`, '', '', '', '', '', '']);
      supplyMerges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 6 } });
      for (let c = 0; c <= 6; c++) {
        setSupplyStyle(1, c, {
          fill: { fgColor: { rgb: PALETTE.titleSubBg } },
          font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: PALETTE.titleSubText } },
          alignment: { vertical: 'center', horizontal: 'left', indent: 1 }
        });
      }

      supplyRows.push(['', '', '', '', '', '', '']);

      supplyRows.push([
        'CATEGORY',
        'ITEM NAME',
        'QUANTITY',
        'UNIT',
        'MIN THRESHOLD',
        'STOCK HEALTH',
        'SAFETY CLASSIFICATION'
      ]);
      for (let c = 0; c <= 6; c++) {
        setSupplyStyle(3, c, {
          fill: { fgColor: { rgb: PALETTE.slateDark } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: PALETTE.white } },
          alignment: { vertical: 'center', horizontal: c === 1 ? 'left' : 'center' },
          border: thinBorder
        });
      }

      let sRow = 4;
      supplies.forEach((sItem, sIdx) => {
        const isLow = sItem.quantity <= sItem.threshold;
        const isCritical = sItem.quantity <= 0;
        const zebraBg = sIdx % 2 === 1 ? PALETTE.slateLight : PALETTE.white;

        supplyRows.push([
          sItem.category || 'General',
          sItem.name,
          sItem.quantity,
          sItem.unit || 'pcs',
          sItem.threshold || 1,
          isCritical ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'OPTIMAL',
          (sItem.category === 'Chemicals' || sItem.category === 'PPE') ? 'RESTRICTED / SAFETY' : 'GENERAL CAMPUS'
        ]);

        for (let c = 0; c <= 6; c++) {
          setSupplyStyle(sRow, c, {
            fill: { fgColor: { rgb: c === 5 ? (isCritical ? 'FEE2E2' : isLow ? 'FEF3C7' : 'D1FAE5') : zebraBg } },
            font: { 
              name: 'Calibri', 
              sz: 9, 
              bold: c === 1 || c === 5,
              color: { rgb: c === 5 ? (isCritical ? '991B1B' : isLow ? '92400E' : '065F46') : '1E293B' } 
            },
            alignment: { vertical: 'center', horizontal: c === 1 ? 'left' : 'center' },
            border: thinBorder
          });
        }
        sRow++;
      });

      const wsSupplies = XLSX.utils.aoa_to_sheet(supplyRows);
      wsSupplies['!merges'] = supplyMerges;
      wsSupplies['!cols'] = [
        { wch: 20 }, // Category
        { wch: 32 }, // Item Name
        { wch: 14 }, // Quantity
        { wch: 12 }, // Unit
        { wch: 16 }, // Min Threshold
        { wch: 18 }, // Stock Health
        { wch: 26 }  // Safety Classification
      ];

      Object.keys(supplyStyles).forEach((k) => {
        if (wsSupplies[k]) wsSupplies[k].s = supplyStyles[k];
      });

      XLSX.utils.book_append_sheet(wb, wsSupplies, 'Supplies Stock Audit');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `PHINMA_SJC_Campus_Facilities_Report_${dateStr}.xlsx`);
      showToast('Executive Campus Report downloaded as styled Excel (.xlsx)!');
    } catch (err) {
      console.error('Excel Generation error:', err);
      showError('Could not generate styled Excel spreadsheet.');
    }
  };

  const filteredPickerStaff = staffRoster
    .filter((s) => s.role !== 'admin' && String(s.id).toLowerCase() !== 'admin')
    .filter((s) => {
      const q = staffPickerSearch.toLowerCase().trim();
      if (!q) return true;
      return getStaffName(s).toLowerCase().includes(q) || String(s.id).toLowerCase().includes(q);
    });

  return (
    <div className="p-4 pt-2.5 space-y-3.5 pb-28 text-slate-800">
      
      {/* Precision Micro-Animation Styles with Strict Animation Toggle Overrides */}
      <style>{`
        ${animationsDisabled ? `
          *, .anim-cascade-item, .anim-pop-item {
            animation: none !important;
            transition-duration: 0ms !important;
            transform: none !important;
            opacity: 1 !important;
          }
        ` : `
          @keyframes itemFloatUp {
            from {
              opacity: 0;
              transform: translate3d(0, 16px, 0) scale(0.975);
            }
            to {
              opacity: 1;
              transform: translate3d(0, 0, 0) scale(1);
            }
          }
          @keyframes itemPopIn {
            0% {
              opacity: 0;
              transform: scale(0.92);
            }
            65% {
              opacity: 1;
              transform: scale(1.02);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
          .anim-cascade-item {
            animation: itemFloatUp 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
            will-change: transform, opacity;
          }
          .anim-pop-item {
            animation: itemPopIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
            will-change: transform, opacity;
          }
        `}
      `}</style>

      {/* Toast Notifications */}
      {toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-20 inset-x-0 z-[150] max-w-sm mx-auto px-4 pointer-events-none animate-toast select-none">
          <div className="pointer-events-auto p-3.5 bg-emerald-50/95 backdrop-blur-sm border border-emerald-300/80 text-emerald-800 text-xs font-semibold rounded-3xl flex items-center gap-2.5 shadow-xl anim-pop-item">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{toastMessage}</span>
          </div>
        </div>,
        document.body
      )}

      {errorMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-20 inset-x-0 z-[150] max-w-sm mx-auto px-4 pointer-events-none animate-toast select-none">
          <div className="pointer-events-auto p-3.5 bg-rose-50/95 backdrop-blur-sm border border-rose-300/80 text-rose-800 text-xs font-semibold rounded-3xl flex items-center gap-2.5 shadow-xl animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <div 
        className="pt-0.5 anim-cascade-item" 
        style={{ animationDelay: !animationsDisabled ? '0ms' : '0ms' }}
      >
        <h2 className="text-base font-bold text-slate-900 leading-tight">
          Campus Operations Management
        </h2>
        <div className="mt-1 flex items-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200/80 text-rose-800 text-[10px] font-bold tracking-wider uppercase select-none">
            <span className={`w-1.5 h-1.5 rounded-full bg-rose-500 ${!animationsDisabled ? 'animate-pulse' : ''}`} />
            <span>Supervisor Control Center</span>
          </span>
        </div>
      </div>

      {/* Tab Selector */}
      <div
        ref={tabBarRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ 
          touchAction: 'none', 
          animationDelay: !animationsDisabled ? '40ms' : '0ms' 
        }}
        className="anim-cascade-item relative p-1 bg-slate-100/90 rounded-2xl grid grid-cols-4 select-none border border-slate-200/50 shadow-2xs cursor-grab active:cursor-grabbing"
      >
        <div
          className="absolute top-1 bottom-1 rounded-xl bg-white shadow-xs pointer-events-none z-0"
          style={{
            width: 'calc((100% - 8px) / 4)',
            left: '4px',
            transform: `translateX(${effectiveOffset * 100}%)`,
            transition: animationsDisabled || isScrubbing ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        />

        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative z-10 py-2 text-center text-xs font-bold transition-colors duration-150 active:scale-95 outline-none ${
              activeTab === tab.id ? 'text-[#176e57]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div key={activeTab} className="space-y-3">
        
        {/* TAB 1: STAFF */}
        {activeTab === 'staff' && (
          <div className="space-y-3">
            <div 
              className="anim-cascade-item flex items-center justify-between w-full"
              style={{ animationDelay: !animationsDisabled ? '30ms' : '0ms' }}
            >
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold text-xs rounded-2xl shadow-xs transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 active:scale-95 rounded-2xl shadow-xs transition"
                title="Delete Staff Account"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            </div>

            {/* Staff Roster Card */}
            <div 
              className="anim-cascade-item bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden"
              style={{ animationDelay: !animationsDisabled ? '80ms' : '0ms' }}
            >
              <button
                type="button"
                onClick={() => setShowStaffDropdown(!showStaffDropdown)}
                className="w-full p-4 flex items-center justify-between text-left active:bg-slate-50 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-[#176e57] rounded-xl">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Staff Roster ({staffRoster.length})
                      </h3>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${!animationsDisabled ? 'animate-pulse' : ''}`} />
                        {onlineUsers.length} Online
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Tap to view registered staff and live presence
                    </p>
                  </div>
                </div>

                <div className="p-1 rounded-lg text-slate-400">
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${
                    showStaffDropdown ? 'rotate-180 text-[#176e57]' : ''
                  }`} />
                </div>
              </button>

              <div 
                className={`grid transition-[grid-template-rows] ${
                  animationsDisabled ? 'duration-0' : 'duration-300 ease-out'
                } ${showStaffDropdown ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <div className="px-4 pb-3.5 pt-1 border-t border-slate-100 space-y-1.5">
                    {staffRoster.map((member, mIdx) => {
                      const isOnline = onlineUsers.some((u) => String(u.id) === String(member.id));
                      const memberAvatar = staffAvatars[member.id];
                      const memberName = getStaffName(member);

                      return (
                        <div
                          key={member.id}
                          className="anim-cascade-item py-2 px-3 rounded-2xl bg-slate-50/60 border border-slate-100 flex items-center justify-between text-xs"
                          style={{ animationDelay: !animationsDisabled ? `${mIdx * 35}ms` : '0ms' }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex-shrink-0">
                              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#176e57] flex items-center justify-center font-bold text-xs overflow-hidden border border-emerald-300/40">
                                {memberAvatar ? (
                                  <img
                                    src={memberAvatar}
                                    alt={memberName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{memberName[0]}</span>
                                )}
                              </div>
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${
                                isOnline ? (animationsDisabled ? 'bg-emerald-500' : 'bg-emerald-500 animate-pulse') : 'bg-slate-300'
                              }`} />
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800 block leading-tight">
                                  {memberName}
                                </span>
                                {member.role === 'admin' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-700">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {member.id} &bull; Lvl {member.access_level || 1}
                              </span>
                            </div>
                          </div>

                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/70 text-slate-600'
                          }`}>
                            {isOnline ? 'Active' : 'Offline'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Building Matrices Header */}
            <div 
              className="anim-cascade-item space-y-2.5 pt-0.5"
              style={{ animationDelay: !animationsDisabled ? '130ms' : '0ms' }}
            >
              <div className="px-1">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Campus Building Matrices
                </h3>
                <p className="text-[10px] text-slate-400">
                  Tap any building below to view floors, rooms, and assign personnel
                </p>
              </div>

              {CAMPUS_BUILDINGS.map((bldg, bIdx) => {
                const isOpen = openBuildings[bldg.id];
                const assignedFloorsCount = [1, 2, 3, 4, 5, 6, 7].filter(
                  (f) => getAssignedStaffList(bldg.id, f).length > 0
                ).length;

                return (
                  <div
                    key={bldg.id}
                    className="anim-cascade-item bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden transition"
                    style={{ animationDelay: !animationsDisabled ? `${170 + bIdx * 65}ms` : '0ms' }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleBuilding(bldg.id)}
                      className="w-full p-4 flex items-center justify-between text-left active:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-[#176e57] flex items-center justify-center font-bold flex-shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-slate-800">
                              {bldg.name}
                            </h3>
                            <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border ${
                              assignedFloorsCount === 7
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : assignedFloorsCount > 0
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {assignedFloorsCount}/7 Floors Assigned
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Floors 1 to 7 checklist assignments
                          </p>
                        </div>
                      </div>

                      <div className="p-1 rounded-xl text-slate-400">
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${
                          isOpen ? 'rotate-180 text-[#176e57]' : ''
                        }`} />
                      </div>
                    </button>

                    <div 
                      className={`grid transition-[grid-template-rows] ${
                        animationsDisabled ? 'duration-0' : 'duration-300 ease-out'
                      } ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-2">
                          {[1, 2, 3, 4, 5, 6, 7].map((floorNum, fIdx) => {
                            const staffIdList = getAssignedStaffList(bldg.id, floorNum);
                            const roomListText = getRoomsForFloor(bldg.id, floorNum);

                            const assignedStaffMembers = staffIdList
                              .map((id) => staffRoster.find((s) => String(s.id) === String(id)))
                              .filter(Boolean);

                            const hasAssignments = assignedStaffMembers.length > 0;
                            const mainTitle = hasAssignments
                              ? assignedStaffMembers.map((s) => getStaffName(s)).join(', ')
                              : 'Assign Staff';
                            const subText = hasAssignments
                              ? `ID: ${assignedStaffMembers.map((s) => s.id).join(', ')}`
                              : 'Tap to select';

                            return (
                              <div
                                key={floorNum}
                                className="anim-cascade-item p-3 bg-slate-50/60 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 text-xs"
                                style={{ animationDelay: !animationsDisabled ? `${fIdx * 25}ms` : '0ms' }}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-[#176e57] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                    F{floorNum}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-800 block text-[11px] leading-tight">
                                      Floor {floorNum}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono block truncate max-w-[140px]" title={roomListText}>
                                      Rooms: {roomListText}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleOpenAssignModal(bldg.id, floorNum)}
                                  className={`flex items-center gap-2 h-10 min-w-[140px] max-w-[190px] px-2.5 rounded-2xl border transition active:scale-95 shadow-2xs flex-shrink-0 ${
                                    hasAssignments
                                      ? 'bg-white border-emerald-300/80 text-slate-800'
                                      : 'bg-white/80 border-dashed border-slate-200 text-slate-400 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center -space-x-2 flex-shrink-0">
                                    {hasAssignments ? (
                                      assignedStaffMembers.slice(0, 3).map((staffObj) => {
                                        const pfp = staffAvatars[staffObj.id];
                                        return (
                                          <div 
                                            key={staffObj.id}
                                            className="w-6 h-6 rounded-lg bg-emerald-100 text-[#176e57] flex items-center justify-center font-bold text-[9px] overflow-hidden ring-2 ring-white"
                                          >
                                            {pfp ? (
                                              <img src={pfp} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                              <span>{getStaffName(staffObj)[0]}</span>
                                            )}
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                        <User className="w-3.5 h-3.5" />
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-left min-w-0 flex-1">
                                    <span className="block font-bold truncate text-[11px] leading-tight" title={mainTitle}>
                                      {mainTitle}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono block leading-none truncate mt-0.5" title={subText}>
                                      {subText}
                                    </span>
                                  </div>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: NOTICE */}
        {activeTab === 'notice' && (
          <div className="space-y-3">
            <div 
              className="anim-cascade-item bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3.5"
              style={{ animationDelay: !animationsDisabled ? '40ms' : '0ms' }}
            >
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="p-2 bg-amber-50 text-amber-800 rounded-xl">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Campus Broadcast Banner
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Pushes a priority supervisor notice to all active devices
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveBroadcast} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Announcement Message:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={noticeText}
                    onChange={(e) => setNoticeText(e.target.value)}
                    placeholder="Executive inspection in Silang & Dimasalang at 1:30 PM. Ensure halls are clear."
                    className="w-full p-3 text-xs border border-slate-100 rounded-2xl focus:outline-none focus:border-[#176e57] bg-slate-50 text-slate-800 resize-none shadow-2xs"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isUpdatingNotice || !noticeText.trim()}
                    className="flex-1 py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold text-xs rounded-2xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdatingNotice ? 'Publishing...' : 'Broadcast to All Staff'}</span>
                  </button>

                  {broadcast?.active && (
                    <button
                      type="button"
                      onClick={handleClearBroadcast}
                      className="py-2.5 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-2xl border border-rose-200 active:scale-95 transition"
                    >
                      Turn Off
                    </button>
                  )}
                </div>
              </form>

              {broadcast?.active && (
                <div 
                  className="anim-pop-item mt-3 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs space-y-1"
                  style={{ animationDelay: !animationsDisabled ? '100ms' : '0ms' }}
                >
                  <span className="font-bold text-amber-950 uppercase tracking-wider text-[10px] block">
                    Currently Live on Screen:
                  </span>
                  <p className="text-amber-900 font-medium">"{broadcast.message}"</p>
                  <span className="text-[10px] text-amber-700 font-mono block">
                    Posted: {broadcast.updatedAt || 'Recently'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: STOCK */}
        {activeTab === 'stock' && (
          <div className="space-y-3">
            <div 
              className="anim-cascade-item bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3"
              style={{ animationDelay: !animationsDisabled ? '30ms' : '0ms' }}
            >
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="p-2 bg-emerald-50 text-[#176e57] rounded-xl">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Add Supply to Inventory
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Register items to central storage
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddSupplyItem} className="space-y-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Item Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Mop Heads, Disinfectant, Bond Paper"
                    className="w-full p-2.5 border border-slate-100 rounded-2xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Category:
                    </label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full p-2.5 border border-slate-100 rounded-2xl bg-slate-50 font-semibold focus:outline-none focus:border-[#176e57]"
                    >
                      <option value="Paper & Printing">Paper & Printing</option>
                      <option value="Chemicals">Chemicals</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Disposables">Disposables</option>
                      <option value="Hygiene">Hygiene</option>
                      <option value="PPE">PPE</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Unit Type:
                    </label>
                    <input
                      type="text"
                      required
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      placeholder="pcs, gals, rolls, packs"
                      className="w-full p-2.5 border border-slate-100 rounded-2xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Initial Quantity:
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      placeholder="10"
                      className="w-full p-2.5 border border-slate-100 rounded-2xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Low Stock Threshold:
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newItemThreshold}
                      onChange={(e) => setNewItemThreshold(e.target.value)}
                      placeholder="3"
                      className="w-full p-2.5 border border-slate-100 rounded-2xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAddingSupply || !newItemName.trim()}
                  className="w-full py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-2xl transition shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingSupply ? 'Saving...' : 'Add Item to Storage'}</span>
                </button>
              </form>
            </div>

            {/* Inventory List with Staggered Rows */}
            <div 
              className="anim-cascade-item bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-2.5"
              style={{ animationDelay: !animationsDisabled ? '80ms' : '0ms' }}
            >
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2.5">
                Existing Inventory ({supplies.length} Items)
              </h3>

              <div className="space-y-2">
                {supplies.map((item, sIdx) => {
                  const isLow = item.quantity <= item.threshold;

                  return (
                    <div
                      key={item.id}
                      className="anim-cascade-item p-3 rounded-2xl bg-slate-50/60 border border-slate-100 flex items-center justify-between text-xs transition"
                      style={{ animationDelay: !animationsDisabled ? `${110 + sIdx * 35}ms` : '0ms' }}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{item.name}</span>
                          {isLow && (
                            <span className={`text-[9px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full ${!animationsDisabled ? 'animate-pulse' : ''}`}>
                              Low
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block font-medium mt-0.5">
                          {item.category || 'General'} &bull; Min: {item.threshold} {item.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-xl p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, -1)}
                            className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold active:scale-90 text-slate-700 flex items-center justify-center transition"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-xs px-1.5 min-w-[28px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, 1)}
                            className="w-6 h-6 rounded-lg bg-[#176e57] hover:bg-[#135c49] font-bold active:scale-90 text-white flex items-center justify-center transition"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSupply(item.id, item.name)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-90 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SHIFT */}
        {activeTab === 'shift' && (
          <div className="space-y-3">
            <div 
              className="anim-cascade-item bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3.5"
              style={{ animationDelay: !animationsDisabled ? '30ms' : '0ms' }}
            >
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Shift Operations & Data Export
                </h3>
                <p className="text-[10px] text-slate-400">
                  Inspection reset and formal facilities reports
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="anim-cascade-item w-full p-3.5 bg-emerald-50/80 hover:bg-emerald-100 active:scale-95 text-[#176e57] border border-emerald-200/60 rounded-2xl font-bold text-xs flex items-center justify-between transition shadow-xs"
                  style={{ animationDelay: !animationsDisabled ? '60ms' : '0ms' }}
                >
                  <div className="flex items-center gap-2.5">
                    <Download className="w-4 h-4 text-emerald-700" />
                    <div className="text-left">
                      <span className="block font-bold">Export Excel Report (.xlsx)</span>
                      <span className="text-[10px] text-emerald-800 block font-normal">
                        Classrooms with building names, verification status, and stock
                      </span>
                    </div>
                  </div>
                  <span className="text-xs">&rarr;</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetDay}
                  className="anim-cascade-item w-full p-3.5 bg-amber-50/80 hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-200/60 rounded-2xl font-bold text-xs flex items-center justify-between transition shadow-xs"
                  style={{ animationDelay: !animationsDisabled ? '110ms' : '0ms' }}
                >
                  <div className="flex items-center gap-2.5">
                    <RotateCcw className="w-4 h-4 text-amber-700" />
                    <div className="text-left">
                      <span className="block font-bold">Reset Campus for New Day</span>
                      <span className="text-[10px] text-amber-800 block font-normal">
                        Sets all classrooms back to Pending inspection
                      </span>
                    </div>
                  </div>
                  <span className="text-xs">&rarr;</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="anim-cascade-item w-full p-3.5 bg-rose-50/80 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200/60 rounded-2xl font-bold text-xs flex items-center justify-between transition shadow-xs"
                  style={{ animationDelay: !animationsDisabled ? '160ms' : '0ms' }}
                >
                  <div className="flex items-center gap-2.5">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <div className="text-left">
                      <span className="block font-bold">Clear Shift Notes & Logs</span>
                      <span className="text-[10px] text-rose-800 block font-normal">
                        Wipes handover reports and incident records
                      </span>
                    </div>
                  </div>
                  <span className="text-xs">&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* SEARCHABLE MULTI-STAFF ASSIGNMENT MODAL */}
      {activeAssignSlot && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
          onClick={() => {
            setActiveAssignSlot(null);
            setStaffPickerSearch('');
          }}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] anim-cascade-item overflow-hidden space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-[#176e57] rounded-xl">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Assign Floor Personnel
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {activeAssignSlot.building} &bull; Floor {activeAssignSlot.floor} ({stagedStaffIds.length} Selected)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveAssignSlot(null);
                  setStaffPickerSearch('');
                }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={staffPickerSearch}
                onChange={(e) => setStaffPickerSearch(e.target.value)}
                placeholder="Search staff name or ID..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#176e57]"
              />
              {staffPickerSearch && (
                <button
                  type="button"
                  onClick={() => setStaffPickerSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 text-xs">
              <button
                type="button"
                onClick={() => handleToggleStagedStaff('')}
                className="w-full p-2.5 rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 font-bold flex items-center justify-between transition active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                    <X className="w-4 h-4" />
                  </div>
                  <span>Clear All Assignments (Unassigned)</span>
                </div>
                <span className="text-[10px] text-rose-400">&times;</span>
              </button>

              {filteredPickerStaff.map((staff, pIdx) => {
                const isSelected = stagedStaffIds.includes(String(staff.id));
                const avatar = staffAvatars[staff.id];
                const isOnline = onlineUsers.some((u) => String(u.id) === String(staff.id));
                const name = getStaffName(staff);

                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => handleToggleStagedStaff(String(staff.id))}
                    className={`anim-cascade-item w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition active:scale-98 ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 border-slate-100'
                    }`}
                    style={{ animationDelay: !animationsDisabled ? `${pIdx * 25}ms` : '0ms' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#176e57] flex items-center justify-center font-bold text-xs overflow-hidden border border-emerald-300/40">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{name[0]}</span>
                          )}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${
                          isOnline ? (animationsDisabled ? 'bg-emerald-500' : 'bg-emerald-500 animate-pulse') : 'bg-slate-300'
                        }`} />
                      </div>

                      <div>
                        <span className="font-bold text-slate-800 block text-xs">
                          {name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {staff.id}
                        </span>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                      isSelected ? 'bg-[#176e57] border-[#176e57] text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={handleApplyAssignments}
                className="w-full py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-2xl text-xs transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CREATE ACCOUNT MODAL */}
      {showCreateModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3.5 anim-cascade-item overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-[#176e57] rounded-xl">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Create New Account
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Register a new staff or admin user
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Staff ID:
                </label>
                <input
                  type="text"
                  required
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="ID (e.g. 006)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#176e57] font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Full Name:
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#176e57] font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Email Address:
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="name.surname.sjc@phinmaed.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#176e57] font-semibold"
                />
              </div>

              {/* Create Initial Password Field */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Create Password:
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showNewUserPassword ? 'text' : 'password'}
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Create initial password for user"
                    className="w-full pl-8 pr-9 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#176e57] font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                    title={showNewUserPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    System Role:
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => {
                      const role = e.target.value;
                      setNewUserRole(role);
                      setNewUserAccessLevel(role === 'admin' ? 2 : 1);
                    }}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none focus:border-[#176e57]"
                  >
                    <option value="staff">Staff (Field)</option>
                    <option value="admin">Admin (Supervisor)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Access Level:
                  </label>
                  <select
                    value={newUserAccessLevel}
                    onChange={(e) => setNewUserAccessLevel(Number(e.target.value))}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none focus:border-[#176e57]"
                  >
                    <option value={1}>Level 1 (Field)</option>
                    <option value={2}>Level 2 (Supervisor)</option>
                  </select>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-[#176e57] block">Database & First-Login Policy:</span>
                <p className="text-[10px] text-slate-600">
                  Account credentials save directly to the database.
                </p>
                <p className="text-[9px] text-slate-500">
                  Upon first sign-in, the user will be prompted to create a permanent password with 1 lowercase, 1 uppercase, 1 number, and 1 special character.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl active:scale-95 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAccount}
                  className="flex-1 py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {isCreatingAccount ? 'Registering...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
          onClick={() => setShowDeleteModal(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3.5 anim-cascade-item overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Delete Account
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Permanently delete staff or admin credentials
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Select the staff or secondary admin account you wish to permanently remove from the system.
              </p>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Select Account:
                </label>
                <select
                  value={selectedUserToDelete}
                  onChange={(e) => setSelectedUserToDelete(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none focus:border-rose-500 text-slate-800"
                >
                  <option value="">Select Account</option>
                  {staffRoster
                    .filter((s) => String(s.id).toLowerCase() !== 'admin')
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {getStaffName(staff)} (ID: {staff.id}){staff.role === 'admin' ? ' — [Admin]' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold block uppercase tracking-wider">
                  Warning
                </span>
                <p className="text-[10px] leading-relaxed text-rose-700">
                  Deleting this user will unassign them from any assigned floors across all buildings and reset those classrooms back to Unassigned.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedUserToDelete('');
                  }}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl active:scale-95 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedUserToDelete || isDeletingAccount}
                  onClick={handleDeleteAccount}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {isDeletingAccount ? 'Deleting...' : 'Confirm & Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}