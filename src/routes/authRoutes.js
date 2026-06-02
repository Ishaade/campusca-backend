const express = require('express');
const validateRequest = require('../middleware/validateRequest');
const {
  registerSchema,
  loginSchema,
  changeStudentPasswordSchema,
  userIdParamsSchema,
  adminSetPasswordSchema
} = require('../validators/authSchemas');
const {
  register,
  adminRegisterUser,
  adminListUsers,
  adminDeleteUser,
  adminSetUserPassword,
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
router.post(
  '/admin/users/:userId/set-password',
  requireAuth,
  requireRole('admin'),
  validateRequest({ params: userIdParamsSchema, body: adminSetPasswordSchema }),
  adminSetUserPassword
);

// Login endpoint with validation
router.post('/login', validateRequest({ body: loginSchema }), login);

// Student password change (no email; limited attempts)
router.get('/student/password-change-info', requireAuth, requireRole('student'), getPasswordChangeInfo);
router.post(
  '/student/change-password',
  requireAuth,
  requireRole('student'),
  validateRequest({ body: changeStudentPasswordSchema }),
  changeStudentPassword
);

// Get profile endpoint with authentication required
router.get('/me', requireAuth, getProfile);

module.exports = router;
