import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Card, Form, Button, Badge, Alert, Tabs, Tab } from 'react-bootstrap';
import { lihatPesananOutlet, buatPesananOutlet } from '../api/client';
import ResultModal from '../components/common/ResultModal';

// Halaman publik outlet (tanpa nav, Incognito-friendly): Tab Pesan Baru + Tab Riwayat.
// Link: /pesan/<slug>-<token8>; auth via token saja (slug diabaikan, ikut backend).
const STATUS_AKTIF = ['BARU', 'DISETUJUI', 'DISETUJUI SEBAGIAN', 'SIAP KIRIM', 'DIKIRIM'];
const WARNA = {
    'BARU': 'secondary', 'DISETUJUI': 'primary', 'DISETUJUI SEBAGIAN': 'warning',
    'DITOLAK': 'danger', 'DITERIMA': 'success', 'DITERIMA SEBAGIAN': 'warning',
};

function BadgeStatus({ status }) {
    if (status === 'DIKIRIM') {
        return <Badge style={{ backgroundColor: '#6f42c1' }}>{status}</Badge>;
    }
    return <Badge bg={WARNA[status] || 'dark'}>{status}</Badge>;
}

export default function PesanOutletPage() {
    const { slugToken } = useParams();
    const token = (slugToken || '').slice((slugToken || '').lastIndexOf('-') + 1);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('pesan');
    const [filter, setFilter] = useState('Aktif');
    const [search, setSearch] = useState('');
    const [keranjang, setKeranjang] = useState({}); // {id: qty}
    const [nama, setNama] = useState('');
    const [saving, setSaving] = useState(false);
    const [modal, setModal] = useState({ show: false, sukses: false, pesan: '' });

    async function muat() {
        try {
            setData(await lihatPesananOutlet(token));
            setError(null);
        } catch (e) { setError(e.message); }
    }
    useEffect(() => { muat(); /* eslint-disable-next-line */ }, [token]);

    const katalog = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return data?.katalog || [];
        return (data?.katalog || []).filter(b =>
            (`${b.nama} ${b.varian} ${b.id}`.toLowerCase().includes(q)));
    }, [data, search]);

    const isiKeranjang = useMemo(() =>
        Object.entries(keranjang)
            .filter(([, q]) => Number(q) > 0)
            .map(([id, qty]) => ({ id, qty: Number(qty) })),
        [keranjang]);

    function setQty(id, qty) {
        setKeranjang(prev => ({ ...prev, [id]: qty }));
    }

    async function handleSubmit() {
        if (!nama.trim()) {
            setModal({ show: true, sukses: false, pesan: 'Nama pemesan wajib diisi.' });
            return;
        }
        if (isiKeranjang.length === 0) {
            setModal({ show: true, sukses: false, pesan: 'Keranjang masih kosong.' });
            return;
        }
        setSaving(true);
        try {
            const res = await buatPesananOutlet(token, { namaPemesan: nama.trim(), items: isiKeranjang });
            setModal({ show: true, sukses: true, pesan: res.pesan });
            setKeranjang({});
            setNama('');
            setTab('riwayat');
            muat();
        } catch (e) {
            setModal({ show: true, sukses: false, pesan: e.message });
        } finally {
            setSaving(false);
        }
    }

    function salinLink(path) {
        const url = `${window.location.origin}${path}`;
        navigator.clipboard?.writeText(url).catch(() => {});
        setModal({ show: true, sukses: true, pesan: 'Link berita acara disalin.' });
    }

    if (error) return <Container className='py-5 text-center' style={{ maxWidth: '480px' }}><Alert variant='danger'>{error}</Alert></Container>;
    if (!data) return <p className='text-center py-5 text-muted'>Memuat...</p>;

    const riwayat = data.riwayat || [];
    const jmlAktif = riwayat.filter(r => STATUS_AKTIF.includes(String(r.status || '').trim())).length;
    const tampil = riwayat.filter(r => {
        const s = String(r.status || '').trim();
        const aktif = STATUS_AKTIF.includes(s);
        if (filter === 'Aktif') return aktif;
        if (filter === 'Diterima') return s === 'DITERIMA' || s === 'DITERIMA SEBAGIAN';
        if (filter === 'Batal') return s === 'DITOLAK';
        return true;
    });

    return (
        <Container className='py-4' style={{ maxWidth: '480px' }}>
            <h2 className='mb-1 fw-bold text-center'>{data.outlet}</h2>
            <p className='text-center text-muted small mb-3'>
                Batch masuk: {data.jadwal?.batchMasuk} • Rencana kirim: {data.jadwal?.rencanaKirim}<br />
                Slot Senin & Kamis, cutoff 15:00 WIB
            </p>

            <Tabs activeKey={tab} onSelect={setTab} className='mb-3'>
                <Tab eventKey='pesan' title='Pesan Baru'>
                    {!data.bolehPesan && data.pesananAktif ? (
                        <Card className='shadow-sm border-0'>
                            <Card.Body className='text-center'>
                                <div className='mb-2'><BadgeStatus status={data.pesananAktif.status} /></div>
                                <p className='small mb-1'>
                                    Pesanan <strong>{data.pesananAktif.idPesan}</strong> masih aktif
                                    (status {data.pesananAktif.status}).
                                </p>
                                <p className='text-muted small mb-3'>
                                    Tunggu konfirmasi sebelum pesan baru. Pantau di Tab Riwayat.
                                </p>
                                <Button size='sm' variant='outline-primary' onClick={() => setTab('riwayat')}>
                                    Lihat Riwayat
                                </Button>
                            </Card.Body>
                        </Card>
                    ) : (
                        <>
                            <Form.Control
                                size='sm' className='mb-2' placeholder='Cari barang...'
                                value={search} onChange={e => setSearch(e.target.value)}
                            />
                            {katalog.length === 0 && <p className='text-center text-muted small py-3'>Tidak ada barang yang cocok.</p>}
                            {katalog.map(b => (
                                <Card key={b.id} className='shadow-sm border-0 mb-2'>
                                    <Card.Body className='py-2 d-flex justify-content-between align-items-center gap-2'>
                                        <div>
                                            <div className='fw-medium small'>{b.nama}</div>
                                            <div className='text-muted' style={{ fontSize: '11px' }}>
                                                {[b.varian, b.satuan].filter(Boolean).join(' • ')}
                                            </div>
                                        </div>
                                        <Form.Control
                                            type='number' inputMode='numeric' min='0' size='sm' style={{ width: '100px' }}
                                            placeholder='0'
                                            value={keranjang[b.id] || ''}
                                            onChange={e => setQty(b.id, e.target.value)}
                                        />
                                    </Card.Body>
                                </Card>
                            ))}
                            {isiKeranjang.length > 0 && (
                                <Card className='shadow-sm border-0 mb-2 bg-light'>
                                    <Card.Body className='py-2 small'>
                                        {isiKeranjang.map(it => {
                                            const b = (data.katalog || []).find(x => x.id === it.id);
                                            return <div key={it.id} className='d-flex justify-content-between'>
                                                <span>{b?.nama || it.id}</span><strong>x{it.qty}</strong>
                                            </div>;
                                        })}
                                    </Card.Body>
                                </Card>
                            )}
                            <Form.Group className='my-3'>
                                <Form.Label className='text-muted small mb-1'>Nama Pemesan (wajib)</Form.Label>
                                <Form.Control value={nama} onChange={e => setNama(e.target.value)} placeholder='Nama jelas' />
                            </Form.Group>
                            <Button variant='success' className='w-100' disabled={saving} onClick={handleSubmit}>
                                {saving ? 'Mengirim...' : 'Kirim Pesanan'}
                            </Button>
                        </>
                    )}
                </Tab>
                <Tab eventKey='riwayat' title={`Riwayat${jmlAktif ? ` (${jmlAktif})` : ''}`}>
                    <div className='d-flex gap-2 mb-3'>
                        {['Aktif', 'Diterima', 'Batal', 'Semua'].map(f => (
                            <Button key={f} size='sm' variant={filter === f ? 'dark' : 'outline-secondary'} onClick={() => setFilter(f)}>
                                {f}
                            </Button>
                        ))}
                    </div>
                    {tampil.length === 0 && <p className='text-center text-muted small py-3'>Belum ada riwayat.</p>}
                    {tampil.map(r => (
                        <Card key={r.idPesan} className='shadow-sm border-0 mb-2'>
                            <Card.Body className='py-2'>
                                <div className='d-flex justify-content-between align-items-center mb-1'>
                                    <strong className='small'>{r.idPesan}</strong>
                                    <BadgeStatus status={r.status} />
                                </div>
                                <div className='text-muted' style={{ fontSize: '11px' }}>
                                    {r.tanggalPesan} • Batch {r.batchMasuk} • Kirim {r.rencanaKirim}
                                </div>
                                <div className='text-muted my-1' style={{ fontSize: '11px' }}>{r.ringkasan}</div>
                                {r.status === 'DITOLAK' && r.alasanTolak && (
                                    <Alert variant='danger' className='py-1 px-2 my-1 small'>Alasan: {r.alasanTolak}</Alert>
                                )}
                                {r.status === 'DIKIRIM' && r.linkTerima && (
                                    <Button size='sm' variant='outline-primary' className='w-100 mt-1'
                                        onClick={() => salinLink(r.linkTerima)}>
                                        Salin Link Berita Acara
                                    </Button>
                                )}
                            </Card.Body>
                        </Card>
                    ))}
                </Tab>
            </Tabs>

            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={() => setModal(m => ({ ...m, show: false }))} />
        </Container>
    );
}
