-- Bobot nilai per soal (poin). Default 1 agar perilaku lama tetap berlaku.
alter table public.questions
  add column if not exists weight integer not null default 1
  check (weight > 0);

-- Penilaian terbobot. Kolom count pada attempts kini menyimpan poin (earned/total),
-- sedangkan jumlah soal tetap diambil dari questions via get_test_summary.
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

  select coalesce(sum(q.weight), 0)::integer into v_total
  from public.questions q where q.test_id = v_test_id;

  select coalesce(sum(case when is_correct then q.weight else 0 end), 0)::integer into v_correct
  from (
    select q.id, q.weight,
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
  ) scored
  join public.questions q on q.id = scored.id;

  select coalesce(sum(q.weight) filter (where q.section = 'listening'), 0)::integer,
         coalesce(sum(case when q.section = 'listening' and scored.is_correct then q.weight else 0 end), 0)::integer,
         coalesce(sum(q.weight) filter (where q.section = 'reading'), 0)::integer,
         coalesce(sum(case when q.section = 'reading' and scored.is_correct then q.weight else 0 end), 0)::integer
  into v_listening_total, v_listening_correct, v_reading_total, v_reading_correct
  from (
    select q.id, q.section, q.weight,
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
  ) scored
  join public.questions q on q.id = scored.id;

  update public.attempts a set status = p_status,
      submitted_at = coalesce(a.submitted_at, now()), correct_count = coalesce(v_correct, 0),
      total_count = v_total, listening_correct = coalesce(v_listening_correct, 0),
      listening_total = coalesce(v_listening_total, 0), reading_correct = coalesce(v_reading_correct, 0),
      reading_total = coalesce(v_reading_total, 0)
  where a.id = p_attempt_id;
end;
$$;

-- Perbarui recalc pada edit teks soal (setelah ada pengerjaan) agar memakai bobot.
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

  v_expected := jsonb_array_length(p_options);
  if v_expected < 2 or v_expected > 5 then
    raise exception using errcode = 'P0001', message = 'Soal harus memiliki 2 sampai 5 opsi.';
  end if;

  for v_item in select * from jsonb_array_elements(p_options)
  loop
    v_label := upper(trim(v_item ->> 'label'));
    v_text := trim(coalesce(v_item ->> 'text', ''));
    if v_label not in ('A', 'B', 'C', 'D', 'E') then
      raise exception using errcode = 'P0001', message = 'Label opsi tidak valid.';
    end if;
    if v_text = '' then
      raise exception using errcode = 'P0001', message = 'Teks opsi wajib diisi.';
    end if;
  end loop;

  if not (upper(trim(p_correct_label)) in (select upper(trim(x ->> 'label')) from jsonb_array_elements(p_options) x)) then
    raise exception using errcode = 'P0001', message = 'Kunci jawaban tidak valid.';
  end if;

  update public.questions
  set prompt = trim(p_prompt)
  where id = p_question_id;

  for v_item in select * from jsonb_array_elements(p_options)
  loop
    v_label := upper(trim(v_item ->> 'label'));
    v_text := trim(coalesce(v_item ->> 'text', ''));
    update public.question_options
    set text = v_text
    where question_id = p_question_id and label = v_label;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception using errcode = 'P0001', message = 'Label opsi tidak sesuai dengan soal.';
    end if;
    if v_label = upper(trim(p_correct_label)) then
      select o.id into v_correct_option_id
      from public.question_options o
      where o.question_id = p_question_id and o.label = v_label;
    end if;
  end loop;

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
      coalesce(sum(q.weight), 0)::integer as total_count,
      coalesce(sum(case when aa.selected_option_id = k.correct_option_id then q.weight else 0 end), 0)::integer as correct_count,
      coalesce(sum(q.weight) filter (where q.section = 'listening'), 0)::integer as listening_total,
      coalesce(sum(case when q.section = 'listening' and aa.selected_option_id = k.correct_option_id then q.weight else 0 end), 0)::integer as listening_correct,
      coalesce(sum(q.weight) filter (where q.section = 'reading'), 0)::integer as reading_total,
      coalesce(sum(case when q.section = 'reading' and aa.selected_option_id = k.correct_option_id then q.weight else 0 end), 0)::integer as reading_correct
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

