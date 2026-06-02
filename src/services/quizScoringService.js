function normalizeBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
}

function normalizeTrueFalseIndex(value) {
  // App convention: 0 => True, 1 => False
  if (typeof value === 'boolean') return value ? 0 : 1;
  if (typeof value === 'number') return value === 0 ? 0 : 1;
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    if (raw === '0' || raw === 'true') return 0;
    if (raw === '1' || raw === 'false') return 1;
  }
  return normalizeBool(value) ? 0 : 1;
}

function normalizeText(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function scoreQuestion(question, answer) {
  if (!answer) {
    return { earned: 0, status: 'unanswered' };
  }

  switch (question.type) {
    case 'multiple-choice': {
      const isCorrect = Number(answer.response) === Number(question.correctAnswer);
      return {
        earned: isCorrect ? Number(question.points) || 0 : 0,
        status: isCorrect ? 'correct' : 'incorrect'
      };
    }
    case 'true-false': {
      const expected = normalizeTrueFalseIndex(question.correctAnswer);
      const provided = normalizeTrueFalseIndex(answer.response);
      const isCorrect = expected === provided;
      return {
        earned: isCorrect ? Number(question.points) || 0 : 0,
        status: isCorrect ? 'correct' : 'incorrect'
      };
    }
    case 'short-answer':
    default: {
      const provided = normalizeText(answer.response);
      if (!provided) {
        return { earned: 0, status: 'unanswered' };
      }
      const expectedRaw = question.correctAnswer || question.sampleAnswer || '';
      const expected = normalizeText(expectedRaw);
      const isCorrect = expected ? provided === expected : false;
      return {
        earned: isCorrect ? Number(question.points) || 0 : 0,
        status: isCorrect ? 'correct' : 'incorrect'
      };
    }
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

