const SupplyModel = require('../models/supplyModel');

// GET /api/supplies
exports.getSupplies = async (req, res) => {
  try {
    const supplies = await SupplyModel.getAllSupplies();
    res.status(200).json({ success: true, count: supplies.length, data: supplies });
  } catch (error) {
    console.error('Error fetching supplies:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving supplies' });
  }
};

// POST /api/supplies
exports.addSupply = async (req, res) => {
  try {
    const { name, category, quantity, unit, threshold } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Item name is required' });
    }

    const newItem = {
      name: name.trim(),
      category: category || 'General',
      quantity: parseInt(quantity, 10) || 0,
      unit: unit || 'pcs',
      threshold: parseInt(threshold, 10) || 1
    };

    const created = await SupplyModel.createSupply(newItem);
    res.status(201).json({ success: true, message: 'Item added successfully', data: created });
  } catch (error) {
    console.error('Error adding supply:', error);
    res.status(500).json({ success: false, message: 'Server error adding supply item' });
  }
};

// PUT /api/supplies/:id
exports.updateSupplyQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ success: false, message: 'Valid non-negative quantity required' });
    }

    const updated = await SupplyModel.updateQuantity(id, quantity);
    res.status(200).json({ success: true, message: 'Stock updated', data: updated });
  } catch (error) {
    console.error('Error updating stock quantity:', error);
    res.status(500).json({ success: false, message: 'Server error updating stock' });
  }
};

// DELETE /api/supplies/:id
exports.deleteSupply = async (req, res) => {
  try {
    const { id } = req.params;
    await SupplyModel.deleteSupply(id);
    res.status(200).json({ success: true, message: `Supply #${id} deleted` });
  } catch (error) {
    console.error('Error deleting supply:', error);
    res.status(500).json({ success: false, message: 'Server error deleting supply' });
  }
};