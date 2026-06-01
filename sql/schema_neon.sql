-- Neon/Postgres schema (uses pgcrypto for gen_random_uuid)
-- Run this on your Neon database (psql or Neon dashboard SQL editor)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  password_hash TEXT,
  password_change_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  code TEXT NOT NULL UNIQUE,
  max_students INTEGER NOT NULL DEFAULT 50,
  allow_self_join BOOLEAN NOT NULL DEFAULT true,
  require_approval BOOLEAN NOT NULL DEFAULT false,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Room membership status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_membership_status') THEN
    CREATE TYPE room_membership_status AS ENUM ('pending', 'active', 'rejected');
  END IF;
END$$;

-- Room members
CREATE TABLE IF NOT EXISTS room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  status room_membership_status NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, student_id)
);

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  time_limit INTEGER NOT NULL DEFAULT 0,
  attempts_allowed INTEGER NOT NULL DEFAULT 1,
  shuffle_questions BOOLEAN NOT NULL DEFAULT false,
  shuffle_options BOOLEAN NOT NULL DEFAULT false,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_points INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Questions (optional normalized table)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB,
  points INTEGER DEFAULT 1
);

-- Quiz results / attempts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quiz_attempt_status') THEN
    CREATE TYPE quiz_attempt_status AS ENUM ('in_progress', 'completed');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status quiz_attempt_status NOT NULL DEFAULT 'in_progress',
  answers JSONB,
  elapsed_seconds INTEGER,
  earned_points INTEGER,
  total_points INTEGER,
  score INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_teacher ON rooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_room ON quizzes(room_id);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON quiz_attempts(quiz_id);

-- Notes: run this file in Neon (or psql) to create the schema. Adjust types and
-- constraints to match your application's needs.
