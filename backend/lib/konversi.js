// Faktor konversi terstruktur: 1 <satuan_gudang> = <isi_per_gudang> <satuan>.
// Metrik baku lolos tanpa data. NULL/tak cocok -> tolak (fail-closed).
const ALIAS_SATUAN = {
  gram: 'gr', grams: 'gr', g: 'gr', kilo: 'kg', kilogram: 'kg',
  litre: 'liter', ltr: 'liter', l: 'liter',
  pieces: 'pcs', piece: 'pcs', pc: 'pcs',
};
const normSatuan = (u) => ALIAS_SATUAN[String(u || '').trim().toLowerCase()] || String(u || '').trim().toLowerCase();
// Kanonik tampil = norm (huruf-kecil + alias). pcs/Pcs/PCS/pc -> pcs.
const kanonikSatuan = (u) => normSatuan(u);
const FAKTOR_METRIK = { 'kg>gr': 1000, 'gr>kg': 0.001, 'liter>ml': 1000, 'ml>liter': 0.001 };
function parseKonversi(isiPerGudang, gudangItem, dari, ke) {
  const d = normSatuan(dari);
  const k = normSatuan(ke);
  if (!d || d === k) return 1;
  if (FAKTOR_METRIK[`${d}>${k}`]) return FAKTOR_METRIK[`${d}>${k}`];
  const n = Number(isiPerGudang);
  if (d === normSatuan(gudangItem) && Number.isFinite(n) && n > 0) return n;
  return null;
}

// Moving-average aset: avgBaru = (totalLama*avgLama + totalBayar) / (totalLama + qtyMasuk).
// totalBayar = rupiah yang dibayar untuk qtyMasuk (sesuai nota, tanpa pusing satuan).
function hitungAvg(avgLama, totalLama, totalBayar, qtyMasuk) {
  const t = Number(totalLama) || 0;
  const q = Number(qtyMasuk) || 0;
  const bayar = Number(totalBayar) || 0;
  if (!(q > 0) || !(bayar > 0) || (t + q) <= 0) return null;
  const nilaiLama = avgLama != null && avgLama !== '' ? t * Number(avgLama) : 0;
  return (nilaiLama + bayar) / (t + q);
}

module.exports = { ALIAS_SATUAN, normSatuan, kanonikSatuan, FAKTOR_METRIK, parseKonversi, hitungAvg };
