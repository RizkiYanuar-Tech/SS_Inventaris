// Lapisan data bersama: ID-helpers + cari/simpan + mapper + transaksi + notifikasi + buatPengiriman.
// Potong-pindah murni dari server.js lama. Satu-satunya requirer db.js selain routes.
const crypto = require('crypto');
const { sb, nowIso, kurangStock } = require('../../db');
const { jakartaParts, formatWaktuBukti } = require('./waktu');
const { buatRingkasanKirim, tambahRiwayat } = require('./ringkas');
const { parseKonversi, kanonikSatuan } = require('./konversi');

async function initDb() {
  for (const t of ['barang_inventory', 'transaksi', 'pesanan', 'pengiriman', 'outlet']) {
    const r = await sb.from(t).select('*', { count: 'exact', head: true });
    if (r.error) throw new Error(`Tabel Supabase "${t}" tak terbaca: ${r.error.message}`);
  }
  console.log('Supabase terhubung (5 tabel).');
}
// ID Kirim: KRM-YYYYMMDD-NNN (NNN = urutan hari itu; hitung via prefix di DB)
async function buatIdKirim() {
  const today = jakartaParts(new Date()).ymd.replaceAll('-', '');
  const r = await sb.from('pengiriman').select('id_kirim', { count: 'exact', head: true }).like('id_kirim', `KRM-${today}%`);
  if (r.error) throw new Error(r.error.message);
  return `KRM-${today}-${String((r.count || 0) + 1).padStart(3, '0')}`;
}

// Tambah barang baru (id opsional -> auto MNL urut global; tanpa kolom ID di UI manual)
async function buatIdBarang() {
  for (let i = 0; i < 10; i++) {
    const r = await sb.from('barang_inventory').select('id_barang', { count: 'exact', head: true }).like('id_barang', 'MNL-%');
    if (r.error) throw new Error(r.error.message);
    const calon = `MNL-${String((r.count || 0) + 1 + i).padStart(4, '0')}`;
    const cek = await sb.from('barang_inventory').select('id_barang').eq('id_barang', calon).maybeSingle();
    if (cek.error) throw new Error(cek.error.message);
    if (!cek.data) return calon;
  }
  throw new Error('Gagal generate ID barang, coba lagi.');
}

async function buatIdPesan() {
  const today = jakartaParts(new Date()).ymd.replaceAll('-', '');
  const r = await sb.from('pesanan').select('id_pesan', { count: 'exact', head: true }).like('id_pesan', `PSN-${today}%`);
  if (r.error) throw new Error(r.error.message);
  return `PSN-${today}-${String((r.count || 0) + 1).padStart(3, '0')}`;
}

async function cariPengiriman(cari, byToken = false) {
  const col = byToken ? 'token' : 'id_kirim';
  const r = await sb.from('pengiriman').select('*').eq(col, String(cari).trim()).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return r.data || null;
}

function pengirimanKeJson(row, untukOutlet = false) {
  let items = row.items_json;
  if (typeof items === 'string') { try { items = JSON.parse(items || '[]'); } catch { items = []; } }
  if (!Array.isArray(items)) items = [];
  const data = {
    idKirim: row.id_kirim,
    idPesan: row.id_pesan || '-',
    outlet: row.outlet,
    tglBuat: row.tanggal_buat,
    tglKirim: row.tanggal_kirim || null,
    status: row.status,
    items,
    ringkasan: row.ringkasan || '',
    alasan: row.alasan || '',
    namaPenerima: row.nama_penerima || null,
    tglTerima: row.tanggal_terima || null,
    fotoKirim: row.foto_kirim || null,
    fotoTerima: row.foto_terima || null,
  };
  if (!untukOutlet) {
    data.riwayat = row.riwayat_status || '';
    data.token = row.token || null;
  }
  return data;
}

async function simpanPengiriman(row) {
  const payload = {
    token: row.token, tanggal_kirim: row.tanggal_kirim, status: row.status,
    items_json: row.items_json, ringkasan: row.ringkasan, alasan: row.alasan,
    nama_penerima: row.nama_penerima, tanggal_terima: row.tanggal_terima,
    riwayat_status: row.riwayat_status,
  };
  // ponytail: kolom foto menyusul via SQL user; tulis best-effort agar API tetap jalan tanpanya
  if (row.foto_kirim !== undefined) payload.foto_kirim = row.foto_kirim || null;
  if (row.foto_terima !== undefined) payload.foto_terima = row.foto_terima || null;
  let r = await sb.from('pengiriman').update(payload).eq('id_kirim', row.id_kirim).select();
  if (r.error && /foto/i.test(r.error.message || '')) {
    delete payload.foto_kirim; delete payload.foto_terima;
    r = await sb.from('pengiriman').update(payload).eq('id_kirim', row.id_kirim).select();
  }
  if (r.error) throw new Error(r.error.message);
  return r.data[0];
}

