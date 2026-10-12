// src/services/api.js
import { supabase } from '../data/supabaseClient';

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
    try {
      const res = await fetch(`${API_BASE}/rooms`, { headers: getHeaders() });
      if (!res.ok) throw new Error('API fetch failed');
      const json = await res.json();
      return json.data || [];
    } catch {
      const { data, error } = await supabase.from('rooms').select('*').order('id', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  },

  async updateRoom(id, updateData) {
    try {
      const res = await fetch(`${API_BASE}/rooms/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData)
      });
      if (!res.ok) throw new Error('API update failed');
      return await res.json();
    } catch {
      const { data, error } = await supabase.from('rooms').update(updateData).eq('id', id).select();
      if (error) throw error;
      return { success: true, data: data[0] };
    }
  },

  // --- SUPPLIES (Full CRUD) ---
  async getSupplies() {
    try {
      const res = await fetch(`${API_BASE}/supplies`, { headers: getHeaders() });
      if (!res.ok) throw new Error('API fetch failed');
      const json = await res.json();
      return json.data || [];
    } catch {
      const { data, error } = await supabase.from('supplies').select('*').order('id', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  },

  async addSupply(item) {
    try {
      const res = await fetch(`${API_BASE}/supplies`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(item)
      });
      if (!res.ok) throw new Error('Unauthorized to add supplies');
      return await res.json();
    } catch {
      const { data, error } = await supabase.from('supplies').insert([item]).select();
      if (error) throw error;
      return { success: true, data: data[0] };
    }
  },

  async updateSupplyQty(id, quantity) {
    try {
      const res = await fetch(`${API_BASE}/supplies/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ quantity })
      });
      if (!res.ok) throw new Error('Failed to update stock');
      return await res.json();
    } catch {
      const { data, error } = await supabase.from('supplies').update({ quantity }).eq('id', id).select();
      if (error) throw error;
      return { success: true, data: data[0] };
    }
  },

  async deleteSupply(id) {
    try {
      const res = await fetch(`${API_BASE}/supplies/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Unauthorized to delete supplies');
      return await res.json();
    } catch {
      const { error } = await supabase.from('supplies').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    }
  },

  // --- USER PROVISIONING & AUTH ---
  async getUsers() {
    try {
      const res = await fetch(`${API_BASE}/users`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch users from backend');
      const json = await res.json();
      return json.data || [];
    } catch {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, access_level, is_first_login, avatar, created_at')
        .order('id', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  },

  async createUser(userData) {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(userData)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to create user account');
      return json;
    } catch {
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
      return { success: true, data: data[0] };
    }
  },

  async completeFirstLogin(id, { newPassword, updatedName }) {
    try {
      const res = await fetch(`${API_BASE}/users/${id}/first-login`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ newPassword, updatedName })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to update credentials');
      return json;
    } catch {
      // Direct Supabase fallback for live Vercel deployments
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
      return { success: true, data: data[0] };
    }
  }
};