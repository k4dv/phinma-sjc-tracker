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
import sjcLogo from './assets/Logo.jpg';
import schoolBg from './assets/School.jpg';
import { Megaphone, QrCode } from 'lucide-react';
import { 
  INITIAL_ROOMS, 
  INITIAL_SUPPLIES, 
  INITIAL_LOGS, 
  INITIAL_ASSIGNMENTS, 
  INITIAL_BROADCAST 
} from './data/mockData';

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
            // Preserve local notes
            prev.forEach((l) => map.set(l.id, l));
            // Merge remote database rows
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

      {user && !isPublicPage && <Navbar user={user} isDesktopView={isWide} />}
    </div>
  );
}