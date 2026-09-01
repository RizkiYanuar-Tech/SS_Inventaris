require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require("./ss-inventory-bot-key");

const app = express();
const PORT = process.env.PORT;

const spreadsheet_id = process.env.SPREADSHEET_ID;
const Sheet_Barang = 'Data Inventory';
const Sheet_Transaksi = 'Transaksi';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Koneksi ke Google Sheets melalui service account
const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const doc = new GoogleSpreadsheet(spreadsheet_id, serviceAccountAuth);

let sheetBarang, sheetTransaksi;

async function initSheets() {
  await doc.loadInfo();
  sheetBarang = doc.sheetsByTitle[Sheet_Barang];
  sheetTransaksi = doc.sheetsByTitle[Sheet_Transaksi];

  if (!sheetBarang || !sheetTransaksi) {
    throw new Error(
      `Sheet dengan nama "${Sheet_Barang}" atau "${Sheet_Transaksi}" tidak ditemukan. ` +
      `Pastikan nama tab di Google Sheet persis sama (huruf besar/kecil ikut diperhatikan).`
    );
  }
  console.log('Terhubung ke Google Sheets:', doc.title);
}

async function catatTransaksi(id, nama, jenis, jumlah, restock) {
  await sheetTransaksi.addRow({
    Timestamp: new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    "ID Barang": id,
    "Nama Barang": nama,
    Jenis: jenis,
    Jumlah: jumlah,
    'Batas Restock': restock
  });
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
    const rows = await sheetBarang.getRows();
    if (rows.length === 0) return;

    const jumlahSampel = Math.min(3, Math.max(1, Math.ceil(rows.length * sampling_check)));
    const acak = [...rows].sort(() => Math.random() - 0.5).slice(0, jumlahSampel);
    
    let pesan = "*CHECK PRODUK*\n\n Check Produk Berikut, apakah jumlah stock sesuai?";
    acak.forEach(row => {
      pesan += `- Nama Barang: ${row.get('Nama Barang')} \n Jumlah Stock: ${row.get('Jumlah Stock')} \n`;
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
    const rows = await sheetBarang.getRows();
    const row = rows.find(r => String(r.get('ID Barang')).trim() === id);

    if (row) {
      res.json({
        ditemukan: true,
        id: row.get('ID Barang'),
        nama: row.get('Nama Barang'),
        kategori: row.get('Kategori'),
        stock: Number(row.get('Jumlah Stock')),
        threshold: Number(row.get('Batas Restock')),
        satuanEceran: row.get('Satuan Eceran') || 'Pcs',
        satuanGrosir: row.get('Satuan Grosir') || null,
        isiPerGrosir: row.get('Isi per Grosir') ? Number(row.get('Isi per Grosir')) : null
      });
    } else {
      res.json({ ditemukan: false, id });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Tambah barang baru
app.post('/api/tambahBarangBaru', async (req, res) => {
  try {
    const { id, nama, kategori, jumlah, restock, satuanEceran, satuanGrosir, isiPerGrosir } = req.body;
    const rows = await sheetBarang.getRows();
    const ditemukan = rows.find(r => String(r.get('ID Barang')).trim() === String(id).trim());

    if (ditemukan) {
      return res.status(409).json({
        sukses: false,
        pesan: `ID Produk ${id} sudah terdaftar sebagai ${ditemukan.get('Nama Barang')}. Check kembali ID Produk yang akan dimasukkan.`
      });
    }

    if (!satuanGrosir || !isiPerGrosir) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Nama Kemasan dan Isi per Kemasan wajib diisi untuk setiap barang.'
      });
    }

    await sheetBarang.addRow({
      'ID Barang': id,
      'Nama Barang': nama,
      Kategori: kategori,
      'Jumlah Stock': Number(jumlah),
      'Batas Restock': Number(restock) || 5,
      'Satuan Eceran': satuanEceran || 'Pcs',
      'Satuan Grosir': satuanGrosir,
      'Isi per Grosir': Number(isiPerGrosir)
    });

    await catatTransaksi(id, nama, 'Masuk', jumlah, restock);

    res.json({ sukses: true, pesan: `Barang baru ${nama} tersimpan ke spreadsheet. Stock awal: ${jumlah} ${satuanEceran || 'Pcs'}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal menyimpan: ' + err.message });
  }
});

// Proses transaksi masuk/keluar-
app.post('/api/prosesTransaksi', async (req, res) => {
  try {
    const { id, jenis, jumlah, satuanInput } = req.body;
    const rows = await sheetBarang.getRows();
    const row = rows.find(r => String(r.get('ID Barang')).trim() === String(id).trim());

    if (!row) {
      return res.json({ sukses: false, pesan: 'Barang tidak ditemukan di database.' });
    }

    const satuanEceran = row.get('Satuan Eceran') || 'Pcs';
    const satuanGrosir = row.get('Satuan Grosir') || null;
    const isiPerGrosir = row.get('Isi per Grosir') ? Number(row.get('Isi per Grosir')) : null;

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

    let stockBaru = Number(row.get('Jumlah Stock'));

    if (jenis === 'Masuk') {
      stockBaru += jmlh;
    } else if (jenis === 'Keluar') {
      if (jmlh > stockBaru) {
        return res.json({ sukses: false, pesan: `Stock ${row.get("Nama Barang")} yang keluar melebihi stock saat ini. \n ${stockBaru} ${satuanEceran}`});
      }
      stockBaru -= jmlh;
    } else {
      return res.json({ sukses: false, pesan: 'Jenis transaksi tidak valid.' });
    }

    row.set('Jumlah Stock', stockBaru);
    await row.save();

    const keteranganSatuan = satuanInput && satuanInput === satuanGrosir
      ? `${jumlahInput} ${satuanGrosir} (= ${jmlh} ${satuanEceran})`
      : `${jmlh} ${satuanEceran}`;

    await catatTransaksi(row.get('ID Barang'), row.get('Nama Barang'), jenis, jmlh, Number(row.get("Batas Restock")));
    await cekThresholdDanKirimWA(
      row.get('ID Barang'),
      row.get('Nama Barang'),
      stockBaru,
      Number(row.get('Batas Restock'))
    );

    res.json({
      sukses: true,
      pesan: `${row.get('Nama Barang')} - ${jenis} ${keteranganSatuan} berhasil dicatat. Stock sekarang: ${stockBaru} ${satuanEceran}`
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

// Jalankan server setelah koneksi ke Sheets berhasil
initSheets()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server jalan di http://localhost:${PORT}`);
    });
    scheduleRandomSampling();
  })
  .catch(err => {
    console.error('Gagal konek ke Google Sheets:', err.message);
    process.exit(1);
  });