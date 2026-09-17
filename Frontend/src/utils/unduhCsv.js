// Unduh CSV client-side (tanpa endpoint): rincian aset inventory + baris TOTAL.
// Delimiter ';' + BOM agar rapi dibuka Excel Indonesia.
function selCsv(v) {
    const s = String(v ?? '');
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function barangKeCsv(barang) {
    const baris = [['ID', 'Nama', 'Varian', 'Kategori', 'Satuan', 'Stock', 'Harga Satuan (Rp)', 'Total (Rp)']];
    let total = 0;
    for (const b of barang || []) {
        const stock = Number(b.stock) || 0;
        const harga = b.hargaBarang != null ? Number(b.hargaBarang) : null;
        const nilai = harga != null ? stock * harga : null;
        if (nilai != null) total += nilai;
        baris.push([
            b.id || '', b.nama || '', b.varian || '', b.kategori || '',
            b.satuanEceran || '', stock,
            harga != null ? harga : '', nilai != null ? nilai : '',
        ]);
    }
    baris.push(['TOTAL ASET', '', '', '', '', '', '', total]);
    const stamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    baris.push([`Diunduh pada ${stamp} WIB`, '', '', '', '', '', '', '']);
    return '\uFEFF' + baris.map(r => r.map(selCsv).join(';')).join('\r\n');
}

export function unduhCsv(namaFile, isi) {
    const blob = new Blob([isi], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = namaFile;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
