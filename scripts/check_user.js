const { query } = require('../src/config/db');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/check_user.js <email>');
    process.exit(2);
  }

  try {
    const rows = await query('SELECT id, email, name, role, password_hash, created_at FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows && rows[0];
    if (!user) {
      console.log(`No user found for email=${email}`);
      process.exit(0);
    }

    console.log('User found:');
    console.log(`  id: ${user.id}`);
    console.log(`  email: ${user.email}`);
    console.log(`  name: ${user.name}`);
    console.log(`  role: ${user.role}`);
    console.log(`  created_at: ${user.created_at}`);
    console.log(`  password_hash present: ${user.password_hash ? 'yes' : 'no'}`);
  } catch (err) {
    console.error('Error querying database:', err.message || err);
    process.exit(1);
  }
}

main();
