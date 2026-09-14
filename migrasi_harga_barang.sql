-- Migrasi Total Aset Inventory (moving-average). Jalankan 1x di Supabase SQL Editor.
-- Sudah dieksekusi manual 2026-09-11 (kolom harga_barang + harga_satuan ada di DB).
-- NULL = belum ada harga (dikecualikan dari Total Aset, bukan Rp 0).

ALTER TABLE barang_inventory
  ADD COLUMN IF NOT EXISTS harga_barang numeric NULL;

ALTER TABLE transaksi
  ADD COLUMN IF NOT EXISTS harga_satuan numeric NULL;
