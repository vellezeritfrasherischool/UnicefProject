-- Replace MVP allow-all policies with authenticated ownership policies.
-- Apply only after deploying provision-student and join-class.

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where id = auth.uid() and role = 'teacher') $$;

create or replace function public.teaches_student(target_student_id text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from students where id::text = target_student_id and teacher_id = auth.uid()
) $$;

create or replace function public.owns_material(target_material_id text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from materials where id = target_material_id and teacher_id = auth.uid()
) $$;

create or replace function public.student_has_material(target_material_id text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from assignments a join materials m on m.id = a.material_id
  where a.material_id = target_material_id and a.student_id = auth.uid()::text and m.status = 'published'
) $$;

revoke all on function public.is_teacher() from public;
revoke all on function public.teaches_student(text) from public;
revoke all on function public.owns_material(text) from public;
revoke all on function public.student_has_material(text) from public;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.teaches_student(text) to authenticated;
grant execute on function public.owns_material(text) to authenticated;
grant execute on function public.student_has_material(text) to authenticated;

drop policy if exists "profiles_anon_read" on profiles;
drop policy if exists "profiles_all_mvp" on profiles;
drop policy if exists "profiles_read_authorized" on profiles;
drop policy if exists "students_create_own_profile" on profiles;
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_read_authorized" on profiles for select to authenticated
  using (id = auth.uid() or teaches_student(id::text));
create policy "students_create_own_profile" on profiles for insert to authenticated
  with check (id = auth.uid() and role = 'student');
create policy "profiles_update_own" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.protect_profile_authority()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and (new.id <> old.id or new.role <> old.role or new.email is distinct from old.email) then
    raise exception 'Profile authority fields cannot be changed';
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_authority_trigger on profiles;
create trigger protect_profile_authority_trigger before update on profiles
for each row execute function protect_profile_authority();

drop policy if exists "classes_all_mvp" on classes;
drop policy if exists "teachers_read_own_classes" on classes;
drop policy if exists "teachers_create_own_classes" on classes;
drop policy if exists "teachers_update_own_classes" on classes;
drop policy if exists "teachers_delete_own_classes" on classes;
create policy "teachers_read_own_classes" on classes for select to authenticated using (teacher_id = auth.uid());
create policy "teachers_create_own_classes" on classes for insert to authenticated with check (teacher_id = auth.uid() and is_teacher());
create policy "teachers_update_own_classes" on classes for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "teachers_delete_own_classes" on classes for delete to authenticated using (teacher_id = auth.uid());

drop policy if exists "students_all_mvp" on students;
drop policy if exists "students_read_authorized" on students;
drop policy if exists "students_update_authorized" on students;
create policy "students_read_authorized" on students for select to authenticated
  using (id = auth.uid() or teacher_id = auth.uid());
create policy "students_update_authorized" on students for update to authenticated
  using (id = auth.uid() or teacher_id = auth.uid())
  with check (id = auth.uid() or teacher_id = auth.uid());

create or replace function public.protect_student_ownership()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and
    (new.id <> old.id or new.teacher_id <> old.teacher_id or new.class_id <> old.class_id or new.email is distinct from old.email) then
    raise exception 'Student ownership fields cannot be changed';
  end if;
  return new;
end $$;
drop trigger if exists protect_student_ownership_trigger on students;
create trigger protect_student_ownership_trigger before update on students
for each row execute function protect_student_ownership();

drop policy if exists "materials_anon_all" on materials;
drop policy if exists "teachers_read_own_materials" on materials;
drop policy if exists "teachers_create_own_materials" on materials;
drop policy if exists "teachers_update_own_materials" on materials;
drop policy if exists "teachers_delete_own_materials" on materials;
drop policy if exists "students_read_assigned_materials" on materials;
create policy "teachers_read_own_materials" on materials for select to authenticated using (teacher_id = auth.uid());
create policy "teachers_create_own_materials" on materials for insert to authenticated with check (teacher_id = auth.uid() and is_teacher());
create policy "teachers_update_own_materials" on materials for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "teachers_delete_own_materials" on materials for delete to authenticated using (teacher_id = auth.uid());
create policy "students_read_assigned_materials" on materials for select to authenticated
  using (status = 'published' and student_has_material(id));

drop policy if exists "assignments_anon_all" on assignments;
drop policy if exists "teachers_read_owned_assignments" on assignments;
drop policy if exists "teachers_create_owned_assignments" on assignments;
drop policy if exists "teachers_update_owned_assignments" on assignments;
drop policy if exists "teachers_delete_owned_assignments" on assignments;
drop policy if exists "students_read_own_assignments" on assignments;
drop policy if exists "students_update_own_assignments" on assignments;
create policy "teachers_read_owned_assignments" on assignments for select to authenticated using (owns_material(material_id));
create policy "teachers_create_owned_assignments" on assignments for insert to authenticated
  with check (owns_material(material_id) and teaches_student(student_id));
create policy "teachers_update_owned_assignments" on assignments for update to authenticated
  using (owns_material(material_id)) with check (owns_material(material_id));
