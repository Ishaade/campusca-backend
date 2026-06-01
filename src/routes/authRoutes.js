const express = require('express');
const validateRequest = require('../middleware/validateRequest');
const { registerSchema, loginSchema, changeStudentPasswordSchema } = require('../validators/authSchemas');
const {
  register,
  adminRegisterUser,
  adminListUsers,
  adminDeleteUser,
  login,
  getProfile
} = require('../controllers/authController');
const {
  getPasswordChangeInfo,
  changeStudentPassword
} = require('../controllers/studentPasswordController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Register endpoint with validation
router.post('/register', validateRequest({ body: registerSchema }), register);

// Admin-only user creation endpoint
router.post(
  '/admin/register-user',
  requireAuth,
  requireRole('admin'),
  validateRequest({ body: registerSchema }),
  adminRegisterUser
);
router.get('/admin/users', requireAuth, requireRole('admin'), adminListUsers);
router.delete('/admin/users/:userId', requireAuth, requireRole('admin'), adminDeleteUser);

// Login endpoint with validation
router.post('/login', validateRequest({ body: loginSchema }), login);

// Student password change (no email; limited attempts)
router.get('/student/password-change-info', getPasswordChangeInfo);
router.post(
  '/student/change-password',
  validateRequest({ body: changeStudentPasswordSchema }),
  changeStudentPassword
);

// Get profile endpoint with authentication required
router.get('/me', requireAuth, getProfile);

module.exports = router;