// Auth link permanen: token saja, slug diabaikan (PRD seksi 6). Outlet di Supabase.
async function cariOutletByToken(token) {
  const r = await sb.from('outlet').select('*').eq('token', String(token || '').trim()).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return r.data || null;
}

function pesananKeJson(row, linkTerima = null, foto = {}) {
  let items = row.items_json;
  if (typeof items === 'string') { try { items = JSON.parse(items || '[]'); } catch { items = []; } }
  if (!Array.isArray(items)) items = [];
  return {
    idPesan: row.id_pesan,
    outlet: row.outlet,
    tanggalPesan: row.tanggal_pemesanan,
    batchMasuk: row.tanggal_pemesanan,
    rencanaKirim: row.tanggal_pengiriman,
    status: row.status,
    items,
    ringkasan: row.ringkasan || '',
    dibuatPada: row.dibuat_pada || null,
    linkTerima,
    fotoKirim: foto.fotoKirim || null,
    fotoTerima: foto.fotoTerima || null,
  };
}

async function cariPesanan(idPesan) {
  const r = await sb.from('pesanan').select('*').eq('id_pesan', String(idPesan || '').trim()).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return r.data || null;
}

async function simpanPesanan(row) {
  const r = await sb.from('pesanan').update({
    status: row.status, items_json: row.items_json, ringkasan: row.ringkasan,
    riwayat_status: row.riwayat_status,
  }).eq('id_pesan', row.id_pesan).select();
  if (r.error) throw new Error(r.error.message);
  return r.data[0];
}

// Mirror status Pesanan dari peristiwa Pengiriman (best-effort: gagal mirror tak menggagalkan op utama;
// sumber kebenaran operasional tetap Pengiriman; skip untuk susulan tanpa id_pesan).
async function mirrorPesanan(idPesan, status, catatan) {
  try {
    if (!idPesan || String(idPesan).trim() === '' || String(idPesan).trim() === '-') return;
    const p = await cariPesanan(idPesan);
    if (!p) return;
    await simpanPesanan({ ...p, status, riwayat_status: tambahRiwayat(p.riwayat_status, catatan) });
  } catch (e) { console.warn('mirrorPesanan gagal:', e.message); }
}

async function catatTransaksi(id, nama, varian, kategori, jenis_transaksi, jumlah, satuan, hargaSatuan = null, idKirim = null, keterangan = null) {
  const tulis = async (pakaiHarga, pakaiKirim, pakaiKet) => {
    const baris = {
      id_barang: id,
      nama_barang: nama,
      varian: varian || '',
      kategori_bahan: kategori || '',
      jenis: jenis_transaksi,
      jumlah: Number(jumlah),
      satuan: kanonikSatuan(satuan) || 'pcs',
      dibuat_pada: nowIso(),
    };
    if (pakaiHarga && hargaSatuan != null && hargaSatuan !== '') baris.harga_satuan = Number(hargaSatuan);
    if (pakaiKirim && idKirim) baris.id_kirim = String(idKirim);
    if (pakaiKet && keterangan) baris.keterangan = String(keterangan);
    return sb.from('transaksi').insert(baris).select('id_transaksi');
  };
  const rantai = async (pakaiKet) => {
    let r = await tulis(true, true, pakaiKet);
    // Kolom belum migrasi → mundur bertahap (yang gagal tak tertulis, aman dicoba ulang):
    // tanpa kirim, lalu tanpa harga, lalu tanpa keduanya.
    if (r.error && /id_kirim/i.test(r.error.message || '')) r = await tulis(true, false, pakaiKet);
    if (r.error && /harga/i.test(r.error.message || '')) {
      r = await tulis(false, true, pakaiKet);
      if (r.error) r = await tulis(false, false, pakaiKet);
    }
    return r;
  };
  let r = await rantai(true);
  if (r.error && /keterangan/i.test(r.error.message || '')) r = await rantai(false);
  if (r.error) throw new Error(r.error.message);
  return r.data[0].id_transaksi;
}

// Cek ambang stock (jejak via log; lonceng dalam-web menyusul)
async function cekThreshold(id, nama, stockSekarang, threshold){
  if (stockSekarang > threshold){
    return;
  } else if (stockSekarang <= threshold){
    console.log(
    `*REMINDER STOCK!*\n` +
    `ID: ${id}\n` +
    `Barang: ${nama}\n` +
    `Stock Sekarang: ${stockSekarang}\n\n` +
    `*LAKUKAN RESTOCK SECEPATNYA!*`);
  }
}

