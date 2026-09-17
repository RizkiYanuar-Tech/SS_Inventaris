// Opsi kategori: 7 kanonik dulu, lalu varian yang sudah ada di data (dedup case-insensitive).
export const KATEGORI_KANONIK = ['BASAH', 'KERING', 'CHEMICAL', 'DAIRY', 'KEMASAN', 'FROZEN', 'PERLENGKAPAN'];

export function opsiKategori(items) {
  const out = [...KATEGORI_KANONIK];
  const ada = new Set(out);
  for (const b of items || []) {
    const v = String(b.kategori || '').trim();
    if (!v) continue;
    if (!ada.has(v.toUpperCase())) {
      ada.add(v.toUpperCase());
      out.push(v);
    }
  }
  return out;
}
