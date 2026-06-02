const { query } = require('../config/db');
const HttpError = require('../utils/httpError');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

const SALT_ROUNDS = 10;

async function createUserAccount({ name, email, password, role }) {
  const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing && existing.length > 0) {
    throw new HttpError(400, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await query(
    'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, NOW())',
    [name, email, passwordHash, role]
  );

  const rows = await query('SELECT id, name, email, role, created_at FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0];
}

async function register(req, res, next) {
  try {
    return res.status(403).json({
      status: 'error',
      message: 'Public registration is disabled. Please contact an administrator.'
    });
  } catch (error) {
    return next(error);
  }
}

async function adminRegisterUser(req, res, next) {
  const { name, email, password, role } = req.body;

  try {
    if (!name || !email || !password || !role) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const user = await createUserAccount({ name, email, password, role });
    return res.status(201).json({ status: 'success', user });
  } catch (error) {
    return next(error);
  }
}

async function adminListUsers(req, res, next) {
  const role = req.query.role;

  try {
    if (!role || !['teacher', 'student'].includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Role query must be teacher or student' });
    }

    const users = await query(
      'SELECT id, name, email, role, created_at FROM users WHERE role = ? ORDER BY created_at DESC',
      [role]
    );
    return res.status(200).json({ status: 'success', users });
  } catch (error) {
    return next(error);
  }
}

async function adminDeleteUser(req, res, next) {
  const { userId } = req.params;

  try {
    const rows = await query('SELECT id, role, email FROM users WHERE id = ? LIMIT 1', [userId]);
    const target = rows[0];
    if (!target) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    if (target.role === 'admin') {
      return res.status(403).json({ status: 'error', message: 'Admin users cannot be deleted from this endpoint' });
    }

    await query('DELETE FROM users WHERE id = ?', [userId]);
    return res.status(200).json({ status: 'success', message: `Deleted ${target.role} account ${target.email}` });
  } catch (error) {
    return next(error);
  }
}

async function adminSetUserPassword(req, res, next) {
  const { userId } = req.params;
  const { newPassword } = req.body;

  try {
    const rows = await query('SELECT id, email, role FROM users WHERE id = ? LIMIT 1', [userId]);
    const target = rows[0];
    if (!target) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    // Reset password_change_count so the user can change password again if needed
    await query('UPDATE users SET password_hash = ?, password_change_count = 0 WHERE id = ?', [passwordHash, userId]);

    return res.status(200).json({ status: 'success', message: `Password updated for ${target.email}` });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Missing email or password' });
    }

    const rows = await query('SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    // Create JWT access token
    const payload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
    const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60); // 1 hour default

    // Create refresh token and store it
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await query('INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, NOW())', [user.id, refreshToken, refreshExpiresAt]);

    // Remove sensitive fields
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };

    return res.status(200).json({
      status: 'success',
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 60 * 60,
        expires_at: expiresAt
      },
      user: safeUser
    });
  } catch (error) {
    return next(error);
  }
}

async function getProfile(req, res, next) {
  try {
    const rows = await query('SELECT id, name, email, role, created_at FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const profile = rows[0];
    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }

    return res.status(200).json({ status: 'success', user: profile });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  adminRegisterUser,
  adminListUsers,
  adminDeleteUser,
  adminSetUserPassword,
  login,
  getProfile
};

