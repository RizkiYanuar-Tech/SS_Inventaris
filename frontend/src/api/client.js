const BASE_URL = "/api"

export async function fetchBarang() {
    const res = await fetch(`${BASE_URL}/barang`)
    if (!res.ok) {
        throw new Error('Gagal mengambil data barang')
    }
    
    return res.json()
}

export async function fetchTransaksi() {
    const res = await fetch(`${BASE_URL}/transaksi`)
    if (!res.ok){
        throw new Error("Gagal mengambil data transaksi")
    }
    return res.json()
}

export async function cekBarang(id) {
    const res = await fetch(`${BASE_URL}/cekBarang/${encodeURIComponent(id)}`)
    if (!res.ok){
        throw new Error("Gagal memeriksa barang di database")
    }
    return res.json()
}

export async function tambahBarangBaru(payload) {
    try {
        const res = await fetch(`${BASE_URL}/tambahBarangBaru`,{
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        })
        if (!res.ok){
            throw new Error("Gagal Menambahkan Barang ke Database")
        }
        return await res.json();
    } catch (error){
        return error;
    }
}

export async function ubahBarang(id, payload) {
    const res = await fetch(`${BASE_URL}/barang/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    return handleRes(res, 'Gagal mengubah barang');
}

export async function hapusBarang(id) {
    const res = await fetch(`${BASE_URL}/barang/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return handleRes(res, 'Gagal menghapus barang');
}

export async function prosesTransaksi(payload){
    try{
        const res = await fetch(`${BASE_URL}/prosesTransaksi`,{
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify(payload)
        })
        if (!res.ok){
            throw new Error("Proses transaksi mengalami kegagalan")
        }
        return await res.json()
    } catch(error){
        return error;
    }
}

async function handleRes(res, pesanGagal) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.pesan || data.error || pesanGagal);
    if (data.sukses === false) throw new Error(data.pesan || pesanGagal);
    return data;
}

export async function buatPengiriman(payload) {
    const res = await fetch(`${BASE_URL}/pengiriman`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    return handleRes(res, 'Gagal membuat pengiriman');
}

export async function fetchPengiriman() {
    const res = await fetch(`${BASE_URL}/pengiriman`);
    return handleRes(res, 'Gagal mengambil data pengiriman');
}

export async function tandaiDikirim(idKirim, pindaian = [], fotoKirim = null) {
    const res = await fetch(`${BASE_URL}/pengiriman/${encodeURIComponent(idKirim)}/kirim`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ pindaian, fotoKirim })
    });
    return handleRes(res, 'Gagal menandai dikirim');
}

export async function batalkanPengiriman(idKirim, alasan) {
    const res = await fetch(`${BASE_URL}/pengiriman/${encodeURIComponent(idKirim)}/batal-kirim`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ alasan })
    });
    return handleRes(res, 'Gagal membatalkan pengiriman');
}

export async function lihatPesananOutlet(token, ringan = false) {
    const res = await fetch(`${BASE_URL}/pesan/${encodeURIComponent(token)}${ringan ? '?ringan=1' : ''}`);
    return handleRes(res, 'Link tidak valid');
}

export async function buatPesananOutlet(token, payload) {
    const res = await fetch(`${BASE_URL}/pesan/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    return handleRes(res, 'Gagal mengirim pesanan');
}

export async function fetchPesanan() {
    const res = await fetch(`${BASE_URL}/pesanan`);
    return handleRes(res, 'Gagal mengambil data pesanan');
}

export async function putusPesanan(idPesan, payload) {
    const res = await fetch(`${BASE_URL}/pesanan/${encodeURIComponent(idPesan)}/keputusan`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    return handleRes(res, 'Gagal memutus pesanan');
}

export async function resetLinkOutlet(slug) {
    const res = await fetch(`${BASE_URL}/outlet/${encodeURIComponent(slug)}/reset-link`, { method: 'POST' });
    return handleRes(res, 'Gagal mereset link');
}

export async function fetchOutlet() {
    const res = await fetch(`${BASE_URL}/outlet`);
    return handleRes(res, 'Gagal mengambil data outlet');
}

export async function lihatPengiriman(token) {
    const res = await fetch(`${BASE_URL}/pengiriman/${encodeURIComponent(token)}/lihat`);
    return handleRes(res, 'Link tidak valid');
}

export async function konfirmasiTerima(token, payload) {
    const res = await fetch(`${BASE_URL}/pengiriman/${encodeURIComponent(token)}/konfirmasi`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    return handleRes(res, 'Gagal mengirim laporan');
}