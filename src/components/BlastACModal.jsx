import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { 
  Snowflake, 
  X, 
  CreditCard, 
  AlertOctagon, 
  Loader2, 
  Check, 
  ShieldAlert, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  Flame 
} from 'lucide-react';

export default function BlastACModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1); // 1 = Warning, 'loading' = Spinner, 2 = Paywall
  const [isProcessing, setIsProcessing] = useState(false);
  const [declinedError, setDeclinedError] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  if (!isOpen) return null;

  const firePackOpeningConfetti = () => {
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.52 },
      zIndex: 10000,
      colors: ['#10b981', '#fbbf24', '#f59e0b', '#38bdf8', '#f43f5e']
    });

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0.15, y: 0.65 },
        zIndex: 10000,
        colors: ['#176e57', '#34d399', '#fde047']
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 0.85, y: 0.65 },
        zIndex: 10000,
        colors: ['#fbbf24', '#f43f5e', '#38bdf8']
      });
    }, 150);
  };

  const handleProceedToLoading = () => {
    setStep('loading');

    // 1.4s of spinning, then expand & morph
    setTimeout(() => {
      setStep(2);
      setTimeout(() => {
        setIsRevealed(true);
        firePackOpeningConfetti();
      }, 400);
    }, 1400);
  };

  const handleFakePurchase = () => {
    setIsProcessing(true);
    setDeclinedError(false);

    setTimeout(() => {
      setIsProcessing(false);
      setDeclinedError(true);
    }, 1900);
  };

  const handleClose = () => {
    setStep(1);
    setDeclinedError(false);
    setIsProcessing(false);
    setIsRevealed(false);
    onClose();
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-backdrop"
      onClick={handleClose}
    >
      <div 
        className="bg-white border border-slate-200/90 w-full max-w-sm rounded-3xl shadow-2xl text-slate-800 relative z-10 animate-pop overflow-hidden transition-all duration-500 ease-in-out"
        style={{
          maxHeight: step === 'loading' ? '220px' : '720px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        {step !== 'loading' && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition z-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* ============================================================== */}
        {/* STEP 1: CRITICAL RED POWER SURGE WARNING                       */}
        {/* ============================================================== */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <div className="relative mx-auto w-14 h-14 flex items-center justify-center">
              <span className="absolute inset-0 rounded-2xl bg-rose-500/25 animate-ping opacity-75" />
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner relative border border-rose-200">
                <AlertOctagon className="w-7 h-7 stroke-[2.2]" />
              </div>
            </div>

            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 uppercase tracking-widest bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                <Flame className="w-3 h-3 text-rose-500" />
                Critical Grid Warning
              </span>
              <h3 className="text-base font-extrabold text-slate-900 pt-1">
                Trigger All 35 Air Conditioners?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed px-1">
                You are about to activate the compressors in all 35 classrooms across Floors 1 through 7 simultaneously.
              </p>
            </div>

            <div className="bg-rose-50/40 rounded-2xl p-3 border border-rose-100 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Estimated Peak Draw:</span>
                <strong className="text-slate-900 font-mono">~87.5 kW / hr</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Main Substation:</span>
                <strong className="text-slate-900">Dimasalang Transformer A</strong>
              </div>
              <div className="flex justify-between items-center text-rose-700 font-semibold pt-1 border-t border-rose-200/60">
                <span>Circuit Breaker Risk:</span>
                <span className="text-rose-600 font-black tracking-wide uppercase">Severe Overload</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleProceedToLoading}
                className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Yes, Proceed to Remote Override</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 text-slate-400 hover:text-slate-600 text-xs font-semibold transition cursor-pointer"
              >
                Cancel (Keep Current Status)
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* INTERMEDIATE: LOADING SPINNER                                  */}
        {/* ============================================================== */}
        {step === 'loading' && (
          <div className="h-[220px] flex flex-col items-center justify-center p-6 text-center space-y-3 animate-in fade-in duration-300">
            <Loader2 className="w-11 h-11 text-[#176e57] animate-spin stroke-[2.2]" />
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight">
                Connecting to Dimasalang Grid...
              </h3>
              <p className="text-[10px] text-slate-400">
                Bypassing 35 classroom compressors
              </p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: PAYWALL EXPANSION MORPH                                */}
        {/* ============================================================== */}
        {step === 2 && (
          <div className="animate-in fade-in duration-500 transition-all">
            {/* Header Ribbon */}
            <div className="bg-gradient-to-b from-[#125744] to-[#176e57] text-white px-5 pt-7 pb-6 text-center relative overflow-hidden">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-white mx-auto flex items-center justify-center mb-2 shadow-lg">
                <Snowflake className="w-7 h-7 text-cyan-200 animate-spin" style={{ animationDuration: '8s' }} />
              </div>

              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-400/30 text-[10px] font-extrabold uppercase tracking-widest text-emerald-200">
                <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                <span>PHINMA Facilities Enterprise</span>
              </div>

              <h3 className="text-base font-extrabold text-white mt-1">
                Central Climate Cloud Tier
              </h3>
              <p className="text-[11px] text-emerald-100 mt-1 px-3 leading-tight opacity-90">
                Simultaneous 35-classroom automated bypass requires an active Institutional IoT Cloud License.
              </p>
            </div>

            <div className="p-5 space-y-3.5">
              {/* Feature List */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 space-y-2 text-xs">
                <span className="text-[10px] font-bold text-[#176e57] uppercase tracking-wider block">
                  Enterprise License Includes:
                </span>
                <div className="space-y-1.5 text-slate-600 text-[11px]">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Instant remote bypass for Floors 1 to 7</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Direct commercial peak-hour Meralco quota</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Priority maintenance dispatch on breaker trip</span>
                  </div>
                </div>
              </div>

              {/* Pricing Card with Spinning Sparkle */}
              <div 
                className={`p-3.5 rounded-2xl border-2 transition-all duration-500 flex items-center justify-between relative shadow-sm ${
                  isRevealed
                    ? 'border-emerald-600 bg-gradient-to-r from-emerald-50 via-amber-50/50 to-emerald-50 ring-2 ring-emerald-400/50 scale-[1.02]'
                    : 'border-emerald-500 bg-emerald-50/50 scale-100'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-[#176e57] uppercase tracking-wider">
                      Campus Facility Billing
                    </span>
                    <Sparkles 
                      className="w-3.5 h-3.5 text-amber-500 fill-amber-400 inline-block animate-spin" 
                      style={{ animationDuration: '3.5s' }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 block mt-0.5">
                    Billed Monthly to Department
                  </span>
                </div>

                <div className="text-right">
                  <span className={`text-2xl font-black tracking-tight block transition-all duration-300 ${
                    isRevealed ? 'text-emerald-800 scale-105' : 'text-[#176e57]'
                  }`}>
                    ₱5,000.00
                  </span>
                  <span className="text-[10px] text-slate-400 block font-semibold">/ month</span>
                </div>
              </div>

              {/* Transaction Declined Alert */}
              {declinedError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-[11px] space-y-1 animate-shake">
                  <div className="flex items-center gap-1.5 font-bold text-rose-700">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>TRANSACTION REJECTED</span>
                  </div>
                  <p className="text-[10px] text-rose-600 leading-tight">
                    Disapproved by PHINMA SJC Accounting & Treasury. Reason: Campus energy conservation directive #2026-04. Please use manual wall remotes per classroom.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleFakePurchase}
                  className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Contacting SJC Treasury & Cloud Servers...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Authorize Charge (₱5,000.00/mo)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-2 text-slate-400 hover:text-slate-600 text-[11px] font-medium transition cursor-pointer"
                >
                  Cancel / Use manual wall switches (Free)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}