const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const HttpError = require('../utils/httpError');
const env = require('../config/env');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');

    if (!token) {
      throw new HttpError(401, 'Authorization token missing');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      return next(new HttpError(401, 'Invalid or expired token'));
    }

    const rows = await query('SELECT id, name, email, role, created_at FROM users WHERE id = ? LIMIT 1', [payload.sub]);
    const user = rows[0];
    if (!user) {
      return next(new HttpError(401, 'User not found'));
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return next(new HttpError(403, `Requires ${role} role`));
    }
    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
