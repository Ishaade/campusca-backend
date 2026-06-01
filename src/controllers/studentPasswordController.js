const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const HttpError = require('../utils/httpError');
const env = require('../config/env');

const SALT_ROUNDS = 10;

async function getPasswordChangeInfo(req, res, next) {
  const { email } = req.query;

  try {
    const rows = await query(
      'SELECT password_change_count FROM users WHERE email = ? AND role = ? LIMIT 1',
      [email, 'student']
    );
    const student = rows[0];
    if (!student) {
      return res.status(404).json({ status: 'error', message: 'Student account not found' });
    }

    const used = Number(student.password_change_count || 0);
    const remaining = Math.max(0, env.MAX_PASSWORD_CHANGES - used);

    return res.status(200).json({
      status: 'success',
      maxChanges: env.MAX_PASSWORD_CHANGES,
      usedChanges: used,
      remainingChanges: remaining,
      canChange: remaining > 0
    });
  } catch (error) {
    return next(error);
  }
}

async function changeStudentPassword(req, res, next) {
  const { email, password } = req.body;

  try {
    const rows = await query(
      'SELECT id, email, role, password_change_count FROM users WHERE email = ? AND role = ? LIMIT 1',
      [email, 'student']
    );
    const student = rows[0];

    if (!student) {
      return res.status(404).json({ status: 'error', message: 'Student account not found' });
    }

    const used = Number(student.password_change_count || 0);
    if (used >= env.MAX_PASSWORD_CHANGES) {
      return next(
        new HttpError(
          403,
          `Password change limit reached (${env.MAX_PASSWORD_CHANGES} times). Contact your administrator.`
        )
      );
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await query(
      'UPDATE users SET password_hash = ?, password_change_count = COALESCE(password_change_count, 0) + 1 WHERE id = ?',
      [passwordHash, student.id]
    );

    const remaining = env.MAX_PASSWORD_CHANGES - used - 1;

    return res.status(200).json({
      status: 'success',
      message: 'Password changed successfully. You can sign in with your new password.',
      remainingChanges: remaining
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getPasswordChangeInfo,
  changeStudentPassword
};
