-- Izinkan perubahan redaksi dan kunci tanpa mengganti ID/label opsi atau
-- relasi jawaban murid yang sudah tersimpan.

create or replace function public.questions_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_id uuid;
  v_question_id uuid;
begin
  if tg_op = 'DELETE' then
    v_test_id := old.test_id;
  else
    v_test_id := new.test_id;
  end if;

  if exists (select 1 from public.attempts a where a.test_id = v_test_id) then
    if tg_op = 'UPDATE'
       and new.id = old.id
       and new.test_id = old.test_id
       and new.section = old.section
       and new.position = old.position
       and new.image_path is not distinct from old.image_path
       and new.audio_path is not distinct from old.audio_path
       and new.created_at = old.created_at then
      return new;
    end if;
    perform public.assert_test_editable(v_test_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.question_options_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_test_id uuid;
begin
  if tg_op = 'DELETE' then
    v_question_id := old.question_id;
  else
    v_question_id := new.question_id;
  end if;
  select q.test_id into v_test_id
  from public.questions q
  where q.id = v_question_id;

  if exists (select 1 from public.attempts a where a.test_id = v_test_id) then
    if tg_op = 'UPDATE'
       and new.id = old.id
       and new.question_id = old.question_id
       and new.label = old.label then
      return new;
    end if;
    perform public.assert_test_editable(v_test_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.answer_keys_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_test_id uuid;
begin
  if tg_op = 'DELETE' then
    v_question_id := old.question_id;
  else
    v_question_id := new.question_id;
  end if;
  select q.test_id into v_test_id
  from public.questions q
  where q.id = v_question_id;

  if exists (select 1 from public.attempts a where a.test_id = v_test_id) then
    if tg_op = 'UPDATE'
       and new.question_id = old.question_id
       and new.correct_option_id is distinct from old.correct_option_id then
      return new;
    end if;
    perform public.assert_test_editable(v_test_id);
  end if;

  return coalesce(new, old);
end;
$$;

create function public.update_question_text(
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
  if not public.is_admin() then
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

revoke execute on function public.update_question_text(uuid, uuid, text, jsonb, text) from public;
grant execute on function public.update_question_text(uuid, uuid, text, jsonb, text) to authenticated;
