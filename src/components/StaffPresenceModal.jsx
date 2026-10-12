import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../data/supabaseClient';
import { api } from '../services/api';
import { Users, X, Shield, Building2, CheckCircle2 } from 'lucide-react';

const FALLBACK_ROSTER = [
  { id: 'admin', name: 'Facilities Supervisor', role: 'admin', shift: 'Full Campus Duty' },
  { id: '001', name: 'Kuya Bert', role: 'staff', shift: 'Morning Shift' },
  { id: '002', name: 'Ate Linda', role: 'staff', shift: 'Morning Shift' },
  { id: '003', name: 'Kuya Jun', role: 'staff', shift: 'Morning Shift' },
  { id: '004', name: 'Ate Marites', role: 'staff', shift: 'Afternoon Shift' },
  { id: '005', name: 'Kuya Jomar', role: 'staff', shift: 'Night Shift' }
];

export default function StaffPresenceModal({ 
  isOpen, 
  onClose, 
  onlineUsers = [], 
  assignments = {}, 
  currentUser 
}) {
  const [staffList, setStaffList] = useState(FALLBACK_ROSTER);
  const [avatars, setAvatars] = useState({});

  // Fetch full live roster from database when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchAllStaff = async () => {
      try {
        const users = await api.getUsers();
        if (users && users.length > 0) {
          setStaffList(users.map((u) => ({
            ...u,
            name: (u.name && u.name !== 'Staff Member')
              ? u.name
              : (FALLBACK_ROSTER.find((f) => f.id === u.id)?.name || u.name || `Staff ${u.id}`),
            shift: u.shift || (u.role === 'admin' ? 'Full Campus Duty' : 'Morning Shift')
          })));
        }
      } catch {
        try {
          const { data, error } = await supabase.from('profiles').select('*').order('id', { ascending: true });
          if (!error && data && data.length > 0) {
            setStaffList(data.map((u) => ({
              ...u,
              name: (u.name && u.name !== 'Staff Member')
                ? u.name
                : (FALLBACK_ROSTER.find((f) => f.id === u.id)?.name || u.name || `Staff ${u.id}`),
              shift: u.shift || (u.role === 'admin' ? 'Full Campus Duty' : 'Morning Shift')
            })));
          }
        } catch (err) {
          console.error('Failed to load roster:', err);
        }
      }

      // Fetch avatar photos
      try {
        const localMap = {};
        FALLBACK_ROSTER.forEach((m) => {
          const local = localStorage.getItem(`sjc_avatar_${m.id}`);
          if (local) localMap[m.id] = local;
        });

        const { data } = await supabase.from('profiles').select('id, avatar');
        if (data) {
          data.forEach((item) => {
            if (item.avatar) {
              localMap[item.id] = item.avatar;
              localStorage.setItem(`sjc_avatar_${item.id}`, item.avatar);
            }
          });
        }
        setAvatars(localMap);
      } catch (err) {
        console.warn('Avatars lookup warning:', err);
      }
    };

    fetchAllStaff();
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const getAvatar = (id) => {
    return avatars[id] || localStorage.getItem(`sjc_avatar_${id}`) || '';
  };

  const getAssignedFloors = (staffId) => {
    if (staffId === 'admin') return 'All Floors (Supervisor)';
    const cleanStaffId = String(staffId).replace(/^0+/, '');
    
    const assigned = Object.entries(assignments)
      .filter(([_, id]) => String(id).replace(/^0+/, '') === cleanStaffId)
      .map(([floor]) => `F${floor}`);
      
    return assigned.length > 0 ? assigned.join(', ') : 'Unassigned';
  };

  const isStaffOnline = (staffId) => {
    const cleanTarget = String(staffId).replace(/^0+/, '').toLowerCase();

    if (currentUser) {
      const cleanCurrent = String(currentUser.id || '').replace(/^0+/, '').toLowerCase();
      if (cleanCurrent === cleanTarget) return true;
    }

    return onlineUsers.some((u) => {
      const cleanUser = String(u.id || '').replace(/^0+/, '').toLowerCase();
      return cleanUser === cleanTarget;
    });
  };

  // Sort: Online personnel first
  const sortedRoster = [...staffList].sort((a, b) => {
    const aOnline = isStaffOnline(a.id);
    const bOnline = isStaffOnline(b.id);
    if (aOnline === bOnline) return 0;
    return aOnline ? -1 : 1;
  });

  const onlineCount = staffList.filter((s) => isStaffOnline(s.id)).length;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-sheet-up overflow-hidden space-y-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 text-[#176e57] rounded-xl">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Staff Presence</h2>
              <p className="text-[10px] text-slate-400">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                <strong>{onlineCount}</strong> online now &bull; {staffList.length - onlineCount} off-duty
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Staff Roster List */}
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
          {sortedRoster.map((staff) => {
            const online = isStaffOnline(staff.id);
            const isMe = currentUser && (
              String(currentUser.id).replace(/^0+/, '') === String(staff.id).replace(/^0+/, '')
            );
            const assignedFloors = getAssignedFloors(staff.id);
            const avatarUrl = getAvatar(staff.id);

            return (
              <div
                key={staff.id}
                className={`p-3 rounded-2xl border transition-all duration-150 flex items-center justify-between ${
                  online
                    ? 'bg-emerald-50/40 border-emerald-200/80 shadow-xs'
                    : 'bg-slate-50/70 border-slate-100 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar with Live Status Indicator */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden ${
                      staff.role === 'admin' 
                        ? 'bg-amber-600 text-white' 
                        : 'bg-[#176e57] text-white'
                    }`}>
                      {avatarUrl ? (
                        <img 
                          src={avatarUrl} 
                          alt={staff.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : staff.role === 'admin' ? (
                        <Shield className="w-4 h-4" />
                      ) : (
                        <span>{staff.name ? staff.name[0] : 'U'}</span>
                      )}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        online ? 'bg-emerald-500 ring-2 ring-emerald-400/40' : 'bg-slate-300'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-slate-800 leading-tight">
                        {staff.name}
                      </h4>
                      {isMe && (
                        <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-md">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {staff.role === 'admin' 
                        ? 'Campus Supervisor' 
                        : `ID: ${staff.id} • ${staff.shift || 'General Shift'}`}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-0.5 font-medium">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{assignedFloors}</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="text-right">
                  {online ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg animate-pop">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Active
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-slate-200/70 text-slate-500 text-[10px] font-semibold rounded-lg">
                      Offline
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}