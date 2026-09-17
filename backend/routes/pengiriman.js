// Route pengiriman + terima outlet + notifikasi + surat jalan (potong-pindah murni dari server.js lama).
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { sb } = require('../../db');
const { wajibGudang } = require('../lib/auth');
const { jakartaParts, formatWaktuBukti, NAMA_BULAN } = require('../lib/waktu');
const { buatRingkasanKirim, buatAlasan, tambahRiwayat } = require('../lib/ringkas');
const {
  cariPengiriman, pengirimanKeJson, simpanPengiriman,
  cariPesanan, simpanPesanan, mirrorPesanan, tulisNotifikasi,
} = require('../lib/data');

router.get('/api/pengiriman', wajibGudang, async (req, res) => {
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
router.post('/api/pengiriman/:id/kirim', wajibGudang, async (req, res) => {
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
router.post('/api/pengiriman/:id/batal-kirim', wajibGudang, async (req, res) => {
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
router.get('/api/notifikasi', wajibGudang, async (req, res) => {
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

router.post('/api/notifikasi/baca', wajibGudang, async (req, res) => {
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
router.get('/api/surat-jalan/:idKirim', wajibGudang, async (req, res) => {
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
    const barisKirim = (it, no, noteGudang) => {
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
        note: String(noteGudang ?? it.keterangan ?? '').trim(),
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
        return barisKirim(idx >= 0 ? dikirim[idx] : { id: lp.id, nama: lp.nama, varian: lp.varian, jumlahKirim: 0, keterangan: '' }, 0, lp.keterangan);
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
router.get('/api/pengiriman/:token/lihat', async (req, res) => {
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
router.post('/api/pengiriman/:token/konfirmasi', async (req, res) => {
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

module.exports = router;
