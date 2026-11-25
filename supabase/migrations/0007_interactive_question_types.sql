-- Tipe soal interaktif: matching, isian pilihan Hanzi, rearrange sentence.
-- Kunci jawaban disimpan terpisah dan tidak dibaca query murid.

create type public.question_type as enum (
  'multiple_choice',
  'matching',
  'hanzi_blank',
  'rearrange_sentence'
);

alter table public.questions
  add column question_type public.question_type not null default 'multiple_choice',
  add column interaction_config jsonb not null default '{}'::jsonb,
  add column pdf_path text;

create table public.pdf_choice_overlays (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  label char(1) not null check (label in ('A','B','C','D','E')),
  x numeric not null check (x between 0 and 1),
  y numeric not null check (y between 0 and 1),
  width numeric not null default 0.045 check (width between 0.01 and 0.2),
  height numeric not null default 0.065 check (height between 0.01 and 0.2),
  option_id uuid not null,
  created_at timestamptz not null default now(),
  unique(question_id, page_number, label),
  foreign key (question_id, option_id)
    references public.question_options(question_id, id) on delete cascade
);

alter table public.pdf_choice_overlays enable row level security;
create policy pdf_choice_overlays_owner_all on public.pdf_choice_overlays
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy pdf_choice_overlays_teacher_all on public.pdf_choice_overlays
  for all to authenticated
  using (public.is_teacher() and public.teacher_owns_question(question_id))
  with check (public.is_teacher() and public.teacher_owns_question(question_id));
create policy pdf_choice_overlays_student_read_active on public.pdf_choice_overlays
  for select to authenticated
  using (public.has_active_attempt_for_question(question_id));
drop policy question_media_teacher_select on storage.objects;
create policy question_media_teacher_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'question-media' and public.is_teacher()
    and (
      exists (
        select 1 from public.questions q
        where (q.audio_path = storage.objects.name or q.image_path = storage.objects.name)
          and public.teacher_can_access_question(q.id)
      )
      or exists (
        select 1 from public.tests t
        where t.pdf_path = storage.objects.name
          and (public.teacher_can_access_test(t.id) or public.teacher_can_review_test(t.id))
      )
    )
  );

create table public.interactive_answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interactive_answer_keys enable row level security;
create policy interactive_answer_keys_owner_select on public.interactive_answer_keys
  for select to authenticated using (public.is_owner());
create policy interactive_answer_keys_teacher_select on public.interactive_answer_keys
  for select to authenticated using (public.is_teacher() and public.teacher_can_access_question(question_id));

