-- Direct school ownership, active membership enforcement, and AI usage metering.
alter table public.classes add column if not exists school_id uuid references public.schools(id) on delete restrict;
alter table public.materials add column if not exists school_id uuid references public.schools(id) on delete restrict;

update public.classes c set school_id = sm.school_id
from public.school_members sm where sm.user_id = c.teacher_id and sm.active and c.school_id is null;
update public.materials m set school_id = sm.school_id
from public.school_members sm where sm.user_id = m.teacher_id and sm.active and m.school_id is null;

create index if not exists classes_school_idx on public.classes(school_id);
create index if not exists materials_school_idx on public.materials(school_id);

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  operation text not null check (operation in ('chat', 'speech', 'image')),
  input_chars int not null default 0 check (input_chars >= 0),
  success boolean not null,
  provider_status int,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_time_idx on public.ai_usage_events(user_id, created_at desc);
create index if not exists ai_usage_school_time_idx on public.ai_usage_events(school_id, created_at desc);
alter table public.ai_usage_events enable row level security;

-- Email-confirmed student signup may not have a session yet. Create only a
-- minimal student profile from trusted Auth metadata; class enrollment remains
-- in the authenticated join-class function.
create or replace function public.handle_new_student_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data->>'role' = 'student' then
    insert into public.profiles(id, email, name, role)
    values (new.id, lower(new.email), coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), 'Nxënës'), 'student')
    on conflict (id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_student_created on auth.users;
create trigger on_auth_student_created after insert on auth.users
for each row execute function public.handle_new_student_profile();

create or replace function public.is_school_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from school_members where user_id = auth.uid() and role = 'school_admin' and active
) $$;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from profiles p join school_members sm on sm.user_id = p.id
  where p.id = auth.uid() and p.role = 'teacher' and sm.active
    and sm.role in ('teacher', 'school_admin')
) $$;

create or replace function public.current_school_id()
returns uuid language sql stable security definer set search_path = public
as $$ select school_id from school_members where user_id = auth.uid() and active limit 1 $$;

create or replace function public.teaches_student(target_student_id text)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_teacher() and exists (
  select 1 from students where id::text = target_student_id and teacher_id = auth.uid()
) $$;

create or replace function public.owns_material(target_material_id text)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_teacher() and exists (
  select 1 from materials where id = target_material_id and teacher_id = auth.uid()
) $$;

revoke all on function public.is_school_admin() from public;
revoke all on function public.current_school_id() from public;
grant execute on function public.is_school_admin() to authenticated;
grant execute on function public.current_school_id() to authenticated;

drop policy if exists "admins_read_school_members" on public.school_members;
create policy "admins_read_school_members" on public.school_members for select to authenticated
  using (school_id = current_school_id() and is_school_admin());

drop policy if exists "admins_read_school_usage" on public.ai_usage_events;
create policy "admins_read_school_usage" on public.ai_usage_events for select to authenticated
  using (school_id = current_school_id() and is_school_admin());

-- Refresh teacher policies so deactivated memberships immediately lose access.
drop policy if exists "teachers_read_own_classes" on public.classes;
create policy "teachers_read_own_classes" on public.classes for select to authenticated
  using (teacher_id = auth.uid() and is_teacher());
drop policy if exists "teachers_update_own_classes" on public.classes;
create policy "teachers_update_own_classes" on public.classes for update to authenticated
  using (teacher_id = auth.uid() and is_teacher())
  with check (teacher_id = auth.uid() and school_id = current_school_id());
drop policy if exists "teachers_delete_own_classes" on public.classes;
create policy "teachers_delete_own_classes" on public.classes for delete to authenticated
  using (teacher_id = auth.uid() and is_teacher());
drop policy if exists "teachers_create_own_classes" on public.classes;
create policy "teachers_create_own_classes" on public.classes for insert to authenticated
  with check (teacher_id = auth.uid() and school_id = current_school_id() and is_teacher());

drop policy if exists "teachers_read_own_materials" on public.materials;
create policy "teachers_read_own_materials" on public.materials for select to authenticated
  using (teacher_id = auth.uid() and is_teacher());
drop policy if exists "teachers_update_own_materials" on public.materials;
create policy "teachers_update_own_materials" on public.materials for update to authenticated
  using (teacher_id = auth.uid() and is_teacher())
  with check (teacher_id = auth.uid() and school_id = current_school_id());
drop policy if exists "teachers_delete_own_materials" on public.materials;
create policy "teachers_delete_own_materials" on public.materials for delete to authenticated
  using (teacher_id = auth.uid() and is_teacher());
drop policy if exists "teachers_create_own_materials" on public.materials;
create policy "teachers_create_own_materials" on public.materials for insert to authenticated
  with check (teacher_id = auth.uid() and school_id = current_school_id() and is_teacher());
