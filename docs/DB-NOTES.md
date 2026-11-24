# Catatan Database

Skema: `supabase/migrations/0001_init.sql` sampai
`supabase/migrations/0006_multi_teacher_owner.sql`. Semua tabel memakai RLS.

## Cara menjalankan migrasi

Pilihan A — SQL Editor (paling cepat untuk project baru):

1. Buka Supabase Dashboard → SQL Editor → New query.
2. Jalankan migrasi berurutan: `0001_init.sql`, `0002_admin_functions.sql`,
   `0003_student_access.sql`, `0004_allow_question_text_edits_after_attempts.sql`,
   `0005_allow_test_level_and_duration_edits.sql`, lalu
   `0006_multi_teacher_owner.sql`.
3. Periksa di Table Editor: tabel `profiles`, `teacher_students`,
   `test_assignments`, `tests`, `questions`, `question_options`, `answer_keys`,
   `attempts`, `attempt_answers`, dan bucket privat `question-media` ada.

Pilihan B — Supabase CLI:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Setelah skema berubah, regenerasi tipe:

```bash
npx supabase gen types typescript --project-id <project-ref> --schema public \
  > lib/supabase/database.types.ts
```

## Tabel

| Tabel | Isi |
|---|---|
| `profiles` | Profil owner/admin/guru/murid, terhubung 1:1 ke `auth.users` |
| `teacher_students` | Relasi guru–murid; satu murid hanya punya satu relasi aktif |
| `test_assignments` | Penugasan tes ke guru; satu tes dapat ditugaskan ke banyak guru |
| `tests` | Tes HSK: judul, level, durasi, status, pembuat |
| `questions` | Soal per tes, bagian `listening`/`reading`, posisi, media |
| `question_options` | Opsi A–E per soal |
| `answer_keys` | Kunci jawaban, terpisah dari soal |
| `attempts` | Pengerjaan murid + kolom skor (hanya owner dan guru pengampu) |
| `attempt_answers` | Jawaban tersimpan per soal |
| `student_attempt_status` (view) | Status pengerjaan milik murid, tanpa skor |

## Policy RLS

| Tabel | Murid | Guru | Owner |
|---|---|---|---|
| `profiles` | SELECT baris sendiri | SELECT diri sendiri + murid yang diampu | semua |
| `tests` | SELECT tes yang dapat diakses (lihat di bawah) | SELECT tes miliknya, yang ditugaskan, dan yang perlu ditinjau; tulis hanya miliknya | semua |
| `questions` | SELECT jika punya attempt `in_progress` yang belum kedaluwarsa | SELECT tes yang dapat diakses/ditinjau; tulis hanya miliknya | semua |
| `question_options` | SELECT jika soal milik attempt aktif | SELECT tes yang dapat diakses/ditinjau; tulis hanya miliknya | semua |
| `answer_keys` | tidak ada policy (0 baris) | SELECT tes yang dapat diakses/ditinjau; tulis hanya miliknya | semua |
| `attempts` | tidak ada akses langsung; baca `student_attempt_status` | SELECT pengerjaan murid yang diampu | semua |
| `attempt_answers` | SELECT milik sendiri selama `in_progress`; tulis lewat `save_answer` | SELECT pengerjaan murid yang diampu | semua |
| `teacher_students` | SELECT relasi sendiri | SELECT relasi miliknya | semua |
| `test_assignments` | tidak ada policy | SELECT penugasan dirinya | semua |
| `storage.objects` (`question-media`) | tidak ada policy | tidak ada policy (unggah lewat Server Action + service role) | SELECT/INSERT/UPDATE/DELETE |

Bucket `question-media` privat. Murid menerima media hanya lewat signed URL
yang dibuat server setelah memverifikasi attempt aktif (tahap 4).

Tes terlihat murid jika tes `open` dan ditugaskan ke guru aktifnya, dibuat oleh
guru aktifnya, atau merupakan tes global owner (tes owner tanpa penugasan).
Tes yang sudah/sedang dikerjakan tetap terlihat (BR-5).

Guru yang ditugaskan bersifat view-only. Policy tulis `tests`, `questions`,
`question_options`, dan `answer_keys` hanya mengizinkan pembuat tes (atau owner).
Server Action juga memeriksa kepemilikan secara eksplisit.

## Fungsi

