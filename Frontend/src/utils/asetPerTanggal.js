// Aset per tanggal (posisi akhir H 23:59:59 WIB): rekonstruksi mundur stock +
// replay maju moving-average dari transaksi. H < hari-migrasi -> rows kosong,
// TOTAL 0 (ditulis CSV sebagai header + TOTAL + baris metode, bukan error).
function selCsv(v) {
    const s = String(v ?? '');
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Copy rumus backend hitungAvg (lib/konversi.js): avg = (t*avgLama + bayar)/(t+q).
function avgLanjut(avgLama, totalLama, totalBayar, qtyMasuk) {
    const t = Number(totalLama) || 0;
    const q = Number(qtyMasuk) || 0;
    const bayar = Number(totalBayar) || 0;
    if (!(q > 0) || !(bayar > 0) || (t + q) <= 0) return null;
    const nilaiLama = avgLama != null && avgLama !== '' ? t * Number(avgLama) : 0;
    return (nilaiLama + bayar) / (t + q);
}

const wib = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d : null;
};

// Inti hitung (dipakai preview modal + CSV agar angkanya identik).
// Kembali: { rows:[{id,nama,merk,kategori,satuan,stock,harga,total,adaMutasi}], total }.
export function hitungAsetPerTanggal(barang, transaksi, tglH) {
    const batas = new Date(`${tglH}T23:59:59.999+07:00`);
    if (isNaN(batas)) return { rows: [], total: 0 };
    const perId = {};
    for (const t of transaksi || []) {
        const w = wib(t.dibuatPada);
        if (!w) continue;
        (perId[t.idBarang] = perId[t.idBarang] || []).push({ ...t, _w: w });
    }
    const rows = [];
    let total = 0;
    for (const b of barang || []) {
        const lahir = wib(b.dibuatPada);
        if (lahir && lahir > batas) continue; // belum lahir di H
        const trx = (perId[b.id] || []).sort((a, c) =>
            a._w - c._w || (Number(a.idTransaksi) || 0) - (Number(c.idTransaksi) || 0));
        const adaMutasi = trx.some(t => t._w <= batas);
        const stockNow = Number(b.stock) || 0;
        const satKini = String(b.satuanEceran || 'pcs');
        // Mundur: stockH = kini - Masuk_setelah_H + Keluar_setelah_H
        let stockH = stockNow;
        // Maju: replay avg + stock atas trx <= H (butuh Keluar untuk basis stock benar)
        let avg = null, stockJalan = 0;
        for (const t of trx) {
            const q = Number(t.jumlah) || 0;
            if (t._w > batas) {
                if (t.jenis === 'Masuk') stockH -= q; else if (t.jenis === 'Keluar') stockH += q;
                continue;
            }
            if (t.jenis === 'Masuk') {
                const hs = t.hargaSatuan != null ? Number(t.hargaSatuan) : null;
                avg = avgLanjut(avg, stockJalan, hs != null ? hs * q : null, q);
                stockJalan += q;
            } else if (t.jenis === 'Keluar') {
                stockJalan -= q;
            }
        }
        stockH = Math.max(0, Math.round(stockH * 1000) / 1000);
        const nilai = avg != null ? stockH * avg : null;
        if (nilai != null) total += nilai;
        rows.push({
            id: b.id || '', nama: b.nama || '', merk: b.varian || '',
            kategori: b.kategori || '', satuan: satKini, stock: stockH,
            harga: avg != null ? Math.round(avg * 100) / 100 : null,
            total: nilai != null ? Math.round(nilai * 100) / 100 : null,
            adaMutasi,
        });
    }
    return { rows, total };
}

export function asetPerTanggalKeCsv(barang, transaksi, tglH) {
    const { rows, total } = hitungAsetPerTanggal(barang, transaksi, tglH);
    const baris = [[ 'ID', 'Nama', 'Merk', 'Kategori', 'Satuan', `Stock per ${tglH}`,
        `Harga Satuan per ${tglH} (Rp)`, 'Total (Rp)' ]];
    for (const r of rows) {
        baris.push([r.id, r.nama, r.merk, r.kategori, r.satuan, r.stock,
            r.harga != null ? r.harga : '', r.total != null ? r.total : '']);
    }
    baris.push(['TOTAL ASET', '', '', '', '', '', '', Math.round(total * 100) / 100]);
    const stamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    baris.push([`Posisi akhir ${tglH} WIB; barang terhapus tak termasuk. Diunduh ${stamp} WIB`, '', '', '', '', '', '', '']);
    return '\uFEFF' + baris.map(r => r.map(selCsv).join(';')).join('\r\n');
}
