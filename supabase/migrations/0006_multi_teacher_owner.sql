-- Multi-guru, owner, isolasi data, dan KPI.
-- Jalankan setelah 0005_allow_test_level_and_duration_edits.sql.

-- ---------------------------------------------------------------------------
-- Role
-- ---------------------------------------------------------------------------
-- Enum baru dibuat lalu kolom dipindahkan agar nilai baru bisa langsung
-- dipakai dalam transaksi migrasi yang sama.
alter type public.user_role rename to user_role_legacy;

create type public.user_role as enum ('owner', 'admin', 'teacher', 'student');

alter table public.profiles
  alter column role drop default,
  alter column role type public.user_role using (role::text::public.user_role),
  alter column role set default 'student';

drop type public.user_role_legacy;

-- ---------------------------------------------------------------------------
-- Relasi guru-murid dan penugasan tes
-- ---------------------------------------------------------------------------
create table public.teacher_students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.profiles (id) on delete set null,
  check (teacher_id <> student_id)
);

create unique index teacher_students_one_active_student
  on public.teacher_students (student_id)
  where ended_at is null;

create index teacher_students_teacher_active_idx
  on public.teacher_students (teacher_id)
  where ended_at is null;

create index teacher_students_student_idx
  on public.teacher_students (student_id);

create table public.test_assignments (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (test_id, teacher_id)
);

create index test_assignments_teacher_idx
  on public.test_assignments (teacher_id);

-- Validasi role agar relasi tidak bisa diisi akun yang salah.
create function public.teacher_students_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.teacher_id and p.role = 'teacher'
  ) then
    raise exception using errcode = 'P0001', message = 'Akun guru tidak valid.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = new.student_id and p.role = 'student'
  ) then
    raise exception using errcode = 'P0001', message = 'Akun murid tidak valid.';
  end if;

  return new;
end;
$$;

create trigger teacher_students_guard_write
  before insert or update of teacher_id, student_id on public.teacher_students
  for each row execute function public.teacher_students_guard();

create function public.test_assignments_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.teacher_id and p.role = 'teacher'
  ) then
    raise exception using errcode = 'P0001', message = 'Akun guru tidak valid.';
  end if;

  return new;
end;
$$;

create trigger test_assignments_guard_write
  before insert or update of teacher_id on public.test_assignments
  for each row execute function public.test_assignments_guard();

-- ---------------------------------------------------------------------------
-- Helper role & akses
-- ---------------------------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin')
      and p.is_active = true
  );
$$;

-- Nama lama tetap dipertahankan agar pemanggil lama tidak rusak.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner();
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
      and p.is_active = true
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner() or public.is_teacher();
$$;

create or replace function public.is_teacher_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teacher_students ts
    where ts.teacher_id = auth.uid()
      and ts.student_id = p_student_id
      and ts.ended_at is null
  );
$$;

