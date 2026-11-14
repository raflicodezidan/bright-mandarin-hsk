# PRD — Sistem Tes Online HSK Bright Mandarin

Versi 1.0 · 13 November 2026 · Bahasa dokumen: Indonesia (istilah teknis tetap Inggris)

---

## 1. Ringkasan

Sistem tes online HSK (Listening & Reading) untuk murid kursus Bright Mandarin. Tes dikerjakan di kursus (diawasi pengajar), bukan di rumah. Admin membuat soal beserta kunci jawaban, membuat akun murid, dan melihat skor. Murid hanya login, mengerjakan tes dalam batas waktu, lalu submit. **Murid tidak pernah melihat skor.**

Sistem ini terpisah dari website profile Bright Mandarin (Next.js + Sanity). Repo, database, dan deployment-nya sendiri.

### Tujuan
1. Admin dapat mengelola soal dan akun murid sendiri tanpa developer.
2. Penilaian otomatis, konsisten, dan tidak bisa dimanipulasi dari sisi murid.
3. Skor hanya terlihat oleh admin.
4. Biaya operasional Rp0 pada skala puluhan murid dan ratusan soal.

### Bukan tujuan (v1)
Lihat bagian 3 (Out of scope).

---

## 2. Pengguna

| Role | Siapa | Bisa | Tidak bisa |
|---|---|---|---|
| `admin` | Owner / pengajar | CRUD tes & soal, CRUD murid, buka/tutup tes, lihat semua hasil, reset pengerjaan, export CSV | — |
| `student` | Murid kursus | Login, melihat daftar tes yang dibuka, mengerjakan tes (sekali), submit | Melihat skor, kunci jawaban, soal di luar tes yang sedang dikerjakan, mengunduh soal, mendaftar sendiri |

Akun admin dibuat lewat script seed (bukan lewat UI). Tidak ada halaman pendaftaran publik.

---

## 3. Scope

### In scope (v1)
- Login username + password untuk admin dan murid
- Admin: CRUD murid, CRUD tes, CRUD soal (pilihan ganda 2–5 opsi, audio, gambar), buka/tutup tes, dashboard hasil, export CSV, reset pengerjaan
- Murid: daftar tes, halaman instruksi, pengerjaan dengan timer, autosave, submit, halaman selesai
- Skor otomatis di server berdasarkan kunci jawaban yang diatur admin
- Batas waktu per tes, satu kali pengerjaan per murid per tes

### Out of scope (v1, boleh dibahas sebagai pengembangan tambahan)
- Soal isian / esai / penilaian manual
- Skor skala resmi HSK (v1 hanya jumlah benar dan persentase)
- Grup soal dengan satu audio/bacaan bersama (tiap soal berdiri sendiri)
- Acak urutan soal / opsi
- Batas jumlah putar audio
- Pembatasan lokasi/IP teknis (pembatasan lokasi = pengawasan pengajar + admin yang membuka/menutup tes)
- Pendaftaran mandiri, reset password lewat email, UI manajemen admin lain
- Dark mode, multi-bahasa, aplikasi mobile native

---

## 4. Aturan bisnis (BR)

