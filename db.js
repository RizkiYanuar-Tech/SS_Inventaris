require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Lapisan akses Supabase (cutover REST dari Google Sheets).
// Kontrak: backend bicara ke sini; endpoint + frontend tidak berubah.
// Outlet tetap live di Google Sheets (pengecualian sadar) — bukan via modul ini.
function ambilEnv(...nama) {
  for (const n of nama) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

const SUPABASE_URL = ambilEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
const SUPABASE_KEY = ambilEnv('SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE', 'VITE_SUPABASE_SERVICE_ROLE', 'supabase_service_role');
if (!SUPABASE_URL || !SUPABASE_KEY) console.warn('db.js: ENV Supabase belum lengkap.');

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const nowIso = () => new Date().toISOString();

// id_transaksi tanpa default di DB -> max+1 sisi app (ceiling sama seperti NNN harian)
async function nextIdTransaksi() {
  const { data, error } = await sb.from('transaksi')
    .select('id_transaksi').order('id_transaksi', { ascending: false }).limit(1);
  if (error) throw new Error('nextIdTransaksi: ' + error.message);
  const max = data && data[0] ? Number(data[0].id_transaksi) : 0;
  return (Number.isFinite(max) ? max : 0) + 1;
}

// Kurang stock atomik: tulis hanya bila stock >= qty (anti oversell saat 2 approve balapan)
async function kurangStock(idBarang, qty) {
  const cur = await sb.from('barang_inventory')
    .select('jumlah_stock').eq('id_barang', idBarang).single();
  if (cur.error || !cur.data) throw new Error(`ID ${idBarang} tidak ditemukan di database.`);
  const sisa = Number(cur.data.jumlah_stock);
  if (qty > sisa) return { ok: false, sisa };
  const up = await sb.from('barang_inventory')
    .update({ jumlah_stock: sisa - qty })
    .eq('id_barang', idBarang).gte('jumlah_stock', qty)
    .select('jumlah_stock');
  if (up.error) throw new Error(up.error.message);
  if (!up.data || up.data.length === 0) return { ok: false, sisa: null }; // kalah balapan
  return { ok: true, sisa: Number(up.data[0].jumlah_stock) };
}

module.exports = { sb, nowIso, nextIdTransaksi, kurangStock };
