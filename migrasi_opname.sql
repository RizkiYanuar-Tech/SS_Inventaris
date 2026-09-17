-- Opname sesi massal (sesi 1): jejak transaksi + tabel sesi. Jalankan sekali di Supabase SQL editor.
-- Idempotent: aman di-run ulang (IF NOT EXISTS / DO block).

-- Jejak opname per baris transaksi (diisi 'Opname #SOP-...' saat putus;
-- transaksi lama = '' ). Kolom ini belum ada di DB baru.
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS keterangan TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS opname_sesi (
  id_sesi TEXT PRIMARY KEY,               -- SOP-YYYYMMDD-NNN
  status TEXT NOT NULL DEFAULT 'HITUNG',  -- HITUNG / REVIEW / SELESAI / BATAL
  dibuat_pada TIMESTAMPTZ DEFAULT now(),
  ditutup_pada TIMESTAMPTZ NULL
);

-- Satu baris per barang per sesi. Tanpa FK ke barang (konsisten dgn
-- pesanan/pengiriman yang referensi by-ID di app-layer); arsip sesi
-- ikut hilang bila sesi dihapus (CASCADE), bukan bila barang dihapus.
CREATE TABLE IF NOT EXISTS opname_item (
  id_sesi TEXT NOT NULL REFERENCES opname_sesi (id_sesi) ON DELETE CASCADE,
  id_barang TEXT NOT NULL,
  sistem_qty NUMERIC NOT NULL,   -- snapshot stock saat sesi dibuka
  sistem_harga NUMERIC NULL,     -- snapshot avg saat sesi dibuka
  fisik_qty NUMERIC NULL,        -- hitungan gudang (NULL = belum dihitung)
  PRIMARY KEY (id_sesi, id_barang)
);
