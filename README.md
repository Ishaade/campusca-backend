# CampusCA Backend (Supabase + Express)

This service mirrors every data field used in the CampusCA React frontend and persists it in Supabase with proper authentication. It exposes REST endpoints for registration, rooms, quizzes, attempts, and analytics.

## Tech Stack

- Node.js + Express 5
- Supabase Auth & Postgres (`@supabase/supabase-js`)
- Zod validation, Helmet, CORS, Morgan

## Getting Started

```bash
cd backend
cp example.env .env          # populate with your Supabase values
npm install
npm run dev                  # nodemon
```

Environment variables:

| Name | Description |
| ---- | ----------- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon key for standard auth calls |
| `SUPABASE_SERVICE_ROLE_KEY` | service key used server-side for admin operations |
| `PORT` | API port (default 4000) |
| `ALLOWED_ORIGIN` | Frontend origin for CORS |

## Database Schema

`sql/schema.sql` contains the Supabase DDL for the following tables (all fields map directly to the frontend props):

- `users` (`id`, `email`, `name`, `role`)
- `rooms` (`name`, `description`, `subject`, `code`, `max_students`, `allow_self_join`, `require_approval`, `teacher_id`)
- `room_members` (`student_id`, `student_name`, `student_email`, `status`, `joined_at`)
- `quizzes` (full quiz metadata plus serialized `questions` array with: `question`, `type`, `options`, `correctAnswer`, `sampleAnswer`, `points`, `courseOutcome`, `bloomsTaxonomy`)
- `quiz_attempts` (captures student submissions, earned points, score, timings)

Enable RLS and adapt the sample policy at the bottom of the schema file.

## API Overview

All endpoints live under `/api/*` and expect a Supabase access token (`Authorization: Bearer <token>`) after login.

### Auth

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/auth/register` | Accepts `{ name, email, password, role }`. Creates Supabase Auth user + `users` row. |
| `POST` | `/api/auth/login` | Returns Supabase session tokens + stored profile. |
| `GET`  | `/api/auth/me` | Returns profile for the current token. |

### Rooms

- `GET /api/rooms` — teachers receive owned rooms; students receive joined rooms (status + join date).
- `POST /api/rooms` — teacher-only room creation with all fields from `CreateRoom.js`.
- `GET /api/rooms/:roomId` — returns room detail plus member list (active + pending).
- `PATCH /api/rooms/:roomId` — update settings exactly as in the frontend management form.
- `DELETE /api/rooms/:roomId` — removes room, members, and related quizzes.
- `POST /api/rooms/join` — student joins by room code; respects capacity, `allowSelfJoin`, and `requireApproval`.
- `POST /api/rooms/:roomId/members/:memberId/approve|reject` — teacher moderation for join requests.

### Quizzes

- `GET /api/quizzes/rooms/:roomId` — all quizzes for a room (teachers & students with access).
- `POST /api/quizzes/rooms/:roomId` — teacher quiz creation; payload matches `CreateQuiz.js` form including CO/Bloom metadata.
- `GET /api/quizzes/:quizId` — fetch one quiz.
- `PATCH /api/quizzes/:quizId` — update quiz data/questions.
- `DELETE /api/quizzes/:quizId` — removes quiz + attempts.
- `POST /api/quizzes/:quizId/attempts` — student starts an attempt (`{ roomId }` body).
- `POST /api/quizzes/:quizId/attempts/:attemptId/submit` — student submits answers; backend auto-scores MCQ/TF items and flags short answers for review.
- `GET /api/quizzes/:quizId/attempts` — teacher view of submissions for grading & analytics.

### Analytics

- `GET /api/analytics/rooms/:roomId` — teacher-only rollup that powers `QuizAnalytics.js` (totals, averages, student leaderboard, recent attempts).

### Health Check

- `GET /health` — simple status response for uptime monitoring.

## Notes & Next Steps

- Frontend integration: replace the current mock/localStorage calls with these endpoints, passing the Supabase session token stored after login.
- Security: keep the service key on the server only; never expose it to the client. Use Supabase RLS for defense-in-depth.
- Testing: add integration tests (e.g., Vitest or Jest + Supertest) before deploying to production.
- Observability: plug pino/structured logging or Supabase logs for deeper tracing when moving beyond dev.