- **BR-1** Tiap tes punya `duration_minutes` (5–240). Timer dihitung di **server**: `expires_at = started_at + duration`. Jam perangkat murid tidak berpengaruh.
- **BR-2** Satu murid hanya boleh satu pengerjaan per tes (`unique(test_id, student_id)`). Setelah `submitted` atau `expired`, murid tidak bisa membuka soal itu lagi.
- **BR-3** Refresh halaman, tutup tab, atau koneksi putus **tidak mereset timer**. Murid yang kembali sebelum `expires_at` melanjutkan pengerjaan dengan jawaban yang sudah tersimpan.
- **BR-4** Saat waktu habis, pengerjaan otomatis disubmit dengan jawaban yang sudah tersimpan. Soal tanpa jawaban dihitung salah.
- **BR-5** Murid hanya melihat tes berstatus `open`. Admin membuka tes saat murid sudah di kursus dan menutupnya setelah sesi selesai. Murid yang sudah `in_progress` boleh menyelesaikan pengerjaannya walau tes ditutup, sampai `expires_at`.
- **BR-6** Tes hanya bisa diedit (soal, opsi, kunci, durasi) saat `draft`, atau saat belum ada pengerjaan. Jika sudah ada pengerjaan, soal dan kunci terkunci (hanya judul dan deskripsi yang boleh diubah).
- **BR-7** Skor = jumlah jawaban benar. Ditampilkan sebagai `benar / total` dan persentase, plus rincian Listening dan Reading. Hanya terlihat oleh admin.
- **BR-8** Admin boleh me-reset pengerjaan seorang murid (menghapus attempt dan jawabannya) agar bisa mengulang, misalnya saat ada kendala teknis. Wajib konfirmasi.
- **BR-9** Murid nonaktif (`is_active = false`) tidak bisa login. Penghapusan murid yang punya riwayat hasil ditolak; sarankan menonaktifkan.
- **BR-10** Urutan soal dalam tes: semua `listening` dulu, lalu `reading`, masing-masing berdasarkan `position`.

---

## 5. Kebutuhan fungsional

### Autentikasi
- **FR-1** Login dengan username + password. Redirect berdasarkan role (`admin` → `/admin`, `student` → `/tests`).
- **FR-2** Username dipetakan ke email sintetis `<username>@<STUDENT_EMAIL_DOMAIN>` untuk Supabase Auth. Pengguna tidak pernah melihat email ini.
- **FR-3** Logout. Sesi memakai cookie (`@supabase/ssr`).
- **FR-4** Pesan error login netral: "Username atau password salah." Akun nonaktif: "Akun tidak aktif. Hubungi admin."

### Admin — Murid
- **FR-5** Daftar murid (pencarian nama/username, filter aktif/nonaktif, pagination 25/halaman).
- **FR-6** Tambah murid: nama lengkap, username (unik, huruf kecil/angka/titik/garis bawah, 3–30 karakter), password awal (min. 8 karakter; ada tombol "Buat otomatis"). Password hanya ditampilkan sekali setelah dibuat.
- **FR-7** Edit nama, reset password, aktif/nonaktifkan, hapus (lihat BR-9).

### Admin — Tes & soal
- **FR-8** Daftar tes dengan status `draft` / `open` / `closed` / `archived`, level HSK, durasi, jumlah soal, jumlah pengerjaan.
- **FR-9** Buat/edit tes: judul, level HSK (1–6), deskripsi/instruksi, durasi (menit).
- **FR-10** Ubah status: Draft → Buka → Tutup → Arsipkan. Tes hanya bisa dibuka jika punya minimal 1 soal dan setiap soal punya kunci jawaban.
- **FR-11** CRUD soal dalam tes: bagian (`listening`/`reading`), teks soal (mendukung karakter Mandarin), 2–5 opsi (label A–E otomatis), kunci jawaban (tepat satu), gambar opsional, audio opsional (wajib untuk listening), posisi/urutan (ubah dengan tombol naik/turun).
- **FR-12** Upload audio (mp3, maks 10 MB) dan gambar (jpg/png/webp, maks 2 MB) ke Supabase Storage. Pratinjau audio di form.
- **FR-13** Duplikat tes (menyalin soal, opsi, kunci, dan media) sebagai draft baru.
- **FR-14** Pratinjau tes sebagai murid (tanpa membuat attempt, tanpa timer).

