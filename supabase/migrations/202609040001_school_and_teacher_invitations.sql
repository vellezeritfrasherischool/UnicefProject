-- Add institution ownership and controlled teacher onboarding without dropping data.
create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  active boolean not null default true,
  logo_url text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('school_admin', 'teacher')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create table if not exists public.teacher_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

create index if not exists school_members_user_idx on public.school_members(user_id);
create index if not exists teacher_invitations_email_idx on public.teacher_invitations(email);

alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.teacher_invitations enable row level security;

create policy "members_read_their_schools" on public.schools for select to authenticated
  using (exists (
    select 1 from public.school_members sm
    where sm.school_id = schools.id and sm.user_id = auth.uid() and sm.active
  ));

create policy "members_read_own_membership" on public.school_members for select to authenticated
  using (user_id = auth.uid());

-- Invitations intentionally have no browser policies. Registration and admin
-- management use narrowly scoped Edge Functions with the service role.

comment on column public.teacher_invitations.token_hash is
  'Lowercase SHA-256 hex digest of the invitation code; raw codes are never stored.';

