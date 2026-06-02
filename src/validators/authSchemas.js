const { z } = require('zod');

const roleEnum = z.enum(['student', 'teacher', 'admin']);

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(256),
  role: roleEnum.refine((value) => value !== 'admin', {
    message: 'Admin users cannot be created from this endpoint'
  })
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(256)
});

const changeStudentPasswordSchema = z.object({
  currentPassword: z.string().min(6).max(256),
  newPassword: z.string().min(6).max(256)
});

const userIdParamsSchema = z.object({
  userId: z.string().uuid()
});

const adminSetPasswordSchema = z.object({
  newPassword: z.string().min(6).max(256)
});

module.exports = {
  registerSchema,
  loginSchema,
  changeStudentPasswordSchema,
  userIdParamsSchema,
  adminSetPasswordSchema
};