### Admin — Hasil
- **FR-15** Dashboard: murid aktif, tes terbuka, sedang mengerjakan, selesai hari ini, serta 10 hasil terbaru.
- **FR-16** Halaman hasil: tabel semua pengerjaan dengan filter murid, tes, level, rentang tanggal, status. Kolom: murid, tes, level, mulai, selesai, durasi terpakai, benar/total, persentase, Listening, Reading, status.
- **FR-17** Detail pengerjaan: tiap soal dengan jawaban murid, kunci, benar/salah.
- **FR-18** Export CSV (UTF-8 dengan BOM agar terbaca Excel) sesuai filter aktif.
- **FR-19** Reset pengerjaan (BR-8).

### Murid
- **FR-20** Daftar tes yang `open`, dengan status per tes: "Belum dikerjakan", "Sedang berlangsung" (tombol Lanjutkan), "Selesai". Tanpa skor.
- **FR-21** Halaman instruksi: judul, level, durasi, jumlah soal per bagian, peringatan "Tes hanya dapat dikerjakan satu kali dan waktu tidak dapat dihentikan", tombol Mulai.
- **FR-22** Halaman pengerjaan: timer, navigasi nomor soal, satu soal per layar, pilih jawaban, tombol Sebelumnya/Berikutnya, tombol Kumpulkan dengan dialog konfirmasi (menyebut jumlah soal belum terjawab).
- **FR-23** Autosave tiap kali memilih jawaban. Jika gagal tersimpan, tampilkan indikator "Belum tersimpan" dan coba ulang otomatis.
- **FR-24** Saat waktu habis, kirim otomatis lalu arahkan ke halaman selesai.
- **FR-25** Halaman selesai: "Jawaban Anda telah tersimpan. Terima kasih." Tanpa skor.
- **FR-26** Perlindungan salin soal (best effort, lihat bagian 7): watermark nama murid, tanpa tombol unduh, seleksi teks dimatikan di halaman pengerjaan.

---

## 6. Model data

Semua `id` bertipe `uuid` (default `gen_random_uuid()`), waktu bertipe `timestamptz`. Nama kolom Inggris.

| Tabel | Kolom penting | Catatan |
|---|---|---|
| `profiles` | `id` (pk, = `auth.users.id`), `username` (unique), `full_name`, `role` (`admin`/`student`), `is_active`, `created_at` | Dibuat bersama user Auth |
| `tests` | `id`, `title`, `level` (1–6), `description`, `duration_minutes`, `status` (`draft`/`open`/`closed`/`archived`), `created_by`, `created_at`, `updated_at` | |
| `questions` | `id`, `test_id` → tests (cascade), `section` (`listening`/`reading`), `position` int, `prompt` text, `image_path` null, `audio_path` null | unique (`test_id`, `section`, `position`) |
| `question_options` | `id`, `question_id` → questions (cascade), `label` (`A`–`E`), `text` | unique (`question_id`, `label`) |
| `answer_keys` | `question_id` (pk, → questions cascade), `correct_option_id` → question_options | **Tabel terpisah**, hanya admin yang bisa SELECT |
| `attempts` | `id`, `test_id`, `student_id`, `started_at`, `expires_at`, `submitted_at` null, `status` (`in_progress`/`submitted`/`expired`), `correct_count`, `total_count`, `listening_correct`, `listening_total`, `reading_correct`, `reading_total` | unique (`test_id`, `student_id`); kolom skor null sampai selesai |
| `attempt_answers` | `attempt_id` → attempts (cascade), `question_id`, `selected_option_id`, `answered_at` | pk (`attempt_id`, `question_id`) |

Storage: bucket privat `question-media` (`audio/…`, `images/…`).

