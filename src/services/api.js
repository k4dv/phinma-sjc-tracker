// src/services/api.js
import { supabase } from '../data/supabaseClient';

const isLocalHost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const API_BASE = 'http://localhost:5000/api';

// Helper to attach authenticated user credentials to requests
const getHeaders = () => {
  const userStr = localStorage.getItem('sjc_active_user') || sessionStorage.getItem('sjc_active_user');
  const user = userStr ? JSON.parse(userStr) : null;

  return {
    'Content-Type': 'application/json',
    'x-user-role': user?.role || 'guest',
    'x-user-id': String(user?.id || 'anonymous')
  };
};

export const api = {
  // --- ROOMS ---
  async getRooms() {
    if (isLocalHost) {
      try {
        const res = await fetch(`${API_BASE}/rooms`, { headers: getHeaders() });
        if (res.ok) {
          const json = await res.json();
          return json.data || [];
        }
      } catch (_) {}
    }
    const { data, error } = await supabase.from('rooms').select('*').order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async updateRoom(id, updateData) {
    if (isLocalHost) {
      try {
        const res = await fetch(`${API_BASE}/rooms/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(updateData)
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    const { data, error } = await supabase.from('rooms').update(updateData).eq('id', id).select();
    if (error) throw error;
    return { success: true, data: data?.[0] };
  },

  // --- SUPPLIES (Full Cloud & Database Sync) ---
  async getSupplies() {
    if (isLocalHost) {
      try {
        const res = await fetch(`${API_BASE}/supplies`, { headers: getHeaders() });
        if (res.ok) {
          const json = await res.json();
          return json.data || [];
        }
      } catch (_) {}
    }
    const { data, error } = await supabase.from('supplies').select('*').order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addSupply(item) {
    if (isLocalHost) {
      try {
        const res = await fetch(`${API_BASE}/supplies`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(item)
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    const { data, error } = await supabase.from('supplies').insert([item]).select();
    if (error) throw error;
    return { success: true, data: data?.[0] };
  },

  async updateSupplyQty(id, quantity) {
    // 1. Direct Supabase write ensures instant cloud sync across all phones & devices
    try {
      const { data, error } = await supabase
        .from('supplies')
        .update({ quantity: Number(quantity) })
        .eq('id', id)
        .select();

      if (error) throw error;

      // 2. Dual-notify local express controller if running locally
      if (isLocalHost) {
        fetch(`${API_BASE}/supplies/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ quantity })
        }).catch(() => {});
      }

      return { success: true, data: data?.[0] };
    } catch (dbErr) {
      console.warn('Database stock update error:', dbErr);
      throw dbErr;
    }
  },

  async updateSupplyImage(id, imageUrl) {
    let { data, error } = await supabase
      .from('supplies')
      .update({ image_url: imageUrl })
      .eq('id', id)
      .select();

    if (error && error.message?.includes('image_url')) {
      const fallback = await supabase
        .from('supplies')
        .update({ image: imageUrl })
        .eq('id', id)
        .select();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return { success: true, data: data?.[0] };
  },

  async deleteSupply(id) {
    if (isLocalHost) {
      try {
        const res = await fetch(`${API_BASE}/supplies/${id}`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    const { error } = await supabase.from('supplies').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  // --- USER PROVISIONING & AUTH ---
  async getUsers() {
    if (isLocalHost) {
      try {
        const res = await fetch(`${API_BASE}/users`, { headers: getHeaders() });
        if (res.ok) {
          const json = await res.json();
          return json.data || [];
        }
      } catch (_) {}
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, access_level, is_first_login, avatar, created_at')
      .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createUser(userData) {
    if (isLocalHost) {
      try {
        const res = await fetch(`${API_BASE}/users`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(userData)
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        id: userData.id.trim(),
        name: userData.name.trim(),
        role: userData.role || 'staff',
        access_level: Number(userData.access_level) || 1,
        password: userData.temporaryPassword || 'sjc1234',
        is_first_login: true
      }])
      .select();
    if (error) throw error;
    return { success: true, data: data?.[0] };
  },

  async completeFirstLogin(id, { newPassword, updatedName }) {
    if (isLocalHost) {
      try {
        const res = await fetch(`${API_BASE}/users/${id}/first-login`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ newPassword, updatedName })
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    const { data, error } = await supabase
      .from('profiles')
      .update({
        password: newPassword,
        name: updatedName,
        is_first_login: false
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    return { success: true, data: data?.[0] };
  }
};