create or replace function public.teacher_owns_test(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner()
    or exists (
      select 1 from public.tests t
      where t.id = p_test_id and t.created_by = auth.uid()
    );
$$;

create or replace function public.teacher_can_access_test(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.teacher_owns_test(p_test_id)
    or exists (
      select 1
      from public.test_assignments ta
      where ta.test_id = p_test_id and ta.teacher_id = auth.uid()
    );
$$;

-- Guru baru tetap dapat melihat tes dan hasil lama murid yang pindah kepadanya.
create or replace function public.teacher_can_review_test(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_teacher()
    and exists (
      select 1
      from public.attempts a
      join public.teacher_students ts on ts.student_id = a.student_id
      where a.test_id = p_test_id
        and ts.teacher_id = auth.uid()
        and ts.ended_at is null
    );
$$;

create or replace function public.teacher_can_access_question(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.questions q
    where q.id = p_question_id
      and (
        public.teacher_can_access_test(q.test_id)
        or public.teacher_can_review_test(q.test_id)
      )
  );
$$;

create or replace function public.teacher_owns_question(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.questions q
    where q.id = p_question_id
      and public.teacher_owns_test(q.test_id)
  );
$$;

create or replace function public.teacher_can_access_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts a
    where a.id = p_attempt_id
      and public.is_teacher_of_student(a.student_id)
  );
$$;

-- Tes terlihat oleh murid jika:
-- 1. tes ditugaskan ke guru aktif murid, atau
-- 2. tes dibuat oleh guru aktif murid, atau
-- 3. tes milik owner dan tidak ditugaskan ke guru mana pun (tes global),
-- 4. atau murid sudah/sedang punya pengerjaan (BR-5).
create or replace function public.student_can_access_test(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tests t
    where t.id = p_test_id
      and (
        exists (
          select 1 from public.attempts a
          where a.test_id = t.id and a.student_id = auth.uid()
        )
        or (
          t.status = 'open'
          and (
            exists (
              select 1
              from public.test_assignments ta
              join public.teacher_students ts on ts.teacher_id = ta.teacher_id
              join public.profiles tp on tp.id = ta.teacher_id and tp.is_active = true
              where ta.test_id = t.id
                and ts.student_id = auth.uid()
                and ts.ended_at is null
            )
            or exists (
              select 1
              from public.teacher_students ts
              join public.profiles tp on tp.id = ts.teacher_id and tp.is_active = true
              where ts.student_id = auth.uid()
                and ts.teacher_id = t.created_by
                and ts.ended_at is null
            )
            or (
              not exists (
                select 1 from public.test_assignments ta where ta.test_id = t.id
              )
              and (
                t.created_by is null
                or exists (
                  select 1 from public.profiles p
                  where p.id = t.created_by and p.role in ('owner', 'admin')
                )
              )
            )
          )
        )
      )
  );
$$;

create or replace function public.can_manage_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts a
    where a.id = p_attempt_id
      and (
        public.is_owner()
        or (
          public.is_teacher()
          and public.is_teacher_of_student(a.student_id)
        )
      )
  );
$$;

-- Penghapusan tes harus memeriksa seluruh pengerjaan, termasuk pengerjaan murid
-- yang tidak terlihat guru karena RLS. Tanpa ini, guru dapat menghapus tes dan
-- ikut menghapus riwayat hasil murid lama melalui cascade.
create function public.tests_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.attempts a where a.test_id = old.id) then
    raise exception using
      errcode = 'P0001',
      message = 'Tes tidak dapat dihapus karena sudah ada pengerjaan.';
  end if;

  return old;
end;
$$;

create trigger tests_delete_guard_write
  before delete on public.tests
  for each row execute function public.tests_delete_guard();

-- ---------------------------------------------------------------------------
-- Fungsi bisnis: sesuaikan dengan akses baru
-- ---------------------------------------------------------------------------
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
      and (
        public.is_owner()
        or public.teacher_can_access_test(t.id)
        or public.student_can_access_test(t.id)
      )
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

create or replace function public.start_attempt(p_test_id uuid)
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
    raise exception using errcode = 'P0001', message = 'Akun tidak aktif. Hubungi guru atau owner.';
  end if;

  if not public.student_can_access_test(p_test_id) then
    raise exception using errcode = 'P0001', message = 'Tes tidak tersedia.';
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

create or replace function public.submit_attempt(p_attempt_id uuid)
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
    and (a.student_id = auth.uid() or public.can_manage_attempt(a.id))
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

