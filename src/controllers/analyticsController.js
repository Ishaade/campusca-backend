const { query } = require('../config/db');
const HttpError = require('../utils/httpError');

async function getRoomAnalytics(req, res, next) {
  const { roomId } = req.params;

  try {
    const roomRows = await query('SELECT teacher_id, name FROM rooms WHERE id = ? LIMIT 1', [roomId]);
    const room = roomRows[0];
    if (!room) throw new HttpError(404, 'Room not found');
    if (room.teacher_id !== req.user.id) throw new HttpError(403, 'Forbidden');

    const [quizzes, members, attempts] = await Promise.all([
      query('SELECT id, title, total_points FROM quizzes WHERE room_id = ?', [roomId]),
      query('SELECT student_id, student_name, student_email, status, joined_at FROM room_members WHERE room_id = ?', [roomId]),
      query('SELECT id, quiz_id, student_id, score, earned_points, total_points, submitted_at FROM quiz_attempts WHERE room_id = ? AND status = ?', [roomId, 'completed'])
    ]);

    const activeStudents = members.filter((member) => member.status === 'active');
    const totalQuizzes = quizzes.length;
    const totalStudents = activeStudents.length;
    const averageScore =
      attempts.length > 0
        ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / attempts.length)
        : 0;
    const completionRate =
      totalQuizzes * totalStudents > 0
        ? Math.round((attempts.length / (totalQuizzes * totalStudents)) * 100)
        : 0;

    const quizLookup = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
    const memberLookup = new Map(members.map((member) => [member.student_id, member]));

    const quizResults = attempts.map((attempt) => {
      const quiz = quizLookup.get(attempt.quiz_id);
      const member = memberLookup.get(attempt.student_id);

      return {
        id: attempt.id,
        quizId: attempt.quiz_id,
        quizName: quiz?.title,
        studentId: attempt.student_id,
        studentName: member?.student_name,
        studentEmail: member?.student_email,
        score: attempt.score,
        points: attempt.earned_points,
        completedAt: attempt.submitted_at
      };
    });

    const studentPerformance = activeStudents.map((student) => {
      const studentAttempts = attempts.filter((attempt) => attempt.student_id === student.student_id);
      const avgScore =
        studentAttempts.length > 0
          ? Math.round(studentAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / studentAttempts.length)
          : 0;
      const totalPoints = studentAttempts.reduce((sum, attempt) => sum + (attempt.earned_points || 0), 0);

      return {
        studentId: student.student_id,
        studentName: student.student_name,
        studentEmail: student.student_email,
        quizzesCompleted: studentAttempts.length,
        averageScore: avgScore,
        totalPoints
      };
    });

    return res.json({
      status: 'success',
      analytics: {
        room: {
          id: roomId,
          name: room.name
        },
        totalQuizzes,
        totalStudents,
        averageScore,
        completionRate,
        quizResults,
        studentPerformance
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getRoomAnalytics
};

