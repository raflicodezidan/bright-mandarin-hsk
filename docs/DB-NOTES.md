# Catatan Database

Skema: `supabase/migrations/0001_init.sql`. Semua tabel memakai RLS.

## Cara menjalankan migrasi

Pilihan A — SQL Editor (paling cepat untuk project baru):

1. Buka Supabase Dashboard → SQL Editor → New query.
2. Tempel seluruh isi `supabase/migrations/0001_init.sql`, lalu Run.
3. Periksa di Table Editor: tabel `profiles`, `tests`, `questions`,
   `question_options`, `answer_keys`, `attempts`, `attempt_answers`, dan bucket
   privat `question-media` ada.

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
| `profiles` | Profil admin/murid, terhubung 1:1 ke `auth.users` |
| `tests` | Tes HSK: judul, level, durasi, status |
| `questions` | Soal per tes, bagian `listening`/`reading`, posisi, media |
| `question_options` | Opsi A–E per soal |
| `answer_keys` | Kunci jawaban, terpisah dari soal |
| `attempts` | Pengerjaan murid + kolom skor (hanya admin) |
| `attempt_answers` | Jawaban tersimpan per soal |
| `student_attempt_status` (view) | Status pengerjaan milik murid, tanpa skor |

## Policy RLS

| Tabel | Murid | Admin |
|---|---|---|
| `profiles` | SELECT baris sendiri | SELECT/INSERT/UPDATE/DELETE semua |
| `tests` | SELECT tes `open` saja | semua |
| `questions` | SELECT jika punya attempt `in_progress` yang belum kedaluwarsa | semua |
| `question_options` | SELECT jika soal milik attempt aktif | semua |
| `answer_keys` | tidak ada policy (0 baris) | semua |
| `attempts` | tidak ada akses langsung; baca `student_attempt_status` | semua |
| `attempt_answers` | SELECT milik sendiri selama `in_progress`; tulis lewat `save_answer` | semua |
| `storage.objects` (`question-media`) | tidak ada policy | SELECT/INSERT/UPDATE/DELETE |

Bucket `question-media` privat. Murid menerima media hanya lewat signed URL
yang dibuat server setelah memverifikasi attempt aktif (tahap 4).

## Fungsi

| Fungsi | Hak | Catatan |
|---|---|---|
| `is_admin()` | authenticated | admin aktif |
| `get_test_summary(uuid)` | authenticated | hanya tes `open` (atau admin) |
| `start_attempt(uuid)` | authenticated | atomik; unique `(test_id, student_id)`; mengembalikan attempt `in_progress` yang ada |
| `save_answer(uuid, uuid, uuid)` | authenticated | validasi pemilik attempt, batas `expires_at + 5s`, soal & opsi milik tes |
| `submit_attempt(uuid)` | authenticated | idempotent, penilaian dari jawaban tersimpan |
| `finalize_expired_attempts()` | authenticated | menutup attempt yang lewat waktu |
| `reset_attempt(uuid)` | authenticated | hanya admin |
| `score_attempt(...)` | tidak diberikan ke client | dipakai fungsi lain |

`submit_attempt` hanya mengembalikan `id` dan `status`, bukan kolom skor. Fungsi
ini dapat dipanggil murid lewat anon key, sehingga mengembalikan skor akan
melanggar SEC-1/AC-12.

`start_attempt` mengembalikan baris dengan `expires_at` di masa lalu jika
attempt yang ditemukan sudah kedaluwarsa (sudah difinalkan sebagai `expired`).
Aplikasi memeriksa `expires_at <= server_now` lalu mengarahkan ke halaman
selesai. Ini menghindari `raise exception` yang akan membatalkan pembaruan skor
di dalam transaksi yang sama.

## Pilihan: view vs column privileges

Murid tidak diberi policy SELECT pada `attempts` sama sekali. Sebagai gantinya
tersedia view `student_attempt_status` (`security_invoker = off`) yang hanya
memilih baris `student_id = auth.uid()` dan hanya kolom status/waktu. Pemilihan
view lebih aman dan lebih sederhana daripada column-level privileges karena
`authenticated` juga dipakai admin — column privileges berlaku untuk peran,
bukan per-user, sehingga admin akan kehilangan akses kolom skor.

## Penguncian edit (BR-6/AC-9)

Trigger `questions_guard`, `question_options_guard`, `answer_keys_guard`, dan
`tests_guard` menolak perubahan soal/opsi/kunci/durasi jika tes sudah punya
pengerjaan. `tests_guard` juga menolak status `open` jika belum ada soal atau
ada soal tanpa kunci.

## Verifikasi keamanan manual

Lihat `docs/verification.sql`. Jalankan di SQL Editor setelah membuat satu tes,
satu soal, satu kunci, serta akun murid dengan attempt aktif.
