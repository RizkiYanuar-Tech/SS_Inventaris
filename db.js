require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Lapisan akses Supabase (5 tabel). Kontrak: backend bicara ke sini.
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

// Kurang stock atomik: tulis hanya bila stock >= qty (anti oversell saat 2 approve balapan)
async function kurangStock(idBarang, qty) {
  const cur = await sb.from('barang_inventory')
    .select('total').eq('id_barang', idBarang).single();
  if (cur.error || !cur.data) throw new Error(`ID ${idBarang} tidak ditemukan di database.`);
  const sisa = Number(cur.data.total);
  if (qty > sisa) return { ok: false, sisa };
  const up = await sb.from('barang_inventory')
    .update({ total: sisa - qty })
    .eq('id_barang', idBarang).gte('total', qty)
    .select('total');
  if (up.error) throw new Error(up.error.message);
  if (!up.data || up.data.length === 0) return { ok: false, sisa: null }; // kalah balapan
  return { ok: true, sisa: Number(up.data[0].total) };
}

module.exports = { sb, nowIso, kurangStock };
