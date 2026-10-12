const UserModel = require('../models/userModel');

exports.getUsers = async (req, res) => {
  try {
    const users = await UserModel.getAllUsers();
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { id, name, role, access_level, temporaryPassword } = req.body;

    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'ID and Name are required.' });
    }

    const newUser = await UserModel.createUser({ id, name, role, access_level, temporaryPassword });
    res.status(201).json({ success: true, data: newUser, message: 'Account created successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.completeFirstLogin = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, updatedName } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const updatedUser = await UserModel.updateFirstLogin(id, newPassword, updatedName);
    res.status(200).json({ success: true, data: updatedUser, message: 'Password updated. First login completed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};