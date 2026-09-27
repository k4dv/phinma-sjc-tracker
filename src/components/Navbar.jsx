import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Layers, Package, Shield } from 'lucide-react';

export default function Navbar({ user }) {
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  const navItems = [
    {
      to: '/dashboard',
      label: 'Home',
      icon: Home,
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
      label: 'Supplies',
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

  // Find active index based on current URL path
  const matchedIndex = visibleItems.findIndex(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  );
  const activeIndex = matchedIndex === -1 ? 0 : matchedIndex;
  const isCurrentAdmin = visibleItems[activeIndex]?.to === '/admin';

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] z-30">
      
      {/* 
        SMOOTH SLIDING TOP INDICATOR
        Glides horizontally across the navbar to the active tab's position
      */}
      <div
        className="absolute top-0 left-0 h-1 flex justify-center pointer-events-none"
        style={{
          width: `${100 / visibleItems.length}%`,
          transform: `translateX(${activeIndex * 100}%)`,
          transition: 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <span
          className={`w-9 h-1 rounded-b-full shadow-xs transition-colors duration-300 ${
            isCurrentAdmin ? 'bg-amber-600 shadow-amber-200' : 'bg-[#176e57] shadow-emerald-200'
          }`}
        />
      </div>

      {/* Nav Tab Items */}
      <div className={`grid ${visibleItems.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} h-16`}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isItemAdmin = item.to === '/admin';

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center h-full w-full py-1 active:scale-95 transition-all duration-150 select-none ${
                  isActive
                    ? isItemAdmin
                      ? 'text-amber-700 font-bold'
                      : 'text-[#176e57] font-bold'
                    : 'text-slate-400 hover:text-slate-600 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
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
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}