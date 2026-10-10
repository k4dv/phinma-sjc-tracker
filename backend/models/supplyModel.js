const supabase = require('../config/db');

const SupplyModel = {
  // READ (All supplies)
  async getAllSupplies() {
    const { data, error } = await supabase
      .from('supplies')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return data;
  },

  // CREATE (Add item)
  async createSupply(item) {
    const { data, error } = await supabase
      .from('supplies')
      .insert([item])
      .select();
    if (error) throw error;
    return data[0];
  },

  // UPDATE (Adjust quantity)
  async updateQuantity(id, quantity) {
    const { data, error } = await supabase
      .from('supplies')
      .update({ quantity })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },

  // DELETE (Remove item)
  async deleteSupply(id) {
    const { error } = await supabase
      .from('supplies')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

module.exports = SupplyModel;