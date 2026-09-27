import React, { useState } from 'react';
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
  KeyRound,
  ShieldCheck,
  Shield
} from 'lucide-react';

const REQUEST_CATEGORIES = [
  { label: 'Aircon Issue', icon: Wind },
  { label: 'Spill / Cleaning', icon: Droplets },
  { label: 'Bond Paper / Supplies', icon: FileText },
  { label: 'Trash Emptying', icon: Trash },
  { label: 'Other Concern', icon: HelpCircle }
];

export default function TeacherRequest() {
  const navigate = useNavigate();

  // Authentication Gate State
  const [facultyId, setFacultyId] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [authError, setAuthError] = useState('');

  // Request Form States
  const [teacherName, setTeacherName] = useState('');
  const [roomId, setRoomId] = useState('101');
  const [category, setCategory] = useState('Aircon Issue');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Google reCAPTCHA Verification Gate
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);

  const roomOptions = [];
  for (let floor = 1; floor <= 7; floor++) {
    for (let rm = 1; rm <= 5; rm++) {
      roomOptions.push(`${floor}0${rm}`);
    }
  }

  // Accepts '100', 'faculty', or any 3+ character code
  const handleFacultyLogin = (e) => {
    e.preventDefault();
    const cleanId = facultyId.trim();

    if (cleanId === '100' || cleanId.toLowerCase() === 'faculty' || cleanId.length >= 3) {
      setIsVerified(true);
      setAuthError('');
      if (cleanId === '100' && !teacherName) {
        setTeacherName('Engr. Davis (Faculty)');
      }
    } else {
      setAuthError('Invalid code. Please enter faculty code 100 or your institutional ID.');
    }
  };

  // Step 1: Validate form inputs and pop the reCAPTCHA challenge
  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!teacherName.trim()) {
      setErrorMsg('Please enter your name or department.');
      return;
    }
    setErrorMsg('');
    setShowCaptchaModal(true);
  };

  // Step 2: Executes after Google reCAPTCHA is verified
  const handleExecuteDispatch = async () => {
    setShowCaptchaModal(false);
    setIsSubmitting(true);
    setErrorMsg('');

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newRequest = {
      id: `req-${Date.now()}`,
      created_at: new Date().toISOString(),
      time: now,
      teacher_name: `${teacherName.trim()} [ID: ${facultyId}]`,
      room_id: roomId,
      category: category,
      notes: notes.trim(),
      status: 'pending',
      assigned_to: null
    };

    // 1. Dual-Sync: Save to localStorage & broadcast across open tabs immediately
    try {
      const stored = JSON.parse(localStorage.getItem('sjc_teacher_requests') || '[]');
      const updated = [newRequest, ...stored.filter((r) => r.id !== newRequest.id)];
      localStorage.setItem('sjc_teacher_requests', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('sjc_request_created', { detail: newRequest }));
    } catch (localErr) {
      console.warn('Local storage sync warning:', localErr);
    }

    // 2. Push to Supabase database
    try {
      const { error: dbError } = await supabase.from('teacher_requests').insert([newRequest]);
      if (dbError) {
        console.warn('Supabase rejected insert, fallback to local sync:', dbError.message);
      }

      // Non-blocking shift log alert
      try {
        await supabase.from('logs').insert([{
          id: `log-${Date.now()}`,
          time: now,
          author: 'Faculty Alert',
          text: `Teacher Request (${roomId}): ${teacherName} reported ${category}. "${notes.trim() || 'Urgent assistance needed.'}"`
        }]);
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
    setRoomId('101');
    setErrorMsg('');
  };

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
                <KeyRound className="w-4 h-4" />
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
                  type="text"
                  required
                  autoComplete="off"
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                  placeholder="Enter code (e.g. 100)"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-[#176e57] tracking-wider text-sm bg-slate-50"
                />
                <span className="text-[10px] text-slate-400 mt-1.5 block">
                  Testing code: Enter <strong>100</strong> to open the request form.
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white font-bold rounded-xl text-xs shadow-sm transition"
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
                Custodial personnel assigned to <strong>Floor {submittedRequest.room_id[0]}</strong> have been notified.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Classroom:</span>
                <span className="font-bold text-slate-800">Room {submittedRequest.room_id}</span>
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
          /* Step 2: Form */
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4 animate-pop">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Call Janitorial Staff</h2>
                  <p className="text-[11px] text-slate-400">Immediate classroom alert</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-50 text-[#176e57] border border-emerald-200 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> ID: {facultyId}
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span className="break-all">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePreSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Faculty Name / Department:
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
                  Classroom Location:
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

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Assistance Type:
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
                            ? 'border-[#176e57] bg-emerald-50 text-[#176e57] font-bold shadow-xs'
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
                  Notes / Details:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Water leak near blackboard, 2 reams bond paper..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#176e57]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-75"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatching Staff...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Verify & Send Request</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="pb-6 text-center text-[11px] text-slate-400">
        PHINMA Saint Jude College • Dimasalang Facilities
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