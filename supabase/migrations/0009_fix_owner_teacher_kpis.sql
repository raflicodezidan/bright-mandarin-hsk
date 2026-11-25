-- Migration 0009: Perbaikan fungsi owner_teacher_kpis
-- Masalah: 'teacher_id' ambigu di klausa GROUP BY CTE 'weak' (bisa merujuk parameter output fungsi atau kolom CTE).
-- Solusi: prefix alias tabel secara eksplisit (misal ss.teacher_id).

create or replace function public.owner_teacher_kpis()
returns table (
  teacher_id uuid,
  full_name text,
  username text,
  is_active boolean,
  student_count bigint,
  attempt_count bigint,
  completed_count bigint,
  avg_percentage numeric,
  weak_student_count bigint,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  return query
  with current_students as (
    select ts.teacher_id as t_id, ts.student_id as s_id
    from public.teacher_students ts
    where ts.ended_at is null
  ),
  student_scores as (
    select
      cs.t_id as teacher_id,
      a.student_id,
      avg((a.correct_count::numeric / nullif(a.total_count, 0)) * 100) as avg_pct
    from current_students cs
    join public.attempts a on a.student_id = cs.s_id
    where a.status in ('submitted', 'expired')
      and coalesce(a.total_count, 0) > 0
    group by cs.t_id, a.student_id
  ),
  per_teacher as (
    select
      cs.t_id as teacher_id,
      count(distinct cs.s_id) as student_count,
      count(a.id) as attempt_count,
      count(a.id) filter (where a.status in ('submitted', 'expired')) as completed_count,
      avg((a.correct_count::numeric / nullif(a.total_count, 0)) * 100)
        filter (where a.status in ('submitted', 'expired') and coalesce(a.total_count, 0) > 0) as avg_pct,
      max(a.submitted_at) as last_activity
    from current_students cs
    left join public.attempts a on a.student_id = cs.s_id
    group by cs.t_id
  ),
  weak as (
    select ss.teacher_id as teacher_id, count(*) as weak_count
    from student_scores ss
    where ss.avg_pct < 60
    group by ss.teacher_id
  )
  select
    p.id,
    p.full_name,
    p.username,
    p.is_active,
    coalesce(pt.student_count, 0),
    coalesce(pt.attempt_count, 0),
    coalesce(pt.completed_count, 0),
    round(coalesce(pt.avg_pct, 0), 1),
    coalesce(w.weak_count, 0),
    pt.last_activity
  from public.profiles p
  left join per_teacher pt on pt.teacher_id = p.id
  left join weak w on w.teacher_id = p.id
  where p.role = 'teacher'
  order by p.is_active desc, p.full_name;
end;
$$;
