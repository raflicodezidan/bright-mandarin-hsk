# PRD — Sistem Tes Online HSK Bright Mandarin

Versi 1.1 · 24 November 2026 · Bahasa dokumen: Indonesia (istilah teknis tetap Inggris)

---

## 1. Ringkasan

Sistem tes online HSK (Listening & Reading) untuk murid kursus Bright Mandarin. Tes dikerjakan di kursus (diawasi pengajar), bukan di rumah. Owner mengelola guru, murid, tes, dan soal beserta kunci jawaban. Guru mengelola murid yang diampu dan tes miliknya. Murid hanya login, mengerjakan tes dalam batas waktu, lalu submit. **Murid tidak pernah melihat skor.**

Sistem ini terpisah dari website profile Bright Mandarin (Next.js + Sanity). Repo, database, dan deployment-nya sendiri.

### Tujuan
1. Owner dan guru dapat mengelola soal serta akun murid tanpa developer.
2. Penilaian otomatis, konsisten, dan tidak bisa dimanipulasi dari sisi murid.
3. Skor hanya terlihat oleh owner dan guru yang mengampu murid.
4. Data antar-guru terisolasi; owner dapat memantau kinerja tiap guru.
5. Biaya operasional Rp0 pada skala puluhan murid dan ratusan soal.

### Bukan tujuan (v1)
Lihat bagian 3 (Out of scope).

---

## 2. Pengguna

| Role | Siapa | Bisa | Tidak bisa |
|---|---|---|---|
| `owner` | Pemilik / admin utama | Semua akses: CRUD guru, murid, tes & soal, penugasan guru, lihat semua hasil, KPI guru, reset pengerjaan, export CSV, kelola penyimpanan | — |
| `teacher` | Pengajar | CRUD tes & soal miliknya, melihat tes yang ditugaskan, melihat murid yang diampu, melihat hasil muridnya, reset pengerjaan muridnya, export CSV | Melihat guru/murid lain, mengubah akun murid, membuka halaman penyimpanan |
| `student` | Murid kursus | Login, melihat daftar tes yang tersedia, mengerjakan tes (sekali), submit | Melihat skor, kunci jawaban, soal di luar tes yang sedang dikerjakan, mengunduh soal, mendaftar sendiri |

Role `admin` lama tetap dipertahankan sebagai alias owner agar akun yang sudah ada tidak rusak. Akun owner dibuat lewat script seed; akun guru dibuat owner lewat UI. Tidak ada halaman pendaftaran publik.

---

## 3. Scope

### In scope (v1)
- Login username + password untuk owner, guru, dan murid
- Owner: CRUD guru, CRUD murid, penugasan murid ke guru, CRUD tes, penugasan tes ke guru, dashboard KPI guru, export CSV, reset pengerjaan, kelola penyimpanan
- Guru: CRUD tes dan soal miliknya, melihat tes yang ditugaskan, melihat murid dan hasil muridnya, reset pengerjaan muridnya, export CSV
- CRUD soal (pilihan ganda 2–5 opsi, audio, gambar), buka/tutup tes, dashboard hasil
- Murid: daftar tes, halaman instruksi, pengerjaan dengan timer, autosave, submit, halaman selesai
- Skor otomatis di server berdasarkan kunci jawaban yang diatur owner/guru
- Batas waktu per tes, satu kali pengerjaan per murid per tes

### Out of scope (v1, boleh dibahas sebagai pengembangan tambahan)
- Soal isian / esai / penilaian manual
- Skor skala resmi HSK (v1 hanya jumlah benar dan persentase)
- Grup soal dengan satu audio/bacaan bersama (tiap soal berdiri sendiri)
- Acak urutan soal / opsi
- Batas jumlah putar audio
- Pembatasan lokasi/IP teknis (pembatasan lokasi = pengawasan pengajar + owner/guru yang membuka/menutup tes)
- Pendaftaran mandiri, reset password lewat email
- Dark mode, multi-bahasa, aplikasi mobile native