// Helper sesi opname (dipakai route + scheduler mini; dulu duplikat di routes/opname.js)
async function buatIdSesi() {
  const today = jakartaParts(new Date()).ymd.replaceAll('-', '');
  const r = await sb.from('opname_sesi').select('id_sesi', { count: 'exact', head: true }).like('id_sesi', `SOP-${today}%`);
  if (r.error) throw new Error(r.error.message);
  return `SOP-${today}-${String((r.count || 0) + 1).padStart(3, '0')}`;
}

async function sesiTerbuka() {
  const r = await sb.from('opname_sesi').select('id_sesi').in('status', ['HITUNG', 'REVIEW']).limit(1);
  if (r.error) throw new Error(r.error.message);
  return (r.data && r.data[0]) || null;
}

// Sampling acak -> sesi opname mini otomatis (max 3 barang, 1x/hari; skip bila ada sesi terbuka / sudah ada sesi hari ini)
async function RandomSamplingChecking(){
  try{
    const buka = await sesiTerbuka();
    if (buka) { console.log(`Sampling skip: sesi ${buka.id_sesi} masih terbuka.`); return null; }
    const today = jakartaParts(new Date()).ymd.replaceAll('-', '');
    const ada = await sb.from('opname_sesi').select('id_sesi').like('id_sesi', `SOP-${today}%`).limit(1);
    if (ada.error) throw new Error(ada.error.message);
    if (ada.data && ada.data.length) { console.log(`Sampling skip: sesi hari ini sudah ada (${ada.data[0].id_sesi}).`); return null; }

    const { data, error } = await sb.from('barang_inventory').select('id_barang,nama_barang,total,harga_barang');
    if (error) throw new Error(error.message);
    if (!data || !data.length) return null;

    const pool = [...data];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const acak = pool.slice(0, Math.min(3, pool.length));

    const idSesi = await buatIdSesi();
    const ins = await sb.from('opname_sesi').insert({ id_sesi: idSesi, status: 'HITUNG', dibuat_pada: nowIso() });
    if (ins.error) throw new Error(ins.error.message);
    const rows = acak.map(b => ({
      id_sesi: idSesi, id_barang: b.id_barang,
      sistem_qty: Number(b.total) || 0,
      sistem_harga: b.harga_barang != null ? Number(b.harga_barang) : null,
      fisik_qty: null,
    }));
    const r = await sb.from('opname_item').insert(rows);
    if (r.error) throw new Error(r.error.message);

    const daftar = acak.map(b => `${b.nama_barang} (sistem ${b.total})`).join('; ');
    await tulisNotifikasi('SAMPLING ACAK ' + idSesi, `Hitung ${acak.length} barang: ${daftar}. Buka /opname → Lanjut.`, idSesi);
    console.log(`Sampling mini ${idSesi}: ${daftar}`);
    return idSesi;
  } catch (err){
    console.error(`Random Sampling gagal: ${err.message}`);
    return null;
  }
}

function scheduleRandomSampling(){
  const Jam_Awal = 8;
  const Jam_Akhir = 17;

  const jamRandom = Jam_Awal + Math.random() * (Jam_Akhir - Jam_Awal)
  const jamCheck = Math.floor(jamRandom)
  const menit = Math.floor((jamRandom - jamCheck) * 60);

  const targetWaktu = new Date();
  targetWaktu.setHours(jamCheck, menit, 0, 0);

  const waktuSekarang = new Date();
  if (waktuSekarang >= targetWaktu){
    targetWaktu.setDate(targetWaktu.getDate() + 1); // set jadi besok
  }

  const selisihMs = targetWaktu - waktuSekarang;
  console.log(`Random Check dijadwalkan: ${targetWaktu.toLocaleString('id-ID')}`);

  setTimeout(async () => {
    await RandomSamplingChecking();
    scheduleRandomSampling();
  }, selisihMs)
}

// Lonceng gudang (pengganti WA): tulis best-effort, tak pernah gagalkan transaksi.
async function tulisNotifikasi(judul, isi, ref) {
  try {
    const ins = await sb.from('notifikasi').insert({
      untuk: 'gudang',
      judul: String(judul || '').slice(0, 120),
      isi: String(isi || '').slice(0, 500),
      ref: String(ref || '').slice(0, 60),
    });
    if (ins.error) throw new Error(ins.error.message);
    const batas = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    await sb.from('notifikasi').delete().lt('dibuat_pada', batas);
  } catch (e) { console.warn('lonceng gagal:', e.message); }
}

