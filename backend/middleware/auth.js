// backend/middleware/auth.js

// Validates that the request comes from an authenticated user
exports.requireAuth = (req, res, next) => {
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];

  if (!role || role === 'guest' || !userId || userId === 'anonymous') {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in first.'
    });
  }

  req.currentUser = { id: userId, role };
  next();
};

// Restricts destructive operations strictly to Admins
exports.requireAdmin = (req, res, next) => {
  const role = req.headers['x-user-role'];

  if (role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access Forbidden: Admin privileges required for this action.'
    });
  }

  next();
};