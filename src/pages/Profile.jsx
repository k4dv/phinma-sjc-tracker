import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../data/supabaseClient';
import { 
  User, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Smartphone, 
  LogOut, 
  Building2, 
  Check, 
  ArrowLeft,
  Sparkles,
  Zap,
  ChevronDown,
  Camera,
  Trash2
} from 'lucide-react';

export default function Profile({ user, onLogout, assignments = {} }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('sjc_theme');
  }, []);

  const [openSections, setOpenSections] = useState({
    experience: false,
    security: false,
    devices: false
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [avatar, setAvatar] = useState(() => {
    const key = `sjc_avatar_${user?.id || 'default'}`;
    return localStorage.getItem(key) || '';
  });

  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    return localStorage.getItem('sjc_animations_disabled') !== 'true';
  });

  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Sync avatar from Supabase on mount
  useEffect(() => {
    if (!user?.id) return;
    const loadCloudAvatar = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('avatar')
          .eq('id', String(user.id))
          .single();

        if (data?.avatar) {
          setAvatar(data.avatar);
          localStorage.setItem(`sjc_avatar_${user.id}`, data.avatar);
        }
      } catch (err) {
        console.error('Error fetching cloud avatar:', err);
      }
    };
    loadCloudAvatar();
  }, [user?.id]);

  // Compress photo down to ~25KB thumbnail so it syncs fast and fits quotas
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedBase64 = await compressImage(file);
      setAvatar(compressedBase64);
      const storageKey = `sjc_avatar_${user?.id || 'default'}`;
      localStorage.setItem(storageKey, compressedBase64);

      // Save to Supabase so it syncs across all devices & shows in Admin
      if (user?.id) {
        await supabase
          .from('profiles')
          .upsert({ 
            id: String(user.id), 
            avatar: compressedBase64, 
            updated_at: new Date().toISOString() 
          });
      }

      setSuccessMsg('Profile picture updated and synced everywhere!');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Image compression error:', err);
      setErrorMsg('Failed to process image. Please try another file.');
      setTimeout(() => setErrorMsg(''), 3500);
    }
  };

  const handleRemoveAvatar = async (e) => {
    e.stopPropagation();
    setAvatar('');
    localStorage.removeItem(`sjc_avatar_${user?.id || 'default'}`);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (user?.id) {
      try {
        await supabase.from('profiles').update({ avatar: null }).eq('id', String(user.id));
      } catch (err) {
        console.error('Error removing cloud avatar:', err);
      }
    }

    setSuccessMsg('Profile picture reset to default avatar.');
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handleToggleAnimations = () => {
    const nextState = !animationsEnabled;
    setAnimationsEnabled(nextState);

    if (nextState) {
      localStorage.removeItem('sjc_animations_disabled');
      localStorage.removeItem('sjc_quick_login');
      document.body.classList.remove('disable-animations');
      setSuccessMsg('Presentation Mode active: Entrance animations enabled.');
    } else {
      localStorage.setItem('sjc_animations_disabled', 'true');
      localStorage.setItem('sjc_quick_login', 'true');
      document.body.classList.add('disable-animations');
      setSuccessMsg('Fast Shift Mode active: Instant viewports enabled.');
    }
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const staffFloor = Object.entries(assignments).find(([_, staffId]) => staffId === user?.id)?.[0] || 'Unassigned';

  const getStoredPassword = () => {
    const custom = localStorage.getItem(`sjc_pass_${user?.id}`);
    if (custom) return custom;
    return user?.id === 'admin' ? 'admin123' : 'password123';
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const actualCurrentPass = getStoredPassword();

    if (currentPassInput !== actualCurrentPass) {
      setErrorMsg('Current password does not match.');
      setTimeout(() => setErrorMsg(''), 3500);
      return;
    }

    if (newPassInput.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      setTimeout(() => setErrorMsg(''), 3500);
      return;
    }

    if (newPassInput !== confirmPassInput) {
      setErrorMsg('New passwords do not match.');
      setTimeout(() => setErrorMsg(''), 3500);
      return;
    }

    setIsUpdating(true);
    setTimeout(() => {
      localStorage.setItem(`sjc_pass_${user?.id}`, newPassInput);
      setIsUpdating(false);
      setSuccessMsg('Password successfully updated!');
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setTimeout(() => setSuccessMsg(''), 3500);
    }, 400);
  };

  const handleClearDeviceTrust = () => {
    localStorage.removeItem('sjc_trusted_devices');
    setSuccessMsg('Trusted device sessions cleared. 2FA required on next login.');
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  return (
    <div className="p-4 space-y-3.5 pb-28 text-slate-800">
      
      {/* Toast Keyframe Styles */}
      <style>{`
        @keyframes toastFadeInOut {
          0% {
            opacity: 0;
            transform: translateY(-12px) scale(0.96);
          }
          10% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          85% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-8px) scale(0.97);
          }
        }
        .animate-toast-smooth {
          animation: toastFadeInOut 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Floating Success Notification */}
      {successMsg && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-20 inset-x-0 z-[150] max-w-sm mx-auto px-4 pointer-events-none animate-toast-smooth select-none">
          <div className="pointer-events-auto p-3 bg-emerald-50/95 backdrop-blur-sm border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2.5 shadow-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{successMsg}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Error Notification */}
      {errorMsg && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-20 inset-x-0 z-[150] max-w-sm mx-auto px-4 pointer-events-none animate-toast-smooth select-none">
          <div className="pointer-events-auto p-3 bg-rose-50/95 backdrop-blur-sm border border-rose-300 text-rose-800 text-xs font-semibold rounded-2xl flex items-center gap-2.5 shadow-xl animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{errorMsg}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Hidden File Picker */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleAvatarSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#176e57] transition active:scale-95"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Dashboard</span>
      </button>

      {/* User Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-4">
          <div className="relative group flex-shrink-0">
            <div 
              onClick={() => fileInputRef.current?.click()}
              title="Tap to change photo"
              className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-2xl shadow-inner cursor-pointer overflow-hidden border-2 transition active:scale-95 ${
                avatar 
                  ? 'border-emerald-500/40 bg-slate-900' 
                  : 'bg-emerald-100 text-[#176e57] border-emerald-300/60'
              }`}
            >
              {avatar ? (
                <img 
                  src={avatar} 
                  alt={user?.name} 
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <span>{user?.name?.[0] || 'U'}</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo"
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#176e57] text-white shadow-md hover:bg-[#135c49] active:scale-90 transition border-2 border-white"
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-slate-800 truncate">
                {user?.name}
              </h2>
              {user?.role === 'admin' ? (
                <span className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-md">
                  Admin
                </span>
              ) : (
                <span className="text-[9px] font-bold bg-emerald-100 text-[#176e57] border border-emerald-300 px-1.5 py-0.5 rounded-md">
                  Staff
                </span>
              )}
            </div>
            
            <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {user?.id}</p>
            
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Assigned: Floor {staffFloor}</span>
            </p>
          </div>
        </div>

        {avatar && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="text-[11px] text-rose-500 hover:text-rose-600 flex items-center gap-1 font-medium transition active:scale-95"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove photo</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. EXPERIENCE & PRESENTATION MODE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('experience')}
          className="w-full p-4 flex items-center justify-between text-left active:bg-slate-50 transition"
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${
              animationsEnabled ? 'bg-emerald-50 text-[#176e57]' : 'bg-amber-50 text-amber-700'
            }`}>
              {animationsEnabled ? <Sparkles className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Experience
              </h3>
              <p className="text-[10px] text-slate-400">
                Control entrance animations and login curtain
              </p>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            openSections.experience ? 'rotate-180' : ''
          }`} />
        </button>

        {openSections.experience && (
          <div className="px-4 pb-4 pt-1 border-t border-slate-100 animate-sheet-up">
            <div 
              onClick={handleToggleAnimations}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 cursor-pointer select-none active:scale-[0.99] transition mt-2"
            >
              <div className="pr-3">
                <span className="text-xs font-bold text-slate-800 block">
                  {animationsEnabled ? 'Animation & Effect (ON)' : 'Fast Shift Mode (OFF)'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {animationsEnabled 
                    ? 'Plays campus entrance, 2-spin logo wheel, and card reveals.'
                    : 'Instantly opens the dashboard with zero delays.'}
                </span>
              </div>

              <div className={`w-11 h-6 rounded-full transition-colors duration-200 p-0.5 flex items-center flex-shrink-0 ${
                animationsEnabled ? 'bg-[#176e57]' : 'bg-slate-300'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                  animationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. SECURITY & PASSWORD */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('security')}
          className="w-full p-4 flex items-center justify-between text-left active:bg-slate-50 transition"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-[#176e57] rounded-xl">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Security & Password
              </h3>
              <p className="text-[10px] text-slate-400">
                Change your portal password
              </p>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            openSections.security ? 'rotate-180' : ''
          }`} />
        </button>

        {openSections.security && (
          <div className="p-4 pt-3 border-t border-slate-100 animate-sheet-up">
            <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Current Password:
                </label>
                <input
                  type="password"
                  required
                  value={currentPassInput}
                  onChange={(e) => setCurrentPassInput(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-[#176e57]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  New Password (min 6 chars):
                </label>
                <input
                  type="password"
                  required
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-[#176e57]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Confirm New Password:
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-[#176e57]"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isUpdating ? 'Saving...' : 'Update Password'}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 3. TWO-FACTOR TRUSTED DEVICES */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('devices')}
          className="w-full p-4 flex items-center justify-between text-left active:bg-slate-50 transition"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Two-Factor Trusted Devices
              </h3>
              <p className="text-[10px] text-slate-400">
                Manage 30-day remembered browser sessions
              </p>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            openSections.devices ? 'rotate-180' : ''
          }`} />
        </button>

        {openSections.devices && (
          <div className="p-4 pt-3 border-t border-slate-100 animate-sheet-up">
            <button
              type="button"
              onClick={handleClearDeviceTrust}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-[0.98] font-bold rounded-xl transition text-xs border border-slate-200"
            >
              Forget All Trusted Devices
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowLogoutConfirm(true)}
        className="w-full py-3 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-700 border border-rose-200 font-bold rounded-2xl transition text-xs flex items-center justify-center gap-2 shadow-xs"
      >
        <LogOut className="w-4 h-4 text-rose-600" />
        <span>Log Out of Session</span>
      </button>

      {showLogoutConfirm && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop text-slate-800 select-none"
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
                End active session for <strong>{user?.name}</strong>?
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
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}