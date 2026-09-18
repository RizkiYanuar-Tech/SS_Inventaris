-- Relasi vendor → transaksi. Jalankan 1x di Supabase SQL Editor.
-- Prasyarat: vendor.id sudah identity PK (integer). Kode app pengisi id_vendor menyusul
-- setelah SQL ini hijau (sebelum itu kolom dibiarkan NULL, API tetap jalan).
-- Baris lama "Vendor: X" (teks snapshot di keterangan) tetap tampil apa adanya.

-- 1) Kolom FK (nullable: Masuk lama/baru tanpa vendor + Keluar/Opname = NULL).
ALTER TABLE transaksi
  ADD COLUMN IF NOT EXISTS id_vendor INT NULL;
-- Catatan tipe: bila vendor.id BIGINT (cek: SELECT format_type(a.atttypid, a.atttypmod)
-- FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
-- WHERE c.relname = 'vendor' AND a.attname = 'id';), ganti INT di atas menjadi BIGINT.

-- 2) Constraint FK (idempotent; ON DELETE SET NULL = hapus vendor tak merusak history,
-- teks "Vendor: X" di keterangan tetap menjadi jejak audit).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaksi_id_vendor_fkey') THEN
    ALTER TABLE transaksi
      ADD CONSTRAINT transaksi_id_vendor_fkey
      FOREIGN KEY (id_vendor) REFERENCES vendor(id)
      ON DELETE SET NULL;
  END IF;
END $$;
-- Alternatif RESTRICT (hapus vendor ditolak bila dipakai transaksi — konsisten pola
-- barang 409): DROP CONSTRAINT bila perlu, lalu buat ulang dengan ON DELETE RESTRICT.

-- 3) Index untuk filter/laporan per vendor.
CREATE INDEX IF NOT EXISTS idx_transaksi_id_vendor ON transaksi(id_vendor);

-- 4) Backfill: cocokkan baris lama "Vendor: X" ke vendor.id by nama persis.
-- Tak-cocok (vendor dihapus/di-rename) tetap NULL — histori teksnya tidak hilang.
UPDATE transaksi t
SET id_vendor = v.id
FROM vendor v
WHERE t.id_vendor IS NULL
  AND t.keterangan LIKE 'Vendor: %'
  AND v.nama_vendor = TRIM(SUBSTRING(t.keterangan FROM 9));

-- 5) Verifikasi (jalankan, pastikan 0 baris tak-cocok di luar dugaan):
SELECT COUNT(*) AS total, COUNT(id_vendor) AS berelasi FROM transaksi;
SELECT t.id_transaksi, t.keterangan, t.id_vendor
FROM transaksi t
WHERE t.keterangan LIKE 'Vendor: %' AND t.id_vendor IS NULL
LIMIT 20;
