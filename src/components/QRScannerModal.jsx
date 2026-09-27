import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, ArrowRight } from 'lucide-react';

export default function QRScannerModal({ isOpen, onClose, onScanSuccess, allRoomIds = [] }) {
  const [errorMsg, setErrorMsg] = useState('');
  const [manualRoomInput, setManualRoomInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef(null);

  // Helper to extract room ID from a raw number ("101") or URL (".../door?room=101")
  const parseScannedData = (text) => {
    if (!text) return null;
    const cleanText = text.trim();

    if (cleanText.includes('?room=')) {
      try {
        const url = new URL(cleanText);
        return url.searchParams.get('room');
      } catch {
        const match = cleanText.match(/[?&]room=([^&#]*)/);
        if (match) return match[1];
      }
    }

    return cleanText;
  };

  const handleValidRoomHit = (scannedRoomId) => {
    if (allRoomIds.length > 0 && !allRoomIds.includes(String(scannedRoomId))) {
      setErrorMsg(`Room "${scannedRoomId}" is not in the Dimasalang floor registry.`);
      return;
    }

    // Instant haptic vibration feedback on successful scan
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([40, 30, 40]);
    }

    stopScanner();
    onClose();
    onScanSuccess(scannedRoomId);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Scanner stop notice:', err);
      }
      scannerRef.current = null;
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (isOpen) {
      setErrorMsg('');
      setManualRoomInput('');

      const timer = setTimeout(async () => {
        try {
          // Hardware-accelerated native barcode engine enabled for speed
          const html5QrCode = new Html5Qrcode('qr-reader-container', {
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true
            },
            verbose: false
          });
          scannerRef.current = html5QrCode;

          // High-performance 24 FPS scanning with rear camera priority
          const qrConfig = {
            fps: 24,
            aspectRatio: 1.0,
            qrbox: { width: 230, height: 230 }
          };

          await html5QrCode.start(
            { facingMode: 'environment' },
            qrConfig,
            (decodedText) => {
              const matchedRoom = parseScannedData(decodedText);
              if (matchedRoom) {
                handleValidRoomHit(matchedRoom);
              }
            },
            () => {
              // Frame dropped without QR code - keep searching smoothly
            }
          );

          if (isMounted) setIsCameraActive(true);
        } catch (err) {
          console.error('Camera initialization error:', err);
          if (isMounted) {
            setErrorMsg('Camera access blocked or unsupported. Use manual code below.');
          }
        }
      }, 180);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualRoomInput.trim()) return;
    handleValidRoomHit(manualRoomInput.trim());
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
      onClick={() => {
        stopScanner();
        onClose();
      }}
    >
      <style>{`
        #qr-reader-container {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          padding: 0 !important;
          position: relative !important;
        }
        #qr-reader-container video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1rem !important;
          display: block !important;
        }
        #qr-reader-container canvas {
          display: none !important;
        }
        #qr-reader-container__scan_region {
          min-height: auto !important;
        }
      `}</style>

      <div 
        className="bg-white w-full max-w-sm rounded-3xl p-4 shadow-2xl border border-slate-100 space-y-3.5 animate-sheet-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 text-[#176e57] rounded-xl">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Scan Room QR
              </h3>
              <p className="text-[10px] text-slate-400">
                Point at any Dimasalang door placard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative w-full aspect-square bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200">
          <div id="qr-reader-container" className="w-full h-full" />
          
          {isCameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-52 h-52 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(52,211,153,0.25)]">
                <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br-lg" />
                
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse" />
              </div>
            </div>
          )}

          {!isCameraActive && !errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 space-y-2 bg-slate-950 text-center">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-300">Activating camera feed...</p>
            </div>
          )}
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span className="text-[11px] leading-snug">{errorMsg}</span>
          </div>
        )}

        {/* Manual Fallback */}
        <form onSubmit={handleManualSubmit} className="space-y-1 pt-1 border-t border-slate-100">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Or type room number manually
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualRoomInput}
              onChange={(e) => setManualRoomInput(e.target.value)}
              placeholder="e.g. 101, 203, 705"
              className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#176e57] bg-slate-50 font-mono font-semibold"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
            >
              <span>Go</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}