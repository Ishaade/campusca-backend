const bcrypt = require('bcrypt');
const { query } = require('../src/config/db');

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error('Usage: node scripts/verify_password.js <email> <password>');
    process.exit(2);
  }

  try {
    const rows = await query('SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows && rows[0];
    if (!user) {
      console.log('No user found with email', email);
      process.exit(0);
    }

    const match = await bcrypt.compare(password, user.password_hash);
    console.log(`Password match for ${email}:`, match);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();
