import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../data/supabaseClient';
import StaffPresenceModal from '../components/StaffPresenceModal';
import TeacherRequestModal from '../components/TeacherRequestModal';
import { 
  Clock, 
  Layers, 
  Package, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  MessageSquare, 
  Trash2, 
  Users, 
  BellRing, 
  Check, 
  UserCheck, 
  Flame, 
  Plus,
  Filter,
  ArrowUp,
  ChevronDown,
  Sparkles
} from 'lucide-react';

const CAMPUS_BUILDINGS = [
  { id: 'Dimasalang', name: 'Dimasalang' },
  { id: 'Silang', name: 'Silang' },
  { id: 'Phinma', name: 'Phinma' }
];

const getRelativeTime = (timestamp, timeStr) => {
  if (!timestamp && !timeStr) return 'Just now';
  const dateObj = timestamp ? new Date(timestamp) : null;
  if (!dateObj || isNaN(dateObj.getTime())) return timeStr || 'Just now';

  const diffSec = Math.floor((Date.now() - dateObj.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 90) return '1m ago';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return timeStr || dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function Dashboard({
  rooms = [],
  supplies = [],
  logs = [],
  setLogs,
  user,
  assignments = {},
  onlineUsers = [],
  teacherRequests = [],
  setTeacherRequests,
  isDesktopView = false
}) {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || Number(user?.access_level) >= 2;
  const isPcMode = isAdmin && isDesktopView;
  const animationsDisabled = localStorage.getItem('sjc_animations_disabled') === 'true';

  const [shiftNoteInput, setShiftNoteInput] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [requestFilter, setRequestFilter] = useState('active');

  // Logs Hub: Clean Category Filter Dropdown
  const [logCategoryFilter, setLogCategoryFilter] = useState('all'); // 'all' | 'rooms' | 'supplies' | 'notes'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // ID of newly posted note to trigger Apple spring animation
  const [recentlyAddedId, setRecentlyAddedId] = useState(null);
  const filterDropdownRef = useRef(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for local real-time events to animate incoming notes
  useEffect(() => {
    const handleLocalLog = (e) => {
      if (e.detail?.id && !animationsDisabled) {
        setRecentlyAddedId(e.detail.id);
        setTimeout(() => setRecentlyAddedId(null), 1200);
      }
    };
    window.addEventListener('sjc_log_created', handleLocalLog);
    return () => window.removeEventListener('sjc_log_created', handleLocalLog);
  }, [animationsDisabled]);

  // Sweep progress animation on mount
  const [animateProgress, setAnimateProgress] = useState(animationsDisabled);

  useEffect(() => {
    if (animationsDisabled) return;
    const timer = setTimeout(() => setAnimateProgress(true), 100);
    return () => clearTimeout(timer);
  }, [animationsDisabled]);

  // Custom delete modal state
  const [itemToDelete, setItemToDelete] = useState(null);

  const totalRooms = rooms.length;
  const cleanedRooms = rooms.filter(
    (r) => r.status === 'cleaned' || r.status === 'verified'
  ).length;
  const cleanPercentage = totalRooms > 0 ? Math.round((cleanedRooms / totalRooms) * 100) : 0;
  const roomsLeft = Math.max(0, totalRooms - cleanedRooms);

  const effectiveSupplies = supplies && supplies.length > 0 
    ? supplies 
    : (() => {
        try {
          return JSON.parse(localStorage.getItem('sjc_cached_supplies') || '[]');
        } catch {
          return [];
        }
      })();

  const lowStockCount = effectiveSupplies.filter((s) => Number(s.quantity) <= Number(s.threshold)).length;

  const displayedRequests = teacherRequests.filter((r) => 
    requestFilter === 'active' ? r.status !== 'completed' : r.status === 'completed'
  );

  const activeCount = teacherRequests.filter((r) => r.status !== 'completed').length;

  const getSanitationBadge = () => {
    if (cleanPercentage === 100 && totalRooms > 0) {
      return (
        <span className="text-emerald-700 flex items-center gap-1 font-bold">
          All Cleaned <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </span>
      );
    }
    if (cleanPercentage >= 40) {
      return (
        <span className="text-amber-600 flex items-center gap-1 font-bold">
          {roomsLeft} Left <Clock className="w-4 h-4 text-amber-500" />
        </span>
      );
    }
    return (
      <span className="text-rose-600 flex items-center gap-1 font-bold">
        {roomsLeft} Left <AlertCircle className="w-4 h-4 text-rose-500" />
      </span>
    );
  };

  const getNoteStyle = (log) => {
    const text = (log.text || '').toLowerCase();
    const author = (log.author || '').toLowerCase();
    const role = (log.role || '').toLowerCase();
    const id = String(log.id || '').toLowerCase();

    // 1. Reclean Alert (Subtle Rose)
    if (text.includes('reclean') || text.includes('flagged')) {
      return {
        cardClass: 'bg-rose-50/75 border-rose-200/90',
        squircleClass: 'bg-rose-100 text-rose-700 border-rose-200',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
        label: 'Reclean Alert',
        icon: AlertCircle,
        type: 'rooms'
      };
    }

    // 2. Room Sanitation Check (Fresh Emerald)
    if (text.includes('cleaned room') || text.includes('verified room') || text.includes('inspection')) {
      return {
        cardClass: 'bg-emerald-50/70 border-emerald-200/80',
        squircleClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
        label: 'Rooms',
        icon: CheckCircle2,
        type: 'rooms'
      };
    }

    // 3. Inventory / Stock Checkout (Teal)
    if (text.includes('checked out') || text.includes('supply') || text.includes('inventory')) {
      return {
        cardClass: 'bg-teal-50/70 border-teal-200/80',
        squircleClass: 'bg-teal-100 text-teal-800 border-teal-200',
        badgeClass: 'bg-teal-100 text-teal-800 border-teal-300 font-bold',
        label: 'Inventory',
        icon: Package,
        type: 'supplies'
      };
    }

    // 4. Teacher Request (Warm Amber)
    if (author.includes('faculty') || text.includes('teacher request') || text.includes('faculty alert')) {
      return {
        cardClass: 'bg-amber-50/75 border-amber-200/90',
        squircleClass: 'bg-amber-100 text-amber-800 border-amber-200',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        label: 'Teacher Request',
        icon: BellRing,
        type: 'notes'
      };
    }

    // 5. Admin / Supervisor Note (Persistent Sky Blue)
    const isAdminNote = 
      role === 'admin' || 
      author.includes('admin') || 
      author.includes('supervisor') ||
      id.includes('admin');

    if (isAdminNote) {
      return {
        cardClass: 'bg-sky-50/80 border-sky-300/80',
        squircleClass: 'bg-sky-100 text-sky-800 border-sky-200',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 font-bold',
        label: 'Supervisor',
        icon: Sparkles,
        type: 'notes'
      };
    }

    // 6. Default Staff Note (Neutral Slate Gray)
    return {
      cardClass: 'bg-slate-50/90 border-slate-200/80',
      squircleClass: 'bg-slate-200/70 text-slate-700 border-slate-200',
      badgeClass: 'bg-slate-200/70 text-slate-700 border-slate-300 font-semibold',
      label: 'Staff Note',
      icon: MessageSquare,
      type: 'notes'
    };
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const style = getNoteStyle(log);
      return logCategoryFilter === 'all' || style.type === logCategoryFilter;
    });
  }, [logs, logCategoryFilter]);

  const handleAcceptRequest = async (requestId) => {
    const staffName = user?.name || 'Staff';
    if (setTeacherRequests) {
      setTeacherRequests((prev) =>
        prev.map((r) => r.id === requestId ? { ...r, status: 'in_progress', assigned_to: staffName } : r)
      );
    }

    try {
      await supabase
        .from('teacher_requests')
        .update({ status: 'in_progress', assigned_to: staffName })
        .eq('id', requestId);
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const handleCompleteRequest = async (requestId) => {
    if (setTeacherRequests) {
      setTeacherRequests((prev) =>
        prev.map((r) => r.id === requestId ? { ...r, status: 'completed' } : r)
      );
    }

    try {
      await supabase
        .from('teacher_requests')
        .update({ status: 'completed' })
        .eq('id', requestId);
    } catch (err) {
      console.error('Failed to complete request:', err);
    }
  };

  const promptDeleteRequest = (req) => {
    setItemToDelete({
      type: 'request',
      id: req.id,
      title: `Delete Request from ${req.teacher_name}?`,
      subtitle: `Room ${req.room_id} &bull; ${req.category}`
    });
  };

  const promptDeleteNote = (log) => {
    const canDelete = isAdmin || (user?.name && log.author === user.name);
    if (!canDelete) return;

    setItemToDelete({
      type: 'log',
      id: log.id,
      title: 'Delete Shift Log Entry?',
      subtitle: `Posted by ${log.author} at ${log.time}`
    });
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    const targetItem = { ...itemToDelete };
    setItemToDelete(null);

    if (targetItem.type === 'request') {
      const requestId = targetItem.id;
      if (setTeacherRequests) {
        setTeacherRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
      try {
        await supabase.from('teacher_requests').delete().eq('id', requestId);
      } catch (err) {
        console.error('Failed to delete request:', err);
      }
    } else if (targetItem.type === 'log') {
      const logId = targetItem.id;
      if (setLogs) {
        setLogs((prev) => {
          const next = prev.filter((l) => l.id !== logId);
          try {
            localStorage.setItem('sjc_cached_logs', JSON.stringify(next));
          } catch (err) {
            console.warn('Storage sync error:', err);
          }
          return next;
        });
      }
      try {
        await supabase.from('logs').delete().eq('id', logId);
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    }
  };

  const handlePostShiftNote = async (e) => {
    e.preventDefault();
    const trimmedNote = shiftNoteInput.trim();
    if (!trimmedNote || isSubmittingNote) return;

    setIsSubmittingNote(true);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const authorRole = isAdmin ? 'admin' : (user?.role || 'staff');
    const authorName = user?.name || (isAdmin ? 'Facilities Supervisor' : 'Staff');
    
    const newId = `log-${authorRole === 'admin' ? 'admin-' : ''}${Date.now()}`;

    const newLogItem = {
      id: newId,
      created_at: new Date().toISOString(),
      time: now,
      author: authorName,
      text: trimmedNote,
      role: authorRole
    };

    if (!animationsDisabled) {
      setRecentlyAddedId(newId);
      setTimeout(() => setRecentlyAddedId(null), 1000);
    }

    if (setLogs) {
      setLogs((prev) => [newLogItem, ...prev.filter((l) => l.id !== newId)]);
    }

    try {
      const stored = JSON.parse(localStorage.getItem('sjc_cached_logs') || '[]');
      const updated = [newLogItem, ...stored.filter((l) => l.id !== newId)];
      localStorage.setItem('sjc_cached_logs', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('sjc_log_created', { detail: newLogItem }));
    } catch (localErr) {
      console.warn('Local storage sync notice:', localErr);
    }

    setShiftNoteInput('');

    try {
      await supabase.from('logs').insert([{
        id: newId,
        time: now,
        author: authorName,
        text: trimmedNote
      }]);
    } catch (err) {
      console.warn('Log insert notice:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const filterLabels = {
    all: 'All',
    rooms: 'Rooms',
    supplies: 'Inventory',
    notes: 'Staff Notes'
  };

  return (
    <div className={`p-4 space-y-4 pb-24 ${isPcMode ? 'max-w-5xl mx-auto' : 'max-w-md mx-auto'}`}>
      
      {/* Keyframes */}
      <style>{`
        @keyframes dashTopIn {
          0% {
            opacity: 0;
            transform: translate3d(0, -22px, 0) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes dashLeftIn {
          0% {
            opacity: 0;
            transform: translate3d(-24px, 0, 0) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes dashRightIn {
          0% {
            opacity: 0;
            transform: translate3d(24px, 0, 0) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes dashBottomIn {
          0% {
            opacity: 0;
            transform: translate3d(0, 24px, 0) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes appleNoteSmoothIn {
          0% {
            opacity: 0;
            transform: translate3d(0, 6px, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        .anim-top {
          animation: dashTopIn 0.58s cubic-bezier(0.16, 1, 0.3, 1) 0.04s both;
          will-change: transform, opacity;
        }
        .anim-left {
          animation: dashLeftIn 0.58s cubic-bezier(0.16, 1, 0.3, 1) 0.10s both;
          will-change: transform, opacity;
        }
        .anim-right {
          animation: dashRightIn 0.58s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
          will-change: transform, opacity;
        }
        .anim-left-2 {
          animation: dashLeftIn 0.62s cubic-bezier(0.16, 1, 0.3, 1) 0.16s both;
          will-change: transform, opacity;
        }
        .anim-bottom-1 {
          animation: dashBottomIn 0.62s cubic-bezier(0.16, 1, 0.3, 1) 0.20s both;
          will-change: transform, opacity;
        }
        .anim-bottom-2 {
          animation: dashBottomIn 0.66s cubic-bezier(0.16, 1, 0.3, 1) 0.26s both;
          will-change: transform, opacity;
        }

        .anim-new-post {
          animation: appleNoteSmoothIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }

        .disable-animations .anim-top,
        .disable-animations .anim-left,
        .disable-animations .anim-right,
        .disable-animations .anim-left-2,
        .disable-animations .anim-bottom-1,
        .disable-animations .anim-bottom-2,
        .disable-animations .anim-new-post {
          animation: none !important;
          transform: none !important;
          opacity: 1 !important;
        }

        .apple-notification-pill {
          transition: border-color 0.15s ease, background-color 0.15s ease;
        }
        .apple-notification-pill:hover {
          filter: brightness(0.985);
        }
      `}</style>

      <div className={isPcMode ? 'grid grid-cols-12 gap-5 items-start' : 'space-y-4'}>
        
        {/* LEFT COLUMN */}
        <div className={isPcMode ? 'col-span-7 space-y-4' : 'space-y-4'}>
          
          {/* Card 1: Overall Sanitation Status */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 space-y-3 anim-top">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  PHINMA Campus Status
                </span>
                <h2 className="text-sm font-bold text-slate-800">
                  Daily Classroom Inspection
                </h2>
              </div>
              <span className={`text-lg font-bold text-[#176e57] font-mono transition-opacity duration-300 ${
                animateProgress ? 'opacity-100' : 'opacity-40'
              }`}>
                {cleanPercentage}%
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#176e57] rounded-full"
                style={{
                  width: animateProgress ? `${cleanPercentage}%` : '0%',
                  transition: 'width 1.1s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              />
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-1 border-t border-slate-50">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <strong>{cleanedRooms}</strong> of {totalRooms} rooms checked
              </span>
              <button
                onClick={() => navigate('/rooms')}
                className="text-[#176e57] font-semibold hover:underline"
              >
                View Checklist &rarr;
              </button>
            </div>
          </div>

          {/* Card 2: Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => navigate('/rooms')}
              className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition cursor-pointer anim-left"
            >
              <div className="flex items-center justify-between mb-1">
                <Layers className="w-4 h-4 text-[#176e57]" />
                <span className="text-[10px] font-bold text-slate-400">Rooms</span>
              </div>
              <div className="text-lg font-bold text-slate-800">
                {getSanitationBadge()}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Dimasalang, Silang, Phinma</p>
            </div>

            <div
              onClick={() => navigate('/supplies')}
              className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition cursor-pointer anim-right"
            >
              <div className="flex items-center justify-between mb-1">
                <Package className="w-4 h-4 text-emerald-700" />
                <span className="text-[10px] font-bold text-slate-400">Inventory</span>
              </div>
              <div className="text-lg font-bold text-slate-800">
                {lowStockCount > 0 ? (
                  <span className="text-rose-600 flex items-center gap-1">
                    {lowStockCount} Low <AlertCircle className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="text-emerald-700">Stocked</span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{effectiveSupplies.length} items tracked</p>
            </div>
          </div>

          {/* Card 4: Campus Buildings Radial Ring Widgets */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 space-y-3 anim-left-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Campus Buildings
              </h3>

              <button
                type="button"
                onClick={() => setShowStaffModal(true)}
                title="View Active Staff"
                className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100/80 active:scale-95 text-[#176e57] rounded-xl text-xs font-semibold transition border border-emerald-200/60 shadow-2xs"
              >
                <Users className="w-3.5 h-3.5 text-[#176e57]" />
                <span className="text-[11px] font-bold">Staff</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-0.5">
              {CAMPUS_BUILDINGS.map((bldg, bIdx) => {
                const bldgRooms = rooms.filter(
                  (r) => (r.building || 'Dimasalang') === bldg.id
                );
                const cleaned = bldgRooms.filter(
                  (r) => r.status === 'cleaned' || r.status === 'verified'
                ).length;
                const total = bldgRooms.length;
                const percentage = total > 0 ? Math.round((cleaned / total) * 100) : 0;
                const isAllDone = total > 0 && cleaned === total;

                const radius = 17;
                const circumference = 2 * Math.PI * radius;
                const targetOffset = circumference - (percentage / 100) * circumference;
                const animatedOffset = animateProgress ? targetOffset : circumference;

                return (
                  <button
                    key={bldg.id}
                    onClick={() => navigate('/rooms', { state: { targetBuilding: bldg.id } })}
                    className={`py-3 px-2 rounded-2xl text-center flex flex-col items-center justify-between active:scale-95 transition-all duration-200 border group select-none ${
                      isAllDone
                        ? 'bg-emerald-50/40 border-emerald-300/80 ring-1 ring-emerald-300/40 shadow-2xs'
                        : 'bg-white border-slate-200/80 hover:border-[#176e57]/40 shadow-2xs'
                    }`}
                  >
                    <div className="relative w-12 h-12 flex items-center justify-center my-0.5">
                      <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 44 44">
                        <circle
                          cx="22"
                          cy="22"
                          r={radius}
                          fill="none"
                          stroke={isAllDone ? '#d1fae5' : '#f1f5f9'}
                          strokeWidth="3.5"
                        />
                        <circle
                          cx="22"
                          cy="22"
                          r={radius}
                          fill="none"
                          stroke={isAllDone ? '#10b981' : '#176e57'}
                          strokeWidth="3.5"
                          strokeDasharray={circumference}
                          strokeDashoffset={animatedOffset}
                          strokeLinecap="round"
                          style={{
                            transition: 'stroke-dashoffset 1.15s cubic-bezier(0.16, 1, 0.3, 1)',
                            transitionDelay: `${bIdx * 100}ms`
                          }}
                        />
                      </svg>

                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {isAllDone ? (
                          <Check 
                            className={`w-4 h-4 text-emerald-600 stroke-[3] transition-all duration-300 ${
                              animateProgress ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                            }`}
                            style={{ transitionDelay: `${bIdx * 100 + 400}ms` }}
                          />
                        ) : (
                          <span 
                            className={`text-[10px] font-extrabold font-mono transition-opacity duration-300 ${
                              percentage > 0 ? 'text-[#176e57]' : 'text-slate-400'
                            } ${animateProgress ? 'opacity-100' : 'opacity-40'}`}
                          >
                            {percentage}%
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-xs font-extrabold text-slate-800 leading-tight mt-1.5 truncate max-w-full">
                      {bldg.name}
                    </h4>

                    <p className="text-[10px] text-slate-400 font-medium font-mono mt-0.5">
                      {cleaned}/{total} checked
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className={isPcMode ? 'col-span-5 space-y-4' : 'space-y-4'}>
          
          {/* Card 3: Teacher Requests */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 space-y-3 anim-bottom-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    Teacher Requests & Calls
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {activeCount > 0 ? `${activeCount} active requests` : 'All faculty requests clear'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex bg-slate-100 p-0.5 rounded-xl text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setRequestFilter('active')}
                    className={`px-2 py-0.5 rounded-lg transition ${
                      requestFilter === 'active' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestFilter('completed')}
                    className={`px-2 py-0.5 rounded-lg transition ${
                      requestFilter === 'completed' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Done
                  </button>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowTeacherModal(true)}
                    className="flex items-center gap-0.5 px-2 py-1 bg-amber-100 hover:bg-amber-200/80 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold transition border border-amber-300 shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Log</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {displayedRequests.length > 0 ? (
                displayedRequests.map((req) => {
                  const isPending = req.status === 'pending';
                  const isDone = req.status === 'completed';

                  return (
                    <div
                      key={req.id}
                      className={`p-3 rounded-2xl border transition-all space-y-2 ${
                        isDone
                          ? 'bg-slate-50/70 border-slate-200 opacity-80'
                          : isPending
                          ? 'bg-amber-50/50 border-amber-300 animate-pop'
                          : 'bg-sky-50/50 border-sky-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">
                            Room {req.room_id}
                          </span>
                          <span className="text-[10px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                            {req.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400">
                            {req.time}
                          </span>

                          {(isAdmin || isDone) && (
                            <button
                              type="button"
                              onClick={() => promptDeleteRequest(req)}
                              title="Delete this request"
                              className="text-slate-400 hover:text-rose-600 active:scale-90 transition p-0.5 rounded-lg hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600">
                        <p className="font-medium text-slate-800">
                          From: <strong>{req.teacher_name}</strong>
                        </p>
                        {req.notes && (
                          <p className="italic text-slate-500 mt-0.5">"{req.notes}"</p>
                        )}
                      </div>

                      {!isDone && (
                        <div className="pt-1 flex items-center justify-between border-t border-slate-100">
                          <div className="text-[10px] font-medium text-slate-500">
                            {isPending ? (
                              <span className="flex items-center gap-1 text-amber-700 font-bold">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                Unassigned
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-sky-800 font-medium">
                                <UserCheck className="w-3.5 h-3.5" />
                                {req.assigned_to} attending
                              </span>
                            )}
                          </div>

                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => handleAcceptRequest(req.id)}
                              className="px-3 py-1 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold text-[11px] rounded-xl shadow-xs transition flex items-center gap-1"
                            >
                              <Flame className="w-3 h-3" />
                              <span>Accept & Go</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCompleteRequest(req.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[11px] rounded-xl shadow-xs transition flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark Resolved</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">
                  {requestFilter === 'active' 
                    ? 'No active calls. Everything running smoothly.' 
                    : 'No completed requests in record.'}
                </p>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* 📬 CARD 5: NOTES AND LOGS                                       */}
          {/* ============================================================== */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 space-y-3 anim-bottom-2">
            
            {/* Header: Title + Category Filter Dropdown */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-xl bg-emerald-50 text-[#176e57] flex items-center justify-center font-bold flex-shrink-0">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Notes and Logs
                </h3>
              </div>

              {/* Minimal Popover Filter */}
              <div className="relative" ref={filterDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border transition active:scale-95 ${
                    logCategoryFilter !== 'all'
                      ? 'bg-emerald-50 text-[#176e57] border-emerald-300'
                      : 'bg-slate-100/90 text-slate-600 border-slate-200/80 hover:bg-slate-200'
                  }`}
                  title="Filter categories"
                >
                  <Filter className="w-3 h-3 stroke-[2.2]" />
                  <span>{filterLabels[logCategoryFilter]}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showFilterDropdown && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl shadow-xl p-1.5 w-32 space-y-0.5 animate-dropdown text-xs">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'rooms', label: 'Rooms' },
                      { id: 'supplies', label: 'Inventory' },
                      { id: 'notes', label: 'Staff Notes' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setLogCategoryFilter(tab.id);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl font-bold text-[11px] flex items-center justify-between transition ${
                          logCategoryFilter === tab.id
                            ? 'bg-[#176e57] text-white shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{tab.label}</span>
                        {logCategoryFilter === tab.id && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Apple Messages Style Inline Post Bar */}
            <form onSubmit={handlePostShiftNote} className="relative flex items-center">
              <input
                type="text"
                required
                value={shiftNoteInput}
                onChange={(e) => setShiftNoteInput(e.target.value)}
                placeholder="Share an update with staff on duty..."
                className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200/90 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#176e57] focus:ring-1 focus:ring-[#176e57] transition"
              />
              <button
                type="submit"
                disabled={isSubmittingNote || !shiftNoteInput.trim()}
                title="Send note"
                className="absolute right-1.5 w-7 h-7 rounded-xl bg-[#176e57] hover:bg-[#135c49] active:scale-90 text-white flex items-center justify-center transition shadow-2xs disabled:opacity-40"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.6]" />
              </button>
            </form>

            {/* Notification List Container */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredLogs && filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const style = getNoteStyle(log);
                  const IconComponent = style.icon;
                  const canDeleteNote = isAdmin || (user?.name && log.author === user.name);
                  const relativeTime = getRelativeTime(log.created_at, log.time);
                  const isJustAdded = recentlyAddedId === log.id;

                  return (
                    <div
                      key={log.id}
                      className={`p-3 rounded-2xl border text-xs space-y-1.5 apple-notification-pill select-none relative group transition-colors ${style.cardClass} ${
                        isJustAdded ? 'anim-new-post' : ''
                      }`}
                    >
                      {/* Top Header: Colored Squircle Icon + Author + Relative Time */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-2xs ${style.squircleClass}`}>
                            <IconComponent className="w-3.5 h-3.5 stroke-[2.4]" />
                          </div>
                          <span className="font-extrabold text-[11px] text-slate-900 truncate">
                            {log.author}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md border flex-shrink-0 ${style.badgeClass}`}>
                            {style.label}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] text-slate-400 font-mono font-medium">
                            {relativeTime}
                          </span>

                          {canDeleteNote && (
                            <button
                              type="button"
                              onClick={() => promptDeleteNote(log)}
                              title="Delete note"
                              className="text-slate-400 hover:text-rose-600 active:scale-90 transition p-1 hover:bg-white/80 rounded-lg"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Content Body */}
                      <p className="text-[11px] text-slate-800 pl-8 leading-relaxed font-normal">
                        {log.text}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 space-y-1">
                  <p className="text-xs text-slate-400 font-medium">
                    {logCategoryFilter === 'all' 
                      ? 'No activity recorded yet today.' 
                      : `No updates found for "${filterLabels[logCategoryFilter]}".`}
                  </p>
                  <p className="text-[10px] text-slate-300">
                    Cleanings, draws, and shift notes will stream in automatically.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Staff Presence Modal */}
      <StaffPresenceModal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        onlineUsers={onlineUsers}
        assignments={assignments}
        currentUser={user}
      />

      {/* Teacher Request Modal */}
      <TeacherRequestModal
        isOpen={showTeacherModal}
        onClose={() => setShowTeacherModal(false)}
      />

      {/* Seamless In-App Delete Confirmation Modal */}
      {itemToDelete && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 animate-fade-backdrop text-slate-800 select-none"
          onClick={() => setItemToDelete(null)}
        >
          <div 
            className="bg-white w-full max-w-xs rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3.5 animate-sheet-up text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center animate-pop">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-snug">
                {itemToDelete.title}
              </h3>
              {itemToDelete.subtitle && (
                <p 
                  className="text-xs text-slate-500 mt-1"
                  dangerouslySetInnerHTML={{ __html: itemToDelete.subtitle }}
                />
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              This action cannot be undone and will permanently remove this record.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}