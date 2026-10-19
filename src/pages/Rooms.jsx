import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { supabase } from '../data/supabaseClient';
import { api } from '../services/api';
import BlastACModal from '../components/BlastACModal';
import { 
  Building2, 
  CheckCircle2, 
  Power, 
  Lightbulb, 
  Lock, 
  Users, 
  X, 
  Check, 
  Snowflake, 
  Search, 
  ChevronDown,
  Clock
} from 'lucide-react';

/* ========================================================================== */
/* 🎨 ORIGINAL ROOM CARD PASTEL COLORS                                        */
/* ========================================================================== */
const ROOM_CARD_THEMES = {
  needsReclean: {
    card: 'bg-rose-50/70 border-rose-200/90 hover:border-rose-300 shadow-xs',
    pill: 'bg-rose-100 text-rose-800 border-rose-300'
  },
  verified: {
    card: 'bg-blue-50/35 border-blue-200/80 hover:border-blue-300 shadow-2xs',
    pill: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  cleaned: {
    card: 'bg-emerald-50/35 border-emerald-200/80 hover:border-emerald-300 shadow-2xs',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  pending: {
    card: 'bg-white border-slate-100 hover:border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)]',
    pill: 'bg-slate-100 text-slate-600 border-slate-200'
  }
};
/* ========================================================================== */

const BUILDINGS = [
  { id: 'Dimasalang', name: 'Dimasalang Building' },
  { id: 'Silang', name: 'Silang Building' },
  { id: 'Phinma', name: 'Phinma Building' }
];

export default function Rooms({ rooms = [], setRooms, user, assignments = {}, isDesktopView = false }) {
  const location = useLocation();
  const [selectedBuilding, setSelectedBuilding] = useState('Dimasalang');
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalRoom, setActiveModalRoom] = useState(null);
  const [isBuildingDropdownOpen, setIsBuildingDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showBlastModal, setShowBlastModal] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isPcMode = isAdmin && isDesktopView;
  const animationsDisabled = localStorage.getItem('sjc_animations_disabled') === 'true';

  const [statusVal, setStatusVal] = useState('pending');
  const [recleanReasonVal, setRecleanReasonVal] = useState('');
  const [acVal, setAcVal] = useState(true);
  const [lightsVal, setLightsVal] = useState(true);
  const [doorVal, setDoorVal] = useState(true);
  const [hasStudentsVal, setHasStudentsVal] = useState(false);
  const [notesVal, setNotesVal] = useState('');

  useEffect(() => {
    if (location.state?.targetBuilding) {
      setSelectedBuilding(location.state.targetBuilding);
    }
    if (location.state?.targetFloor) {
      setSelectedFloor(Number(location.state.targetFloor));
    }
    if (location.state?.targetRoomId) {
      const found = rooms.find((r) => String(r.id) === String(location.state.targetRoomId));
      if (found) {
        if (found.building) setSelectedBuilding(found.building);
        handleOpenRoomModal(found);
      }
    }

    if (location.state?.targetFloor || location.state?.targetRoomId || location.state?.targetBuilding) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state, rooms]);

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
          r.id === activeModalRoom.id && (r.building || 'Dimasalang') === (activeModalRoom.building || 'Dimasalang')
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
      await api.updateRoom(activeModalRoom.id, updatedData);
      setToastMessage(`Room ${activeModalRoom.id} updated!`);
      setTimeout(() => setToastMessage(''), 3500);
      handleCloseRoomModal();
    } catch {
      try {
        await supabase
          .from('rooms')
          .update(updatedData)
          .match({ id: activeModalRoom.id, building: activeModalRoom.building || 'Dimasalang' });
        setToastMessage(`Room ${activeModalRoom.id} updated!`);
        setTimeout(() => setToastMessage(''), 3500);
        handleCloseRoomModal();
      } catch (fallbackErr) {
        console.error('All update paths failed:', fallbackErr);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getAssignedStaffName = (bldg, flr) => {
    const compositeKey = `${bldg}_${flr}`;
    const assigned = assignments[compositeKey] || (bldg === 'Dimasalang' ? assignments[flr] : null);

    if (!assigned || (Array.isArray(assigned) && assigned.length === 0)) {
      return 'General Crew';
    }
    if (Array.isArray(assigned)) {
      return assigned.join(', ');
    }
    return assigned.name || assigned;
  };

  const activeBuildingRooms = useMemo(() => {
    const matched = rooms.filter((r) => (r.building || 'Dimasalang') === selectedBuilding);
    if (matched.length > 0) return matched;

    const offset = selectedBuilding === 'Silang' ? 40 : selectedBuilding === 'Phinma' ? 20 : 0;
    const generated = [];
    for (let f = 1; f <= 7; f++) {
      for (let rm = 1; rm <= 5; rm++) {
        generated.push({
          id: String(f * 100 + offset + rm),
          floor: f,
          building: selectedBuilding,
          status: 'pending',
          staff: 'Unassigned',
          acChecked: true,
          lightsChecked: true,
          doorChecked: true,
          hasStudents: false
        });
      }
    }
    return generated;
  }, [rooms, selectedBuilding]);

  const floorRooms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (q) {
      return rooms.filter((r) => {
        const roomBldg = r.building || 'Dimasalang';
        const cleanId = String(r.id).replace(/^[A-Za-z]/, '');
        return (
          cleanId.toLowerCase().includes(q) ||
          String(r.id).toLowerCase().includes(q) ||
          (r.staff && r.staff.toLowerCase().includes(q)) ||
          (r.status && r.status.toLowerCase().includes(q)) ||
          (r.notes && r.notes.toLowerCase().includes(q)) ||
          roomBldg.toLowerCase().includes(q)
        );
      });
    }

    return activeBuildingRooms.filter((r) => Number(r.floor) === Number(selectedFloor));
  }, [rooms, activeBuildingRooms, selectedFloor, searchQuery]);

  const floorCleaned = floorRooms.filter(
    (r) => r.status === 'cleaned' || r.status === 'verified'
  ).length;

  return (
    <div className={`p-4 pt-3 space-y-3.5 pb-28 text-slate-800 ${isPcMode ? 'max-w-5xl mx-auto' : 'max-w-md mx-auto'}`}>
      
      {/* Apple Notification Stack In-Animation Keyframes */}
      <style>{`
        @keyframes iosNotificationIn {
          0% {
            opacity: 0;
            transform: translate3d(0, 26px, 0) scale(0.96);
          }
          70% {
            opacity: 1;
            transform: translate3d(0, -1.5px, 0) scale(1.003);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        .anim-ios-notification {
          animation: iosNotificationIn 0.46s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }

        .disable-animations .anim-ios-notification {
          animation: none !important;
          transform: none !important;
          opacity: 1 !important;
        }

        .room-card-hover {
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 0.2s ease;
        }
        .room-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.05);
        }
      `}</style>

      {/* Toast Alert */}
      {toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-20 inset-x-0 z-[150] max-w-sm mx-auto px-4 pointer-events-none animate-toast select-none">
          <div className="pointer-events-auto p-3.5 bg-emerald-50/95 backdrop-blur-sm border border-emerald-300/80 text-emerald-800 text-xs font-semibold rounded-3xl flex items-center gap-2.5 shadow-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{toastMessage}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between pt-0.5">
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-tight">
            {selectedBuilding} Inspection
          </h2>
          <p className="text-[11px] text-slate-400">
            35 Classrooms across 7 Floors
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowBlastModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 active:scale-95 text-cyan-800 rounded-2xl text-xs font-bold transition border border-cyan-200/60 shadow-xs"
          title="Campus Remote AC Override"
        >
          <Snowflake className="w-3.5 h-3.5 text-cyan-600" />
          <span>Blast AC</span>
        </button>
      </div>

      {/* Search Bar & Building Dropdown */}
      <div className={isPcMode ? 'grid grid-cols-12 gap-3 items-center' : 'space-y-3'}>
        <div className={isPcMode ? 'col-span-7' : 'w-full'}>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search classroom, staff, status..."
              className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-100 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#176e57] shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition"
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
        </div>

        {/* Building Selector */}
        <div className={`relative ${isPcMode ? 'col-span-5' : 'w-full'} z-30`}>
          {isBuildingDropdownOpen && (
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setIsBuildingDropdownOpen(false)} 
            />
          )}

          <div className="relative z-40 bg-white border border-slate-100 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition">
            <button
              type="button"
              onClick={() => setIsBuildingDropdownOpen(!isBuildingDropdownOpen)}
              className="w-full p-3 px-3.5 flex items-center justify-between text-left active:bg-slate-50 transition rounded-2xl"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 text-[#176e57] flex items-center justify-center font-bold flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {selectedBuilding} Building
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    Active
                  </span>
                </div>
              </div>

              <div className="p-1 rounded-lg text-slate-400">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  isBuildingDropdownOpen ? 'rotate-180 text-[#176e57]' : ''
                }`} />
              </div>
            </button>

            {isBuildingDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-100/90 rounded-2xl shadow-xl overflow-hidden p-2 space-y-1 animate-dropdown">
                {BUILDINGS.map((b) => {
                  const isSelected = selectedBuilding === b.id;

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBuilding(b.id);
                        setIsBuildingDropdownOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition active:scale-[0.98] ${
                        isSelected
                          ? 'bg-emerald-50/60 border-emerald-300/80 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-transparent hover:border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isSelected ? 'bg-[#176e57] text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {b.id[0]}
                        </div>
                        <span className="font-bold text-slate-800 text-xs">
                          {b.name}
                        </span>
                      </div>

                      {isSelected && (
                        <span className="p-1 rounded-md bg-[#176e57] text-white flex-shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floor Filter Row */}
      {!searchQuery && (
        <div className={isPcMode ? 'flex items-center justify-between gap-4 bg-white p-3 rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]' : 'space-y-2'}>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((f) => {
              const isActive = selectedFloor === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFloor(f)}
                  className={`px-3.5 py-1.5 rounded-2xl font-bold text-xs transition active:scale-95 border ${
                    isActive
                      ? 'bg-[#176e57] text-white border-[#176e57] shadow-xs'
                      : 'bg-slate-100/90 text-slate-600 border-slate-200/80 hover:bg-slate-200 shadow-2xs'
                  }`}
                >
                  Floor {f}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">
              Assigned: <strong>{getAssignedStaffName(selectedBuilding, selectedFloor)}</strong>
            </span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-2xl flex-shrink-0">
              {floorCleaned} / 5 Done
            </span>
          </div>
        </div>
      )}

      {/* Classrooms List: 3 Balanced Landscape Rectangles on PC / Normal Stack on Phone */}
      <div 
        key={`${selectedBuilding}_f${selectedFloor}_${searchQuery}`}
        className={
          isPcMode
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5'
            : 'space-y-3'
        }
      >
        {floorRooms.length > 0 ? (
          floorRooms.map((room, index) => {
            const isReclean = room.status === 'needs_reclean' || room.status === 'reclean' || Boolean(room.recleanReason);
            const isVerified = !isReclean && room.status === 'verified';
            const isCleaned = !isReclean && room.status === 'cleaned';
            const roomBuilding = room.building || selectedBuilding;
            const displayRoomNumber = String(room.id).replace(/^[A-Za-z]/, '');

            const theme = isReclean
              ? ROOM_CARD_THEMES.needsReclean
              : isVerified
              ? ROOM_CARD_THEMES.verified
              : isCleaned
              ? ROOM_CARD_THEMES.cleaned
              : ROOM_CARD_THEMES.pending;

            return (
              <div
                key={`${roomBuilding}_${room.id}`}
                onClick={() => handleOpenRoomModal(room)}
                style={{
                  animationDelay: !animationsDisabled ? `${Math.min(index * 42, 380)}ms` : '0ms'
                }}
                className={`rounded-3xl p-4 border transition-all duration-200 active:scale-[0.99] cursor-pointer room-card-hover select-none flex flex-col justify-between ${
                  isPcMode ? 'min-h-[110px] gap-2.5' : 'space-y-2.5'
                } ${theme.card} ${
                  !animationsDisabled ? 'anim-ios-notification' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        Room {displayRoomNumber}
                      </span>
                      {/* On PC, keep the building badge right on the title row for a sleek rectangle */}
                      {isPcMode && (
                        <span className="text-[10px] font-bold text-slate-500 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200/60 shadow-2xs">
                          {roomBuilding} &bull; F{room.floor}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize border shadow-2xs ${theme.pill}`}
                    >
                      {room.status ? room.status.replace('_', ' ') : 'Pending'}
                    </span>
                  </div>

                  {/* Tags row */}
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {/* On Phone, keep original layout untouched */}
                    {!isPcMode && (
                      <span className="text-[10px] font-bold text-slate-500 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200/60 shadow-2xs">
                        {roomBuilding} &bull; F{room.floor}
                      </span>
                    )}
                    
                    {room.hasStudents && (
                      <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                        <Users className="w-2.5 h-2.5" />
                        <span>Class Active</span>
                      </span>
                    )}

                    {isReclean && room.recleanReason && (
                      <span className="text-[9px] font-bold bg-rose-100/90 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full truncate max-w-[180px]" title={room.recleanReason}>
                        "{room.recleanReason}"
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom indicators */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-200/50">
                  <div className="flex items-center gap-2 flex-wrap">
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
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 ml-auto">
                    {room.lastCleaned || '--:--'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white rounded-3xl p-8 border border-slate-100 text-center space-y-2 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">No classrooms found</p>
            <p className="text-[10px] text-slate-400">Try searching for another room number or building</p>
          </div>
        )}
      </div>

      {/* Room Inspection Modal */}
      {activeModalRoom && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 select-none"
          onClick={handleCloseRoomModal}
        >
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] sm:max-h-[88vh] animate-sheet-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  {activeModalRoom.building || selectedBuilding} &bull; Floor {activeModalRoom.floor}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  Inspect Room {String(activeModalRoom.id).replace(/^[A-Za-z]/, '')}
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

            <div className="p-4 overflow-y-auto space-y-3.5 text-xs flex-1">
              <div 
                onClick={() => setHasStudentsVal(!hasStudentsVal)}
                className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer active:scale-[0.99] transition ${
                  hasStudentsVal ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
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
                  {hasStudentsVal && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

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
                        className={`p-2.5 rounded-2xl text-left font-bold text-xs transition border flex items-center gap-2 ${
                          isSelected
                            ? 'bg-[#176e57] text-white border-[#176e57] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : s.color}`} />
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

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
                    className="w-full p-2.5 text-xs border border-rose-300 rounded-2xl bg-rose-50/50 text-rose-900 focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

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
                        className={`p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer active:scale-[0.99] transition ${
                          chk.state ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50 border-slate-100'
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

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Room Notes & Incident Reports:
                </label>
                <textarea
                  rows={2}
                  value={notesVal}
                  onChange={(e) => setNotesVal(e.target.value)}
                  placeholder="Note physical damage, broken desks, or spills..."
                  className="w-full p-2.5 text-xs border border-slate-100 rounded-2xl focus:outline-none focus:border-[#176e57] bg-slate-50 text-slate-800 resize-none shadow-2xs"
                />
              </div>

            </div>

            <div className="p-3.5 px-4 bg-white border-t border-slate-100 flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleCloseRoomModal}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-2xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInspection}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving Room...' : 'Save Inspection'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Blast AC Modal */}
      <BlastACModal
        isOpen={showBlastModal}
        onClose={() => setShowBlastModal(false)}
      />

    </div>
  );
}