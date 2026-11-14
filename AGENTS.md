# AGENTS.md

Sistem tes online HSK (Listening & Reading) untuk murid Bright Mandarin. Admin membuat soal dan akun murid; murid mengerjakan tes dengan batas waktu, satu kali per tes; skor otomatis dan hanya terlihat admin.

## Dokumen acuan (baca sebelum mengerjakan apa pun)
- `docs/PRD.md` — apa yang dibangun, aturan bisnis, model data, keamanan, kriteria penerimaan
- `docs/DESIGN.md` — aturan tampilan. **Wajib diikuti untuk semua UI.** Menang atas default library.

## Stack
Next.js (App Router, TypeScript strict), Tailwind CSS v4, Supabase (Postgres, Auth, Storage), zod, deploy Vercel. Package manager: npm.

## Perintah
- `npm run dev` — dev server
- `npm run lint`
- `npm run typecheck` (`tsc --noEmit`)
- `npm run build`

Setelah setiap tahap kerja, jalankan lint, typecheck, dan build. Jangan menyatakan selesai jika salah satunya gagal.

## Aturan yang tidak boleh dilanggar
1. **Kunci jawaban dan skor tidak pernah dikirim ke browser murid.** Penilaian hanya di database (`submit_attempt`).
2. **Timer dihitung di server** (`expires_at`). Tidak pernah mempercayai jam klien.
3. `SUPABASE_SERVICE_ROLE_KEY` hanya di kode server. Tidak pernah diawali `NEXT_PUBLIC_`, tidak pernah diimpor ke komponen client.
4. RLS aktif di semua tabel. Akses murid ke soal hanya lewat policy attempt aktif. Jangan menonaktifkan RLS untuk "memperbaiki" error; perbaiki policy-nya.
5. Setiap Server Action dan Route Handler memeriksa session dan role sendiri. Jangan hanya mengandalkan middleware/proxy.
6. Validasi input di server dengan zod.
7. Tidak ada gradient, bayangan kartu, radius > 6px, atau emoji di UI (lihat `docs/DESIGN.md`).
8. UI berbahasa Indonesia. Kode, nama tabel, kolom, dan variabel berbahasa Inggris.

## Konvensi kode
- TypeScript strict, tanpa `any`. Tipe database dihasilkan dari skema, bukan ditulis tangan.
- Server Components secara default; `"use client"` hanya jika perlu interaksi.
- Mutasi lewat Server Actions; hasilnya `{ ok: true, data } | { ok: false, error }`. Pesan error untuk pengguna dalam bahasa Indonesia.
- Struktur: `app/(auth)`, `app/admin`, `app/(student)`, `components/ui`, `components/admin`, `components/student`, `lib/supabase` (client, server, admin), `lib/validation`, `supabase/migrations`, `scripts`.
- Waktu disimpan UTC, ditampilkan WIB (Asia/Jakarta).
- Jangan menambah dependency di luar yang tercantum di PRD tanpa menyebutkan alasannya.

## Alur kerja
- Kerjakan per tahap sesuai prompt. Jangan mengerjakan tahap berikutnya sebelum diminta.
- Sebelum menulis kode, tulis rencana singkat: file yang akan dibuat/diubah (maks. 10 baris).
- Jika sebuah aturan di PRD ambigu atau bertentangan, berhenti dan tanyakan. Jangan menebak aturan bisnis.
- Di akhir tiap tahap, laporkan: file yang berubah, hasil lint/typecheck/build, hal yang belum dikerjakan, dan penyimpangan dari PRD/DESIGN (jika ada).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
