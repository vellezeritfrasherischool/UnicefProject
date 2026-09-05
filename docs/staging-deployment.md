# Staging deployment

## Database and functions

1. Back up the staging database.
2. Run `supabase/migrations/202609050003_school_ownership_admin_and_ai_usage.sql`
   in the staging SQL Editor.
3. Bootstrap one existing member as school administrator:

```sql
update public.school_members sm
set role = 'school_admin'
from public.profiles p
where p.id = sm.user_id
  and p.email = 'teacher.test@example.com';
```

4. Deploy the new and updated functions:

```bash
supabase functions deploy school-admin
supabase functions deploy ai-gateway
```

5. Sign out and back in. The teacher sidebar should show `Administrimi`.

## Vercel

Import the repository into Vercel and create a staging project. Configure:

```text
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://YOUR_STAGING_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_YOUR_STAGING_KEY
```

Do not add OpenAI or Supabase secret/service-role credentials to Vercel.
After deployment, add the exact HTTPS Vercel origin to `ALLOWED_ORIGINS`:

```bash
supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://YOUR-STAGING-PROJECT.vercel.app
supabase functions deploy ai-gateway
supabase functions deploy provision-student
supabase functions deploy join-class
supabase functions deploy register-invited-teacher --no-verify-jwt
supabase functions deploy school-admin
```

## Required verification

- Admin creates an invitation and copies its one-time raw code.
- Invited teacher registers and can access only their own classes.
- Admin deactivates that teacher; their next request and login are denied.
- Classes and materials contain the expected `school_id`.
- AI requests add rows to `ai_usage_events` without storing prompt content.
- Twenty requests per minute are allowed per user; excess requests return 429.
- Confirmed-email student signup creates a minimal profile, then joins a class
  only after confirmation and login.
- Direct navigation to every SPA route works on Vercel.

