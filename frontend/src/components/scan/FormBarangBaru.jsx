import { useMemo, useState } from 'react';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { PackagePlus } from 'lucide-react';
import { formatRibu, parseRibu } from '../../utils/formatRupiah';
import { opsiKategori } from '../../utils/kategori';
import InputKategori from '../stock/InputKategori';

// Form manual barang masuk (10 field, tanpa kolom ID — ID auto MNL di server).
export default function FormBarangBaru({ id, onSubmit, daftarBarang }) {
    const [nama, setNama] = useState('');
    const [varian, setVarian] = useState('');
    const [kategori, setKategori] = useState('');
    const [satuan, setSatuan] = useState('pcs');
    const [satuanGudang, setSatuanGudang] = useState('');
    const [isiPerGudang, setIsiPerGudang] = useState('');
    const [stockMasuk, setStockMasuk] = useState('');
    const [keterangan, setKeterangan] = useState('');
    const [minimum, setMinimum] = useState(5);
    const [totalBayar, setTotalBayar] = useState('');
    const [errorMsg, setErrorMsg] = useState(null);
    const daftarKategori = useMemo(() => opsiKategori(daftarBarang), [daftarBarang]);

    function handleSubmit() {
        if (!nama.trim()) { setErrorMsg('Nama Barang wajib diisi.'); return; }
        if (!kategori.trim()) { setErrorMsg('Kategori Bahan wajib diisi.'); return; }
        if (!satuan.trim()) { setErrorMsg('Satuan wajib diisi.'); return; }
        if (!(Number(stockMasuk) > 0)) { setErrorMsg('Stock Masuk harus angka > 0.'); return; }
        if (!(Number(totalBayar) > 0)) { setErrorMsg('Total bayar (Rp) wajib diisi.'); return; }
        if (isiPerGudang !== '' && !(Number(isiPerGudang) > 0)) { setErrorMsg('Isi per Satuan Gudang harus angka > 0 bila diisi.'); return; }
        setErrorMsg(null);
        onSubmit({
            id: id || '',
            nama: nama.trim().replace(/\s+/g, ' '),
            varian: varian.trim(),
            kategori: kategori.trim(),
            jumlah: Number(stockMasuk),
            restock: Number(minimum) || 5,
            totalBayar: parseRibu(totalBayar),
            satuanEceran: satuan.trim(),
            satuanGudang: satuanGudang.trim(),
            isiPerGudang: isiPerGudang === '' ? null : Number(isiPerGudang),
            keterangan: keterangan.trim(),
        });
    }

    return (
        <Card className="shadow-sm border-0 mb-3" style={{ borderRadius: '12px' }}>
            <Card.Body>
                <p className="fw-bold mb-1">Barang baru</p>
                <p className="text-muted small mb-3">{id ? `ID: ${id}` : 'ID: otomatis (MNL-…)'} • Stock dalam Satuan</p>

                {errorMsg && <Alert variant="danger" className="py-2 small">{errorMsg}</Alert>}

                <Form.Group className="mb-2">
                    <Form.Label className="text-muted small mb-1">Nama Barang *</Form.Label>
                    <Form.Control value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Susu Greenfield" />
                </Form.Group>

                <Form.Group className="mb-2">
                    <Form.Label className="text-muted small mb-1">Merk</Form.Label>
                    <Form.Control value={varian} onChange={(e) => setVarian(e.target.value)} placeholder="Anchor, Amidis (kosongkan bila tanpa merk)" />
                </Form.Group>

                <Form.Group className="mb-2">
                    <Form.Label className="text-muted small mb-1">Kategori Bahan *</Form.Label>
                    <InputKategori value={kategori}
                        onChange={setKategori} opsi={daftarKategori} />
                </Form.Group>

                <div className="d-flex gap-2">
                    <Form.Group className="mb-2 flex-fill">
                        <Form.Label className="text-muted small mb-1">Satuan *</Form.Label>
                        <Form.Control value={satuan} onChange={(e) => setSatuan(e.target.value)} placeholder="pcs, gr, kg" />
                    </Form.Group>
                    <Form.Group className="mb-2 flex-fill">
                        <Form.Label className="text-muted small mb-1">Satuan Gudang (opsional)</Form.Label>
                        <Form.Control value={satuanGudang} onChange={(e) => setSatuanGudang(e.target.value)} placeholder="Dus, Pack (kosongkan bila tanpa kemasan)" />
                    </Form.Group>
                </div>

                <Form.Group className="mb-2">
                    <Form.Label className="text-muted small mb-1">Isi per Satuan Gudang (cth: 1 pack = 60 → isi 60)</Form.Label>
                    <Form.Control type="number" inputMode="numeric" min="1" value={isiPerGudang} onChange={(e) => setIsiPerGudang(e.target.value)} placeholder="Kosongkan bila tak ada pasangan" />
                </Form.Group>

                <div className="d-flex gap-2">
                    <Form.Group className="mb-2 flex-fill">
                        <Form.Label className="text-muted small mb-1">Stock Masuk *</Form.Label>
                        <Form.Control type="number" inputMode="numeric" min="1" value={stockMasuk} onChange={(e) => setStockMasuk(e.target.value)} placeholder="0" />
                    </Form.Group>
                    <Form.Group className="mb-2 flex-fill">
                        <Form.Label className="text-muted small mb-1">Minimum Stock *</Form.Label>
                        <Form.Control type="number" inputMode="numeric" min="0" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
                    </Form.Group>
                </div>

                <Form.Group className="mb-2">
                    <Form.Label className="text-muted small mb-1">Keterangan</Form.Label>
                    <Form.Control value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="cth: 250 gr, botol 750ml (opsional)" />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className="text-muted small mb-1">Total bayar stock awal (Rp) *</Form.Label>
                    <Form.Control type="text" inputMode="numeric" value={formatRibu(totalBayar)} onChange={(e) => setTotalBayar(e.target.value.replace(/\D/g, ''))} placeholder="Wajib diisi" />
                </Form.Group>

                <Button variant="success" className="w-100 d-flex align-items-center justify-content-center gap-2" onClick={handleSubmit}>
                    <PackagePlus size={18} /> Simpan sebagai Barang Masuk
                </Button>
            </Card.Body>
        </Card>
    );
}
