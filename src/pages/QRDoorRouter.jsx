import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import sjcLogo from '../assets/Logo.jpg';
import { 
  ShieldAlert, 
  Loader2, 
  ArrowRight, 
  LogIn, 
  HandMetal, 
  ExternalLink 
} from 'lucide-react';

const OFFICIAL_PHINMA_SIS_URL = 'https://sjc.phinma.edu.ph/';

export default function QRDoorRouter({ user }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('room') || '101';
  const floorNumber = Number(String(roomId)[0]) || 1;

  const [countdown, setCountdown] = useState(5);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // 1. If staff/admin is already logged in, forward immediately to the specific room checklist
    if (user) {
      navigate('/rooms', {
        replace: true,
        state: {
          targetRoomId: String(roomId),
          targetFloor: floorNumber,
          scanTimestamp: Date.now()
        }
      });
      return;
    }

    // 2. If unauthenticated, run the countdown to redirect students to official SIS
    if (isPaused) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.href = OFFICIAL_PHINMA_SIS_URL;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [user, roomId, floorNumber, navigate, isPaused]);

  if (user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
      
      {/* SJC Crest */}
      <div className="w-20 h-20 rounded-3xl bg-white p-2 shadow-2xl flex items-center justify-center animate-pop mb-4 ring-4 ring-white/10">
        <img 
          src={sjcLogo} 
          alt="PHINMA SJC" 
          className="w-full h-full object-contain rounded-2xl pointer-events-none" 
        />
      </div>

      {/* Header Info */}
      <div className="space-y-2 max-w-xs mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-full text-xs font-bold">
          <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dimasalang Hall Door Hub</span>
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Room {roomId}
        </h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          Classroom facilities marker for custodial inspection, teacher service calls, and student services.
        </p>
      </div>

      {/* Action Options for Staff & Faculty */}
      <div className="w-full max-w-xs space-y-2.5 mb-6">
        
        {/* Faculty Request Action */}
        <button
          type="button"
          onClick={() => {
            setIsPaused(true);
            navigate(`/request?room=${encodeURIComponent(roomId)}`);
          }}
          className="w-full p-3.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-2xl font-bold text-xs flex items-center justify-between shadow-lg transition"
        >
          <div className="flex items-center gap-2.5 text-left">
            <div className="p-1.5 bg-black/10 rounded-xl">
              <HandMetal className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <span className="block font-bold text-slate-950">Faculty Assistance Call</span>
              <span className="text-[10px] text-slate-900 font-medium block">Request cleaning, chalk, or supplies</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-950" />
        </button>

        {/* Custodian / Admin Login Action */}
        <button
          type="button"
          onClick={() => {
            setIsPaused(true);
            navigate('/login');
          }}
          className="w-full p-3.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white rounded-2xl font-bold text-xs flex items-center justify-between shadow-lg transition border border-emerald-600/40"
        >
          <div className="flex items-center gap-2.5 text-left">
            <div className="p-1.5 bg-white/10 rounded-xl">
              <LogIn className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="block font-bold text-white">Custodial Staff Login</span>
              <span className="text-[10px] text-emerald-200 font-medium block">Log in to complete daily checklist</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Student Automatic Redirect Banner */}
      <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl max-w-xs w-full text-xs space-y-2 text-slate-300">
        {!isPaused ? (
          <div className="flex items-center justify-center gap-2 text-[11px]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>
              Student Redirect to SIS in <strong>{countdown}s</strong>...
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">
            Student redirect paused. Choose an option above.
          </p>
        )}

        <div className="pt-1 border-t border-slate-800/80">
          <a
            href={OFFICIAL_PHINMA_SIS_URL}
            className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold hover:underline"
          >
            <span>Proceed directly to Student Portal (SIS)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

    </div>
  );
}