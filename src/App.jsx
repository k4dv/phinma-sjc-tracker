import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Supplies from './pages/Supplies';
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

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('sjc_active_user') || sessionStorage.getItem('sjc_active_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Cached rooms prevents percentage flash on reload
  const [rooms, setRooms] = useState(() => {
    try {
      const cached = localStorage.getItem('sjc_cached_rooms');
      return cached ? JSON.parse(cached) : INITIAL_ROOMS;
    } catch {
      return INITIAL_ROOMS;
    }
  });

  const [supplies, setSupplies] = useState(INITIAL_SUPPLIES);
  const [logs, setLogs] = useState(INITIAL_LOGS);
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

  // Transition Curtain Stage: 'idle' | 'expanding' | 'spinning' | 'stopped' | 'sliding_up'
  const [curtainStage, setCurtainStage] = useState('idle');

  // Route Change Viewport Reset: snaps to top of header on mobile
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  // Initial animation and theme setup
  useEffect(() => {
    if (localStorage.getItem('sjc_animations_disabled') === 'true') {
      document.body.classList.add('disable-animations');
    } else {
      document.body.classList.remove('disable-animations');
    }

    document.documentElement.classList.remove('dark');
    localStorage.removeItem('sjc_theme');
  }, []);

  // 1. Initial Data Fetch via Node/Express MVC API (with Supabase fallback)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch Rooms & Supplies from the Node.js Express Backend
        const [backendRooms, backendSupplies, assignRes, broadRes, logsRes, reqsRes] = await Promise.all([
          api.getRooms().catch((err) => {
            console.warn('Express rooms API offline, falling back to Supabase client:', err);
            return null;
          }),
          api.getSupplies().catch((err) => {
            console.warn('Express supplies API offline, falling back to Supabase client:', err);
            return null;
          }),
          supabase.from('assignments').select('*'),
          supabase.from('broadcast').select('*').limit(1),
          supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(20),
          supabase.from('teacher_requests').select('*').order('created_at', { ascending: false }).limit(20)
        ]);

        // Process Rooms
        let rawRooms = backendRooms;
        if (!rawRooms) {
          const fallback = await supabase.from('rooms').select('*').order('id', { ascending: true });
          rawRooms = fallback.data || [];
        }

        if (rawRooms?.length) {
          const formattedRooms = rawRooms.map((r) => ({
            id: r.id,
            floor: r.floor,
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

        // Process Supplies
        let rawSupplies = backendSupplies;
        if (!rawSupplies) {
          const fallback = await supabase.from('supplies').select('*').order('id', { ascending: true });
          rawSupplies = fallback.data || [];
        }
        if (rawSupplies?.length) setSupplies(rawSupplies);

        // Process Assignments
        if (assignRes.data?.length) {
          const assignMap = {};
          assignRes.data.forEach((a) => { assignMap[a.floor] = a.staff_id; });
          setAssignments(assignMap);
        }

        // Process Broadcast Notice
        if (broadRes.data && broadRes.data.length > 0) {
          const b = broadRes.data[0];
          setBroadcast({
            active: b.active,
            message: b.message,
            postedBy: b.posted_by,
            updatedAt: b.updated_at
          });
        }

        // Process Logs & Requests
        if (logsRes.data?.length) setLogs(logsRes.data);

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

  // 2. Real-Time WebSocket Subscriptions & Local Sync
  useEffect(() => {
    const handleNewRequestEvent = (e) => {
      if (e.detail) {
        setTeacherRequests((prev) => [e.detail, ...prev.filter((r) => r.id !== e.detail.id)]);
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
    };

    window.addEventListener('sjc_request_created', handleNewRequestEvent);
    window.addEventListener('storage', handleStorageChange);

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = payload.new;
          setRooms((prev) => {
            const next = prev.map((r) => r.id === updated.id ? {
              id: updated.id,
              floor: updated.floor,
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
            } : r);
            localStorage.setItem('sjc_cached_rooms', JSON.stringify(next));
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplies' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = payload.new;
          setSupplies((prev) => prev.map((s) => s.id === updated.id ? updated : s));
        } else if (payload.eventType === 'INSERT' && payload.new) {
          setSupplies((prev) => {
            if (prev.some((s) => s.id === payload.new.id || s.name === payload.new.name)) return prev;
            return [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setSupplies((prev) => prev.filter((s) => s.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, (payload) => {
        if (payload.new) {
          const updated = payload.new;
          setAssignments((prev) => ({ ...prev, [updated.floor]: updated.staff_id }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast' }, (payload) => {
        if (payload.new) {
          const updated = payload.new;
          setBroadcast({
            active: updated.active,
            message: updated.message,
            postedBy: updated.posted_by,
            updatedAt: updated.updated_at
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          setLogs((prev) => {
            const isDuplicate = prev.some(
              (item) => item.id === payload.new.id || (item.text === payload.new.text && item.time === payload.new.time)
            );
            if (isDuplicate) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setLogs((prev) => prev.filter((l) => l.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_requests' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          setTeacherRequests((prev) => {
            const next = [payload.new, ...prev.filter((r) => r.id !== payload.new.id)];
            localStorage.setItem('sjc_teacher_requests', JSON.stringify(next));
            return next;
          });
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          setTeacherRequests((prev) => {
            const next = prev.map((r) => r.id === payload.new.id ? payload.new : r);
            localStorage.setItem('sjc_teacher_requests', JSON.stringify(next));
            return next;
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setTeacherRequests((prev) => {
            const next = prev.filter((r) => r.id !== payload.old.id);
            localStorage.setItem('sjc_teacher_requests', JSON.stringify(next));
            return next;
          });
        }
      })
      .subscribe();

    return () => {
      window.removeEventListener('sjc_request_created', handleNewRequestEvent);
      window.removeEventListener('storage', handleStorageChange);
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Supabase Real-Time Presence
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

  // Measured Login Transition Sequence with Virtual Keyboard Dismissal
  const handleLoginSuccess = (userData, remember) => {
    sessionStorage.removeItem('sjc_dash_animated');

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    const isQuickLogin = localStorage.getItem('sjc_quick_login') === 'true' || 
                         localStorage.getItem('sjc_animations_disabled') === 'true';

    const persistUser = () => {
      setUser(userData);
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
      navigate('/dashboard');
      return;
    }

    setCurtainStage('expanding');

    setTimeout(() => {
      setCurtainStage('spinning');
    }, 700);

    setTimeout(() => {
      setCurtainStage('stopped');
    }, 2900);

    setTimeout(() => {
      persistUser();
      navigate('/dashboard');
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      setCurtainStage('sliding_up');
    }, 3250);

    setTimeout(() => {
      setCurtainStage('idle');
    }, 4150);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sjc_dash_animated');
    setUser(null);
    localStorage.removeItem('sjc_active_user');
    sessionStorage.removeItem('sjc_active_user');
  };

  const handleGlobalScanSuccess = (scannedRoomId) => {
    navigate('/rooms', {
      state: {
        targetRoomId: scannedRoomId,
        targetFloor: Number(String(scannedRoomId)[0]),
        scanTimestamp: Date.now()
      }
    });
  };

  const isPublicPage = location.pathname === '/request' || location.pathname === '/door';
  const allRoomIds = rooms.map((r) => String(r.id));
  const isCurtainActive = curtainStage !== 'idle';

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8fafc] shadow-xl flex flex-col relative overflow-x-hidden font-sans">
      
      {/* CINEMATIC CURTAIN */}
      {isCurtainActive && (
        <div 
          className={`fixed inset-x-0 top-0 z-50 overflow-hidden flex flex-col justify-center items-center text-white bg-slate-950 max-w-md mx-auto pointer-events-none will-change-transform ${
            curtainStage === 'sliding_up' ? 'animate-curtain-up' : 'animate-curtain-down'
          }`}
        >
          <img
            src={schoolBg}
            alt="PHINMA SJC"
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none opacity-40 will-change-transform"
          />

          <div className="absolute inset-0 bg-[#0c3b2e]/60 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#176e57] via-black/35 to-black/55 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center justify-center">
            <div 
              className={`w-24 h-24 rounded-3xl bg-white p-2 shadow-2xl flex items-center justify-center ring-4 ring-white/90 will-change-transform ${
                curtainStage === 'spinning' || curtainStage === 'stopped' || curtainStage === 'sliding_up'
                  ? 'animate-logo-spin'
                  : ''
              }`}
            >
              <img
                src={sjcLogo}
                alt="PHINMA SJC Crest"
                className="w-full h-full object-contain pointer-events-none rounded-2xl"
              />
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

      {user && !isPublicPage && broadcast?.active && broadcast?.message && (
        <div className="px-4 pt-3 animate-toast">
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl shadow-xs flex items-start gap-2.5">
            <div className="p-1.5 bg-amber-200/80 text-amber-800 rounded-xl flex-shrink-0">
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

      <main key={location.pathname} className="flex-1 page-transition">
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
        <div className="fixed bottom-20 inset-x-0 max-w-md mx-auto px-4 pointer-events-none z-30 flex justify-end">
          <button
            type="button"
            onClick={() => setShowGlobalScanner(true)}
            className="pointer-events-auto bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white p-2 rounded-2xl shadow-xl border border-white/25 flex items-center gap-2 transition-all duration-150 group"
            title="Scan Room QR Code"
          >
            <div className="text-right pl-1.5 leading-tight">
              <span className="text-[11px] font-bold block text-white">QR Code</span>
              <span className="text-[9px] text-emerald-200 block font-medium">Quick Scan</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <QrCode className="w-4 h-4 text-white" />
            </div>
          </button>
        </div>
      )}

      {/* Global QR Scanner Modal */}
      <QRScannerModal
        isOpen={showGlobalScanner}
        onClose={() => setShowGlobalScanner(false)}
        onScanSuccess={handleGlobalScanSuccess}
        allRoomIds={allRoomIds}
      />

      {user && !isPublicPage && <Navbar user={user} />}
    </div>
  );
}