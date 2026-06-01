function normalizeBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
}

function scoreQuestion(question, answer) {
  if (!answer) {
    return { earned: 0, status: 'unanswered' };
  }

  switch (question.type) {
    case 'multiple-choice': {
      const isCorrect = Number(answer.response) === Number(question.correctAnswer);
      return {
        earned: isCorrect ? question.points : 0,
        status: isCorrect ? 'correct' : 'incorrect'
      };
    }
    case 'true-false': {
      const expected = question.correctAnswer;
      const provided = normalizeBool(answer.response);
      const isCorrect = typeof expected === 'boolean' ? expected === provided : Number(expected) === Number(provided);
      return {
        earned: isCorrect ? question.points : 0,
        status: isCorrect ? 'correct' : 'incorrect'
      };
    }
    case 'short-answer':
    default:
      return {
        earned: 0,
        status: 'pending_review'
      };
  }
}

function scoreQuizAttempt(quiz, answers = []) {
  let earnedPoints = 0;
  const detailed = [];

  quiz.questions.forEach((question, index) => {
    const key = question.id != null ? String(question.id) : String(index);
    const answer = answers.find((a) => String(a.questionId) === key);
    const result = scoreQuestion(question, answer);
    earnedPoints += result.earned;
    detailed.push({
      questionId: key,
      status: result.status,
      earnedPoints: result.earned,
      response: answer ? answer.response : null
    });
  });

  const totalPoints = quiz.total_points || quiz.totalPoints || quiz.questions.reduce((sum, q) => sum + q.points, 0);
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  return {
    earnedPoints,
    totalPoints,
    score,
    detailed
  };
}

module.exports = {
  scoreQuizAttempt
};

