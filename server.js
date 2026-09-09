require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require("./ss-inventory-bot-key");

const app = express();
const PORT = process.env.PORT;

const spreadsheet_id = process.env.SPREADSHEET_ID;

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
    const qty = it.qtyKirim ?? it.qtyPesan ?? it.jumlah ?? '?';
    const ket = it.keputusan || it.status || '';
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

// Data: Supabase (barang_inventory, transaksi, pesanan, pengiriman) + Google Sheets KHUSUS Outlet.
// Akses Supabase terpusat di db.js; kode di bawah tidak menyentuh Sheet selain Outlet.
const { sb, nowIso, nextIdTransaksi, kurangStock } = require('./db');

// Google Sheets HANYA untuk tab Outlet (pengecualian sadar, link permanen)
const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const doc = new GoogleSpreadsheet(spreadsheet_id, serviceAccountAuth);

const Sheet_Outlet = 'Outlet';

let sheetOutlet;

async function initDb() {
  for (const t of ['barang_inventory', 'transaksi', 'pesanan', 'pengiriman']) {
    const r = await sb.from(t).select('*', { count: 'exact', head: true });
    if (r.error) throw new Error(`Tabel Supabase "${t}" tak terbaca: ${r.error.message}`);
  }
  console.log('Supabase terhubung (4 tabel).');
}

async function initOutlet() {
  await doc.loadInfo();
  sheetOutlet = doc.sheetsByTitle[Sheet_Outlet];
  if (!sheetOutlet) {
    throw new Error(`Tab "${Sheet_Outlet}" tidak ditemukan di spreadsheet. Link outlet nonaktif sampai dibuat.`);
  }
  await sheetOutlet.loadHeaderRow();
  console.log('Outlet live di Google Sheets:', doc.title);
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
  };
  if (!untukOutlet) {
    data.riwayat = row.riwayat_status || '';
    data.token = row.token || null;
  }
  return data;
}

async function simpanPengiriman(row) {
  const r = await sb.from('pengiriman').update({
    token: row.token, tanggal_kirim: row.tanggal_kirim, status: row.status,
    items_json: row.items_json, ringkasan: row.ringkasan, alasan: row.alasan,
    nama_penerima: row.nama_penerima, tanggal_terima: row.tanggal_terima,
    riwayat_status: row.riwayat_status,
  }).eq('id_kirim', row.id_kirim).select();
  if (r.error) throw new Error(r.error.message);
  return r.data[0];
}

async function catatTransaksi(id, nama, varian, kategori, jenis_transaksi, jumlah, satuan, idKirim = null) {
  const r = await sb.from('transaksi').insert({
    id_transaksi: await nextIdTransaksi(),
    id_barang: id,
    nama_barang: nama,
    varian: varian || '',
    kategori: kategori || '',
    jenis: jenis_transaksi,
    jumlah: Number(jumlah),
    satuan: satuan || 'Pcs',
    id_kirim: idKirim,
    dibuat_pada: nowIso(),
  }).select('id_transaksi');
  if (r.error) throw new Error(r.error.message);
  return r.data[0].id_transaksi;
}

async function cekThresholdDanKirimWA(id, nama, stockSekarang, threshold){
  if (stockSekarang > threshold){
    return;
  } else if (stockSekarang <= threshold){
    const pesan = 
    `*REMINDER STOCK!*\n` +
    `ID: ${id}\n` +
    `Barang: ${nama}\n` +
    `Stock Sekarang: ${stockSekarang}\n\n` +
    `*LAKUKAN RESTOCK SECEPATNYA!*`
    
    await kirimPesan(pesan);
  }
}

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
      pesan += `- Nama Barang: ${row.nama_barang} \n Jumlah Stock: ${row.jumlah_stock} \n`;
    });

    await kirimPesan(pesan);
    console.log('Random Sampling reminder terkirim.')
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

