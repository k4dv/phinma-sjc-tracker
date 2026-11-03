import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Supplies, { unpackSupplyItem } from './pages/Supplies';
import Admin from './pages/Admin';
import TeacherRequest from './pages/TeacherRequest';
import Profile from './pages/Profile';
import QRDoorRouter from './pages/QRDoorRouter';
import QRScannerModal from './components/QRScannerModal';
import { supabase } from './data/supabaseClient';
import { api } from './services/api';
import { validatePasswordStrength, hashPassword } from './utils/security';
import sjcLogo from './assets/Logo.jpg';
import schoolBg from './assets/School.jpg';
import { 
  Megaphone, 
  QrCode, 
  Check, 
  X,
  AlertTriangle,
  Lock, 
  Eye, 
  EyeOff, 
  Mail,
  ShieldCheck 
} from 'lucide-react';
import { 
  INITIAL_ROOMS, 
  INITIAL_SUPPLIES, 
  INITIAL_LOGS, 
  INITIAL_ASSIGNMENTS, 
  INITIAL_BROADCAST 
} from './data/mockData';

const EMAILJS_SERVICE_ID = 'service_0od3tyo';
const EMAILJS_TEMPLATE_ID = 'template_cwipfdc';
const EMAILJS_PUBLIC_KEY = 'SKoJDpKyhviN9MWEQ';

const formatOtpWithHyphen = (val = '') => {
  const digits = String(val).replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
};