create or replace function public.reset_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_attempt(p_attempt_id) then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  delete from public.attempts a where a.id = p_attempt_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Pengerjaan tidak ditemukan.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fungsi admin/guru untuk tes & soal
-- ---------------------------------------------------------------------------
create or replace function public.save_question(
  p_test_id uuid,
  p_question_id uuid,
  p_section public.question_section,
  p_prompt text,
  p_image_path text,
  p_audio_path text,
  p_options jsonb,
  p_correct_label text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_position integer;
  v_option jsonb;
  v_label text;
  v_text text;
  v_labels text[] := array[]::text[];
  v_count integer := 0;
  v_correct_option_id uuid;
  v_old_section public.question_section;
  v_old_position integer;
begin
  if not public.teacher_owns_test(p_test_id) then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  if not exists (select 1 from public.tests t where t.id = p_test_id) then
    raise exception using errcode = 'P0001', message = 'Tes tidak ditemukan.';
  end if;

  perform public.assert_test_editable(p_test_id);

  if p_section = 'listening' and coalesce(p_audio_path, '') = '' then
    raise exception using
      errcode = 'P0001',
      message = 'Soal Listening wajib memiliki audio.';
  end if;

  if jsonb_typeof(p_options) <> 'array' then
    raise exception using errcode = 'P0001', message = 'Opsi jawaban tidak valid.';
  end if;

  for v_option in select * from jsonb_array_elements(p_options)
  loop
    v_count := v_count + 1;
    v_label := upper(trim(v_option ->> 'label'));
    v_text := trim(coalesce(v_option ->> 'text', ''));

    if v_label not in ('A', 'B', 'C', 'D', 'E') or v_label = any (v_labels) then
      raise exception using errcode = 'P0001', message = 'Label opsi tidak valid.';
    end if;
    if v_text = '' then
      raise exception using errcode = 'P0001', message = 'Teks opsi wajib diisi.';
    end if;

    v_labels := array_append(v_labels, v_label);
  end loop;

  if v_count < 2 or v_count > 5 then
    raise exception using
      errcode = 'P0001',
      message = 'Soal harus memiliki 2 sampai 5 opsi.';
  end if;

  if not (upper(trim(p_correct_label)) = any (v_labels)) then
    raise exception using
      errcode = 'P0001',
      message = 'Pilih satu kunci jawaban yang valid.';
  end if;

  if p_question_id is null then
    select coalesce(max(q.position), 0) + 1 into v_position
    from public.questions q
    where q.test_id = p_test_id and q.section = p_section;

    insert into public.questions
      (test_id, section, position, prompt, image_path, audio_path)
    values
      (p_test_id, p_section, v_position, p_prompt, p_image_path, p_audio_path)
    returning id into v_question_id;
  else
    select q.section, q.position into v_old_section, v_old_position
    from public.questions q
    where q.id = p_question_id and q.test_id = p_test_id;

    if v_old_section is null then
      raise exception using errcode = 'P0001', message = 'Soal tidak ditemukan.';
    end if;

    v_position := v_old_position;
    if v_old_section <> p_section then
      select coalesce(max(q.position), 0) + 1 into v_position
      from public.questions q
      where q.test_id = p_test_id
        and q.section = p_section
        and q.id <> p_question_id;
    end if;

    v_question_id := p_question_id;

    update public.questions q
    set section = p_section,
        position = v_position,
        prompt = p_prompt,
        image_path = p_image_path,
        audio_path = p_audio_path
    where q.id = v_question_id;

    delete from public.question_options o where o.question_id = v_question_id;
  end if;

  for v_option in select * from jsonb_array_elements(p_options)
  loop
    v_label := upper(trim(v_option ->> 'label'));
    v_text := trim(coalesce(v_option ->> 'text', ''));

    insert into public.question_options (question_id, label, text)
    values (v_question_id, v_label, v_text);

    if v_label = upper(trim(p_correct_label)) then
      select o.id into v_correct_option_id
      from public.question_options o
      where o.question_id = v_question_id and o.label = v_label;
    end if;
  end loop;

  insert into public.answer_keys (question_id, correct_option_id)
  values (v_question_id, v_correct_option_id)
  on conflict (question_id)
  do update set correct_option_id = excluded.correct_option_id;

  return v_question_id;
end;
$$;

create or replace function public.delete_question(p_question_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_id uuid;
  v_section public.question_section;
  v_position integer;
  v_image text;
  v_audio text;
begin
  select q.test_id, q.section, q.position, q.image_path, q.audio_path
  into v_test_id, v_section, v_position, v_image, v_audio
  from public.questions q
  where q.id = p_question_id;

  if v_test_id is null then
    raise exception using errcode = 'P0001', message = 'Soal tidak ditemukan.';
  end if;

  if not public.teacher_owns_test(v_test_id) then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  perform public.assert_test_editable(v_test_id);

  delete from public.questions q where q.id = p_question_id;

  update public.questions q
  set position = q.position + 100000
  where q.test_id = v_test_id and q.section = v_section and q.position > v_position;

  update public.questions q
  set position = q.position - 100001
  where q.test_id = v_test_id and q.section = v_section and q.position > 100000;

  return v_test_id;
end;
$$;

create or replace function public.move_question(p_question_id uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question public.questions%rowtype;
  v_target public.questions%rowtype;
begin
  select * into v_question from public.questions q where q.id = p_question_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'Soal tidak ditemukan.';
  end if;

  if not public.teacher_owns_test(v_question.test_id) then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  perform public.assert_test_editable(v_question.test_id);

  if p_direction < 0 then
    select * into v_target
    from public.questions q
    where q.test_id = v_question.test_id
      and q.section = v_question.section
      and q.position < v_question.position
    order by q.position desc
    limit 1;
  else
    select * into v_target
    from public.questions q
    where q.test_id = v_question.test_id
      and q.section = v_question.section
      and q.position > v_question.position
    order by q.position asc
    limit 1;
  end if;

  if not found then
    return;
  end if;

  update public.questions q set position = v_target.position + 100000 where q.id = v_question.id;
  update public.questions q set position = v_question.position where q.id = v_target.id;
  update public.questions q set position = v_target.position where q.id = v_question.id;

  set constraints public.questions_position_unique immediate;
end;
$$;

create or replace function public.duplicate_test(p_test_id uuid, p_media_map jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.tests%rowtype;
  v_new_test_id uuid;
  v_question record;
  v_new_question_id uuid;
  v_option record;
  v_new_option_id uuid;
  v_correct_new uuid;
  v_image text;
  v_audio text;
begin
  if not public.teacher_owns_test(p_test_id) then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  select * into v_source from public.tests t where t.id = p_test_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'Tes tidak ditemukan.';
  end if;

  insert into public.tests
    (title, level, description, duration_minutes, status, created_by)
  values
    (left(v_source.title || ' (salinan)', 200),
     v_source.level,
     v_source.description,
     v_source.duration_minutes,
     'draft',
     auth.uid())
  returning id into v_new_test_id;

  for v_question in
    select * from public.questions q where q.test_id = p_test_id
    order by q.section, q.position
  loop
    v_image := p_media_map ->> v_question.image_path;
    v_audio := p_media_map ->> v_question.audio_path;

    insert into public.questions
      (test_id, section, position, prompt, image_path, audio_path)
    values
      (v_new_test_id, v_question.section, v_question.position, v_question.prompt,
       coalesce(v_image, v_question.image_path),
       coalesce(v_audio, v_question.audio_path))
    returning id into v_new_question_id;

    v_correct_new := null;

    for v_option in
      select o.*, (k.correct_option_id = o.id) as is_correct
      from public.question_options o
      left join public.answer_keys k on k.question_id = o.question_id
      where o.question_id = v_question.id
      order by o.label
    loop
      insert into public.question_options (question_id, label, text)
      values (v_new_question_id, v_option.label, v_option.text)
      returning id into v_new_option_id;

      if v_option.is_correct then
        v_correct_new := v_new_option_id;
      end if;
    end loop;

    if v_correct_new is not null then
      insert into public.answer_keys (question_id, correct_option_id)
      values (v_new_question_id, v_correct_new);
    end if;
  end loop;

  return v_new_test_id;
end;
$$;

create or replace function public.update_question_text(
  p_test_id uuid,
  p_question_id uuid,
  p_prompt text,
  p_options jsonb,
  p_correct_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_test_id uuid;
  v_item jsonb;
  v_label text;
  v_text text;
  v_updated integer;
  v_expected integer;
  v_correct_option_id uuid;
begin
  if not public.teacher_owns_test(p_test_id) then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  select q.test_id into v_question_test_id
  from public.questions q
  where q.id = p_question_id;

  if v_question_test_id is null or v_question_test_id <> p_test_id then
    raise exception using errcode = 'P0001', message = 'Soal tidak ditemukan pada tes ini.';
  end if;

  if not exists (select 1 from public.attempts a where a.test_id = p_test_id) then
    raise exception using errcode = 'P0001', message = 'Gunakan penyimpanan soal biasa untuk tes tanpa pengerjaan.';
  end if;

  if char_length(trim(p_prompt)) not between 1 and 4000
     or jsonb_typeof(p_options) <> 'array' then
    raise exception using errcode = 'P0001', message = 'Teks soal tidak valid.';
  end if;

  select count(*) into v_expected
  from public.question_options o
  where o.question_id = p_question_id;

  if jsonb_array_length(p_options) <> v_expected or v_expected < 2 or v_expected > 5 then
    raise exception using errcode = 'P0001', message = 'Jumlah opsi tidak dapat diubah setelah ada pengerjaan.';
  end if;

  if upper(trim(p_correct_label)) not in ('A', 'B', 'C', 'D', 'E') then
    raise exception using errcode = 'P0001', message = 'Kunci jawaban tidak valid.';
  end if;

  if not exists (
    select 1 from public.question_options o
    where o.question_id = p_question_id and o.label = upper(trim(p_correct_label))
  ) then
    raise exception using errcode = 'P0001', message = 'Kunci jawaban harus cocok dengan opsi soal.';
  end if;

  update public.questions q
  set prompt = trim(p_prompt)
  where q.id = p_question_id and q.test_id = p_test_id;

  for v_item in select * from jsonb_array_elements(p_options)
  loop
    v_label := upper(trim(v_item ->> 'label'));
    v_text := trim(coalesce(v_item ->> 'text', ''));
    if v_label not in ('A', 'B', 'C', 'D', 'E') or char_length(v_text) not between 1 and 2000 then
      raise exception using errcode = 'P0001', message = 'Teks opsi tidak valid.';
    end if;

    if exists (
      select 1 from public.question_options o
      where o.question_id = p_question_id and o.label = v_label and o.text is distinct from v_text
    ) and exists (
      select 1 from public.attempt_answers aa
      join public.attempts a on a.id = aa.attempt_id
      join public.question_options o on o.id = aa.selected_option_id
      where aa.question_id = p_question_id
        and o.label = v_label
        and a.status = 'in_progress'
    ) then
      raise exception using errcode = 'P0001', message = 'Teks opsi yang sudah dipilih murid dengan tes berlangsung tidak dapat diubah.';
    end if;

    update public.question_options o
    set text = v_text
    where o.question_id = p_question_id and o.label = v_label;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception using errcode = 'P0001', message = 'Label opsi tidak sesuai dengan soal.';
    end if;
    if v_label = upper(trim(p_correct_label)) then
      select o.id into v_correct_option_id
      from public.question_options o
      where o.question_id = p_question_id and o.label = v_label;
    end if;
  end loop;

  if v_correct_option_id is null then
    raise exception using errcode = 'P0001', message = 'Kunci jawaban harus cocok dengan opsi soal.';
  end if;

  update public.answer_keys
  set correct_option_id = v_correct_option_id
  where question_id = p_question_id;

  update public.attempts a
  set correct_count = scores.correct_count,
      total_count = scores.total_count,
      listening_correct = scores.listening_correct,
      listening_total = scores.listening_total,
      reading_correct = scores.reading_correct,
      reading_total = scores.reading_total
  from (
    select a.id,
      count(q.id)::integer as total_count,
      count(*) filter (where aa.selected_option_id = k.correct_option_id)::integer as correct_count,
      count(q.id) filter (where q.section = 'listening')::integer as listening_total,
      count(*) filter (where q.section = 'listening' and aa.selected_option_id = k.correct_option_id)::integer as listening_correct,
      count(q.id) filter (where q.section = 'reading')::integer as reading_total,
      count(*) filter (where q.section = 'reading' and aa.selected_option_id = k.correct_option_id)::integer as reading_correct
    from public.attempts a
    join public.questions q on q.test_id = a.test_id
    left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id
    left join public.answer_keys k on k.question_id = q.id
    where a.test_id = p_test_id and a.status in ('submitted', 'expired')
    group by a.id
  ) scores
  where a.id = scores.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operasi owner: atur guru-murid dan penugasan tes
-- ---------------------------------------------------------------------------
create or replace function public.assign_student_to_teacher(
  p_teacher_id uuid,
  p_student_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_teacher_id and p.role = 'teacher' and p.is_active = true
  ) then
    raise exception using errcode = 'P0001', message = 'Guru tidak ditemukan atau nonaktif.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_student_id and p.role = 'student'
  ) then
    raise exception using errcode = 'P0001', message = 'Murid tidak ditemukan.';
  end if;

  update public.teacher_students
  set ended_at = now(), ended_by = auth.uid()
  where student_id = p_student_id
    and ended_at is null
    and teacher_id <> p_teacher_id;

  insert into public.teacher_students (teacher_id, student_id, assigned_by)
  select p_teacher_id, p_student_id, auth.uid()
  where not exists (
    select 1 from public.teacher_students ts
    where ts.teacher_id = p_teacher_id
      and ts.student_id = p_student_id
      and ts.ended_at is null
  );
end;
$$;

create or replace function public.unassign_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  update public.teacher_students
  set ended_at = now(), ended_by = auth.uid()
  where student_id = p_student_id and ended_at is null;
end;
$$;

create or replace function public.set_test_assignments(
  p_test_id uuid,
  p_teacher_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := coalesce(p_teacher_ids, array[]::uuid[]);
begin
  if not public.is_owner() then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  if not exists (select 1 from public.tests t where t.id = p_test_id) then
    raise exception using errcode = 'P0001', message = 'Tes tidak ditemukan.';
  end if;

  if exists (
    select 1
    from unnest(v_ids) as t(id)
    where not exists (
      select 1 from public.profiles p where p.id = t.id and p.role = 'teacher'
    )
  ) then
    raise exception using errcode = 'P0001', message = 'Daftar guru tidak valid.';
  end if;

  delete from public.test_assignments ta
  where ta.test_id = p_test_id
    and ta.teacher_id <> all (v_ids);

  insert into public.test_assignments (test_id, teacher_id, assigned_by)
  select p_test_id, t.id, auth.uid()
  from unnest(v_ids) as t(id)
  on conflict (test_id, teacher_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- KPI owner
-- ---------------------------------------------------------------------------
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
    select ts.teacher_id, ts.student_id
    from public.teacher_students ts
    where ts.ended_at is null
  ),
  student_scores as (
    select
      cs.teacher_id,
      a.student_id,
      avg((a.correct_count::numeric / nullif(a.total_count, 0)) * 100) as avg_pct
    from current_students cs
    join public.attempts a on a.student_id = cs.student_id
    where a.status in ('submitted', 'expired')
      and coalesce(a.total_count, 0) > 0
    group by cs.teacher_id, a.student_id
  ),
  per_teacher as (
    select
      cs.teacher_id,
      count(distinct cs.student_id) as student_count,
      count(a.id) as attempt_count,
      count(a.id) filter (where a.status in ('submitted', 'expired')) as completed_count,
      avg((a.correct_count::numeric / nullif(a.total_count, 0)) * 100)
        filter (where a.status in ('submitted', 'expired') and coalesce(a.total_count, 0) > 0) as avg_pct,
      max(a.submitted_at) as last_activity
    from current_students cs
    left join public.attempts a on a.student_id = cs.student_id
    group by cs.teacher_id
  ),
  weak as (
    select teacher_id, count(*) as weak_count
    from student_scores
    where avg_pct < 60
    group by teacher_id
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.teacher_students enable row level security;
alter table public.test_assignments enable row level security;

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_owner_all on public.profiles
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy profiles_teacher_select on public.profiles
  for select to authenticated
  using (
    public.is_teacher()
    and (id = auth.uid() or public.is_teacher_of_student(id))
  );

drop policy if exists tests_student_select_open on public.tests;
drop policy if exists tests_student_select_attempted on public.tests;
drop policy if exists tests_admin_all on public.tests;

create policy tests_owner_all on public.tests
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy tests_teacher_select on public.tests
  for select to authenticated
  using (
    public.is_teacher()
    and (
      public.teacher_can_access_test(id)
      or public.teacher_can_review_test(id)
    )
  );

create policy tests_teacher_insert on public.tests
  for insert to authenticated
  with check (public.is_teacher() and created_by = auth.uid());

create policy tests_teacher_update on public.tests
  for update to authenticated
  using (public.is_teacher() and created_by = auth.uid())
  with check (public.is_teacher() and created_by = auth.uid());

create policy tests_teacher_delete on public.tests
  for delete to authenticated
  using (public.is_teacher() and created_by = auth.uid());

create policy tests_student_select_accessible on public.tests
  for select to authenticated
  using (public.student_can_access_test(id));

drop policy if exists questions_student_select_active_attempt on public.questions;
drop policy if exists questions_admin_all on public.questions;

create policy questions_owner_all on public.questions
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy questions_teacher_select on public.questions
  for select to authenticated
  using (
    public.is_teacher()
    and (
      public.teacher_can_access_test(test_id)
      or public.teacher_can_review_test(test_id)
    )
  );

create policy questions_teacher_write on public.questions
  for all to authenticated
  using (public.is_teacher() and public.teacher_owns_test(test_id))
  with check (public.is_teacher() and public.teacher_owns_test(test_id));

create policy questions_student_select_active_attempt on public.questions
  for select to authenticated
  using (public.has_active_attempt(test_id));

drop policy if exists question_options_student_select_active_attempt on public.question_options;
drop policy if exists question_options_admin_all on public.question_options;

create policy question_options_owner_all on public.question_options
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy question_options_teacher_select on public.question_options
  for select to authenticated
  using (public.is_teacher() and public.teacher_can_access_question(question_id));

create policy question_options_teacher_write on public.question_options
  for all to authenticated
  using (public.is_teacher() and public.teacher_owns_question(question_id))
  with check (public.is_teacher() and public.teacher_owns_question(question_id));

create policy question_options_student_select_active_attempt on public.question_options
  for select to authenticated
  using (public.has_active_attempt_for_question(question_id));

drop policy if exists answer_keys_admin_all on public.answer_keys;

create policy answer_keys_owner_all on public.answer_keys
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy answer_keys_teacher_select on public.answer_keys
  for select to authenticated
  using (public.is_teacher() and public.teacher_can_access_question(question_id));

create policy answer_keys_teacher_write on public.answer_keys
  for all to authenticated
  using (public.is_teacher() and public.teacher_owns_question(question_id))
  with check (public.is_teacher() and public.teacher_owns_question(question_id));

drop policy if exists attempts_admin_all on public.attempts;

create policy attempts_owner_all on public.attempts
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy attempts_teacher_select on public.attempts
  for select to authenticated
  using (
    public.is_teacher()
    and public.is_teacher_of_student(student_id)
  );

drop policy if exists attempt_answers_student_select_own on public.attempt_answers;
drop policy if exists attempt_answers_admin_all on public.attempt_answers;

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

create policy attempt_answers_owner_all on public.attempt_answers
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy attempt_answers_teacher_select on public.attempt_answers
  for select to authenticated
  using (public.is_teacher() and public.teacher_can_access_attempt(attempt_id));

create policy teacher_students_owner_all on public.teacher_students
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy teacher_students_teacher_select on public.teacher_students
  for select to authenticated
  using (public.is_teacher() and teacher_id = auth.uid());

create policy teacher_students_student_select on public.teacher_students
  for select to authenticated
  using (student_id = auth.uid());

create policy test_assignments_owner_all on public.test_assignments
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy test_assignments_teacher_select on public.test_assignments
  for select to authenticated
  using (public.is_teacher() and teacher_id = auth.uid());

drop policy if exists question_media_admin_select on storage.objects;
drop policy if exists question_media_admin_insert on storage.objects;
drop policy if exists question_media_admin_update on storage.objects;
drop policy if exists question_media_admin_delete on storage.objects;

create policy question_media_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'question-media' and public.is_owner());

create policy question_media_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-media' and public.is_owner());

create policy question_media_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'question-media' and public.is_owner())
  with check (bucket_id = 'question-media' and public.is_owner());

create policy question_media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-media' and public.is_owner());

-- ---------------------------------------------------------------------------
-- Hak eksekusi fungsi baru
-- ---------------------------------------------------------------------------
revoke execute on function public.is_owner() from public;
revoke execute on function public.is_teacher() from public;
revoke execute on function public.is_staff() from public;
revoke execute on function public.is_teacher_of_student(uuid) from public;
revoke execute on function public.teacher_owns_test(uuid) from public;
revoke execute on function public.teacher_can_access_test(uuid) from public;
revoke execute on function public.teacher_can_review_test(uuid) from public;
revoke execute on function public.teacher_can_access_question(uuid) from public;
revoke execute on function public.teacher_owns_question(uuid) from public;
revoke execute on function public.teacher_can_access_attempt(uuid) from public;
revoke execute on function public.student_can_access_test(uuid) from public;
revoke execute on function public.can_manage_attempt(uuid) from public;
revoke execute on function public.assign_student_to_teacher(uuid, uuid) from public;
revoke execute on function public.unassign_student(uuid) from public;
revoke execute on function public.set_test_assignments(uuid, uuid[]) from public;
revoke execute on function public.owner_teacher_kpis() from public;

grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_teacher_of_student(uuid) to authenticated;
grant execute on function public.teacher_owns_test(uuid) to authenticated;
grant execute on function public.teacher_can_access_test(uuid) to authenticated;
grant execute on function public.teacher_can_review_test(uuid) to authenticated;
grant execute on function public.teacher_can_access_question(uuid) to authenticated;
grant execute on function public.teacher_owns_question(uuid) to authenticated;
grant execute on function public.teacher_can_access_attempt(uuid) to authenticated;
grant execute on function public.student_can_access_test(uuid) to authenticated;
grant execute on function public.can_manage_attempt(uuid) to authenticated;
grant execute on function public.assign_student_to_teacher(uuid, uuid) to authenticated;
grant execute on function public.unassign_student(uuid) to authenticated;
grant execute on function public.set_test_assignments(uuid, uuid[]) to authenticated;
grant execute on function public.owner_teacher_kpis() to authenticated;
