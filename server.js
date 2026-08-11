const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require('./ss-inventory-bot-key');

const app = express();
const PORT = 3000;

const SPREADSHEET_ID = '1hKngYI5TbXlOTJXKXWBnvrUSBwPOoGyijgpsbgdD31U';
const Sheet_Barang = 'Data Inventory';
const Sheet_Transaksi = 'Transaksi';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// ------------------------------------------------------------------
// Koneksi ke Google Sheets pakai service account
// ------------------------------------------------------------------
const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

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

// ------------------------------------------------------------------
// 1. Cek apakah ID barang sudah ada
// ------------------------------------------------------------------
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
        stock: Number(row.get('Jumlah Stock'))
      });
    } else {
      res.json({ ditemukan: false, id });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// 2. Tambah barang baru
// ------------------------------------------------------------------
app.post('/api/tambahBarangBaru', async (req, res) => {
  try {
    const { id, nama, kategori, jumlah} = req.body;

    await sheetBarang.addRow({
      'ID Barang' : id,
      'Nama Barang': nama,
       Kategori: kategori,
      'Jumlah Stock': Number(jumlah)
    });

    await catatTransaksi(id, nama, 'Masuk', jumlah);

    res.json({ sukses: true, pesan: `Barang baru "${nama}" tersimpan ke spreadsheet.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal menyimpan: ' + err.message });
  }
});

// ------------------------------------------------------------------
// 3. Proses transaksi masuk/keluar
// ------------------------------------------------------------------
app.post('/api/prosesTransaksi', async (req, res) => {
  try {
    const { id, jenis, jumlah } = req.body;
    const rows = await sheetBarang.getRows();
    const row = rows.find(r => String(r.get('ID Barang')).trim() === String(id).trim());

    if (!row) {
      return res.json({ sukses: false, pesan: 'Barang tidak ditemukan di database.' });
    }

    const jml = Number(jumlah);
    let stockBaru = Number(row.get('Jumlah Stock'));

    if (jenis === 'Masuk') {
      stockBaru += jml;
    } else if (jenis === 'Keluar') {
      if (jml > stockBaru) {
        return res.json({ sukses: false, pesan: `Stock ${row.get("Nama Barang")} yang keluar melebihi stock saat ini. \n stock: ${stockBaru}` });
      }
      stockBaru -= jml;
    } else {
      return res.json({ sukses: false, pesan: 'Jenis transaksi tidak valid.' });
    }

    row.set('Jumlah Stock', stockBaru);
    await row.save();

    await catatTransaksi(row.get('ID Barang'), row.get('Nama Barang'), jenis, jml);

    res.json({
      sukses: true,
      pesan: `${row.get('Nama Barang')} - ${jenis} ${jml} berhasil dicatat. Stock sekarang: ${stockBaru}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal memproses: ' + err.message });
  }
});

async function catatTransaksi(id, nama, jenis, jumlah) {
  await sheetTransaksi.addRow({
    Timestamp: new Date().toISOString(),
    "ID Barang": id,
    Nama: nama,
    Jenis: jenis,
    Jumlah: jumlah
  });
}

// ------------------------------------------------------------------
// Jalankan server setelah koneksi ke Sheets berhasil
// ------------------------------------------------------------------
initSheets()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server jalan di http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Gagal konek ke Google Sheets:', err.message);
    process.exit(1);
  });