// Foto bukti paket (berita acara dua arah): kompres canvas + upload langsung
// browser -> Supabase Storage REST (tanpa dep tambahan). Bucket: `bukti-kirim` (public).
// Upload GAGAL = return null, tak pernah throw (gagal tak blokir Tandai/Kunci).
const BUCKET = 'bukti-kirim';
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// ponytail: canvas_resize, ganti lib kompresi bila kualitas kurang
export function kompresFoto(file, maxSisi = 1280, kualitas = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objUrl = window.URL.createObjectURL(file);
        img.onload = () => {
            try {
                const skala = Math.min(1, maxSisi / Math.max(img.width, img.height));
                const w = Math.round(img.width * skala);
                const h = Math.round(img.height * skala);
                const kanvas = document.createElement('canvas');
                kanvas.width = w; kanvas.height = h;
                kanvas.getContext('2d').drawImage(img, 0, 0, w, h);
                window.URL.revokeObjectURL(objUrl);
                kanvas.toBlob(b => (b ? resolve(b) : reject(new Error('Kompresi gagal.'))), 'image/jpeg', kualitas);
            } catch (e) { reject(e); }
        };
        img.onerror = () => { window.URL.revokeObjectURL(objUrl); reject(new Error('File bukan gambar.')); };
        img.src = objUrl;
    });
}

export async function uploadFotoBukti(idKirim, sisi, file) {
    try {
        if (!SUPA_URL || !SUPA_KEY || !file) return null;
        const blob = await kompresFoto(file);
        const nama = `${encodeURIComponent(idKirim)}/${sisi}-${Date.now()}.jpg`;
        const res = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${nama}`, {
            method: 'POST',
            headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'image/jpeg' },
            body: blob,
        });
        if (!res.ok) return null;
        return `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${nama}`;
    } catch {
        return null;
    }
}
