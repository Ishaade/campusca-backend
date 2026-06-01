const express = require('express');
const validateRequest = require('../middleware/validateRequest');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const {
  createQuizSchema,
  updateQuizSchema,
  roomIdParamsSchema,
  quizIdParamsSchema,
  startAttemptSchema,
  submitAttemptSchema,
  updateAttemptSchema,
  attemptParamsSchema
} = require('../validators/quizSchemas');
const {
  createQuiz,
  listRoomQuizzes,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  startAttempt,
  submitAttempt,
  updateAttempt,
  listQuizAttempts,
  getMyAttempts
} = require('../controllers/quizzesController');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/rooms/:roomId',
  validateRequest({ params: roomIdParamsSchema }),
  listRoomQuizzes
);

router.post(
  '/rooms/:roomId',
  requireRole('teacher'),
  validateRequest({ params: roomIdParamsSchema, body: createQuizSchema }),
  createQuiz
);

router.get(
  '/:quizId',
  validateRequest({ params: quizIdParamsSchema }),
  getQuiz
);

router.patch(
  '/:quizId',
  requireRole('teacher'),
  validateRequest({ params: quizIdParamsSchema, body: updateQuizSchema }),
  updateQuiz
);

router.delete(
  '/:quizId',
  requireRole('teacher'),
  validateRequest({ params: quizIdParamsSchema }),
  deleteQuiz
);

router.post(
  '/:quizId/attempts',
  requireRole('student'),
  validateRequest({ params: quizIdParamsSchema, body: startAttemptSchema }),
  startAttempt
);

router.post(
  '/:quizId/attempts/:attemptId/submit',
  requireRole('student'),
  validateRequest({ params: attemptParamsSchema, body: submitAttemptSchema }),
  submitAttempt
);

router.patch(
  '/:quizId/attempts/:attemptId',
  requireRole('student'),
  validateRequest({ params: attemptParamsSchema, body: updateAttemptSchema }),
  updateAttempt
);

router.get(
  '/:quizId/attempts',
  validateRequest({ params: quizIdParamsSchema }),
  listQuizAttempts
);

// student: fetch logged-in student's attempts (all quizzes)
router.get(
  '/attempts/me',
  validateRequest({}),
  getMyAttempts
);

module.exports = router;

