// Server baru hasil pecah (opsi A): setup + mount routes. Perilaku identik server.js lama.
// Dijalankan via root forwarder (`node server.js`) atau langsung (`node backend/server.js`).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

const { hitungSlot, formatTanggalSlot, formatWaktuBukti } = require('./lib/waktu');
const { buatRingkasan, buatRingkasanKirim, buatAlasan } = require('./lib/ringkas');
const { hitungAvg } = require('./lib/konversi');
const { initDb, scheduleRandomSampling } = require('./lib/data');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Data: Supabase 5 tabel (barang_inventory, transaksi, pesanan, pengiriman, outlet).
// Akses Supabase terpusat di db.js (root, tetap di root agar require('.../db') stabil).

app.use('/', require('./routes/barang'));
app.use('/', require('./routes/pengiriman'));
app.use('/', require('./routes/pesan'));
app.use('/', require('./routes/gudang'));
app.use('/', require('./routes/vendor'));
app.use('/', require('./routes/opname'));

// SPA fallback (prod port 3000): link langsung seperti /terima/:token harus
// dilayani index.html, bukan 404. Express 5: '/{*splat}'. Dilewati untuk /api.
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

// Self-check Step 0.2 (tanpa konek Sheets): node backend/server.js --self-check
function jalankanSelfCheck() {
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

function mulaiServer() {
  // Jalankan server setelah Supabase siap (5 tabel)
  return initDb()
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
}

if (require.main === module && process.argv.includes('--self-check')) jalankanSelfCheck();
else if (require.main === module) mulaiServer();

module.exports = app;
module.exports.mulaiServer = mulaiServer;
module.exports.jalankanSelfCheck = jalankanSelfCheck;
