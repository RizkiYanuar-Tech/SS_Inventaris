// Route barang + transaksi (potong-pindah murni dari server.js lama).
const express = require('express');
const router = express.Router();
const { sb, nowIso, kurangStock } = require('../../db');
const { wajibGudang } = require('../lib/auth');
const { formatWaktuBukti } = require('../lib/waktu');
const { hitungAvg, kanonikSatuan } = require('../lib/konversi');
const { buatIdBarang, catatTransaksi, cekThreshold } = require('../lib/data');

// Vendor Masuk opsional: snapshot nama ke keterangan transaksi ("Vendor: X").
// Masukan baru = vendorId (dropdown kirim ID, tahan rename); legacy nama string
// tetap didukung (lookup by nama, tak-cocok = snapshot teks saja, tak gagalkan tulis).
function vendorKeKeterangan(vendor) {
  const nama = String(vendor || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  return nama ? `Vendor: ${nama}` : null;
}
async function vendorKeCatat(body) {
  const idMentah = body.vendorId != null && body.vendorId !== '' ? Number(body.vendorId) : null;
  if (idMentah != null && !(idMentah > 0)) {
    throw Object.assign(new Error('ID vendor tidak valid.'), { status: 400 });
  }
  if (idMentah != null) {
    const v = await sb.from('vendor').select('id,nama_vendor').eq('id', idMentah).maybeSingle();
    if (v.error) throw new Error(v.error.message);
    if (!v.data) {
      throw Object.assign(new Error('Vendor tidak ditemukan (daftar berubah, pilih ulang).'), { status: 400 });
    }
    return { idVendor: v.data.id, keterangan: vendorKeKeterangan(v.data.nama_vendor) };
  }
  const namaLama = String(body.vendor || '').trim();
  if (!namaLama) return { idVendor: null, keterangan: null };
  const v = await sb.from('vendor').select('id,nama_vendor').eq('nama_vendor', namaLama.replace(/\s+/g, ' ')).maybeSingle();
  if (v.error) throw new Error(v.error.message);
  if (!v.data) return { idVendor: null, keterangan: vendorKeKeterangan(namaLama) };
  return { idVendor: v.data.id, keterangan: vendorKeKeterangan(v.data.nama_vendor) };
}

router.get("/api/barang", wajibGudang, async (req, res) => {
  try{
    const r = await sb.from('barang_inventory').select('*').order('dibuat_pada', { ascending: true });
    if (r.error) throw new Error(r.error.message);
    const data = r.data.map(row => ({
      id: row.id_barang,
      nama: row.nama_barang,
      varian: row.merk || '',
      kategori: row.kategori || '',
      stock: Number(row.total),
      threshold: Number(row.minimum_stock),
      satuanEceran: row.satuan ? kanonikSatuan(row.satuan) : 'pcs',
      satuanGrosir: row.satuan_gudang ? kanonikSatuan(row.satuan_gudang) : null,
      isiPerGrosir: row.isi_per_gudang != null ? Number(row.isi_per_gudang) : null,
      hargaBarang: row.harga_barang != null ? Number(row.harga_barang) : null,
      keterangan: row.keterangan || '',
      dibuatPada: row.dibuat_pada || null,
    }));
    res.json(data);
  }catch (err){
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

router.get("/api/transaksi", wajibGudang, async(req, res) => {
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
      satuan: row.satuan ? kanonikSatuan(row.satuan) : 'pcs',
      idKirim: row.id_kirim || '',
      dibuatPada: row.dibuat_pada || null,
      hargaSatuan: row.harga_satuan != null ? Number(row.harga_satuan) : null,
      idTransaksi: row.id_transaksi ?? null,
      keterangan: row.keterangan || '',
      idVendor: row.id_vendor ?? null,
    }));
    res.json(data);
  } catch (err){
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

// Tambah barang baru (id opsional -> auto MNL urut global; tanpa kolom ID di UI manual)
router.post('/api/tambahBarangBaru', wajibGudang, async (req, res) => {
  try {
    const { id, nama, varian, kategori, jumlah, restock, satuanEceran, satuanGudang, isiPerGudang, keterangan, totalBayar } = req.body;
    const namaBersih = String(nama || '').trim().replace(/\s+/g, ' ');
    if (!namaBersih) {
      return res.status(400).json({ sukses: false, pesan: 'Nama Barang wajib diisi.' });
    }
    const satuan = kanonikSatuan(satuanEceran) || 'pcs';
    if (!satuan) {
      return res.status(400).json({ sukses: false, pesan: 'Satuan tidak boleh kosong.' });
    }
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
      merk: varian || '',
      kategori: kategoriSimpan,
      total: Number(jumlah) || 0,
      minimum_stock: Number(restock) || 5,
      satuan,
      satuan_gudang: kanonikSatuan(satuanGudang) || '',
      isi_per_gudang: isiPerGudang != null && isiPerGudang !== '' ? Number(isiPerGudang) : null,
      keterangan: keterangan || '',
      dibuat_pada: nowIso(),
      ...(Number(jumlah) > 0 && Number(totalBayar) > 0 ? { harga_barang: Number(totalBayar) / Number(jumlah) } : {}),
    });
    if (ins.error) throw new Error(ins.error.message);

    const vCatat = await vendorKeCatat(req.body);
    await catatTransaksi(idPakai, namaBersih, varian, kategoriSimpan, 'Masuk', Number(jumlah) || 0, satuan,
      Number(jumlah) > 0 && Number(totalBayar) > 0 ? Number(totalBayar) / Number(jumlah) : null,
      null, vCatat.keterangan, vCatat.idVendor);

    res.json({ sukses: true, pesan: `Barang baru ${namaBersih} tersimpan ke database. Stock awal: ${Number(jumlah) || 0} ${satuan}` });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ sukses: false, pesan: (err.status ? '' : 'Gagal menyimpan: ') + err.message });
  }
});

