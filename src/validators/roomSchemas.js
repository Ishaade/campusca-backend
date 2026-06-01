const { z } = require('zod');

const roomBaseSchema = {
  name: z.string().min(3).max(150),
  description: z.string().max(1000).optional().or(z.literal('')),
  subject: z.string().max(120).optional().or(z.literal('')),
  maxStudents: z.number().int().min(1).max(200),
  allowSelfJoin: z.boolean(),
  requireApproval: z.boolean()
};

const createRoomSchema = z.object(roomBaseSchema);

const updateRoomSchema = z.object({
  ...roomBaseSchema
});

const joinRoomSchema = z.object({
  code: z.string().length(6)
});

const roomIdParamsSchema = z.object({
  roomId: z.string().uuid()
});

const roomCodeParamsSchema = z.object({
  code: z.string().min(1)
});

const memberParamsSchema = z.object({
  roomId: z.string().uuid(),
  memberId: z.string().uuid()
});

module.exports = {
  createRoomSchema,
  updateRoomSchema,
  joinRoomSchema,
  roomIdParamsSchema,
  roomCodeParamsSchema,
  memberParamsSchema
};

