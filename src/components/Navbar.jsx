import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Layers, Package, Shield } from 'lucide-react';

export default function Navbar({ user, isDesktopView = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const isPcMode = isAdmin && isDesktopView;

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      adminOnly: false
    },
    {
      to: '/rooms',
      label: 'Rooms',
      icon: Layers,
      adminOnly: false
    },
    {
      to: '/supplies',
      label: 'Inventory',
      icon: Package,
      adminOnly: false
    },
    {
      to: '/admin',
      label: 'Admin',
      icon: Shield,
      adminOnly: true
    }
  ];

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  // Exact matching: activeIndex stays -1 when on /profile or subpages
  const activeIndex = visibleItems.findIndex(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  );
  const isCurrentAdmin = activeIndex !== -1 && visibleItems[activeIndex]?.to === '/admin';

  // -------------------------------------------------------------
  // INTENTIONAL DRAG DETECTION (8px Threshold)
  // -------------------------------------------------------------
  const navRef = useRef(null);
  const pointerStartRef = useRef(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(null);
  const lastIndexRef = useRef(activeIndex);

  useEffect(() => {
    lastIndexRef.current = activeIndex;
  }, [activeIndex]);

  const updateScrub = (clientX) => {
    if (!navRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    const N = visibleItems.length;
    const relX = clientX - rect.left;
    const t = Math.max(0, Math.min(1, relX / rect.width));

    const targetIndex = Math.min(N - 1, Math.max(0, Math.floor(t * N)));

    const w = 1 / N;
    const leftFrac = Math.max(0, Math.min(1 - w, t - w / 2));
    const unitPos = leftFrac * N;
    setScrubPosition(unitPos);

    if (targetIndex !== lastIndexRef.current && targetIndex >= 0 && targetIndex < N) {
      lastIndexRef.current = targetIndex;
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(12);
        } catch (_) {}
      }
      navigate(visibleItems[targetIndex].to);
    }
  };

  const handlePointerDown = (e) => {
    // Record start coordinate; do NOT lock into scrubbing yet
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId
    };
  };

  const handlePointerMove = (e) => {
    if (!pointerStartRef.current) return;

    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);

    // Only engage dragging if movement exceeds 8px horizontally
    if (!isScrubbing) {
      if (dx > 8 && dx > dy) {
        setIsScrubbing(true);
        try {
          e.currentTarget.setPointerCapture(pointerStartRef.current.pointerId);
        } catch (_) {}
        updateScrub(e.clientX);
      }
    } else {
      updateScrub(e.clientX);
    }
  };

  const handlePointerUp = (e) => {
    if (isScrubbing) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setIsScrubbing(false);
      setScrubPosition(null);
    }
    pointerStartRef.current = null;
  };

  // Determine indicator position
  const effectiveOffset = isScrubbing && scrubPosition !== null
    ? scrubPosition
    : activeIndex !== -1
    ? activeIndex
    : 0;

  // =========================================================================
  // 1. ADMIN PC MODE: Floating Island Pill
  // =========================================================================
  if (isPcMode) {
    return (
      <div className="fixed bottom-6 inset-x-0 z-50 pointer-events-none flex justify-center px-4 animate-sheet-up select-none">
        <nav
          ref={navRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none' }}
          className="pointer-events-auto relative bg-white/95 backdrop-blur-md border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.12)] rounded-full p-1.5 flex items-center animate-pop"
        >
          {/* Gliding Background Pill */}
          <div
            className={`absolute top-1.5 bottom-1.5 rounded-full shadow-xs pointer-events-none z-0 ${
              activeIndex === -1 && !isScrubbing
                ? 'opacity-0 scale-95'
                : isCurrentAdmin
                ? 'bg-amber-600 opacity-100'
                : 'bg-[#176e57] opacity-100'
            }`}
            style={{
              width: `calc((100% - 12px) / ${visibleItems.length})`,
              left: '6px',
              transform: `translateX(${effectiveOffset * 100}%)`,
              transition: isScrubbing ? 'none' : 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.25s ease'
            }}
          />

          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            const isItemAdmin = item.to === '/admin';

            return (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                className={`relative z-10 flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold transition-colors duration-150 active:scale-95 flex-1 min-w-[100px] outline-none ${
                  isActive
                    ? 'text-white'
                    : isItemAdmin
                    ? 'text-slate-400 hover:text-amber-600'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // =========================================================================
  // 2. MOBILE PHONE NAVBAR: Docked Bottom Bar (Clean tap & drag support)
  // =========================================================================
  return (
    <nav
      ref={navRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] z-30 select-none"
    >
      {/* Sliding Top Indicator Line */}
      {(activeIndex !== -1 || isScrubbing) && (
        <div
          className="absolute top-0 left-0 h-1 flex justify-center pointer-events-none"
          style={{
            width: `${100 / visibleItems.length}%`,
            transform: `translateX(${effectiveOffset * 100}%)`,
            transition: isScrubbing ? 'none' : 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <span
            className={`rounded-b-full shadow-xs transition-all duration-200 ${
              isScrubbing ? 'w-12 h-1.5 shadow-md' : 'w-9 h-1'
            } ${
              isCurrentAdmin
                ? 'bg-amber-600 shadow-amber-200'
                : 'bg-[#176e57] shadow-emerald-200'
            }`}
          />
        </div>
      )}

      {/* Nav Tab Items */}
      <div className={`grid ${visibleItems.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} h-16`}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          const isItemAdmin = item.to === '/admin';

          return (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className={`relative flex flex-col items-center justify-center h-full w-full py-1 active:scale-95 transition-all duration-150 select-none outline-none ${
                isActive
                  ? isItemAdmin
                    ? 'text-amber-700 font-bold'
                    : 'text-[#176e57] font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-0.5 transition-all duration-200 ${
                  isActive ? 'scale-110' : 'scale-100'
                } ${
                  isActive && isItemAdmin
                    ? 'text-amber-600'
                    : isActive
                    ? 'text-[#176e57]'
                    : 'text-slate-400'
                }`}
              />
              <span className="text-[11px] leading-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}