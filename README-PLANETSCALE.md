PlanetScale migration notes
==========================

This backend was migrated from Supabase to PlanetScale (MySQL). To use it you must provision a PlanetScale database and create the required tables.

Environment variables (required):

- `DATABASE_URL` - PlanetScale connection string (use `mysql2` compatible URL)
- `JWT_SECRET` - Secret key for signing JWTs
- `PORT` - optional, defaults to `4000`
- `ALLOWED_ORIGIN` - optional, defaults to `http://localhost:3000`

Recommended npm install command (run inside `backend`):

```powershell
npm install mysql2 bcrypt jsonwebtoken
```

How to get your PlanetScale `DATABASE_URL`
-------------------------------------------------

1. Create a database in the PlanetScale dashboard.
2. Go to "Settings" → "Password" (or "Connect") and create a password for a non-root user.
3. Use the connection details to form a MySQL URI like:

```
mysql://<username>:<password>@<host>:<port>/<database>
```

PlanetScale requires TLS in most setups. The `db` helper enables TLS by default. If you need to disable it for local testing, set `PS_SSL=false` in your `.env`.

Set the environment variable `DATABASE_URL` in your `.env` file, for example:

```
DATABASE_URL="mysql://myuser:mypassword@us-east.connect.psdb.cloud/mydb"
JWT_SECRET="a_long_random_secret"
```

If you prefer to use the `pscale` CLI to create a secure local tunnel, you can run:

```powershell
pscale connect <database> main --port 3306
```

Then point `DATABASE_URL` at `mysql://<username>:<password>@127.0.0.1:3306/<database>`.


SQL to create the minimal tables used by the backend (execute in your MySQL client for PlanetScale):

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```
-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(255),
  code VARCHAR(32) NOT NULL UNIQUE,
  teacher_id BIGINT NOT NULL,
  max_students INT DEFAULT 0,
  allow_self_join BOOLEAN DEFAULT TRUE,
  require_approval BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Room members
CREATE TABLE IF NOT EXISTS room_members (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  student_name VARCHAR(255),
  student_email VARCHAR(255),
  status VARCHAR(32) DEFAULT 'pending',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_limit INT,
  scheduled_start DATETIME,
  scheduled_end DATETIME,
  attempts_allowed INT DEFAULT 1,
  shuffle_questions BOOLEAN DEFAULT FALSE,
  shuffle_options BOOLEAN DEFAULT FALSE,
  questions JSON,
  total_points INT DEFAULT 0,
  status VARCHAR(32) DEFAULT 'draft',
  teacher_id BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  quiz_id BIGINT NOT NULL,
  room_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  status VARCHAR(32) DEFAULT 'in_progress',
  total_points INT DEFAULT 0,
  answers JSON,
  elapsed_seconds INT,
  earned_points INT DEFAULT 0,
  score INT DEFAULT 0,
  submitted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);

Notes:
- The controller and middleware now use JWT access tokens and store refresh tokens in `refresh_tokens`.
- The frontend expects the `login` response to include `session.access_token`, `session.refresh_token`, `session.expires_at` and `user` object. The `register` endpoint returns the created `user`.

Quick start checklist
---------------------

- Install packages: `npm install mysql2 bcrypt jsonwebtoken` inside `backend`.
- Add `DATABASE_URL` and `JWT_SECRET` to `backend/.env`.
- Create the tables (SQL in this README). You can apply them via a MySQL client or use the PlanetScale dashboard.
- Run `npm run dev` from `backend`.