-- Murid hanya menerima konfigurasi/opsi publik; tabel answer key tidak pernah
-- menjadi sumber query halaman pengerjaan.
create or replace function public.interactive_question_payload(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_question public.questions%rowtype;
begin
  select * into v_question from public.questions q where q.id = p_question_id;
  if not found or v_question.question_type = 'multiple_choice'
     or not public.has_active_attempt(v_question.test_id) then
    raise exception using errcode = 'P0001', message = 'Soal interaktif tidak tersedia.';
  end if;
  return jsonb_build_object(
    'question_type', v_question.question_type,
    'interaction_config', v_question.interaction_config
  );
end;
$$;

create or replace function public.tests_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_missing integer;
begin
  if new.status = 'open' and old.status is distinct from 'open' then
    if not exists (select 1 from public.questions q where q.test_id = new.id) then
      raise exception using errcode = 'P0001', message = 'Tes belum memiliki soal sehingga tidak dapat dibuka.';
    end if;
    select count(*) into v_missing
    from public.questions q
    left join public.answer_keys k on k.question_id = q.id
    left join public.interactive_answer_keys ik on ik.question_id = q.id
    where q.test_id = new.id
      and ((q.question_type = 'multiple_choice' and k.question_id is null)
        or (q.question_type <> 'multiple_choice' and ik.question_id is null));
    if v_missing > 0 then
      raise exception using errcode = 'P0001',
        message = format('Ada %s soal tanpa kunci jawaban. Lengkapi kunci sebelum membuka tes.', v_missing);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.interactive_question_payload(uuid) from public;
grant execute on function public.interactive_question_payload(uuid) to authenticated;

alter table public.attempt_answers
  alter column selected_option_id drop not null,
  add column answer_payload jsonb not null default '{}'::jsonb;
alter table public.attempt_answers
  add constraint attempt_answers_single_payload_check check (
    (selected_option_id is not null and answer_payload = '{}'::jsonb)
    or (selected_option_id is null and answer_payload <> '{}'::jsonb)
  );

create or replace function public.save_interactive_question(
  p_test_id uuid,
  p_question_id uuid,
  p_section public.question_section,
  p_type public.question_type,
  p_prompt text,
  p_config jsonb,
  p_answer_key jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_position integer;
  v_count integer;
  v_ids text[];
  v_row record;
begin
  if p_type = 'multiple_choice' then
    raise exception using errcode = 'P0001', message = 'Gunakan form pilihan ganda biasa.';
  end if;
  if not public.teacher_owns_test(p_test_id) then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;
  perform public.assert_test_editable(p_test_id);
  if char_length(trim(p_prompt)) not between 1 and 4000 or jsonb_typeof(p_config) <> 'object' or jsonb_typeof(p_answer_key) <> 'object' then
    raise exception using errcode = 'P0001', message = 'Isi soal interaktif tidak valid.';
  end if;

  if p_type = 'matching' then
    if jsonb_typeof(p_config->'leftItems') <> 'array'
       or jsonb_typeof(p_config->'rightItems') <> 'array'
       or jsonb_array_length(p_config->'leftItems') not between 2 and 10
       or jsonb_array_length(p_config->'rightItems') not between 2 and 10
       or jsonb_typeof(p_answer_key->'matches') <> 'object' then
      raise exception using errcode = 'P0001', message = 'Data matching harus memiliki 2–10 item di setiap kolom.';
    end if;
    select array_agg(x->>'id') into v_ids from jsonb_array_elements(p_config->'leftItems') x;
    if cardinality(v_ids) <> jsonb_array_length(p_config->'leftItems') then
      raise exception using errcode = 'P0001', message = 'Setiap item matching kiri perlu memiliki ID.';
    end if;
    if array_length(v_ids, 1) <> (select count(distinct x) from unnest(v_ids) x)
       or exists (select 1 from unnest(v_ids) x where x is null or x = '') then
      raise exception using errcode = 'P0001', message = 'ID item matching kiri harus unik.';
    end if;
    select array_agg(x->>'id') into v_ids from jsonb_array_elements(p_config->'rightItems') x;
    if cardinality(v_ids) <> jsonb_array_length(p_config->'rightItems') then
      raise exception using errcode = 'P0001', message = 'Setiap item matching kanan perlu memiliki ID.';
    end if;
    if array_length(v_ids, 1) <> (select count(distinct x) from unnest(v_ids) x)
       or exists (select 1 from unnest(v_ids) x where x is null or x = '') then
      raise exception using errcode = 'P0001', message = 'ID item matching kanan harus unik.';
    end if;
    if (select count(*) from jsonb_array_elements(p_config->'rightItems') x) <>
       (select count(distinct x->>'text') from jsonb_array_elements(p_config->'rightItems') x) then
      raise exception using errcode = 'P0001', message = 'Item kolom kanan harus unik agar soal matching tidak ambigu.';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_config->'leftItems') l
      join jsonb_array_elements(p_config->'rightItems') r on l->>'text' = r->>'text'
    ) then
      raise exception using errcode = 'P0001', message = 'Teks matching kiri dan kanan tidak boleh sama agar kunci dapat dinilai dengan pasti.';
    end if;
    if jsonb_typeof(p_answer_key->'matches') <> 'object'
       or (select count(*) from jsonb_each(p_answer_key->'matches')) <> jsonb_array_length(p_config->'leftItems')
       or (select count(distinct m.value) from jsonb_each_text(p_answer_key->'matches') m) <> jsonb_array_length(p_config->'leftItems') then
      raise exception using errcode = 'P0001', message = 'Kunci matching harus memasangkan semua item kiri.';
    end if;
    for v_row in select * from jsonb_each_text(p_answer_key->'matches') loop
      if not exists (select 1 from jsonb_array_elements(p_config->'leftItems') x where x->>'id' = v_row.key)
         or not exists (select 1 from jsonb_array_elements(p_config->'rightItems') x where x->>'id' = v_row.value) then
        raise exception using errcode = 'P0001', message = 'Kunci pasangan tidak cocok dengan item.';
      end if;
    end loop;
  elsif p_type = 'hanzi_blank' then
    if jsonb_typeof(p_config->'choices') <> 'array'
       or jsonb_array_length(p_config->'choices') not between 2 and 5
       or coalesce(p_config->>'blankCount', '1') <> '1'
       or (length(p_prompt) - length(replace(p_prompt, '{{blank}}', ''))) / length('{{blank}}') <> 1 then
      raise exception using errcode = 'P0001', message = 'Isian Hanzi harus memiliki satu penanda {{blank}} dan 2–5 opsi.';
    end if;
    if (select count(*) from jsonb_array_elements(p_config->'choices') x) <>
       (select count(distinct x->>'label') from jsonb_array_elements(p_config->'choices') x) then
      raise exception using errcode = 'P0001', message = 'Label opsi isian harus unik.';
    end if;
    if exists (select 1 from jsonb_array_elements(p_config->'choices') x where coalesce(x->>'text','') = '') then
      raise exception using errcode = 'P0001', message = 'Teks opsi Hanzi wajib diisi.';
    end if;
    if not exists (select 1 from jsonb_array_elements(p_config->'choices') x where x->>'label' = p_answer_key->>'correctLabel') then
      raise exception using errcode = 'P0001', message = 'Kunci isian harus memilih opsi yang tersedia.';
    end if;
  elsif p_type = 'rearrange_sentence' then
    if jsonb_typeof(p_config->'tokens') <> 'array'
       or jsonb_array_length(p_config->'tokens') not between 2 and 30
       or jsonb_typeof(p_answer_key->'order') <> 'array'
       or jsonb_array_length(p_answer_key->'order') <> jsonb_array_length(p_config->'tokens') then
      raise exception using errcode = 'P0001', message = 'Susun kalimat harus memiliki 2–30 potongan berurutan.';
    end if;
    select array_agg(x->>'id') into v_ids from jsonb_array_elements(p_config->'tokens') x;
    if cardinality(v_ids) <> jsonb_array_length(p_config->'tokens') then
      raise exception using errcode = 'P0001', message = 'Setiap potongan kalimat harus memiliki ID.';
    end if;
    if array_length(v_ids, 1) <> (select count(distinct x) from unnest(v_ids) x)
       or array_length(v_ids, 1) <> (select count(distinct x) from jsonb_array_elements_text(p_answer_key->'order') x)
       or exists (select 1 from jsonb_array_elements_text(p_answer_key->'order') x where not (x = any(v_ids))) then
      raise exception using errcode = 'P0001', message = 'Urutan kunci harus memakai setiap potongan tepat satu kali.';
    end if;
    if exists (select 1 from jsonb_array_elements(p_config->'tokens') x where coalesce(x->>'text','') = '') then
      raise exception using errcode = 'P0001', message = 'Teks potongan kalimat wajib diisi.';
    end if;
  end if;

  if p_question_id is null then
    select coalesce(max(q.position), 0) + 1 into v_position
    from public.questions q where q.test_id = p_test_id and q.section = p_section;
    insert into public.questions(test_id, section, position, prompt, question_type, interaction_config)
    values (p_test_id, p_section, v_position, trim(p_prompt), p_type, p_config)
    returning id into v_id;
  else
    perform 1 from public.questions q where q.id = p_question_id and q.test_id = p_test_id for update;
    if exists (select 1 from public.attempts a where a.test_id = p_test_id) then
      raise exception using errcode = 'P0001', message = 'Soal bertipe interaktif tidak dapat diubah setelah tes memiliki pengerjaan.';
    end if;
    update public.questions q
    set section = p_section, prompt = trim(p_prompt), question_type = p_type,
        interaction_config = p_config
    where q.id = p_question_id and q.test_id = p_test_id
    returning q.id into v_id;
    if v_id is null then
      raise exception using errcode = 'P0001', message = 'Soal tidak ditemukan.';
    end if;
  end if;

  -- Switching from multiple choice to an interactive type removes stale
  -- alternatives and their MC key; existing attempts are blocked above.
  delete from public.question_options o where o.question_id = v_id;
  delete from public.answer_keys k where k.question_id = v_id;

  insert into public.interactive_answer_keys(question_id, answer, updated_at)
  values (v_id, p_answer_key, now())
  on conflict (question_id) do update set answer = excluded.answer, updated_at = now();
  return v_id;
