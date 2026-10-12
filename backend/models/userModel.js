const supabase = require('../config/db');

const UserModel = {
  // Fetch all accounts for supervisor roster
  async getAllUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, access_level, is_first_login, avatar, created_at')
      .order('id', { ascending: true });
    if (error) throw error;
    return data;
  },

  // Admin registers a new staff or admin user
  async createUser({ id, name, role, access_level, temporaryPassword }) {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        id: id.trim(),
        name: name.trim(),
        role: role || 'staff',
        access_level: Number(access_level) || 1,
        password: temporaryPassword || 'sjc1234',
        is_first_login: true
      }])
      .select();
    if (error) throw error;
    return data[0];
  },

  // User changes temp password on first login
  async updateFirstLogin(id, newPassword, updatedName) {
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
    return data[0];
  }
};

module.exports = UserModel;