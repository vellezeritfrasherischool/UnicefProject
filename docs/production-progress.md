# Production completion progress

## Completed baseline changes

- Direct browser-to-OpenAI calls were replaced with the authenticated Supabase
  `ai-gateway` Edge Function.
- `VITE_OPENAI_API_KEY` was removed from frontend code, types, examples, and docs.
- AI models are configurable through server-only Edge Function secrets.
- Gateway validation limits chat context, TTS input, image prompts, request size,
  operations, and request frequency. Prompts are not logged.
- PDF, TXT, and Markdown uploads now extract actual text into an editable preview.
- PDFs are checked by type and file signature and limited to 10 MB. Empty/scanned,
  password-protected, malformed, and oversized PDFs stop with a user-facing error.
- The pre-existing TypeScript duplicate-property error was fixed.
- Teacher-created student accounts now use an authenticated privileged Edge
  Function. The server verifies the teacher role and class ownership, validates
  inputs, and cleans up partially created Auth users if data provisioning fails.
- Added `schools`, `school_members`, and single-use hashed teacher invitations.
  Teacher registration now requires an email-bound invitation and assigns the
  role and school membership only on the server.
- Class join codes are consumed by an authenticated server function and no longer
  require students to enumerate the `classes` table.
- Added a staged RLS migration covering profiles, classes, students, materials,
  assignments, learning data, flashcards, XP, and badges. It replaces every MVP
  allow-all policy with owner/student/teacher rules and protects ownership fields.
- Added direct school ownership for classes/materials, active membership checks,
  a minimal school-admin UI/API, invitation lifecycle controls and teacher bans.
- Added database-backed AI usage records and per-user minute quotas without
  storing prompts or student content.
- Added class-code-gated student registration that creates confirmed accounts
  server-side and enrolls students without confirmation email.
- Added Vitest coverage for deterministic cohorts and safe TTS chunking, a CI
  workflow, Vercel SPA configuration, and a staging environment template.

## Required deployment configuration

Frontend variables:

```env
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Server-only Supabase secrets:

```text
OPENAI_API_KEY
OPENAI_TEXT_MODEL (default: gpt-5.6-sol)
OPENAI_TTS_MODEL (default: gpt-4o-mini-tts)
OPENAI_IMAGE_MODEL (default: gpt-image-1)
ALLOWED_ORIGINS (comma-separated)
```

See `supabase/functions/README.md` for deployment commands.

## Remaining P0 blockers

- Apply migration 003 and deploy the updated functions to staging.
- Expand integration tests against an isolated Supabase test project.
- Verify the Edge Function against a deployed Supabase development project.
- Add authorization and assignment-targeting integration tests.

The MVP policies must remain development-only until the secure migration is ready;
they are not approved for staging or production.

## Known limitation

Scanned/image-only PDFs require OCR and are intentionally rejected in this first
version. Word documents and images are no longer advertised as accepted formats.
