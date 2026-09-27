import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { supabase } from '../data/supabaseClient';
import BlastACModal from '../components/BlastACModal';
import { 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RotateCcw, 
  Power, 
  Lightbulb, 
  Lock, 
  Users, 
  X, 
  Check, 
  Sparkles, 
  ShieldAlert, 
  Wind, 
  Snowflake,
  Search
} from 'lucide-react';

export default function Rooms({ rooms = [], setRooms, user, assignments = {} }) {
  const location = useLocation();
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalRoom, setActiveModalRoom] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showBlastModal, setShowBlastModal] = useState(false);

  // Form states for the room modal
  const [statusVal, setStatusVal] = useState('pending');
  const [recleanReasonVal, setRecleanReasonVal] = useState('');
  const [acVal, setAcVal] = useState(true);
  const [lightsVal, setLightsVal] = useState(true);
  const [doorVal, setDoorVal] = useState(true);
  const [hasStudentsVal, setHasStudentsVal] = useState(false);
  const [notesVal, setNotesVal] = useState('');

  // Fixed: removed "rooms" dependency so edits won't reset floor to Floor 2
  useEffect(() => {
    if (location.state?.targetFloor) {
      setSelectedFloor(Number(location.state.targetFloor));
    }
    if (location.state?.targetRoomId) {
      const found = rooms.find((r) => String(r.id) === String(location.state.targetRoomId));
      if (found) {
        handleOpenRoomModal(found);
      }
    }

    // Clean browser history state so background sync won't re-trigger
    if (location.state?.targetFloor || location.state?.targetRoomId) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleOpenRoomModal = (room) => {
    setActiveModalRoom(room);
    setStatusVal(room.status || 'pending');
    setRecleanReasonVal(room.recleanReason || '');
    setAcVal(room.acChecked ?? true);
    setLightsVal(room.lightsChecked ?? true);
    setDoorVal(room.doorChecked ?? true);
    setHasStudentsVal(room.hasStudents ?? false);
    setNotesVal(room.notes || '');
  };

  const handleCloseRoomModal = () => {
    setActiveModalRoom(null);
  };

  const handleSaveInspection = async () => {
    if (!activeModalRoom) return;
    setIsSaving(true);

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const staffName = user?.name || activeModalRoom.staff || 'Staff';

    const updatedData = {
      status: statusVal,
      staff: staffName,
      last_cleaned: nowTime,
      reclean_reason: statusVal === 'needs_reclean' ? recleanReasonVal : null,
      ac_checked: acVal,
      lights_checked: lightsVal,
      door_checked: doorVal,
      has_students: hasStudentsVal,
      notes: notesVal
    };

    if (setRooms) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeModalRoom.id
            ? {
                ...r,
                status: statusVal,
                staff: staffName,
                lastCleaned: nowTime,
                recleanReason: statusVal === 'needs_reclean' ? recleanReasonVal : null,
                acChecked: acVal,
                lightsChecked: lightsVal,
                doorChecked: doorVal,
                hasStudents: hasStudentsVal,
                notes: notesVal
              }
            : r
        )
      );
    }

    try {
      await supabase.from('rooms').update(updatedData).eq('id', activeModalRoom.id);
      setToastMessage(`Room ${activeModalRoom.id} inspection recorded!`);
      setTimeout(() => setToastMessage(''), 3000);
      handleCloseRoomModal();
    } catch (err) {
      console.error('Failed to update room status:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Easter egg execution: Turns every classroom AC in the whole building ON (acChecked: false)
  const handleBlastAllACs = async () => {
    if (setRooms) {
      setRooms((prev) =>
        prev.map((r) => ({
          ...r,
          acChecked: false
        }))
      );
    }

    try {
      const allRoomIds = rooms.map((r) => r.id);
      if (allRoomIds.length > 0) {
        await supabase
          .from('rooms')
          .update({ ac_checked: false })
          .in('id', allRoomIds);
      }
      setToastMessage('🚨 Central climate bypass active: All 35 ACs turned ON!');
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      console.error('Failed building-wide AC blast:', err);
    }
  };

  // Filter classrooms by selected floor & search query
  const floorRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesFloor = searchQuery.trim() !== '' ? true : r.floor === selectedFloor;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(r.id).toLowerCase().includes(q) ||
        (r.staff && r.staff.toLowerCase().includes(q)) ||
        (r.status && r.status.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q));

      return matchesFloor && matchesSearch;
    });
  }, [rooms, selectedFloor, searchQuery]);

  const floorStatsRooms = rooms.filter((r) => r.floor === selectedFloor);
  const floorCleaned = floorStatsRooms.filter((r) => r.status === 'cleaned' || r.status === 'verified').length;

  return (
    <div className="p-4 space-y-3.5 pb-28 text-slate-800">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-pop shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Quick Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-tight">
            Dimasalang Inspection
          </h2>
          <p className="text-[11px] text-slate-400">
            35 Classrooms across 7 Floors
          </p>
        </div>

        {/* Opens the Blast AC Gag Modal directly */}
        <button
          type="button"
          onClick={() => setShowBlastModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 active:scale-95 text-cyan-800 rounded-xl text-xs font-bold transition border border-cyan-200/80 shadow-xs"
          title="Campus Remote AC Override"
        >
          <Snowflake className="w-3.5 h-3.5 text-cyan-600" />
          <span>Blast AC</span>
        </button>
      </div>

      {/* Supplies-Style Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search classroom, staff, status..."
          className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#176e57] focus:ring-1 focus:ring-[#176e57] transition shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Flat-Sided / Squircle Filter Row (rounded-xl matching Supplies categories) */}
      {!searchQuery && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {[1, 2, 3, 4, 5, 6, 7].map((f) => {
            const isActive = selectedFloor === f;
            return (
              <button
                key={f}
                onClick={() => setSelectedFloor(f)}
                className={`px-3.5 py-1.5 rounded-xl font-semibold text-xs transition active:scale-95 border ${
                  isActive
                    ? 'bg-[#176e57] text-white border-[#176e57] shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 border-slate-200/60 hover:bg-slate-200/70'
                }`}
              >
                Floor {f}
              </button>
            );
          })}
        </div>
      )}

      {/* Floor Overview Card */}
      {!searchQuery ? (
        <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#176e57] flex items-center justify-center font-bold">
              F{selectedFloor}
            </div>
            <div>
              <h3 className="font-bold text-slate-800">
                Floor {selectedFloor} Progress
              </h3>
              <p className="text-[10px] text-slate-400">
                Assigned Staff: <strong>{assignments[selectedFloor] || 'General Crew'}</strong>
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-xl">
            {floorCleaned} / 5 Done
          </span>
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 px-1 font-medium">
          Found {floorRooms.length} classroom{floorRooms.length === 1 ? '' : 's'} matching "{searchQuery}"
        </div>
      )}

      {/* Classrooms List */}
      <div className="space-y-2.5">
        {floorRooms.length > 0 ? (
          floorRooms.map((room) => {
            const isDone = room.status === 'cleaned' || room.status === 'verified';
            const isReclean = room.status === 'needs_reclean';

            return (
              <div
                key={room.id}
                onClick={() => handleOpenRoomModal(room)}
                className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-slate-300 transition active:scale-[0.99] cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      Room {room.id}
                    </span>

                    {searchQuery && (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        Floor {room.floor}
                      </span>
                    )}
                    
                    {room.hasStudents && (
                      <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" />
                        <span>Class Active</span>
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border ${
                      room.status === 'verified'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : room.status === 'cleaned'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isReclean
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {room.status ? room.status.replace('_', ' ') : 'Pending'}
                  </span>
                </div>

                {/* Status Checklist Badges */}
                <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-50">
                  <span className={`flex items-center gap-1 ${room.acChecked ? 'text-emerald-700' : 'text-amber-600 font-medium'}`}>
                    <Power className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{room.acChecked ? 'AC Off' : 'AC On'}</span>
                  </span>

                  <span className={`flex items-center gap-1 ${room.lightsChecked ? 'text-emerald-700' : 'text-amber-600 font-medium'}`}>
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{room.lightsChecked ? 'Lights Off' : 'Lights On'}</span>
                  </span>

                  <span className={`flex items-center gap-1 ${room.doorChecked ? 'text-emerald-700' : 'text-slate-400'}`}>
                    <Lock className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{room.doorChecked ? 'Locked' : 'Unlocked'}</span>
                  </span>

                  <span className="ml-auto text-[10px] font-mono text-slate-400">
                    {room.lastCleaned || '--:--'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">No classrooms found</p>
            <p className="text-[10px] text-slate-400">Try searching for another room number or name</p>
          </div>
        )}
      </div>

      {/* Mobile-fitted Room Inspection Modal */}
      {activeModalRoom && createPortal(
        <div 
          className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 select-none"
          onClick={handleCloseRoomModal}
        >
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] sm:max-h-[88vh] animate-sheet-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3.5 px-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Floor {activeModalRoom.floor} Checklist
                </span>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  Inspect Room {activeModalRoom.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseRoomModal}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-3.5 px-4 overflow-y-auto space-y-3 text-xs flex-1">
              
              {/* 1. Students Occupancy Switch */}
              <div 
                onClick={() => setHasStudentsVal(!hasStudentsVal)}
                className={`p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer active:scale-[0.99] transition ${
                  hasStudentsVal ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200/70'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-xl ${hasStudentsVal ? 'bg-amber-100 text-amber-800' : 'bg-white text-slate-400 border border-slate-200'}`}>
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold block text-slate-800">
                      Students Inside / Class in Session
                    </span>
                    <span className="text-[9px] text-slate-400 block">
                      Flags room as occupied to avoid disturbance
                    </span>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition ${
                  hasStudentsVal ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {hasStudentsVal && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              {/* 2. Cleanliness Status Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Sanitation & Cleanliness:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'pending', label: 'Pending', color: 'bg-slate-400' },
                    { id: 'cleaned', label: 'Cleaned', color: 'bg-emerald-600' },
                    { id: 'needs_reclean', label: 'Needs Reclean', color: 'bg-rose-600' },
                    { id: 'verified', label: 'Verified', color: 'bg-blue-600' }
                  ].map((s) => {
                    const isSelected = statusVal === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStatusVal(s.id)}
                        className={`p-2 rounded-xl text-left font-bold text-xs transition border flex items-center gap-2 ${
                          isSelected
                            ? 'bg-[#176e57] text-white border-[#176e57] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : s.color}`} />
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reclean Reason */}
              {statusVal === 'needs_reclean' && (
                <div className="space-y-1 animate-pop">
                  <label className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                    Reason for Reclean:
                  </label>
                  <input
                    type="text"
                    required
                    value={recleanReasonVal}
                    onChange={(e) => setRecleanReasonVal(e.target.value)}
                    placeholder="e.g. Muddy footprints, trash unemptied, spilled ink"
                    className="w-full p-2 text-xs border border-rose-300 rounded-xl bg-rose-50/50 text-rose-900 focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              {/* 3. Safety & Energy Checklist */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Safety & Energy Checks:
                </label>
                <div className="space-y-1.5">
                  {[
                    { state: acVal, setter: setAcVal, icon: Power, label: 'Air Conditioning Switched OFF' },
                    { state: lightsVal, setter: setLightsVal, icon: Lightbulb, label: 'Classroom Lights Switched OFF' },
                    { state: doorVal, setter: setDoorVal, icon: Lock, label: 'Door Securely Locked' }
                  ].map((chk, idx) => {
                    return (
                      <div
                        key={idx}
                        onClick={() => chk.setter(!chk.state)}
                        className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer active:scale-[0.99] transition ${
                          chk.state ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <chk.icon className={`w-3.5 h-3.5 ${chk.state ? 'text-[#176e57]' : 'text-slate-400'}`} />
                          <span className={`text-[11px] font-semibold ${chk.state ? 'text-slate-800' : 'text-slate-500'}`}>
                            {chk.label}
                          </span>
                        </div>

                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${
                          chk.state ? 'bg-[#176e57] border-[#176e57] text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {chk.state && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Notes & Incident Input */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Room Notes & Incident Reports:
                </label>
                <textarea
                  rows={2}
                  value={notesVal}
                  onChange={(e) => setNotesVal(e.target.value)}
                  placeholder="Note physical damage, broken desks, or spills..."
                  className="w-full p-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#176e57] bg-slate-50 text-slate-800 resize-none"
                />
              </div>

            </div>

            {/* Pinned Bottom Actions Bar */}
            <div className="p-3 px-4 bg-white border-t border-slate-100 flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleCloseRoomModal}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInspection}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving Room...' : 'Save Inspection'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Blast AC Gag & Paywall Modal */}
      <BlastACModal
        isOpen={showBlastModal}
        onClose={() => setShowBlastModal(false)}
      />

    </div>
  );
}