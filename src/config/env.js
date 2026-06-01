const dotenv = require('dotenv');

dotenv.config();

// List of environment variable NAMES that are required to run the server.
// Do not put literal values here — these should match keys in `process.env`.
const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];

requiredVars.forEach((name) => {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
});

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 4000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  REFRESH_TOKEN_EXPIRES_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10),
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  MAX_PASSWORD_CHANGES: parseInt(process.env.MAX_PASSWORD_CHANGES || '3', 10)
};

module.exports = env;

