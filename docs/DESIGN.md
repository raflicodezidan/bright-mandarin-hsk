# DESIGN.md — Aturan Tampilan

Berlaku untuk **semua** halaman admin dan murid. Tujuan: rapi, profesional, tenang, mudah dipindai. Bukan tampilan "template AI".

Jika ada konflik antara kebiasaan bawaan library (shadcn, Tailwind, Radix) dan dokumen ini, **dokumen ini menang**.

---

## 1. Prinsip

1. **Institusional, bukan dekoratif.** Tampilan seperti sistem akademik yang terawat: datar, jelas, teratur.
2. **Konten dulu.** Soal Mandarin, tabel hasil, dan form adalah bintangnya. UI hanya membingkai.
3. **Hierarki lewat tipografi dan spasi**, bukan lewat warna, bayangan, atau gradient.
4. **Konsisten.** Satu pola untuk satu kebutuhan. Halaman baru harus terlihat satu keluarga dengan halaman lama.
5. **Kepribadian dari presisi**, bukan hiasan: pasangan font yang tepat, satu warna aksen yang dipakai disiplin, karakter Mandarin yang ditampilkan dengan font CJK yang bagus, dan logo klien saat tersedia.

## 2. Dilarang

- Gradient dalam bentuk apa pun (background, tombol, teks, border, overlay). Semua warna solid.
- Radius lebih dari 6px. Tidak ada kartu bulat besar, tombol pill, atau avatar kotak membulat besar.
- Bayangan di kartu. Pakai border 1px. Bayangan hanya untuk dialog dan dropdown (lihat 3.5).
- Glassmorphism, blur, blob, pola dekoratif, ilustrasi, atau stok foto.
- Emoji sebagai ikon atau di teks UI.
- Kartu dengan garis warna tebal di sisi kiri atau atas.
- Lingkaran ikon berwarna di atas angka statistik.
- Hero section, teks besar di tengah, tagline marketing di dalam aplikasi.
- Warna ungu/indigo/biru-ungu bawaan, atau palet default Tailwind (`blue-600`, `slate-50`, dst) dipakai apa adanya.
- Animasi masuk, parallax, atau efek hover yang menggeser layout. Transisi maksimal 150 ms.
- Salam seperti "Selamat datang kembali!" atau copy yang ramah berlebihan.

## 3. Token

### 3.1 Warna

Ganti nilai dengan palet brand klien saat tersedia, **nama token tetap**.

| Token | Hex | Pemakaian |
|---|---|---|
| `bg` | `#F6FAF6` | Latar halaman |
| `surface` | `#FFFFFF` | Kartu, tabel, form, dialog |
| `surface-muted` | `#EEF5EE` | Header tabel, area sekunder |
| `border` | `#DCE6DC` | Border default |
| `border-strong` | `#BFCFC0` | Border input, pemisah penting |
| `text` | `#1A1A1A` | Teks utama |
| `text-muted` | `#4F5F50` | Teks sekunder, label |
| `primary` | `#2E7D32` | Tombol utama, link, item nav aktif, fokus |
| `primary-hover` | `#1B5E20` | Hover tombol utama |
| `primary-subtle` | `#E8F5E9` | Latar item nav aktif, soal terjawab |
| `accent` | `#B3262B` | **Hemat.** Timer di bawah 5 menit, aksi destruktif, error |
| `accent-subtle` | `#FBEAEA` | Latar alert error |
| `success` / `success-subtle` | `#2E7D32` / `#E8F5E9` | Status selesai, alert sukses |
| `warning` / `warning-subtle` | `#8A5A00` / `#FFF4DC` | Status berlangsung, peringatan |

Aturan: maksimal satu warna non-netral dominan per layar (`primary`). `accent` tidak dipakai untuk dekorasi. Status tidak boleh hanya berbeda warna; selalu ada teks.

### 3.2 Tipografi

