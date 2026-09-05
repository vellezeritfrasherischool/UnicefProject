# Supabase setup for MësoLehtë AI

## 1) Base tables
Run `schema.sql` in SQL Editor (materials + assignments).

## 2) Auth + classes + students
Run `schema_auth.sql` next.

## 2b) Stars + Titles (gamification)
Run `schema_gamification.sql` (`xp_transactions`, `student_badges`).

## 2c) Learning cloud (profiles, reports, Memory Booster)
Run `schema_learning.sql` (`learning_profiles`, `learning_reports`, `flashcards`, `memory_boosters`, `learning_events`).

Full cloud demo = all four SQL files (schema → auth → gamification → learning).

## 3) Deploy student registration
Deploy `register-student` with `--no-verify-jwt`. Student self-registration requires
a valid class code and the server creates an already-confirmed account. Supabase's
global **Confirm email** setting can remain enabled for other signup flows.

## 4) Env
```env
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
Restart `npm run dev`.

## How it works
1. **Teacher** registers on Login → creates class (gets join code) → adds students (email + password) OR students self-register with join code
2. **Materials / assignments** save to Supabase
3. Student id = Auth user id → published work shows for that student

## Demo mode
If `VITE_USE_SUPABASE=false`, old demo emails still work with localStorage.
