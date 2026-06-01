const { query } = require('../src/config/db');

async function main() {
  try {
    const sql = `
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    `;

    await query(sql);
    console.log('refresh_tokens table ensured');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create refresh_tokens table:', err.message || err);
    process.exit(1);
  }
}

main();
