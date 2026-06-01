const { z } = require('zod');

const questionSchema = z.object({
  id: z.union([z.string().uuid().optional(), z.number()]).optional(),
  question: z.string().min(3),
  type: z.enum(['multiple-choice', 'true-false', 'short-answer']),
  options: z.array(z.string().max(300)).length(4).optional(),
  correctAnswer: z.union([z.number().int().min(0).max(3), z.boolean(), z.string()]).optional(),
  sampleAnswer: z.string().optional().or(z.literal('')),
  points: z.number().int().min(1).max(100),
  courseOutcome: z.string().optional().or(z.literal('')),
  bloomsTaxonomy: z
    .enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'])
    .optional()
    .or(z.literal(''))
});

const createQuizSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional().or(z.literal('')),
  timeLimit: z.number().int().min(1).max(180),
  scheduledStart: z.string().datetime().optional().or(z.literal('')),
  scheduledEnd: z.string().datetime().optional().or(z.literal('')),
  attemptsAllowed: z.number().int().min(1).max(10),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  questions: z.array(questionSchema).min(1)
});

const updateQuizSchema = createQuizSchema.partial({
  title: true,
  timeLimit: true,
  attemptsAllowed: true,
  shuffleQuestions: true,
  shuffleOptions: true,
  questions: true
});

const roomIdParamsSchema = z.object({
  roomId: z.string().uuid()
});

const quizIdParamsSchema = z.object({
  quizId: z.string().uuid()
});

const startAttemptSchema = z.object({
  roomId: z.string().uuid()
});

const submitAttemptSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      response: z.union([z.string(), z.number(), z.boolean()])
    })
  ),
  elapsedSeconds: z.number().int().min(0).optional()
});

const updateAttemptSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      response: z.union([z.string(), z.number(), z.boolean()])
    })
  ).optional(),
  elapsedSeconds: z.number().int().min(0).optional()
});

const attemptParamsSchema = z.object({
  quizId: z.string().uuid(),
  attemptId: z.string().uuid()
});

module.exports = {
  createQuizSchema,
  updateQuizSchema,
  roomIdParamsSchema,
  quizIdParamsSchema,
  startAttemptSchema,
  submitAttemptSchema,
  attemptParamsSchema
};

