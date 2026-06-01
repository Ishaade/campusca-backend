const express = require('express');
const validateRequest = require('../middleware/validateRequest');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { roomIdParamsSchema } = require('../validators/roomSchemas');
const { getRoomAnalytics } = require('../controllers/analyticsController');

const router = express.Router();

router.use(requireAuth, requireRole('teacher'));

router.get(
  '/rooms/:roomId',
  validateRequest({ params: roomIdParamsSchema }),
  getRoomAnalytics
);

module.exports = router;

