// backend/models/roomModel.js
const supabase = require('../config/db');

const RoomModel = {
  // Read all rooms
  async getAllRooms() {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return data;
  },

  // Read a single room by ID
  async getRoomById(id) {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Update room inspection details
  async updateRoom(id, updateData) {
    const { data, error } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data;
  },

  // Easter Egg: Turn on all ACs
  async setAllACs(status) {
    const { data, error } = await supabase
      .from('rooms')
      .update({ ac_checked: status })
      .neq('id', 'placeholder_bypass');
    if (error) throw error;
    return data;
  }
};

module.exports = RoomModel;