- Sans: **Poppins** (Latin) dengan fallback **Noto Sans SC** untuk karakter Mandarin, lalu `system-ui`.
- Mono: **IBM Plex Mono** untuk timer, skor, nomor soal. Selalu `font-variant-numeric: tabular-nums`.
- Muat lewat `next/font/google`. Noto Sans SC: `preload: false`, bobot 400 dan 500.

| Peran | Ukuran / line-height | Bobot |
|---|---|---|
| Judul halaman (h1) | 24 / 32 | 600 |
| Judul bagian (h2) | 18 / 28 | 600 |
| Judul kartu (h3) | 16 / 24 | 600 |
| Body admin | 14 / 20 | 400 |
| Body murid | 16 / 24 | 400 |
| Teks soal (Mandarin) | 22 / 36 | 400 |
| Opsi jawaban (Mandarin) | 20 / 32 | 400 |
| Label, caption, header tabel | 13 / 18 | 500 |
| Timer | 20 / 28 mono | 500 |

Hanya bobot 400, 500, 600. Tidak ada huruf kapital semua. Penulisan sentence case.

### 3.3 Spasi

Basis **4px**. Hanya pakai skala ini: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

| Konteks | Nilai |
|---|---|
| Padding halaman (≥ 1024 / 640–1023 / < 640) | 32 / 24 / 16 |
| Jarak antar bagian dalam halaman | 32 |
| Jarak header halaman → konten | 24 |
| Judul → deskripsi di header halaman | 8 |
| Padding kartu | 24 (16 di dalam kartu padat / mobile) |
| Antar field dalam form | 16 |
| Label → input | 8 |
| Input → teks bantuan/error | 4 |
| Antar tombol dalam satu grup | 12 |
| Padding sel tabel | 12 vertikal, 16 horizontal; tinggi baris 48 |
| Antar kartu dalam grid | 16 |
| Ikon → label di tombol | 8 |

Lebar maksimum konten: admin 1200, form 640, daftar murid 800, area soal 720.
Breakpoint: `640`, `1024`.

### 3.4 Bentuk

- Radius: **4px** untuk input, tombol, badge; **6px** untuk kartu, tabel, dialog. Tidak ada nilai lain.
- Border: 1px solid `border` (kartu, tabel), `border-strong` (input).
- Fokus: outline 2px `primary`, offset 2px, selalu terlihat. Jangan dihapus.

### 3.5 Elevasi

Datar. Satu-satunya bayangan: dialog dan dropdown `0 4px 16px rgba(0,0,0,0.08)`. Backdrop dialog `rgba(26,26,26,0.4)`, tanpa blur.

### 3.6 Snippet token (Tailwind v4, `app/globals.css`)

```css
@import "tailwindcss";

@theme {
  --color-bg: #F6FAF6;
  --color-surface: #FFFFFF;
  --color-surface-muted: #EEF5EE;
  --color-border: #DCE6DC;
  --color-border-strong: #BFCFC0;
  --color-text: #1A1A1A;
  --color-text-muted: #4F5F50;
  --color-primary: #2E7D32;
  --color-primary-hover: #1B5E20;
  --color-primary-subtle: #E8F5E9;
  --color-accent: #B3262B;
  --color-accent-subtle: #FBEAEA;
  --color-success: #2E7D32;
  --color-success-subtle: #E8F5E9;
  --color-warning: #8A5A00;
  --color-warning-subtle: #FFF4DC;

  --radius-sm: 4px;
  --radius-md: 6px;

  --font-sans: var(--font-poppins), var(--font-noto-sc), system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;
}
```

## 4. Layout

