-- Migration 0008: PDF overlay pada tes (bukan pada soal).
-- Kolom pdf_path dan student_pdf_path di tabel tests sudah diterapkan ke remote
-- secara manual bersama perbaikan logika hanzi_blank PDF-mode dan
-- save_interactive_answer. Migration ini mendokumentasikan perubahan tersebut
-- dan memastikan deploy ke lingkungan baru berjalan dengan benar.

-- 1. Kolom PDF per tes (idempotent dengan IF NOT EXISTS).
alter table public.tests
  add column if not exists pdf_path text,
  add column if not exists student_pdf_path text;

-- 2. Perbaikan policy storage: guru boleh membaca student_pdf_path juga.
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
        where (t.pdf_path = storage.objects.name or t.student_pdf_path = storage.objects.name)
          and (public.teacher_can_access_test(t.id) or public.teacher_can_review_test(t.id))
      )
    )
  );

-- 3. Fungsi save_interactive_question: tambah mode PDF untuk hanzi_blank
--    (lebih dari 5 opsi, tanpa placeholder {{blank}} di prompt, validasi overlay).
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
    if coalesce(p_config->>'pdf', 'false') = 'true' then
      -- Mode PDF: satu soal mewakili satu titik kosong; kalimat terlihat di PDF.
      if jsonb_typeof(p_config->'choices') <> 'array'
         or jsonb_array_length(p_config->'choices') not between 2 and 8
         or jsonb_typeof(p_config->'overlays') <> 'array'
         or jsonb_array_length(p_config->'overlays') <> 1
         or coalesce((p_config->'overlays'->0->>'pageNumber')::integer, 0) < 1
         or coalesce((p_config->'overlays'->0->>'x')::numeric, -1) not between 0 and 1
         or coalesce((p_config->'overlays'->0->>'y')::numeric, -1) not between 0 and 1
         or coalesce((p_config->'overlays'->0->>'width')::numeric, 0) not between 0.01 and 0.2
         or coalesce((p_config->'overlays'->0->>'height')::numeric, 0) not between 0.01 and 0.2 then
        raise exception using errcode = 'P0001', message = 'Isian PDF harus memiliki 2–8 opsi dan satu titik kosong.';
      end if;
    else
      if jsonb_typeof(p_config->'choices') <> 'array'
         or jsonb_array_length(p_config->'choices') not between 2 and 5
         or coalesce(p_config->>'blankCount', '1') <> '1'
         or (length(p_prompt) - length(replace(p_prompt, '{{blank}}', ''))) / length('{{blank}}') <> 1 then
        raise exception using errcode = 'P0001', message = 'Isian Hanzi harus memiliki satu penanda {{blank}} dan 2–5 opsi.';
      end if;
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

  delete from public.question_options o where o.question_id = v_id;
  delete from public.answer_keys k where k.question_id = v_id;

  insert into public.interactive_answer_keys(question_id, answer, updated_at)
  values (v_id, p_answer_key, now())
  on conflict (question_id) do update set answer = excluded.answer, updated_at = now();
  return v_id;
end;
$$;

-- 4. Fungsi save_interactive_answer: izinkan payload kosong untuk menghapus jawaban.
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

  -- Payload kosong = hapus jawaban (tombol Hapus/Reset di UI).
  if p_answer = '{}'::jsonb then
    delete from public.attempt_answers aa
    where aa.attempt_id = p_attempt_id and aa.question_id = p_question_id;
    return;
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

revoke execute on function public.save_interactive_question(uuid, uuid, public.question_section, public.question_type, text, jsonb, jsonb) from public;
revoke execute on function public.save_interactive_answer(uuid, uuid, jsonb) from public;
grant execute on function public.save_interactive_question(uuid, uuid, public.question_section, public.question_type, text, jsonb, jsonb) to authenticated;
grant execute on function public.save_interactive_answer(uuid, uuid, jsonb) to authenticated;
