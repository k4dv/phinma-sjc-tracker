import React, { useState } from 'react';
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
  MessageSquare, 
  Trash2, 
  Users, 
  BellRing, 
  Check, 
  UserCheck, 
  Flame,
  Plus
} from 'lucide-react';

export default function Dashboard({
  rooms = [],
  supplies = [],
  logs = [],
  setLogs,
  user,
  assignments = {},
  onlineUsers = [],
  teacherRequests = [],
  setTeacherRequests
}) {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [shiftNoteInput, setShiftNoteInput] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [requestFilter, setRequestFilter] = useState('active');

  // Only animate the waterfall once per login session
  const [isFirstEntry] = useState(() => {
    const animated = sessionStorage.getItem('sjc_dash_animated');
    const animationsDisabled = localStorage.getItem('sjc_animations_disabled') === 'true';
    if (!animated && !animationsDisabled) {
      sessionStorage.setItem('sjc_dash_animated', 'true');
      return true;
    }
    return false;
  });

  const totalRooms = rooms.length;
  const cleanedRooms = rooms.filter(
    (r) => r.status === 'cleaned' || r.status === 'verified'
  ).length;
  const cleanPercentage = totalRooms > 0 ? Math.round((cleanedRooms / totalRooms) * 100) : 0;
  const lowStockCount = supplies.filter((s) => s.quantity <= s.threshold).length;

  const displayedRequests = teacherRequests.filter((r) => 
    requestFilter === 'active' ? r.status !== 'completed' : r.status === 'completed'
  );

  const activeCount = teacherRequests.filter((r) => r.status !== 'completed').length;

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

  const handleDeleteRequest = async (requestId, teacherName) => {
    if (!window.confirm(`Delete request from ${teacherName}?`)) return;

    if (setTeacherRequests) {
      setTeacherRequests((prev) => prev.filter((r) => r.id !== requestId));
    }

    try {
      await supabase.from('teacher_requests').delete().eq('id', requestId);
    } catch (err) {
      console.error('Failed to delete request:', err);
    }
  };

  const handlePostShiftNote = async (e) => {
    e.preventDefault();
    if (!shiftNoteInput.trim() || isSubmittingNote) return;

    setIsSubmittingNote(true);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newLogItem = {
      id: `log-${Date.now()}`,
      time: now,
      author: user?.name || 'Staff',
      text: shiftNoteInput.trim()
    };

    try {
      await supabase.from('logs').insert([newLogItem]);
      setShiftNoteInput('');
    } catch (err) {
      console.error('Failed to post shift note:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (logId) => {
    if (!isAdmin) return;
    if (setLogs) setLogs((prev) => prev.filter((l) => l.id !== logId));
    try {
      await supabase.from('logs').delete().eq('id', logId);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      
      {/* 1. OVERALL SANITATION PROGRESS (CARD 1) */}
      <div className={`bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 space-y-3 ${isFirstEntry ? 'animate-cascade-1' : ''}`}>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              Dimasalang Hall Status
            </span>
            <h2 className="text-sm font-bold text-slate-800">
              Campus Daily Sanitation
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

      {/* 2. QUICK STAT CARDS (CARD 2) */}
      <div className={`grid grid-cols-2 gap-3 ${isFirstEntry ? 'animate-cascade-2' : ''}`}>
        <div
          onClick={() => navigate('/rooms')}
          className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1">
            <Layers className="w-4 h-4 text-[#176e57]" />
            <span className="text-[10px] font-bold text-slate-400">7 Floors</span>
          </div>
          <div className="text-lg font-bold text-slate-800">35 Rooms</div>
          <p className="text-[10px] text-slate-500 mt-0.5">5 Rooms per floor</p>
        </div>

        <div
          onClick={() => navigate('/supplies')}
          className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition cursor-pointer"
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
          <p className="text-[10px] text-slate-500 mt-0.5">Central storage F1</p>
        </div>
      </div>

      {/* 3. TEACHER ASSISTANCE LIVE DISPATCH QUEUE (CARD 3) */}
      <div className={`bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 space-y-3 ${isFirstEntry ? 'animate-cascade-3' : ''}`}>
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
                          onClick={() => handleDeleteRequest(req.id, req.teacher_name)}
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
                          <Check className="w-3 h-3" />
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

      {/* 4. FLOOR SNAPSHOT & STAFF PRESENCE (CARD 4) */}
      <div className={`bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 space-y-2.5 ${isFirstEntry ? 'animate-cascade-4' : ''}`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" /> Floor Assignments
          </h3>

          <button
            type="button"
            onClick={() => setShowStaffModal(true)}
            title="View Active Staff"
            className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 hover:bg-emerald-100/80 active:scale-95 text-[#176e57] rounded-xl text-xs font-semibold transition border border-emerald-200/60 shadow-xs"
          >
            <Users className="w-3.5 h-3.5 text-[#176e57]" />
            <span className="text-[10px]">Staff</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 pt-1">
          {[1, 2, 3, 4, 5, 6, 7].map((floorNum) => {
            const floorRooms = rooms.filter((r) => r.floor === floorNum);
            const done = floorRooms.filter(
              (r) => r.status === 'cleaned' || r.status === 'verified'
            ).length;
            const isAllDone = done === 5;

            return (
              <button
                key={floorNum}
                onClick={() => navigate('/rooms', { state: { targetFloor: floorNum } })}
                className={`py-2 rounded-xl text-center flex flex-col items-center justify-center active:scale-90 transition-all duration-150 border ${
                  isAllDone
                    ? 'bg-emerald-50 text-[#176e57] border-emerald-300 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] block font-bold">F{floorNum}</span>
                <span className="text-[9px] font-mono mt-0.5">{done}/5</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. SHIFT HANDOVER FEED & LOGS (CARD 5) */}
      <div className={`bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 space-y-3 ${isFirstEntry ? 'animate-cascade-5' : ''}`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-[#176e57]" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Shift Handover Notes & Log
            </h3>
          </div>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
            Live Feed
          </span>
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
            <Send className="w-3 h-3" />
            <span>Post</span>
          </button>
        </form>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {logs && logs.length > 0 ? (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1 animate-pop relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#176e57]" />
                    {log.author}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {log.time}
                    </span>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(log.id)}
                        title="Delete note permanently"
                        className="text-slate-400 hover:text-rose-600 active:scale-90 transition p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-slate-600 text-[11px] pl-3 leading-relaxed">
                  {log.text}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 text-center py-3">
              No shift notes yet today.
            </p>
          )}
        </div>
      </div>

      <StaffPresenceModal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        onlineUsers={onlineUsers}
        assignments={assignments}
        currentUser={user}
      />

      <TeacherRequestModal
        isOpen={showTeacherModal}
        onClose={() => setShowTeacherModal(false)}
      />

    </div>
  );
}