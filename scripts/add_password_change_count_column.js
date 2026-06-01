const { query } = require('../src/config/db');

async function main() {
  try {
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_change_count INTEGER NOT NULL DEFAULT 0;
    `);
    console.log('password_change_count column ensured on users table');
    process.exit(0);
  } catch (err) {
    console.error('Failed to add password_change_count column:', err.message || err);
    process.exit(1);
  }
}

main();