---

## 4. Aturan bisnis (BR)

- **BR-1** Tiap tes punya `duration_minutes` (5–240). Timer dihitung di **server**: `expires_at = started_at + duration`. Jam perangkat murid tidak berpengaruh.
- **BR-2** Satu murid hanya boleh satu pengerjaan per tes (`unique(test_id, student_id)`). Setelah `submitted` atau `expired`, murid tidak bisa membuka soal itu lagi.
- **BR-3** Refresh halaman, tutup tab, atau koneksi putus **tidak mereset timer**. Murid yang kembali sebelum `expires_at` melanjutkan pengerjaan dengan jawaban yang sudah tersimpan.
- **BR-4** Saat waktu habis, pengerjaan otomatis disubmit dengan jawaban yang sudah tersimpan. Soal tanpa jawaban dihitung salah.
- **BR-5** Murid melihat tes berstatus `open` jika tes ditugaskan ke guru aktifnya, dibuat oleh guru aktifnya, atau merupakan tes global owner tanpa penugasan. Owner/guru membuka tes saat murid sudah di kursus dan menutupnya setelah sesi selesai. Murid yang sudah `in_progress` boleh menyelesaikan pengerjaannya walau tes ditutup, sampai `expires_at`.
- **BR-6** Setelah tes memiliki attempt, owner atau guru pemilik tes boleh mengubah judul, deskripsi, level HSK, durasi, teks soal, teks opsi dengan label/ID tetap, dan kunci jawaban. Perubahan durasi berlaku hanya untuk attempt berikutnya; attempt yang telah dimulai tetap memakai `expires_at` yang sudah ditetapkan. Bagian, urutan, jumlah opsi, serta media terkunci. Jika kunci berubah, skor attempt berstatus `submitted`/`expired` dihitung ulang memakai kunci terbaru. Perubahan teks opsi yang sudah dipilih pada attempt `in_progress` ditolak agar tidak mengubah makna jawaban aktif.
- **BR-7** Skor = jumlah jawaban benar. Ditampilkan sebagai `benar / total` dan persentase, plus rincian Listening dan Reading. Hanya terlihat oleh owner dan guru yang mengampu murid.
- **BR-8** Owner boleh me-reset pengerjaan murid mana pun. Guru boleh me-reset pengerjaan murid yang diampu. Wajib konfirmasi.
- **BR-9** Murid nonaktif (`is_active = false`) tidak bisa login. Penghapusan murid yang punya riwayat hasil ditolak; sarankan menonaktifkan.
- **BR-10** Urutan soal dalam tes: semua `listening` dulu, lalu `reading`, masing-masing berdasarkan `position`.
- **BR-11** Satu murid hanya memiliki satu guru aktif. Saat murid dipindahkan, relasi lama diakhiri (`ended_at`), bukan dihapus. Riwayat pengerjaan tetap milik murid dan ikut terlihat oleh guru baru.
- **BR-12** Tes memiliki satu pembuat (`created_by`). Tes dapat ditugaskan ke beberapa guru melalui `test_assignments`. Guru yang ditugaskan dapat melihat tes dan hasil muridnya, tetapi hanya pembuat tes dan owner yang dapat mengubah tes. Tes milik owner tanpa penugasan berlaku sebagai tes global.

---

## 5. Kebutuhan fungsional

### Autentikasi
- **FR-1** Login dengan username + password. Redirect berdasarkan role (`owner`/`admin` dan `teacher` → `/admin`, `student` → `/tests`).
- **FR-2** Username dipetakan ke email sintetis `<username>@<STUDENT_EMAIL_DOMAIN>` untuk Supabase Auth. Pengguna tidak pernah melihat email ini.
- **FR-3** Logout. Sesi memakai cookie (`@supabase/ssr`).
- **FR-4** Pesan error login netral: "Username atau password salah." Akun nonaktif: "Akun tidak aktif. Hubungi guru atau owner."

