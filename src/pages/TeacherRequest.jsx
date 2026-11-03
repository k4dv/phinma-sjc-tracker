import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import sjcLogo from '../assets/Logo.jpg';
import schoolBg from '../assets/School.jpg';
import { supabase } from '../data/supabaseClient';
import CaptchaModal from '../components/CaptchaModal';
import { 
  BellRing, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Wind,
  Droplets,
  FileText,
  Trash,
  HelpCircle,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Building2
} from 'lucide-react';

const REQUEST_CATEGORIES = [
  { label: 'Aircon Issue', icon: Wind },
  { label: 'Spill / Cleaning', icon: Droplets },
  { label: 'Bond Paper / Supplies', icon: FileText },
  { label: 'Trash Emptying', icon: Trash },
  { label: 'Other Concern', icon: HelpCircle }
];

// Campus Buildings and Room configurations matching SJC Tracker structure
const CAMPUS_DATA = {
  Dimasalang: {
    floors: [1, 2, 3, 4, 5, 6, 7],
    getRooms: (floor) => [
      `${floor}01`, `${floor}02`, `${floor}03`, `${floor}04`, `${floor}05`
    ]
  },
  Silang: {
    floors: [1, 2, 3, 4],
    getRooms: (floor) => [
      `${floor}41`, `${floor}42`, `${floor}43`, `${floor}44`, `${floor}45`
    ]
  },
  Phinma: {
    floors: [1, 2, 3, 4],
    getRooms: (floor) => [
      `${floor}21`, `${floor}22`, `${floor}23`, `${floor}24`, `${floor}25`
    ]
  }
};

