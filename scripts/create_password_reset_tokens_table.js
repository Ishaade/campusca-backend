const { query } = require('../src/config/db');

async function main() {
  try {
    const sql = `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
    `;

    await query(sql);
    console.log('password_reset_tokens table ensured');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create password_reset_tokens table:', err.message || err);
    process.exit(1);
  }
}

main();
