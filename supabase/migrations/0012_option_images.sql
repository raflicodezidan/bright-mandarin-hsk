-- Gambar opsional per opsi jawaban.
alter table public.question_options
  add column if not exists image_path text;

alter table public.question_options
  drop constraint if exists question_options_text_check;
alter table public.question_options
  drop constraint if exists question_options_text_length_check;
alter table public.question_options
  drop constraint if exists question_options_text_or_image_check;

alter table public.question_options
  alter column text drop not null;

alter table public.question_options
  add constraint question_options_text_or_image_check
  check (
    (text is not null and char_length(text) between 1 and 2000)
    or image_path is not null
  );

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
  if not public.teacher_owns_test(p_test_id) then raise exception using errcode = 'P0001', message = 'Akses ditolak.'; end if;
  perform public.assert_test_editable(p_test_id);
  if p_section = 'listening' and coalesce(p_audio_path,'') = '' and not exists (select 1 from public.tests t where t.id=p_test_id and t.listening_audio_path is not null) then
    raise exception using errcode='P0001', message='Soal Listening wajib memiliki audio.';
  end if;
  if jsonb_typeof(p_options) <> 'array' then raise exception using errcode='P0001', message='Opsi jawaban tidak valid.'; end if;
  for v_option in select * from jsonb_array_elements(p_options) loop
    v_count := v_count + 1;
    v_label := upper(trim(v_option->>'label'));
    v_text := trim(coalesce(v_option->>'text',''));
    if v_label not in ('A','B','C','D','E') or v_label=any(v_labels) then raise exception using errcode='P0001', message='Label opsi tidak valid.'; end if;
    if v_text='' and nullif(trim(v_option->>'image_path'),'') is null then raise exception using errcode='P0001', message='Opsi harus memiliki teks atau gambar.'; end if;
    v_labels := array_append(v_labels,v_label);
  end loop;
  if v_count not between 2 and 5 then raise exception using errcode='P0001', message='Soal harus memiliki 2 sampai 5 opsi.'; end if;
  if not upper(trim(p_correct_label))=any(v_labels) then raise exception using errcode='P0001', message='Pilih satu kunci jawaban yang valid.'; end if;

  if p_question_id is null then
    select coalesce(max(q.position),0)+1 into v_position from public.questions q where q.test_id=p_test_id and q.section=p_section;
    insert into public.questions(test_id,section,position,prompt,image_path,audio_path) values (p_test_id,p_section,v_position,trim(p_prompt),p_image_path,p_audio_path) returning id into v_question_id;
  else
    select q.section,q.position into v_old_section,v_old_position from public.questions q where q.id=p_question_id and q.test_id=p_test_id for update;
    if not found then raise exception using errcode='P0001', message='Soal tidak ditemukan.'; end if;
    update public.questions q set section=p_section,prompt=trim(p_prompt),image_path=p_image_path,audio_path=p_audio_path where q.id=p_question_id and q.test_id=p_test_id returning q.id into v_question_id;
    if v_old_section<>p_section then
      update public.questions q set position=q.position-1 where q.test_id=p_test_id and q.section=v_old_section and q.position>v_old_position;
      select coalesce(max(q.position),0)+1 into v_position from public.questions q where q.test_id=p_test_id and q.section=p_section and q.id<>p_question_id;
      update public.questions q set position=v_position where q.id=p_question_id;
    end if;
  end if;
  delete from public.answer_keys where question_id=v_question_id;
  delete from public.question_options where question_id=v_question_id;
  for v_option in select * from jsonb_array_elements(p_options) loop
    insert into public.question_options(question_id,label,text,image_path) values (v_question_id,upper(trim(v_option->>'label')),coalesce(nullif(trim(v_option->>'text'),''),'Gambar opsi'),nullif(trim(v_option->>'image_path'),'')) returning id into v_correct_option_id;
    if upper(trim(v_option->>'label'))=upper(trim(p_correct_label)) then insert into public.answer_keys(question_id,correct_option_id) values (v_question_id,v_correct_option_id); end if;
  end loop;
  return v_question_id;
end;
$$;

revoke execute on function public.save_question(uuid,uuid,public.question_section,text,text,text,jsonb,text) from public;
grant execute on function public.save_question(uuid,uuid,public.question_section,text,text,text,jsonb,text) to authenticated;

create policy question_media_student_select_option_images on storage.objects
  for select to authenticated
  using (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.question_options qo
      join public.questions q on q.id = qo.question_id
      where qo.image_path = storage.objects.name
        and public.has_active_attempt(q.test_id)
    )
  );
