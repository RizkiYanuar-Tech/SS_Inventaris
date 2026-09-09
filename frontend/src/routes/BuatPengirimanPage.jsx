import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Form, Button, Card, ListGroup, Badge } from 'react-bootstrap';
import { fetchBarang, buatPengiriman } from '../api/client';
import ResultModal from '../components/common/ResultModal';

// Kirim Susulan / Non-Pesanan: pengiriman manual tanpa pesanan
// (susulan kurang, tukar varian keliru, titipan/promosi).
// T2: jalur utama menjadi otomatis dari approve pesanan.
export default function BuatPengirimanPage() {
    const navigate = useNavigate();
    const [barang, setBarang] = useState([]);
    const [search, setSearch] = useState('');
    const [outlet, setOutlet] = useState('');
    const [keranjang, setKeranjang] = useState({}); // {id: {...brg, jumlah}}
    const [modal, setModal] = useState({ show: false, sukses: false, pesan: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchBarang().then(setBarang).catch(e => setError(e.message));
    }, []);

    const hasil = useMemo(() => {
        const q = search.toLowerCase();
        return barang.filter(b => !q || b.nama.toLowerCase().includes(q) || String(b.id).includes(search));
    }, [barang, search]);

    function setQty(b, nilai) {
        const q = Math.floor(Number(nilai));
        setKeranjang(prev => {
            if (!q || q <= 0) {
                const { [b.id]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [b.id]: { ...b, jumlah: Math.min(q, Number(b.stock)) } };
        });
    }

    const isiKeranjang = Object.values(keranjang);

    async function handleSubmit() {
        if (!outlet.trim()) {
            setModal({ show: true, sukses: false, pesan: 'Nama outlet wajib diisi.' });
            return;
        }
        if (isiKeranjang.length === 0) {
            setModal({ show: true, sukses: false, pesan: 'Keranjang masih kosong.' });
            return;
        }
        setSaving(true);
        try {
            const res = await buatPengiriman({
                outlet: outlet.trim(),
                items: isiKeranjang.map(k => ({ id: k.id, jumlah: k.jumlah }))
            });
            setModal({ show: true, sukses: true, pesan: `${res.pesan} ID: ${res.idKirim}` });
            setKeranjang({});
        } catch (e) {
            setModal({ show: true, sukses: false, pesan: e.message });
        } finally {
            setSaving(false);
        }
    }

    function closeModal() {
        const ok = modal.sukses;
        setModal(m => ({ ...m, show: false }));
        if (ok) navigate('/pesanan');
    }

    if (error) return <p className='text-center py-5 text-danger'>{error}</p>;

    return (
        <Container className='py-4' style={{ maxWidth: '480px' }}>
            <h2 className='mb-3 fw-bold text-center'>Kirim Susulan</h2>

            <Form.Group className='mb-3'>
                <Form.Label className='text-muted small mb-1'>Nama Outlet Tujuan</Form.Label>
                <Form.Control value={outlet} onChange={e => setOutlet(e.target.value)} placeholder='cth: Toko Maju Jaya' />
            </Form.Group>

            <Form.Control
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder='Cari barang...' className='mb-2'
            />
            <ListGroup className='mb-3' style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {hasil.slice(0, 30).map(b => (
                    <ListGroup.Item key={b.id} className='d-flex justify-content-between align-items-center py-2'>
                        <div>
                            <div className='fw-medium small'>{b.nama}</div>
                            <div className='text-muted' style={{ fontSize: '11px' }}>Stock: {b.stock} {b.satuanEceran}</div>
                        </div>
                        <div className='d-flex align-items-center gap-1'>
                            <Button size='sm' variant='outline-secondary' onClick={() => setQty(b, (keranjang[b.id]?.jumlah || 0) - 1)}>-</Button>
                            <Form.Control type='number' inputMode='numeric' min='0' size='sm' style={{ width: '90px' }}
                                placeholder='0' value={keranjang[b.id]?.jumlah || ''}
                                onChange={e => setQty(b, e.target.value)} />
                            <Button size='sm' variant='outline-primary' onClick={() => setQty(b, (keranjang[b.id]?.jumlah || 0) + 1)}>+</Button>
                        </div>
                    </ListGroup.Item>
                ))}
            </ListGroup>

            {isiKeranjang.length > 0 && (
                <Card className='shadow-sm border-0 mb-3'>
                    <Card.Body>
                        <p className='fw-bold mb-2 small'>Keranjang ({isiKeranjang.length} item)</p>
                        {isiKeranjang.map(k => (
                            <div key={k.id} className='d-flex justify-content-between small mb-1'>
                                <span>{k.nama}</span>
                                <Badge bg='primary'>{k.jumlah} {k.satuanEceran}</Badge>
                            </div>
                        ))}
                    </Card.Body>
                </Card>
            )}

            <Button variant='success' className='w-100' disabled={saving} onClick={handleSubmit}>
                {saving ? 'Menyimpan...' : 'Buat Pengiriman (SIAP KIRIM)'}
            </Button>
            <Button variant='outline-secondary' className='w-100 mt-2' onClick={() => navigate('/pesanan')}>
                Kembali
            </Button>

            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={closeModal} />
        </Container>
    );
}