end;
$$;

create or replace function public.save_interactive_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_answer jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.question_type;
  v_config jsonb;
  v_test_id uuid;
  v_valid boolean := false;
begin
  select a.test_id, q.question_type, q.interaction_config
  into v_test_id, v_type, v_config
  from public.attempts a
  join public.questions q on q.test_id = a.test_id and q.id = p_question_id
  where a.id = p_attempt_id and a.student_id = auth.uid()
    and a.status = 'in_progress' and now() <= a.expires_at + interval '5 seconds'
  for update of a;
  if v_test_id is null or v_type = 'multiple_choice' then
    raise exception using errcode = 'P0001', message = 'Pengerjaan tidak aktif atau tipe soal tidak cocok.';
  end if;
  if jsonb_typeof(p_answer) <> 'object' then
    raise exception using errcode = 'P0001', message = 'Jawaban tidak valid.';
  end if;

  if v_type = 'matching' then
    v_valid := jsonb_typeof(p_answer->'matches') = 'object'
      and (select count(distinct m.value) from jsonb_each_text(p_answer->'matches') m) = (select count(*) from jsonb_each(p_answer->'matches'))
      and not exists (
        select 1 from jsonb_each_text(p_answer->'matches') m
        where not exists (select 1 from jsonb_array_elements(v_config->'leftItems') x where x->>'id' = m.key)
           or not exists (select 1 from jsonb_array_elements(v_config->'rightItems') x where x->>'id' = m.value)
      );
  elsif v_type = 'hanzi_blank' then
    v_valid := exists (select 1 from jsonb_array_elements(v_config->'choices') x where x->>'label' = p_answer->>'selectedLabel');
  elsif v_type = 'rearrange_sentence' then
    v_valid := jsonb_typeof(p_answer->'order') = 'array'
      and jsonb_array_length(p_answer->'order') = jsonb_array_length(v_config->'tokens')
      and (select count(distinct x) from jsonb_array_elements_text(p_answer->'order') x) = jsonb_array_length(v_config->'tokens')
      and not exists (select 1 from jsonb_array_elements_text(p_answer->'order') x where not exists (select 1 from jsonb_array_elements(v_config->'tokens') t where t->>'id' = x));
  end if;
  if not coalesce(v_valid, false) then
    raise exception using errcode = 'P0001', message = 'Format jawaban tidak sesuai dengan soal.';
  end if;

  insert into public.attempt_answers(attempt_id, question_id, selected_option_id, answer_payload, answered_at)
  values (p_attempt_id, p_question_id, null, p_answer, now())
  on conflict (attempt_id, question_id) do update
  set selected_option_id = null, answer_payload = excluded.answer_payload, answered_at = now();
