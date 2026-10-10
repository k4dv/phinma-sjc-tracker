// backend/routes/roomRoutes.js
const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController.js');

router.get('/', roomController.getRooms);
router.get('/:id', roomController.getRoomById);
router.put('/:id', roomController.updateRoomInspection);
router.post('/blast-ac', roomController.blastAllACs);

module.exports = router;