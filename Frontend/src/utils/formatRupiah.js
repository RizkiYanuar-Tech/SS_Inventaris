// Format nominal id-ID: 500000 <-> "500.000" (khusus input Rp).
export function formatRibu(nilai) {
    const digits = String(nilai ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('id-ID');
}

export function parseRibu(teks) {
    const digits = String(teks ?? '').replace(/\D/g, '');
    return digits === '' ? null : Number(digits);
}
