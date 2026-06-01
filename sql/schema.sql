-- Run inside Supabase SQL editor
create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now()
);

create type public.room_membership_status as enum ('pending', 'active', 'rejected');

create table if not exists public.rooms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  subject text,
  code text not null unique,
  max_students integer not null default 50,
  allow_self_join boolean not null default true,
  require_approval boolean not null default false,
  teacher_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.room_members (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  student_name text not null,
  student_email text not null,
  status public.room_membership_status not null default 'pending',
  joined_at timestamptz not null default now(),
  unique (room_id, student_id)
);

create table if not exists public.quizzes (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  time_limit integer not null,
  attempts_allowed integer not null default 1,
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  questions jsonb not null,
  total_points integer not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create type public.quiz_attempt_status as enum ('in_progress', 'completed');

create table if not exists public.quiz_attempts (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  status public.quiz_attempt_status not null default 'in_progress',
  answers jsonb,
  elapsed_seconds integer,
  earned_points integer,
  total_points integer,
  score integer,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists idx_rooms_teacher on public.rooms(teacher_id);
create index if not exists idx_room_members_room on public.room_members(room_id);
create index if not exists idx_quizzes_room on public.quizzes(room_id);
create index if not exists idx_attempts_quiz on public.quiz_attempts(quiz_id);

alter table public.room_members enable row level security;
alter table public.rooms enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;

-- Example RLS policy (adjust as needed)
create policy if  "teachers manage their rooms"
  on public.rooms
  for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

