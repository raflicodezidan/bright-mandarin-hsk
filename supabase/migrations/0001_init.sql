-- Bright Mandarin HSK — skema awal
-- Jalankan di project Supabase baru lewat SQL Editor atau `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'student');
create type public.test_status as enum ('draft', 'open', 'closed', 'archived');
create type public.question_section as enum ('listening', 'reading');
create type public.attempt_status as enum ('in_progress', 'submitted', 'expired');

-- ---------------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9._]{3,30}$'),
  full_name text not null check (char_length(full_name) between 1 and 120),
  role public.user_role not null default 'student',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  level smallint not null check (level between 1 and 6),
  description text not null default '',
  duration_minutes integer not null check (duration_minutes between 5 and 240),
  status public.test_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests (id) on delete cascade,
  section public.question_section not null,
  position integer not null check (position >= 1),
  prompt text not null check (char_length(prompt) between 1 and 4000),
  image_path text,
  audio_path text,
  created_at timestamptz not null default now(),
  constraint questions_position_unique unique (test_id, section, position)
    deferrable initially deferred
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label char(1) not null check (label in ('A', 'B', 'C', 'D', 'E')),
  text text not null check (char_length(text) between 1 and 2000),
  unique (question_id, label),
  -- Diperlukan agar answer_keys bisa memakai foreign key komposit.
  unique (question_id, id)
);

create table public.answer_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  correct_option_id uuid not null,
  constraint answer_keys_option_belongs_to_question
    foreign key (question_id, correct_option_id)
    references public.question_options (question_id, id)
    on delete cascade
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  status public.attempt_status not null default 'in_progress',
  correct_count integer,
  total_count integer,
  listening_correct integer,
  listening_total integer,
  reading_correct integer,
  reading_total integer,
  unique (test_id, student_id),
  check (expires_at > started_at)
);

create table public.attempt_answers (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_option_id uuid not null,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id),
  constraint attempt_answers_option_belongs_to_question
    foreign key (question_id, selected_option_id)
    references public.question_options (question_id, id)
    on delete cascade
);

-- ---------------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------------
create index questions_test_id_idx on public.questions (test_id);
create index questions_test_section_position_idx
  on public.questions (test_id, section, position);
create index question_options_question_id_idx on public.question_options (question_id);
create index attempts_student_id_idx on public.attempts (student_id);
create index attempts_test_id_idx on public.attempts (test_id);
create index attempts_status_expires_idx on public.attempts (status, expires_at);
create index attempt_answers_attempt_id_idx on public.attempt_answers (attempt_id);
create index tests_status_idx on public.tests (status);

-- ---------------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tests_set_updated_at
  before update on public.tests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper keamanan
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  );
$$;

create function public.has_active_attempt(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts a
    where a.test_id = p_test_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and now() <= a.expires_at + interval '5 seconds'
  );
$$;

create function public.has_active_attempt_for_question(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts a
    join public.questions q on q.test_id = a.test_id
    where q.id = p_question_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and now() <= a.expires_at + interval '5 seconds'
  );
$$;

-- ---------------------------------------------------------------------------
-- Penguncian edit saat sudah ada pengerjaan (BR-6, AC-9)
-- ---------------------------------------------------------------------------
create function public.assert_test_editable(p_test_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.attempts a where a.test_id = p_test_id) then
    raise exception using
      errcode = 'P0001',
      message = 'Tes sudah memiliki pengerjaan. Soal, opsi, dan kunci tidak dapat diubah.';
  end if;
end;
$$;

create function public.questions_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_id uuid;
begin
  v_test_id := coalesce(new.test_id, old.test_id);
  perform public.assert_test_editable(v_test_id);
  return coalesce(new, old);
end;
$$;

create trigger questions_guard_write
  before insert or update or delete on public.questions
  for each row execute function public.questions_guard();

create function public.question_options_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_id uuid;
begin
  select q.test_id into v_test_id
  from public.questions q
  where q.id = coalesce(new.question_id, old.question_id);

  perform public.assert_test_editable(v_test_id);
  return coalesce(new, old);
end;
$$;

create trigger question_options_guard_write
  before insert or update or delete on public.question_options
  for each row execute function public.question_options_guard();

create function public.answer_keys_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_id uuid;
begin
  select q.test_id into v_test_id
  from public.questions q
  where q.id = coalesce(new.question_id, old.question_id);

  perform public.assert_test_editable(v_test_id);
  return coalesce(new, old);
end;
$$;

create trigger answer_keys_guard_write
  before insert or update or delete on public.answer_keys
  for each row execute function public.answer_keys_guard();

create function public.tests_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_missing integer;
begin
  if new.duration_minutes is distinct from old.duration_minutes
     and exists (select 1 from public.attempts a where a.test_id = new.id) then
    raise exception using
      errcode = 'P0001',
      message = 'Durasi tes tidak dapat diubah karena sudah ada pengerjaan.';
  end if;

  if new.status = 'open' and old.status is distinct from 'open' then
    if not exists (select 1 from public.questions q where q.test_id = new.id) then
      raise exception using
        errcode = 'P0001',
        message = 'Tes belum memiliki soal sehingga tidak dapat dibuka.';
    end if;

    select count(*) into v_missing
    from public.questions q
    left join public.answer_keys k on k.question_id = q.id
    where q.test_id = new.id and k.question_id is null;

    if v_missing > 0 then
      raise exception using
        errcode = 'P0001',
        message = format('Ada %s soal tanpa kunci jawaban. Lengkapi kunci sebelum membuka tes.', v_missing);
    end if;
  end if;

  return new;
end;
$$;

create trigger tests_guard_write
  before update on public.tests
  for each row execute function public.tests_guard();

-- ---------------------------------------------------------------------------
-- Fungsi bisnis
-- ---------------------------------------------------------------------------
create function public.get_test_summary(p_test_id uuid)
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
    where t.id = p_test_id and (t.status = 'open' or public.is_admin())
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

create function public.start_attempt(p_test_id uuid)
returns table (attempt_id uuid, attempt_expires_at timestamptz, server_now timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_duration integer;
  v_existing public.attempts%rowtype;
  v_attempt_id uuid;
  v_expires_at timestamptz;
  v_now timestamptz := now();
begin
  if v_student_id is null then
    raise exception using errcode = 'P0001', message = 'Anda belum masuk.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_student_id and p.role = 'student' and p.is_active = true
  ) then
    raise exception using errcode = 'P0001', message = 'Akun tidak aktif. Hubungi admin.';
  end if;

  -- Cek attempt yang sudah ada lebih dulu. Murid dengan attempt in_progress
  -- tetap boleh melanjutkan walau tes sudah ditutup (BR-5), selama belum
  -- melewati expires_at.
  select * into v_existing
  from public.attempts a
  where a.test_id = p_test_id and a.student_id = v_student_id
  for update;

  if found then
    if v_existing.status = 'in_progress' and v_now <= v_existing.expires_at then
      return query select v_existing.id, v_existing.expires_at, v_now;
      return;
    end if;

    if v_existing.status = 'in_progress' then
      -- Waktu sudah habis: finalkan dan kembalikan attempt dengan expires_at
      -- di masa lalu. Aplikasi melihat ini lalu mengarahkan ke halaman selesai.
      perform public.score_attempt(v_existing.id, 'expired');
      return query select v_existing.id, v_existing.expires_at, v_now;
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'Tes ini sudah pernah dikerjakan.';
  end if;

  select t.duration_minutes into v_duration
  from public.tests t
  where t.id = p_test_id and t.status = 'open';

  if v_duration is null then
    raise exception using errcode = 'P0001', message = 'Tes tidak tersedia.';
  end if;

  -- Kunci baris tes agar tes tidak dihapus saat attempt dibuat.
  perform 1 from public.tests t where t.id = p_test_id for share;

  insert into public.attempts (test_id, student_id, started_at, expires_at, status)
  values (
    p_test_id,
    v_student_id,
    v_now,
    v_now + make_interval(mins => v_duration),
    'in_progress'
  )
  returning id, attempts.expires_at into v_attempt_id, v_expires_at;

  return query select v_attempt_id, v_expires_at, v_now;
exception
  when unique_violation then
    -- Klik ganda: kembalikan attempt yang menang.
    select * into v_existing
    from public.attempts a
    where a.test_id = p_test_id and a.student_id = v_student_id;

    if v_existing.status = 'in_progress' and now() <= v_existing.expires_at then
      return query select v_existing.id, v_existing.expires_at, now();
      return;
    end if;

    if v_existing.status = 'in_progress' then
      perform public.score_attempt(v_existing.id, 'expired');
      return query select v_existing.id, v_existing.expires_at, now();
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'Tes ini sudah pernah dikerjakan.';
end;
$$;

create function public.save_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_option_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_id uuid;
begin
  select a.test_id into v_test_id
  from public.attempts a
  where a.id = p_attempt_id
    and a.student_id = auth.uid()
    and a.status = 'in_progress'
    and now() <= a.expires_at + interval '5 seconds'
  for update;

  if v_test_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Pengerjaan tidak aktif atau waktu sudah habis.';
  end if;

  if not exists (
    select 1 from public.questions q
    where q.id = p_question_id and q.test_id = v_test_id
  ) then
    raise exception using errcode = 'P0001', message = 'Soal bukan milik tes ini.';
  end if;

  if not exists (
    select 1 from public.question_options o
    where o.id = p_option_id and o.question_id = p_question_id
  ) then
    raise exception using errcode = 'P0001', message = 'Opsi bukan milik soal ini.';
  end if;

  insert into public.attempt_answers (attempt_id, question_id, selected_option_id, answered_at)
  values (p_attempt_id, p_question_id, p_option_id, now())
  on conflict (attempt_id, question_id)
  do update set selected_option_id = excluded.selected_option_id,
                answered_at = excluded.answered_at;
end;
$$;

create function public.score_attempt(p_attempt_id uuid, p_status public.attempt_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_id uuid;
  v_total integer;
  v_correct integer;
  v_listening_total integer;
  v_listening_correct integer;
  v_reading_total integer;
  v_reading_correct integer;
begin
  select a.test_id into v_test_id from public.attempts a where a.id = p_attempt_id;
  if v_test_id is null then
    return;
  end if;

  select count(*) into v_total from public.questions q where q.test_id = v_test_id;

  select count(*) into v_correct
  from public.attempt_answers aa
  join public.questions q on q.id = aa.question_id and q.test_id = v_test_id
  join public.answer_keys k on k.question_id = aa.question_id
  where aa.attempt_id = p_attempt_id
    and k.correct_option_id = aa.selected_option_id;

  select count(*) into v_listening_total
  from public.questions q
  where q.test_id = v_test_id and q.section = 'listening';

  select count(*) into v_listening_correct
  from public.attempt_answers aa
  join public.questions q on q.id = aa.question_id and q.test_id = v_test_id
  join public.answer_keys k on k.question_id = aa.question_id
  where aa.attempt_id = p_attempt_id
    and q.section = 'listening'
    and k.correct_option_id = aa.selected_option_id;

  select count(*) into v_reading_total
  from public.questions q
  where q.test_id = v_test_id and q.section = 'reading';

  select count(*) into v_reading_correct
  from public.attempt_answers aa
  join public.questions q on q.id = aa.question_id and q.test_id = v_test_id
  join public.answer_keys k on k.question_id = aa.question_id
  where aa.attempt_id = p_attempt_id
    and q.section = 'reading'
    and k.correct_option_id = aa.selected_option_id;

  update public.attempts a
  set status = p_status,
      submitted_at = coalesce(a.submitted_at, now()),
      correct_count = v_correct,
      total_count = v_total,
      listening_correct = v_listening_correct,
      listening_total = v_listening_total,
      reading_correct = v_reading_correct,
      reading_total = v_reading_total
  where a.id = p_attempt_id;
end;
$$;

-- SEC-1/AC-12: fungsi ini dapat dipanggil murid lewat anon key, jadi tidak
-- boleh mengembalikan kolom skor. Skor hanya dibaca admin dari tabel attempts.
create function public.submit_attempt(p_attempt_id uuid)
returns table (
  id uuid,
  status public.attempt_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_status public.attempt_status;
begin
  select * into v_attempt
  from public.attempts a
  where a.id = p_attempt_id
    and (a.student_id = auth.uid() or public.is_admin())
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Pengerjaan tidak ditemukan.';
  end if;

  if v_attempt.status <> 'in_progress' then
    return query select v_attempt.id, v_attempt.status;
    return;
  end if;

  if now() > v_attempt.expires_at then
    v_status := 'expired';
  else
    v_status := 'submitted';
  end if;

  perform public.score_attempt(p_attempt_id, v_status);

  return query
    select a.id, a.status
    from public.attempts a
    where a.id = p_attempt_id;
end;
$$;

create function public.finalize_expired_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_count integer := 0;
begin
  for v_attempt in
    select a.id
    from public.attempts a
    where a.status = 'in_progress' and now() > a.expires_at
    for update skip locked
  loop
    perform public.score_attempt(v_attempt.id, 'expired');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create function public.reset_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'Hanya admin yang dapat mereset pengerjaan.';
  end if;

  delete from public.attempts a where a.id = p_attempt_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Pengerjaan tidak ditemukan.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hak eksekusi fungsi
-- ---------------------------------------------------------------------------
revoke execute on function public.is_admin() from public;
revoke execute on function public.has_active_attempt(uuid) from public;
revoke execute on function public.has_active_attempt_for_question(uuid) from public;
revoke execute on function public.get_test_summary(uuid) from public;
revoke execute on function public.start_attempt(uuid) from public;
revoke execute on function public.save_answer(uuid, uuid, uuid) from public;
revoke execute on function public.submit_attempt(uuid) from public;
revoke execute on function public.finalize_expired_attempts() from public;
revoke execute on function public.reset_attempt(uuid) from public;
revoke execute on function public.score_attempt(uuid, public.attempt_status) from public;
revoke execute on function public.assert_test_editable(uuid) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_active_attempt(uuid) to authenticated;
grant execute on function public.has_active_attempt_for_question(uuid) to authenticated;
grant execute on function public.get_test_summary(uuid) to authenticated;
grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.save_answer(uuid, uuid, uuid) to authenticated;
grant execute on function public.submit_attempt(uuid) to authenticated;
grant execute on function public.finalize_expired_attempts() to authenticated;
grant execute on function public.reset_attempt(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- View status pengerjaan untuk murid (tanpa kolom skor)
-- ---------------------------------------------------------------------------
create view public.student_attempt_status
with (security_invoker = off)
as
select
  a.id,
  a.test_id,
  a.started_at,
  a.expires_at,
  a.submitted_at,
  a.status
from public.attempts a
where a.student_id = auth.uid();

revoke all on public.student_attempt_status from public;
grant select on public.student_attempt_status to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.answer_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

-- profiles
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- tests
create policy tests_student_select_open on public.tests
  for select to authenticated
  using (status = 'open');

create policy tests_admin_all on public.tests
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- questions
create policy questions_student_select_active_attempt on public.questions
  for select to authenticated
  using (public.has_active_attempt(test_id));

create policy questions_admin_all on public.questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- question_options
create policy question_options_student_select_active_attempt on public.question_options
  for select to authenticated
  using (public.has_active_attempt_for_question(question_id));

create policy question_options_admin_all on public.question_options
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- answer_keys: hanya admin. Tidak ada policy untuk murid.
create policy answer_keys_admin_all on public.answer_keys
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- attempts: murid memakai view student_attempt_status, bukan tabel ini.
create policy attempts_admin_all on public.attempts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- attempt_answers
create policy attempt_answers_student_select_own on public.attempt_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_answers.attempt_id
        and a.student_id = auth.uid()
        and a.status = 'in_progress'
    )
  );

create policy attempt_answers_admin_all on public.attempt_answers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: bucket privat question-media
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('question-media', 'question-media', false)
on conflict (id) do nothing;

create policy question_media_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'question-media' and public.is_admin());

create policy question_media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-media' and public.is_admin());

create policy question_media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'question-media' and public.is_admin())
  with check (bucket_id = 'question-media' and public.is_admin());

create policy question_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-media' and public.is_admin());
