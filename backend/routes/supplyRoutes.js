// backend/routes/supplyRoutes.js
const express = require('express');
const router = express.Router();
const supplyController = require('../controllers/supplyController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Anyone logged in can read inventory
router.get('/', supplyController.getSupplies);

// Only ADMINS can add new items or delete items
router.post('/', requireAdmin, supplyController.addSupply);
router.delete('/:id', requireAdmin, supplyController.deleteSupply);

// Custodians and Admins can adjust quantities
router.put('/:id', requireAuth, supplyController.updateSupplyQuantity);

module.exports = router;