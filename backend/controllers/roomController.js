// backend/controllers/roomController.js
const RoomModel = require('../models/roomModel.js');

// GET /api/rooms
exports.getRooms = async (req, res) => {
  try {
    const rooms = await RoomModel.getAllRooms();
    res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ success: false, message: 'Server error fetching room records' });
  }
};

// GET /api/rooms/:id
exports.getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await RoomModel.getRoomById(id);
    if (!room) {
      return res.status(404).json({ success: false, message: `Room ${id} not found` });
    }
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    console.error('Error fetching single room:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving room' });
  }
};

// PUT /api/rooms/:id
exports.updateRoomInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, staff, ac_checked, lights_checked, door_checked, has_students, notes, reclean_reason } = req.body;

    // Validation
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status field is required.' });
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const payload = {
      status,
      staff: staff || 'Staff',
      last_cleaned: nowTime,
      ac_checked: ac_checked ?? true,
      lights_checked: lights_checked ?? true,
      door_checked: door_checked ?? true,
      has_students: Boolean(has_students),
      notes: notes || '',
      reclean_reason: status === 'needs_reclean' ? reclean_reason : null
    };

    const updated = await RoomModel.updateRoom(id, payload);
    res.status(200).json({ success: true, message: `Room ${id} updated successfully`, data: updated });
  } catch (error) {
    console.error('Error updating room inspection:', error);
    res.status(500).json({ success: false, message: 'Server error updating inspection' });
  }
};

// POST /api/rooms/blast-ac
exports.blastAllACs = async (req, res) => {
  try {
    await RoomModel.setAllACs(false);
    res.status(200).json({ success: true, message: 'Central bypass active: All ACs turned ON' });
  } catch (error) {
    console.error('Error during climate bypass:', error);
    res.status(500).json({ success: false, message: 'Failed to trigger climate override' });
  }
};