| Fungsi | Hak | Catatan |
|---|---|---|
| `is_owner()` | authenticated | owner/admin aktif |
| `is_admin()` | authenticated | alias lama untuk `is_owner()` |
| `is_teacher()` | authenticated | guru aktif |
| `is_staff()` | authenticated | owner/admin atau guru aktif |
| `is_teacher_of_student(uuid)` | authenticated | relasi guru–murid aktif |
| `teacher_owns_test(uuid)` | authenticated | owner atau pembuat tes |
| `teacher_can_access_test(uuid)` | authenticated | miliknya atau ditugaskan kepadanya |
| `teacher_can_review_test(uuid)` | authenticated | ada hasil murid yang diampu pada tes tersebut |
| `teacher_can_access_question(uuid)` | authenticated | tes dapat diakses atau ditinjau |
| `teacher_owns_question(uuid)` | authenticated | soal milik tes yang ia buat |
| `teacher_can_access_attempt(uuid)` | authenticated | pengerjaan murid yang diampu |
| `student_can_access_test(uuid)` | authenticated | tes yang boleh dilihat murid |
| `can_manage_attempt(uuid)` | authenticated | owner atau guru pengampu murid |
| `get_test_summary(uuid)` | authenticated | hanya tes yang dapat diakses |
| `start_attempt(uuid)` | authenticated | atomik; unique `(test_id, student_id)`; mengembalikan attempt `in_progress` yang ada |
| `save_answer(uuid, uuid, uuid)` | authenticated | validasi pemilik attempt, batas `expires_at + 5s`, soal & opsi milik tes |
| `submit_attempt(uuid)` | authenticated | idempotent, penilaian dari jawaban tersimpan |
| `finalize_expired_attempts()` | authenticated | menutup attempt yang lewat waktu |
| `reset_attempt(uuid)` | authenticated | owner atau guru pengampu murid |
| `save_question(...)` | authenticated | owner atau pembuat tes |
| `delete_question(uuid)` | authenticated | owner atau pembuat tes |
| `move_question(uuid, integer)` | authenticated | owner atau pembuat tes |
| `duplicate_test(uuid, jsonb)` | authenticated | owner atau pembuat tes |
| `update_question_text(...)` | authenticated | perbaikan teks/kunci setelah ada pengerjaan; menghitung ulang skor |
| `assign_student_to_teacher(uuid, uuid)` | authenticated | owner; mengakhiri relasi lama |
| `unassign_student(uuid)` | authenticated | owner |
| `set_test_assignments(uuid, uuid[])` | authenticated | owner |
| `owner_teacher_kpis()` | authenticated | owner; KPI per guru |
| `score_attempt(...)` | tidak diberikan ke client | dipakai fungsi lain |

`submit_attempt` hanya mengembalikan `id` dan `status`, bukan kolom skor. Fungsi
ini dapat dipanggil murid lewat anon key, sehingga mengembalikan skor akan
melanggar SEC-1/AC-12.

`start_attempt` mengembalikan baris dengan `expires_at` di masa lalu jika
attempt yang ditemukan sudah kedaluwarsa (sudah difinalkan sebagai `expired`).
Aplikasi memeriksa `expires_at <= server_now` lalu mengarahkan ke halaman
selesai. Ini menghindari `raise exception` yang akan membatalkan pembaruan skor
di dalam transaksi yang sama.

## Relasi guru–murid dan penugasan tes

- Satu murid hanya memiliki satu relasi aktif. Unique index parsial
  `teacher_students_one_active_student` menjaga invariant ini.
- Mutasi murid mengakhiri relasi lama dengan `ended_at`, bukan menghapus baris.
  Riwayat hasil tetap ada dan dapat ditinjau guru baru lewat
  `teacher_can_review_test`.
- Tes memiliki satu pembuat. Tes dapat ditugaskan ke banyak guru; guru yang
  ditugaskan hanya dapat melihat. Tes owner tanpa penugasan berlaku sebagai tes
  global.
- Penghapusan tes diblokir trigger `tests_delete_guard` jika sudah ada attempt,
  termasuk attempt yang tidak terlihat guru karena RLS.

## Pilihan: view vs column privileges

Murid tidak diberi policy SELECT pada `attempts` sama sekali. Sebagai gantinya
tersedia view `student_attempt_status` (`security_invoker = off`) yang hanya
memilih baris `student_id = auth.uid()` dan hanya kolom status/waktu. Pemilihan
view lebih aman dan lebih sederhana daripada column-level privileges karena
`authenticated` juga dipakai owner dan guru — column privileges berlaku untuk
peran, bukan per-user, sehingga owner akan kehilangan akses kolom skor.

## Penguncian edit (BR-6/AC-9)

Trigger `questions_guard`, `question_options_guard`, `answer_keys_guard`, dan
`tests_guard` menolak perubahan struktur soal, media, jumlah/label opsi, dan
penghapusan setelah tes punya pengerjaan. `tests_guard` juga menolak status
`open` jika belum ada soal atau ada soal tanpa kunci.

Yang masih diizinkan setelah ada pengerjaan:

- Mengubah teks soal, teks opsi, dan kunci lewat `update_question_text`. Opsi
  diperbarui berdasarkan label agar ID opsi dan jawaban murid tidak berubah;
  skor attempt `submitted`/`expired` dihitung ulang.
- Mengubah level dan durasi tes. Durasi baru hanya berlaku untuk attempt
  berikutnya karena `expires_at` attempt berjalan sudah tersimpan.
- Mengubah teks opsi yang sudah dipilih murid pada attempt `in_progress`
  ditolak.

## Verifikasi keamanan manual

Lihat `docs/verification.sql`. Jalankan di SQL Editor setelah membuat data uji:
satu owner, dua guru, murid untuk masing-masing guru, satu tes, satu soal, satu
kunci, serta attempt aktif dan selesai.