### Owner — Guru dan murid
- **FR-5** Owner melihat daftar guru dengan KPI: jumlah murid, pengerjaan selesai, rata-rata nilai, jumlah murid dengan nilai di bawah 60, aktivitas terakhir, dan status aktif.
- **FR-6** Owner menambah guru: nama lengkap, username unik, password awal. Password hanya ditampilkan sekali. Owner dapat mereset password dan menonaktifkan guru.
- **FR-7** Owner melihat detail guru: KPI, daftar murid yang diampu, daftar tes milik/ditugaskan, serta aksi menugaskan dan melepas murid.
- **FR-8** Daftar murid (pencarian nama/username, filter status dan guru, pagination 25/halaman). Kolom guru menunjukkan guru aktif atau "Belum ditugaskan".
- **FR-9** Tambah murid: nama lengkap, username (unik, huruf kecil/angka/titik/garis bawah, 3–30 karakter), password awal (min. 8 karakter; ada tombol "Buat otomatis"). Password hanya ditampilkan sekali setelah dibuat.
- **FR-10** Edit nama, reset password, aktif/nonaktifkan, hapus (lihat BR-9). Hanya owner yang dapat mengelola akun murid.

### Owner & guru — Tes dan soal
- **FR-11** Daftar tes dengan status `draft` / `open` / `closed` / `archived`, level HSK, durasi, jumlah soal, jumlah pengerjaan, dan pemilik tes. Guru hanya melihat tes miliknya dan tes yang ditugaskan kepadanya.
- **FR-12** Buat/edit tes: judul, level HSK (1–6), deskripsi/instruksi, durasi (menit). Guru dapat membuat tes baru.
- **FR-13** Ubah status: Draft → Buka → Tutup → Arsipkan. Tes hanya bisa dibuka jika punya minimal 1 soal dan setiap soal punya kunci jawaban. Hanya owner/pembuat tes yang dapat mengubah status.
- **FR-14** CRUD soal dalam tes: bagian (`listening`/`reading`), teks soal (mendukung karakter Mandarin), 2–5 opsi (label A–E otomatis), kunci jawaban (tepat satu), gambar opsional, audio opsional (wajib untuk listening), posisi/urutan (ubah dengan tombol naik/turun).
- **FR-15** Upload audio (mp3, maks 10 MB) dan gambar (jpg/png/webp, maks 2 MB) ke Supabase Storage. Pratinjau audio di form.
- **FR-16** Duplikat tes (menyalin soal, opsi, kunci, dan media) sebagai draft baru.
- **FR-17** Pratinjau tes sebagai murid (tanpa membuat attempt, tanpa timer).
- **FR-18** Owner menugaskan tes ke satu atau beberapa guru. Tes tanpa penugasan milik owner berlaku global; tes milik guru tetap terlihat oleh murid guru tersebut.

### Owner & guru — Hasil
- **FR-19** Dashboard owner: murid aktif, guru aktif, sedang mengerjakan, selesai hari ini, daftar guru dengan murid bernilai di bawah 60, penyimpanan, dan 10 hasil terbaru. Dashboard guru: murid yang diampu, tes tersedia, sedang mengerjakan, selesai hari ini, dan hasil terbaru muridnya.
- **FR-20** Halaman hasil: tabel pengerjaan dengan filter murid, tes, level, rentang tanggal, status. Owner melihat kolom guru; guru hanya melihat hasil muridnya. Kolom: murid, guru (owner), tes, level, mulai, selesai, durasi terpakai, benar/total, persentase, Listening, Reading, status.
- **FR-21** Detail pengerjaan: tiap soal dengan jawaban murid, kunci, benar/salah, serta guru pengampu saat ini.
- **FR-22** Export CSV (UTF-8 dengan BOM agar terbaca Excel) sesuai filter aktif dan akses role.
- **FR-23** Reset pengerjaan (BR-8).