const isVisibleLog = (logItem) => {
  if (!logItem) return false;
  if (logItem.id === 'keep_table_structure') return false;
  if (logItem.author === '__SJC_SUPPLY_META__') return false;
  return true;
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('sjc_active_user') || sessionStorage.getItem('sjc_active_user');
    return saved ? JSON.parse(saved) : null;
  });

  // First-Time Login Password Change Interceptor States
  const [firstLoginName, setFirstLoginName] = useState('');
  const [firstLoginOtpInput, setFirstLoginOtpInput] = useState('');
  const [firstLoginGeneratedOtp, setFirstLoginGeneratedOtp] = useState('');
  const [firstLoginResendTimer, setFirstLoginResendTimer] = useState(0);
  const [isSendingFirstOtp, setIsSendingFirstOtp] = useState(false);
  const [firstLoginPass, setFirstLoginPass] = useState('');
  const [firstLoginConfirm, setFirstLoginConfirm] = useState('');
  const [showFirstLoginPass, setShowFirstLoginPass] = useState(false);
  const [firstLoginError, setFirstLoginError] = useState('');
  const [isSavingFirstLogin, setIsSavingFirstLogin] = useState(false);

  const sendFirstLoginEmailOtp = async (targetUser) => {
    if (!targetUser) return;
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const destinationEmail = targetUser.email || `${String(targetUser.id).toLowerCase()}@phinmaed.com`;

    setFirstLoginGeneratedOtp(newOtp);
    setFirstLoginResendTimer(30);
    setIsSendingFirstOtp(true);

    try {
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            email: destinationEmail,
            to_email: destinationEmail,
            staff_name: targetUser.name || 'Staff Member',
            passcode: newOtp,
            time: currentTime,
            displayed_email: destinationEmail
          }
        })
      });
    } catch (err) {
      console.error('Failed to send first-login OTP:', err);
    } finally {
      setIsSendingFirstOtp(false);
    }
  };

  useEffect(() => {
    if (user?.is_first_login) {
      setFirstLoginName(user.name && user.name !== 'Staff Member' ? user.name : '');
      setFirstLoginOtpInput('');
      setFirstLoginPass('');
      setFirstLoginConfirm('');
      setFirstLoginError('');
      sendFirstLoginEmailOtp(user);
    }
  }, [user?.is_first_login, user?.id]);

  useEffect(() => {
    if (!user?.is_first_login || firstLoginResendTimer <= 0) return;
    const timer = setInterval(() => {
      setFirstLoginResendTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [user?.is_first_login, firstLoginResendTimer]);

  const [isDesktopView, setIsDesktopView] = useState(() => {
    const savedUser = localStorage.getItem('sjc_active_user') || sessionStorage.getItem('sjc_active_user');
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    if (!parsedUser) return false;

    const isUserAdmin = parsedUser?.role === 'admin' || Number(parsedUser?.access_level) >= 2;
    const savedPref = localStorage.getItem('sjc_desktop_view');
    const isDesktopScreen = typeof window !== 'undefined' && window.innerWidth >= 768;

    return isUserAdmin && (savedPref === 'true' || (savedPref !== 'false' && isDesktopScreen));
  });

  const isAdmin = user?.role === 'admin' || Number(user?.access_level) >= 2;
  const isWide = isAdmin && isDesktopView;

  // Curtain Stages: 'idle' | 'dropping' | 'sliding_up'
  const [curtainStage, setCurtainStage] = useState('idle');
  const [curtainWidth, setCurtainWidth] = useState('mobile');

  // Dynamic Mobile Viewport Switcher for true Desktop Mode on mobile devices
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }

    if (isWide) {
      meta.setAttribute('content', 'width=1024, user-scalable=yes');
    } else {
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0');
    }

    return () => {
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0');
    };
  }, [isWide]);

  // Seamless Widescreen <-> Phone Switcher with Zero Layout Leaks
  const handleToggleDesktopWithCurtain = () => {
    if (!isAdmin || curtainStage !== 'idle') return;

    const animationsDisabled = localStorage.getItem('sjc_animations_disabled') === 'true';
    const targetIsWide = !isDesktopView;

    if (animationsDisabled) {
      setIsDesktopView(targetIsWide);
      localStorage.setItem('sjc_desktop_view', String(targetIsWide));
      navigate('/dashboard');
      return;
    }

    if (targetIsWide) {
      setCurtainWidth('mobile');
      setCurtainStage('dropping');

      setTimeout(() => {
        setCurtainWidth('wide');
      }, 1000);

      setTimeout(() => {
        setIsDesktopView(true);
        localStorage.setItem('sjc_desktop_view', 'true');
      }, 2100);

      setTimeout(() => {
        navigate('/dashboard');
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setCurtainStage('sliding_up');
      }, 2500);

      setTimeout(() => {
        setCurtainStage('idle');
      }, 3600);

    } else {
      setCurtainWidth('wide');
      setCurtainStage('dropping');

      setTimeout(() => {
        setIsDesktopView(false);
        localStorage.setItem('sjc_desktop_view', 'false');
        navigate('/dashboard');
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }, 850);

      setTimeout(() => {
        setCurtainWidth('mobile');
      }, 1100);

      setTimeout(() => {
        setCurtainStage('sliding_up');
      }, 2400);

      setTimeout(() => {
        setCurtainStage('idle');
      }, 3500);
    }
  };

  const [rooms, setRooms] = useState(() => {
    try {
      const cached = localStorage.getItem('sjc_cached_rooms');
      return cached ? JSON.parse(cached) : INITIAL_ROOMS;
    } catch {
      return INITIAL_ROOMS;
    }
  });

  // Cached locally on frame 1 to eliminate the "Stocked" -> "1 Low" flicker on refresh
  const [supplies, setSupplies] = useState(() => {
    try {
      const cached = localStorage.getItem('sjc_cached_supplies');
      return cached ? JSON.parse(cached) : INITIAL_SUPPLIES;
    } catch {
      return INITIAL_SUPPLIES;
    }
  });
  
  const [logs, setLogs] = useState(() => {
    try {
      const cached = localStorage.getItem('sjc_cached_logs');
      return cached ? JSON.parse(cached).filter(isVisibleLog) : INITIAL_LOGS;
    } catch {
      return INITIAL_LOGS;
    }
  });

  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [broadcast, setBroadcast] = useState(INITIAL_BROADCAST);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  const [teacherRequests, setTeacherRequests] = useState(() => {
    try {
      const cached = localStorage.getItem('sjc_teacher_requests');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [showGlobalScanner, setShowGlobalScanner] = useState(false);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  useEffect(() => {
    if (localStorage.getItem('sjc_animations_disabled') === 'true') {
      document.body.classList.add('disable-animations');
    } else {
      document.body.classList.remove('disable-animations');
    }
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('sjc_theme');
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [backendRooms, backendSupplies, assignRes, broadRes, logsRes, reqsRes] = await Promise.all([
          api.getRooms().catch(() => null),
          api.getSupplies().catch(() => null),
          supabase.from('assignments').select('*'),
          supabase.from('broadcast').select('*').limit(1),
          supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(30),
          supabase.from('teacher_requests').select('*').order('created_at', { ascending: false }).limit(25)
        ]);

        let rawRooms = backendRooms;
        if (!rawRooms) {
          const fallback = await supabase.from('rooms').select('*').order('id', { ascending: true });
          rawRooms = fallback.data || [];
        }

        if (rawRooms?.length) {
          const formattedRooms = rawRooms.map((r) => ({
            id: r.id,
            floor: r.floor,
            building: r.building || 'Dimasalang',
            status: r.status,
            staff: r.staff,
            lastCleaned: r.last_cleaned || r.lastCleaned,
            recleanReason: r.reclean_reason || r.recleanReason,
            acChecked: r.ac_checked ?? r.acChecked,
            lightsChecked: r.lights_checked ?? r.lightsChecked,
            doorChecked: r.door_checked ?? r.doorChecked,
            hasStudents: r.has_students ?? r.hasStudents ?? false,
            has_students: r.has_students ?? r.hasStudents ?? false,
            notes: r.notes ?? ''
          }));
          setRooms(formattedRooms);
          localStorage.setItem('sjc_cached_rooms', JSON.stringify(formattedRooms));
        }

        let rawSupplies = backendSupplies;
        if (!rawSupplies) {
          const fallback = await supabase.from('supplies').select('*').order('id', { ascending: true });
          rawSupplies = fallback.data || [];
        }
        if (rawSupplies?.length) {
          const unpackedSupplies = rawSupplies.map(unpackSupplyItem);
          setSupplies(unpackedSupplies);
          try {
            localStorage.setItem('sjc_cached_supplies', JSON.stringify(unpackedSupplies));
          } catch (_) {}

          const photoMap = {};
          const stackMap = {};
          unpackedSupplies.forEach((s) => {
            if (s.image_url) photoMap[s.id] = s.image_url;
            if (s.cloud_stack) stackMap[s.id] = s.cloud_stack;
          });
          if (Object.keys(photoMap).length > 0) {
            try {
              const cached = JSON.parse(localStorage.getItem('sjc_supply_photos') || '{}');
              localStorage.setItem('sjc_supply_photos', JSON.stringify({ ...cached, ...photoMap }));
            } catch (_) {}
          }
          if (Object.keys(stackMap).length > 0) {
            try {
              const cached = JSON.parse(localStorage.getItem('sjc_supplies_usage_history') || '{}');
              localStorage.setItem('sjc_supplies_usage_history', JSON.stringify({ ...cached, ...stackMap }));
            } catch (_) {}
          }
        }

        if (assignRes.data?.length) {
          const assignMap = {};
          assignRes.data.forEach((a) => {
            const bldg = a.building || 'Dimasalang';
            const compositeKey = `${bldg}_${a.floor}`;

            if (!assignMap[compositeKey]) assignMap[compositeKey] = [];
            if (!assignMap[compositeKey].includes(a.staff_id)) {
              assignMap[compositeKey].push(a.staff_id);
            }
            if (bldg === 'Dimasalang') {
              if (!assignMap[a.floor]) assignMap[a.floor] = [];
              if (!assignMap[a.floor].includes(a.staff_id)) {
                assignMap[a.floor].push(a.staff_id);
              }
            }
          });
          setAssignments(assignMap);
        }

        if (broadRes.data && broadRes.data.length > 0) {
          const b = broadRes.data[0];
          setBroadcast({
            active: b.active,
            message: b.message,
            postedBy: b.posted_by,
            updatedAt: b.updated_at
          });
        }

        if (logsRes.data?.length) {
          const visibleLogs = logsRes.data.filter(isVisibleLog);
          setLogs((prev) => {
            const map = new Map();
            prev.forEach((l) => map.set(l.id, l));
            visibleLogs.forEach((l) => map.set(l.id, l));
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('sjc_cached_logs', JSON.stringify(merged));
            } catch (_) {}
            return merged;
          });
        }

        if (reqsRes.data?.length) {
          setTeacherRequests(reqsRes.data);
          localStorage.setItem('sjc_teacher_requests', JSON.stringify(reqsRes.data));
        }
      } catch (err) {
        console.warn('Initial fetch error:', err);
      }
    };

    fetchInitialData();
  }, []);

  // Real-Time WebSocket Subscriptions & Local Sync
  useEffect(() => {
    const handleNewRequestEvent = (e) => {
      if (e.detail) {
        setTeacherRequests((prev) => [e.detail, ...prev.filter((r) => r.id !== e.detail.id)]);
      }
    };

    const handleNewLogEvent = (e) => {
      if (e.detail && isVisibleLog(e.detail)) {
        setLogs((prev) => {
          if (prev.some((item) => item.id === e.detail.id)) return prev;
          const next = [e.detail, ...prev];
          localStorage.setItem('sjc_cached_logs', JSON.stringify(next));
          return next;
        });
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'sjc_teacher_requests' && e.newValue) {
        try {
          setTeacherRequests(JSON.parse(e.newValue));
        } catch (err) {
          console.error('Storage parse error:', err);
        }
      }
      if (e.key === 'sjc_cached_logs' && e.newValue) {
        try {
          setLogs(JSON.parse(e.newValue).filter(isVisibleLog));
        } catch (err) {
          console.error('Logs storage parse error:', err);
        }
      }
    };

    window.addEventListener('sjc_request_created', handleNewRequestEvent);
    window.addEventListener('sjc_log_created', handleNewLogEvent);
    window.addEventListener('storage', handleStorageChange);

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = payload.new;
          const updatedBldg = updated.building || 'Dimasalang';

          setRooms((prev) => {
            const next = prev.map((r) => {
              const roomBldg = r.building || 'Dimasalang';
              if (r.id === updated.id && roomBldg === updatedBldg) {
                return {
                  ...r,
                  status: updated.status,
                  staff: updated.staff,
                  lastCleaned: updated.last_cleaned,
                  recleanReason: updated.reclean_reason,
                  acChecked: updated.ac_checked,
                  lightsChecked: updated.lights_checked,
                  doorChecked: updated.door_checked,
                  hasStudents: updated.has_students ?? false,
                  has_students: updated.has_students ?? false,
                  notes: updated.notes ?? ''
                };
              }
              return r;
            });
            localStorage.setItem('sjc_cached_rooms', JSON.stringify(next));
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplies' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const unpacked = unpackSupplyItem(payload.new);
          if (unpacked.image_url) {
            try {
              const cached = JSON.parse(localStorage.getItem('sjc_supply_photos') || '{}');
              cached[unpacked.id] = unpacked.image_url;
              localStorage.setItem('sjc_supply_photos', JSON.stringify(cached));
            } catch (_) {}
          }
          if (unpacked.cloud_stack) {
            try {
              const cached = JSON.parse(localStorage.getItem('sjc_supplies_usage_history') || '{}');
              cached[unpacked.id] = unpacked.cloud_stack;
              localStorage.setItem('sjc_supplies_usage_history', JSON.stringify(cached));
            } catch (_) {}
          }
          setSupplies((prev) => {
            const next = prev.map((s) => (s.id === unpacked.id ? { ...s, ...unpacked, quantity: Number(unpacked.quantity) } : s));
            try { localStorage.setItem('sjc_cached_supplies', JSON.stringify(next)); } catch (_) {}
            return next;
          });
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const unpacked = unpackSupplyItem(payload.new);
          setSupplies((prev) => {
            if (prev.some((s) => s.id === unpacked.id || s.name === unpacked.name)) return prev;
            const next = [...prev, unpacked];
            try { localStorage.setItem('sjc_cached_supplies', JSON.stringify(next)); } catch (_) {}
            return next;
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setSupplies((prev) => {
            const next = prev.filter((s) => s.id !== payload.old.id);
            try { localStorage.setItem('sjc_cached_supplies', JSON.stringify(next)); } catch (_) {}
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, async () => {
        const { data } = await supabase.from('assignments').select('*');
        if (data) {
          const assignMap = {};
          data.forEach((a) => {
            const bldg = a.building || 'Dimasalang';
            const compositeKey = `${bldg}_${a.floor}`;
            if (!assignMap[compositeKey]) assignMap[compositeKey] = [];
            if (!assignMap[compositeKey].includes(a.staff_id)) {
              assignMap[compositeKey].push(a.staff_id);
            }
            if (bldg === 'Dimasalang') {
              if (!assignMap[a.floor]) assignMap[a.floor] = [];
              if (!assignMap[a.floor].includes(a.staff_id)) {
                assignMap[a.floor].push(a.staff_id);
              }
            }
          });
          setAssignments(assignMap);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast' }, (payload) => {
        if (payload.new) {
          setBroadcast({
            active: payload.new.active,
            message: payload.new.message,
            postedBy: payload.new.posted_by,
            updatedAt: payload.new.updated_at
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_requests' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          setTeacherRequests((prev) => {
            const next = [payload.new, ...prev.filter((item) => item.id !== payload.new.id)];
            localStorage.setItem('sjc_teacher_requests', JSON.stringify(next));
            return next;
          });
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          setTeacherRequests((prev) => {
            const next = prev.map((item) => item.id === payload.new.id ? payload.new : item);
            localStorage.setItem('sjc_teacher_requests', JSON.stringify(next));
            return next;
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setTeacherRequests((prev) => {
            const next = prev.filter((item) => item.id !== payload.old.id);
            localStorage.setItem('sjc_teacher_requests', JSON.stringify(next));
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          if (!isVisibleLog(payload.new)) return;
          setLogs((prev) => {
            const isDuplicate = prev.some(
              (item) => item.id === payload.new.id || (item.text === payload.new.text && item.time === payload.new.time)
            );
            if (isDuplicate) return prev;
            const next = [payload.new, ...prev];
            localStorage.setItem('sjc_cached_logs', JSON.stringify(next));
            return next;
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setLogs((prev) => {
            const next = prev.filter((log) => log.id !== payload.old.id);
            localStorage.setItem('sjc_cached_logs', JSON.stringify(next));
            return next;
          });
        }
      })
      .subscribe();

    return () => {
      window.removeEventListener('sjc_request_created', handleNewRequestEvent);
      window.removeEventListener('sjc_log_created', handleNewLogEvent);
      window.removeEventListener('storage', handleStorageChange);
      supabase.removeChannel(channel);
    };
  }, []);

  // Supabase Real-Time Presence
  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase.channel('online-staff-tracker', {
      config: { presence: { key: String(user.id) } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const activeStaffList = Object.values(state).flatMap((sessions) => sessions);
        setOnlineUsers(activeStaffList);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            id: user.id,
            name: user.name,
            role: user.role,
            onlineAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  // Login handler
  const handleLoginSuccess = (userData, remember) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    const isQuickLogin = localStorage.getItem('sjc_quick_login') === 'true' || 
                         localStorage.getItem('sjc_animations_disabled') === 'true';

    const isUserAdmin = userData?.role === 'admin' || Number(userData?.access_level) >= 2;
    const isDesktopScreen = typeof window !== 'undefined' && window.innerWidth >= 768;
    const savedPref = localStorage.getItem('sjc_desktop_view');
    const shouldUnfoldToWide = isUserAdmin && (savedPref === 'true' || (savedPref !== 'false' && isDesktopScreen));

    const persistUser = () => {
      setUser(userData);
      if (shouldUnfoldToWide) {
        localStorage.setItem('sjc_desktop_view', 'true');
      }
      if (remember) {
        localStorage.setItem('sjc_active_user', JSON.stringify(userData));
        sessionStorage.removeItem('sjc_active_user');
      } else {
        sessionStorage.setItem('sjc_active_user', JSON.stringify(userData));
        localStorage.removeItem('sjc_active_user');
      }
    };

    if (isQuickLogin) {
      persistUser();
      if (shouldUnfoldToWide) setIsDesktopView(true);
      navigate('/dashboard');
      return;
    }

    setCurtainWidth('mobile');
    setCurtainStage('dropping');

    if (shouldUnfoldToWide) {
      setTimeout(() => {
        setCurtainWidth('wide');
      }, 1000);

      setTimeout(() => {
        persistUser();
        setIsDesktopView(true);
        navigate('/dashboard');
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setCurtainStage('sliding_up');
      }, 2900);

      setTimeout(() => setCurtainStage('idle'), 4000);

    } else {
      setTimeout(() => {
        persistUser();
        setIsDesktopView(false);
        navigate('/dashboard');
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setCurtainStage('sliding_up');
      }, 2900);

      setTimeout(() => setCurtainStage('idle'), 4000);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sjc_active_user');
    localStorage.removeItem('sjc_active_user');
    
    setUser(null);
    setIsDesktopView(false);
    navigate('/login', { replace: true });
  };

  // First-Time Login Modern Password Change Submission
  const handleFirstLoginSubmit = async (e) => {
    e.preventDefault();
    setFirstLoginError('');

    const rawOtpDigits = firstLoginOtpInput.replace(/\D/g, '');
    if (rawOtpDigits.length !== 6 || (firstLoginGeneratedOtp && rawOtpDigits !== firstLoginGeneratedOtp)) {
      setFirstLoginError('Invalid email OTP code. Please check the 6-digit code sent to your email.');
      return;
    }

    const cleanName = firstLoginName.trim() || user?.name || 'Staff Member';
    const cleanPass = firstLoginPass.trim();
    const cleanConfirm = firstLoginConfirm.trim();

    const strength = validatePasswordStrength(cleanPass, {
      ...user,
      name: cleanName
    });

    if (!strength.isValid) {
      setFirstLoginError(
        strength.warningMessage ||
          'Password must contain at least 1 lowercase, 1 uppercase, 1 number, 1 special character, and no personal info.'
      );
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setFirstLoginError('New password and confirmation do not match.');
      return;
    }

    setIsSavingFirstLogin(true);

    try {
      await api.completeFirstLogin(user.id, {
        newPassword: cleanPass,
        updatedName: cleanName
      });

      const passHash = await hashPassword(cleanPass);
      localStorage.setItem(`sjc_pass_hash_${String(user.id).toLowerCase()}`, passHash);
      localStorage.setItem(`sjc_pass_${user.id}`, cleanPass);

      const updatedUser = {
        ...user,
        name: cleanName,
        is_first_login: false
      };

      setUser(updatedUser);
      if (localStorage.getItem('sjc_active_user')) {
        localStorage.setItem('sjc_active_user', JSON.stringify(updatedUser));
      } else {
        sessionStorage.setItem('sjc_active_user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      setFirstLoginError(err.message || 'Failed to save new password to database.');
    } finally {
      setIsSavingFirstLogin(false);
    }
  };

  const handleGlobalScanSuccess = (scannedRoomId) => {
    const rawId = String(scannedRoomId).trim();
    const idNum = parseInt(rawId, 10);
    const floor = Math.floor(idNum / 100) || 1;
    const tens = Math.floor((idNum % 100) / 10);

    let detectedBuilding = 'Dimasalang';
    if (tens === 4) detectedBuilding = 'Silang';
    else if (tens === 2) detectedBuilding = 'Phinma';

    navigate('/rooms', {
      state: {
        targetRoomId: rawId,
        targetFloor: floor,
        targetBuilding: detectedBuilding,
        scanTimestamp: Date.now()
      }
    });
  };

  const isPublicPage = location.pathname === '/request' || location.pathname === '/door';
  const allRoomIds = rooms.map((r) => String(r.id));
  const isCurtainActive = curtainStage !== 'idle';

  const rawAppOtpDigits = firstLoginOtpInput.replace(/\D/g, '');
  const isTypingAppOtp = rawAppOtpDigits.length > 0;
  const isAppOtpValid =
    rawAppOtpDigits.length === 6 &&
    (!firstLoginGeneratedOtp || rawAppOtpDigits === firstLoginGeneratedOtp);

  const passCheck = validatePasswordStrength(firstLoginPass, {
    ...user,
    name: firstLoginName || user?.name
  });
  const isTypingFirstPass = firstLoginPass.length > 0;
  const isConfirmTyping = firstLoginConfirm.length > 0;
  const isConfirmMatching = isConfirmTyping && firstLoginConfirm === firstLoginPass && passCheck.isValid;

  return (
    <div 
      className={`min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col relative font-sans transition-[max-width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isWide 
          ? 'w-full min-w-[1024px] overflow-x-auto' 
          : 'w-full max-w-md mx-auto shadow-2xl overflow-x-hidden'
      }`}
    >
      
      {/* Fluid Curtain Keyframes */}
      <style>{`
        @keyframes fluidCurtainDown {
          0% { transform: translate3d(0, -100%, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        @keyframes fluidCurtainUp {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(0, -100%, 0); }
        }
        .animate-fluid-down {
          animation: fluidCurtainDown 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fluid-up {
          animation: fluidCurtainUp 1.05s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* CURTAIN OVERLAY */}
      {isCurtainActive && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
          <div 
            className={`h-[100dvh] relative overflow-hidden flex flex-col justify-center items-center text-white bg-slate-950 shadow-2xl will-change-[width,max-width,transform] ${
              curtainStage === 'sliding_up'
                ? 'animate-fluid-up'
                : 'animate-fluid-down'
            }`}
            style={{
              width: '100%',
              maxWidth: curtainWidth === 'wide' ? '100vw' : '28rem',
              transition: 'max-width 1.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <img
              src={schoolBg}
              alt="PHINMA SJC"
              className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none opacity-40 will-change-transform"
            />
            <div className="absolute inset-0 bg-[#0c3b2e]/65 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#176e57] via-black/35 to-black/60 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-white p-1.5 shadow-[0_12px_45px_rgba(0,0,0,0.4)] flex items-center justify-center ring-2 ring-white/90 origin-center animate-logo-spin">
                <img
                  src={sjcLogo}
                  alt="PHINMA SJC Crest"
                  className="w-full h-full object-contain pointer-events-none rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {user && !isPublicPage && (
        <Header 
          title={`Hi, ${user.name}`} 
          user={user} 
          onLogout={handleLogout} 
        />
      )}

      {/* Broadcast Alert */}
      {user && !isPublicPage && broadcast?.active && broadcast?.message && (
        <div className={`w-full mx-auto px-4 pt-3 animate-toast ${isWide ? 'max-w-5xl' : ''}`}>
          <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-3xl shadow-xs flex items-start gap-3">
            <div className="p-2 bg-amber-200/80 text-amber-800 rounded-2xl flex-shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 uppercase tracking-wider text-[10px]">
                  Supervisor Notice
                </span>
                <span className="text-[10px] text-amber-800 font-mono">
                  {broadcast.updatedAt || 'Live'}
                </span>
              </div>
              <p className="text-amber-900 leading-snug font-medium mt-0.5">
                {broadcast.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Area */}
      <main 
        key={`${location.pathname}-${isWide ? 'pc' : 'mobile'}`} 
        className={`flex-1 page-transition ${isWide ? 'w-full max-w-5xl mx-auto px-4 sm:px-6' : 'w-full'}`}
      >
        <Routes location={location}>
          <Route path="/request" element={<TeacherRequest />} />
          <Route path="/door" element={<QRDoorRouter user={user} />} />

          <Route
            path="/login"
            element={user ? <Navigate to="/dashboard" replace /> : <Login onLoginSuccess={handleLoginSuccess} />}
          />

          <Route
            path="/dashboard"
            element={
              user ? (
                <Dashboard
                  rooms={rooms}
                  supplies={supplies}
                  logs={logs}
                  setLogs={setLogs}
                  user={user}
                  assignments={assignments}
                  onlineUsers={onlineUsers}
                  teacherRequests={teacherRequests}
                  setTeacherRequests={setTeacherRequests}
                  isDesktopView={isWide}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/rooms"
            element={
              user ? (
                <Rooms 
                  rooms={rooms} 
                  setRooms={setRooms} 
                  user={user} 
                  assignments={assignments}
                  isDesktopView={isWide}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/supplies"
            element={
              user ? (
                <Supplies 
                  supplies={supplies} 
                  setSupplies={setSupplies} 
                  user={user} 
                  isDesktopView={isWide}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/profile"
            element={
              user ? (
                <Profile 
                  user={user} 
                  onLogout={handleLogout} 
                  assignments={assignments}
                  isDesktopView={isDesktopView}
                  onToggleDesktopView={handleToggleDesktopWithCurtain}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/admin"
            element={
              user?.role === 'admin' ? (
                <Admin
                  rooms={rooms}
                  setRooms={setRooms}
                  supplies={supplies}
                  setSupplies={setSupplies}
                  assignments={assignments}
                  setAssignments={setAssignments}
                  broadcast={broadcast}
                  setBroadcast={setBroadcast}
                  setLogs={setLogs}
                  onlineUsers={onlineUsers}
                  isDesktopView={isWide}
                />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />

          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </main>

      {/* Floating QR button on bottom-right */}
      {user && !isPublicPage && (
        <div className="fixed bottom-20 inset-x-0 pointer-events-none z-40">
          <div className={`mx-auto px-4 flex justify-end ${isWide ? 'max-w-5xl sm:px-6' : 'max-w-md'}`}>
            <button
              type="button"
              onClick={() => setShowGlobalScanner(true)}
              className="pointer-events-auto bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white p-2.5 rounded-full shadow-xl border border-white/20 flex items-center gap-2 transition"
              title="Scan Room QR Code"
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <QrCode className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-bold pr-2 hidden sm:inline">Scan QR</span>
            </button>
          </div>
        </div>
      )}

      <QRScannerModal
        isOpen={showGlobalScanner}
        onClose={() => setShowGlobalScanner(false)}
        onScanSuccess={handleGlobalScanSuccess}
        allRoomIds={allRoomIds}
      />

      {/* ============================================================== */}
      {/* 🔐 FIRST-TIME LOGIN MODERN PASSWORD REQUIREMENT INTERCEPTOR    */}
      {/* Email OTP (000-000) on top + Red/Green Dynamic Outlines         */}
      {/* ============================================================== */}
      {user?.is_first_login && (
        <div className="fixed inset-0 z-[260] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 animate-pop">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3 text-[#176e57]" />
                  Security Setup Required
                </span>
                <h3 className="font-extrabold text-slate-900 text-base mt-1.5">
                  First-Time Sign In
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Enter the verification code sent to your email and create a new password.
                </p>
              </div>
            </div>

            {(firstLoginError || (isTypingFirstPass && !passCheck.isValid)) && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl flex items-start gap-2 animate-shake">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="block font-bold text-rose-900 text-[11px]">
                    {passCheck.includesPersonalInfo || passCheck.isPredictable
                      ? 'Weak / Predictable Password Detected'
                      : 'Security Requirements Not Yet Met'}
                  </span>
                  <span className="block text-[11px] text-rose-700 font-medium leading-snug">
                    {firstLoginError || passCheck.warningMessage}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleFirstLoginSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Confirm Full Name:
                </label>
                <input
                  type="text"
                  required
                  value={firstLoginName}
                  onChange={(e) => setFirstLoginName(e.target.value)}
                  placeholder="e.g. Kuya Bert"
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#176e57] font-semibold"
                />
              </div>

              {/* Email OTP Input Bar (000-000) right above Create New Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Email OTP:
                  </label>
                  <button
                    type="button"
                    disabled={firstLoginResendTimer > 0 || isSendingFirstOtp}
                    onClick={() => sendFirstLoginEmailOtp(user)}
                    className={`text-[10px] font-bold transition ${
                      firstLoginResendTimer > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-[#176e57] hover:underline'
                    }`}
                  >
                    {isSendingFirstOtp ? 'Sending...' : firstLoginResendTimer > 0 ? `Resend (${firstLoginResendTimer}s)` : 'Resend OTP'}
                  </button>
                </div>

                <div className="relative">
                  <Mail className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                    !isTypingAppOtp
                      ? 'text-slate-400'
                      : isAppOtpValid
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
                    className={`w-full pl-8 pr-3 py-2.5 border-2 rounded-2xl font-mono font-bold tracking-widest text-center transition-all duration-200 focus:outline-none ${
                      !isTypingAppOtp
                        ? 'border-slate-200 bg-slate-50 text-slate-800 focus:border-[#176e57]'
                        : isAppOtpValid
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-rose-500 bg-rose-50/70 text-rose-950 ring-2 ring-rose-500/20'
                    }`}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Create New Password:
                  </label>
                  {isTypingFirstPass && (
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      passCheck.isValid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {passCheck.isValid ? 'Strong & Secure' : 'Weak / Incomplete'}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Lock className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                    !isTypingFirstPass
                      ? 'text-slate-400'
                      : passCheck.isValid
                      ? 'text-emerald-600'
                      : 'text-rose-500'
                  }`} />
                  <input
                    type={showFirstLoginPass ? 'text' : 'password'}
                    required
                    value={firstLoginPass}
                    onChange={(e) => {
                      setFirstLoginPass(e.target.value);
                      setFirstLoginError('');
                    }}
                    placeholder="Enter strong password"
                    className={`w-full pl-8 pr-9 py-2.5 border-2 rounded-2xl font-mono font-bold transition-all duration-200 focus:outline-none ${
                      !isTypingFirstPass
                        ? 'border-slate-200 bg-slate-50 text-slate-800 focus:border-[#176e57]'
                        : passCheck.isValid
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-rose-500 bg-rose-50/70 text-rose-950 ring-2 ring-rose-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFirstLoginPass(!showFirstLoginPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                  >
                    {showFirstLoginPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Confirm New Password:
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
                  <Lock className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                    !isConfirmTyping
                      ? 'text-slate-400'
                      : isConfirmMatching
                      ? 'text-emerald-600'
                      : 'text-rose-500'
                  }`} />
                  <input
                    type={showFirstLoginPass ? 'text' : 'password'}
                    required
                    value={firstLoginConfirm}
                    onChange={(e) => {
                      setFirstLoginConfirm(e.target.value);
                      setFirstLoginError('');
                    }}
                    placeholder="Re-enter password"
                    className={`w-full pl-8 pr-3 py-2.5 border-2 rounded-2xl font-mono font-bold transition-all duration-200 focus:outline-none ${
                      !isConfirmTyping
                        ? 'border-slate-200 bg-slate-50 text-slate-800 focus:border-[#176e57]'
                        : isConfirmMatching
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-rose-500 bg-rose-50/70 text-rose-950 ring-2 ring-rose-500/20'
                    }`}
                  />
                </div>
              </div>

              {/* Live Security Checklist (Red X vs Green Check) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Security Checklist
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${
                    passCheck.hasMinLength ? 'text-emerald-700' : isTypingFirstPass ? 'text-rose-600' : 'text-slate-400'
                  }`}>
                    {firstLoginPass.length}/6+ chars
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    { met: passCheck.hasLowercase, label: '1 Lowercase (a-z)' },
                    { met: passCheck.hasUppercase, label: '1 Uppercase (A-Z)' },
                    { met: passCheck.hasNumber, label: '1 Number (0-9)' },
                    { met: passCheck.hasSpecial, label: '1 Symbol (@#$!)' }
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

                <div className="pt-1.5 border-t border-slate-200/70 space-y-1.5 text-[11px]">
                  {[
                    {
                      met: passCheck.noPersonalInfo,
                      failAlert: passCheck.includesPersonalInfo,
                      passText: "Doesn't include personal name or ID",
                      failText: 'Includes your name or Staff ID'
                    },
                    {
                      met: passCheck.noPredictablePatterns,
                      failAlert: passCheck.isPredictable,
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
                disabled={isSavingFirstLogin || !isAppOtpValid || !passCheck.isValid || !isConfirmMatching}
                className="w-full py-3 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-45 disabled:pointer-events-none"
              >
                {isSavingFirstLogin ? 'Saving to Database...' : 'Save Password & Unlock Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {user && !isPublicPage && <Navbar user={user} isDesktopView={isWide} />}
    </div>
  );
}