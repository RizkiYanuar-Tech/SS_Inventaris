// Kolom Ringkasan manusiawi + Riwayat (PRD seksi 5)
const { formatWaktuBukti } = require('./waktu');

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

// Riwayat murni (tanpa save): panggil lalu sertakan di update/insert
function tambahRiwayat(lama, teks) {
  const l = lama || '';
  return l ? `${l}\n${formatWaktuBukti()} - ${teks}` : `${formatWaktuBukti()} - ${teks}`;
}

module.exports = { buatRingkasan, buatRingkasanKirim, buatAlasan, tambahRiwayat };