//Function set Fonnte
async function kirimPesan(pesan){
  const token = process.env.FONNTE_TOKEN;
  const target = process.env.TARGET_NUMBER;
  
  if(!token || !target){
    console.error("Token dan Nomor Target Belum disimpan!");
    return;
  }

  try{
    const res = await fetch('https://api.fonnte.com/send', {
      method:'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        target, 
        message: pesan
      })
    });
    const hasil = await res.json();
    console.log('Fonnte response', hasil);
  }catch(err){
    console.log(`Gagal mengirim pesan ke WA ${err.message}`);
  }
}

// Cek apakah ID barang sudah ada
app.get('/api/cekBarang/:id', async (req, res) => {
  try {
    const id = req.params.id.trim();
    const r = await sb.from('barang_inventory').select('*').eq('id_barang', id).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    const row = r.data;

    if (row) {
      res.json({
        ditemukan: true,
        id: row.id_barang,
        nama: row.nama_barang,
        varian: row.varian,
        kategori: row.kategori,
        stock: Number(row.jumlah_stock),
        threshold: Number(row.batas_restock),
        satuanEceran: row.satuan_eceran || 'Pcs',
        satuanGrosir: row.satuan_grosir || null,
        isiPerGrosir: row.isi_per_grosir ? Number(row.isi_per_grosir) : null
      });
    } else {
      res.json({ ditemukan: false, id });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/barang", async (req, res) => {
  try{
    const r = await sb.from('barang_inventory').select('*').order('dibuat_pada', { ascending: true });
    if (r.error) throw new Error(r.error.message);
    const data = r.data.map(row => ({
      id: row.id_barang,
      nama: row.nama_barang,
      varian: row.varian,
      kategori: row.kategori,
      stock: Number(row.jumlah_stock),
      threshold: Number(row.batas_restock),
      satuanEceran: row.satuan_eceran || 'Pcs',
      satuanGrosir: row.satuan_grosir || null,
      isiPerGrosir: row.isi_per_grosir ? Number(row.isi_per_grosir) : null
    }));
    res.json(data);
  }catch (err){
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

app.get("/api/transaksi", async(req, res) => {
  try{
    const r = await sb.from('transaksi').select('*').order('dibuat_pada', { ascending: true });
    if (r.error) throw new Error(r.error.message);
    const data = r.data.map(row => ({
      timestamp: row.dibuat_pada ? formatWaktuBukti(row.dibuat_pada) : '-',
      idBarang: row.id_barang,
      nama: row.nama_barang,
      kategori: row.kategori,
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

// Tambah barang baru
app.post('/api/tambahBarangBaru', async (req, res) => {
  try {
    const { id, nama, varian, kategori, jumlah, restock, satuanEceran, satuanGrosir, isiPerGrosir } = req.body;
    const cek = await sb.from('barang_inventory').select('id_barang,nama_barang').eq('id_barang', String(id).trim()).maybeSingle();
    if (cek.error) throw new Error(cek.error.message);
    const ditemukan = cek.data;

    if (ditemukan) {
      return res.status(409).json({
        sukses: false,
        pesan: `ID Produk ${id} sudah terdaftar sebagai ${ditemukan.nama_barang}. Check kembali ID Produk yang akan dimasukkan.`
      });
    }

    if (!satuanGrosir || !isiPerGrosir) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Nama Kemasan dan Isi per Kemasan wajib diisi untuk setiap barang.'
      });
    }

    const ins = await sb.from('barang_inventory').insert({
      id_barang: id,
      nama_barang: nama,
      varian: varian || '',
      kategori: kategori || '',
      jumlah_stock: Number(jumlah),
      batas_restock: Number(restock) || 5,
      satuan_eceran: satuanEceran || 'Pcs',
      satuan_grosir: satuanGrosir,
      isi_per_grosir: Number(isiPerGrosir),
      dibuat_pada: nowIso(),
    });
    if (ins.error) throw new Error(ins.error.message);

    await catatTransaksi(id, nama, varian, kategori, 'Masuk', jumlah, satuanEceran || 'Pcs');

    res.json({ sukses: true, pesan: `Barang baru ${nama} tersimpan ke database. Stock awal: ${jumlah} ${satuanEceran || 'Pcs'}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal menyimpan: ' + err.message });
  }
});

// Proses transaksi masuk/keluar-
app.post('/api/prosesTransaksi', async (req, res) => {
  try {
    const { id, jenis, jumlah, satuanInput } = req.body;
    const b = await sb.from('barang_inventory').select('*').eq('id_barang', String(id).trim()).maybeSingle();
    if (b.error) throw new Error(b.error.message);
    const row = b.data;

    if (!row) {
      return res.json({ sukses: false, pesan: 'Barang tidak ditemukan di database.' });
    }

    const satuanEceran = row.satuan_eceran || 'Pcs';
    const satuanGrosir = row.satuan_grosir || null;
    const isiPerGrosir = row.isi_per_grosir ? Number(row.isi_per_grosir) : null;

    const jumlahInput = Number(jumlah);
    let jmlh;

    if (satuanInput && satuanGrosir && satuanInput === satuanGrosir) {
      if (!isiPerGrosir) {
        return res.json({ sukses: false, pesan: `Barang ini belum punya konversi "Isi per Grosir" yang valid.` });
      }
      jmlh = jumlahInput * isiPerGrosir; // misal 2 Box x 24 Pcs = 48 Pcs
    } else {
      jmlh = jumlahInput; // input langsung dalam Satuan Eceran
    }

    let stockBaru = Number(row.jumlah_stock);

    if (jenis === 'Masuk') {
      const up = await sb.from('barang_inventory').update({ jumlah_stock: stockBaru + jmlh }).eq('id_barang', row.id_barang).select('jumlah_stock');
      if (up.error) throw new Error(up.error.message);
      stockBaru = Number(up.data[0].jumlah_stock);
    } else if (jenis === 'Keluar') {
      if (jmlh > stockBaru) {
        return res.json({ sukses: false, pesan: `Stock ${row.nama_barang} yang keluar melebihi stock saat ini. \n ${stockBaru} ${satuanEceran}`});
      }
      const hasil = await kurangStock(row.id_barang, jmlh); // atomik: gagal bila kalah balapan
      if (!hasil.ok) {
        return res.json({ sukses: false, pesan: `Stock ${row.nama_barang} berubah saat diproses (sisa ${hasil.sisa}). Ulangi transaksi.` });
      }
      stockBaru = hasil.sisa;
    } else {
      return res.json({ sukses: false, pesan: 'Jenis transaksi tidak valid.' });
    }

    const keteranganSatuan = satuanInput && satuanInput === satuanGrosir
      ? `${jumlahInput} ${satuanGrosir} (= ${jmlh} ${satuanEceran})`
      : `${jmlh} ${satuanEceran}`;

    await catatTransaksi(row.id_barang,
                        row.nama_barang,
                        row.varian,
                        row.kategori,
                        jenis,
                        jmlh,
                        satuanEceran);
    await cekThresholdDanKirimWA(
      row.id_barang,
      row.nama_barang,
      stockBaru,
      Number(row.batas_restock)
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

//Kirim pesan WA
app.post('/api/sendMessage', async (req, res) => {
  try{
    const { pesan } = req.body;

    if (!pesan){
      return res.status(400).json({sukses: false, pesan: "Isi Pesan terlebih dahulu"});
    }

    await kirimPesan(pesan);
    res.json({sukses: true, pesan: "Pesan Reminder Terkirim!"});
  } catch(err){
    console.error(err);
    res.status(500).json({sukses: false, pesan:`Pesan gagal terkirim, ${err.message}`});
  }
});

// ---- Pengiriman gudang -> outlet (Step 1 / T1) ----

// Buat pengiriman manual (Kirim Susulan / Non-Pesanan). T2: fungsi inti ini dipakai ulang
// secara internal oleh approve pesanan (tanpa endpoint).
async function buatPengiriman(outlet, items, idPesan = null) {
  if (!outlet || !String(outlet).trim()) throw new Error('Nama outlet wajib diisi.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Minimal 1 item.');

  const ref = await sb.from('barang_inventory').select('*');
  if (ref.error) throw new Error(ref.error.message);
  const siap = [];
  for (const it of items) {
    const row = ref.data.find(r => String(r.id_barang).trim() === String(it.id || '').trim());
    if (!row) throw new Error(`ID ${it.id} tidak ditemukan di database.`);
    const qty = Number(it.jumlah);
    if (!qty || qty <= 0) throw new Error(`Jumlah ${row.nama_barang} tidak valid.`);
    const stock = Number(row.jumlah_stock);
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

  // Tulis berurutan hormati FK: stock+transaksi (id_kirim NULL dulu) -> kirim -> link.
  // Gagal di tengah (balapan stock) -> kompensasi: kembalikan stock + hapus jejak, lalu throw.
  const jejak = []; // [{id_transaksi, id_barang, qty}]
  try {
    for (const { row, qty } of siap) {
      const hasil = await kurangStock(row.id_barang, qty);
      if (!hasil.ok) throw new Error(`Stock ${row.nama_barang} berubah saat diproses (sisa ${hasil.sisa}). Ulangi.`);
      const idTrx = await catatTransaksi(row.id_barang, row.nama_barang, row.varian,
        row.kategori, 'Keluar', qty, row.satuan_eceran || 'Pcs', null);
      jejak.push({ id_transaksi: idTrx, id_barang: row.id_barang, qty });
      await cekThresholdDanKirimWA(row.id_barang, row.nama_barang,
        hasil.sisa, Number(row.batas_restock));
    }
  } catch (e) {
    for (const j of jejak) {
      try {
        const cur = await sb.from('barang_inventory').select('jumlah_stock').eq('id_barang', j.id_barang).single();
        if (cur.data) await sb.from('barang_inventory').update({ jumlah_stock: Number(cur.data.jumlah_stock) + j.qty }).eq('id_barang', j.id_barang);
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
  // Tautkan jejak transaksi ke kiriman (FK kini valid karena baris kirim sudah ada)
  try {
    for (const j of jejak) {
      const lk = await sb.from('transaksi').update({ id_kirim: idKirim }).eq('id_transaksi', j.id_transaksi);
      if (lk.error) throw new Error(lk.error.message);
    }
  } catch (e) {
    for (const j of jejak) {
      try {
        const cur = await sb.from('barang_inventory').select('jumlah_stock').eq('id_barang', j.id_barang).single();
        if (cur.data) await sb.from('barang_inventory').update({ jumlah_stock: Number(cur.data.jumlah_stock) + j.qty }).eq('id_barang', j.id_barang);
        await sb.from('transaksi').delete().eq('id_transaksi', j.id_transaksi);
      } catch { /* kompensasi best-effort */ }
    }
    await sb.from('pengiriman').delete().eq('id_kirim', idKirim).catch(() => {});
    throw e;
  }
  return { idKirim, ringkasan };
}

app.post('/api/pengiriman', async (req, res) => {
  try {
    const { outlet, items } = req.body;
    const hasil = await buatPengiriman(outlet, items);
    res.json({ sukses: true, ...hasil, pesan: `Pengiriman ${hasil.idKirim} dibuat (SIAP KIRIM). Klik Tandai Dikirim saat paket lepas.` });
  } catch (err) {
    console.error(err);
    res.status(400).json({ sukses: false, pesan: err.message });
  }
});

app.get('/api/pengiriman', async (req, res) => {
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
// Gerbang scan keluar (wajib): pindaian harus mencakup eksak semua ID line kiriman.
app.post('/api/pengiriman/:id/kirim', async (req, res) => {
  try {
    const row = await cariPengiriman(req.params.id);
    if (!row) return res.status(404).json({ sukses: false, pesan: 'ID Kirim tidak ditemukan.' });
    if (row.status !== 'SIAP KIRIM') {
      return res.status(409).json({ sukses: false, pesan: `Status ${row.status}, hanya SIAP KIRIM yang bisa dikirim.` });
    }
    let dikirim = row.items_json;
    if (typeof dikirim === 'string') { try { dikirim = JSON.parse(dikirim || '[]'); } catch { dikirim = []; } }
    if (!Array.isArray(dikirim)) dikirim = [];
    const { pindaian } = req.body || {};
    if (!Array.isArray(pindaian) || pindaian.length === 0) {
      return res.status(409).json({ sukses: false, pesan: 'Belum ada line terpindai. Pindai semua barang kiriman dulu.' });
    }
    const setKirim = new Set(dikirim.map(it => String(it.id)));
    const setPindai = new Set(pindaian.map(p => String(p.id)));
    const kurang = [...setKirim].filter(id => !setPindai.has(id));
    if (kurang.length) {
      return res.status(409).json({ sukses: false, pesan: `Belum terpindai: ${kurang.join(', ')}.` });
    }
    const asing = [...setPindai].filter(id => !setKirim.has(id));
    if (asing.length) {
      return res.status(400).json({ sukses: false, pesan: `ID asing bukan bagian kiriman: ${asing.join(', ')}.` });
    }
    const caraMap = {};
    for (const p of pindaian) caraMap[String(p.id)] = p.cara === 'manual' ? 'manual' : 'scan';
    const hasil = dikirim.map(it => ({ ...it, dipindai: true, cara: caraMap[String(it.id)] }));
    const token = crypto.randomUUID();
    row.items_json = hasil;
    row.token = token;
    row.tanggal_kirim = formatWaktuBukti();
    row.status = 'DIKIRIM';
    row.riwayat_status = tambahRiwayat(row.riwayat_status, `Dipindai keluar: ${hasil.map(it => `${it.nama} (${it.cara})`).join(', ')}`);
    row.riwayat_status = tambahRiwayat(row.riwayat_status, 'Dikirim (link berita acara aktif)');
    await simpanPengiriman(row);
    await mirrorPesanan(row.id_pesan, 'DIKIRIM', 'Dikirim (link berita acara aktif)');
    // WA admin fire-and-forget (path saja: domain publik tak dikenal server; URL penuh via Salin)
    kirimPesan(`*LINK BERITA ACARA*\nKirim ${row.id_kirim} ke ${row.outlet} DIKIRIM.\nLink: /terima/${token}\nTeruskan ke outlet via WA.`);
    res.json({ sukses: true, token, pesan: `Pengiriman ${row.id_kirim} DIKIRIM. Kirim link berita acara ke outlet via WA.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// Batalkan Pengiriman: DIKIRIM -> SIAP KIRIM (hanya sebelum outlet lapor + alasan wajib)
app.post('/api/pengiriman/:id/batal-kirim', async (req, res) => {
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
    const { namaPenerima, items } = req.body;
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
    row.status = status;
    row.riwayat_status = tambahRiwayat(row.riwayat_status, `Dilaporkan outlet (${status}) oleh ${String(namaPenerima).trim()}`);
    await simpanPengiriman(row);
    await mirrorPesanan(row.id_pesan, status, `Dilaporkan outlet (${status})`);
    // WA admin fire-and-forget (gagal kirim tak menggagalkan laporan — kirimPesan aman)
    kirimPesan(`*LAPORAN TERIMA ${status}*\nKirim: ${row.id_kirim}${row.id_pesan ? ` (pesan ${row.id_pesan})` : ''}\nOutlet: ${row.outlet}\n${row.ringkasan || ''}${(row.alasan || '').trim() ? `\nAlasan: ${String(row.alasan).trim()}` : ''}\nPenerima: ${String(namaPenerima).trim()}`);
    res.json({ sukses: true, status, pesan: status === 'DITERIMA' ? 'Terima kasih! Laporan diterima penuh.' : 'Laporan diterima sebagian, gudang akan menindaklanjuti kekurangan.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ sukses: false, pesan: err.message });
  }
});

// ---- Pesanan outlet (T2a) ----

const HEADER_OUTLET = ['Slug', 'Token', 'Outlet'];
// P1b: status yang memblokir pesan baru (terminal: DITERIMA/DITERIMA SEBAGIAN/DITOLAK)
const STATUS_AKTIF_PESANAN = ['BARU', 'DISETUJUI', 'DISETUJUI SEBAGIAN', 'SIAP KIRIM', 'DIKIRIM'];

function butuhSheetOutlet(res) {
  if (!sheetOutlet) {
    res.status(503).json({ sukses: false, pesan: `Tab "${Sheet_Outlet}" belum ada di spreadsheet. Buat tab + header dulu (Step 0.1).` });
    return false;
  }
  const hilang = HEADER_OUTLET.filter(h => !sheetOutlet.headerValues.includes(h));
  if (hilang.length) {
    res.status(503).json({ sukses: false, pesan: `Header kurang di tab "${Sheet_Outlet}": ${hilang.join(', ')}. Samakan persis (huruf besar/kecil & spasi).` });
    return false;
  }
  return true;
}

// Auth link permanen: token saja, slug diabaikan (PRD seksi 6)
async function cariOutletByToken(token) {
  const rows = await sheetOutlet.getRows();
  return rows.find(r => String(r.get('Token') || '').trim() === String(token || '').trim());
}

async function buatIdPesan() {
  const today = jakartaParts(new Date()).ymd.replaceAll('-', '');
  const r = await sb.from('pesanan').select('id_pesan', { count: 'exact', head: true }).like('id_pesan', `PSN-${today}%`);
  if (r.error) throw new Error(r.error.message);
  return `PSN-${today}-${String((r.count || 0) + 1).padStart(3, '0')}`;
}

function pesananKeJson(row, linkTerima = null) {
  let items = row.items_json;
  if (typeof items === 'string') { try { items = JSON.parse(items || '[]'); } catch { items = []; } }
  if (!Array.isArray(items)) items = [];
  return {
    idPesan: row.id_pesan,
    outlet: row.outlet,
    tanggalPesan: row.tanggal_pesan,
    batchMasuk: row.batch_masuk,
    rencanaKirim: row.rencana_kirim,
    status: row.status,
    items,
    ringkasan: row.ringkasan || '',
    alasanTolak: row.alasan_tolak || '',
    linkTerima,
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
    alasan_tolak: row.alasan_tolak, riwayat_status: row.riwayat_status,
  }).eq('id_pesan', row.id_pesan).select();
  if (r.error) throw new Error(r.error.message);
  return r.data[0];
}

// Gudang: daftar semua pesanan, terbaru-di-atas
app.get('/api/pesanan', async (req, res) => {
  try {
    const r = await sb.from('pesanan').select('*').order('dibuat_pada', { ascending: false });
    if (r.error) throw new Error(r.error.message);
    res.json(r.data.map(x => pesananKeJson(x)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Outlet: 1x fetch untuk halaman pesan (identitas + katalog tanpa stock + jadwal + riwayat milik token)
app.get('/api/pesan/:token', async (req, res) => {
  try {
    if (!butuhSheetOutlet(res)) return;
    const outlet = await cariOutletByToken(req.params.token);
    if (!outlet) return res.status(404).json({ error: 'Link tidak valid.' });

    const br = await sb.from('barang_inventory').select('*').order('dibuat_pada', { ascending: true });
    if (br.error) throw new Error(br.error.message);
    const katalog = br.data.map(b => ({
      id: b.id_barang,
      nama: b.nama_barang,
      varian: b.varian || '',
      satuan: b.satuan_eceran || 'Pcs',
      kategori: b.kategori || '',
    }));

    const { batchLabel, kirimLabel } = hitungSlot(new Date());

    // Link berita acara lahir saat Tandai Dikirim (sebelumnya null = "belum dikirim")
    let tokenKirim = {};
    try {
      const dk = await sb.from('pengiriman').select('id_pesan,token').eq('status', 'DIKIRIM');
      if (dk.error) throw new Error(dk.error.message);
      for (const x of dk.data) {
        if ((x.token || '').trim() && x.id_pesan) tokenKirim[String(x.id_pesan).trim()] = String(x.token).trim();
      }
    } catch { tokenKirim = {}; }

    const sp = await sb.from('pesanan').select('*').eq('token_outlet', String(req.params.token).trim()).order('dibuat_pada', { ascending: false });
    if (sp.error) throw new Error(sp.error.message);
    const milik = sp.data.map(x => {
      const id = String(x.id_pesan || '').trim();
      const link = tokenKirim[id] ? `/terima/${tokenKirim[id]}` : null;
      return pesananKeJson(x, link);
    });
    const aktif = milik.find(x => STATUS_AKTIF_PESANAN.includes(String(x.status || '').trim()));

    res.json({
      outlet: outlet.get('Outlet'),
      slug: outlet.get('Slug'),
      jadwal: { batchMasuk: batchLabel, rencanaKirim: kirimLabel },
      katalog,
      riwayat: milik,
      bolehPesan: !aktif,
      pesananAktif: aktif ? { idPesan: aktif.idPesan, status: aktif.status, batchMasuk: aktif.batchMasuk, rencanaKirim: aktif.rencanaKirim } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Outlet (+ Tab Buat gudang): submit keranjang -> BARU + slot otomatis + WA admin
app.post('/api/pesan/:token', async (req, res) => {
  try {
    if (!butuhSheetOutlet(res)) return;
    const outlet = await cariOutletByToken(req.params.token);
    if (!outlet) return res.status(404).json({ sukses: false, pesan: 'Link tidak valid.' });

    const { namaPemesan, items } = req.body;
    if (!namaPemesan || !String(namaPemesan).trim()) {
      return res.status(400).json({ sukses: false, pesan: 'Nama pemesan wajib diisi.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ sukses: false, pesan: 'Keranjang masih kosong.' });
    }

    // P1b blokir total: 1 pesanan aktif per token (cek sesaat sebelum tulis)
    const sp = await sb.from('pesanan').select('id_pesan,status').eq('token_outlet', String(req.params.token).trim());
    if (sp.error) throw new Error(sp.error.message);
    const ada = sp.data.find(x => STATUS_AKTIF_PESANAN.includes(String(x.status || '').trim()));
    if (ada) {
      return res.status(409).json({ sukses: false, pesan: `Masih ada pesanan aktif ${ada.id_pesan} (status ${ada.status}). Selesaikan dulu sebelum pesan baru.` });
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
        satuan: b.satuan_eceran || 'Pcs',
        qtyPesan: qty,
      });
    }

    const sekarang = new Date();
    const { batchLabel, kirimLabel } = hitungSlot(sekarang);
    const idPesan = await buatIdPesan();
    const ringkasan = buatRingkasan(jadi.map(it => ({ nama: it.nama, qtyPesan: it.qtyPesan, keputusan: 'BARU' })));
    const pemesan = String(namaPemesan).trim();
    const ins = await sb.from('pesanan').insert({
      id_pesan: idPesan,
      slug_outlet: outlet.get('Slug'),
      token_outlet: String(req.params.token).trim(),
      outlet: outlet.get('Outlet'),
      tanggal_pesan: formatWaktuBukti(sekarang),
      batch_masuk: batchLabel,
      rencana_kirim: kirimLabel,
      status: 'BARU',
      items_json: jadi,
      ringkasan,
      alasan_tolak: '',
      riwayat_status: `${formatWaktuBukti(sekarang)} - Dibuat via link outlet oleh ${pemesan}`,
      dibuat_pada: nowIso(),
    });
    if (ins.error) throw new Error(ins.error.message);

    // WA otomatis ke admin (gagal kirim tidak menggagalkan pesanan — kirimPesan aman)
    kirimPesan(`*PESANAN BARU ${idPesan}*\nOutlet: ${outlet.get('Outlet')} (oleh ${pemesan})\n${ringkasan}\nBatch: ${batchLabel} | Rencana kirim: ${kirimLabel}`);

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
app.post('/api/pesanan/:id/keputusan', async (req, res) => {
  try {
    const pesanan = await cariPesanan(req.params.id);
    if (!pesanan) return res.status(404).json({ sukses: false, pesan: 'ID Pesan tidak ditemukan.' });
    if (String(pesanan.status).trim() !== 'BARU') {
      return res.status(409).json({ sukses: false, pesan: `Status ${pesanan.status}, keputusan hanya untuk BARU.` });
    }
    const { items, alasanUmum } = req.body;
    let lama = pesanan.items_json;
    if (typeof lama === 'string') { try { lama = JSON.parse(lama || '[]'); } catch { lama = []; } }
    if (!Array.isArray(lama)) lama = [];
    if (!Array.isArray(items) || items.length !== lama.length) {
      return res.status(400).json({ sukses: false, pesan: 'Keputusan harus mencakup semua item pesanan.' });
    }
    const setLama = new Set(lama.map(it => String(it.id)));
    if (!items.every(it => setLama.has(String(it.id)))) {
      return res.status(400).json({ sukses: false, pesan: 'ID item keputusan tidak cocok dengan pesanan.' });
    }
    const putus = lama.map(asli => {
      const k = items.find(x => String(x.id) === String(asli.id));
      const kep = String(k.keputusan || '').trim().toUpperCase();
      if (!['PENUHI', 'TOLAK'].includes(kep)) throw new Error(`Item "${asli.nama}": keputusan harus PENUHI/TOLAK.`);
      const keterangan = String(k.keterangan || '').trim();
      if (kep === 'TOLAK' && !keterangan) throw new Error(`Item "${asli.nama}": keterangan wajib karena ditolak.`);
      return { ...asli, keputusan: kep, qtyKirim: kep === 'PENUHI' ? Number(asli.qtyPesan) : 0, keterangan };
    });
    const penuhi = putus.filter(it => it.keputusan === 'PENUHI');
    const alasan = String(alasanUmum || '').trim();
    if (penuhi.length === 0 && !alasan) {
      return res.status(400).json({ sukses: false, pesan: 'Alasan umum wajib bila semua item ditolak.' });
    }

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
        if (Number(it.qtyKirim) > Number(b.jumlah_stock)) {
          return res.status(400).json({ sukses: false, pesan: `Stock ${b.nama_barang} kurang (minta ${it.qtyKirim}, sisa ${b.jumlah_stock}).` });
        }
      }
      const hasil = await buatPengiriman(
        pesanan.outlet,
        penuhi.map(it => ({ id: it.id, jumlah: it.qtyKirim })),
        String(pesanan.id_pesan).trim()
      );
      idKirim = hasil.idKirim;
      status = penuhi.length === putus.length ? 'DISETUJUI' : 'DISETUJUI SEBAGIAN';
    }

    await simpanPesanan({
      ...pesanan,
      items_json: putus,
      ringkasan: buatRingkasan(putus.map(it => ({ nama: it.nama, qtyPesan: it.qtyPesan, keputusan: it.keputusan, keterangan: it.keterangan }))),
      alasan_tolak: status === 'DITOLAK' ? alasan : '',
      status,
      riwayat_status: tambahRiwayat(pesanan.riwayat_status, status === 'DITOLAK' ? `Ditolak semua: ${alasan}` : `Diputus ${status}${idKirim ? ` (${idKirim})` : ''}`),
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

// Link lama mati otomatis (lookup by token); tanpa auth tambahan (konsisten: tanpa login).
app.post('/api/outlet/:slug/reset-link', async (req, res) => {
  try {
    if (!butuhSheetOutlet(res)) return;
    const rows = await sheetOutlet.getRows();
    const target = String(req.params.slug || '').trim().toLowerCase();
    const row = rows.find(r => String(r.get('Slug') || '').trim().toLowerCase() === target);
    if (!row) return res.status(404).json({ sukses: false, pesan: 'Slug outlet tidak ditemukan.' });
    const token = tokenOutletBaru();
    row.set('Token', token);
    await row.save();
    const slug = row.get('Slug');
    res.json({ sukses: true, slug, token, link: `/pesan/${slug}-${token}`, pesan: `Link baru ${slug} aktif. Link lama mati.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// Gudang-internal (konsisten: /api/pengiriman pun memuat token). Dipakai dropdown Tab Buat + Kelola Link.
app.get('/api/outlet', async (req, res) => {
  try {
    if (!butuhSheetOutlet(res)) return;
    const rows = await sheetOutlet.getRows();
    res.json(rows.map(r => ({
      slug: r.get('Slug'),
      outlet: r.get('Outlet'),
      token: r.get('Token') || '',
      link: `/pesan/${r.get('Slug')}-${r.get('Token') || ''}`,
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
  process.exit(gagal ? 1 : 0);
}

// Jalankan server setelah Supabase + tab Outlet siap
Promise.all([initDb(), initOutlet()])
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