const { query } = require('../config/db');
const HttpError = require('../utils/httpError');
const { scoreQuizAttempt } = require('../services/quizScoringService');

function calcTotalPoints(questions = []) {
  return questions.reduce((sum, question) => sum + (question.points || 0), 0);
}

async function assertRoomOwnership(roomId, userId) {
  const rows = await query('SELECT teacher_id FROM rooms WHERE id = ? LIMIT 1', [roomId]);
  const data = rows[0];
  if (!data) throw new HttpError(404, 'Room not found');
  if (data.teacher_id !== userId) throw new HttpError(403, 'Forbidden');
}

async function assertRoomMembership(roomId, userId) {
  const rows = await query('SELECT id, status FROM room_members WHERE room_id = ? AND student_id = ? LIMIT 1', [roomId, userId]);
  const data = rows[0];
  if (!data) throw new HttpError(403, 'You are not a member of this room');
  if (data.status !== 'active') throw new HttpError(403, 'Membership pending approval');
}

async function createQuiz(req, res, next) {
  const { roomId } = req.params;

  try {
    await assertRoomOwnership(roomId, req.user.id);

    if (req.body.scheduledStart && req.body.scheduledEnd) {
      if (new Date(req.body.scheduledEnd) <= new Date(req.body.scheduledStart)) {
        throw new HttpError(400, 'scheduledEnd must be after scheduledStart');
      }
    }

    const totalPoints = calcTotalPoints(req.body.questions || []);

    const result = await query(
      'INSERT INTO quizzes (room_id, title, description, time_limit, scheduled_start, scheduled_end, attempts_allowed, shuffle_questions, shuffle_options, questions, total_points, status, teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [
        roomId,
        req.body.title,
        req.body.description || null,
        req.body.timeLimit,
        req.body.scheduledStart || null,
        req.body.scheduledEnd || null,
        req.body.attemptsAllowed,
        !!req.body.shuffleQuestions,
        !!req.body.shuffleOptions,
        JSON.stringify(req.body.questions || []),
        totalPoints,
        'draft',
        req.user.id
      ]
    );

    const [quiz] = await query('SELECT * FROM quizzes WHERE id = ? LIMIT 1', [result.insertId]);
    if (quiz && typeof quiz.questions === 'string') quiz.questions = JSON.parse(quiz.questions);

    return res.status(201).json({ status: 'success', quiz });
  } catch (error) {
    return next(error);
  }
}

async function listRoomQuizzes(req, res, next) {
  const { roomId } = req.params;

  try {
    if (req.user.role === 'teacher') {
      await assertRoomOwnership(roomId, req.user.id);
    } else {
      await assertRoomMembership(roomId, req.user.id);
    }

    const quizzes = await query('SELECT * FROM quizzes WHERE room_id = ? ORDER BY created_at DESC', [roomId]);
    quizzes.forEach((q) => {
      if (q && typeof q.questions === 'string') {
        try { q.questions = JSON.parse(q.questions); } catch (e) { q.questions = []; }
      }
    });

    return res.json({ status: 'success', quizzes });
  } catch (error) {
    return next(error);
  }
}

async function getQuiz(req, res, next) {
  const { quizId } = req.params;

  try {
    const rows = await query('SELECT * FROM quizzes WHERE id = ? LIMIT 1', [quizId]);
    const quiz = rows[0];
    if (!quiz) throw new HttpError(404, 'Quiz not found');
    if (typeof quiz.questions === 'string') {
      try { quiz.questions = JSON.parse(quiz.questions); } catch (e) { quiz.questions = []; }
    }

    if (req.user.role === 'teacher') {
      await assertRoomOwnership(quiz.room_id, req.user.id);
    } else {
      await assertRoomMembership(quiz.room_id, req.user.id);
    }

    return res.json({ status: 'success', quiz });
  } catch (error) {
    return next(error);
  }
}