### Murid
- **FR-24** Daftar tes yang tersedia, dengan status per tes: "Belum dikerjakan", "Sedang berlangsung" (tombol Lanjutkan), "Selesai". Tanpa skor.
- **FR-25** Halaman instruksi: judul, level, durasi, jumlah soal per bagian, peringatan "Tes hanya dapat dikerjakan satu kali dan waktu tidak dapat dihentikan", tombol Mulai.
- **FR-26** Halaman pengerjaan: timer, navigasi nomor soal, satu soal per layar, pilih jawaban, tombol Sebelumnya/Berikutnya, tombol Kumpulkan dengan dialog konfirmasi (menyebut jumlah soal belum terjawab).
- **FR-27** Autosave tiap kali memilih jawaban. Jika gagal tersimpan, tampilkan indikator "Belum tersimpan" dan coba ulang otomatis.
- **FR-28** Saat waktu habis, kirim otomatis lalu arahkan ke halaman selesai.
- **FR-29** Halaman selesai: "Jawaban Anda telah tersimpan. Terima kasih." Tanpa skor.
- **FR-30** Perlindungan salin soal (best effort, lihat bagian 7): watermark nama murid, tanpa tombol unduh, seleksi teks dimatikan di halaman pengerjaan.

---

## 6. Model data

Semua `id` bertipe `uuid` (default `gen_random_uuid()`), waktu bertipe `timestamptz`. Nama kolom Inggris.

| Tabel | Kolom penting | Catatan |
|---|---|---|
| `profiles` | `id` (pk, = `auth.users.id`), `username` (unique), `full_name`, `role` (`owner`/`admin`/`teacher`/`student`), `is_active`, `created_at` | `admin` dipertahankan sebagai alias owner |
| `teacher_students` | `id`, `teacher_id` → profiles, `student_id` → profiles, `assigned_by`, `assigned_at`, `ended_at`, `ended_by` | Satu murid hanya punya satu relasi aktif (unique index parsial) |
| `test_assignments` | `id`, `test_id` → tests, `teacher_id` → profiles, `assigned_by`, `assigned_at` | unique (`test_id`, `teacher_id`); tes dapat ditugaskan ke banyak guru |
| `tests` | `id`, `title`, `level` (1–6), `description`, `duration_minutes`, `status` (`draft`/`open`/`closed`/`archived`), `created_by`, `created_at`, `updated_at` | |
| `questions` | `id`, `test_id` → tests (cascade), `section` (`listening`/`reading`), `position` int, `prompt` text, `image_path` null, `audio_path` null | unique (`test_id`, `section`, `position`) |
| `question_options` | `id`, `question_id` → questions (cascade), `label` (`A`–`E`), `text` | unique (`question_id`, `label`) |
| `answer_keys` | `question_id` (pk, → questions cascade), `correct_option_id` → question_options | **Tabel terpisah**, hanya owner dan guru terkait yang bisa SELECT |
| `attempts` | `id`, `test_id`, `student_id`, `started_at`, `expires_at`, `submitted_at` null, `status` (`in_progress`/`submitted`/`expired`), `correct_count`, `total_count`, `listening_correct`, `listening_total`, `reading_correct`, `reading_total` | unique (`test_id`, `student_id`); kolom skor null sampai selesai |
| `attempt_answers` | `attempt_id` → attempts (cascade), `question_id`, `selected_option_id`, `answered_at` | pk (`attempt_id`, `question_id`) |

Storage: bucket privat `question-media` (`audio/…`, `images/…`).