end;
$$;

create or replace function public.score_attempt(p_attempt_id uuid, p_status public.attempt_status)
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
  if v_test_id is null then return; end if;
  select count(*) into v_total from public.questions q where q.test_id = v_test_id;

  select coalesce(sum(case when is_correct then 1 else 0 end), 0)::integer into v_correct
  from (
    select q.id,
      case
        when q.question_type = 'multiple_choice' then coalesce(aa.selected_option_id = k.correct_option_id, false)
        when q.question_type = 'matching' then coalesce(aa.answer_payload->'matches' = ik.answer->'matches', false)
        when q.question_type = 'hanzi_blank' then coalesce(aa.answer_payload->>'selectedLabel' = ik.answer->>'correctLabel', false)
        when q.question_type = 'rearrange_sentence' then coalesce(aa.answer_payload->'order' = ik.answer->'order', false)
        else false
      end as is_correct
    from public.questions q
    left join public.attempt_answers aa on aa.attempt_id = p_attempt_id and aa.question_id = q.id
    left join public.answer_keys k on k.question_id = q.id
    left join public.interactive_answer_keys ik on ik.question_id = q.id
    where q.test_id = v_test_id
  ) scored;

  select count(*) filter (where scored.section = 'listening')::integer,
         count(*) filter (where scored.section = 'listening' and scored.is_correct)::integer,
         count(*) filter (where scored.section = 'reading')::integer,
         count(*) filter (where scored.section = 'reading' and scored.is_correct)::integer
  into v_listening_total, v_listening_correct, v_reading_total, v_reading_correct
  from (
    select q.id, q.section,
      case
        when q.question_type = 'multiple_choice' then coalesce(aa.selected_option_id = k.correct_option_id, false)
        when q.question_type = 'hanzi_blank' then coalesce(aa.answer_payload->>'selectedLabel' = ik.answer->>'correctLabel', false)
        when q.question_type = 'matching' then coalesce(aa.answer_payload->'matches' = ik.answer->'matches', false)
        when q.question_type = 'rearrange_sentence' then coalesce(aa.answer_payload->'order' = ik.answer->'order', false)
        else false
      end as is_correct
    from public.questions q
    left join public.attempt_answers aa on aa.attempt_id = p_attempt_id and aa.question_id = q.id
    left join public.answer_keys k on k.question_id = q.id
    left join public.interactive_answer_keys ik on ik.question_id = q.id
    where q.test_id = v_test_id
  ) scored;

  update public.attempts a set status = p_status,
      submitted_at = coalesce(a.submitted_at, now()), correct_count = coalesce(v_correct, 0),
      total_count = v_total, listening_correct = coalesce(v_listening_correct, 0),
      listening_total = coalesce(v_listening_total, 0), reading_correct = coalesce(v_reading_correct, 0),
      reading_total = coalesce(v_reading_total, 0)
  where a.id = p_attempt_id;
end;
$$;

revoke execute on function public.save_interactive_question(uuid, uuid, public.question_section, public.question_type, text, jsonb, jsonb) from public;
revoke execute on function public.save_interactive_answer(uuid, uuid, jsonb) from public;
grant execute on function public.save_interactive_question(uuid, uuid, public.question_section, public.question_type, text, jsonb, jsonb) to authenticated;
grant execute on function public.save_interactive_answer(uuid, uuid, jsonb) to authenticated;
revoke insert, update, delete on public.interactive_answer_keys from authenticated;
grant select on public.interactive_answer_keys to authenticated;