// Inti pembuatan pengiriman — HANYA dipakai internal oleh approve pesanan (T2).
// Endpoint manual susulan dicabut 2026-09-14 (fitur tak dipakai).
async function buatPengiriman(outlet, items, idPesan = null) {
  if (!outlet || !String(outlet).trim()) throw new Error('Nama outlet wajib diisi.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Minimal 1 item.');

  const ref = await sb.from('barang_inventory').select('*');
  if (ref.error) throw new Error(ref.error.message);
  const siap = [];
  for (const it of items) {
    const row = ref.data.find(r => String(r.id_barang).trim() === String(it.id || '').trim());
    if (!row) throw new Error(`ID ${it.id} tidak ditemukan di database.`);
    const satuanRow = kanonikSatuan(row.satuan) || 'pcs';
    const satuanMinta = kanonikSatuan(it.satuan) || satuanRow;
    let faktor = 1;
    if (satuanMinta.toLowerCase() !== satuanRow.toLowerCase()) {
      faktor = parseKonversi(row.isi_per_gudang, row.satuan_gudang, satuanMinta, satuanRow);
      if (!faktor) throw new Error(`${row.nama_barang}: tak ada konversi ${satuanMinta} → ${satuanRow}. Lengkapi Isi per Satuan Gudang.`);
    }
    const qty = Number(it.jumlah) * faktor;
    if (!qty || qty <= 0) throw new Error(`Jumlah ${row.nama_barang} tidak valid.`);
    const stock = Number(row.total);
    if (qty > stock) throw new Error(`Stock ${row.nama_barang} kurang (minta ${qty}, sisa ${stock}).`);
    siap.push({ row, qty });
  }

  const idKirim = await buatIdKirim();
  const itemsJson = siap.map(({ row, qty }) => ({
    id: row.id_barang,
    nama: row.nama_barang,
    varian: row.merk || '',
    jumlahKirim: qty,
    jumlahTerima: null,
    ceklis: false,
    keterangan: ''
  }));

  // Gagal di tengah (balapan stock) -> kompensasi: kembalikan stock + hapus jejak, lalu throw.
  const jejak = []; // [{id_transaksi, id_barang, qty}]
  try {
    for (const { row, qty } of siap) {
      const hasil = await kurangStock(row.id_barang, qty);
      if (!hasil.ok) throw new Error(`Stock ${row.nama_barang} berubah saat diproses (sisa ${hasil.sisa}). Ulangi.`);
      const idTrx = await catatTransaksi(row.id_barang, row.nama_barang, row.merk,
        row.kategori, 'Keluar', qty, kanonikSatuan(row.satuan) || 'pcs',
        row.harga_barang != null ? Number(row.harga_barang) : null, idKirim);
      jejak.push({ id_transaksi: idTrx, id_barang: row.id_barang, qty });
      await cekThreshold(row.id_barang, row.nama_barang,
        hasil.sisa, Number(row.minimum_stock));
    }
  } catch (e) {
    for (const j of jejak) {
      try {
        const cur = await sb.from('barang_inventory').select('total').eq('id_barang', j.id_barang).single();
        if (cur.data) await sb.from('barang_inventory').update({ total: Number(cur.data.total) + j.qty }).eq('id_barang', j.id_barang);
        await sb.from('transaksi').delete().eq('id_transaksi', j.id_transaksi);
      } catch { /* kompensasi best-effort */ }
    }
    throw e;
  }

  const ringkasan = buatRingkasanKirim(itemsJson.map(it => ({ nama: it.nama, qtyKirim: it.jumlahKirim })));
  const ins = await sb.from('pengiriman').insert({
    id_kirim: idKirim,
    token: '',
    id_pesan: idPesan && String(idPesan).trim() !== '-' ? String(idPesan).trim() : null,
    tanggal_buat: formatWaktuBukti(),
    tanggal_kirim: '',
    outlet: String(outlet).trim(),
    status: 'SIAP KIRIM',
    items_json: itemsJson,
    ringkasan,
    alasan: '',
    nama_penerima: '',
    tanggal_terima: '',
    riwayat_status: `${formatWaktuBukti()} - Dibuat (${siap.length} item)`,
    dibuat_pada: nowIso(),
  });
  if (ins.error) throw new Error(ins.error.message);
  return { idKirim, ringkasan };
}

module.exports = {
  initDb, buatIdKirim, buatIdBarang, buatIdPesan, buatIdSesi, sesiTerbuka,
  cariPengiriman, pengirimanKeJson, simpanPengiriman,
  cariOutletByToken, pesananKeJson, cariPesanan, simpanPesanan, mirrorPesanan,
  catatTransaksi, cekThreshold, RandomSamplingChecking, scheduleRandomSampling,
  tulisNotifikasi, buatPengiriman,
};
