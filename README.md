# Sistem Tes Online HSK — Bright Mandarin

Aplikasi tes HSK (Listening & Reading) untuk murid Bright Mandarin. Owner mengelola
guru, murid, tes, dan penugasan; guru mengelola tes miliknya dan murid yang diampu.
Murid login, mengerjakan tes sekali dengan batas waktu, lalu submit. Skor dihitung
di server dan hanya terlihat owner serta guru yang mengampu murid tersebut.

Dokumen acuan:

- `docs/PRD.md` — aturan bisnis, model data, kriteria penerimaan
- `docs/DESIGN.md` — aturan tampilan
- `docs/DB-NOTES.md` — skema, RLS, fungsi database
- `docs/verification.sql` — query verifikasi RLS manual
- `AGENTS.md` — aturan kerja proyek

## Stack

- Next.js 16 (App Router, TypeScript strict), React 19
- Tailwind CSS v4
- Supabase: Postgres, Auth, Storage (`@supabase/ssr`, `@supabase/supabase-js`)
- zod untuk validasi server
- Deploy: Vercel (Hobby) + Supabase (Free)

## Prasyarat

- Node.js 20.9 atau lebih baru
- npm
- Project Supabase (Free)

## Setup lokal

1. Install dependency:

   ```bash
   npm install
   ```

2. Salin environment:

   ```bash
   cp .env.example .env.local
   ```

   Isi nilainya (lihat tabel di bawah). `.env.local` tidak pernah di-commit.

3. Jalankan migrasi database secara berurutan di Supabase Dashboard → SQL Editor:

   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_admin_functions.sql`
   3. `supabase/migrations/0003_student_access.sql`
   4. `supabase/migrations/0004_allow_question_text_edits_after_attempts.sql`
   5. `supabase/migrations/0005_allow_test_level_and_duration_edits.sql`
   6. `supabase/migrations/0006_multi_teacher_owner.sql`

   Alternatif dengan Supabase CLI:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   Migrasi `0001` juga membuat bucket privat `question-media`.

4. Atur Supabase Auth (manual, sekali saja):

   - Authentication → Sign In / Providers → matikan **Allow new users to sign up**.
   - Authentication → Providers → Email → matikan **Confirm email** (email sintetis
     tidak bisa menerima email konfirmasi).
   - Pastikan Site URL mengarah ke domain aplikasi (lokal: `http://localhost:3000`).

5. Buat akun owner:

   ```bash
   npm run seed:admin
   ```

   Script membaca `ADMIN_SEED_USERNAME` dan `ADMIN_SEED_PASSWORD`, membuat user
   Auth dengan email `<username>@<STUDENT_EMAIL_DOMAIN>`, lalu upsert profil
   `role = admin` (alias owner). Akun guru dibuat owner lewat UI `/admin/teachers`.
   Aman dijalankan ulang (password owner diperbarui).

6. (Opsional) Isi data demo untuk pengembangan:

   ```bash
   npm run seed:demo
   ```

   Membuat tes "HSK 1 — Latihan Demo" berstatus `open` dan tiga murid demo
   (`demo.murid1`–`demo.murid3`, password `Demo12345`). Script menolak berjalan
   saat `NODE_ENV=production`.

7. Jalankan dev server:

   ```bash
   npm run dev
   ```

   Buka `http://localhost:3000`. Halaman `/dev/styleguide` menampilkan komponen UI
   (hanya untuk pengembangan).

## Environment variables

| Variable | Wajib | Dipakai di | Catatan |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ya | client & server | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | client & server | anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | ya (server) | server actions, route handler, script | **Jangan** pernah diberi prefix `NEXT_PUBLIC_` |
| `STUDENT_EMAIL_DOMAIN` | ya | server, script | Domain email sintetis, default `students.brightmandarin.local` |
| `STORAGE_QUOTA_BYTES` | tidak | server | Kuota penyimpanan untuk kartu dashboard. Default `1073741824` (1 GB, Supabase Free). |
| `ADMIN_SEED_USERNAME` | untuk `seed:admin` | script | 3–30 karakter: huruf kecil, angka, titik, garis bawah |
| `ADMIN_SEED_PASSWORD` | untuk `seed:admin` | script | Minimal 8 karakter |
| `TEST_STUDENT_USERNAME` / `TEST_STUDENT_PASSWORD` | untuk `verify:security` | script | Akun murid uji |
| `TEST_INACTIVE_USERNAME` / `TEST_INACTIVE_PASSWORD` | opsional | script | Akun nonaktif untuk uji AC-11 |
| `TEST_ADMIN_USERNAME` / `TEST_ADMIN_PASSWORD` | opsional | script | Akun owner/admin uji |

Catatan: jika Supabase menolak domain email sintetis, ganti
`STUDENT_EMAIL_DOMAIN` dengan domain lain yang valid secara format (mis.
`students.example.com`) sebelum membuat akun. Semua akun harus memakai domain
yang sama.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Build produksi |
| `npm run start` | Jalankan hasil build |
| `npm run seed:admin` | Buat/perbarui akun owner (role `admin`) |
| `npm run seed:demo` | Data demo (hanya non-production) |
| `npm run verify:security` | Uji AC keamanan terhadap project Supabase nyata |

