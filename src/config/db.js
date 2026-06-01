const { Pool } = require('pg');
const env = require('./env');

const databaseUrl = env.DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in environment');
}

const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

// Convert `?` placeholders to Postgres $1, $2, ... so existing controllers
// that use `?` don't need to be rewritten.
function convertPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

async function query(sql, params = []) {
  // If it's an INSERT without RETURNING, append RETURNING id so we can
  // emulate mysql2's insertId behavior for existing code paths.
  let returningAdded = false;
  let workingSql = sql;
  if (/^\s*insert\b/i.test(sql) && !/returning\b/i.test(sql)) {
    workingSql = `${sql} RETURNING id`;
    returningAdded = true;
  }

  const converted = convertPlaceholders(workingSql);
  const res = await pool.query(converted, params || []);

  if (returningAdded && res.rows && res.rows.length > 0) {
    return { insertId: res.rows[0].id, rows: res.rows };
  }

  // For SELECT, return rows array directly to match previous behavior
  if (res.command === 'SELECT') return res.rows;

  // For other commands return the raw result rows when present
  return res.rows || [];
}

module.exports = { pool, query };