### Fungsi database (Postgres, `security definer`, `set search_path = public`)
- `is_admin()` — true jika user saat ini berrole admin dan aktif.
- `get_test_summary(p_test_id)` — judul, level, durasi, jumlah soal per bagian. Hanya untuk tes `open`. Tidak membuka isi soal.
- `start_attempt(p_test_id)` — membuat attempt (BR-1, BR-2) atau mengembalikan attempt `in_progress` yang ada. Menolak jika tes tidak `open`, atau murid sudah pernah mengerjakan. Mengembalikan `attempt_id`, `expires_at`, `server_now`.
- `save_answer(p_attempt_id, p_question_id, p_option_id)` — upsert jawaban jika attempt milik user, `in_progress`, dan `now() <= expires_at + 5 detik`. Memvalidasi bahwa soal dan opsi milik tes tersebut.
- `submit_attempt(p_attempt_id)` — mengunci attempt, menghitung skor dari `answer_keys`, mengisi kolom skor, status `submitted`. Idempotent.
- `finalize_expired_attempts()` — mengubah attempt `in_progress` yang lewat `expires_at` menjadi `expired` dan menghitung skornya dari jawaban tersimpan. Dipanggil saat admin membuka dashboard/hasil dan saat murid membuka daftar tes.
- `reset_attempt(p_attempt_id)` — khusus admin (BR-8).

### Prinsip RLS
- RLS aktif di **semua** tabel dan bucket.
- `profiles`: user membaca baris sendiri; admin membaca/menulis semua. Murid tidak bisa mengubah `role` atau `is_active`.
- `tests`: murid hanya SELECT tes `open` (kolom metadata). Admin penuh.
- `questions`, `question_options`: murid hanya SELECT jika punya attempt `in_progress` untuk tes itu dan `now() <= expires_at`. Admin penuh.
- `answer_keys`: hanya admin. Tidak ada policy untuk murid.
- `attempts`: murid SELECT milik sendiri, **tanpa kolom skor** (gunakan view atau column privileges, atau fungsi yang hanya mengembalikan status). Insert/update hanya lewat fungsi. Admin SELECT semua.
- `attempt_answers`: murid tidak INSERT/UPDATE langsung (hanya lewat `save_answer`); murid boleh SELECT jawaban miliknya selama `in_progress` agar bisa melanjutkan.
- Storage: tulis hanya admin. Murid mengakses media hanya lewat signed URL yang dibuat server setelah memverifikasi attempt aktif.

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
| `/admin` | admin | Dashboard |
| `/admin/students` | admin | Daftar + tambah/edit murid |
| `/admin/tests` | admin | Daftar tes |
| `/admin/tests/new` | admin | Buat tes |
| `/admin/tests/[id]` | admin | Edit tes + daftar soal |
| `/admin/tests/[id]/questions/[qid]` | admin | Form soal (`new` untuk soal baru) |
| `/admin/tests/[id]/preview` | admin | Pratinjau sebagai murid |
| `/admin/results` | admin | Tabel hasil + filter + export |
| `/admin/results/[attemptId]` | admin | Detail pengerjaan |
| `/tests` | student | Daftar tes terbuka |
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
- **AC-8** Given tes `open` ditutup admin, Then murid baru tidak melihatnya, murid `in_progress` tetap bisa menyelesaikan.
- **AC-9** Given tes sudah punya pengerjaan, When admin mencoba mengubah kunci jawaban, Then ditolak.
- **AC-10** Given admin export CSV dengan filter tes X, Then file hanya berisi pengerjaan tes X dan terbuka benar di Excel (karakter Mandarin tidak rusak).
- **AC-11** Given murid dinonaktifkan, When mencoba login, Then ditolak dengan pesan akun tidak aktif.
- **AC-12** Given halaman mana pun untuk murid, Then tidak ada skor, persentase, atau kunci jawaban di UI maupun di respons jaringan.

---

## 11. Asumsi dan hal terbuka

| Item | Asumsi v1 | Perlu konfirmasi owner |
|---|---|---|
| Skor | Jumlah benar + persentase, bukan skala resmi HSK | Ya |
| Audio | Dapat diputar ulang tanpa batas | Ya, HSK asli hanya sekali |
| Reset pengerjaan | Admin boleh me-reset | Ya |
| Buka/tutup tes | Dikontrol admin untuk menjaga tes tetap di kursus | Ya |
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