-- save_question: tambah p_weight (nullable, default null -> pertahankan/1)
create or replace function public.save_question(
  p_test_id uuid,
  p_question_id uuid,
  p_section public.question_section,
  p_prompt text,
  p_image_path text,
  p_audio_path text,
  p_options jsonb,
  p_correct_label text,
  p_weight integer default null
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
  v_weight integer := coalesce(p_weight, 1);
begin
  if not public.teacher_owns_test(p_test_id) then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  if not exists (select 1 from public.tests t where t.id = p_test_id) then
    raise exception using errcode = 'P0001', message = 'Tes tidak ditemukan.';
  end if;

  perform public.assert_test_editable(p_test_id);

  if p_section = 'listening' and coalesce(p_audio_path, '') = '' then
    raise exception using errcode = 'P0001', message = 'Soal Listening wajib memiliki audio.';
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
    raise exception using errcode = 'P0001', message = 'Soal harus memiliki 2 sampai 5 opsi.';
  end if;

  if not (upper(trim(p_correct_label)) = any (v_labels)) then
    raise exception using errcode = 'P0001', message = 'Pilih satu kunci jawaban yang valid.';
  end if;

  if p_question_id is null then
    select coalesce(max(q.position), 0) + 1 into v_position
    from public.questions q
    where q.test_id = p_test_id and q.section = p_section;

    insert into public.questions
      (test_id, section, position, prompt, image_path, audio_path, weight)
    values
      (p_test_id, p_section, v_position, p_prompt, p_image_path, p_audio_path, v_weight)
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
        audio_path = p_audio_path,
        weight = coalesce(p_weight, q.weight, 1)
    where q.id = v_question_id;
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

-- save_interactive_question: tambah p_weight
create or replace function public.save_interactive_question(
  p_test_id uuid,
  p_question_id uuid,
  p_section public.question_section,
  p_type public.question_type,
  p_prompt text,
  p_config jsonb,
  p_answer_key jsonb,
  p_weight integer default null
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
  v_has_key boolean;
  v_weight integer := coalesce(p_weight, 1);
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
       or jsonb_array_length(p_config->'rightItems') not between 2 and 10 then
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
    if jsonb_typeof(p_answer_key->'matches') = 'object'
       and (select count(*) from jsonb_each(p_answer_key->'matches')) > 0 then
      if (select count(*) from jsonb_each(p_answer_key->'matches')) <> jsonb_array_length(p_config->'leftItems')
         or (select count(distinct m.value) from jsonb_each_text(p_answer_key->'matches') m) <> jsonb_array_length(p_config->'leftItems') then
        raise exception using errcode = 'P0001', message = 'Kunci matching harus memasangkan semua item kiri.';
      end if;
      for v_row in select * from jsonb_each_text(p_answer_key->'matches') loop
        if not exists (select 1 from jsonb_array_elements(p_config->'leftItems') x where x->>'id' = v_row.key)
           or not exists (select 1 from jsonb_array_elements(p_config->'rightItems') x where x->>'id' = v_row.value) then
          raise exception using errcode = 'P0001', message = 'Kunci pasangan tidak cocok dengan item.';
        end if;
      end loop;
    end if;
  elsif p_type = 'hanzi_blank' then
    if jsonb_typeof(p_config->'choices') <> 'array'
       or jsonb_array_length(p_config->'choices') not between 2 and 6
       or coalesce(p_config->>'blankCount', '1') <> '1'
       or (length(p_prompt) - length(replace(p_prompt, '{{blank}}', ''))) / length('{{blank}}') <> 1 then
      raise exception using errcode = 'P0001', message = 'Isian Hanzi harus memiliki satu penanda {{blank}} dan 2–6 opsi.';
    end if;
    if (select count(*) from jsonb_array_elements(p_config->'choices') x) <>
       (select count(distinct x->>'label') from jsonb_array_elements(p_config->'choices') x) then
      raise exception using errcode = 'P0001', message = 'Label opsi isian harus unik.';
    end if;
    if exists (select 1 from jsonb_array_elements(p_config->'choices') x where coalesce(x->>'text','') = '') then
      raise exception using errcode = 'P0001', message = 'Teks opsi Hanzi wajib diisi.';
    end if;
    if coalesce(p_answer_key->>'correctLabel','') <> ''
       and not exists (select 1 from jsonb_array_elements(p_config->'choices') x where x->>'label' = p_answer_key->>'correctLabel') then
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
    insert into public.questions(test_id, section, position, prompt, question_type, interaction_config, weight)
    values (p_test_id, p_section, v_position, trim(p_prompt), p_type, p_config, v_weight)
    returning id into v_id;
  else
    perform 1 from public.questions q where q.id = p_question_id and q.test_id = p_test_id for update;
    if exists (select 1 from public.attempts a where a.test_id = p_test_id) then
      raise exception using errcode = 'P0001', message = 'Soal bertipe interaktif tidak dapat diubah setelah tes memiliki pengerjaan.';
    end if;
    update public.questions q
    set section = p_section, prompt = trim(p_prompt), question_type = p_type,
        interaction_config = p_config,
        weight = coalesce(p_weight, q.weight, 1)
    where q.id = p_question_id and q.test_id = p_test_id
    returning q.id into v_id;
    if v_id is null then
      raise exception using errcode = 'P0001', message = 'Soal tidak ditemukan.';
    end if;
  end if;

  delete from public.question_options o where o.question_id = v_id;
  delete from public.answer_keys k where k.question_id = v_id;

  if p_type = 'matching' then
    v_has_key := jsonb_typeof(p_answer_key->'matches') = 'object'
      and (select count(*) from jsonb_each(p_answer_key->'matches')) > 0;
  elsif p_type = 'hanzi_blank' then
    v_has_key := coalesce(p_answer_key->>'correctLabel','') <> '';
  else
    v_has_key := true;
  end if;

  if v_has_key then
    insert into public.interactive_answer_keys(question_id, answer, updated_at)
    values (v_id, p_answer_key, now())
    on conflict (question_id) do update set answer = excluded.answer, updated_at = now();
  else
    delete from public.interactive_answer_keys where question_id = v_id;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.save_question(uuid,uuid,public.question_section,text,text,text,jsonb,text,integer) from public;
grant execute on function public.save_question(uuid,uuid,public.question_section,text,text,text,jsonb,text,integer) to authenticated;
revoke execute on function public.save_interactive_question(uuid,uuid,public.question_section,public.question_type,text,jsonb,jsonb,integer) from public;
grant execute on function public.save_interactive_question(uuid,uuid,public.question_section,public.question_type,text,jsonb,jsonb,integer) to authenticated;
revoke execute on function public.score_attempt(uuid,public.attempt_status) from public;
grant execute on function public.score_attempt(uuid,public.attempt_status) to authenticated;
revoke execute on function public.update_question_text(uuid,uuid,text,jsonb,text) from public;
grant execute on function public.update_question_text(uuid,uuid,text,jsonb,text) to authenticated;