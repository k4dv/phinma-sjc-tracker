import React, { useState } from 'react';
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
  HelpCircle
} from 'lucide-react';

const REQUEST_CATEGORIES = [
  { label: 'Aircon Issue', icon: Wind, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  { label: 'Spill / Cleaning', icon: Droplets, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { label: 'Bond Paper / Supplies', icon: FileText, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { label: 'Trash Emptying', icon: Trash, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { label: 'Other Concern', icon: HelpCircle, color: 'text-slate-600 bg-slate-50 border-slate-200' }
];

export default function TeacherRequestModal({ isOpen, onClose }) {
  const [teacherName, setTeacherName] = useState('');
  const [roomId, setRoomId] = useState('101');
  const [category, setCategory] = useState('Aircon Issue');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Generate 35 room options (Floors 1-7, Rooms 01-05)
  const roomOptions = [];
  for (let floor = 1; floor <= 7; floor++) {
    for (let rm = 1; rm <= 5; rm++) {
      roomOptions.push(`${floor}0${rm}`);
    }
  }

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
      room_id: roomId,
      category: category,
      notes: notes.trim(),
      status: 'pending',
      assigned_to: null
    };

    try {
      await supabase.from('teacher_requests').insert([newRequest]);

      // Post notification to handover logs
      await supabase.from('logs').insert([{
        id: `log-${Date.now()}`,
        time: now,
        author: 'Faculty Alert',
        text: `Teacher Request (${roomId}): ${teacherName} reported ${category}. "${notes.trim() || 'Urgent assistance needed.'}"`
      }]);

      setSuccessMsg(`Assistance requested for Room ${roomId}! Custodial staff has been notified.`);
      setTimeout(() => {
        setSuccessMsg('');
        setTeacherName('');
        setNotes('');
        onClose();
      }, 2400);
    } catch (err) {
      console.error('Failed to submit request:', err);
      setErrorMsg('Unable to send request. Please verify internet connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-sheet-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Call Custodial Staff</h3>
              <p className="text-[10px] text-slate-400">Faculty classroom assistance dispatch</p>
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
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-pop shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-shake shadow-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
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
              className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#176e57]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Classroom / Room Number:
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 bg-white font-mono font-bold focus:outline-none focus:border-[#176e57]"
            >
              {roomOptions.map((rm) => (
                <option key={rm} value={rm}>
                  Room {rm} (Floor {rm[0]})
                </option>
              ))}
            </select>
          </div>

          {/* Category Selector */}
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
                        ? 'border-[#176e57] bg-emerald-50/70 text-[#176e57] font-bold shadow-xs'
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
              Details / Special Instructions:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Water dripping from aircon unit, need 2 reams of short bond paper..."
              className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#176e57]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || Boolean(successMsg)}
            className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-75"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Alert...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Request to Custodial Staff</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}   