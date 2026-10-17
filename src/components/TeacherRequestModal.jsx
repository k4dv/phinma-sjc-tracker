import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../data/supabaseClient';
import { 
  BellRing, 
  X, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Wind,
  Droplets,
  FileText,
  Trash,
  HelpCircle,
  Building2
} from 'lucide-react';

const BUILDINGS = [
  { id: 'Dimasalang', name: 'Dimasalang', offset: 0 },
  { id: 'Silang', name: 'Silang', offset: 40 },
  { id: 'Phinma', name: 'Phinma', offset: 20 }
];

const REQUEST_CATEGORIES = [
  { label: 'Aircon Issue', icon: Wind },
  { label: 'Spill / Cleaning', icon: Droplets },
  { label: 'Bond Paper / Supplies', icon: FileText },
  { label: 'Trash Emptying', icon: Trash },
  { label: 'Other Concern', icon: HelpCircle }
];

export default function TeacherRequestModal({ isOpen, onClose }) {
  const [selectedBuilding, setSelectedBuilding] = useState('Dimasalang');
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [teacherName, setTeacherName] = useState('');
  const [category, setCategory] = useState('Aircon Issue');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const currentBuildingObj = BUILDINGS.find((b) => b.id === selectedBuilding) || BUILDINGS[0];
  const floorRoomOptions = [1, 2, 3, 4, 5].map((rm) => `${selectedFloor * 100 + currentBuildingObj.offset + rm}`);
  const [roomId, setRoomId] = useState(floorRoomOptions[0]);

  const handleBuildingChange = (bldgId) => {
    setSelectedBuilding(bldgId);
    const bObj = BUILDINGS.find((b) => b.id === bldgId) || BUILDINGS[0];
    setRoomId(`${selectedFloor * 100 + bObj.offset + 1}`);
  };

  const handleFloorChange = (floorNum) => {
    setSelectedFloor(floorNum);
    setRoomId(`${floorNum * 100 + currentBuildingObj.offset + 1}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teacherName.trim()) {
      setErrorMsg('Please enter your name or department.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newRequest = {
      id: `req-${Date.now()}`,
      created_at: new Date().toISOString(),
      time: now,
      teacher_name: teacherName.trim(),
      room_id: String(roomId),
      category: category,
      notes: notes.trim(),
      status: 'pending',
      assigned_to: null
    };

    try {
      await supabase.from('teacher_requests').insert([newRequest]);

      await supabase.from('logs').insert([{
        id: `log-${Date.now()}`,
        time: now,
        author: 'Faculty Alert',
        text: `Teacher Request (${selectedBuilding} - Room ${roomId}): ${teacherName.trim()} reported ${category}. "${notes.trim() || 'Assistance requested.'}"`
      }]);

      setSuccessMsg(`Assistance requested for Room ${roomId}! Custodial staff has been alerted.`);
      setTimeout(() => {
        setSuccessMsg('');
        setTeacherName('');
        setNotes('');
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to submit request:', err);
      setErrorMsg('Unable to dispatch request. Please check your internet connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[250] bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-backdrop select-none"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-sm rounded-t-[2.25rem] sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-sheet-up max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto sm:hidden mb-1" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-2xl">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Call Custodial Staff</h3>
              <p className="text-[10px] text-slate-400">Classroom assistance dispatch</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-pop shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-2xl flex items-center gap-2 animate-shake shadow-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Teacher Name / Department:
            </label>
            <input
              type="text"
              required
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="e.g. Ms. Santos (SHS Dept)"
              className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#176e57] bg-slate-50 font-medium"
            />
          </div>

          {/* Campus Building Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Campus Building:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {BUILDINGS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleBuildingChange(b.id)}
                  className={`py-2 px-1 text-center rounded-xl font-bold text-[11px] border transition active:scale-95 flex items-center justify-center gap-1 ${
                    selectedBuilding === b.id
                      ? 'border-[#176e57] bg-emerald-50 text-[#176e57] shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-3 h-3" />
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Floor & Room Dropdowns */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Floor:
              </label>
              <select
                value={selectedFloor}
                onChange={(e) => handleFloorChange(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 bg-white font-bold focus:outline-none focus:border-[#176e57]"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((f) => (
                  <option key={f} value={f}>
                    Floor {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Room Number:
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 bg-white font-mono font-bold focus:outline-none focus:border-[#176e57]"
              >
                {floorRoomOptions.map((rm) => (
                  <option key={rm} value={rm}>
                    Room {rm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assistance Category Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
              Assistance Type Needed:
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {REQUEST_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`p-2 rounded-xl text-left font-semibold text-[11px] border flex items-center gap-1.5 transition active:scale-95 ${
                      isSelected
                        ? 'border-[#176e57] bg-emerald-50 text-[#176e57] font-bold shadow-2xs'
                        : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Details / Specific Notes (Optional):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Water leak from ceiling, emergency spill cleanup..."
              className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#176e57] bg-slate-50 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || Boolean(successMsg)}
            className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-75"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Dispatching Alert...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Alert to Custodial Staff</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}