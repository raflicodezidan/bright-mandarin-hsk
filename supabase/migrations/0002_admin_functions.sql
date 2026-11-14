-- Fungsi admin untuk tes & soal. Jalankan setelah 0001_init.sql.

-- ---------------------------------------------------------------------------
-- Simpan soal + opsi + kunci dalam satu transaksi (FR-11)
-- ---------------------------------------------------------------------------
create function public.save_question(
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
  if not public.is_admin() then
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

-- ---------------------------------------------------------------------------
-- Hapus soal dan rapikan posisi
-- ---------------------------------------------------------------------------
create function public.delete_question(p_question_id uuid)
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
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  select q.test_id, q.section, q.position, q.image_path, q.audio_path
  into v_test_id, v_section, v_position, v_image, v_audio
  from public.questions q
  where q.id = p_question_id;

  if v_test_id is null then
    raise exception using errcode = 'P0001', message = 'Soal tidak ditemukan.';
  end if;

  perform public.assert_test_editable(v_test_id);

  delete from public.questions q where q.id = p_question_id;

  -- Dua langkah agar unique constraint tidak bentrok saat menggeser posisi.
  update public.questions q
  set position = q.position + 100000
  where q.test_id = v_test_id and q.section = v_section and q.position > v_position;

  update public.questions q
  set position = q.position - 100001
  where q.test_id = v_test_id and q.section = v_section and q.position > 100000;

  return v_test_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Naik/turun posisi soal dalam bagian yang sama
-- ---------------------------------------------------------------------------
create function public.move_question(p_question_id uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question public.questions%rowtype;
  v_target public.questions%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;

  select * into v_question from public.questions q where q.id = p_question_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'Soal tidak ditemukan.';
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

-- ---------------------------------------------------------------------------
-- Duplikat tes (FR-13). Media harus sudah disalin; kirim peta path lama→baru.
-- ---------------------------------------------------------------------------
create function public.duplicate_test(p_test_id uuid, p_media_map jsonb default '{}'::jsonb)
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
  if not public.is_admin() then
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

revoke execute on function public.save_question(uuid, uuid, public.question_section, text, text, text, jsonb, text) from public;
revoke execute on function public.delete_question(uuid) from public;
revoke execute on function public.move_question(uuid, integer) from public;
revoke execute on function public.duplicate_test(uuid, jsonb) from public;

grant execute on function public.save_question(uuid, uuid, public.question_section, text, text, text, jsonb, text) to authenticated;
grant execute on function public.delete_question(uuid) to authenticated;
grant execute on function public.move_question(uuid, integer) to authenticated;
grant execute on function public.duplicate_test(uuid, jsonb) to authenticated;