### 4.1 Admin (`AdminShell`)
- Sidebar kiri 240px, latar `surface`, border kanan 1px. Atas: nama "Bright Mandarin" (teks, atau logo klien) dan label "Admin". Menu: Dashboard, Murid, Tes, Hasil. Bawah: nama user + tombol Keluar.
- Item menu tinggi 40, ikon 16 (set ikon konsisten, satu saja, mis. `lucide-react` dengan stroke 1.5) + label. Aktif: latar `primary-subtle`, teks `primary`, bobot 500. Tanpa garis sisi.
- Di bawah 1024px sidebar menjadi top bar 56px dengan tombol menu yang membuka drawer.
- Konten: latar `bg`, padding sesuai 3.3, lebar maksimum 1200.
- Setiap halaman diawali `PageHeader`: h1 di kiri, aksi utama di kanan (satu tombol primary maksimal), deskripsi opsional di bawah h1.

### 4.2 Murid (`StudentShell`)
- Top bar 56px, latar `surface`, border bawah 1px. Kiri: "Bright Mandarin". Kanan: nama murid + Keluar.
- Konten satu kolom di tengah, maks 800. Tanpa sidebar.

### 4.3 Halaman pengerjaan (`/tests/[id]/take`)
- Header lengket 56px: judul tes (kiri), timer (kanan, mono 20), progres "12 dari 40 terjawab" di antaranya atau di bawahnya pada mobile.
- Desktop: dua kolom. Kiri area soal (maks 720). Kanan panel navigasi 280px (grid nomor soal 6 kolom, kotak 40×40).
- Mobile: panel navigasi menjadi dialog yang dibuka tombol "Daftar soal".
- Status nomor: belum dijawab (border, latar `surface`), terjawab (latar `primary-subtle`, teks `primary`), aktif (outline 2px `primary`).
- Kartu soal: nomor "Soal 12" (13/500 muted), bagian ("Listening"/"Reading") sebagai teks muted, teks soal, audio, gambar, lalu opsi.
- Opsi jawaban: daftar vertikal, tiap opsi satu baris penuh, tinggi minimal 48 (56 di mobile), label huruf di kotak 32×32, border 1px; terpilih = border 2px `primary` + latar `primary-subtle`. Seluruh baris bisa diklik. Navigasi keyboard: `A`–`E` memilih, panah kiri/kanan pindah soal.
- Timer: normal `text`; di bawah 5 menit `accent`. Tanpa animasi berkedip.
- Watermark nama murid: teks `rgba(26,26,26,0.06)` diulang diagonal di atas area soal, `pointer-events: none`, tidak mengganggu keterbacaan.
- Tombol bawah: Sebelumnya (secondary), Berikutnya (primary). Tombol Kumpulkan (primary) di header atau panel navigasi, bukan menggantikan Berikutnya.

## 5. Konvensi komponen

Semua komponen ada di `components/ui/`, bertipe ketat, dan punya state lengkap: default, hover, focus, disabled, loading (bila relevan), error (bila relevan).

