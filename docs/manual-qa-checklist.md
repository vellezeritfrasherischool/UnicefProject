# Manual QA checklist

## Authentication and authorization

- [ ] Invalid, expired, mismatched, used, and revoked teacher invitations fail.
- [ ] Teacher A cannot see Teacher B's school data.
- [ ] Student A cannot see Student B's assignment or learning data.
- [ ] A student cannot write teacher materials or teacher rewards.
- [ ] A deactivated teacher cannot access class/material data.
- [ ] Unauthenticated AI and admin requests return 401.

## Teacher workflow

- [ ] Login/session refresh/logout works.
- [ ] Class creation persists and produces a unique join code.
- [ ] Teacher-created student can log in without changing the teacher session.
- [ ] Text and valid PDF material creation works.
- [ ] Scanned, protected, fake, empty, and oversized PDFs fail clearly.
- [ ] Cohort variants contain the correct target student IDs.
- [ ] Material requires review and approval before publishing.
- [ ] Repeated Publish creates no duplicate assignment.

## Student workflow

- [ ] Registration requires a valid class code and signs in without an email-confirmation message.
- [ ] Invalid class codes and duplicate emails fail without leaving partial student records.
- [ ] Font family, font size, line spacing, letter spacing, contrast, dark mode,
      reduced motion and language visibly update and persist after refresh.
- [ ] Assigned material appears in a separate browser.
- [ ] Reading preferences, vocabulary, translation and illustration work.
- [ ] Albanian and English audio play and long text advances through chunks.
- [ ] Quiz scoring, attempts and assignment completion persist after refresh.
- [ ] Quiz score appears immediately and identically in results, teacher roster,
      analytics and the generated report workflow (including when AI analysis fails).
- [ ] Report, profile, flashcards and Memory Booster persist across browsers.

## Operations

- [ ] `npm run check` passes.
- [ ] `npm audit --omit=dev` reports no production vulnerabilities.
- [ ] CI passes on a pull request.
- [ ] Staging has its own Supabase project, OpenAI key/limits and URL.
- [ ] Database backup and restore procedure has been tested.
