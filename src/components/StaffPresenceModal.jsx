import React, { useState, useEffect } from 'react';
import { Users, X, Shield, User, Building2, CheckCircle2 } from 'lucide-react';

// Official SJC Custodial Team Roster (Independent of mockData.js)
const ALL_ROSTER = [
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
  if (!isOpen) return null;

  // Retrieve cached profile pictures if any were uploaded
  const getAvatar = (id) => {
    return localStorage.getItem(`sjc_avatar_${id}`) || '';
  };

  // Determine assigned floors for each staff member
  const getAssignedFloors = (staffId) => {
    if (staffId === 'admin') return 'All Floors (Supervisor)';
    const cleanStaffId = String(staffId).replace(/^0+/, '');
    
    const assigned = Object.entries(assignments)
      .filter(([_, id]) => String(id).replace(/^0+/, '') === cleanStaffId)
      .map(([floor]) => `F${floor}`);
      
    return assigned.length > 0 ? assigned.join(', ') : 'Unassigned';
  };

  // Check if staff member is online in real time (flexible for 001 vs 1)
  const isStaffOnline = (staffId) => {
    const cleanTarget = String(staffId).replace(/^0+/, '').toLowerCase();

    // If the person currently viewing the modal is this staff member
    if (currentUser) {
      const cleanCurrent = String(currentUser.id || '').replace(/^0+/, '').toLowerCase();
      if (cleanCurrent === cleanTarget) return true;
    }

    // Check if present in Supabase live presence
    return onlineUsers.some((u) => {
      const cleanUser = String(u.id || '').replace(/^0+/, '').toLowerCase();
      return cleanUser === cleanTarget;
    });
  };

  // Sort: Online personnel first
  const sortedRoster = [...ALL_ROSTER].sort((a, b) => {
    const aOnline = isStaffOnline(a.id);
    const bOnline = isStaffOnline(b.id);
    if (aOnline === bOnline) return 0;
    return aOnline ? -1 : 1;
  });

  const onlineCount = ALL_ROSTER.filter((s) => isStaffOnline(s.id)).length;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-backdrop select-none"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-md rounded-t-[28px] sm:rounded-2xl p-5 shadow-2xl space-y-4 animate-sheet-up border-t sm:border border-slate-100 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#176e57] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Custodial Staff Presence</h2>
              <p className="text-[10px] text-slate-400">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                <strong>{onlineCount}</strong> online now • {ALL_ROSTER.length - onlineCount} off-duty
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Staff Roster List */}
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
                  {/* Avatar with Live Indicator */}
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
                        <span>{staff.name[0]}</span>
                      )}
                    </div>
                    {/* Pulsing Green or Grey Dot */}
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
                      {staff.role === 'admin' ? 'Campus Supervisor' : `ID: ${staff.id} • ${staff.shift}`}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-0.5 font-medium">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{assignedFloors}</span>
                    </div>
                  </div>
                </div>

                {/* Status Pill */}
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
    </div>
  );
}