| Komponen | Aturan |
|---|---|
| **Button** | Varian: `primary` (latar primary, teks putih), `secondary` (surface + border-strong), `ghost` (tanpa border), `danger` (latar accent, teks putih; dipakai hanya di dialog konfirmasi hapus). Ukuran: `sm` 32, `md` 40 (default), `lg` 48 (murid). Radius 4. Label sentence case, kata kerja ("Simpan", "Tambah murid"). Loading: spinner 16 menggantikan ikon, tombol disabled, label tetap. Satu `primary` per area. |
| **Input / Textarea / Select** | Tinggi 40 (textarea min 96), border `border-strong`, radius 4, padding horizontal 12. Placeholder `text-muted`, bukan pengganti label. Error: border `accent`, pesan di bawah 13px `accent`. |
| **Field** | Label di atas (13/500), penanda wajib "*" setelah label, teks bantuan 13 muted di bawah input. |
| **Card** | `surface`, border 1px, radius 6, padding 24. Judul h3 opsional; garis pemisah 1px di bawah judul hanya jika kartu berisi tabel/form panjang. |
| **Table** | Pembungkus: kartu tanpa padding. Header: `surface-muted`, 13/600 muted, sticky. Tanpa zebra. Hover baris `surface-muted`. Angka rata kanan, `tabular-nums`. Kolom aksi di ujung kanan: tombol `ghost` ikon dengan `aria-label` dan tooltip, atau menu "⋯" jika lebih dari 2 aksi. Pagination di bawah, 25 baris. Bilah filter di atas tabel, satu baris. |
| **Badge** | Radius 4, 12/500, padding 2×8, latar subtle + teks solid. Pemetaan: `draft` netral, `open` success, `closed` netral, `archived` netral muted, `in_progress` warning, `submitted` success, `expired` accent. Teks status selalu terbaca ("Dibuka", "Selesai", "Waktu habis"). |
| **Dialog** | Lebar 480 (konfirmasi) atau 640 (form). Judul, isi, aksi di kanan bawah (Batal = secondary kiri, aksi utama kanan). Dialog hapus menyebut nama objek dan akibatnya. Tutup dengan Esc. Fokus terkunci di dalam. |
| **Toast** | Kanan atas, 4 detik, satu baris, tanpa ikon besar. Sukses dan error. |
| **Alert** | Inline: latar subtle, border 1px warna terkait, teks `text`. Tanpa garis sisi tebal. |
| **EmptyState** | Judul 16/600 + satu kalimat + satu tombol. Tanpa ilustrasi. |
| **Skeleton** | Blok `surface-muted` radius 4 sebagai pengganti konten saat loading. Spinner penuh halaman dilarang. |
| **PageHeader** | Lihat 4.1. |
| **StatCard** | Label 13 muted, angka 28 mono 600, di dalam Card. Tanpa ikon. Grid 4 kolom ≥ 1024, 2 kolom di bawahnya. |
| **Form layout** | Satu kolom, lebar maks 640, jarak antar field 16, tombol Simpan/Batal di bawah, rata kiri. Form panjang dibagi dengan h2 dan jarak 32. |

## 6. Teks (copy)

- Bahasa Indonesia baku dan ringkas. Tanpa emoji. Sentence case. Tanpa tanda seru.
- Tombol memakai kata kerja: "Simpan", "Buka tes", "Mulai tes", "Kumpulkan jawaban".
- Error: apa yang terjadi + apa yang harus dilakukan. Contoh: "Gagal menyimpan. Periksa koneksi, lalu coba lagi."
- Dialog destruktif: "Hapus murid Andi? Riwayat hasil akan hilang." Tombol: "Hapus" dan "Batal".
- Tanggal: `13 Nov 2026, 14.05 WIB`. Durasi: `35 menit`. Persentase: `82%`.
- Status kosong: "Belum ada tes. Buat tes pertama." (judul + kalimat + tombol).

## 7. Aksesibilitas

- Kontras teks minimal 4.5:1, komponen UI minimal 3:1.
- Semua kontrol bisa dioperasikan keyboard. Urutan tab logis.
- Target sentuh minimal 40px (48px di halaman pengerjaan mobile).
- Ikon-saja wajib `aria-label`.
- `prefers-reduced-motion` dihormati.
- Timer: elemen terlihat tidak diumumkan tiap detik; gunakan region `aria-live="polite"` terpisah yang hanya diperbarui pada 5 menit dan 1 menit tersisa.
- Audio: kontrol native, `controlsList="nodownload"`, label jelas "Audio soal 12".

## 8. Checklist per halaman (wajib lolos sebelum dianggap selesai)

- [ ] Satu `h1`, memakai pola `PageHeader` (admin) atau judul 24/600 (murid)
- [ ] Hanya memakai token warna, spasi, dan radius di atas (tidak ada nilai ad-hoc)
- [ ] Tidak ada gradient, bayangan kartu, radius > 6, atau emoji
- [ ] State loading (skeleton), kosong, dan error ada
- [ ] Tidak ada scroll horizontal di lebar 375px; tabel besar discroll di dalam wadahnya
- [ ] Fokus keyboard terlihat di semua kontrol
- [ ] Teks Indonesia, sesuai aturan copy
- [ ] Murid: tidak ada skor, persentase, atau kunci jawaban di UI
