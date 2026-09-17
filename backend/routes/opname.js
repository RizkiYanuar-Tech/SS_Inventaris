// Opname sesi massal: HITUNG (input fisik) -> REVIEW (4 kolom) -> PUTUS (adjust) -> SELESAI.
// Batal kapan saja pre-SELESAI (tanpa tulis). Arsip read-only.
const express = require('express');
const router = express.Router();
const { sb, nowIso, kurangStock } = require('../../db');
const { wajibGudang } = require('../lib/auth');
const { jakartaParts } = require('../lib/waktu');
const { catatTransaksi } = require('../lib/data');
const { kanonikSatuan } = require('../lib/konversi');

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

async function ambilSesi(id) {
  const r = await sb.from('opname_sesi').select('*').eq('id_sesi', String(id).trim()).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return r.data || null;
}

// Daftar sesi + ringkasan hitungan (terbaru-di-atas; arsip read-only di frontend)
router.get('/api/opname', wajibGudang, async (req, res) => {
  try {
    const r = await sb.from('opname_sesi').select('*').order('dibuat_pada', { ascending: false });
    if (r.error) throw new Error(r.error.message);
    const out = [];
    for (const s of r.data || []) {
      const it = await sb.from('opname_item').select('fisik_qty,sistem_qty').eq('id_sesi', s.id_sesi);
      if (it.error) throw new Error(it.error.message);
      const rows = it.data || [];
      out.push({
        idSesi: s.id_sesi, status: s.status, dibuatPada: s.dibuat_pada, ditutupPada: s.ditutup_pada,
        total: rows.length,
        dihitung: rows.filter(x => x.fisik_qty != null).length,
        bergerak: rows.filter(x => x.fisik_qty != null && Number(x.fisik_qty) !== Number(x.sistem_qty)).length,
      });
    }
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Detail sesi + item + nama/satuan terkini + selisih vs stock SAAT INI (idempoten untuk retry putus)
router.get('/api/opname/:id', wajibGudang, async (req, res) => {
  try {
    const s = await ambilSesi(req.params.id);
    if (!s) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
    const it = await sb.from('opname_item').select('*').eq('id_sesi', s.id_sesi);
    if (it.error) throw new Error(it.error.message);
    const br = await sb.from('barang_inventory').select('id_barang,nama_barang,merk,satuan,total,harga_barang');
    if (br.error) throw new Error(br.error.message);
    const map = new Map((br.data || []).map(b => [String(b.id_barang).trim(), b]));
    const items = (it.data || []).map(x => {
      const b = map.get(String(x.id_barang).trim());
      const kini = b ? Number(b.total) : null;
      const fisik = x.fisik_qty != null ? Number(x.fisik_qty) : null;
      return {
        id: x.id_barang,
        nama: b ? b.nama_barang : x.id_barang,
        merk: b ? (b.merk || '') : '',
        satuan: b ? (kanonikSatuan(b.satuan) || 'pcs') : 'pcs',
        ada: !!b,
        sistem: Number(x.sistem_qty),
        harga: x.sistem_harga != null ? Number(x.sistem_harga) : null,
        fisik,
        kini,
        selisih: fisik != null && kini != null ? fisik - kini : null,
      };
    });
    res.json({ idSesi: s.id_sesi, status: s.status, dibuatPada: s.dibuat_pada, ditutupPada: s.ditutup_pada, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Mulai sesi: snapshot 419 barang (hanya bila tak ada sesi terbuka)
router.post('/api/opname/mulai', wajibGudang, async (req, res) => {
  try {
    const buka = await sesiTerbuka();
    if (buka) return res.status(409).json({ sukses: false, pesan: `Sesi ${buka.id_sesi} masih terbuka. Selesaikan/batalkan dulu.` });
    const br = await sb.from('barang_inventory').select('id_barang,total,harga_barang').order('dibuat_pada', { ascending: true });
    if (br.error) throw new Error(br.error.message);
    const idSesi = await buatIdSesi();
    const ins = await sb.from('opname_sesi').insert({ id_sesi: idSesi, status: 'HITUNG', dibuat_pada: nowIso() });
    if (ins.error) throw new Error(ins.error.message);
    const rows = (br.data || []).map(b => ({
      id_sesi: idSesi, id_barang: b.id_barang,
      sistem_qty: Number(b.total) || 0,
      sistem_harga: b.harga_barang != null ? Number(b.harga_barang) : null,
      fisik_qty: null,
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const r = await sb.from('opname_item').insert(rows.slice(i, i + 200));
      if (r.error) throw new Error(r.error.message);
    }
    res.json({ sukses: true, idSesi, pesan: `Sesi ${idSesi} dibuka (${rows.length} barang). Hitung fisik lalu review.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal membuka sesi: ' + err.message });
  }
});

// Simpan hitungan fisik (fase HITUNG; REVIEW boleh betulkan tanpa pindah fase)
router.post('/api/opname/:id/hitung', wajibGudang, async (req, res) => {
  try {
    const s = await ambilSesi(req.params.id);
    if (!s) return res.status(404).json({ sukses: false, pesan: 'Sesi tidak ditemukan.' });
    if (!['HITUNG', 'REVIEW'].includes(s.status)) {
      return res.status(409).json({ sukses: false, pesan: `Sesi ${s.status}, hitungan terkunci.` });
    }
    const items = req.body.items;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ sukses: false, pesan: 'Kirim daftar {id, fisik}.' });
    let n = 0;
    for (const it of items) {
      const fisik = it.fisik === '' || it.fisik == null ? null : Number(it.fisik);
      if (fisik != null && !(fisik >= 0)) {
        return res.status(400).json({ sukses: false, pesan: `Fisik ${it.id} harus angka >= 0.` });
      }
      const up = await sb.from('opname_item').update({ fisik_qty: fisik })
        .eq('id_sesi', s.id_sesi).eq('id_barang', String(it.id || '').trim());
      if (up.error) throw new Error(up.error.message);
      n++;
    }
    res.json({ sukses: true, pesan: `${n} hitungan tersimpan.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal menyimpan: ' + err.message });
  }
});

// HITUNG -> REVIEW (min 1 terhitung; yang belum dihitung tak ikut putus)
router.post('/api/opname/:id/review', wajibGudang, async (req, res) => {
  try {
    const s = await ambilSesi(req.params.id);
    if (!s) return res.status(404).json({ sukses: false, pesan: 'Sesi tidak ditemukan.' });
    if (s.status !== 'HITUNG') return res.status(409).json({ sukses: false, pesan: `Sesi ${s.status}, review hanya dari HITUNG.` });
    const it = await sb.from('opname_item').select('id_barang').eq('id_sesi', s.id_sesi).not('fisik_qty', 'is', null).limit(1);
    if (it.error) throw new Error(it.error.message);
    if (!it.data || !it.data.length) return res.status(400).json({ sukses: false, pesan: 'Belum ada barang terhitung.' });
    const up = await sb.from('opname_sesi').update({ status: 'REVIEW' }).eq('id_sesi', s.id_sesi);
    if (up.error) throw new Error(up.error.message);
    res.json({ sukses: true, pesan: `Sesi ${s.id_sesi} masuk review. Periksa lalu putus/tutup.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal review: ' + err.message });
  }
});

// Kembali REVIEW -> HITUNG (betulkan hitungan; deviasi spek: tanpa ini salah ketik terkunci)
router.post('/api/opname/:id/kembali', wajibGudang, async (req, res) => {
  try {
    const s = await ambilSesi(req.params.id);
    if (!s) return res.status(404).json({ sukses: false, pesan: 'Sesi tidak ditemukan.' });
    if (s.status !== 'REVIEW') return res.status(409).json({ sukses: false, pesan: `Sesi ${s.status}, tak bisa kembali.` });
    const up = await sb.from('opname_sesi').update({ status: 'HITUNG' }).eq('id_sesi', s.id_sesi);
    if (up.error) throw new Error(up.error.message);
    res.json({ sukses: true, pesan: `Sesi ${s.id_sesi} kembali ke hitung.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal kembali: ' + err.message });
  }
});

// PUTUS dari REVIEW: selisih = fisik - stock SAAT INI (idempoten, aman retry).
// Masuk/Keluar dinilai avg kini -> avg tidak bergerak. Jejak: keterangan 'Opname #SOP-...'.
router.post('/api/opname/:id/putus', wajibGudang, async (req, res) => {
  try {
    const s = await ambilSesi(req.params.id);
    if (!s) return res.status(404).json({ sukses: false, pesan: 'Sesi tidak ditemukan.' });
    if (s.status !== 'REVIEW') return res.status(409).json({ sukses: false, pesan: `Sesi ${s.status}, putus hanya dari REVIEW.` });
    const it = await sb.from('opname_item').select('*').eq('id_sesi', s.id_sesi).not('fisik_qty', 'is', null);
    if (it.error) throw new Error(it.error.message);
    const jejak = `Opname #${s.id_sesi}`;
    let masuk = 0, keluar = 0, lewat = 0;
    for (const x of it.data || []) {
      const b = await sb.from('barang_inventory').select('*').eq('id_barang', x.id_barang).maybeSingle();
      if (b.error) throw new Error(b.error.message);
      if (!b.data) { lewat++; continue; } // barang terhapus sesi-berjalan: lewati
      const row = b.data;
      const selisih = Number(x.fisik_qty) - Number(row.total);
      if (!selisih) { lewat++; continue; }
      const avg = row.harga_barang != null ? Number(row.harga_barang) : null;
      if (selisih < 0) {
        const hasil = await kurangStock(row.id_barang, -selisih);
        if (!hasil.ok) {
          return res.status(409).json({ sukses: false, pesan: `Stock ${row.nama_barang} berubah saat diproses (sisa ${hasil.sisa}). Ulangi putus — yang sudah masuk aman (idempoten).` });
        }
        await catatTransaksi(row.id_barang, row.nama_barang, row.merk, row.kategori,
          'Keluar', -selisih, kanonikSatuan(row.satuan) || 'pcs', avg, null, jejak);
        keluar++;
      } else {
        const baru = Number(row.total) + selisih;
        const up = await sb.from('barang_inventory').update({ total: baru }).eq('id_barang', row.id_barang).select('total');
        if (up.error) throw new Error(up.error.message);
        await catatTransaksi(row.id_barang, row.nama_barang, row.merk, row.kategori,
          'Masuk', selisih, kanonikSatuan(row.satuan) || 'pcs', avg, null, jejak);
        masuk++;
      }
    }
    const tutup = await sb.from('opname_sesi').update({ status: 'SELESAI', ditutup_pada: nowIso() }).eq('id_sesi', s.id_sesi);
    if (tutup.error) throw new Error(tutup.error.message);
    console.log(`*OPNAME SELESAI ${s.id_sesi}*\nMasuk: ${masuk} | Keluar: ${keluar} | Tanpa gerak/dilewati: ${lewat}`);
    res.json({ sukses: true, pesan: `Opname ${s.id_sesi} selesai. Masuk ${masuk}, keluar ${keluar}, tanpa gerak ${lewat}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal putus: ' + err.message });
  }
});

// Batalkan sesi terbuka (tanpa tulis apa pun)
router.post('/api/opname/:id/batal', wajibGudang, async (req, res) => {
  try {
    const s = await ambilSesi(req.params.id);
    if (!s) return res.status(404).json({ sukses: false, pesan: 'Sesi tidak ditemukan.' });
    if (!['HITUNG', 'REVIEW'].includes(s.status)) {
      return res.status(409).json({ sukses: false, pesan: `Sesi ${s.status}, tak bisa dibatalkan.` });
    }
    const up = await sb.from('opname_sesi').update({ status: 'BATAL', ditutup_pada: nowIso() }).eq('id_sesi', s.id_sesi);
    if (up.error) throw new Error(up.error.message);
    res.json({ sukses: true, pesan: `Sesi ${s.id_sesi} dibatalkan (tanpa perubahan stock).` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: 'Gagal membatalkan: ' + err.message });
  }
});

module.exports = router;
