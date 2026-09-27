import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, X, Loader2, CheckCircle2 } from 'lucide-react';

const RECAPTCHA_SITE_KEY = '6Lfl6s0tAAAAABfV4trWB5mpq81iiLR6GuoGhJYJ';

export default function CaptchaModal({ isOpen, onClose, onSuccess }) {
  const containerRef = useRef(null);
  const [isScriptLoading, setIsScriptLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsVerified(false);
      return;
    }

    let isMounted = true;
    setIsScriptLoading(true);

    const renderWidget = () => {
      if (!isMounted || !containerRef.current || !window.grecaptcha?.render) return;

      containerRef.current.innerHTML = '';

      try {
        window.grecaptcha.render(containerRef.current, {
          sitekey: RECAPTCHA_SITE_KEY,
          theme: 'light', // Change to 'dark' if you prefer dark mode
          size: 'normal',
          callback: (token) => {
            if (!isMounted) return;
            setIsVerified(true);
            setTimeout(() => {
              onSuccess(token);
              onClose();
            }, 600);
          },
          'expired-callback': () => {
            if (!isMounted) return;
            setIsVerified(false);
          }
        });
        setIsScriptLoading(false);
      } catch (err) {
        console.error('Google reCAPTCHA render error:', err);
        setIsScriptLoading(false);
      }
    };

    if (!window.grecaptcha) {
      const scriptId = 'google-recaptcha-v2-script';
      let script = document.getElementById(scriptId);

      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (window.grecaptcha?.ready) {
            window.grecaptcha.ready(renderWidget);
          } else {
            renderWidget();
          }
        };
        document.head.appendChild(script);
      } else {
        script.addEventListener('load', renderWidget);
      }
    } else {
      if (window.grecaptcha?.ready) {
        window.grecaptcha.ready(renderWidget);
      } else {
        renderWidget();
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop">
      <div 
        className="bg-white w-[356px] rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand Header */}
        <div className="bg-[#176e57] text-white pt-4 pb-3.5 px-4 text-left relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3.5 top-3.5 text-emerald-100/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 mb-0.5">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span className="text-[10px] font-extrabold text-emerald-200 uppercase tracking-widest">
              Institutional Security
            </span>
          </div>
          <h3 className="text-sm font-bold text-white leading-tight">
            Human Verification
          </h3>
        </div>

        {/* reCAPTCHA Content Area */}
        <div className="p-4 bg-slate-50 flex flex-col items-center justify-center min-h-[120px]">
          {isScriptLoading && (
            <div className="flex flex-col items-center justify-center text-slate-500 text-xs py-5 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#176e57]" />
              <span className="font-medium text-[11px]">Connecting to Google Security...</span>
            </div>
          )}

          {isVerified && (
            <div className="mb-2 p-2 w-full bg-emerald-50 border border-emerald-300 text-[#176e57] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 animate-pop">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Verified! Proceeding to session...</span>
            </div>
          )}

          {/* Locked to Google's 304px width */}
          <div 
            ref={containerRef} 
            className={`w-[304px] overflow-hidden rounded-xl border border-slate-200 shadow-xs flex justify-center transition-opacity duration-200 ${
              isScriptLoading ? 'opacity-0 h-0' : 'opacity-100'
            }`} 
          />
        </div>

        {/* Footer */}
        <div className="py-2.5 px-4 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span className="text-[10px]">PHINMA SJC Facilities</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}