async function updateQuiz(req, res, next) {
  const { quizId } = req.params;

  try {
    const rows = await query('SELECT room_id, teacher_id FROM quizzes WHERE id = ? LIMIT 1', [quizId]);
    const quiz = rows[0];
    if (!quiz) throw new HttpError(404, 'Quiz not found');
    if (quiz.teacher_id !== req.user.id) throw new HttpError(403, 'Forbidden');

    const updates = {
      title: req.body.title,
      description: req.body.description,
      time_limit: req.body.timeLimit,
      scheduled_start: req.body.scheduledStart,
      scheduled_end: req.body.scheduledEnd,
      attempts_allowed: req.body.attemptsAllowed,
      shuffle_questions: !!req.body.shuffleQuestions,
      shuffle_options: !!req.body.shuffleOptions,
      questions: JSON.stringify(req.body.questions || []),
      total_points: calcTotalPoints(req.body.questions || [])
    };

    await query(
      'UPDATE quizzes SET title = ?, description = ?, time_limit = ?, scheduled_start = ?, scheduled_end = ?, attempts_allowed = ?, shuffle_questions = ?, shuffle_options = ?, questions = ?, total_points = ? WHERE id = ?',
      [
        updates.title,
        updates.description,
        updates.time_limit,
        updates.scheduled_start,
        updates.scheduled_end,
        updates.attempts_allowed,
        updates.shuffle_questions,
        updates.shuffle_options,
        updates.questions,
        updates.total_points,
        quizId
      ]
    );

    const [updated] = await query('SELECT * FROM quizzes WHERE id = ? LIMIT 1', [quizId]);
    if (updated && typeof updated.questions === 'string') updated.questions = JSON.parse(updated.questions);

    return res.json({ status: 'success', quiz: updated });
  } catch (error) {
    return next(error);
  }
}

