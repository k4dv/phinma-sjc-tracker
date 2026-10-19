import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../data/supabaseClient';
import StaffPresenceModal from '../components/StaffPresenceModal';
import TeacherRequestModal from '../components/TeacherRequestModal';
import { 
  Send, 
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
  Plus
} from 'lucide-react';

const CAMPUS_BUILDINGS = [
  { id: 'Dimasalang', name: 'Dimasalang' },
  { id: 'Silang', name: 'Silang' },
  { id: 'Phinma', name: 'Phinma' }
];

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

  const [shiftNoteInput, setShiftNoteInput] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [requestFilter, setRequestFilter] = useState('active');

  // Custom in-app delete modal state
  const [itemToDelete, setItemToDelete] = useState(null);

  const totalRooms = rooms.length;
  const cleanedRooms = rooms.filter(
    (r) => r.status === 'cleaned' || r.status === 'verified'
  ).length;
  const cleanPercentage = totalRooms > 0 ? Math.round((cleanedRooms / totalRooms) * 100) : 0;
  const roomsLeft = Math.max(0, totalRooms - cleanedRooms);
  const lowStockCount = supplies.filter((s) => s.quantity <= s.threshold).length;

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

    if (author.includes('faculty') || text.includes('teacher request') || text.includes('faculty alert')) {
      return {
        cardClass: 'bg-amber-50/70 border-amber-200',
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        label: 'Teacher Request',
        authorClass: 'text-amber-950 font-bold',
        textClass: 'text-amber-900'
      };
    }

    if (role === 'admin' || author.includes('admin') || author.includes('supervisor')) {
      return {
        cardClass: 'bg-sky-50/70 border-sky-200',
        dotClass: 'bg-sky-500',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
        label: 'Admin',
        authorClass: 'text-sky-950 font-bold',
        textClass: 'text-sky-900'
      };
    }

    return {
      cardClass: 'bg-slate-50 border-slate-100',
      dotClass: 'bg-[#176e57]',
      badgeClass: 'bg-slate-200/70 text-slate-700 border-slate-200',
      label: 'Staff',
      authorClass: 'text-slate-800 font-bold',
      textClass: 'text-slate-600'
    };
  };

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

    if (itemToDelete.type === 'request') {
      const requestId = itemToDelete.id;
      if (setTeacherRequests) {
        setTeacherRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
      try {
        await supabase.from('teacher_requests').delete().eq('id', requestId);
      } catch (err) {
        console.error('Failed to delete request:', err);
      }
    } else if (itemToDelete.type === 'log') {
      const logId = itemToDelete.id;
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

    setItemToDelete(null);
  };

  const handlePostShiftNote = async (e) => {
    e.preventDefault();
    const trimmedNote = shiftNoteInput.trim();
    if (!trimmedNote || isSubmittingNote) return;

    setIsSubmittingNote(true);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const authorRole = isAdmin ? 'admin' : (user?.role || 'staff');
    const authorName = user?.name || (isAdmin ? 'Facilities Supervisor' : 'Staff');

    const newLogItem = {
      id: `log-${Date.now()}`,
      created_at: new Date().toISOString(),
      time: now,
      author: authorName,
      text: trimmedNote,
      role: authorRole
    };

    if (setLogs) {
      setLogs((prev) => [newLogItem, ...prev]);
    }

    try {
      const stored = JSON.parse(localStorage.getItem('sjc_cached_logs') || '[]');
      const updated = [newLogItem, ...stored.filter((l) => l.id !== newLogItem.id)];
      localStorage.setItem('sjc_cached_logs', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('sjc_log_created', { detail: newLogItem }));
    } catch (localErr) {
      console.warn('Local storage sync notice:', localErr);
    }

    setShiftNoteInput('');

    try {
      const { error } = await supabase.from('logs').insert([newLogItem]);
      if (error) {
        console.warn('Database note insert notice, local sync preserved:', error.message);
      }
    } catch (err) {
      console.error('Failed to post shift note to database:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  return (
    <div className={`p-4 space-y-4 pb-24 ${isPcMode ? 'max-w-5xl mx-auto' : 'max-w-md mx-auto'}`}>
      
      <style>{`
        @keyframes dashTopIn {
          0% {
            opacity: 0;
            transform: translate3d(0, -22px, 0) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes dashLeftIn {
          0% {
            opacity: 0;
            transform: translate3d(-24px, 0, 0) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes dashRightIn {
          0% {
            opacity: 0;
            transform: translate3d(24px, 0, 0) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes dashBottomIn {
          0% {
            opacity: 0;
            transform: translate3d(0, 24px, 0) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
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

        .disable-animations .anim-top,
        .disable-animations .anim-left,
        .disable-animations .anim-right,
        .disable-animations .anim-left-2,
        .disable-animations .anim-bottom-1,
        .disable-animations .anim-bottom-2 {
          animation: none !important;
          transform: none !important;
          opacity: 1 !important;
        }
      `}</style>

      <div className={isPcMode ? 'grid grid-cols-12 gap-5 items-start' : 'space-y-4'}>
        
        {/* LEFT COLUMN (In PC Mode) / STACK TOP (In Mobile Mode) */}
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
              <span className="text-lg font-bold text-[#176e57]">
                {cleanPercentage}%
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#176e57] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${cleanPercentage}%` }}
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
              <p className="text-[10px] text-slate-500 mt-0.5">{supplies.length} items tracked</p>
            </div>
          </div>

          {/* Card 4: Campus Buildings Radial Progress Ring Widgets */}
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

            {/* 3 Circular Ring Progression Cards */}
            <div className="grid grid-cols-3 gap-2.5 pt-0.5">
              {CAMPUS_BUILDINGS.map((bldg) => {
                const bldgRooms = rooms.filter(
                  (r) => (r.building || 'Dimasalang') === bldg.id
                );
                const cleaned = bldgRooms.filter(
                  (r) => r.status === 'cleaned' || r.status === 'verified'
                ).length;
                const total = bldgRooms.length;
                const percentage = total > 0 ? Math.round((cleaned / total) * 100) : 0;
                const isAllDone = total > 0 && cleaned === total;

                // SVG Circular Progress Ring calculations (Radius 17 = ~106.8 perimeter)
                const radius = 17;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference - (percentage / 100) * circumference;

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
                    {/* Top: SVG Radial Progression Gauge */}
                    <div className="relative w-12 h-12 flex items-center justify-center my-0.5">
                      <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 44 44">
                        {/* Background Ring Track (Shows what is left to finish) */}
                        <circle
                          cx="22"
                          cy="22"
                          r={radius}
                          fill="none"
                          stroke={isAllDone ? '#d1fae5' : '#f1f5f9'}
                          strokeWidth="3.5"
                        />
                        {/* Active Progress Arc */}
                        <circle
                          cx="22"
                          cy="22"
                          r={radius}
                          fill="none"
                          stroke={isAllDone ? '#10b981' : '#176e57'}
                          strokeWidth="3.5"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>

                      {/* Inside Ring Indicator */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {isAllDone ? (
                          <Check className="w-4 h-4 text-emerald-600 stroke-[3] animate-pop" />
                        ) : (
                          <span className={`text-[10px] font-extrabold font-mono ${
                            percentage > 0 ? 'text-[#176e57]' : 'text-slate-400'
                          }`}>
                            {percentage}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Building Name */}
                    <h4 className="text-xs font-extrabold text-slate-800 leading-tight mt-1.5 truncate max-w-full">
                      {bldg.name}
                    </h4>

                    {/* Bottom: Room Ratio Footnote */}
                    <p className="text-[10px] text-slate-400 font-medium font-mono mt-0.5">
                      {cleaned}/{total} checked
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (In PC Mode) / STACK BOTTOM (In Mobile Mode) */}
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

          {/* Card 5: Notes and Logs */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 space-y-3 anim-bottom-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#176e57]" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Notes and Logs
                </h3>
              </div>
            </div>

            <form onSubmit={handlePostShiftNote} className="flex gap-2">
              <input
                type="text"
                required
                value={shiftNoteInput}
                onChange={(e) => setShiftNoteInput(e.target.value)}
                placeholder="Write shift note or incident report..."
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#176e57] focus:ring-1 focus:ring-[#176e57] bg-slate-50 transition"
              />
              <button
                type="submit"
                disabled={isSubmittingNote || !shiftNoteInput.trim()}
                className="bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            </form>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {logs && logs.length > 0 ? (
                logs.map((log) => {
                  const style = getNoteStyle(log);
                  const canDeleteNote = isAdmin || (user?.name && log.author === user.name);

                  return (
                    <div
                      key={log.id}
                      className={`p-2.5 rounded-xl border text-xs space-y-1 animate-pop relative group transition-colors ${style.cardClass}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-[11px] flex items-center gap-1.5 ${style.authorClass}`}>
                          <span className={`w-2 h-2 rounded-full ${style.dotClass}`} />
                          <span>{log.author}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${style.badgeClass}`}>
                            {style.label}
                          </span>
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {log.time}
                          </span>

                          {canDeleteNote && (
                            <button
                              type="button"
                              onClick={() => promptDeleteNote(log)}
                              title="Delete note permanently"
                              className="text-slate-400 hover:text-rose-600 active:scale-90 transition p-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className={`text-[11px] pl-3.5 leading-relaxed ${style.textClass}`}>
                        {log.text}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 text-center py-3">
                  No shift notes yet today.
                </p>
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

      {/* Custom In-App Delete Confirmation Modal */}
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