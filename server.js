require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT;

// ---- Jadwal Slot pengiriman (PRD seksi 7): Senin & Kamis, cutoff 15:00 WIB ----
const SLOT_DAYS = [1, 4]; // Senin=1, Kamis=4
const SLOT_CUTOFF_JAM = 15;
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Pecah Date menjadi komponen kalender Asia/Jakarta (kebal TZ server)
function jakartaParts(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).map(x => [x.type, x.value])
  );
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    dayNum: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday],
    jam: Number(p.hour) + Number(p.minute) / 60
  };
}

// Aritmetika tanggal berjangkar tengah hari Jakarta (UTC+7 tanpa DST, tanggal aman)
function anchorDariYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)); // 12:00 UTC = 19:00 WIB, tanggal sama
}
function geserHari(ymd, n) {
  const a = anchorDariYmd(ymd);
  a.setUTCDate(a.getUTCDate() + n);
  return a.toISOString().slice(0, 10);
}
// Slot terdekat >= ymd (sesudah=true: strictly after, untuk kasus lewat cutoff)
function slotBerikutnya(ymd, sesudah = false) {
  let cur = sesudah ? geserHari(ymd, 1) : ymd;
  for (let i = 0; i < 8; i++) {
    if (SLOT_DAYS.includes(anchorDariYmd(cur).getUTCDay())) return cur;
    cur = geserHari(cur, 1);
  }
  throw new Error('slotBerikutnya: tidak ketemu slot dalam 8 hari');
}

function hitungSlot(waktuPesan = new Date()) {
  const { ymd, dayNum, jam } = jakartaParts(new Date(waktuPesan));
  const diHariSlot = SLOT_DAYS.includes(dayNum);
  const batchMasuk = (diHariSlot && jam < SLOT_CUTOFF_JAM) ? ymd : slotBerikutnya(ymd, diHariSlot);
  const rencanaKirim = slotBerikutnya(batchMasuk, true);
  return { batchMasuk, rencanaKirim, batchLabel: formatTanggalSlot(batchMasuk), kirimLabel: formatTanggalSlot(rencanaKirim) };
}

function formatTanggalSlot(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const a = anchorDariYmd(ymd);
  return `${NAMA_HARI[a.getUTCDay()]}, ${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

// Format bukti konkret: "Selasa, 08 September 2026 pukul 08.05 WIB"
function formatWaktuBukti(date = new Date()) {
  return new Date(date).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

// Kolom Ringkasan manusiawi (PRD seksi 5): "Susu x10 (PENUHI); Gula x5 (TOLAK: habis)"
// Dipakai jalur Pesanan (T2). Jalur Pengiriman pakai buatRingkasanKirim + buatAlasan.
function buatRingkasan(items) {
  return (items || []).map(it => {
    const nama = it.nama || it.id || '?';
    const ket = it.keputusan || it.status || '';
    const pesan = it.qtyPesan != null ? Number(it.qtyPesan) : null;
    const kirim = it.qtyKirim != null ? Number(it.qtyKirim) : null;
    // Parsial PENUHI: "Susu x10 → kirim 5 (kurang 5: ket)"
    if (String(ket).toUpperCase() === 'PENUHI' && pesan != null && kirim != null && kirim < pesan) {
      return `${nama} x${pesan} → kirim ${kirim} (kurang ${pesan - kirim}: ${it.keterangan || '-'})`;
    }
    const qty = it.qtyKirim ?? it.qtyPesan ?? it.jumlah ?? '?';
    const alasan = it.keterangan ? `: ${it.keterangan}` : '';
    return `${nama} x${qty} (${ket}${alasan})`;
  }).join('; ');
}

// Ringkasan Pengiriman saja: "Pasta 10 -> 9" (tanpa x, tanpa kurung).
function buatRingkasanKirim(items) {
  return (items || []).map(it => {
    const nama = it.nama || it.id || '?';
    const qty = it.qtyKirim ?? it.qtyPesan ?? it.jumlah ?? '?';
    return `${nama} ${qty}`;
  }).join('; ');
}

// Kolom Alasan Pengiriman: "Pasta: 1 tidak ada di kardus; Gula: 2 pecah", kosong = ''.
function buatAlasan(items) {
  return (items || [])
    .filter(it => it.keterangan && String(it.keterangan).trim())
    .map(it => `${it.nama || it.id || '?'}: ${String(it.keterangan).trim()}`)
    .join('; ');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Data: Supabase 5 tabel (barang_inventory, transaksi, pesanan, pengiriman, outlet).
// Akses Supabase terpusat di db.js.
const { sb, nowIso, kurangStock } = require('./db');

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

// Riwayat murni (tanpa save): panggil lalu sertakan di update/insert
function tambahRiwayat(lama, teks) {
  const l = lama || '';
  return l ? `${l}\n${formatWaktuBukti()} - ${teks}` : `${formatWaktuBukti()} - ${teks}`;
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

// Faktor konversi terstruktur: 1 <satuan_gudang> = <isi_per_gudang> <satuan>.
// Metrik baku lolos tanpa data. NULL/tak cocok -> tolak (fail-closed).
const ALIAS_SATUAN = {
  gram: 'gr', grams: 'gr', g: 'gr', kilo: 'kg', kilogram: 'kg',
  litre: 'liter', ltr: 'liter', l: 'liter',
  pieces: 'pcs', piece: 'pcs', pc: 'pcs',
};
const normSatuan = (u) => ALIAS_SATUAN[String(u || '').trim().toLowerCase()] || String(u || '').trim().toLowerCase();
const FAKTOR_METRIK = { 'kg>gr': 1000, 'gr>kg': 0.001, 'liter>ml': 1000, 'ml>liter': 0.001 };
function parseKonversi(isiPerGudang, gudangItem, dari, ke) {
  const d = normSatuan(dari);
  const k = normSatuan(ke);
  if (!d || d === k) return 1;
  if (FAKTOR_METRIK[`${d}>${k}`]) return FAKTOR_METRIK[`${d}>${k}`];
  const n = Number(isiPerGudang);
  if (d === normSatuan(gudangItem) && Number.isFinite(n) && n > 0) return n;
  return null;
}

async function catatTransaksi(id, nama, varian, kategori, jenis_transaksi, jumlah, satuan, hargaSatuan = null) {
  const tulis = async (pakaiHarga) => {
    const baris = {
      id_barang: id,
      nama_barang: nama,
      varian: varian || '',
      kategori_bahan: kategori || '',
      jenis: jenis_transaksi,
      jumlah: Number(jumlah),
      satuan: satuan || 'Pcs',
      dibuat_pada: nowIso(),
    };
    if (pakaiHarga && hargaSatuan != null && hargaSatuan !== '') baris.harga_satuan = Number(hargaSatuan);
    return sb.from('transaksi').insert(baris).select('id_transaksi');
  };
  let r = await tulis(true);
  if (r.error && /harga/i.test(r.error.message || '')) r = await tulis(false); // kolom belum migrasi → tulis tanpa harga
  if (r.error) throw new Error(r.error.message);
  return r.data[0].id_transaksi;
}

// Moving-average aset: avgBaru = (totalLama*avgLama + totalBayar) / (totalLama + qtyMasuk).
// totalBayar = rupiah yang dibayar untuk qtyMasuk (sesuai nota, tanpa pusing satuan).
function hitungAvg(avgLama, totalLama, totalBayar, qtyMasuk) {
  const t = Number(totalLama) || 0;
  const q = Number(qtyMasuk) || 0;
  const bayar = Number(totalBayar) || 0;
  if (!(q > 0) || !(bayar > 0) || (t + q) <= 0) return null;
  const nilaiLama = avgLama != null && avgLama !== '' ? t * Number(avgLama) : 0;
  return (nilaiLama + bayar) / (t + q);
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

// Cek acak kesesuaian stock fisik (tanpa WA — jejak via log)
async function RandomSamplingChecking(){
  const sampling_check = 0.1;

  try{
    const { data, error } = await sb.from('barang_inventory').select('*');
    if (error) throw new Error(error.message);
    if (data.length === 0) return;

    const jumlahSampel = Math.min(3, Math.max(1, Math.ceil(data.length * sampling_check)));
    const acak = [...data].sort(() => Math.random() - 0.5).slice(0, jumlahSampel);

    let pesan = "*CHECK PRODUK*\n\n Check Produk Berikut, apakah jumlah stock sesuai?";
    acak.forEach(row => {
      pesan += `- Nama Barang: ${row.nama_barang} \n Jumlah Stock: ${row.total} \n`;
    });

    console.log(pesan);
  } catch (err){
    console.error(`Random Sampling reminder gagal terkirim, ${err}`);
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

app.get("/api/barang", wajibGudang, async (req, res) => {
  try{
    const r = await sb.from('barang_inventory').select('*').order('dibuat_pada', { ascending: true });
    if (r.error) throw new Error(r.error.message);
    const data = r.data.map(row => ({
      id: row.id_barang,
      nama: row.nama_barang,
      varian: row.varian,
      kategori: row.kategori_bahan,
      stock: Number(row.total),
      threshold: Number(row.minimum_stock),
      satuanEceran: row.satuan || 'Pcs',
      satuanGrosir: row.satuan_gudang || null,
      isiPerGrosir: row.isi_per_gudang != null ? Number(row.isi_per_gudang) : null,
      hargaBarang: row.harga_barang != null ? Number(row.harga_barang) : null,
      keterangan: row.keterangan || '',
      divisi: row.divisi || '',
      istilah: row.istilah_data_resep || ''
    }));
    res.json(data);
  }catch (err){
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

app.get("/api/transaksi", wajibGudang, async(req, res) => {
  try{
    const r = await sb.from('transaksi').select('*').order('dibuat_pada', { ascending: true });
    if (r.error) throw new Error(r.error.message);
    const data = r.data.map(row => ({
      timestamp: row.dibuat_pada ? formatWaktuBukti(row.dibuat_pada) : '-',
      idBarang: row.id_barang,
      nama: row.nama_barang,
      kategori: row.kategori_bahan,
      varian: row.varian,
      jenis: row.jenis,
      jumlah: Number(row.jumlah),
      satuan: row.satuan || 'Pcs',
    }));
    res.json(data);
  } catch (err){
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

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

app.post('/api/tambahBarangBaru', wajibGudang, async (req, res) => {
  try {
    const { id, nama, varian, kategori, jumlah, restock, satuanEceran, satuanGudang, isiPerGudang, divisi, keterangan, istilah, totalBayar } = req.body;
    const namaBersih = String(nama || '').trim().replace(/\s+/g, ' ');
    if (!namaBersih) {
      return res.status(400).json({ sukses: false, pesan: 'Nama Barang wajib diisi.' });
    }
    const satuan = String(satuanEceran || 'Pcs').trim() || 'Pcs';
    if (isiPerGudang != null && isiPerGudang !== '' && !(Number(isiPerGudang) > 0)) {
      return res.status(400).json({ sukses: false, pesan: 'Isi per Satuan Gudang harus angka > 0 bila diisi.' });
    }
    if (Number(jumlah) > 0 && !(Number(totalBayar) > 0)) {
      return res.status(400).json({ sukses: false, pesan: 'Total bayar (Rp) wajib diisi untuk stock awal.' });
    }

    let idPakai = String(id || '').trim();
    if (idPakai) {
      const cek = await sb.from('barang_inventory').select('id_barang,nama_barang').eq('id_barang', idPakai).maybeSingle();
      if (cek.error) throw new Error(cek.error.message);
      if (cek.data) {
        return res.status(409).json({
          sukses: false,
          pesan: `ID Produk ${idPakai} sudah terdaftar sebagai ${cek.data.nama_barang}. Check kembali ID Produk yang akan dimasukkan.`
        });
      }
    } else {
      idPakai = await buatIdBarang();
    }

    const mirip = await sb.from('barang_inventory').select('id_barang,nama_barang').ilike('nama_barang', namaBersih).limit(1);
    if (mirip.error) throw new Error(mirip.error.message);
    if (mirip.data && mirip.data.length) {
      return res.status(409).json({
        sukses: false,
        pesan: `Nama mirip sudah ada: ${mirip.data[0].nama_barang} (${mirip.data[0].id_barang}). Pakai yang ada atau ubah nama.`
      });
    }

    const kategoriSimpan = String(kategori || '').trim().toUpperCase();
    const ins = await sb.from('barang_inventory').insert({
      id_barang: idPakai,
      nama_barang: namaBersih,
      varian: varian || '',
      kategori_bahan: kategoriSimpan,
      total: Number(jumlah) || 0,
      minimum_stock: Number(restock) || 5,
      satuan,
      satuan_gudang: satuanGudang || '',
      isi_per_gudang: isiPerGudang != null && isiPerGudang !== '' ? Number(isiPerGudang) : null,
      divisi: divisi || '',
      keterangan: keterangan || '',
      istilah_data_resep: istilah || '',
      dibuat_pada: nowIso(),
      ...(Number(jumlah) > 0 && Number(totalBayar) > 0 ? { harga_barang: Number(totalBayar) / Number(jumlah) } : {}),
    });
    if (ins.error) {
      if (/harga_barang/i.test(ins.error.message || '')) {
        throw new Error('Kolom harga_barang belum ada. Jalankan migrasi_harga_barang.sql di Supabase dulu, lalu ulangi.');
      }
      throw new Error(ins.error.message);
    }

    await catatTransaksi(idPakai, namaBersih, varian, kategoriSimpan, 'Masuk', Number(jumlah) || 0, satuan,
      Number(jumlah) > 0 && Number(totalBayar) > 0 ? Number(totalBayar) / Number(jumlah) : null);

    res.json({ sukses: true, pesan: `Barang baru ${namaBersih} tersimpan ke database. Stock awal: ${Number(jumlah) || 0} ${satuan}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal menyimpan: ' + err.message });
  }
});