### Fungsi database (Postgres, `security definer`, `set search_path = public`)
- `is_owner()` — true jika user aktif berrole owner/admin.
- `is_teacher()` — true jika user aktif berrole teacher.
- `is_staff()` — true jika owner atau guru aktif.
- `is_teacher_of_student(p_student_id)` — true jika guru aktif saat ini mengampu murid tersebut.
- `teacher_can_access_test(p_test_id)` — true jika owner, pembuat tes, atau guru yang ditugaskan.
- `teacher_can_review_test(p_test_id)` — true jika guru mengampu murid yang punya pengerjaan pada tes tersebut (riwayat ikut pindah).
- `teacher_can_access_attempt(p_attempt_id)` — true jika guru mengampu murid pemilik pengerjaan.
- `get_test_summary(p_test_id)` — judul, level, durasi, jumlah soal per bagian. Hanya untuk tes yang dapat diakses user.
- `start_attempt(p_test_id)` — membuat attempt (BR-1, BR-2) atau mengembalikan attempt `in_progress` yang ada. Menolak jika tes tidak tersedia, atau murid sudah pernah mengerjakan. Mengembalikan `attempt_id`, `expires_at`, `server_now`.
- `save_answer(p_attempt_id, p_question_id, p_option_id)` — upsert jawaban jika attempt milik user, `in_progress`, dan `now() <= expires_at + 5 detik`. Memvalidasi bahwa soal dan opsi milik tes tersebut.
- `submit_attempt(p_attempt_id)` — mengunci attempt, menghitung skor dari `answer_keys`, mengisi kolom skor, status `submitted`. Idempotent.
- `finalize_expired_attempts()` — mengubah attempt `in_progress` yang lewat `expires_at` menjadi `expired` dan menghitung skornya dari jawaban tersimpan. Dipanggil saat staff membuka dashboard/hasil dan saat murid membuka daftar tes.
- `reset_attempt(p_attempt_id)` — owner atau guru yang mengampu murid (BR-8).
- `assign_student_to_teacher(p_teacher_id, p_student_id)` — owner menugaskan/memindahkan murid ke guru; relasi lama diakhiri.
- `unassign_student(p_student_id)` — owner melepas murid dari guru aktif.
- `set_test_assignments(p_test_id, p_teacher_ids)` — owner mengganti daftar guru yang ditugaskan ke tes.
- `owner_teacher_kpis()` — KPI per guru untuk dashboard owner.

### Prinsip RLS
- RLS aktif di **semua** tabel dan bucket.
- `profiles`: user membaca baris sendiri; owner membaca/menulis semua; guru membaca dirinya dan murid yang diampu. Murid tidak bisa mengubah `role` atau `is_active`.
- `teacher_students`: owner penuh; guru membaca relasi miliknya; murid membaca relasi miliknya.
- `test_assignments`: owner penuh; guru membaca penugasan miliknya.
- `tests`: murid hanya SELECT tes `open` yang dapat diakses (penugasan guru aktif, tes guru aktif, atau tes global owner), ditambah tes yang sudah/sedang dikerjakan. Guru SELECT tes miliknya, tes yang ditugaskan, dan tes yang perlu ditinjau karena hasil muridnya. Owner penuh.
- `questions`, `question_options`: murid hanya SELECT jika punya attempt `in_progress` untuk tes itu dan `now() <= expires_at`. Guru SELECT untuk tes yang dapat diakses/ditinjau. Owner penuh.
- `answer_keys`: hanya owner dan guru yang dapat mengakses soal terkait. Tidak ada policy untuk murid.
- `attempts`: murid memakai view `student_attempt_status` (tanpa kolom skor); Insert/update hanya lewat fungsi. Owner SELECT semua; guru SELECT pengerjaan murid yang diampu.
- `attempt_answers`: murid tidak INSERT/UPDATE langsung (hanya lewat `save_answer`); murid boleh SELECT jawaban miliknya selama `in_progress` agar bisa melanjutkan. Guru SELECT untuk pengerjaan muridnya.
- Storage: tulis hanya owner; guru mengunggah lewat Server Action dengan service role. Murid mengakses media hanya lewat signed URL yang dibuat server setelah memverifikasi attempt aktif.

