-- Verifikasi RLS & fungsi. Jalankan di Supabase SQL Editor.
-- Ganti <student-uuid>, <teacher-a-uuid>, <owner-uuid>, <test-id>, <attempt-id>,
-- dan <question-id> dengan data uji.
-- Setiap blok dibungkus transaksi dan di-rollback.

-- (a) Murid tidak bisa membaca answer_keys.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<student-uuid>', 'role', 'authenticated')::text,
    true
  );
  select count(*) as answer_keys_terbaca from public.answer_keys;  -- harus 0
rollback;

-- (b) Murid tanpa attempt aktif tidak bisa membaca questions.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<student-uuid-sudah-submit>', 'role', 'authenticated')::text,
    true
  );
  select count(*) as questions_terbaca from public.questions where test_id = '<test-id>'; -- harus 0
rollback;

-- (b2) Murid tidak bisa membaca kolom skor attempts.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<student-uuid>', 'role', 'authenticated')::text,
    true
  );
  select count(*) as attempts_terbaca from public.attempts; -- harus 0
  select count(*) as status_terbaca from public.student_attempt_status; -- >= 0, tanpa skor
rollback;

-- (c) start_attempt kedua kali pada tes yang sudah submit ditolak.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<student-uuid>', 'role', 'authenticated')::text,
    true
  );
  select * from public.start_attempt('<test-id>');
  -- harus error: "Tes ini sudah pernah dikerjakan."
rollback;

-- (d) save_answer setelah expires_at + 5 detik ditolak.
-- Ubah dulu expires_at attempt uji ke masa lalu (sebagai postgres):
update public.attempts set expires_at = now() - interval '10 seconds'
where id = '<attempt-id>';
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<student-uuid>', 'role', 'authenticated')::text,
    true
  );
  select public.save_answer('<attempt-id>', '<question-id>', '<option-id>');
  -- harus error: "Pengerjaan tidak aktif atau waktu sudah habis."
rollback;

-- (e) Murid tidak bisa insert langsung ke attempts / attempt_answers.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<student-uuid>', 'role', 'authenticated')::text,
    true
  );
  insert into public.attempt_answers (attempt_id, question_id, selected_option_id)
  values ('<attempt-id>', '<question-id>', '<option-id>');
  -- harus error karena RLS (tidak ada policy INSERT).
rollback;

-- (f) Murid tidak bisa memanggil reset_attempt.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<student-uuid>', 'role', 'authenticated')::text,
    true
  );
  select public.reset_attempt('<attempt-id>');
  -- harus error: "Akses ditolak."
rollback;

-- (g) Murid tidak bisa mengunggah ke storage.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<student-uuid>', 'role', 'authenticated')::text,
    true
  );
  insert into storage.objects (bucket_id, name) values ('question-media', 'audio/uji.mp3');
  -- harus error karena RLS.
rollback;

-- ===========================================================================
-- Isolasi multi-guru
-- ===========================================================================

-- (h) Guru A hanya melihat profil murid yang diampu.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<teacher-a-uuid>', 'role', 'authenticated')::text,
    true
  );
  select count(*) as profil_murid_lain
  from public.profiles
  where id = '<student-of-teacher-b-uuid>'; -- harus 0
rollback;

-- (i) Guru A tidak bisa membaca kunci tes yang tidak dapat diakses.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<teacher-a-uuid>', 'role', 'authenticated')::text,
    true
  );
  select count(*) as kunci_terbaca
  from public.answer_keys k
  join public.questions q on q.id = k.question_id
  where q.test_id = '<test-of-teacher-b-id>'; -- harus 0
rollback;

-- (j) Guru A tidak bisa membaca attempt murid guru B.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<teacher-a-uuid>', 'role', 'authenticated')::text,
    true
  );
  select count(*) as attempt_terbaca
  from public.attempts
  where student_id = '<student-of-teacher-b-uuid>'; -- harus 0
rollback;

-- (k) Guru yang ditugaskan (bukan pembuat) tidak bisa mengubah tes.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<assigned-teacher-uuid>', 'role', 'authenticated')::text,
    true
  );
  update public.tests
  set title = title || ' (diubah)'
  where id = '<test-assigned-id>'
  returning id; -- harus 0 baris
rollback;

-- (l) Guru A tidak bisa mereset attempt murid guru B.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<teacher-a-uuid>', 'role', 'authenticated')::text,
    true
  );
  select public.reset_attempt('<attempt-of-teacher-b-student-id>');
  -- harus error: "Akses ditolak."
rollback;

-- (m) Murid tidak bisa melihat tes yang tidak ditugaskan ke guru aktifnya.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<student-uuid>', 'role', 'authenticated')::text,
    true
  );
  select count(*) as tes_terbaca
  from public.tests
  where id = '<unassigned-test-id>'; -- harus 0
rollback;

-- (n) Owner dapat membaca semua kunci dan KPI guru.
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<owner-uuid>', 'role', 'authenticated')::text,
    true
  );
  select count(*) as kunci_terbaca from public.answer_keys; -- >= 1
  select count(*) as kpi_guru from public.owner_teacher_kpis(); -- >= 0
rollback;
