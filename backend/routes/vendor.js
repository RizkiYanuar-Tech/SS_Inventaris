// Route master vendor (CRUD sederhana; tanpa relasi barang/transaksi).
const express = require('express');
const router = express.Router();
const { sb } = require('../../db');
const { wajibGudang } = require('../lib/auth');

const keJson = (o) => ({
  id: o.id,
  nama: o.nama_vendor || '',
  nomor: o.nomor != null ? String(o.nomor) : '',
  alamat: o.alamat || '',
});

// Satu-satunya format nomor: +62… (0… → +62…, 62… → +62…; kosong → null).
function normalisasiNomor(nomor) {
  let n = String(nomor || '').trim().replace(/[\s.\-()]/g, '');
  if (!n) return null;
  if (n.startsWith('+62')) return '+' + n.slice(1).replace(/\D/g, '');
  n = n.replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('0')) n = '62' + n.slice(1);
  if (n.startsWith('62')) return '+' + n;
  return '+' + n;
}

router.get('/api/vendor', wajibGudang, async (req, res) => {
  try {
    const r = await sb.from('vendor').select('*').order('nama_vendor', { ascending: true });
    if (r.error) throw new Error(r.error.message);
    res.json((r.data || []).map(keJson));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/vendor', wajibGudang, async (req, res) => {
  try {
    const nama = String(req.body.nama || '').trim().replace(/\s+/g, ' ');
    if (!nama) return res.status(400).json({ sukses: false, pesan: 'Nama vendor wajib diisi.' });
    const mirip = await sb.from('vendor').select('id,nama_vendor').ilike('nama_vendor', nama).limit(1);
    if (mirip.error) throw new Error(mirip.error.message);
    if (mirip.data && mirip.data.length) {
      return res.status(409).json({
        sukses: false,
        pesan: `Vendor mirip sudah ada: ${mirip.data[0].nama_vendor}. Pakai yang ada atau ubah nama.`,
      });
    }
    const ins = await sb.from('vendor').insert({
      nama_vendor: nama,
      nomor: normalisasiNomor(req.body.nomor),
      alamat: String(req.body.alamat || '').trim(),
    }).select('id');
    if (ins.error) throw new Error(ins.error.message);
    res.json({ sukses: true, pesan: `Vendor ${nama} tersimpan.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal menyimpan: ' + err.message });
  }
});

router.put('/api/vendor/:id', wajibGudang, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(id > 0)) return res.status(400).json({ sukses: false, pesan: 'ID vendor tidak valid.' });
    const patch = {};
    if (req.body.nama !== undefined) {
      const nama = String(req.body.nama || '').trim().replace(/\s+/g, ' ');
      if (!nama) return res.status(400).json({ sukses: false, pesan: 'Nama vendor wajib diisi.' });
      const mirip = await sb.from('vendor').select('id,nama_vendor').ilike('nama_vendor', nama).neq('id', id).limit(1);
      if (mirip.error) throw new Error(mirip.error.message);
      if (mirip.data && mirip.data.length) {
        return res.status(409).json({
          sukses: false,
          pesan: `Vendor mirip sudah ada: ${mirip.data[0].nama_vendor}. Pakai yang ada atau ubah nama.`,
        });
      }
      patch.nama_vendor = nama;
    }
    if (req.body.nomor !== undefined) patch.nomor = normalisasiNomor(req.body.nomor);
    if (req.body.alamat !== undefined) patch.alamat = String(req.body.alamat || '').trim();
    if (!Object.keys(patch).length) return res.json({ sukses: true, pesan: 'Tidak ada perubahan.' });
    const up = await sb.from('vendor').update(patch).eq('id', id).select('id');
    if (up.error) throw new Error(up.error.message);
    if (!up.data || !up.data.length) return res.status(404).json({ sukses: false, pesan: 'Vendor tidak ditemukan.' });
    res.json({ sukses: true, pesan: 'Vendor diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal mengubah: ' + err.message });
  }
});

router.delete('/api/vendor/:id', wajibGudang, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(id > 0)) return res.status(400).json({ sukses: false, pesan: 'ID vendor tidak valid.' });
    const ada = await sb.from('vendor').select('id,nama_vendor').eq('id', id).maybeSingle();
    if (ada.error) throw new Error(ada.error.message);
    if (!ada.data) return res.status(404).json({ sukses: false, pesan: 'Vendor tidak ditemukan.' });
    const del = await sb.from('vendor').delete().eq('id', id);
    if (del.error) throw new Error(del.error.message);
    res.json({ sukses: true, pesan: `Vendor ${ada.data.nama_vendor} dihapus.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal menghapus: ' + err.message });
  }
});

module.exports = router;
