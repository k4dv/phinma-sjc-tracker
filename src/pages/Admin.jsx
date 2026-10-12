import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../data/supabaseClient';
import { api } from '../services/api';
import * as XLSX from 'xlsx';
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
  Lock 
} from 'lucide-react';

const FALLBACK_ROSTER = [
  { id: '001', name: 'Kuya Bert', role: 'staff', access_level: 1, email: 'vhma.nacion.sjc@phinmaed.com' },
  { id: '002', name: 'Ate Linda', role: 'staff', access_level: 1, email: 'cami.ubuwon.sjc@phinmaed.com' },
  { id: '003', name: 'Kuya Jun', role: 'staff', access_level: 1, email: 'anco.alfanta.sjc@phinmaed.com' },
  { id: '004', name: 'Ate Marites', role: 'staff', access_level: 1, email: 'rade.copones.sjc@phinmaed.com' },
  { id: '005', name: 'Kuya Jomar', role: 'staff', access_level: 1, email: 'vhma.nacion.sjc@phinmaed.com' },
  { id: 'admin', name: 'System Administrator', role: 'admin', access_level: 2, email: 'vhma.nacion.sjc@phinmaed.com' }
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

  // Staff list state (loaded dynamically from database)
  const [staffRoster, setStaffRoster] = useState(FALLBACK_ROSTER);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [staffAvatars, setStaffAvatars] = useState({});

  // Account Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('staff');
  const [newUserAccessLevel, setNewUserAccessLevel] = useState(1);
  const [adminSecretPasscode, setAdminSecretPasscode] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // Account Deletion Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUserToDelete, setSelectedUserToDelete] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Check animation preferences
  const animationsDisabled = localStorage.getItem('sjc_animations_disabled') === 'true';

  // Broadcast Notice Form
  const [noticeText, setNoticeText] = useState(broadcast.message || '');
  const [isUpdatingNotice, setIsUpdatingNotice] = useState(false);

  // New Supply Item Form
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Chemicals');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('bottles');
  const [newItemThreshold, setNewItemThreshold] = useState('5');
  const [isAddingSupply, setIsAddingSupply] = useState(false);

  const activeTabIndex = ADMIN_TABS.findIndex((t) => t.id === activeTab);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 3500);
  };

  // Helper to resolve clean staff names
  const getStaffName = (staffObj) => {
    if (!staffObj) return 'Unassigned';
    if (staffObj.name && staffObj.name !== 'Staff Member') return staffObj.name;
    const fallback = FALLBACK_ROSTER.find((f) => f.id === staffObj.id);
    return fallback ? fallback.name : (staffObj.name || `Staff ${staffObj.id}`);
  };

  // Fetch users from database & initialize avatars
  const fetchUsersAndAvatars = async () => {
    try {
      const users = await api.getUsers();
      if (users && users.length > 0) {
        setStaffRoster(users);
      }
    } catch {
      try {
        const { data } = await supabase.from('profiles').select('*').order('id', { ascending: true });
        if (data && data.length > 0) {
          setStaffRoster(data);
        }
      } catch (err) {
        console.error('Failed to load user roster:', err);
      }
    }

    try {
      const localMap = {};
      FALLBACK_ROSTER.forEach((member) => {
        const local = localStorage.getItem(`sjc_avatar_${member.id}`);
        if (local) localMap[member.id] = local;
      });

      const { data, error } = await supabase.from('profiles').select('id, avatar');
      if (!error && data) {
        const cloudMap = { ...localMap };
        data.forEach((item) => {
          if (item.avatar) {
            cloudMap[item.id] = item.avatar;
            localStorage.setItem(`sjc_avatar_${item.id}`, item.avatar);
          }
        });
        setStaffAvatars(cloudMap);
      } else {
        setStaffAvatars(localMap);
      }
    } catch (err) {
      console.error('Failed to load avatars:', err);
    }
  };

  useEffect(() => {
    fetchUsersAndAvatars();
  }, []);

  // 1. User Account Creation Handler
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!newUserId.trim() || !newUserName.trim() || !newUserEmail.trim()) {
      showError('Please provide Staff ID, Full Name, and Email.');
      return;
    }

    if (newUserRole === 'admin') {
      if (adminSecretPasscode.trim() !== 'idiot123') {
        showError('Unauthorized: Incorrect supervisor secret password.');
        return;
      }
    }

    setIsCreatingAccount(true);

    const payload = {
      id: newUserId.trim(),
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      access_level: Number(newUserAccessLevel),
      temporaryPassword: 'sjc1234'
    };

    try {
      const res = await api.createUser(payload);
      const createdUser = res.data || payload;

      setStaffRoster((prev) => [...prev, createdUser]);
      showToast(`Account created for ${payload.name}!`);
      setNewUserId('');
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('staff');
      setNewUserAccessLevel(1);
      setAdminSecretPasscode('');
      setShowCreateModal(false);
    } catch (err) {
      console.warn('API error, attempting direct Supabase fallback:', err);
      try {
        const { data, error } = await supabase.from('profiles').insert([{
          id: payload.id,
          name: payload.name,
          email: payload.email,
          role: payload.role,
          access_level: payload.access_level,
          password: 'sjc1234',
          is_first_login: true
        }]).select();

        if (error) throw error;
        if (data && data[0]) {
          setStaffRoster((prev) => [...prev, data[0]]);
        }
        showToast(`Account created for ${payload.name}!`);
        setNewUserId('');
        setNewUserName('');
        setNewUserEmail('');
        setAdminSecretPasscode('');
        setShowCreateModal(false);
      } catch (fallbackErr) {
        console.error('Failed to create account:', fallbackErr);
        showError(fallbackErr.message || 'Error creating account. ID might already exist.');
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  // 2. User Account Deletion Handler with Assignment Cleanup
  const handleDeleteAccount = async () => {
    if (!selectedUserToDelete) return;
    setIsDeletingAccount(true);

    const targetId = selectedUserToDelete;
    const targetUser = staffRoster.find((s) => s.id === targetId);
    const targetName = getStaffName(targetUser);

    try {
      const { error: deleteErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', targetId);

      if (deleteErr) throw deleteErr;

      // Identify floors assigned to this user
      const affectedFloors = Object.entries(assignments)
        .filter(([_, id]) => id === targetId)
        .map(([floor]) => Number(floor));

      if (affectedFloors.length > 0) {
        const updatedAssignments = { ...assignments };
        affectedFloors.forEach((f) => {
          delete updatedAssignments[f];
        });
        if (setAssignments) setAssignments(updatedAssignments);

        await supabase.from('assignments').delete().eq('staff_id', targetId);

        if (setRooms) {
          setRooms((prev) =>
            prev.map((r) =>
              affectedFloors.includes(Number(r.floor))
                ? { ...r, staff: 'Unassigned' }
                : r
            )
          );
        }

        for (const f of affectedFloors) {
          await supabase.from('rooms').update({ staff: 'Unassigned' }).eq('floor', f);
        }
      }

      setStaffRoster((prev) => prev.filter((s) => s.id !== targetId));
      showToast(`Account for ${targetName} was deleted.`);
      setShowDeleteModal(false);
      setSelectedUserToDelete('');
    } catch (err) {
      console.error('Failed to delete user:', err);
      showError(err.message || 'Failed to delete user account.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // 3. Floor Assignment Handler (Synchronized with Rooms State & Supabase)
  const handleAssignFloor = async (floorNum, staffId) => {
    const staffObj = staffRoster.find((s) => s.id === staffId);
    const staffName = staffId ? getStaffName(staffObj) : 'Unassigned';

    const nextMap = { ...assignments, [floorNum]: staffId };
    if (setAssignments) setAssignments(nextMap);

    if (setRooms) {
      setRooms((prev) =>
        prev.map((r) =>
          Number(r.floor) === Number(floorNum)
            ? { ...r, staff: staffName }
            : r
        )
      );
    }

    try {
      if (staffId) {
        await supabase.from('assignments').upsert({ floor: floorNum, staff_id: staffId });
      } else {
        await supabase.from('assignments').delete().eq('floor', floorNum);
      }

      await supabase
        .from('rooms')
        .update({ staff: staffName })
        .eq('floor', floorNum);

      showToast(`Floor ${floorNum} assigned to ${staffName}.`);
    } catch (err) {
      console.error('Failed to save assignment:', err);
      showError('Database error updating floor assignment.');
    }
  };

  // 4. Notice Broadcast Handlers
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
    } catch (err) {
      console.error('Broadcast failed:', err);
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
    } catch (err) {
      console.error('Failed to clear announcement:', err);
      showError('Could not deactivate broadcast.');
    }
  };

  // 5. Supply Inventory Handlers
  const handleAddSupplyItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setIsAddingSupply(true);
    const parsedQty = parseInt(newItemQty, 10) || 0;
    const parsedThreshold = parseInt(newItemThreshold, 10) || 1;

    const newSupplyObj = {
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: parsedQty,
      unit: newItemUnit.trim() || 'pcs',
      threshold: parsedThreshold
    };

    try {
      const res = await api.addSupply(newSupplyObj);
      const createdItem = res.data || res;

      if (createdItem && setSupplies) {
        setSupplies((prev) => [...prev, createdItem]);
      }
      setNewItemName('');
      setNewItemQty('');
      showToast(`Added ${newSupplyObj.name} to storage!`);
    } catch (err) {
      console.warn('Express API error, falling back to direct Supabase:', err);
      try {
        const { data, error } = await supabase.from('supplies').insert([newSupplyObj]).select();
        if (error) throw error;
        if (data && setSupplies) {
          setSupplies((prev) => [...prev, data[0]]);
        }
        setNewItemName('');
        setNewItemQty('');
        showToast(`Added ${newSupplyObj.name} to storage!`);
      } catch (fallbackErr) {
        console.error('Failed to add supply:', fallbackErr);
        showError('Could not save new inventory item.');
      }
    } finally {
      setIsAddingSupply(false);
    }
  };

  const handleUpdateQuantity = async (supplyId, delta) => {
    const target = supplies.find((s) => s.id === supplyId);
    if (!target) return;

    const updatedQty = Math.max(0, target.quantity + delta);

    if (setSupplies) {
      setSupplies((prev) =>
        prev.map((s) => (s.id === supplyId ? { ...s, quantity: updatedQty } : s))
      );
    }

    try {
      await api.updateSupplyQty(supplyId, updatedQty);
    } catch (err) {
      console.warn('Express update failed, fallback to Supabase:', err);
      try {
        await supabase.from('supplies').update({ quantity: updatedQty }).eq('id', supplyId);
      } catch (fallbackErr) {
        console.error('Failed to adjust supply qty:', fallbackErr);
      }
    }
  };

  const handleDeleteSupply = async (supplyId, name) => {
    if (!window.confirm(`Delete "${name}" from inventory?`)) return;

    if (setSupplies) {
      setSupplies((prev) => prev.filter((s) => s.id !== supplyId));
    }

    try {
      await api.deleteSupply(supplyId);
      showToast(`Removed "${name}" from stock records.`);
    } catch (err) {
      console.warn('Express delete failed, fallback to Supabase:', err);
      try {
        await supabase.from('supplies').delete().eq('id', supplyId);
        showToast(`Removed "${name}" from stock records.`);
      } catch (fallbackErr) {
        console.error('Failed to delete supply item:', fallbackErr);
        showError('Error deleting item from database.');
      }
    }
  };

  // 6. Shift Operations & Reset
  const handleResetDay = async () => {
    if (!window.confirm('Reset all 35 classrooms back to "Pending" for the new shift?')) return;

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
      showToast('Daily classroom checklist reset for all floors!');
    } catch (err) {
      console.error('Shift reset failed:', err);
      showError('Could not reset room records.');
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Delete all handover logs & incident notes?')) return;

    if (setLogs) setLogs([]);

    try {
      await supabase.from('logs').delete().neq('id', 'keep_table_structure');
      showToast('Shift handover logs cleared.');
    } catch (err) {
      console.error('Clear logs error:', err);
    }
  };

  const handleExportExcel = () => {
    try {
      const roomRows = rooms.map((r) => ({
        'Room #': r.id,
        Floor: `Floor ${r.floor}`,
        Status: r.status ? r.status.toUpperCase() : 'PENDING',
        'Staff Assigned': r.staff || 'None',
        'Last Cleaned': r.lastCleaned || 'N/A',
        'AC Verified Off': r.acChecked ? 'YES' : 'NO',
        'Lights Off': r.lightsChecked ? 'YES' : 'NO',
        'Door Locked': r.doorChecked ? 'YES' : 'NO',
        'Class In Session': r.hasStudents ? 'YES' : 'NO',
        Notes: r.notes || r.recleanReason || ''
      }));

      const supplyRows = supplies.map((s) => ({
        Item: s.name,
        Category: s.category || 'General',
        Quantity: s.quantity,
        Unit: s.unit,
        Threshold: s.threshold,
        'Stock Health': s.quantity <= s.threshold ? 'LOW STOCK' : 'OK'
      }));

      const wb = XLSX.utils.book_new();
      const wsRooms = XLSX.utils.json_to_sheet(roomRows);
      const wsSupplies = XLSX.utils.json_to_sheet(supplyRows);

      XLSX.utils.book_append_sheet(wb, wsRooms, 'Classroom Inspection');
      XLSX.utils.book_append_sheet(wb, wsSupplies, 'Supplies Inventory');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `SJC_Dimasalang_Report_${dateStr}.xlsx`);
      showToast('Shift report downloaded as Excel (.xlsx)!');
    } catch (err) {
      console.error('Export failed:', err);
      showError('Could not generate Excel spreadsheet.');
    }
  };

  return (
    <div className="p-4 space-y-3.5 pb-28 text-slate-800">
      
      {/* Floating Top Green Alert Notification */}
      {toastMessage && createPortal(
        <div className="fixed top-20 inset-x-0 z-[150] max-w-md mx-auto px-4 pointer-events-none animate-toast select-none">
          <div className="pointer-events-auto p-3 bg-emerald-50/95 backdrop-blur-sm border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2.5 shadow-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{toastMessage}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Top Error Alert Notification */}
      {errorMessage && createPortal(
        <div className="fixed top-20 inset-x-0 z-[150] max-w-md mx-auto px-4 pointer-events-none animate-toast select-none">
          <div className="pointer-events-auto p-3 bg-rose-50/95 backdrop-blur-sm border border-rose-300 text-rose-800 text-xs font-semibold rounded-2xl flex items-center gap-2.5 shadow-xl animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Admin Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900 leading-tight">
          Campus Operations Management
        </h2>
        <div className="mt-1 flex items-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200/80 text-rose-800 text-[10px] font-bold tracking-wider uppercase select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Supervisor Control Center</span>
          </span>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="relative p-1 bg-slate-100/90 rounded-2xl grid grid-cols-4 select-none">
        <div
          className="absolute top-1 bottom-1 rounded-xl bg-white shadow-xs transition-transform duration-250 ease-out z-0 pointer-events-none"
          style={{
            width: 'calc((100% - 8px) / 4)',
            left: '4px',
            transform: `translateX(${activeTabIndex * 100}%)`
          }}
        />

        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative z-10 py-2 text-center text-xs font-bold transition-colors duration-200 active:scale-95 ${
              activeTab === tab.id ? 'text-[#176e57]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT AREA */}
      <div key={activeTab} className={!animationsDisabled ? 'animate-fade' : ''}>
        
        {/* TAB 1: STAFF */}
        {activeTab === 'staff' && (
          <div className="space-y-3.5">
            {/* Action Bar: Create Account on Far Left, Delete Account on Far Right */}
            <div className="flex items-center justify-between w-full">
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

            {/* Collapsible Staff Dropdown */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
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
                        Staff ({staffRoster.length})
                      </h3>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {onlineUsers.length} Online
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Tap to view registered staff and live presence
                    </p>
                  </div>
                </div>

                <div className="p-1 rounded-lg text-slate-400">
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
                    showStaffDropdown ? 'rotate-180 text-[#176e57]' : ''
                  }`} />
                </div>
              </button>

              {showStaffDropdown && (
                <div className={`px-4 pb-3.5 pt-1 border-t border-slate-100 space-y-1.5 ${
                  !animationsDisabled ? 'animate-dropdown' : ''
                }`}>
                  {staffRoster.map((member) => {
                    const isOnline = onlineUsers.some((u) => String(u.id) === String(member.id));
                    const memberAvatar = staffAvatars[member.id];
                    const memberName = getStaffName(member);
                    const assignedFloors = Object.entries(assignments)
                      .filter(([_, id]) => id === member.id)
                      .map(([f]) => `F${f}`)
                      .join(', ');

                    return (
                      <div
                        key={member.id}
                        className="py-2 px-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="relative flex-shrink-0">
                            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-[#176e57] flex items-center justify-center font-bold text-xs overflow-hidden border border-emerald-300/40">
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
                              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
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
                            {member.email && (
                              <span className="text-[9px] text-slate-400 block truncate max-w-[160px]">
                                {member.email}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md inline-block ${
                            isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/70 text-slate-600'
                          }`}>
                            {isOnline ? 'Active' : 'Offline'}
                          </span>
                          <span className="text-[9px] text-slate-500 block mt-0.5 font-medium">
                            {assignedFloors ? `Assigned: ${assignedFloors}` : 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Floor Matrix */}
            <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-3">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Floor Assignment Matrix
                </h3>
                <p className="text-[10px] text-slate-400">
                  Designate primary personnel for Floors 1 to 7
                </p>
              </div>

              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 7].map((floorNum) => {
                  const currentStaffId = assignments[floorNum] || '';

                  return (
                    <div
                      key={floorNum}
                      className="p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#176e57] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                          F{floorNum}
                        </div>
                        <span className="font-bold text-slate-800">
                          Floor {floorNum}
                        </span>
                      </div>

                      <div className="flex-1 max-w-[210px]">
                        <select
                          value={currentStaffId}
                          onChange={(e) => handleAssignFloor(floorNum, e.target.value)}
                          className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#176e57] shadow-2xs"
                        >
                          <option value="">Unassigned</option>
                          {staffRoster.map((staff) => (
                            <option key={staff.id} value={staff.id}>
                              {getStaffName(staff)} ({staff.id})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NOTICE */}
        {activeTab === 'notice' && (
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
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
                  placeholder="Executive inspection on 4th floor at 1:30 PM. Ensure halls are clear."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#176e57] bg-slate-50 text-slate-800 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isUpdatingNotice || !noticeText.trim()}
                  className="flex-1 py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isUpdatingNotice ? 'Publishing...' : 'Broadcast to All Staff'}</span>
                </button>

                {broadcast?.active && (
                  <button
                    type="button"
                    onClick={handleClearBroadcast}
                    className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 active:scale-95 transition"
                  >
                    Turn Off
                  </button>
                )}
              </div>
            </form>

            {broadcast?.active && (
              <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs space-y-1">
                <span className="font-bold text-amber-950 uppercase tracking-wide text-[10px] block">
                  Currently Live on Screen:
                </span>
                <p className="text-amber-900 font-medium">"{broadcast.message}"</p>
                <span className="text-[10px] text-amber-700 font-mono block">
                  Posted: {broadcast.updatedAt || 'Recently'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: STOCK */}
        {activeTab === 'stock' && (
          <div className="space-y-3.5">
            <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
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
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
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
                      className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none focus:border-[#176e57]"
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
                      className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
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
                      className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
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
                      className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAddingSupply || !newItemName.trim()}
                  className="w-full py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingSupply ? 'Saving...' : 'Add Item to Storage'}</span>
                </button>
              </form>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
                Existing Inventory ({supplies.length} Items)
              </h3>

              <div className="space-y-2">
                {supplies.map((item) => {
                  const isLow = item.quantity <= item.threshold;

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{item.name}</span>
                          {isLow && (
                            <span className="text-[9px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-md">
                              Low
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {item.category || 'General'} &bull; Min: {item.threshold} {item.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, -1)}
                            className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold active:scale-90 text-slate-700 flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-xs px-1.5 min-w-[28px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, 1)}
                            className="w-6 h-6 rounded-lg bg-[#176e57] hover:bg-[#135c49] font-bold active:scale-90 text-white flex items-center justify-center"
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
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4">
            <div className="border-b border-slate-100 pb-2">
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
                className="w-full p-3 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-[#176e57] border border-emerald-200/80 rounded-2xl font-bold text-xs flex items-center justify-between transition shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-700" />
                  <div className="text-left">
                    <span className="block font-bold">Export Excel Report (.xlsx)</span>
                    <span className="text-[10px] text-emerald-800 block font-normal">
                      Classroom logs, verification status, and stock counts
                    </span>
                  </div>
                </div>
                <span className="text-xs">&rarr;</span>
              </button>

              <button
                type="button"
                onClick={handleResetDay}
                className="w-full p-3 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-200/80 rounded-2xl font-bold text-xs flex items-center justify-between transition shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  <div className="text-left">
                    <span className="block font-bold">Reset Campus for New Day</span>
                    <span className="text-[10px] text-amber-800 block font-normal">
                      Sets all 35 rooms back to Pending inspection
                    </span>
                  </div>
                </div>
                <span className="text-xs">&rarr;</span>
              </button>

              <button
                type="button"
                onClick={handleClearLogs}
                className="w-full p-3 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs flex items-center justify-between transition shadow-xs"
              >
                <div className="flex items-center gap-2">
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
        )}

      </div>

      {/* CREATE ACCOUNT MODAL */}
      {showCreateModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3.5 animate-sheet-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-[#176e57] rounded-lg">
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
                  placeholder="ID"
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
                      if (role !== 'admin') setAdminSecretPasscode('');
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

              {/* Secret Authorization Key Prompt for Admin Role */}
              {newUserRole === 'admin' && (
                <div className="p-2.5 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-1.5 animate-pop">
                  <div className="flex items-center gap-1.5 text-rose-800">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                    <label className="text-[10px] font-bold uppercase tracking-wider">
                      Supervisor Security Key:
                    </label>
                  </div>
                  <input
                    type="password"
                    required
                    value={adminSecretPasscode}
                    onChange={(e) => setAdminSecretPasscode(e.target.value)}
                    placeholder="Enter secret passcode to grant admin"
                    className="w-full px-2.5 py-1.5 border border-rose-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-rose-600 font-mono text-xs"
                  />
                  <p className="text-[9px] text-rose-600">
                    Granting supervisor admin access requires authorization.
                  </p>
                </div>
              )}

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-slate-600 block">Default Credentials:</span>
                <p className="text-[10px] text-slate-500">
                  Temporary password: <code className="font-mono font-bold text-emerald-800">sjc1234</code>
                </p>
                <p className="text-[9px] text-slate-400">
                  User will be forced to change this password on their first login.
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
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3.5 animate-sheet-up overflow-hidden"
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
                    Permanently delete staff credentials
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
                Select the staff account you wish to permanently remove from the system.
              </p>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Select Staff Account:
                </label>
                <select
                  value={selectedUserToDelete}
                  onChange={(e) => setSelectedUserToDelete(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none focus:border-rose-500 text-slate-800"
                >
                  <option value="">Select Account</option>
                  {staffRoster
                    .filter((s) => s.id !== 'admin')
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {getStaffName(staff)} (ID: {staff.id})
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold block uppercase tracking-wider">
                  Warning
                </span>
                <p className="text-[10px] leading-relaxed text-rose-700">
                  Deleting this user will unassign them from any assigned floors and reset those classrooms back to Unassigned.
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