// Ubah metadata barang (ID + stock terkunci; satuan wajib konfirmasi ketik-ulang)
app.put('/api/barang/:id', wajibGudang, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const ada = await sb.from('barang_inventory').select('*').eq('id_barang', id).maybeSingle();
    if (ada.error) throw new Error(ada.error.message);
    if (!ada.data) return res.status(404).json({ sukses: false, pesan: 'Barang tidak ditemukan.' });
    if ('id' in req.body || 'stock' in req.body || 'total' in req.body) {
      return res.status(400).json({ sukses: false, pesan: 'ID dan stock tidak bisa diubah. Stock hanya via Masuk/Keluar.' });
    }
    const { nama, varian, kategori, restock, satuanEceran, konfirmasiSatuan, satuanGudang, isiPerGudang, divisi, keterangan, istilah, hargaBarang } = req.body;
    const patch = {};
    if (nama !== undefined) {
      const namaBersih = String(nama || '').trim().replace(/\s+/g, ' ');
      if (!namaBersih) return res.status(400).json({ sukses: false, pesan: 'Nama Barang wajib diisi.' });
      const mirip = await sb.from('barang_inventory').select('id_barang,nama_barang').ilike('nama_barang', namaBersih).neq('id_barang', id).limit(1);
      if (mirip.error) throw new Error(mirip.error.message);
      if (mirip.data && mirip.data.length) {
        return res.status(409).json({
          sukses: false,
          pesan: `Nama mirip sudah ada: ${mirip.data[0].nama_barang} (${mirip.data[0].id_barang}). Pakai yang ada atau ubah nama.`
        });
      }
      patch.nama_barang = namaBersih;
    }
    if (varian !== undefined) patch.varian = String(varian || '').trim();
    if (kategori !== undefined) patch.kategori_bahan = String(kategori || '').trim().toUpperCase();
    if (divisi !== undefined) patch.divisi = String(divisi || '').trim();
    if (keterangan !== undefined) patch.keterangan = String(keterangan || '');
    if (istilah !== undefined) patch.istilah_data_resep = String(istilah || '').trim();
    if (restock !== undefined) {
      if (!(Number(restock) >= 0)) return res.status(400).json({ sukses: false, pesan: 'Batas restock harus angka >= 0.' });
      patch.minimum_stock = Number(restock);
    }
    if (satuanEceran !== undefined) {
      const satuanBaru = String(satuanEceran || '').trim();
      if (!satuanBaru) return res.status(400).json({ sukses: false, pesan: 'Satuan tidak boleh kosong.' });
      if (satuanBaru !== (ada.data.satuan || 'Pcs')) {
        if (konfirmasiSatuan !== satuanBaru) {
          return res.status(400).json({ sukses: false, pesan: `Ketik ulang "${satuanBaru}" persis untuk ganti satuan. Stock ${ada.data.total} ikut berubah makna menjadi ${satuanBaru}.` });
        }
        patch.satuan = satuanBaru;
      }
    }
    if (satuanGudang !== undefined) patch.satuan_gudang = String(satuanGudang || '').trim();
    if (isiPerGudang !== undefined) {
      if (isiPerGudang === '' || isiPerGudang == null) patch.isi_per_gudang = null;
      else {
        if (!(Number(isiPerGudang) > 0)) return res.status(400).json({ sukses: false, pesan: 'Isi per Satuan Gudang harus angka > 0 bila diisi.' });
        patch.isi_per_gudang = Number(isiPerGudang);
      }
    }
    if (hargaBarang !== undefined) {
      if (hargaBarang === '' || hargaBarang == null) patch.harga_barang = null;
      else {
        if (!(Number(hargaBarang) >= 0)) return res.status(400).json({ sukses: false, pesan: 'Harga harus angka >= 0.' });
        patch.harga_barang = Number(hargaBarang);
      }
    }
    if (!Object.keys(patch).length) return res.json({ sukses: true, pesan: 'Tidak ada perubahan.' });
    const up = await sb.from('barang_inventory').update(patch).eq('id_barang', id).select('id_barang');
    if (up.error) throw new Error(up.error.message);
    res.json({ sukses: true, pesan: `Barang ${id} diperbarui.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal mengubah: ' + err.message });
  }
});

// Hapus barang + transaksi miliknya; tolak bila dipakai di pesanan/pengiriman
app.delete('/api/barang/:id', wajibGudang, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const ada = await sb.from('barang_inventory').select('id_barang,nama_barang').eq('id_barang', id).maybeSingle();
    if (ada.error) throw new Error(ada.error.message);
    if (!ada.data) return res.status(404).json({ sukses: false, pesan: 'Barang tidak ditemukan.' });
    const pakai = [];
    for (const [tabel, kunci, kolom] of [['pesanan', 'id_pesan', 'items_json'], ['pengiriman', 'id_kirim', 'items_json']]) {
      const r = await sb.from(tabel).select(kunci + ',' + kolom);
      if (r.error) throw new Error(r.error.message);
      const kena = (r.data || []).filter(x => {
        let items = x[kolom];
        if (typeof items === 'string') { try { items = JSON.parse(items || '[]'); } catch { items = []; } }
        return Array.isArray(items) && items.some(it => String(it.id) === id);
      }).map(x => x[kunci]);
      if (kena.length) pakai.push(tabel + ' ' + kena.slice(0, 3).join(', ') + (kena.length > 3 ? ` (+${kena.length - 3})` : ''));
    }
    if (pakai.length) {
      return res.status(409).json({ sukses: false, pesan: `${ada.data.nama_barang} dipakai di ${pakai.join('; ')}. Tidak bisa dihapus.` });
    }
    const ht = await sb.from('transaksi').delete().eq('id_barang', id);
    if (ht.error) throw new Error(ht.error.message);
    const hb = await sb.from('barang_inventory').delete().eq('id_barang', id);
    if (hb.error) throw new Error(hb.error.message);
    res.json({ sukses: true, pesan: `Barang ${ada.data.nama_barang} (${id}) dihapus.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal menghapus: ' + err.message });
  }
});