// Ubah metadata barang (ID + stock terkunci; satuan wajib konfirmasi ketik-ulang)
router.put('/api/barang/:id', wajibGudang, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const ada = await sb.from('barang_inventory').select('*').eq('id_barang', id).maybeSingle();
    if (ada.error) throw new Error(ada.error.message);
    if (!ada.data) return res.status(404).json({ sukses: false, pesan: 'Barang tidak ditemukan.' });
    if ('id' in req.body || 'stock' in req.body || 'total' in req.body) {
      return res.status(400).json({ sukses: false, pesan: 'ID dan stock tidak bisa diubah. Stock hanya via Masuk/Keluar.' });
    }
    const { nama, varian, kategori, restock, satuanEceran, konfirmasiSatuan, satuanGudang, isiPerGudang, keterangan, hargaBarang } = req.body;
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
    if (varian !== undefined) patch.merk = String(varian || '').trim();
    if (kategori !== undefined) patch.kategori = String(kategori || '').trim().toUpperCase();
    if (keterangan !== undefined) patch.keterangan = String(keterangan || '');
    if (restock !== undefined) {
      if (!(Number(restock) >= 0)) return res.status(400).json({ sukses: false, pesan: 'Batas restock harus angka >= 0.' });
      patch.minimum_stock = Number(restock);
    }
    if (satuanEceran !== undefined) {
      const satuanBaru = kanonikSatuan(satuanEceran);
      if (!satuanBaru) return res.status(400).json({ sukses: false, pesan: 'Satuan tidak boleh kosong.' });
      const satuanLama = kanonikSatuan(ada.data.satuan) || 'pcs';
      if (satuanBaru !== satuanLama) {
        if (kanonikSatuan(konfirmasiSatuan) !== satuanBaru) {
          return res.status(400).json({ sukses: false, pesan: `Ketik ulang "${satuanBaru}" persis untuk ganti satuan. Stock ${ada.data.total} ikut berubah makna menjadi ${satuanBaru}.` });
        }
        patch.satuan = satuanBaru;
      }
    }
    if (satuanGudang !== undefined) patch.satuan_gudang = kanonikSatuan(satuanGudang) || '';
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
router.delete('/api/barang/:id', wajibGudang, async (req, res) => {
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
router.post('/api/prosesTransaksi', wajibGudang, async (req, res) => {
  try {
    const { id, jenis, jumlah, satuanInput, totalBayar } = req.body;
    const b = await sb.from('barang_inventory').select('*').eq('id_barang', String(id).trim()).maybeSingle();
    if (b.error) throw new Error(b.error.message);
    const row = b.data;

    if (!row) {
      return res.json({ sukses: false, pesan: 'Barang tidak ditemukan di database.' });
    }
    let vCatat = { idVendor: null, keterangan: null };
    try {
      vCatat = await vendorKeCatat(req.body);
    } catch (e) {
      return res.status(e.status || 500).json({ sukses: false, pesan: e.message });
    }

    // Eceran-saja: frontend (kalkulator) yang mengalikan dus -> eceran.
    const satuanEceran = kanonikSatuan(row.satuan) || 'pcs';
    const satuanMinta = kanonikSatuan(satuanInput) || satuanEceran;
    if (satuanMinta.toLowerCase() !== satuanEceran.toLowerCase()) {
      return res.json({ sukses: false, pesan: `Kirim dalam ${satuanEceran} (sistem eceran-saja).` });
    }

    const jmlh = Number(jumlah);

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
      if (up.error) throw new Error(up.error.message);
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

    const keteranganSatuan = `${jmlh} ${satuanEceran}`;

    await catatTransaksi(row.id_barang,
                        row.nama_barang,
                        row.merk,
                        row.kategori,
                        jenis,
                        jmlh,
                        satuanEceran,
                        hargaSatuanTrx,
                        null,
                        jenis === 'Masuk' ? vCatat.keterangan : null,
                        jenis === 'Masuk' ? vCatat.idVendor : null);
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

module.exports = router;
