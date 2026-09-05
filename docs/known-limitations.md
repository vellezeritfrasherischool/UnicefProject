# Known limitations

## Launch blockers until staging verification

- Migration 003 and updated functions must pass the full multi-user QA checklist.
- Custom SMTP and confirmed-email links need a school-controlled sending domain.
- Automated database/RLS integration tests require an isolated CI Supabase project.
- Backup restore has not yet been exercised.

## Accepted first-pilot limitations

- Scanned PDFs require OCR and are rejected; text-based PDFs are supported.
- AI rate limits are fixed per user rather than configurable per school plan.
- Admin reporting is intentionally high-level and does not expose lesson content.
- The initial JavaScript bundle remains larger than the desired performance budget.
- Invitations are copied manually; automated invitation email delivery is deferred.

## Future improvements

- OCR with explicit consent and secure temporary file deletion.
- Database-backed job queues for long AI/image operations.
- Configurable school branding and per-school AI budgets.
- Expanded accessibility testing with students and assistive technology.
- Fine-grained admin audit history and teacher reactivation workflows.