create policy "teachers_delete_owned_assignments" on assignments for delete to authenticated using (owns_material(material_id));
create policy "students_read_own_assignments" on assignments for select to authenticated using (student_id = auth.uid()::text);
create policy "students_update_own_assignments" on assignments for update to authenticated
  using (student_id = auth.uid()::text) with check (student_id = auth.uid()::text);

create or replace function public.protect_assignment_ownership()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and (new.id <> old.id or new.material_id <> old.material_id or new.student_id <> old.student_id) then
    raise exception 'Assignment ownership fields cannot be changed';
  end if;
  return new;
end $$;
drop trigger if exists protect_assignment_ownership_trigger on assignments;
create trigger protect_assignment_ownership_trigger before update on assignments
for each row execute function protect_assignment_ownership();

drop policy if exists "learning_profiles_all_mvp" on learning_profiles;
drop policy if exists "learning_profiles_read" on learning_profiles;
drop policy if exists "students_insert_learning_profile" on learning_profiles;
drop policy if exists "students_update_learning_profile" on learning_profiles;
create policy "learning_profiles_read" on learning_profiles for select to authenticated
  using (student_id = auth.uid()::text or teaches_student(student_id));
create policy "students_insert_learning_profile" on learning_profiles for insert to authenticated
  with check (student_id = auth.uid()::text);
create policy "students_update_learning_profile" on learning_profiles for update to authenticated
  using (student_id = auth.uid()::text) with check (student_id = auth.uid()::text);

drop policy if exists "learning_reports_all_mvp" on learning_reports;
drop policy if exists "learning_reports_read" on learning_reports;
drop policy if exists "students_insert_learning_reports" on learning_reports;
create policy "learning_reports_read" on learning_reports for select to authenticated
  using (student_id = auth.uid()::text or teaches_student(student_id));
create policy "students_insert_learning_reports" on learning_reports for insert to authenticated
  with check (student_id = auth.uid()::text and exists (
    select 1 from assignments a where a.id = assignment_id and a.student_id = auth.uid()::text
  ));

drop policy if exists "memory_boosters_all_mvp" on memory_boosters;
drop policy if exists "memory_boosters_read" on memory_boosters;
drop policy if exists "students_insert_memory_boosters" on memory_boosters;
create policy "memory_boosters_read" on memory_boosters for select to authenticated
  using (student_id = auth.uid()::text or teaches_student(student_id));
create policy "students_insert_memory_boosters" on memory_boosters for insert to authenticated
  with check (student_id = auth.uid()::text and student_has_material(material_id));

drop policy if exists "learning_events_all_mvp" on learning_events;
drop policy if exists "learning_events_read" on learning_events;
drop policy if exists "students_insert_learning_events" on learning_events;
create policy "learning_events_read" on learning_events for select to authenticated
  using (student_id = auth.uid()::text or teaches_student(student_id));
create policy "students_insert_learning_events" on learning_events for insert to authenticated
  with check (student_id = auth.uid()::text and student_has_material(material_id));

drop policy if exists "flashcards_all_mvp" on flashcards;
drop policy if exists "flashcards_read_authorized" on flashcards;
drop policy if exists "teachers_create_flashcards" on flashcards;
drop policy if exists "teachers_update_flashcards" on flashcards;
drop policy if exists "teachers_delete_flashcards" on flashcards;
create policy "flashcards_read_authorized" on flashcards for select to authenticated
  using (owns_material(material_id) or student_has_material(material_id));
create policy "teachers_create_flashcards" on flashcards for insert to authenticated with check (owns_material(material_id));
create policy "teachers_update_flashcards" on flashcards for update to authenticated using (owns_material(material_id)) with check (owns_material(material_id));
create policy "teachers_delete_flashcards" on flashcards for delete to authenticated using (owns_material(material_id));

drop policy if exists "xp_all_mvp" on xp_transactions;
drop policy if exists "xp_read_authorized" on xp_transactions;
drop policy if exists "students_insert_system_xp" on xp_transactions;
drop policy if exists "teachers_insert_student_xp" on xp_transactions;
create policy "xp_read_authorized" on xp_transactions for select to authenticated
  using (student_id = auth.uid()::text or teaches_student(student_id));
create policy "students_insert_system_xp" on xp_transactions for insert to authenticated
  with check (student_id = auth.uid()::text and awarded_by = 'system' and teacher_id is null);
create policy "teachers_insert_student_xp" on xp_transactions for insert to authenticated
  with check (teaches_student(student_id) and awarded_by = 'teacher' and teacher_id = auth.uid()::text);

drop policy if exists "badges_all_mvp" on student_badges;
drop policy if exists "badges_read_authorized" on student_badges;
drop policy if exists "students_insert_system_badges" on student_badges;
drop policy if exists "teachers_insert_student_badges" on student_badges;
create policy "badges_read_authorized" on student_badges for select to authenticated
  using (student_id = auth.uid()::text or teaches_student(student_id));
create policy "students_insert_system_badges" on student_badges for insert to authenticated
  with check (student_id = auth.uid()::text and awarded_by = 'system' and teacher_id is null);
create policy "teachers_insert_student_badges" on student_badges for insert to authenticated
  with check (teaches_student(student_id) and awarded_by = 'teacher' and teacher_id = auth.uid()::text);
