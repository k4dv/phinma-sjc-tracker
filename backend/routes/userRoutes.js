const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Any logged-in staff can read user profiles
router.get('/', requireAuth, userController.getUsers);

// Only Admins can create new user accounts
router.post('/', requireAdmin, userController.createUser);

// User sets new permanent password on first login
router.put('/:id/first-login', requireAuth, userController.completeFirstLogin);

module.exports = router;