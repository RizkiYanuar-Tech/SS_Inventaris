const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { sb, nowIso } = require('../../db');
const { wajibGudang, wajibOutlet, sesiOutlet, UMUR_SESI_OUTLET_MS, namaCookieOutlet, hashKataSandi, cekKataSandi, kenaRate } = require('../lib/auth');
const { jakartaParts, hitungSlot, formatWaktuBukti, pesanDibuka, PESAN_TUTUP } = require('../lib/waktu');
const { buatRingkasan, tambahRiwayat } = require('../lib/ringkas');
const { kanonikSatuan } = require('../lib/konversi');
const {
  cariOutletByToken, buatIdPesan, pesananKeJson, cariPesanan, simpanPesanan,
  tulisNotifikasi, buatPengiriman,
} = require('../lib/data');

// Gudang: daftar semua pesanan, terbaru-di-atas
router.get('/api/pesanan', wajibGudang, async (req, res) => {
  try {
    const r = await sb.from('pesanan').select('*').order('dibuat_pada', { ascending: false });
    if (r.error) throw new Error(r.error.message);
    res.json(r.data.map(x => pesananKeJson(x)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Outlet: 1x fetch untuk halaman pesan (WAJIB sesi login; identitas + katalog tanpa stock + jadwal + riwayat milik token).
// ?ringan=1 untuk poll: tanpa katalog (frontend pakai katalog fetch penuh pertama).
router.get('/api/pesan/:token', wajibOutlet, async (req, res) => {
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
        varian: b.merk || '',
        satuan: kanonikSatuan(b.satuan) || 'pcs',
        kategori: b.kategori || '',
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

// Outlet: submit keranjang -> BARU/gabung sehati + slot otomatis + jejak log + lonceng (WAJIB sesi login)
router.post('/api/pesan/:token', wajibOutlet, async (req, res) => {
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
        varian: b.merk || '',
        satuan: kanonikSatuan(b.satuan) || 'pcs',
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

// Gudang: putus per item (PENUHI penuh / TOLAK + keterangan). Hanya dari BARU (anti dobel-putus).
// Urutan tulis: validasi stock semua item penuhi -> buatPengiriman internal -> update Pesanan.
router.post('/api/pesanan/:id/keputusan', wajibGudang, async (req, res) => {
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

// ---- Login outlet (username + password; username pre-set gudang, password self-set outlet) ----
const SALAH_OUTLET = 'Username atau password salah.';
function sesiOutletBaru(tokenOutlet, res) {
  const tok = crypto.randomBytes(32).toString('hex');
  sesiOutlet.set(tok, { tokenOutlet: String(tokenOutlet).trim(), exp: Date.now() + UMUR_SESI_OUTLET_MS });
  res.setHeader('Set-Cookie', `${namaCookieOutlet(tokenOutlet)}=${tok}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`);
}

// Masuk: publik + rate-limit 10/mnt per slug+IP. NULL password + username cocok -> 401 {buatPertama:true}.
router.post('/api/pesan/:token/masuk', async (req, res) => {
  try {
    const outlet = await cariOutletByToken(req.params.token);
    if (!outlet) return res.status(404).json({ sukses: false, pesan: 'Link tidak valid.' });
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || '?';
    if (kenaRate(`outlet:${outlet.slug}:${ip}`)) {
      return res.status(429).json({ sukses: false, pesan: 'Terlalu banyak percobaan. Tunggu sebentar.' });
    }
    const { username, password } = req.body || {};
    if (!outlet.username_outlet) {
      return res.status(403).json({ sukses: false, pesan: 'Akun belum diaktifkan. Minta username ke gudang.' });
    }
    if (String(username || '').trim() !== String(outlet.username_outlet).trim()) {
      return res.status(401).json({ sukses: false, pesan: SALAH_OUTLET });
    }
    if (!outlet.password_outlet) {
      return res.status(401).json({ sukses: false, buatPertama: true, pesan: 'Buat password pertamamu dulu (sekali saja).' });
    }
    if (!cekKataSandi(password, outlet.password_outlet)) {
      return res.status(401).json({ sukses: false, pesan: SALAH_OUTLET });
    }
    sesiOutletBaru(req.params.token, res);
    res.json({ sukses: true, pesan: `Masuk sebagai ${outlet.nama_outlet}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// Password awal: publik, hanya bila password NULL (terisi -> 409 terkunci). Username wajib cocok. Auto-masuk.
router.post('/api/pesan/:token/password-awal', async (req, res) => {
  try {
    const outlet = await cariOutletByToken(req.params.token);
    if (!outlet) return res.status(404).json({ sukses: false, pesan: 'Link tidak valid.' });
    if (outlet.password_outlet) {
      return res.status(409).json({ sukses: false, pesan: 'Password sudah dibuat. Masuk seperti biasa.' });
    }
    const { username, password, konfirmasi } = req.body || {};
    if (!outlet.username_outlet || String(username || '').trim() !== String(outlet.username_outlet).trim()) {
      return res.status(401).json({ sukses: false, pesan: SALAH_OUTLET });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({ sukses: false, pesan: 'Password minimal 4 karakter.' });
    }
    if (password !== konfirmasi) {
      return res.status(400).json({ sukses: false, pesan: 'Ketik ulang tidak sama.' });
    }
    const up = await sb.from('outlet').update({ password_outlet: hashKataSandi(password) }).eq('token', String(req.params.token).trim()).select('slug');
    if (up.error) throw new Error(up.error.message);
    sesiOutletBaru(req.params.token, res);
    res.json({ sukses: true, pesan: 'Password dibuat. Selamat datang!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// Ganti password sendiri (wajib sesi outlet).
router.post('/api/pesan/:token/password', wajibOutlet, async (req, res) => {
  try {
    const { password, konfirmasi } = req.body || {};
    if (!password || String(password).length < 4) {
      return res.status(400).json({ sukses: false, pesan: 'Password minimal 4 karakter.' });
    }
    if (password !== konfirmasi) {
      return res.status(400).json({ sukses: false, pesan: 'Ketik ulang tidak sama.' });
    }
    const up = await sb.from('outlet').update({ password_outlet: hashKataSandi(password) }).eq('token', String(req.params.token).trim()).select('slug');
    if (up.error) throw new Error(up.error.message);
    res.json({ sukses: true, pesan: 'Password diganti.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ---- Kelola akun outlet oleh gudang (Tab Lainnya hub) ----
// Username: pre-set SEKALI (NULL saja; terisi -> 409 terkunci permanen). Password: reset kapan saja.
router.post('/api/outlet/:slug/username', wajibGudang, async (req, res) => {
  try {
    const target = String(req.params.slug || '').trim().toLowerCase();
    const username = String((req.body || {}).username || '').trim();
    if (username.length < 3) {
      return res.status(400).json({ sukses: false, pesan: 'Username minimal 3 karakter.' });
    }
    const ada = await sb.from('outlet').select('slug,username_outlet').eq('slug', target).maybeSingle();
    if (ada.error) throw new Error(ada.error.message);
    if (!ada.data) return res.status(404).json({ sukses: false, pesan: 'Slug outlet tidak ditemukan.' });
    if (ada.data.username_outlet) {
      return res.status(409).json({ sukses: false, pesan: 'Username sudah terkunci, tidak bisa diubah.' });
    }
    const kembar = await sb.from('outlet').select('slug').eq('username_outlet', username).limit(1);
    if (kembar.error) throw new Error(kembar.error.message);
    if (kembar.data && kembar.data.length) {
      return res.status(409).json({ sukses: false, pesan: `Username dipakai outlet lain.` });
    }
    const up = await sb.from('outlet').update({ username_outlet: username }).eq('slug', target).select('slug');
    if (up.error) throw new Error(up.error.message);
    res.json({ sukses: true, pesan: `Username ${target} diset. Sampaikan ke outlet.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

router.post('/api/outlet/:slug/password', wajibGudang, async (req, res) => {
  try {
    const target = String(req.params.slug || '').trim().toLowerCase();
    const { password, konfirmasi } = req.body || {};
    if (!password || String(password).length < 4) {
      return res.status(400).json({ sukses: false, pesan: 'Password minimal 4 karakter.' });
    }
    if (password !== konfirmasi) {
      return res.status(400).json({ sukses: false, pesan: 'Ketik ulang tidak sama.' });
    }
    const up = await sb.from('outlet').update({ password_outlet: hashKataSandi(password) }).eq('slug', target).select('slug');
    if (up.error) throw new Error(up.error.message);
    if (!up.data || up.data.length === 0) return res.status(404).json({ sukses: false, pesan: 'Slug outlet tidak ditemukan.' });
    res.json({ sukses: true, pesan: `Password ${target} direset. Sampaikan password baru ke outlet.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

module.exports = router;
