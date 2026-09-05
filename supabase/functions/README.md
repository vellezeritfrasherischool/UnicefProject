# Supabase Edge Functions

## AI gateway

All OpenAI calls go through `ai-gateway`. The function requires a valid Supabase
access token and applies request-size and per-instance rate limits. It never logs
prompts or student content.

Set server-side secrets (never put these in `.env` or any `VITE_` variable):

```bash
supabase secrets set OPENAI_API_KEY=... \
  OPENAI_TEXT_MODEL=gpt-5.6-sol \
  OPENAI_TTS_MODEL=gpt-4o-mini-tts \
  OPENAI_IMAGE_MODEL=gpt-image-1 \
  ALLOWED_ORIGINS=http://localhost:5173,https://staging.example.org
```

Deploy with JWT verification enabled:

```bash
supabase functions deploy ai-gateway --no-verify-jwt=false
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by Supabase at runtime.
The in-memory rate limit is a first abuse-control layer; a database-backed quota
must be added before a larger public rollout because Edge Function instances do
not share memory.

## Student provisioning

`provision-student` replaces browser-side creation of another user's account.
It verifies that the caller is a teacher and owns the requested class, then uses
the runtime-provided `SUPABASE_SERVICE_ROLE_KEY` to create the Auth user and data.

```bash
supabase functions deploy provision-student --no-verify-jwt=false
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.

`join-class` similarly validates the authenticated student and consumes the join
code server-side, so class codes do not need a public read policy:

```bash
supabase functions deploy join-class --no-verify-jwt=false
```

## Invited teacher registration

Apply `supabase/migrations/202609040001_school_and_teacher_invitations.sql`, then
deploy the registration endpoint. It must allow an unauthenticated registration
request; the single-use, email-bound, hashed invitation is its authorization:

```bash
supabase functions deploy register-invited-teacher --no-verify-jwt
```

Generate a random code of at least 128 bits, give the raw code to the intended
teacher through a secure channel, and store only its lowercase SHA-256 hex digest
in `teacher_invitations.token_hash`. Never store or email passwords.

Until the school-admin UI is implemented, an authorized database administrator
can create an invitation using a locally generated code:

```bash
INVITE_CODE=$(openssl rand -hex 16)
printf '%s' "$INVITE_CODE" | shasum -a 256
```

Insert the resulting digest, intended lowercase email, school ID, inviter ID and
expiry into `teacher_invitations`, then transmit `INVITE_CODE` separately. Do not
paste the raw code into SQL history.

## Migration order

For an existing MVP database, back it up and apply:

1. `202609040001_school_and_teacher_invitations.sql`
2. deploy `provision-student`, `join-class`, and `register-invited-teacher`
3. associate every existing teacher with a school in `school_members`
4. ensure every existing material has the correct non-null `teacher_id`
5. `202609040002_secure_core_rls.sql`

Test this sequence against staging first. The RLS migration intentionally hides
legacy materials whose `teacher_id` is null rather than guessing ownership.
