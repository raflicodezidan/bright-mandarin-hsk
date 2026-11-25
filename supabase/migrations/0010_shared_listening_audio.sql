-- Audio Listening opsional yang dipakai bersama sebagai fallback per-soal.
alter table public.tests
  add column if not exists listening_audio_path text;

-- save_question menerima audio per-soal ataupun audio bersama yang dipasang
-- oleh action server ketika form soal tidak mengunggah file tersendiri.
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
    raise exception using errcode = 'P0001', message = 'Soal Listening wajib memiliki audio.';
  end if;
  if jsonb_typeof(p_options) <> 'array' then
    raise exception using errcode = 'P0001', message = 'Opsi jawaban tidak valid.';
  end if;

  for v_option in select * from jsonb_array_elements(p_options) loop
    v_count := v_count + 1;
    v_label := upper(trim(v_option ->> 'label'));
    v_text := trim(coalesce(v_option ->> 'text', ''));
    if v_label not in ('A', 'B', 'C', 'D', 'E') or v_label = any(v_labels) then
      raise exception using errcode = 'P0001', message = 'Label opsi tidak valid.';
    end if;
    if v_text = '' and nullif(trim(v_option ->> 'image_path'), '') is null then
      raise exception using errcode = 'P0001', message = 'Teks opsi wajib diisi.';
    end if;
    v_labels := array_append(v_labels, v_label);
  end loop;
  if v_count < 2 or v_count > 5 then
    raise exception using errcode = 'P0001', message = 'Soal harus memiliki 2 sampai 5 opsi.';
  end if;
  if not (upper(trim(p_correct_label)) = any(v_labels)) then
    raise exception using errcode = 'P0001', message = 'Kunci jawaban tidak cocok dengan opsi.';
  end if;

  if p_question_id is null then
    select coalesce(max(q.position), 0) + 1 into v_position
    from public.questions q where q.test_id = p_test_id and q.section = p_section;
    insert into public.questions(test_id, section, position, prompt, image_path, audio_path)
    values (p_test_id, p_section, v_position, trim(p_prompt), p_image_path, p_audio_path)
    returning id into v_question_id;
  else
    select q.section, q.position into v_old_section, v_old_position
    from public.questions q where q.id = p_question_id and q.test_id = p_test_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'Soal tidak ditemukan.'; end if;
    update public.questions q set section=p_section, prompt=trim(p_prompt), image_path=p_image_path, audio_path=p_audio_path
    where q.id=p_question_id and q.test_id=p_test_id returning q.id into v_question_id;
    if v_old_section <> p_section then
      update public.questions q set position=q.position-1 where q.test_id=p_test_id and q.section=v_old_section and q.position>v_old_position;
      select coalesce(max(q.position),0)+1 into v_position from public.questions q where q.test_id=p_test_id and q.section=p_section and q.id<>p_question_id;
      update public.questions q set position=v_position where q.id=p_question_id;
    end if;
  end if;

  delete from public.answer_keys k where k.question_id=v_question_id;
  delete from public.question_options o where o.question_id=v_question_id;
  for v_option in select * from jsonb_array_elements(p_options) loop
    insert into public.question_options(question_id,label,text,image_path)
    values (v_question_id,upper(trim(v_option->>'label')),nullif(trim(v_option->>'text'),''),nullif(trim(v_option->>'image_path'),''))
    returning id into v_correct_option_id;
    if upper(trim(v_option->>'label'))=upper(trim(p_correct_label)) then
      insert into public.answer_keys(question_id,correct_option_id) values (v_question_id,v_correct_option_id);
    end if;
  end loop;
  return v_question_id;
end;
$$;

revoke execute on function public.save_question(uuid, uuid, public.question_section, text, text, text, jsonb, text) from public;
grant execute on function public.save_question(uuid, uuid, public.question_section, text, text, text, jsonb, text) to authenticated;

