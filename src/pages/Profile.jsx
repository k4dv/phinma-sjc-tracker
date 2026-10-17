import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../data/supabaseClient';
import { hashPassword } from '../utils/security';
import { 
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
  Trash2,
  Monitor,
  Eye,
  EyeOff
} from 'lucide-react';

export default function Profile({ 
  user, 
  onLogout, 
  assignments = {}, 
  isDesktopView = false, 
  onToggleDesktopView 
}) {
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

  // Password Input States
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');

  // Password Peeking States
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

      if (user?.id) {
        await supabase
          .from('profiles')
          .upsert({ 
            id: String(user.id), 
            avatar: compressedBase64, 
            updated_at: new Date().toISOString() 
          });
      }

      setSuccessMsg('Profile picture updated!');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch {
      setErrorMsg('Failed to process image. Try another file.');
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

    setSuccessMsg('Profile picture reset.');
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handleToggleAnimations = () => {
    const nextState = !animationsEnabled;
    setAnimationsEnabled(nextState);

    if (nextState) {
      localStorage.removeItem('sjc_animations_disabled');
      localStorage.removeItem('sjc_quick_login');
      document.body.classList.remove('disable-animations');
      setSuccessMsg('Presentation Mode: Entrance animations enabled.');
    } else {
      localStorage.setItem('sjc_animations_disabled', 'true');
      localStorage.setItem('sjc_quick_login', 'true');
      document.body.classList.add('disable-animations');
      setSuccessMsg('Fast Shift Mode: Instant views enabled.');
    }
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const staffFloor = Object.entries(assignments).find(([_, staffId]) => {
    if (Array.isArray(staffId)) return staffId.includes(user?.id);
    return staffId === user?.id;
  })?.[0] || 'Unassigned';

  // SECURE PASSWORD CHANGE HANDLER
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanCurrent = currentPassInput.trim();
    const cleanNew = newPassInput.trim();
    const cleanConfirm = confirmPassInput.trim();

    if (cleanNew.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      setTimeout(() => setErrorMsg(''), 3500);
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setErrorMsg('New password and confirmation do not match.');
      setTimeout(() => setErrorMsg(''), 3500);
      return;
    }

    setIsUpdating(true);

    try {
      const cleanId = String(user?.id || '').trim();
      const cleanLower = cleanId.toLowerCase();
      const enteredCurrentHash = await hashPassword(cleanCurrent);

      // 1. Fetch current profile from database
      const { data: dbUser, error: dbErr } = await supabase
        .from('profiles')
        .select('id, email, password, auth_user_id')
        .ilike('id', cleanId)
        .maybeSingle();

      if (dbErr || !dbUser) {
        setErrorMsg('User profile record not found.');
        setIsUpdating(false);
        setTimeout(() => setErrorMsg(''), 3500);
        return;
      }

      let isCurrentValid = false;

      // 2. Validate current password against Supabase Auth (if linked) or database
      if (dbUser.auth_user_id && dbUser.email) {
        try {
          const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: dbUser.email,
            password: cleanCurrent
          });
          if (!authErr && authData?.user) {
            isCurrentValid = true;
          }
        } catch (_) {}
      }

      if (!isCurrentValid) {
        const storedCustomHash = localStorage.getItem(`sjc_pass_hash_${cleanLower}`);
        isCurrentValid = (storedCustomHash && storedCustomHash === enteredCurrentHash) || 
                         (dbUser.password && dbUser.password === cleanCurrent);
      }

      if (!isCurrentValid) {
        setErrorMsg('Current password does not match.');
        setIsUpdating(false);
        setTimeout(() => setErrorMsg(''), 3500);
        return;
      }

      // 3. Update Supabase Auth if linked
      if (dbUser.auth_user_id) {
        try {
          await supabase.auth.updateUser({ password: cleanNew });
        } catch (authUpdateErr) {
          console.warn('Auth password update notice:', authUpdateErr);
        }
      }

      // 4. Update the 'password' column in public.profiles (NO non-existent password_hash column)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          password: cleanNew,
          is_first_login: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', dbUser.id);

      if (updateError) throw updateError;

      // 5. Update local hash cache
      const newHash = await hashPassword(cleanNew);
      localStorage.setItem(`sjc_pass_hash_${cleanLower}`, newHash);
      localStorage.removeItem(`sjc_pass_${cleanLower}`);

      setIsUpdating(false);
      setSuccessMsg('Password successfully updated!');
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Password change error:', err);
      setIsUpdating(false);
      setErrorMsg(err.message || 'Failed to update password. Please try again.');
      setTimeout(() => setErrorMsg(''), 3500);
    }
  };

  const handleClearDeviceTrust = () => {
    localStorage.removeItem('sjc_trusted_devices');
    setSuccessMsg('Trusted device sessions cleared. 2FA required on next login.');
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  return (
    <div className="p-4 space-y-3.5 pb-28 text-slate-800 max-w-md mx-auto">
      
      {/* Toast Notifications */}
      {successMsg && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-20 inset-x-0 z-[150] max-w-sm mx-auto px-4 pointer-events-none animate-toast select-none">
          <div className="pointer-events-auto p-3.5 bg-emerald-50/95 backdrop-blur-sm border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-3xl flex items-center gap-2.5 shadow-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{successMsg}</span>
          </div>
        </div>,
        document.body
      )}

      {errorMsg && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-20 inset-x-0 z-[150] max-w-sm mx-auto px-4 pointer-events-none animate-toast select-none">
          <div className="pointer-events-auto p-3.5 bg-rose-50/95 backdrop-blur-sm border border-rose-300 text-rose-800 text-xs font-semibold rounded-3xl flex items-center gap-2.5 shadow-xl animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{errorMsg}</span>
          </div>
        </div>,
        document.body
      )}

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

      {/* User Info Card */}
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
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove photo</span>
            </button>
          </div>
        )}
      </div>

      {/* Admin PC Mode Toggle Card */}
      {user?.role === 'admin' && onToggleDesktopView && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="w-full p-4 flex items-center justify-between text-left">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-[#176e57] flex-shrink-0">
                {isDesktopView ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide truncate">
                  {isDesktopView ? 'Switch to Mobile View' : 'Switch to PC Widescreen Mode'}
                </h3>
                <p className="text-[10px] text-slate-400 truncate">
                  {isDesktopView ? 'Return app to mobile container (448px)' : 'Unfold app across widescreen desktop monitors'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleDesktopView}
              className="px-3.5 py-1.5 rounded-xl bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 flex-shrink-0"
            >
              {isDesktopView ? (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Phone View</span>
                </>
              ) : (
                <>
                  <Monitor className="w-3.5 h-3.5" />
                  <span>PC View</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Experience Accordion */}
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

      {/* Security & Password Form */}
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
              
              {/* Current Password Field */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Current Password:
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassInput}
                    onChange={(e) => setCurrentPassInput(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-[#176e57]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                    title={showCurrentPass ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  New Password (min 6 chars):
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassInput}
                    onChange={(e) => setNewPassInput(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-[#176e57]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                    title={showNewPass ? 'Hide password' : 'Show password'}
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Confirm New Password:
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    value={confirmPassInput}
                    onChange={(e) => setConfirmPassInput(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-[#176e57]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                    title={showConfirmPass ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-80"
              >
                <Check className="w-4 h-4" />
                <span>{isUpdating ? 'Saving...' : 'Update Password'}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Two-Factor Trusted Devices */}
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

      {/* Log Out */}
      <button
        type="button"
        onClick={() => setShowLogoutConfirm(true)}
        className="w-full py-3 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-700 border border-rose-200 font-bold rounded-2xl transition text-xs flex items-center justify-center gap-2 shadow-xs"
      >
        <LogOut className="w-4 h-4 text-rose-600" />
        <span>Log Out of Session</span>
      </button>

      {/* Logout Confirmation Dialog */}
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
                End active custodial session for <strong>{user?.name}</strong>?
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