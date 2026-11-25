-- Perbaikan kompatibilitas soal Listening biasa saat memakai audio bersama:
-- update question tidak boleh mensyaratkan audio_path per-soal jika tes sudah
-- memiliki listening_audio_path. Action server memasang fallback ke soal.
-- Policy student shared audio sudah diterapkan oleh 0010 sebelum migrasi ini
-- dicatat; CREATE POLICY tidak diulang karena PostgreSQL tidak punya IF NOT EXISTS.
select 1;
