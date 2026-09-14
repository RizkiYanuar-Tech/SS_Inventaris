import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Badge, Alert } from 'react-bootstrap';
import { fetchBarang, prosesTransaksi, tambahBarangBaru } from '../api/client';
import FormBarangBaru from '../components/scan/FormBarangBaru';
import FormBarangSudahAda from '../components/scan/FormBarangSudahAda';
import ManualVerifikasiKirim from '../components/scan/ManualVerifikasiKirim';
import ResultModal from '../components/common/ResultModal';

// Input manual full (pengganti /scan): cari nama -> kartu kandidat -> konfirmasi,
// lalu form Masuk/Keluar (ketemu) atau form barang baru 10 field (tidak ketemu).
export default function InputManualPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const modeVerifikasi = location.state?.mode === 'verifikasi' ? location.state?.idKirim : null;
    if (modeVerifikasi) return <ManualVerifikasiKirim idKirim={modeVerifikasi} />;

    const [barang, setBarang] = useState([]);
    const [search, setSearch] = useState('');
    const [dipilih, setDipilih] = useState(null); // barang terkonfirmasi
    const [modeBaru, setModeBaru] = useState(false);
    const [status, setStatus] = useState(null);
    const [modal, setModal] = useState({ show: false, sukses: false, pesan: '' });

    useEffect(() => {
        fetchBarang().then(setBarang).catch(e => setStatus({ type: 'error', text: e.message }));
    }, []);

    const kandidat = useMemo(() => {
        const q = search.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!q) return [];
        return barang.filter(b =>
            b.nama.toLowerCase().includes(q) ||
            String(b.id).toLowerCase().includes(q)
        ).slice(0, 10);
    }, [barang, search]);

    async function handleTransaksi(jenis, jumlah, satuanInput, totalBayar) {
        setStatus({ type: 'info', text: 'Memproses transaksi...' });
        try {
            const res = await prosesTransaksi({ id: dipilih.id, jenis, jumlah, satuanInput, totalBayar });
            setStatus(null);
            setModal({ show: true, sukses: !!res.sukses, pesan: res.pesan || '' });
            if (res.sukses) {
                const segar = await fetchBarang();
                setBarang(segar);
                setDipilih(segar.find(b => b.id === dipilih.id) || null);
            }
        } catch (e) {
            setStatus(null);
            setModal({ show: true, sukses: false, pesan: e.message });
        }
    }

    async function handleBaru(payload) {
        setStatus({ type: 'info', text: 'Menyimpan data...' });
        try {
            const res = await tambahBarangBaru(payload);
            setStatus(null);
            setModal({ show: true, sukses: !!res.sukses, pesan: res.pesan || '' });
            if (res.sukses) {
                const segar = await fetchBarang();
                setBarang(segar);
                setModeBaru(false);
                setSearch('');
            }
        } catch (e) {
            setStatus(null);
            setModal({ show: true, sukses: false, pesan: e.message });
        }
    }

    return (
        <Container className='py-4' style={{ maxWidth: '480px' }}>
            <h2 className='mb-3 fw-bold text-center'>Input Manual</h2>

            {status && <Alert variant={status.type === 'error' ? 'danger' : status.type} className='text-center small py-2'>{status.text}</Alert>}

            {!dipilih && !modeBaru && (
                <>
                    <Form.Control value={search} onChange={e => setSearch(e.target.value)}
                        placeholder='Ketik nama barang...' className='mb-2' />
                    {kandidat.map((b, i) => (
                        <Card key={`${b.id}#${i}`} className='shadow-sm border-0 mb-2'>
                            <Card.Body className='py-2 d-flex justify-content-between align-items-center'>
                                <div>
                                    <div className='fw-medium small'>{b.nama}</div>
                                    <div className='text-muted' style={{ fontSize: '11px' }}>
                                        {b.kategori} • {b.divisi || '-'} • {b.satuanEceran} • stock {b.stock}
                                    </div>
                                </div>
                                <Button size='sm' variant='primary' onClick={() => setDipilih(b)}>Pakai ini</Button>
                            </Card.Body>
                        </Card>
                    ))}
                    {search.trim() && (
                        <Button variant='outline-success' className='w-100 mt-1' onClick={() => setModeBaru(true)}>
                            + Buat barang baru “{search.trim()}”
                        </Button>
                    )}
                </>
            )}

            {dipilih && (
                <>
                    <Button size='sm' variant='outline-secondary' className='mb-2'
                        onClick={() => { setDipilih(null); setSearch(''); }}>← Cari lagi</Button>
                    <FormBarangSudahAda barang={dipilih} onSubmit={handleTransaksi} />
                </>
            )}

            {modeBaru && (
                <>
                    <Button size='sm' variant='outline-secondary' className='mb-2'
                        onClick={() => setModeBaru(false)}>← Kembali ke pencarian</Button>
                    <FormBarangBaru onSubmit={handleBaru} daftarBarang={barang} />
                </>
            )}

            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan}
                onClose={() => setModal(m => ({ ...m, show: false }))} />
        </Container>
    );
}