---

## 7. Keamanan

- **SEC-1** Kunci jawaban dan skor tidak pernah dikirim ke browser murid (cek di Network tab).
- **SEC-2** `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di server (Server Action / Route Handler), tidak pernah diawali `NEXT_PUBLIC_`.
- **SEC-3** Pendaftaran publik Supabase Auth **dimatikan** (Authentication → Sign In / Providers → matikan "Allow new users to sign up"). Konfirmasi email dimatikan karena email sintetis.
- **SEC-4** Setiap Server Action/Route Handler memeriksa role di server. Middleware/proxy hanya lapisan tambahan, bukan satu-satunya penjaga.
- **SEC-5** Signed URL media berlaku singkat (maks. 15 menit), dibuat per permintaan setelah verifikasi attempt aktif.
- **SEC-6** Respons soal memakai `Cache-Control: no-store`.
- **SEC-7** Validasi input dengan zod di server. Batasi ukuran dan tipe file upload.
- **SEC-8** Perlindungan salin soal bersifat *best effort*: watermark nama murid (overlay, `pointer-events: none`), `user-select: none` di halaman pengerjaan, audio tanpa tombol unduh (`controlsList="nodownload"`), tanpa PDF. **Screenshot atau foto layar tidak dapat dicegah** dan harus disampaikan ke owner sebagai keterbatasan.

---

## 8. Non-fungsional

- Skala: puluhan murid, ratusan soal, beberapa murid mengerjakan bersamaan.
- Bahasa UI: Indonesia. Zona waktu tampilan: Asia/Jakarta (WIB). Penyimpanan: UTC.
- Browser: Chrome, Edge, Safari, Firefox terbaru; mobile Chrome/Safari. Halaman murid mobile-first; halaman admin dioptimalkan untuk layar ≥ 768px tapi tetap bisa dipakai di HP.
- Performa: halaman pengerjaan tidak memuat ulang saat berpindah soal (semua soal tes dimuat sekali, media dimuat saat dibutuhkan).
- Aksesibilitas: kontras AA, fokus keyboard terlihat, timer diumumkan lewat `aria-live` pada 5 menit dan 1 menit tersisa.
- Biaya: Vercel Hobby + Supabase Free. Catat bahwa project Supabase Free di-pause setelah 1 minggu tanpa aktivitas.

---

## 9. Peta halaman

| Route | Role | Isi |
|---|---|---|
| `/login` | publik | Form login |
| `/admin` | owner, guru | Dashboard (owner: KPI guru; guru: ringkasan muridnya) |
| `/admin/teachers` | owner | Daftar guru + KPI |
| `/admin/teachers/[id]` | owner | Detail guru, murid yang diampu, tes, penugasan |
| `/admin/students` | owner, guru | Owner: semua murid + filter guru; guru: murid yang diampu |
| `/admin/tests` | owner, guru | Daftar tes sesuai akses |
| `/admin/tests/new` | owner, guru | Buat tes |
| `/admin/tests/[id]` | owner, guru | Edit tes (owner/pembuat) atau lihat saja (guru yang ditugaskan), penugasan guru (owner) |
| `/admin/tests/[id]/questions/[qid]` | owner, guru | Form soal (`new` untuk soal baru) untuk tes yang dapat dikelola |
| `/admin/tests/[id]/preview` | owner, guru | Pratinjau sebagai murid |
| `/admin/results` | owner, guru | Tabel hasil sesuai akses + filter + export |
| `/admin/results/[attemptId]` | owner, guru | Detail pengerjaan |
| `/admin/storage` | owner | Penyimpanan media |
| `/tests` | student | Daftar tes tersedia |
| `/tests/[id]` | student | Instruksi + tombol Mulai |
| `/tests/[id]/take` | student | Pengerjaan |
| `/tests/[id]/done` | student | Selesai |

---

## 10. Kriteria penerimaan (Given / When / Then)

- **AC-1** Given murid login, When membuka `/admin`, Then diarahkan ke `/tests`.
- **AC-2** Given murid mengirim query langsung ke tabel `answer_keys`, Then ditolak (0 baris / error).
- **AC-3** Given murid tanpa attempt aktif, When membaca `questions` untuk sebuah tes, Then 0 baris.
- **AC-4** Given tes 60 menit, When murid menekan Mulai lalu me-refresh halaman di menit ke-10, Then timer menunjukkan sekitar 50 menit tersisa dan jawaban sebelumnya masih terpilih.
- **AC-5** Given murid sudah submit, When membuka `/tests/[id]/take` atau memanggil `start_attempt` lagi, Then ditolak dan diarahkan ke halaman selesai.
- **AC-6** Given waktu habis saat murid masih mengerjakan, Then pengerjaan otomatis terkirim, status `submitted` atau `expired`, soal kosong dihitung salah.
- **AC-7** Given murid mengubah jam perangkat, Then timer tidak berubah.
- **AC-8** Given tes `open` ditutup owner/guru, Then murid baru tidak melihatnya, murid `in_progress` tetap bisa menyelesaikan.
- **AC-9** Given tes sudah punya pengerjaan, When owner/pembuat mengubah kunci jawaban, Then perubahan tersimpan dan skor pengerjaan selesai dihitung ulang dengan kunci terbaru.
- **AC-10** Given owner/guru export CSV dengan filter tes X, Then file hanya berisi pengerjaan yang boleh diakses dan terbuka benar di Excel (karakter Mandarin tidak rusak).
- **AC-11** Given murid dinonaktifkan, When mencoba login, Then ditolak dengan pesan akun tidak aktif.
- **AC-12** Given halaman mana pun untuk murid, Then tidak ada skor, persentase, atau kunci jawaban di UI maupun di respons jaringan.
- **AC-13** Given guru A login, When membuka daftar murid, tes, atau hasil, Then hanya data murid yang diampu dan tes yang boleh diakses yang tampil.
- **AC-14** Given murid dipindahkan dari guru A ke guru B, Then guru B melihat riwayat hasil murid tersebut dan guru A tidak lagi melihatnya.
- **AC-15** Given owner membuka dashboard/guru, Then terlihat jumlah murid dengan nilai di bawah 60 per guru dan tautan ke detail guru.

---

## 11. Asumsi dan hal terbuka

| Item | Asumsi v1 | Perlu konfirmasi owner |
|---|---|---|
| Skor | Jumlah benar + persentase, bukan skala resmi HSK | Ya |
| Audio | Dapat diputar ulang tanpa batas | Ya, HSK asli hanya sekali |
| Reset pengerjaan | Owner dan guru pengampu boleh me-reset | Ya |
| Buka/tutup tes | Dikontrol owner/pembuat tes untuk menjaga tes tetap di kursus | Ya |
| Penugasan guru | Satu murid satu guru aktif; tes dapat ditugaskan ke banyak guru | Ya |
| Logo & warna brand | Memakai token placeholder di `DESIGN.md` | Kirim logo + warna |
| Domain | Subdomain, misal `tes.<domain>` | Ya |

---

## 12. Stack & environment

- Next.js (App Router, TypeScript strict), Tailwind CSS v4, `@supabase/supabase-js`, `@supabase/ssr`, `zod`
- Supabase (Postgres, Auth, Storage), deploy Vercel

`.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # atau publishable key, sesuai dashboard
SUPABASE_SERVICE_ROLE_KEY=            # server only
STUDENT_EMAIL_DOMAIN=students.brightmandarin.local   # domain sintetis; ganti jika ditolak Supabase
ADMIN_SEED_USERNAME=
ADMIN_SEED_PASSWORD=
```