async function deleteQuiz(req, res, next) {
  const { quizId } = req.params;

  try {
    const rows = await query('SELECT room_id, teacher_id FROM quizzes WHERE id = ? LIMIT 1', [quizId]);
    const quiz = rows[0];
    if (!quiz) throw new HttpError(404, 'Quiz not found');
    if (quiz.teacher_id !== req.user.id) throw new HttpError(403, 'Forbidden');

    await query('DELETE FROM quiz_attempts WHERE quiz_id = ?', [quizId]);
    await query('DELETE FROM quizzes WHERE id = ?', [quizId]);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function startAttempt(req, res, next) {
  const { quizId } = req.params;

  try {
    const rows = await query('SELECT * FROM quizzes WHERE id = ? LIMIT 1', [quizId]);
    const quiz = rows[0];
    if (!quiz) throw new HttpError(404, 'Quiz not found');
    if (quiz.room_id !== req.body.roomId) throw new HttpError(400, 'Room mismatch');
    if (typeof quiz.questions === 'string') {
      try { quiz.questions = JSON.parse(quiz.questions); } catch (e) { quiz.questions = []; }
    }

    await assertRoomMembership(quiz.room_id, req.user.id);

    const now = new Date();
    if (quiz.scheduled_start && now < new Date(quiz.scheduled_start)) throw new HttpError(400, 'Quiz has not started yet');
    if (quiz.scheduled_end && now > new Date(quiz.scheduled_end)) throw new HttpError(400, 'Quiz is no longer available');

    const attempts = await query('SELECT id, status FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?', [quizId, req.user.id]);
    if (attempts.length >= quiz.attempts_allowed) throw new HttpError(400, 'No attempts remaining');

    const result = await query('INSERT INTO quiz_attempts (quiz_id, room_id, student_id, status, total_points, started_at) VALUES (?, ?, ?, ?, ?, NOW())', [quizId, quiz.room_id, req.user.id, 'in_progress', quiz.total_points]);
    const [attempt] = await query('SELECT * FROM quiz_attempts WHERE id = ? LIMIT 1', [result.insertId]);

    return res.status(201).json({ status: 'success', attempt });
  } catch (error) {
    return next(error);
  }
}

async function submitAttempt(req, res, next) {
  const { quizId, attemptId } = req.params;
  const { answers, elapsedSeconds } = req.body;

  try {
    const attempts = await query('SELECT * FROM quiz_attempts WHERE id = ? AND quiz_id = ? LIMIT 1', [attemptId, quizId]);
    const attempt = attempts[0];
    if (!attempt) throw new HttpError(404, 'Attempt not found');
    if (attempt.student_id !== req.user.id) throw new HttpError(403, 'Forbidden');
    if (attempt.status === 'completed') throw new HttpError(400, 'Attempt already submitted');

    const rows = await query('SELECT * FROM quizzes WHERE id = ? LIMIT 1', [quizId]);
    const quiz = rows[0];
    if (!quiz) throw new HttpError(404, 'Quiz not found');
    if (typeof quiz.questions === 'string') {
      try { quiz.questions = JSON.parse(quiz.questions); } catch (e) { quiz.questions = []; }
    }

    const scoring = scoreQuizAttempt(quiz, answers);

    await query(
      'UPDATE quiz_attempts SET status = ?, answers = ?, elapsed_seconds = ?, earned_points = ?, score = ?, submitted_at = ? WHERE id = ?',
      ['completed', JSON.stringify(answers || []), elapsedSeconds || null, scoring.earnedPoints, scoring.score, new Date(), attemptId]
    );

    const [updated] = await query('SELECT * FROM quiz_attempts WHERE id = ? LIMIT 1', [attemptId]);

    return res.json({ status: 'success', attempt: updated, scoring });
  } catch (error) {
    return next(error);
  }
}

async function updateAttempt(req, res, next) {
  const { quizId, attemptId } = req.params;
  const { answers, elapsedSeconds } = req.body;

  try {
    const attempts = await query('SELECT * FROM quiz_attempts WHERE id = ? AND quiz_id = ? LIMIT 1', [attemptId, quizId]);
    const attempt = attempts[0];
    if (!attempt) throw new HttpError(404, 'Attempt not found');
    if (attempt.student_id !== req.user.id) throw new HttpError(403, 'Forbidden');

    // Only allow update when still in progress
    if (attempt.status !== 'in_progress') throw new HttpError(400, 'Attempt not in progress');

    const updates = [];
    const params = [];
    if (typeof answers !== 'undefined') {
      updates.push('answers = ?');
      params.push(JSON.stringify(answers || []));
    }
    if (typeof elapsedSeconds !== 'undefined') {
      updates.push('elapsed_seconds = ?');
      params.push(elapsedSeconds);
    }

    if (updates.length === 0) {
      return res.json({ status: 'success', attempt });
    }

    params.push(attemptId);
    await query(`UPDATE quiz_attempts SET ${updates.join(', ')} WHERE id = ?`, params);
    const [updated] = await query('SELECT * FROM quiz_attempts WHERE id = ? LIMIT 1', [attemptId]);

    return res.json({ status: 'success', attempt: updated });
  } catch (error) {
    return next(error);
  }
}

async function listQuizAttempts(req, res, next) {
  const { quizId } = req.params;

  try {
    const rows = await query('SELECT room_id, teacher_id FROM quizzes WHERE id = ? LIMIT 1', [quizId]);
    const quiz = rows[0];
    if (!quiz) throw new HttpError(404, 'Quiz not found');

    // teacher: return all attempts
    if (req.user.role === 'teacher') {
      if (quiz.teacher_id !== req.user.id) throw new HttpError(403, 'Forbidden');

      const attempts = await query(
        `SELECT qa.*, u.name as student_name, u.email as student_email
         FROM quiz_attempts qa
         LEFT JOIN users u ON u.id = qa.student_id
         WHERE qa.quiz_id = ?
         ORDER BY qa.submitted_at DESC`,
        [quizId]
      );

      return res.json({ status: 'success', attempts });
    }

    // student: only return this student's attempts for the quiz
    await assertRoomMembership(quiz.room_id, req.user.id);
    const attempts = await query(
      `SELECT qa.*, u.name as student_name, u.email as student_email
       FROM quiz_attempts qa
       LEFT JOIN users u ON u.id = qa.student_id
       WHERE qa.quiz_id = ? AND qa.student_id = ?
       ORDER BY qa.submitted_at DESC`,
      [quizId, req.user.id]
    );

    return res.json({ status: 'success', attempts });
  } catch (error) {
    return next(error);
  }
}

async function getMyAttempts(req, res, next) {
  try {
    const attempts = await query(
      `SELECT qa.id, qa.quiz_id, q.title as quiz_title, qa.room_id, r.name as room_name, qa.student_id, qa.score, qa.earned_points, qa.total_points, qa.submitted_at
       FROM quiz_attempts qa
       LEFT JOIN quizzes q ON q.id = qa.quiz_id
       LEFT JOIN rooms r ON r.id = qa.room_id
       WHERE qa.student_id = ? AND qa.status = ?
       ORDER BY qa.submitted_at DESC`,
      [req.user.id, 'completed']
    );

    // normalize to camelCase shape the frontend expects
    const normalized = attempts.map(a => ({
      id: a.id,
      quizId: a.quiz_id,
      quizName: a.quiz_title,
      roomId: a.room_id,
      roomName: a.room_name,
      score: a.score,
      points: a.earned_points,
      totalPoints: a.total_points,
      completedAt: a.submitted_at
    }));

    return res.json({ status: 'success', attempts: normalized });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
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
};

