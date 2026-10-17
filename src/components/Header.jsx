import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import sjcLogo from '../assets/Logo.jpg';
import { User, LogOut, AlertTriangle } from 'lucide-react';

export default function Header({ title, user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const isProfilePage = location.pathname === '/profile';

  const animationsDisabled = localStorage.getItem('sjc_animations_disabled') === 'true';
  const displayName = user?.name ? user.name.split(' ')[0] : 'Profile';

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <>
      <header className="bg-[#176e57] text-white p-4 shadow-sm flex justify-between items-center z-30 sticky top-0 border-b border-emerald-700/60">
        
        {/* Left: Crest & Title */}
        <div 
          onClick={() => navigate('/dashboard')}
          className={`flex items-center gap-2.5 cursor-pointer active:scale-95 transition ${
            !animationsDisabled ? 'animate-header-left' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs overflow-hidden flex-shrink-0">
            <img
              src={sjcLogo}
              alt="PHINMA SJC"
              className="w-full h-full object-contain pointer-events-none rounded-lg"
            />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">
              {title || 'PHINMA SJC'}
            </h1>
            <p className="text-[10px] text-emerald-100 leading-tight">
              Campus Operations Tracker
            </p>
          </div>
        </div>

        {/* Right: Profile & Quick Sign Out */}
        <div className={`flex items-center gap-2 ${
          !animationsDisabled ? 'animate-header-right' : ''
        }`}>
          <button
            type="button"
            onClick={() => navigate(isProfilePage ? '/dashboard' : '/profile')}
            title="My Profile & Security"
            className={`p-2 rounded-xl transition active:scale-90 flex items-center gap-1.5 text-xs font-semibold ${
              isProfilePage
                ? 'bg-white text-[#176e57] shadow-xs'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="max-w-[95px] truncate">{displayName}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            title="Sign Out"
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-600/80 hover:text-white text-emerald-100 transition active:scale-90"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Confirmation Modal */}
      {showLogoutConfirm && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop text-slate-800 select-none"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div 
            className="bg-white w-full max-w-xs rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-sheet-up text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-800">
                Log Out of Session?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to end your active shift, <strong>{user?.name}</strong>?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}