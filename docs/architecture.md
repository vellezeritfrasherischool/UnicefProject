# Architecture

## Runtime

- React, TypeScript and Vite provide the browser application.
- Supabase Auth owns sessions and user identity.
- PostgreSQL with RLS stores schools, memberships, classes, students, materials,
  assignments, rewards and learning data.
- Supabase Edge Functions perform privileged onboarding/admin actions and relay
  authenticated, validated AI requests.
- OpenAI credentials exist only in Supabase function secrets.
- PDF.js extracts text-based PDFs locally; uploaded files are not retained.

## Trust boundaries

The publishable Supabase key is intentionally public. Database authorization is
enforced by RLS and immutable ownership triggers. Service-role access is limited
to Edge Functions, which verify either an authenticated role/ownership or a
single-use email-bound teacher invitation. No function logs prompts, passwords,
student profiles or uploaded lesson content.

## Data ownership

`school -> school_members -> teacher -> classes -> students`

Materials have direct `school_id` and `teacher_id`. Assignments link one published
material to one student. Learning and reward tables are scoped by student and are
visible only to that student and their teacher.

