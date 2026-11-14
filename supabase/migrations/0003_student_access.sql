-- Dukungan alur murid: tes yang sudah pernah/sedang dikerjakan tetap terbaca.

create function public.has_attempt_for_test(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.attempts a
    where a.test_id = p_test_id and a.student_id = auth.uid()
  );
$$;

revoke execute on function public.has_attempt_for_test(uuid) from public;
grant execute on function public.has_attempt_for_test(uuid) to authenticated;

create policy tests_student_select_attempted on public.tests
  for select to authenticated
  using (public.has_attempt_for_test(id));

-- Ringkasan tes juga tersedia untuk murid yang sudah punya attempt
-- (mis. tes ditutup saat murid masih mengerjakan, BR-5).
create or replace function public.get_test_summary(p_test_id uuid)
returns table (
  id uuid,
  title text,
  level smallint,
  description text,
  duration_minutes integer,
  listening_count integer,
  reading_count integer,
  total_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.tests t
    where t.id = p_test_id
      and (t.status = 'open' or public.is_admin() or public.has_attempt_for_test(t.id))
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Tes tidak tersedia.';
  end if;

  return query
    select
      t.id,
      t.title,
      t.level,
      t.description,
      t.duration_minutes,
      count(q.id) filter (where q.section = 'listening')::integer,
      count(q.id) filter (where q.section = 'reading')::integer,
      count(q.id)::integer
    from public.tests t
    left join public.questions q on q.test_id = t.id
    where t.id = p_test_id
    group by t.id;
end;
$$;

revoke execute on function public.get_test_summary(uuid) from public;
grant execute on function public.get_test_summary(uuid) to authenticated;
