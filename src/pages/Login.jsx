import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import sjcLogo from '../assets/Logo.jpg';
import schoolBg from '../assets/School.jpg';
import CaptchaModal from '../components/CaptchaModal';
import { supabase } from '../data/supabaseClient';
import { hashPassword, sanitizeUser, validatePasswordStrength } from '../utils/security';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  X,
  AlertCircle, 
  AlertTriangle,
  ShieldAlert, 
  ShieldCheck, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  Loader2, 
  Smartphone, 
  KeyRound,
  Mail,
  ShieldAlert as ShieldIcon
} from 'lucide-react';

const EMAILJS_SERVICE_ID = 'service_0od3tyo';
const EMAILJS_TEMPLATE_ID = 'template_cwipfdc';
const EMAILJS_PUBLIC_KEY = 'SKoJDpKyhviN9MWEQ';

const TRUST_DURATION_DAYS = 30;

// Formats raw digits into 000-000 pattern
const formatOtpWithHyphen = (val = '') => {
  const digits = String(val).replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
};

const isDeviceTrustedForAccount = (accountId) => {
  try {
    const raw = localStorage.getItem('sjc_trusted_devices');
    if (!raw) return false;
    const trustedMap = JSON.parse(raw);
    const expiresAt = trustedMap[accountId];
    if (!expiresAt) return false;

    if (Date.now() > expiresAt) {
      delete trustedMap[accountId];
      localStorage.setItem('sjc_trusted_devices', JSON.stringify(trustedMap));
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const saveDeviceTrustForAccount = (accountId) => {
  try {
    const raw = localStorage.getItem('sjc_trusted_devices');
    const trustedMap = raw ? JSON.parse(raw) : {};
    trustedMap[accountId] = Date.now() + TRUST_DURATION_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem('sjc_trusted_devices', JSON.stringify(trustedMap));
  } catch (err) {
    console.error('Failed to save device trust:', err);
  }
};

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return 's••••f@phinmaed.com';
  const [username, domain] = email.split('@');
  if (username.length <= 2) return `${username[0]}••••@${domain}`;
  const firstChar = username[0];
  const lastChar = username[username.length - 1];
  return `${firstChar}••••${lastChar}@${domain}`;
};

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [loginMode, setLoginMode] = useState('staff'); // 'staff' | 'admin'

  const [staffId, setStaffId] = useState(() => {
    return localStorage.getItem('sjc_remembered_staff_id') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [rememberMe, setRememberMe] = useState(() => {
    return Boolean(localStorage.getItem('sjc_remembered_staff_id'));
  });

  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [stagedUser, setStagedUser] = useState(null);

  const [errorMsg, setErrorMsg] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  
  const [tapCount, setTapCount] = useState(0);
  const [showAdminToast, setShowAdminToast] = useState(false);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);

  // 2FA States
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [displayedMaskedEmail, setDisplayedMaskedEmail] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpErrorKey, setOtpErrorKey] = useState(0);
  const [resendTimer, setResendTimer] = useState(30);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentAlert, setEmailSentAlert] = useState(false);
  const [trustThisDevice, setTrustThisDevice] = useState(true);

  // First-Time Setup States
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);
  const [firstLoginOtpInput, setFirstLoginOtpInput] = useState('');
  const [firstLoginNewPass, setFirstLoginNewPass] = useState('');
  const [firstLoginConfirmPass, setFirstLoginConfirmPass] = useState('');
  const [showFirstNewPass, setShowFirstNewPass] = useState(false);
  const [showFirstConfirmPass, setShowFirstConfirmPass] = useState(false);
  const [firstLoginError, setFirstLoginError] = useState('');
  const [isSavingFirstPass, setIsSavingFirstPass] = useState(false);

  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotOtpInput, setForgotOtpInput] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotFoundUser, setForgotFoundUser] = useState(null);
  const [isForgotSending, setIsForgotSending] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  useEffect(() => {
    let interval = null;
    if ((showTwoFactor || showFirstLoginModal) && resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [showTwoFactor, showFirstLoginModal, resendTimer]);

  // Hidden 5-tap toggle (No automatic username prefill)
  const handleLogoTap = () => {
    const nextTaps = tapCount + 1;
    if (nextTaps >= 5) {
      const nextMode = loginMode === 'staff' ? 'admin' : 'staff';
      setLoginMode(nextMode);
      setStaffId('');
      setPassword('');
      setTapCount(0);
      setShowAdminToast(true);
      setTimeout(() => setShowAdminToast(false), 3800);
    } else {
      setTapCount(nextTaps);
    }
  };

  const dispatchOtp = async (userObj, targetEmailDisplay, isRecovery = false) => {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const destinationEmail = userObj.email || `${String(userObj.id).toLowerCase()}@phinmaed.com`;

    if (isRecovery) {
      setForgotOtp(newOtp);
      setIsForgotSending(true);
    } else {
      setGeneratedOtp(newOtp);
      setIsSendingEmail(true);
    }

    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            email: destinationEmail,
            to_email: destinationEmail,
            staff_name: isRecovery ? `${userObj.name} (Password Reset)` : userObj.name,
            passcode: newOtp,
            time: currentTime,
            displayed_email: targetEmailDisplay
          }
        })
      });

      if (response.ok && !isRecovery) {
        setEmailSentAlert(true);
        setTimeout(() => setEmailSentAlert(false), 4200);
      }
    } catch (err) {
      console.error('Failed to dispatch verification email:', err);
    } finally {
      if (isRecovery) setIsForgotSending(false);
      else setIsSendingEmail(false);
    }
  };

  // SECURE AUTHENTICATION HANDLER
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const now = Date.now();
    if (now - lastAttemptTime < 1000) return;
    setLastAttemptTime(now);

    setIsCheckingCredentials(true);
    const cleanId = staffId.trim();
    const cleanLower = cleanId.toLowerCase();

    try {
      const inputHash = await hashPassword(password);

      // 1. Query Supabase for the specific user entered
      const { data: dbUser, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('id', cleanId)
        .maybeSingle();

      if (error || !dbUser) {
        setErrorMsg('Invalid ID or password. Please verify your credentials.');
        setErrorKey((prev) => prev + 1);
        setIsCheckingCredentials(false);
        return;
      }

      const isUserAdmin = dbUser.role === 'admin' || Number(dbUser.access_level) >= 2;

      // 2. Strict portal separation based on actual account permissions
      if (loginMode === 'staff' && isUserAdmin) {
        setErrorMsg('Invalid ID or password. Please verify your credentials.');
        setErrorKey((prev) => prev + 1);
        setIsCheckingCredentials(false);
        return;
      }

      if (loginMode === 'admin' && !isUserAdmin) {
        setErrorMsg('Invalid ID or password. Please verify your credentials.');
        setErrorKey((prev) => prev + 1);
        setIsCheckingCredentials(false);
        return;
      }

      // 3. Credential verification
      let isValidPassword = false;

      if (dbUser.email) {
        try {
          const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: dbUser.email,
            password: password
          });

          if (!authErr && authData?.user) {
            isValidPassword = true;
          }
        } catch (_) {}
      }

      if (!isValidPassword) {
        const localHash = localStorage.getItem(`sjc_pass_hash_${cleanLower}`);
        const dbPass = dbUser.password;

        isValidPassword = (localHash && localHash === inputHash) ||
                          (dbPass && dbPass === password);
      }

      if (isValidPassword) {
        const isFirstLogin = Boolean(dbUser.is_first_login);

        const authenticatedUser = sanitizeUser({
          id: dbUser.id,
          name: dbUser.name || (isUserAdmin ? 'Facilities Supervisor' : 'Staff Member'),
          email: dbUser.email || null,
          role: dbUser.role || (isUserAdmin ? 'admin' : 'staff'),
          access_level: dbUser.access_level || (isUserAdmin ? 2 : 1),
          is_first_login: isFirstLogin,
          avatar: dbUser.avatar || null,
          auth_user_id: dbUser.auth_user_id || null
        });

        setStagedUser(authenticatedUser);
        setIsCheckingCredentials(false);
        setShowCaptchaModal(true);
        return;
      } else {
        setErrorMsg('Invalid ID or password. Please verify your credentials.');
        setErrorKey((prev) => prev + 1);
        setIsCheckingCredentials(false);
      }
    } catch (err) {
      console.warn('Authentication error:', err);
      setErrorMsg('Authentication service temporarily unavailable.');
      setErrorKey((prev) => prev + 1);
      setIsCheckingCredentials(false);
    }
  };

  const handleCaptchaSuccess = () => {
    setShowCaptchaModal(false);
    if (!stagedUser) return;

    if (rememberMe) {
      localStorage.setItem('sjc_remembered_staff_id', stagedUser.id);
    } else {
      localStorage.removeItem('sjc_remembered_staff_id');
    }

    const targetEmail = stagedUser.email || `${String(stagedUser.id).toLowerCase()}@phinmaed.com`;
    const masked = maskEmail(targetEmail);

    if (stagedUser.is_first_login) {
      setPendingUser(stagedUser);
      setDisplayedMaskedEmail(masked);
      setFirstLoginOtpInput('');
      setFirstLoginNewPass('');
      setFirstLoginConfirmPass('');
      setFirstLoginError('');
      setResendTimer(30);
      setShowFirstLoginModal(true);
      dispatchOtp(stagedUser, targetEmail, false);
      return;
    }

    if (isDeviceTrustedForAccount(stagedUser.id)) {
      onLoginSuccess(sanitizeUser(stagedUser), rememberMe);
      return;
    }

    setPendingUser(stagedUser);
    setDisplayedMaskedEmail(masked);
    setShowTwoFactor(true);
    setOtpInput(['', '', '', '', '', '']);
    setOtpError('');
    setResendTimer(30);

    dispatchOtp(stagedUser, targetEmail, false);
  };

  const handleOtpDigitChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    if (!clean && value !== '') return;

    if (clean.length > 1) {
      const digits = clean.slice(0, 6);
      const newOtp = ['', '', '', '', '', ''];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtpInput(newOtp);
      const focusIndex = Math.min(digits.length, 5);
      const nextInput = document.getElementById(`otp-${focusIndex}`);
      if (nextInput) nextInput.focus();
      return;
    }

    const newOtp = [...otpInput];
    newOtp[index] = clean.slice(-1);
    setOtpInput(newOtp);

    if (clean && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const cleanDigits = pasteData.replace(/\D/g, '').slice(0, 6);
    if (!cleanDigits) return;

    const newOtp = ['', '', '', '', '', ''];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = cleanDigits[i] || '';
    }
    setOtpInput(newOtp);

    const focusIndex = Math.min(cleanDigits.length, 5);
    const targetInput = document.getElementById(`otp-${focusIndex}`);
    if (targetInput) targetInput.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpInput[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const enteredCode = otpInput.join('');
    setIsVerifyingCode(true);

    setTimeout(() => {
      if (enteredCode === generatedOtp) {
        if (trustThisDevice && pendingUser?.id) {
          saveDeviceTrustForAccount(pendingUser.id);
        }

        if (rememberMe && pendingUser?.id) {
          localStorage.setItem('sjc_remembered_staff_id', pendingUser.id);
        } else {
          localStorage.removeItem('sjc_remembered_staff_id');
        }

        setIsVerifyingCode(false);

        if (pendingUser?.is_first_login) {
          setShowTwoFactor(false);
          setFirstLoginOtpInput(formatOtpWithHyphen(enteredCode));
          setFirstLoginNewPass('');
          setFirstLoginConfirmPass('');
          setFirstLoginError('');
          setShowFirstLoginModal(true);
        } else {
          onLoginSuccess(sanitizeUser(pendingUser), rememberMe);
        }
      } else {
        setOtpError('Invalid 6-digit security code. Please check your email and try again.');
        setOtpErrorKey((prev) => prev + 1);
        setIsVerifyingCode(false);
      }
    }, 300);
  };

  const handleSaveFirstLoginPassword = async (e) => {
    e.preventDefault();
    setFirstLoginError('');

    const rawOtpDigits = firstLoginOtpInput.replace(/\D/g, '');
    if (rawOtpDigits.length !== 6 || (generatedOtp && rawOtpDigits !== generatedOtp)) {
      setFirstLoginError('Invalid email OTP code. Please check the 6-digit code sent to your email.');
      return;
    }

    const complexity = validatePasswordStrength(firstLoginNewPass, pendingUser);

    if (!complexity.isValid) {
      setFirstLoginError(
        complexity.warningMessage ||
          'Password must include 1 lowercase, 1 uppercase, 1 number, 1 special character, and no personal/easy words.'
      );
      return;
    }

    if (firstLoginNewPass !== firstLoginConfirmPass) {
      setFirstLoginError('Confirmation password does not match.');
      return;
    }

    if (firstLoginNewPass === password) {
      setFirstLoginError('New password must be different from your temporary setup password.');
      return;
    }

    setIsSavingFirstPass(true);

    try {
      const newHash = await hashPassword(firstLoginNewPass);

      if (pendingUser?.auth_user_id) {
        try {
          await supabase.auth.updateUser({ password: firstLoginNewPass });
        } catch (_) {}
      }

      const { error: dbUpdateErr } = await supabase
        .from('profiles')
        .update({
          password: firstLoginNewPass,
          is_first_login: false
        })
        .eq('id', pendingUser.id);

      if (dbUpdateErr) throw dbUpdateErr;

      localStorage.setItem(`sjc_pass_hash_${String(pendingUser.id).toLowerCase()}`, newHash);
      localStorage.removeItem(`sjc_pass_${String(pendingUser.id).toLowerCase()}`);

      const updatedUser = {
        ...pendingUser,
        is_first_login: false
      };

      setIsSavingFirstPass(false);
      setShowFirstLoginModal(false);
      onLoginSuccess(sanitizeUser(updatedUser), rememberMe);
    } catch (err) {
      console.warn('Failed to update permanent password:', err);
      setIsSavingFirstPass(false);
      setFirstLoginError('Failed to save password to database. Please try again.');
    }
  };

  const openForgotFlow = () => {
    setForgotId(staffId || '');
    setForgotStep(1);
    setForgotError('');
    setForgotOtpInput('');
    setNewPasswordInput('');
    setResetSuccess(false);
    setShowForgotModal(true);
  };

  const handleSendRecoveryCode = async (e) => {
    e.preventDefault();
    setForgotError('');

    const query = forgotId.trim();
    if (!query) {
      setForgotError('Please enter your Staff ID');
      return;
    }

    let found = null;
    try {
      const { data: dbUser } = await supabase
        .from('profiles')
        .select('*')
        .ilike('id', query)
        .maybeSingle();

      if (dbUser) {
        found = { 
          id: dbUser.id, 
          name: dbUser.name, 
          role: dbUser.role, 
          email: dbUser.email,
          auth_user_id: dbUser.auth_user_id,
          password: dbUser.password
        };
      }
    } catch (_) {}

    if (!found) {
      setErrorMsg('Invalid ID or password. Please verify your credentials.');
      return;
    }

    setForgotFoundUser(found);
    setForgotStep(2);

    const targetEmail = found.email || `${found.id}@phinmaed.com`;
    await dispatchOtp(found, targetEmail, true);
  };

  const handleVerifyRecoveryCode = (e) => {
    e.preventDefault();
    setForgotError('');

    if (forgotOtpInput.trim() === forgotOtp) {
      setForgotStep(3);
    } else {
      setForgotError('Invalid recovery code. Please check your email and try again.');
    }
  };

  const handleSaveNewPassword = async (e) => {
    e.preventDefault();
    const cleanPass = newPasswordInput.trim();
    const complexity = validatePasswordStrength(cleanPass, forgotFoundUser);

    if (!complexity.isValid) {
      setForgotError(
        complexity.warningMessage ||
          'New password must be at least 6 characters and include 1 lowercase, 1 uppercase, 1 number, and 1 special character.'
      );
      return;
    }

    try {
      const newHash = await hashPassword(cleanPass);

      if (forgotFoundUser?.auth_user_id) {
        try {
          await supabase.auth.updateUser({ password: cleanPass });
        } catch (_) {}
      }

      await supabase
        .from('profiles')
        .update({
          password: cleanPass,
          is_first_login: false
        })
        .eq('id', forgotFoundUser.id);

      localStorage.setItem(`sjc_pass_hash_${String(forgotFoundUser.id).toLowerCase()}`, newHash);
      localStorage.removeItem(`sjc_pass_${String(forgotFoundUser.id).toLowerCase()}`);

      setResetSuccess(true);

      setTimeout(() => {
        setShowForgotModal(false);
        setStaffId(forgotFoundUser.id);
        setPassword('');
      }, 1200);
    } catch (err) {
      console.warn('Failed to update password hash:', err);
      setForgotError('Failed to encrypt and save new password.');
    }
  };

  // Real-time password & OTP evaluation for First-Time Login Modal
  const rawFirstOtpDigits = firstLoginOtpInput.replace(/\D/g, '');
  const isTypingFirstOtp = rawFirstOtpDigits.length > 0;
  const isFirstOtpValid =
    rawFirstOtpDigits.length === 6 &&
    (!generatedOtp || rawFirstOtpDigits === generatedOtp);

  const firstPassChecks = validatePasswordStrength(firstLoginNewPass, pendingUser);
  const isTypingFirstPass = firstLoginNewPass.length > 0;
  const isConfirmTyping = firstLoginConfirmPass.length > 0;
  const isConfirmMatching = isConfirmTyping && firstLoginConfirmPass === firstLoginNewPass && firstPassChecks.isValid;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative overflow-hidden font-sans">
      
      {/* Toast Keyframes */}
      <style>{`
        @keyframes toastFadeInOut {
          0% { opacity: 0; transform: translateY(-10px) scale(0.96); }
          10% { opacity: 1; transform: translateY(0) scale(1); }
          85% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.97); }
        }
        .animate-toast-smooth {
          animation: toastFadeInOut 3.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Floating 2FA Dispatched Toast */}
      {emailSentAlert && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-[215px] inset-x-0 z-[150] max-w-sm mx-auto px-4 pointer-events-none animate-toast-smooth select-none">
          <div className="pointer-events-auto p-3 bg-emerald-50/95 backdrop-blur-sm border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2.5 shadow-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="flex-1 font-medium">A 6-digit verification code has been dispatched to your school email!</span>
          </div>
        </div>,
        document.body
      )}

      {/* Mode Switch Banner */}
      {showAdminToast && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-[220px] inset-x-0 z-[150] max-w-sm mx-auto px-4 pointer-events-none animate-toast-smooth select-none">
          <div className="pointer-events-auto p-3 bg-amber-50/95 backdrop-blur-sm border border-amber-300 text-amber-900 text-xs font-semibold rounded-2xl flex items-center gap-2.5 shadow-xl">
            <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 animate-pop" />
            <span className="flex-1 font-medium">Switched to {loginMode === 'admin' ? 'Admin Portal' : 'Staff Mode'}</span>
          </div>
        </div>,
        document.body
      )}

      {/* School Header Banner */}
      <div className="relative text-white pt-10 pb-8 px-6 text-center shadow-lg rounded-b-[2.5rem] overflow-hidden bg-slate-900">
        <img
          src={schoolBg}
          alt="PHINMA Saint Jude College"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none filter brightness-105 contrast-105"
        />

        <div className="absolute inset-0 bg-[#176e57]/15 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/35 pointer-events-none" />

        <div className="relative z-10">
          <button
            type="button"
            onClick={handleLogoTap}
            className="w-20 h-20 mx-auto rounded-2xl bg-white shadow-2xl p-1.5 flex items-center justify-center mb-3 active:scale-90 transition-transform duration-150 overflow-hidden ring-2 ring-white/80 cursor-default"
          >
            <img
              src={sjcLogo}
              alt="PHINMA Saint Jude College"
              className="w-full h-full object-contain pointer-events-none rounded-xl"
            />
          </button>

          <h1 className="text-lg font-extrabold tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            PHINMA Saint Jude College
          </h1>
          <p className="text-xs text-emerald-100 font-bold mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            Inventory and Janitory Tracker
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-between">
        {!showTwoFactor ? (
          /* Sign In Screen */
          <div className="flex-1 px-6 pt-16 pb-4">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-800">
                {loginMode === 'staff' ? 'Sign In' : 'Admin Login'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {loginMode === 'staff'
                  ? 'Enter your Staff ID to access daily rooms & supplies.'
                  : 'Facilities Supervisor multi-factor protected portal.'}
              </p>
            </div>

            {errorMsg && (
              <div 
                key={errorKey} 
                className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-shake shadow-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  placeholder={loginMode === 'staff' ? 'Staff ID' : 'Admin ID or Username'}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#176e57] focus:ring-2 focus:ring-[#176e57]/15 bg-white transition duration-150"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#176e57] focus:ring-2 focus:ring-[#176e57]/15 bg-white transition duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 active:scale-90 transition-transform duration-150"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  className="flex items-center gap-2 text-xs text-slate-600 select-none group"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-150 ${
                    rememberMe ? 'bg-[#176e57] border-[#176e57] text-white scale-105' : 'border-slate-300 bg-white group-active:scale-90'
                  }`}>
                    {rememberMe && <Check className="w-3 h-3 animate-pop" />}
                  </div>
                  <span>Remember Me</span>
                </button>
                
                <button
                  type="button"
                  onClick={openForgotFlow}
                  className="text-xs text-[#176e57] font-semibold hover:underline cursor-pointer active:scale-95 transition"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isCheckingCredentials}
                className="w-full mt-2 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-sm transition-all duration-150 shadow-sm flex items-center justify-center gap-2 disabled:opacity-80"
              >
                {isCheckingCredentials ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying account...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2">
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-amber-950 font-medium text-[11px]">
                      Faculty or Teacher?
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/request')}
                    className="text-[#176e57] font-bold text-[11px] hover:underline active:scale-95 transition flex items-center gap-1"
                  >
                    <span>Request Assistance</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          /* 2FA Verification Screen */
          <div className="flex-1 px-6 pt-16 pb-6 space-y-4 page-transition">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#176e57] mx-auto flex items-center justify-center mb-2 animate-pop">
                {isSendingEmail ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#176e57]" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-800">Two-Factor Authentication</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Please enter the 6-digit verification code sent to your registered institutional address:
              </p>
              <div className="pt-1">
                <span className="inline-block bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs font-bold px-3 py-1 rounded-lg animate-pop">
                  {displayedMaskedEmail}
                </span>
              </div>
            </div>

            {otpError && (
              <div 
                key={otpErrorKey} 
                className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-shake shadow-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
              <div className="flex justify-center gap-2">
                {otpInput.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    onFocus={(e) => e.target.select()}
                    className={`w-11 h-12 text-center text-lg font-bold font-mono border rounded-xl bg-white text-slate-800 focus:outline-none focus:border-[#176e57] focus:ring-2 focus:ring-[#176e57]/20 transition-all duration-150 shadow-sm ${
                      digit ? 'border-[#176e57] scale-105 shadow-emerald-50' : 'border-slate-300'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setTrustThisDevice(!trustThisDevice)}
                  className="flex items-center gap-2 text-xs text-slate-600 select-none group bg-slate-100/80 px-3 py-2 rounded-xl border border-slate-200/60"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-150 ${
                    trustThisDevice ? 'bg-[#176e57] border-[#176e57] text-white scale-105' : 'border-slate-300 bg-white group-active:scale-90'
                  }`}>
                    {trustThisDevice && <Check className="w-3 h-3 animate-pop" />}
                  </div>
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Smartphone className="w-3.5 h-3.5 text-[#176e57]" />
                    Trust this device for 30 days
                  </span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isVerifyingCode}
                className="w-full bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-sm transition-all duration-150 shadow-sm flex items-center justify-center gap-2 disabled:opacity-80"
              >
                {isVerifyingCode ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Verify & Log In</span>
                )}
              </button>
            </form>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 px-1">
              <button
                type="button"
                disabled={resendTimer > 0 || isSendingEmail}
                onClick={() => {
                  setResendTimer(30);
                  dispatchOtp(pendingUser, displayedMaskedEmail, false);
                }}
                className={`flex items-center gap-1 font-medium transition duration-150 ${
                  resendTimer > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-[#176e57] hover:underline active:scale-95'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Code'}
              </button>

              <button
                type="button"
                onClick={() => setShowTwoFactor(false)}
                className="text-slate-500 hover:text-slate-800 hover:underline active:scale-95 transition"
              >
                Back to Login
              </button>
            </div>
          </div>
        )}

        <div className="pb-6 text-center text-xs text-slate-400 border-t border-slate-200/60 pt-3">
          Powered by <strong className="text-slate-600 font-medium">the power of friendship</strong>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 🔐 MANDATORY FIRST-TIME PASSWORD CHANGE MODAL                  */}
      {/* Email OTP (000-000) on top + Red/Green Dynamic Outlines         */}
      {/* ============================================================== */}
      {showFirstLoginModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-backdrop select-none">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-sm w-full space-y-4 animate-sheet-up">
            
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center mb-1 animate-pop">
                <ShieldIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">
                First-Time Security Setup
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter the verification code sent to your email and create a new password.
              </p>
            </div>

            {/* Live Warning Banner when typing and conditions are unmet or password is too easy */}
            {(firstLoginError || (isTypingFirstPass && !firstPassChecks.isValid)) && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl flex items-start gap-2 animate-shake shadow-2xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="block font-bold text-rose-900 text-[11px]">
                    {firstPassChecks.includesPersonalInfo || firstPassChecks.isPredictable
                      ? 'Weak / Predictable Password Detected'
                      : 'Security Requirements Not Yet Met'}
                  </span>
                  <span className="block text-[11px] text-rose-700 font-medium leading-snug">
                    {firstLoginError || firstPassChecks.warningMessage}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveFirstLoginPassword} className="space-y-3">
              {/* Email OTP Input Bar (000-000) on top of New Password Bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Email OTP ({displayedMaskedEmail || 'School Email'}):
                  </label>
                  <button
                    type="button"
                    disabled={resendTimer > 0 || isSendingEmail}
                    onClick={() => {
                      setResendTimer(30);
                      const targetEmail = pendingUser?.email || `${String(pendingUser?.id || '').toLowerCase()}@phinmaed.com`;
                      dispatchOtp(pendingUser, targetEmail, false);
                    }}
                    className={`text-[10px] font-bold transition ${
                      resendTimer > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-[#176e57] hover:underline'
                    }`}
                  >
                    {isSendingEmail ? 'Sending...' : resendTimer > 0 ? `Resend (${resendTimer}s)` : 'Resend OTP'}
                  </button>
                </div>

                <div className="relative">
                  <Mail className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                    !isTypingFirstOtp
                      ? 'text-slate-400'
                      : isFirstOtpValid
                      ? 'text-emerald-600'
                      : 'text-rose-500'
                  }`} />
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={7}
                    value={firstLoginOtpInput}
                    onChange={(e) => {
                      setFirstLoginOtpInput(formatOtpWithHyphen(e.target.value));
                      setFirstLoginError('');
                    }}
                    placeholder="000-000"
                    className={`w-full pl-10 pr-3 py-2.5 border-2 rounded-2xl text-xs font-mono font-bold tracking-widest text-center transition-all duration-200 focus:outline-none ${
                      !isTypingFirstOtp
                        ? 'border-slate-200 bg-slate-50 text-slate-800 focus:border-[#176e57]'
                        : isFirstOtpValid
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-rose-500 bg-rose-50/70 text-rose-950 ring-2 ring-rose-500/20'
                    }`}
                  />
                </div>
              </div>

              {/* New Password Input with Dynamic Red / Green Outline */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    New Permanent Password:
                  </label>
                  {isTypingFirstPass && (
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      firstPassChecks.isValid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {firstPassChecks.isValid ? 'Strong & Secure' : 'Weak / Incomplete'}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                    !isTypingFirstPass
                      ? 'text-slate-400'
                      : firstPassChecks.isValid
                      ? 'text-emerald-600'
                      : 'text-rose-500'
                  }`} />
                  <input
                    type={showFirstNewPass ? 'text' : 'password'}
                    required
                    value={firstLoginNewPass}
                    onChange={(e) => {
                      setFirstLoginNewPass(e.target.value);
                      setFirstLoginError('');
                    }}
                    placeholder="Enter permanent password"
                    className={`w-full pl-10 pr-9 py-2.5 border-2 rounded-2xl text-xs font-mono font-bold transition-all duration-200 focus:outline-none ${
                      !isTypingFirstPass
                        ? 'border-slate-200 bg-slate-50 text-slate-800 focus:border-[#176e57]'
                        : firstPassChecks.isValid
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-rose-500 bg-rose-50/70 text-rose-950 ring-2 ring-rose-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFirstNewPass(!showFirstNewPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                    title={showFirstNewPass ? 'Hide password' : 'Show password'}
                  >
                    {showFirstNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input with Dynamic Red / Green Outline */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Confirm Permanent Password:
                  </label>
                  {isConfirmTyping && (
                    <span className={`text-[10px] font-bold ${
                      isConfirmMatching ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {isConfirmMatching ? 'Passwords Match' : 'Does Not Match'}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                    !isConfirmTyping
                      ? 'text-slate-400'
                      : isConfirmMatching
                      ? 'text-emerald-600'
                      : 'text-rose-500'
                  }`} />
                  <input
                    type={showFirstConfirmPass ? 'text' : 'password'}
                    required
                    value={firstLoginConfirmPass}
                    onChange={(e) => {
                      setFirstLoginConfirmPass(e.target.value);
                      setFirstLoginError('');
                    }}
                    placeholder="Re-enter permanent password"
                    className={`w-full pl-10 pr-9 py-2.5 border-2 rounded-2xl text-xs font-mono font-bold transition-all duration-200 focus:outline-none ${
                      !isConfirmTyping
                        ? 'border-slate-200 bg-slate-50 text-slate-800 focus:border-[#176e57]'
                        : isConfirmMatching
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-rose-500 bg-rose-50/70 text-rose-950 ring-2 ring-rose-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFirstConfirmPass(!showFirstConfirmPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                    title={showFirstConfirmPass ? 'Hide password' : 'Show password'}
                  >
                    {showFirstConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Reference-Style Security Checklist Card (Red X vs Green Check) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Security Checklist
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${
                    firstPassChecks.hasMinLength ? 'text-emerald-700' : isTypingFirstPass ? 'text-rose-600' : 'text-slate-400'
                  }`}>
                    {firstLoginNewPass.length}/6+ chars
                  </span>
                </div>

                {/* 4 Character Type Pills */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    { met: firstPassChecks.hasLowercase, label: '1 Lowercase (a-z)' },
                    { met: firstPassChecks.hasUppercase, label: '1 Uppercase (A-Z)' },
                    { met: firstPassChecks.hasNumber, label: '1 Number (0-9)' },
                    { met: firstPassChecks.hasSpecial, label: '1 Symbol (@#$!)' }
                  ].map((rule, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 font-semibold transition-colors ${
                        rule.met
                          ? 'text-emerald-800'
                          : isTypingFirstPass
                          ? 'text-rose-700'
                          : 'text-slate-500'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        rule.met
                          ? 'bg-emerald-500 text-white'
                          : isTypingFirstPass
                          ? 'bg-rose-500 text-white'
                          : 'border border-slate-300 bg-white text-transparent'
                      }`}>
                        {rule.met ? (
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        ) : isTypingFirstPass ? (
                          <X className="w-2.5 h-2.5 stroke-[3]" />
                        ) : null}
                      </div>
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>

                {/* Anti-Easy & Personal Info Rules */}
                <div className="pt-1.5 border-t border-slate-200/70 space-y-1.5 text-[11px]">
                  {[
                    {
                      met: firstPassChecks.noPersonalInfo,
                      failAlert: firstPassChecks.includesPersonalInfo,
                      passText: "Doesn't include personal name or ID",
                      failText: 'Includes your name or Staff ID'
                    },
                    {
                      met: firstPassChecks.noPredictablePatterns,
                      failAlert: firstPassChecks.isPredictable,
                      passText: 'No predictable sequences (1234, sjc)',
                      failText: 'Uses predictable spelling or numbers'
                    }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 font-semibold transition-colors ${
                        item.met
                          ? 'text-emerald-800'
                          : isTypingFirstPass
                          ? 'text-rose-700'
                          : 'text-slate-500'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        item.met
                          ? 'bg-emerald-500 text-white'
                          : isTypingFirstPass
                          ? 'bg-rose-500 text-white'
                          : 'border border-slate-300 bg-white text-transparent'
                      }`}>
                        {item.met ? (
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        ) : isTypingFirstPass ? (
                          <X className="w-2.5 h-2.5 stroke-[3]" />
                        ) : null}
                      </div>
                      <span>{item.failAlert ? item.failText : item.passText}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingFirstPass || !isFirstOtpValid || !firstPassChecks.isValid || !isConfirmMatching}
                className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none"
              >
                {isSavingFirstPass ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Encrypting & Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Password & Open App</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-backdrop">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-sm w-full space-y-4 animate-sheet-up">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-[#176e57] rounded-xl">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  Password Reset
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-semibold"
              >
                &times;
              </button>
            </div>

            {forgotError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotStep === 1 && (
              <form onSubmit={handleSendRecoveryCode} className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your Staff ID. A 6-digit code will be sent to your email.
                </p>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={forgotId}
                    onChange={(e) => setForgotId(e.target.value)}
                    placeholder="Staff ID"
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#176e57]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isForgotSending}
                  className="w-full py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-80"
                >
                  {isForgotSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Passcode...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Code</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleVerifyRecoveryCode} className="space-y-3">
                <p className="text-xs text-slate-500">
                  Enter the 6-digit verification code sent to your linked school email for <strong>{forgotFoundUser?.name}</strong>:
                </p>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  maxLength={6}
                  value={forgotOtpInput}
                  onChange={(e) => setForgotOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  className="w-full text-center tracking-widest text-lg font-mono font-bold py-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#176e57]"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Verify Code</span>
                </button>
              </form>
            )}

            {forgotStep === 3 && (
              <form onSubmit={handleSaveNewPassword} className="space-y-3 animate-pop">
                {resetSuccess ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center justify-center gap-1.5 animate-pop">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Password updated! Redirecting...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">
                      Identity verified for <strong>{forgotFoundUser?.name}</strong>. Create a new strong password below:
                    </p>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        autoComplete="off"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Enter new strong password"
                        className={`w-full pl-10 pr-3 py-2 border-2 rounded-xl text-xs font-mono font-bold focus:outline-none transition-all ${
                          !newPasswordInput
                            ? 'border-slate-200 bg-slate-50 text-slate-800'
                            : validatePasswordStrength(newPasswordInput, forgotFoundUser).isValid
                            ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950'
                            : 'border-rose-500 bg-rose-50/70 text-rose-950'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save New Password & Sign In</span>
                    </button>
                  </>
                )}
              </form>
            )}

          </div>
        </div>
      )}

      {/* Google reCAPTCHA Checkpoint Modal */}
      <CaptchaModal
        isOpen={showCaptchaModal}
        onClose={() => {
          setShowCaptchaModal(false);
          setStagedUser(null);
        }}
        onSuccess={handleCaptchaSuccess}
      />

    </div>
  );
}