-- Staf dengan akses tes dapat membaca audio tes bersama.
drop policy if exists question_media_teacher_select on storage.objects;
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
        where (t.pdf_path = storage.objects.name
          or t.student_pdf_path = storage.objects.name
          or t.listening_audio_path = storage.objects.name)
          and (public.teacher_can_access_test(t.id) or public.teacher_can_review_test(t.id))
      )
    )
  );

create policy question_media_student_select_shared_audio on storage.objects
  for select to authenticated
  using (
    bucket_id = 'question-media'
    and exists (
      select 1 from public.tests t
      where t.listening_audio_path = storage.objects.name
        and public.has_active_attempt(t.id)
    )
  );

drop policy if exists question_media_student_select_active on storage.objects;
create policy question_media_student_select_active on storage.objects
  for select to authenticated
  using (
    bucket_id = 'question-media'
    and exists (
      select 1 from public.questions q
      where (q.audio_path = storage.objects.name or q.image_path = storage.objects.name)
        and public.has_active_attempt(q.test_id)
    )
  );

-- Pertahankan audio bersama saat tes diduplikasi, memakai salinan unik.
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
  v_shared_audio text;
begin
  if not public.teacher_owns_test(p_test_id) then
    raise exception using errcode = 'P0001', message = 'Akses ditolak.';
  end if;
  select * into v_source from public.tests t where t.id = p_test_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'Tes tidak ditemukan.';
  end if;

  v_shared_audio := p_media_map ->> v_source.listening_audio_path;
  insert into public.tests
    (title, level, description, duration_minutes, status, created_by, listening_audio_path)
  values
    (left(v_source.title || ' (salinan)', 200), v_source.level, v_source.description,
     v_source.duration_minutes, 'draft', auth.uid(), coalesce(v_shared_audio, v_source.listening_audio_path))
  returning id into v_new_test_id;

  for v_question in
    select * from public.questions q where q.test_id = p_test_id order by q.section, q.position
  loop
    v_image := p_media_map ->> v_question.image_path;
    v_audio := p_media_map ->> v_question.audio_path;
    if coalesce((v_question.interaction_config->>'pdf')::boolean, false)
       and v_question.section = 'listening'
       and v_source.listening_audio_path is not null then
      v_audio := coalesce(v_audio, v_shared_audio, v_source.listening_audio_path);
    end if;
    insert into public.questions
      (test_id, section, position, prompt, image_path, audio_path, question_type, interaction_config)
    values
      (v_new_test_id, v_question.section, v_question.position, v_question.prompt,
       coalesce(v_image, v_question.image_path),
       case when coalesce((v_question.interaction_config->>'pdf')::boolean, false)
         and v_question.section = 'listening'
         then coalesce(v_audio, v_shared_audio, v_question.audio_path)
         else coalesce(v_audio, v_question.audio_path) end,
       v_question.question_type, v_question.interaction_config)
    returning id into v_new_question_id;

    v_correct_new := null;
    for v_option in
      select o.*, (k.correct_option_id = o.id) as is_correct
      from public.question_options o
      left join public.answer_keys k on k.question_id = o.question_id
      where o.question_id = v_question.id order by o.label
    loop
      insert into public.question_options (question_id, label, text, image_path)
      values (v_new_question_id, v_option.label, v_option.text, v_option.image_path)
      returning id into v_new_option_id;
      if v_option.is_correct then v_correct_new := v_new_option_id; end if;
    end loop;
    if v_correct_new is not null then
      insert into public.answer_keys (question_id, correct_option_id)
      values (v_new_question_id, v_correct_new);
    end if;

    insert into public.interactive_answer_keys(question_id, answer)
    select v_new_question_id, ik.answer
    from public.interactive_answer_keys ik where ik.question_id = v_question.id;
  end loop;
  return v_new_test_id;
end;
$$;

revoke execute on function public.duplicate_test(uuid, jsonb) from public;
grant execute on function public.duplicate_test(uuid, jsonb) to authenticated;
