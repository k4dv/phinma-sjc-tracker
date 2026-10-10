// src/services/api.js
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
    const res = await fetch(`${API_BASE}/rooms`, {
      headers: getHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async updateRoom(id, updateData) {
    const res = await fetch(`${API_BASE}/rooms/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updateData)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to update room');
    return json;
  },

  // --- SUPPLIES (Full CRUD) ---
  async getSupplies() {
    const res = await fetch(`${API_BASE}/supplies`, {
      headers: getHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async addSupply(item) {
    const res = await fetch(`${API_BASE}/supplies`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(item)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Unauthorized to add supplies');
    return json;
  },

  async updateSupplyQty(id, quantity) {
    const res = await fetch(`${API_BASE}/supplies/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ quantity })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to update stock');
    return json;
  },

  async deleteSupply(id) {
    const res = await fetch(`${API_BASE}/supplies/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Unauthorized to delete supplies');
    return json;
  }
};