// Proses transaksi masuk/keluar-
app.post('/api/prosesTransaksi', wajibGudang, async (req, res) => {
  try {
    const { id, jenis, jumlah, satuanInput, totalBayar } = req.body;
    const b = await sb.from('barang_inventory').select('*').eq('id_barang', String(id).trim()).maybeSingle();
    if (b.error) throw new Error(b.error.message);
    const row = b.data;

    if (!row) {
      return res.json({ sukses: false, pesan: 'Barang tidak ditemukan di database.' });
    }

    const satuanEceran = row.satuan || 'Pcs';
    const satuanMinta = String(satuanInput || satuanEceran).trim() || satuanEceran;

    const jumlahInput = Number(jumlah);
    let faktor = 1;
    if (satuanMinta.toLowerCase() !== satuanEceran.toLowerCase()) {
      faktor = parseKonversi(row.isi_per_gudang, row.satuan_gudang, satuanMinta, satuanEceran);
      if (!faktor) {
        return res.json({ sukses: false, pesan: `Tak ada konversi ${satuanMinta} → ${satuanEceran}. Lengkapi Isi per Satuan Gudang di data barang.` });
      }
    }
    const jmlh = jumlahInput * faktor;

    let stockBaru = Number(row.total);
    let avgBaru = row.harga_barang != null ? Number(row.harga_barang) : null;
    let hargaSatuanTrx = null; // jejak nilai per satuan di baris transaksi

    if (jenis === 'Masuk') {
      if (!(jmlh > 0)) {
        return res.json({ sukses: false, pesan: 'Jumlah masuk harus > 0.' });
      }
      const bayar = totalBayar != null && totalBayar !== '' ? Number(totalBayar) : null;
      if (!(bayar > 0)) {
        return res.json({ sukses: false, pesan: `Isi Total bayar (Rp) — wajib untuk setiap Barang Masuk ${row.nama_barang}.` });
      }
      avgBaru = hitungAvg(avgBaru, stockBaru, bayar, jmlh);
      hargaSatuanTrx = bayar / jmlh;
      const up = await sb.from('barang_inventory').update({ total: stockBaru + jmlh, harga_barang: avgBaru }).eq('id_barang', row.id_barang).select('total');
      if (up.error) {
        if (/harga_barang/i.test(up.error.message || '')) {
          return res.json({ sukses: false, pesan: 'Kolom harga_barang belum ada. Jalankan migrasi_harga_barang.sql di Supabase dulu, lalu ulangi.' });
        }
        throw new Error(up.error.message);
      }
      stockBaru = Number(up.data[0].total);
    } else if (jenis === 'Keluar') {
      if (jmlh > stockBaru) {
        return res.json({ sukses: false, pesan: `Stock ${row.nama_barang} yang keluar melebihi stock saat ini. \n ${stockBaru} ${satuanEceran}`});
      }
      const hasil = await kurangStock(row.id_barang, jmlh); // atomik: gagal bila kalah balapan
      if (!hasil.ok) {
        return res.json({ sukses: false, pesan: `Stock ${row.nama_barang} berubah saat diproses (sisa ${hasil.sisa}). Ulangi transaksi.` });
      }
      stockBaru = hasil.sisa;
      hargaSatuanTrx = avgBaru; // keluar dinilai avg saat itu (avg tidak berubah)
    } else {
      return res.json({ sukses: false, pesan: 'Jenis transaksi tidak valid.' });
    }

    const keteranganSatuan = faktor !== 1
      ? `${jumlahInput} ${satuanMinta} (= ${jmlh} ${satuanEceran})`
      : `${jmlh} ${satuanEceran}`;

    await catatTransaksi(row.id_barang,
                        row.nama_barang,
                        row.varian,
                        row.kategori_bahan,
                        jenis,
                        jmlh,
                        satuanEceran,
                        hargaSatuanTrx);
    await cekThreshold(
      row.id_barang,
      row.nama_barang,
      stockBaru,
      Number(row.minimum_stock)
    );

    res.json({
      sukses: true,
      pesan: `${row.nama_barang} - ${jenis} ${keteranganSatuan} berhasil dicatat. Stock sekarang: ${stockBaru} ${satuanEceran}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal memproses: ' + err.message });
  }
});

// ---- Pengiriman gudang -> outlet (Step 1 / T1) ----

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
    const satuanRow = row.satuan || 'Pcs';
    const satuanMinta = String(it.satuan || satuanRow).trim() || satuanRow;
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
    varian: row.varian || '',
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
      const idTrx = await catatTransaksi(row.id_barang, row.nama_barang, row.varian,
        row.kategori_bahan, 'Keluar', qty, row.satuan || 'Pcs',
        row.harga_barang != null ? Number(row.harga_barang) : null);
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

app.get('/api/pengiriman', wajibGudang, async (req, res) => {
  try {
    const r = await sb.from('pengiriman').select('*').order('dibuat_pada', { ascending: false });
    if (r.error) throw new Error(r.error.message);
    res.json(r.data.map(x => pengirimanKeJson(x)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Tandai Dikirim (manual): SIAP KIRIM -> DIKIRIM, token berita acara lahir.
// Gerbang verifikasi: ceklis per baris by POSISI index (ID bisa kembar '-') + foto kirim opsional.
// Gagal upload foto di frontend tak memblokir — foto null tetap boleh Tandai.
app.post('/api/pengiriman/:id/kirim', wajibGudang, async (req, res) => {
  try {
    const row = await cariPengiriman(req.params.id);
    if (!row) return res.status(404).json({ sukses: false, pesan: 'ID Kirim tidak ditemukan.' });
    if (row.status !== 'SIAP KIRIM') {
      return res.status(409).json({ sukses: false, pesan: `Status ${row.status}, hanya SIAP KIRIM yang bisa dikirim.` });
    }
    let dikirim = row.items_json;
    if (typeof dikirim === 'string') { try { dikirim = JSON.parse(dikirim || '[]'); } catch { dikirim = []; } }
    if (!Array.isArray(dikirim)) dikirim = [];
    const { pindaian, fotoKirim } = req.body || {};
    if (!Array.isArray(pindaian) || pindaian.length === 0) {
      return res.status(409).json({ sukses: false, pesan: 'Belum ada line terverifikasi. Ceklis semua barang kiriman dulu.' });
    }
    const okIndex = new Set(pindaian.map(p => Number(p.index)).filter(n => Number.isInteger(n) && n >= 0));
    const kurang = dikirim.map((it, i) => ({ it, i })).filter(({ i }) => !okIndex.has(i));
    if (kurang.length) {
      return res.status(409).json({ sukses: false, pesan: `Belum diceklis: ${kurang.map(({ it }) => it.nama).join(', ')}.` });
    }
    const asing = [...okIndex].filter(i => i < 0 || i >= dikirim.length);
    if (asing.length) {
      return res.status(400).json({ sukses: false, pesan: `Baris asing bukan bagian kiriman: ${asing.join(', ')}.` });
    }
    const hasil = dikirim.map(it => ({ ...it, dipindai: true, cara: 'ceklis' }));
    const token = crypto.randomUUID();
    row.items_json = hasil;
    row.token = token;
    if (fotoKirim !== undefined) row.foto_kirim = String(fotoKirim || '').trim() || null;
    row.tanggal_kirim = formatWaktuBukti();
    row.status = 'DIKIRIM';
    row.riwayat_status = tambahRiwayat(row.riwayat_status, `Diverifikasi ceklis: ${hasil.map(it => it.nama).join(', ')}${row.foto_kirim ? ' + foto paket' : ' (tanpa foto)'}`);
    row.riwayat_status = tambahRiwayat(row.riwayat_status, 'Dikirim (link berita acara aktif)');
    await simpanPengiriman(row);
    await mirrorPesanan(row.id_pesan, 'DIKIRIM', 'Dikirim (link berita acara aktif)');
    // WA admin fire-and-forget (path saja: domain publik tak dikenal server; URL penuh via Salin)
    console.log(`*LINK BERITA ACARA*\nKirim ${row.id_kirim} ke ${row.outlet} DIKIRIM.\nLink: /terima/${token}\nTeruskan ke outlet via WA. Outlet juga bisa buka link pemesanan → tab Surat Jalan.`);
    res.json({ sukses: true, token, pesan: `Pengiriman ${row.id_kirim} DIKIRIM. Kirim link berita acara ke outlet via WA.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// Batalkan Pengiriman: DIKIRIM -> SIAP KIRIM (hanya sebelum outlet lapor + alasan wajib)
app.post('/api/pengiriman/:id/batal-kirim', wajibGudang, async (req, res) => {
  try {
    const { alasan } = req.body;
    if (!alasan || !String(alasan).trim()) {
      return res.status(400).json({ sukses: false, pesan: 'Alasan pembatalan wajib diisi.' });
    }
    const row = await cariPengiriman(req.params.id);
    if (!row) return res.status(404).json({ sukses: false, pesan: 'ID Kirim tidak ditemukan.' });
    if (row.status !== 'DIKIRIM') {
      return res.status(409).json({ sukses: false, pesan: `Status ${row.status} — hanya DIKIRIM yang bisa dibatalkan, dan tidak bisa setelah outlet lapor terima.` });
    }
    row.token = ''; // link lama mati
    row.tanggal_kirim = '';
    row.status = 'SIAP KIRIM';
    row.riwayat_status = tambahRiwayat(row.riwayat_status, `Dibatalkan: ${String(alasan).trim()} (link lama mati)`);
    await simpanPengiriman(row);
    // Mirror: asal DISETUJUI/SEBAGIAN diturunkan dari keputusan per item (ada TOLAK = sebagian)
    try {
      const idPesan = row.id_pesan ? String(row.id_pesan).trim() : '';
      if (idPesan) {
        const p = await cariPesanan(idPesan);
        if (p) {
          let arr = p.items_json;
          if (typeof arr === 'string') { try { arr = JSON.parse(arr || '[]'); } catch { arr = []; } }
          if (!Array.isArray(arr)) arr = [];
          const asal = arr.some(it => String(it.keputusan || '').toUpperCase() === 'TOLAK') ? 'DISETUJUI SEBAGIAN' : 'DISETUJUI';
          await simpanPesanan({ ...p, status: asal, riwayat_status: tambahRiwayat(p.riwayat_status, `Pengiriman dibatalkan, kembali ${asal}`) });
        }
      }
    } catch (e) { console.warn('mirror batal gagal:', e.message); }
    res.json({ sukses: true, pesan: 'Pengiriman dibatalkan, kembali SIAP KIRIM. Kirim ulang untuk link baru.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

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

app.get('/api/notifikasi', wajibGudang, async (req, res) => {
  try {
    const [d, c] = await Promise.all([
      sb.from('notifikasi').select('*').eq('untuk', 'gudang').order('id', { ascending: false }).limit(20),
      sb.from('notifikasi').select('id', { count: 'exact', head: true }).eq('untuk', 'gudang').eq('dibaca', false),
    ]);
    if (d.error) throw new Error(d.error.message);
    if (c.error) throw new Error(c.error.message);
    res.json({ belumBaca: c.count || 0, daftar: d.data || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifikasi/baca', wajibGudang, async (req, res) => {
  try {
    const r = await sb.from('notifikasi').update({ dibaca: true }).eq('untuk', 'gudang').eq('dibaca', false).select('id');
    if (r.error) throw new Error(r.error.message);
    res.json({ sukses: true, dibaca: (r.data || []).length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// Surat jalan cetak (F8): payload siap-cetak per kiriman, baca-saja (tanpa endpoint tulis).
app.get('/api/surat-jalan/:idKirim', wajibGudang, async (req, res) => {
  try {
    const row = await cariPengiriman(req.params.idKirim);
    if (!row) return res.status(404).json({ error: 'ID Kirim tidak ditemukan.' });
    if (String(row.status || '').trim() === 'SIAP KIRIM') {
      return res.status(409).json({ error: 'Surat jalan hanya bisa dicetak setelah paket ditandai dikirim.' });
    }
    let dikirim = row.items_json;
    if (typeof dikirim === 'string') { try { dikirim = JSON.parse(dikirim || '[]'); } catch { dikirim = []; } }
    if (!Array.isArray(dikirim)) dikirim = [];

    const ddmmyyyy = (ymd) => {
      const [y, m, d] = String(ymd || '').split('-');
      return (y && m && d) ? `${d}/${m}/${y}` : '-';
    };
    // Pesanan ref (sekali ambil: untuk tanggal + urutan baris coret).
    let linePesan = null;
    try {
      const idPesan = row.id_pesan ? String(row.id_pesan).trim() : '';
      if (idPesan && idPesan !== '-') {
        const p = await cariPesanan(idPesan);
        if (p) {
          let arr = p.items_json;
          if (typeof arr === 'string') { try { arr = JSON.parse(arr || '[]'); } catch { arr = []; } }
          if (Array.isArray(arr) && arr.length) linePesan = { arr, dibuat: p.dibuat_pada };
        }
      }
    } catch { linePesan = null; }
    // tglPesan: dibuat_pada pesanan (ISO, exact); fallback = dibuat kiriman.
    const ymdBuat = row.dibuat_pada ? jakartaParts(new Date(row.dibuat_pada)).ymd : '';
    let tglPesan = ddmmyyyy(ymdBuat);
    if (linePesan && linePesan.dibuat) tglPesan = ddmmyyyy(jakartaParts(new Date(linePesan.dibuat)).ymd);
    // tglKirim: parse string baku kita sendiri ("14 September 2026"); fallback = dibuat kiriman.
    let tglKirim = ddmmyyyy(ymdBuat);
    try {
      const m = String(row.tanggal_kirim || '').match(/(\d{1,2}) ([A-Za-z]+) (\d{4})/);
      if (m) {
        const bi = NAMA_BULAN.findIndex(b => b.toLowerCase() === m[2].toLowerCase());
        if (bi >= 0) tglKirim = `${String(m[1]).padStart(2, '0')}/${String(bi + 1).padStart(2, '0')}/${m[3]}`;
      }
    } catch { /* fallback di atas */ }

    const ref = await sb.from('barang_inventory').select('id_barang,satuan,harga_barang');
    if (ref.error) throw new Error(ref.error.message);
    const refMap = new Map((ref.data || []).map(b => [String(b.id_barang).trim(), b]));

    let grandTotal = 0;
    let adaTanpaHarga = false;
    const namaLengkap = (it) => (it.varian ? `${it.nama} - ${it.varian}` : (it.nama || it.id || '?'));
    const barisKirim = (it, no) => {
      const b = refMap.get(String(it.id || '').trim());
      const qty = Number(it.jumlahKirim) || 0;
      const harga = b && b.harga_barang != null ? Number(b.harga_barang) : 0;
      if (!(b && b.harga_barang != null)) adaTanpaHarga = true;
      const total = qty * harga;
      grandTotal += total;
      return {
        no,
        ditolak: false,
        outlet: String(row.outlet || '').trim(),
        nama: namaLengkap(it),
        note: String(it.keterangan || '').trim(),
        qty,
        satuan: (b && b.satuan) || '-',
        harga,
        total,
      };
    };
    // Susun ikut urutan line pesanan: PENUHI = data kirim, TOLAK = baris coret.
    // Tanpa pesanan (susulan lama) = isi paket apa adanya.
    let items;
    if (linePesan) {
      const termakan = new Set();
      items = linePesan.arr.map((lp) => {
        if (String(lp.keputusan || '').toUpperCase() === 'TOLAK') {
          return {
            no: 0,
            ditolak: true,
            outlet: String(row.outlet || '').trim(),
            nama: namaLengkap(lp),
            note: String(lp.keterangan || '').trim(),
            qty: Number(lp.qtyPesan) || 0,
            satuan: String(lp.satuan || '').trim() || '-',
            harga: null,
            total: null,
          };
        }
        const idx = dikirim.findIndex((it, i) => !termakan.has(i) && String(it.id) === String(lp.id));
        if (idx >= 0) termakan.add(idx);
        return barisKirim(idx >= 0 ? dikirim[idx] : { id: lp.id, nama: lp.nama, varian: lp.varian, jumlahKirim: 0, keterangan: '' }, 0);
      });
    } else {
      items = dikirim.map((it) => barisKirim(it, 0));
    }
    items.forEach((it, i) => { it.no = i + 1; });

    res.json({
      idKirim: row.id_kirim,
      outlet: String(row.outlet || '').trim(),
      tglPesan,
      tglKirim,
      items,
      grandTotal,
      adaTanpaHarga,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Halaman outlet (publik, tanpa data internal): baca via token
app.get('/api/pengiriman/:token/lihat', async (req, res) => {
  try {
    const row = await cariPengiriman(req.params.token, true);
    if (!row) return res.status(404).json({ error: 'Link tidak valid.' });
    const data = pengirimanKeJson(row, true);
    data.sudahDikonfirmasi = ['DITERIMA', 'DITERIMA SEBAGIAN'].includes(row.status);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Laporan terima outlet: hanya dari DIKIRIM, nama wajib, baris tanpa ceklis wajib jumlah + keterangan
app.post('/api/pengiriman/:token/konfirmasi', async (req, res) => {
  try {
    const { namaPenerima, items, fotoTerima } = req.body;
    if (!namaPenerima || !String(namaPenerima).trim()) {
      return res.status(400).json({ sukses: false, pesan: 'Nama penerima wajib diisi.' });
    }
    const row = await cariPengiriman(req.params.token, true);
    if (!row) return res.status(404).json({ sukses: false, pesan: 'Link tidak valid.' });
    if (row.status !== 'DIKIRIM') {
      return res.status(409).json({ sukses: false, pesan: 'Laporan ini sudah dikirim sebelumnya (terkunci).' });
    }
    let dikirim = row.items_json;
    if (typeof dikirim === 'string') { try { dikirim = JSON.parse(dikirim || '[]'); } catch { dikirim = []; } }
    if (!Array.isArray(dikirim)) dikirim = [];
    if (!Array.isArray(items) || items.length !== dikirim.length) {
      return res.status(400).json({ sukses: false, pesan: 'Data item tidak lengkap.' });
    }
    let sebagian = false;
    const hasil = dikirim.map((asli, i) => {
      const lap = items[i] || {};
      const ceklis = lap.ceklis === true;
      const jumlahTerima = lap.jumlahTerima === '' || lap.jumlahTerima == null ? null : Number(lap.jumlahTerima);
      const keterangan = String(lap.keterangan || '').trim();
      if (ceklis) {
        if (jumlahTerima != null && jumlahTerima !== Number(asli.jumlahKirim)) sebagian = true;
        return { ...asli, ceklis: true, jumlahTerima: jumlahTerima ?? Number(asli.jumlahKirim), keterangan };
      }
      if (jumlahTerima == null || Number.isNaN(jumlahTerima)) throw new Error(`Item "${asli.nama}": isi jumlah terima atau ceklis jika sesuai.`);
      if (!keterangan) throw new Error(`Item "${asli.nama}": keterangan wajib karena tidak diceklis.`);
      // tidak diceklis = tetap sebagian walau jumlah sama
      sebagian = true;
      return { ...asli, ceklis: false, jumlahTerima, keterangan };
    });

    const status = sebagian ? 'DITERIMA SEBAGIAN' : 'DITERIMA';
    row.items_json = hasil;
    row.ringkasan = buatRingkasanKirim(hasil.map(it => ({
      nama: it.nama,
      qtyKirim: `${it.jumlahKirim} -> ${it.jumlahTerima}`,
    })));
    row.alasan = buatAlasan(hasil);
    row.nama_penerima = String(namaPenerima).trim();
    row.tanggal_terima = formatWaktuBukti();
    if (fotoTerima !== undefined) row.foto_terima = String(fotoTerima || '').trim() || null;
    row.status = status;
    row.riwayat_status = tambahRiwayat(row.riwayat_status, `Dilaporkan outlet (${status}) oleh ${String(namaPenerima).trim()}${row.foto_terima ? ' + foto' : ''}`);
    await simpanPengiriman(row);
    await mirrorPesanan(row.id_pesan, status, `Dilaporkan outlet (${status})`);
    // Jejak laporan di log (lonceng dalam-web menyusul)
    console.log(`*LAPORAN TERIMA ${status}*\nKirim: ${row.id_kirim}${row.id_pesan ? ` (pesan ${row.id_pesan})` : ''}\nOutlet: ${row.outlet}\n${row.ringkasan || ''}${(row.alasan || '').trim() ? `\nAlasan: ${String(row.alasan).trim()}` : ''}\nPenerima: ${String(namaPenerima).trim()}`);
    await tulisNotifikasi(`LAPORAN TERIMA ${status} — ${row.id_kirim}`,
      `${row.outlet}: ${row.ringkasan || ''} (oleh ${String(namaPenerima).trim()})`, row.id_kirim);
    res.json({ sukses: true, status, pesan: status === 'DITERIMA' ? 'Terima kasih! Laporan diterima penuh.' : 'Laporan diterima sebagian, gudang akan menindaklanjuti kekurangan.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ sukses: false, pesan: err.message });
  }
});

// ---- Pesanan outlet (T2a) ----

// Gate loket pesan (2026-09-14, ganti P1b 1-aktif): buka tiap hari di bawah jam 15:00 WIB.
function pesanDibuka(waktu = new Date()) {
  return jakartaParts(new Date(waktu)).jam < SLOT_CUTOFF_JAM;
}
const PESAN_TUTUP = 'Hanya menerima pesanan di bawah jam 15.00 WIB.';

// Auth link permanen: token saja, slug diabaikan (PRD seksi 6). Outlet di Supabase.
async function cariOutletByToken(token) {
  const r = await sb.from('outlet').select('*').eq('token', String(token || '').trim()).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return r.data || null;
}

async function buatIdPesan() {
  const today = jakartaParts(new Date()).ymd.replaceAll('-', '');
  const r = await sb.from('pesanan').select('id_pesan', { count: 'exact', head: true }).like('id_pesan', `PSN-${today}%`);
  if (r.error) throw new Error(r.error.message);
  return `PSN-${today}-${String((r.count || 0) + 1).padStart(3, '0')}`;
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

// Gudang: daftar semua pesanan, terbaru-di-atas
app.get('/api/pesanan', wajibGudang, async (req, res) => {
  try {
    const r = await sb.from('pesanan').select('*').order('dibuat_pada', { ascending: false });
    if (r.error) throw new Error(r.error.message);
    res.json(r.data.map(x => pesananKeJson(x)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Outlet: 1x fetch untuk halaman pesan (identitas + katalog tanpa stock + jadwal + riwayat milik token).
// ?ringan=1 untuk poll: tanpa katalog (frontend pakai katalog fetch penuh pertama).
app.get('/api/pesan/:token', async (req, res) => {
  try {
    const outlet = await cariOutletByToken(req.params.token);
    if (!outlet) return res.status(404).json({ error: 'Link tidak valid.' });

    const ringan = String(req.query.ringan || '') === '1';
    let katalog = [];
    if (!ringan) {
      const br = await sb.from('barang_inventory').select('*').order('dibuat_pada', { ascending: true });
      if (br.error) throw new Error(br.error.message);
      katalog = br.data.map(b => ({
        id: b.id_barang,
        nama: b.nama_barang,
        varian: b.varian || '',
        satuan: b.satuan || 'Pcs',
        kategori: b.kategori_bahan || '',
      }));
    }

    const { batchLabel, kirimLabel } = hitungSlot(new Date());

    // Link berita acara lahir saat Tandai Dikirim (sebelumnya null = "belum dikirim").
    // Token tetap ada pasca-lapor agar Tab Surat Jalan bisa tampilkan arsip terkunci.
    // Foto kiriman ikut agar tiket outlet bisa tampilkan thumbnail ala Lacak.
    let infoKirim = {};
    try {
      const dk = await sb.from('pengiriman').select('id_pesan,token,foto_kirim,foto_terima');
      if (dk.error) throw new Error(dk.error.message);
      for (const x of dk.data) {
        const id = String(x.id_pesan || '').trim();
        if ((x.token || '').trim() && id) infoKirim[id] = {
          link: `/terima/${String(x.token).trim()}`,
          fotoKirim: x.foto_kirim || null,
          fotoTerima: x.foto_terima || null,
        };
      }
    } catch { infoKirim = {}; }

    const sp = await sb.from('pesanan').select('*').eq('token_outlet', String(req.params.token).trim()).order('dibuat_pada', { ascending: false });
    if (sp.error) throw new Error(sp.error.message);
    const milik = sp.data.map(x => {
      const id = String(x.id_pesan || '').trim();
      const info = infoKirim[id] || {};
      return pesananKeJson(x, info.link || null, info);
    });
    const dibuka = pesanDibuka(new Date());

    res.json({
      outlet: outlet.nama_outlet,
      slug: outlet.slug,
      jadwal: { batchMasuk: batchLabel, rencanaKirim: kirimLabel },
      katalog,
      riwayat: milik,
      bolehPesan: dibuka,
      pesanDibuka: dibuka,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Outlet: submit keranjang -> BARU/gabung sehati + slot otomatis + jejak log + lonceng
app.post('/api/pesan/:token', async (req, res) => {
  try {
    const outlet = await cariOutletByToken(req.params.token);
    if (!outlet) return res.status(404).json({ sukses: false, pesan: 'Link tidak valid.' });
    if (!pesanDibuka(new Date())) {
      return res.status(403).json({ sukses: false, pesan: PESAN_TUTUP });
    }

    const { namaPemesan, items } = req.body;
    if (!namaPemesan || !String(namaPemesan).trim()) {
      return res.status(400).json({ sukses: false, pesan: 'Nama pemesan wajib diisi.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ sukses: false, pesan: 'Keranjang masih kosong.' });
    }

    const br = await sb.from('barang_inventory').select('*');
    if (br.error) throw new Error(br.error.message);
    const ref = br.data;
    const jadi = [];
    for (const it of items) {
      const b = ref.find(x => String(x.id_barang).trim() === String(it.id || '').trim());
      if (!b) return res.status(400).json({ sukses: false, pesan: `ID ${it.id} tidak dikenal.` });
      const qty = Number(it.qty);
      if (!qty || qty <= 0) return res.status(400).json({ sukses: false, pesan: `Jumlah ${b.nama_barang} tidak valid.` });
      jadi.push({
        id: b.id_barang,
        nama: b.nama_barang,
        varian: b.varian || '',
        satuan: b.satuan || 'Pcs',
        qtyPesan: qty,
      });
    }

    const sekarang = new Date();
    const { batchLabel, kirimLabel } = hitungSlot(sekarang);
    const pemesan = String(namaPemesan).trim();
    const tok = String(req.params.token).trim();

    // Gabung sehati: tempel ke BARU milik token yang dibuat hari-Jakarta ini juga.
    // Hanya BARU (yang sudah diputus melahirkan pengiriman + potong stock, tak boleh ditempel).
    let target = null;
    try {
      const sb2 = await sb.from('pesanan').select('*').eq('token_outlet', tok).eq('status', 'BARU').order('dibuat_pada', { ascending: false });
      if (!sb2.error) {
        const hariIni = jakartaParts(sekarang).ymd;
        target = (sb2.data || []).find(x => x.dibuat_pada && jakartaParts(new Date(x.dibuat_pada)).ymd === hariIni) || null;
      }
    } catch { target = null; }

    if (target) {
      let lama = target.items_json;
      if (typeof lama === 'string') { try { lama = JSON.parse(lama || '[]'); } catch { lama = []; } }
      if (!Array.isArray(lama)) lama = [];
      for (const it of jadi) {
        const sama = lama.find(x => String(x.id) === String(it.id));
        if (sama) sama.qtyPesan = Number(sama.qtyPesan) + Number(it.qtyPesan);
        else lama.push(it);
      }
      const ringkasanGabung = buatRingkasan(lama.map(it => ({ nama: it.nama, qtyPesan: it.qtyPesan, keputusan: 'BARU' })));
      const up = await sb.from('pesanan').update({
        items_json: lama,
        ringkasan: ringkasanGabung,
        riwayat_status: tambahRiwayat(target.riwayat_status, `Digabung via link outlet oleh ${pemesan}`),
      }).eq('id_pesan', target.id_pesan).select();
      if (up.error) throw new Error(up.error.message);
      console.log(`*PESANAN DIGABUNG ${target.id_pesan}*\nOutlet: ${outlet.nama_outlet} (oleh ${pemesan})\n${ringkasanGabung}\nBatch: ${batchLabel} | Rencana kirim: ${kirimLabel}`);
      await tulisNotifikasi(`PESANAN DIGABUNG ${target.id_pesan}`,
        `${outlet.nama_outlet} (oleh ${pemesan}): ${ringkasanGabung}`, target.id_pesan);
      return res.json({ sukses: true, idPesan: target.id_pesan, digabung: true, batchMasuk: batchLabel, rencanaKirim: kirimLabel, pesan: `Pesanan digabung ke ${target.id_pesan} (masih hari yang sama). Batch ${batchLabel}, rencana kirim ${kirimLabel}.` });
    }

    const idPesan = await buatIdPesan();
    const ringkasan = buatRingkasan(jadi.map(it => ({ nama: it.nama, qtyPesan: it.qtyPesan, keputusan: 'BARU' })));
    const ins = await sb.from('pesanan').insert({
      id_pesan: idPesan,
      token_outlet: String(req.params.token).trim(),
      outlet: outlet.nama_outlet,
      tanggal_pemesanan: formatWaktuBukti(sekarang),
      tanggal_pengiriman: kirimLabel,
      status: 'BARU',
      items_json: jadi,
      ringkasan,
      riwayat_status: `${formatWaktuBukti(sekarang)} - Dibuat via link outlet oleh ${pemesan}`,
      dibuat_pada: nowIso(),
    });
    if (ins.error) throw new Error(ins.error.message);

    // Jejak pesanan di log (lonceng dalam-web menyusul)
    console.log(`*PESANAN BARU ${idPesan}*\nOutlet: ${outlet.nama_outlet} (oleh ${pemesan})\n${ringkasan}\nBatch: ${batchLabel} | Rencana kirim: ${kirimLabel}`);
    await tulisNotifikasi(`PESANAN BARU ${idPesan}`,
      `${outlet.nama_outlet} (oleh ${pemesan}): ${ringkasan}`, idPesan);

    res.json({ sukses: true, idPesan, batchMasuk: batchLabel, rencanaKirim: kirimLabel, pesan: `Pesanan ${idPesan} tercatat (BARU). Batch ${batchLabel}, rencana kirim ${kirimLabel}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ---- Keputusan per item + reset-link (T2b) ----

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

// Gudang: putus per item (PENUHI penuh / TOLAK + keterangan). Hanya dari BARU (anti dobel-putus).
// Urutan tulis: validasi stock semua item penuhi -> buatPengiriman internal -> update Pesanan.
app.post('/api/pesanan/:id/keputusan', wajibGudang, async (req, res) => {
  try {
    const pesanan = await cariPesanan(req.params.id);
    if (!pesanan) return res.status(404).json({ sukses: false, pesan: 'ID Pesan tidak ditemukan.' });
    if (String(pesanan.status).trim() !== 'BARU') {
      return res.status(409).json({ sukses: false, pesan: `Status ${pesanan.status}, keputusan hanya untuk BARU.` });
    }
    const { items } = req.body;
    let lama = pesanan.items_json;
    if (typeof lama === 'string') { try { lama = JSON.parse(lama || '[]'); } catch { lama = []; } }
    if (!Array.isArray(lama)) lama = [];
    if (!Array.isArray(items) || items.length !== lama.length) {
      return res.status(400).json({ sukses: false, pesan: 'Keputusan harus mencakup semua item pesanan.' });
    }
    // Cocokkan by POSISI (ID bisa kembar: '-', duplikat migrasi). Syarat: multiset ID sama
    // (diurutkan) agar urutan tertukar tertolak, bukan salah pasang.
    const kunci = (arr) => arr.map(it => String(it.id)).sort().join('|');
    if (kunci(items) !== kunci(lama)) {
      return res.status(400).json({ sukses: false, pesan: 'ID item keputusan tidak cocok dengan pesanan.' });
    }
    const putus = lama.map((asli, idx) => {
      const k = items[idx];
      const kep = String(k.keputusan || '').trim().toUpperCase();
      if (!['PENUHI', 'TOLAK'].includes(kep)) throw new Error(`Item "${asli.nama}": keputusan harus PENUHI/TOLAK.`);
      const keterangan = String(k.keterangan || '').trim();
      if (kep === 'TOLAK' && !keterangan) throw new Error(`Item "${asli.nama}": keterangan wajib karena ditolak.`);
      const minta = Number(asli.qtyPesan);
      let qtyKirim = kep === 'PENUHI' ? minta : 0;
      // Parsial: PENUHI boleh kurang dari pesan + keterangan wajib (tanpa backorder, sisa hangus)
      if (kep === 'PENUHI' && k.qtyKirim != null && String(k.qtyKirim) !== '') {
        qtyKirim = Number(k.qtyKirim);
        if (!Number.isFinite(qtyKirim) || qtyKirim <= 0 || qtyKirim > minta) {
          throw new Error(`Item "${asli.nama}": jumlah kirim harus 1–${minta}.`);
        }
        if (qtyKirim < minta && !keterangan) {
          throw new Error(`Item "${asli.nama}": keterangan wajib karena dikirim sebagian.`);
        }
      }
      return { ...asli, keputusan: kep, qtyKirim, keterangan };
    });
    const penuhi = putus.filter(it => it.keputusan === 'PENUHI');
    // ponytail: tanpa alasan umum — tiap TOLAK wajib keterangan per item (cukup sebagai alasan)

    let idKirim = null;
    let status;
    if (penuhi.length === 0) {
      status = 'DITOLAK'; // terminal: tanpa pengiriman, tanpa kurang stock
    } else {
      const br = await sb.from('barang_inventory').select('*');
      if (br.error) throw new Error(br.error.message);
      const ref = br.data;
      for (const it of penuhi) {
        const b = ref.find(x => String(x.id_barang).trim() === String(it.id).trim());
        if (!b) return res.status(400).json({ sukses: false, pesan: `ID ${it.id} tidak dikenal.` });
        if (Number(it.qtyKirim) > Number(b.total)) {
          return res.status(400).json({ sukses: false, pesan: `Stock ${b.nama_barang} kurang (minta ${it.qtyKirim}, sisa ${b.total}).` });
        }
      }
      const hasil = await buatPengiriman(
        pesanan.outlet,
        penuhi.map(it => ({ id: it.id, jumlah: it.qtyKirim })),
        String(pesanan.id_pesan).trim()
      );
      idKirim = hasil.idKirim;
      const parsial = penuhi.some(it => Number(it.qtyKirim) < Number(it.qtyPesan));
      status = (penuhi.length === putus.length && !parsial) ? 'DISETUJUI' : 'DISETUJUI SEBAGIAN';
    }

    await simpanPesanan({
      ...pesanan,
      items_json: putus,
      ringkasan: buatRingkasan(putus.map(it => ({ nama: it.nama, qtyPesan: it.qtyPesan, qtyKirim: it.qtyKirim, keputusan: it.keputusan, keterangan: it.keterangan }))),
      status,
      riwayat_status: tambahRiwayat(pesanan.riwayat_status, status === 'DITOLAK' ? 'Ditolak semua (lihat keterangan per item)' : `Diputus ${status}${idKirim ? ` (${idKirim})` : ''}`),
    });

    res.json({ sukses: true, status, idKirim, pesan: status === 'DITOLAK' ? `Pesanan ${pesanan.id_pesan} DITOLAK.` : `Pesanan ${pesanan.id_pesan} ${status}, pengiriman ${idKirim} SIAP KIRIM.` });
  } catch (err) {
    console.error(err);
    res.status(400).json({ sukses: false, pesan: err.message });
  }
});

function tokenOutletBaru() {
  const abjad = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.randomBytes(8)).map(b => abjad[b % abjad.length]).join('');
}

// Link lama mati otomatis (lookup by token); wajib sesi gudang.
app.post('/api/outlet/:slug/reset-link', wajibGudang, async (req, res) => {
  try {
    const target = String(req.params.slug || '').trim().toLowerCase();
    const token = tokenOutletBaru();
    const up = await sb.from('outlet').update({ token }).eq('slug', target).select('slug');
    if (up.error) throw new Error(up.error.message);
    if (!up.data || up.data.length === 0) return res.status(404).json({ sukses: false, pesan: 'Slug outlet tidak ditemukan.' });
    const slug = up.data[0].slug;
    res.json({ sukses: true, slug, token, link: `/pesan/${slug}-${token}`, pesan: `Link baru ${slug} aktif. Link lama mati.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ---- Login gudang tahap 1 (2026-09-14): 1 kredensial bersama, tabel `gudang` id=1 ----
// Skema aktual (milik user): id | password_gudang (scrypt) | created_at.
// Tanpa dep baru: scrypt via crypto bawaan, cookie diparse manual, sesi opaque di memori.

// Hash format `scrypt$salt$hash` (pola sama untuk password outlet menyusul).
function hashKataSandi(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plain || ''), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function cekKataSandi(plain, tersimpan) {
  try {
    const [tag, salt, hash] = String(tersimpan || '').split('$');
    if (tag !== 'scrypt' || !salt || !hash) return false;
    const cek = crypto.scryptSync(String(plain || ''), salt, 64).toString('hex');
    const a = Buffer.from(cek, 'hex'), b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

// Rate-limit geser 10/mnt per kunci (login gudang; login outlet menyusul pola sama).
const emberRate = new Map(); // kunci -> [ms, ...]
function kenaRate(kunci, batas = 10, jendelaMs = 60000) {
  const kini = Date.now();
  const list = (emberRate.get(kunci) || []).filter(t => kini - t < jendelaMs);
  if (list.length >= batas) { emberRate.set(kunci, list); return true; }
  list.push(kini);
  emberRate.set(kunci, list);
  return false;
}

function bacaCookie(req, nama) {
  const h = req.headers.cookie || '';
  for (const pot of h.split(';')) {
    const i = pot.indexOf('=');
    if (i < 0) continue;
    if (pot.slice(0, i).trim() === nama) return decodeURIComponent(pot.slice(i + 1).trim());
  }
  return '';
}

const sesiGudang = new Map(); // token -> expMs (restart server = logout ulang, password tetap)
const UMUR_SESI_GUDANG_MS = 24 * 3600 * 1000;
function wajibGudang(req, res, next) {
  if (String(process.env.GUDANG_GATE || '').toLowerCase() === 'off') return next(); // kill-switch uji
  const tok = bacaCookie(req, 'sesi_gudang');
  const exp = tok ? sesiGudang.get(tok) : 0;
  if (!tok || !exp || exp < Date.now()) {
    if (tok) sesiGudang.delete(tok);
    return res.status(401).json({ error: 'Login gudang dulu.' });
  }
  next();
}

app.post('/api/gudang/masuk', async (req, res) => {
  try {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || '?';
    if (kenaRate(`gudang:${ip}`)) {
      return res.status(429).json({ sukses: false, pesan: 'Terlalu banyak percobaan. Tunggu sebentar.' });
    }
    const { password } = req.body || {};
    const r = await sb.from('gudang').select('*').eq('id', 1).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    if (!r.data) {
      return res.status(401).json({ sukses: false, pesan: 'Password gudang belum di-set. Minta ke developer.' });
    }
    if (!cekKataSandi(password, r.data.password_gudang)) {
      return res.status(401).json({ sukses: false, pesan: 'Password salah.' });
    }
    const tok = crypto.randomBytes(32).toString('hex');
    sesiGudang.set(tok, Date.now() + UMUR_SESI_GUDANG_MS);
    res.setHeader('Set-Cookie', `sesi_gudang=${tok}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`);
    res.json({ sukses: true, pesan: 'Masuk sebagai gudang.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

app.post('/api/gudang/keluar', (req, res) => {
  const tok = bacaCookie(req, 'sesi_gudang');
  if (tok) sesiGudang.delete(tok);
  res.setHeader('Set-Cookie', 'sesi_gudang=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  res.json({ sukses: true, pesan: 'Keluar.' });
});

app.get('/api/gudang/sesi', (req, res) => {
  if (String(process.env.GUDANG_GATE || '').toLowerCase() === 'off') return res.json({ masuk: true });
  const tok = bacaCookie(req, 'sesi_gudang');
  const exp = tok ? sesiGudang.get(tok) : 0;
  if (!tok || !exp || exp < Date.now()) {
    if (tok) sesiGudang.delete(tok);
    return res.status(401).json({ masuk: false });
  }
  res.json({ masuk: true });
});

// Ganti password: SELALU wajib sesi (tanpa bootstrap terbuka; seed awal via SQL developer).
app.post('/api/gudang/password', wajibGudang, async (req, res) => {
  try {
    const { password, konfirmasi } = req.body || {};
    if (!password || String(password).length < 4) {
      return res.status(400).json({ sukses: false, pesan: 'Password minimal 4 karakter.' });
    }
    if (password !== konfirmasi) {
      return res.status(400).json({ sukses: false, pesan: 'Ketik ulang tidak sama.' });
    }
    const up = await sb.from('gudang').update({ password_gudang: hashKataSandi(password) }).eq('id', 1).select('id');
    if (up.error) throw new Error(up.error.message);
    if (!up.data || up.data.length === 0) {
      return res.status(400).json({ sukses: false, pesan: 'Baris password gudang (id=1) tidak ada. Buat via SQL dulu.' });
    }
    res.json({ sukses: true, pesan: 'Password gudang diganti.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// Gudang-internal (konsisten: /api/pengiriman pun memuat token). Dipakai Kelola Link (Tab Lainnya).
app.get('/api/outlet', wajibGudang, async (req, res) => {
  try {
    const r = await sb.from('outlet').select('*').order('nama_outlet', { ascending: true });
    if (r.error) throw new Error(r.error.message);
    res.json(r.data.map(o => ({
      slug: o.slug,
      outlet: o.nama_outlet,
      token: o.token || '',
      link: `/pesan/${o.slug}-${o.token || ''}`,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback (prod port 3000): link langsung seperti /terima/:token harus
// dilayani index.html, bukan 404. Express 5: '/{*splat}'. Dilewati untuk /api.
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html'));
});

// Self-check Step 0.2 (tanpa konek Sheets): node server.js --self-check
if (require.main === module && process.argv.includes('--self-check')) {
  // ponytail: jam input ditulis dalam WIB, konversi manual ke UTC (WIB = UTC+7)
  const wib = (y, m, d, h, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 7, min));
  const kasus = [
    // [label, input WIB, expBatch, expKirim]
    ['Senin 10:00', wib(2026, 9, 7, 10), '2026-09-07', '2026-09-10'],
    ['Senin 16:00', wib(2026, 9, 7, 16), '2026-09-10', '2026-09-14'],
    ['Selasa 09:00', wib(2026, 9, 8, 9), '2026-09-10', '2026-09-14'],
    ['Rabu 09:00', wib(2026, 9, 9, 9), '2026-09-10', '2026-09-14'],
    ['Kamis 10:00', wib(2026, 9, 10, 10), '2026-09-10', '2026-09-14'],
    ['Kamis 16:00', wib(2026, 9, 10, 16), '2026-09-14', '2026-09-17'],
    ['Jumat 09:00', wib(2026, 9, 11, 9), '2026-09-14', '2026-09-17'],
  ];
  let gagal = 0;
  for (const [label, input, expBatch, expKirim] of kasus) {
    const { batchMasuk, rencanaKirim } = hitungSlot(input);
    const ok = batchMasuk === expBatch && rencanaKirim === expKirim;
    if (!ok) gagal++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> masuk ${batchMasuk} (exp ${expBatch}), kirim ${rencanaKirim} (exp ${expKirim})`);
  }
  console.log('Label:', formatTanggalSlot('2026-09-10'), '|', formatTanggalSlot('2026-09-14'));
  console.log('Waktu:', formatWaktuBukti(wib(2026, 9, 8, 8, 5)));
  console.log('Ringkasan:', buatRingkasan([
    { nama: 'Susu Greenfield 250ml', qtyKirim: 10, keputusan: 'PENUHI' },
    { nama: 'Gula Pasir 1kg', qtyPesan: 5, keputusan: 'TOLAK', keterangan: 'habis' },
  ]));
  console.log('RingkasanKirim:', buatRingkasanKirim([{ nama: 'Pasta', qtyKirim: '10 -> 9' }]));
  console.log('Alasan:', buatAlasan([{ nama: 'Pasta', keterangan: '1 nya tidak ada didalam kardus' }]));
  const avgKasus = [
    // [label, avgLama, totalLama, totalBayar, qtyMasuk, expAvg]
    ['baru 10pcs@50rb', null, 0, 500000, 10, 50000],
    ['tambah 10pcs@65rb', 50000, 10, 650000, 10, 57500],
    ['tanpa bayar', 57500, 20, null, 5, null],
  ];
  for (const [label, a, t, b, q, exp] of avgKasus) {
    const hasil = hitungAvg(a, t, b, q);
    const ok = hasil === exp;
    if (!ok) gagal++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} avg ${label} -> ${hasil} (exp ${exp})`);
  }
  process.exit(gagal ? 1 : 0);
}

// Jalankan server setelah Supabase siap (5 tabel)
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server jalan di http://localhost:${PORT}`);
    });
    scheduleRandomSampling();
  })
  .catch(err => {
    console.error('Gagal init data:', err.message);
    process.exit(1);
  });