Jalankan `lint`, `typecheck`, dan `build` sebelum menyatakan pekerjaan selesai.
Hentikan dev server sebelum `npm run build` agar worker build tidak bentrok.

## Verifikasi keamanan

`npm run verify:security` login sebagai murid uji memakai anon key dan memeriksa:

- `answer_keys` tidak terbaca murid (AC-2)
- `questions` tidak terbaca tanpa attempt aktif (AC-3)
- `attempts` / kolom skor tidak terbaca murid, view status tanpa skor (AC-12)
- `start_attempt` ulang ditolak setelah selesai (AC-5)
- akun nonaktif ditolak login (AC-11)
- `reset_attempt` dan insert langsung `attempts` / `attempt_answers` ditolak
- upload media oleh murid ditolak
- pendaftaran publik ditolak
- owner uji dapat membaca `answer_keys`

Siapkan dulu akun uji lewat UI owner, isi `TEST_*` di `.env.local`, lalu jalankan.
Pemeriksaan yang butuh project nyata akan dilewati (status `LEWATI`) jika datanya
belum ada. Verifikasi RLS tambahan, termasuk isolasi antar-guru, tersedia di
`docs/verification.sql`.

## Struktur proyek

```text
app/(auth)/login          Login
app/admin                 Dashboard, guru, murid, tes, soal, hasil
app/admin/teachers        Daftar & detail guru, penugasan murid
app/(exam)/tests/[id]/take Halaman pengerjaan (tanpa shell murid)
app/(student)/tests       Daftar tes, instruksi, selesai
app/api/media             Signed URL media (server, no-store)
components/ui             Komponen dasar sesuai DESIGN.md
components/admin          Komponen admin/guru
components/student        Komponen murid
lib/supabase              client, server, admin, proxy, tipe database
lib/validation            Skema zod
supabase/migrations       Skema, RLS, fungsi, storage
scripts                   Seed owner, seed demo, verifikasi keamanan
proxy.ts                  Refresh sesi Supabase (pengganti middleware)
```

## Alur utama

1. Owner membuat akun guru, lalu menugaskan murid ke guru. Satu murid hanya
   memiliki satu guru aktif; mutasi murid mengakhiri relasi lama tanpa menghapus
   riwayat hasil.
2. Owner atau guru membuat tes (`draft`), menambah soal Listening/Reading beserta
   opsi, kunci, dan media. Tes dapat ditugaskan ke beberapa guru; tes owner tanpa
   penugasan berlaku sebagai tes global.
3. Tes dibuka jika punya minimal satu soal dan semua soal punya kunci. Setelah ada
   pengerjaan, struktur soal, media, jumlah opsi, dan durasi terkunci; teks soal,
   teks opsi, dan kunci masih dapat diperbaiki dengan konsekuensi skor dihitung
   ulang (BR-6).
4. Murid membuka `/tests`, membaca instruksi, menekan Mulai. `start_attempt`
   membuat attempt dengan `expires_at` dari jam server.
5. Halaman pengerjaan memuat semua soal sekali, menyimpan jawaban lewat
   `save_answer`, dan memakai timer berbasis `expires_at` server.
6. Saat waktu habis atau murid mengumpulkan, `submit_attempt` menghitung skor dari
   `answer_keys`. Murid melihat halaman selesai tanpa skor.
7. Owner melihat KPI tiap guru, seluruh hasil, detail per soal, dan export CSV.
   Guru hanya melihat murid yang diampu, hasil mereka, dan tes yang dapat diakses;
   guru dapat me-reset pengerjaan muridnya.

## Deploy ke Vercel

1. Push repo ke GitHub, lalu import ke Vercel.
2. Tambahkan environment variables yang sama seperti `.env.local` (Production,
   Preview, Development). `SUPABASE_SERVICE_ROLE_KEY` hanya sebagai server env,
   bukan `NEXT_PUBLIC_`.
3. Deploy. Setelah domain final diketahui, perbarui **Site URL** dan **Redirect
   URLs** di Supabase Auth.
4. Jalankan migrasi pada project Supabase produksi dan `npm run seed:admin` dengan
   environment produksi (dari mesin lokal, bukan di build Vercel).
5. Pastikan signup publik tetap mati dan konfirmasi email tetap nonaktif.

## Batasan yang diketahui

- **Supabase Free di-pause setelah ±1 minggu tanpa aktivitas.** Buka dashboard
  Supabase secara berkala atau upgrade saat dipakai rutin.
- Perlindungan salin soal bersifat *best effort*: watermark nama murid,
  `user-select: none`, audio tanpa unduh. Screenshot/foto layar tidak bisa dicegah
  (SEC-8).
- Reset password murid dilakukan owner lewat UI; tidak ada reset lewat email.
- Tidak ada halaman pendaftaran publik. Akun owner dibuat lewat `seed:admin`;
  akun guru dan murid dibuat owner lewat UI.
- Timer memakai `expires_at` server. Mengubah jam perangkat tidak berpengaruh.
- Skor adalah jumlah benar dan persentase, bukan skala resmi HSK.
