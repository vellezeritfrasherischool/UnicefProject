# School handoff

## Account ownership

Before production, record the organization-owned account responsible for GitHub,
Supabase, Vercel, domain/DNS, OpenAI and transactional email. Do not use personal
developer billing or recovery addresses. Never place passwords or secret values
in this document.

## Administration

- A school admin opens **Administrimi** to create a seven-day teacher invitation.
- The raw invitation code is shown once and should be sent separately to the
  intended email owner.
- Unused invitations can be revoked.
- Deactivation disables membership and bans future Auth sessions. Existing access
  tokens may remain syntactically valid briefly, but RLS denies school data.
- Students can be provisioned by their teacher or self-register, confirm email,
  sign in and join with a class code.

## Secret rotation

- Rotate OpenAI using `supabase secrets set OPENAI_API_KEY=...`, then redeploy
  `ai-gateway`.
- Rotate publishable keys in Supabase and update Vercel environment variables.
- Secret/service-role credentials never belong in Vercel or browser `.env` files.

## Backups

Use a paid Supabase plan with downloadable backups or Point-in-Time Recovery for
production. Document retention and perform a staging restore exercise before the
pilot. Supabase database backups do not include Storage objects; this application
currently stores no uploaded source PDFs.

## Recurring operations

Review monthly: Auth/Edge Function logs, AI usage and failures, database size,
inactive users, dependency audit, backup status, SMTP delivery and billing.

