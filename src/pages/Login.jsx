import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import sjcLogo from '../assets/Logo.jpg';
import schoolBg from '../assets/School.jpg';
import CaptchaModal from '../components/CaptchaModal';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  ShieldAlert, 
  ShieldCheck, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  Loader2, 
  Smartphone, 
  KeyRound 
} from 'lucide-react';

const EMAILJS_SERVICE_ID = 'service_0od3tyo';
const EMAILJS_TEMPLATE_ID = 'template_cwipfdc';
const EMAILJS_PUBLIC_KEY = 'SKoJDpKyhviN9MWEQ';

// Official SJC Custodial Team Roster
const OFFICIAL_STAFF_ROSTER = [
  { id: '001', name: 'Kuya Bert', role: 'staff' },
  { id: '002', name: 'Ate Linda', role: 'staff' },
  { id: '003', name: 'Kuya Jun', role: 'staff' },
  { id: '004', name: 'Ate Marites', role: 'staff' },
  { id: '005', name: 'Kuya Jomar', role: 'staff' },
  { id: '06-2223-033162', name: 'Kuya Bert', role: 'staff' }
];

const getDestinationEmail = (accountId) => {
  const id = String(accountId || '').trim();
  if (id === '002' || id === '2' || id.endsWith('02')) {
    return 'cami.ubuwon.sjc@phinmaed.com';
  }
  return 'vhma.nacion.sjc@phinmaed.com';
};

const PHINMA_STAFF_EMAILS = {
  '001': 'vhma.nacion.sjc@phinmaed.com',
  '002': 'cami.ubuwon.sjc@phinmaed.com',
  '003': 'vhma.nacion.sjc@phinmaed.com',
  '004': 'vhma.nacion.sjc@phinmaed.com',
  '005': 'vhma.nacion.sjc@phinmaed.com',
  'admin': 'vhma.nacion.sjc@phinmaed.com'
};

const TRUST_DURATION_DAYS = 30;

const getAccountPassword = (accountId) => {
  const custom = localStorage.getItem(`sjc_pass_${accountId}`);
  if (custom) return custom;
  return accountId === 'admin' ? 'admin123' : 'password123';
};