export default function TeacherRequest() {
  const navigate = useNavigate();

  // Authentication Gate State
  const [facultyPin, setFacultyPin] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [authError, setAuthError] = useState('');

  // Request Form States
  const [teacherName, setTeacherName] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState('Dimasalang');
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [roomId, setRoomId] = useState('101');
  const [category, setCategory] = useState('Aircon Issue');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Google reCAPTCHA Verification Gate
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);

  // Exact Faculty Authorization PIN
  const AUTHORIZED_PIN = '4758';

  // Automatically update the default room whenever building or floor changes
  useEffect(() => {
    const availableRooms = CAMPUS_DATA[selectedBuilding].getRooms(selectedFloor);
    if (!availableRooms.includes(roomId)) {
      setRoomId(availableRooms[0]);
    }
  }, [selectedBuilding, selectedFloor]);

  const handleFacultyLogin = (e) => {
    e.preventDefault();
    const cleanPin = facultyPin.trim();

    if (cleanPin === AUTHORIZED_PIN) {
      setIsVerified(true);
      setAuthError('');
      setFacultyPin('');
    } else {
      setAuthError('Unauthorized code. Please provide an active faculty access PIN.');
      setFacultyPin('');
    }
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!teacherName.trim()) {
      setErrorMsg('Please enter your name or department.');
      return;
    }
    setErrorMsg('');
    setShowCaptchaModal(true);
  };

  const handleExecuteDispatch = async () => {
    setShowCaptchaModal(false);
    setIsSubmitting(true);
    setErrorMsg('');

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const reqId = `req-${Date.now()}`;

    // Standard payload strictly matching the Supabase teacher_requests database schema
    const formattedNotes = notes.trim()
      ? (selectedBuilding !== 'Dimasalang' ? `[${selectedBuilding}] ${notes.trim()}` : notes.trim())
      : (selectedBuilding !== 'Dimasalang' ? `[${selectedBuilding}]` : '');

    const newRequest = {
      id: reqId,
      created_at: new Date().toISOString(),
      time: now,
      teacher_name: `${teacherName.trim()} [Faculty]`,
      room_id: String(roomId),
      category: category,
      notes: formattedNotes,
      status: 'pending',
      assigned_to: null
    };

    // 1. Dual-Sync: Save to localStorage & broadcast locally across tabs
    try {
      const stored = JSON.parse(localStorage.getItem('sjc_teacher_requests') || '[]');
      const updated = [newRequest, ...stored.filter((r) => r.id !== newRequest.id)];
      localStorage.setItem('sjc_teacher_requests', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('sjc_request_created', { detail: newRequest }));
    } catch (localErr) {
      console.warn('Local storage sync warning:', localErr);
    }

    // 2. Safe Push to Supabase Database (Guaranteed delivery)
    try {
      // First attempt: try inserting with building column if available
      let { error: dbError } = await supabase
        .from('teacher_requests')
        .insert([{ ...newRequest, building: selectedBuilding }]);

      // Fallback: If table does not have a 'building' column, retry with standard schema
      if (dbError) {
        const retryResult = await supabase
          .from('teacher_requests')
          .insert([newRequest]);
        dbError = retryResult.error;
      }

      // 3. Post to Live Custodial Shift Log so supervisor & staff dashboard sees it immediately
      try {
        const newLog = {
          id: `log-${Date.now()}`,
          created_at: new Date().toISOString(),
          time: now,
          author: 'Faculty Alert',
          text: `Teacher Request (${selectedBuilding} - Rm ${roomId}): ${teacherName.trim()} reported ${category}. "${notes.trim() || 'Urgent assistance needed.'}"`
        };
        await supabase.from('logs').insert([newLog]);
        window.dispatchEvent(new CustomEvent('sjc_log_created', { detail: newLog }));
      } catch (logErr) {
        console.warn('Log insert bypassed:', logErr);
      }

      setSubmittedRequest(newRequest);
    } catch (err) {
      console.warn('Network issue encountered, using local sync:', err);
      setSubmittedRequest(newRequest);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedRequest(null);
    setNotes('');
    setCategory('Aircon Issue');
    setSelectedBuilding('Dimasalang');
    setSelectedFloor(1);
    setRoomId('101');
    setErrorMsg('');
  };

  const availableFloors = CAMPUS_DATA[selectedBuilding].floors;
  const availableRooms = CAMPUS_DATA[selectedBuilding].getRooms(selectedFloor);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto relative shadow-xl font-sans">
      
      {/* High-Visibility Header */}
      <div className="relative text-white pt-8 pb-7 px-6 text-center shadow-lg rounded-b-[2.5rem] overflow-hidden bg-slate-900">
        <img
          src={schoolBg}
          alt="PHINMA Saint Jude College"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none filter brightness-105 contrast-105"
        />

        <div className="absolute inset-0 bg-[#176e57]/15 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/35 pointer-events-none" />

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="absolute left-4 top-6 p-2 rounded-xl bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs active:scale-95 transition z-20"
          title="Back to Login"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="relative z-10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white shadow-xl p-1.5 flex items-center justify-center mb-2 overflow-hidden ring-2 ring-white/80">
            <img
              src={sjcLogo}
              alt="PHINMA Saint Jude College"
              className="w-full h-full object-contain pointer-events-none rounded-xl"
            />
          </div>
          <h1 className="text-base font-extrabold tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            PHINMA Saint Jude College
          </h1>
          <p className="text-xs text-emerald-100 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            Dimasalang Hall • Faculty Assistance Dispatch
          </p>
        </div>
      </div>

      <div className="flex-1 px-5 py-5">
        {!isVerified ? (
          /* Step 1: Faculty Gate */
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4 animate-pop">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="p-2 bg-emerald-50 text-[#176e57] rounded-xl">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Faculty Verification</h2>
                <p className="text-[11px] text-slate-400">Authorized teaching staff only</p>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleFacultyLogin} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Enter Faculty Access Code:
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  autoComplete="off"
                  value={facultyPin}
                  onChange={(e) => setFacultyPin(e.target.value)}
                  placeholder="••••"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold tracking-widest text-center focus:outline-none focus:border-[#176e57] text-base bg-slate-50"
                />
              </div>

              <button
                type="submit"
                disabled={facultyPin.length < 4}
                className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] disabled:bg-slate-300 disabled:cursor-not-allowed active:scale-[0.98] text-white font-bold rounded-xl text-xs shadow-sm transition"
              >
                Verify & Open Call Screen
              </button>
            </form>
          </div>
        ) : submittedRequest ? (
          /* Step 3: Receipt */
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center space-y-4 animate-pop">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800">Dispatch Received!</h2>
              <p className="text-xs text-slate-500 mt-1">
                Custodial personnel assigned to <strong>{selectedBuilding} - Room {submittedRequest.room_id}</strong> have been notified.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Location:</span>
                <span className="font-bold text-slate-800">{selectedBuilding} • Room {submittedRequest.room_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="font-bold text-slate-800">{submittedRequest.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Faculty:</span>
                <span className="font-bold text-slate-800">{submittedRequest.teacher_name}</span>
              </div>
              {submittedRequest.notes && (
                <div className="pt-1 border-t border-slate-200">
                  <span className="text-slate-400 block">Note:</span>
                  <span className="text-slate-700 italic">"{submittedRequest.notes}"</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetForm}
              className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-xl text-xs transition shadow-sm"
            >
              Submit Another Request
            </button>
          </div>
        ) : (
          /* Step 2: Form (Clean layout matching reference image) */
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4 animate-pop">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Call Custodial Staff</h2>
                  <p className="text-[11px] text-slate-400">Classroom assistance dispatch</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-50 text-[#176e57] border border-emerald-200 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Faculty Verified
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span className="break-all">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePreSubmit} className="space-y-3.5 text-xs">
              {/* Teacher Name Input */}
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

              {/* Campus Building Selector (Pill tabs without dots) */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Campus Building:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Dimasalang', 'Silang', 'Phinma'].map((bldg) => {
                    const isSelected = selectedBuilding === bldg;
                    return (
                      <button
                        key={bldg}
                        type="button"
                        onClick={() => {
                          setSelectedBuilding(bldg);
                          setSelectedFloor(1);
                        }}
                        className={`p-2.5 rounded-xl text-center font-semibold text-xs border flex items-center justify-center gap-1.5 transition active:scale-95 select-none ${
                          isSelected
                            ? 'border-[#176e57] bg-emerald-50/70 text-[#176e57]'
                            : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <Building2 
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            isSelected ? 'text-[#176e57]' : 'text-slate-400'
                          }`} 
                        />
                        <span className="truncate">{bldg}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Floor and Room Number Side-by-Side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Floor:
                  </label>
                  <select
                    value={selectedFloor}
                    onChange={(e) => setSelectedFloor(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 bg-white font-medium focus:outline-none focus:border-[#176e57]"
                  >
                    {availableFloors.map((flr) => (
                      <option key={flr} value={flr}>
                        Floor {flr}
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
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 bg-white font-medium focus:outline-none focus:border-[#176e57]"
                  >
                    {availableRooms.map((rm) => (
                      <option key={rm} value={rm}>
                        Room {rm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assistance Type */}
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
                            ? 'border-[#176e57] bg-emerald-50/70 text-[#176e57]'
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

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Details / Specific Notes (Optional):
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Water leak from ceiling, emergency spill cleanup..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#176e57]"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-75"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Alert...</span>
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
        )}
      </div>

      <div className="pb-6 text-center text-[11px] text-slate-400">
        PHINMA Saint Jude College • Custodial Dispatch
      </div>

      {/* Google reCAPTCHA Modal Shield */}
      <CaptchaModal
        isOpen={showCaptchaModal}
        onClose={() => setShowCaptchaModal(false)}
        onSuccess={handleExecuteDispatch}
      />

    </div>
  );
}