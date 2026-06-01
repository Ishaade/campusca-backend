const express = require('express');
const validateRequest = require('../middleware/validateRequest');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const {
  createRoomSchema,
  updateRoomSchema,
  joinRoomSchema,
  roomIdParamsSchema,
  roomCodeParamsSchema,
  memberParamsSchema
} = require('../validators/roomSchemas');
const {
  listRooms,
  createRoom,
  getRoom,
  getRoomByCode,
  updateRoom,
  deleteRoom,
  joinRoom,
  approveMember,
  rejectMember
} = require('../controllers/roomsController');

const router = express.Router();

router.use(requireAuth);

router.get('/', listRooms);

router.get(
  '/code/:code',
  validateRequest({ params: roomCodeParamsSchema }),
  getRoomByCode
);

router.post('/', requireRole('teacher'), validateRequest({ body: createRoomSchema }), createRoom);

router.get(
  '/:roomId',
  validateRequest({ params: roomIdParamsSchema }),
  getRoom
);

router.patch(
  '/:roomId',
  requireRole('teacher'),
  validateRequest({ params: roomIdParamsSchema, body: updateRoomSchema }),
  updateRoom
);

router.delete(
  '/:roomId',
  requireRole('teacher'),
  validateRequest({ params: roomIdParamsSchema }),
  deleteRoom
);

router.post('/join', requireRole('student'), validateRequest({ body: joinRoomSchema }), joinRoom);

router.post(
  '/:roomId/members/:memberId/approve',
  requireRole('teacher'),
  validateRequest({ params: memberParamsSchema }),
  approveMember
);

router.post(
  '/:roomId/members/:memberId/reject',
  requireRole('teacher'),
  validateRequest({ params: memberParamsSchema }),
  rejectMember
);

module.exports = router;