const setAccountPassword = (accountId, newPassword) => {
  localStorage.setItem(`sjc_pass_${accountId}`, newPassword);
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
  const [loginMode, setLoginMode] = useState('staff');

  const [staffId, setStaffId] = useState(() => {
    return localStorage.getItem('sjc_remembered_staff_id') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [rememberMe, setRememberMe] = useState(() => {
    return Boolean(localStorage.getItem('sjc_remembered_staff_id'));
  });

  // Staged User & Challenge Gate
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [stagedUser, setStagedUser] = useState(null);

  const [errorMsg, setErrorMsg] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  
  const [tapCount, setTapCount] = useState(0);
  const [showAdminToast, setShowAdminToast] = useState(false);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);

  // 2FA Flow States
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

  // Forgot / Reset Password Flow States
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

  // Button micro-states
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  useEffect(() => {
    let interval = null;
    if (showTwoFactor && resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [showTwoFactor, resendTimer]);

  const handleLogoTap = () => {
    const nextTaps = tapCount + 1;
    if (nextTaps >= 5) {
      const nextMode = loginMode === 'staff' ? 'admin' : 'staff';
      setLoginMode(nextMode);
      setStaffId(nextMode === 'admin' ? 'admin' : '');
      setPassword('');
      setTapCount(0);
      setShowAdminToast(true);
      setTimeout(() => setShowAdminToast(false), 2800);
    } else {
      setTapCount(nextTaps);
    }
  };

  const dispatchOtp = async (userObj, targetEmailDisplay, isRecovery = false) => {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const destinationEmail = getDestinationEmail(userObj.id);

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
        setTimeout(() => setEmailSentAlert(false), 5000);
      }
    } catch (err) {
      console.error('Failed to send verification email:', err);
    } finally {
      if (isRecovery) setIsForgotSending(false);
      else setIsSendingEmail(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    const now = Date.now();
    if (now - lastAttemptTime < 2500) {
      setErrorMsg('Too many attempts. Please wait a moment.');
      return;
    }
    setLastAttemptTime(now);

    setIsCheckingCredentials(true);

    setTimeout(() => {
      let validatedUser = null;
      const cleanInput = staffId.trim();

      if (loginMode === 'staff') {
        // Matches "002", "2", "003", "3", etc.
        const foundStaff = OFFICIAL_STAFF_ROSTER.find(
          (s) => 
            s.id.toLowerCase() === cleanInput.toLowerCase() || 
            s.id.replace(/^0+/, '') === cleanInput.replace(/^0+/, '')
        );

        const accountKey = foundStaff ? foundStaff.id : cleanInput;
        const validPassword = getAccountPassword(accountKey);

        if (foundStaff && password === validPassword) {
          validatedUser = foundStaff;
        } else if (cleanInput && password === validPassword) {
          // Custom staff ID
          validatedUser = { id: cleanInput, name: `Staff Member (${cleanInput})`, role: 'staff' };
        } else {
          setErrorMsg('Invalid staff credentials. (Staff IDs: 001 to 005)');
          setErrorKey((prev) => prev + 1);
          setIsCheckingCredentials(false);
          return;
        }
      } else {
        const validAdminPass = getAccountPassword('admin');
        if (cleanInput.toLowerCase() === 'admin' && password === validAdminPass) {
          validatedUser = { id: 'admin', name: 'Facilities Supervisor', role: 'admin' };
        } else {
          setErrorMsg('Invalid supervisor credentials.');
          setErrorKey((prev) => prev + 1);
          setIsCheckingCredentials(false);
          return;
        }
      }

      setStagedUser(validatedUser);
      setIsCheckingCredentials(false);
      setShowCaptchaModal(true);
    }, 300);
  };

  const handleCaptchaSuccess = () => {
    setShowCaptchaModal(false);
    if (!stagedUser) return;

    if (rememberMe) {
      localStorage.setItem('sjc_remembered_staff_id', stagedUser.id);
    } else {
      localStorage.removeItem('sjc_remembered_staff_id');
    }

    // If device is already trusted, hand off directly to App controller
    if (isDeviceTrustedForAccount(stagedUser.id)) {
      onLoginSuccess(stagedUser, rememberMe);
      return;
    }

    const simulatedEmail = PHINMA_STAFF_EMAILS[stagedUser.id] || `${stagedUser.name.toLowerCase().replace(/\s+/g, '')}@phinmaed.com`;
    const masked = maskEmail(simulatedEmail);

    setPendingUser(stagedUser);
    setDisplayedMaskedEmail(masked);
    setShowTwoFactor(true);
    setOtpInput(['', '', '', '', '', '']);
    setOtpError('');
    setResendTimer(30);

    dispatchOtp(stagedUser, simulatedEmail, false);
  };

  const handleOtpDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpInput];
    newOtp[index] = value.slice(-1);
    setOtpInput(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
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
        onLoginSuccess(pendingUser, rememberMe);
      } else {
        setOtpError('Invalid 6-digit security code. Please check your email and try again.');
        setOtpErrorKey((prev) => prev + 1);
        setIsVerifyingCode(false);
      }
    }, 300);
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
    if (query.toLowerCase() === 'admin') {
      found = { id: 'admin', name: 'Facilities Supervisor', role: 'admin' };
    } else {
      found = OFFICIAL_STAFF_ROSTER.find(
        (s) => 
          s.id.toLowerCase() === query.toLowerCase() || 
          s.id.replace(/^0+/, '') === query.replace(/^0+/, '')
      );
    }

    if (!found) {
      setForgotError('Staff ID not found in institutional roster.');
      return;
    }

    setForgotFoundUser(found);
    setForgotStep(2);

    const simulatedEmail = PHINMA_STAFF_EMAILS[found.id] || `${found.name.toLowerCase().replace(/\s+/g, '')}@phinmaed.com`;
    await dispatchOtp(found, simulatedEmail, true);
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

  const handleSaveNewPassword = (e) => {
    e.preventDefault();
    if (!newPasswordInput.trim() || newPasswordInput.length < 4) {
      setForgotError('New password must be at least 4 characters long.');
      return;
    }

    setAccountPassword(forgotFoundUser.id, newPasswordInput.trim());
    setResetSuccess(true);

    setTimeout(() => {
      setShowForgotModal(false);
      setStaffId(forgotFoundUser.id);
      setPassword(newPasswordInput.trim());
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative overflow-hidden font-sans">
      
      {/* High-Definition School Photo Banner */}
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
            title="Tap 5 times for Admin"
            className="w-20 h-20 mx-auto rounded-2xl bg-white shadow-2xl p-1.5 flex items-center justify-center mb-3 active:scale-90 transition-transform duration-150 overflow-hidden ring-2 ring-white/80"
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

      {/* Main Login Form Screen */}
      <div className="flex-1 flex flex-col justify-between">
        {!showTwoFactor ? (
          <div className="flex-1 px-6 pt-5 pb-4">
            
            {showAdminToast && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold rounded-xl flex items-center gap-2 animate-toast shadow-sm">
                <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 animate-pop" />
                <span>Switched to {loginMode === 'admin' ? 'Admin Portal' : 'Staff Mode'}</span>
              </div>
            )}

            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-800">
                {loginMode === 'staff' ? 'Sign In' : 'Admin Login'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {loginMode === 'staff'
                  ? 'Enter your custodial ID to access daily rooms & supplies.'
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
                  placeholder={loginMode === 'staff' ? 'Staff ID (001 - 005)' : 'Admin Username'}
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isCheckingCredentials}
                className="w-full mt-2 bg-[#176e57] hover:bg-[#135c49] active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-sm transition-all duration-150 shadow-sm flex items-center justify-center gap-2 disabled:opacity-80"
              >
                {isCheckingCredentials ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Checking credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Faculty Call Link */}
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
          <div className="flex-1 px-6 pt-5 pb-6 space-y-4 page-transition">
            {emailSentAlert && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-toast shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 animate-pop" />
                <span>A 6-digit verification code has been dispatched to your school email!</span>
              </div>
            )}

            <div className="text-center space-y-1 pt-2">
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
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
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

        {/* Footer */}
        <div className="pb-6 text-center text-xs text-slate-400 border-t border-slate-200/60 pt-3">
          Powered by <strong className="text-slate-600 font-medium">the power of friendship</strong>
        </div>
      </div>

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
                  Enter your Staff ID. A 6 Digit code will be sent to your email
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
                      Identity verified for <strong>{forgotFoundUser?.name}</strong>. Create a new password below:
                    </p>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-[#176e57]"
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