import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Badge, Modal, Form, Tabs, Tab } from 'react-bootstrap';
import {
    fetchPengiriman, batalkanPengiriman,
    fetchPesanan, putusPesanan, fetchOutlet, resetLinkOutlet,
    fetchBarang, buatPesananOutlet,
} from '../api/client';
import ResultModal from '../components/common/ResultModal';

const WARNA = {
    'BARU': 'secondary', 'DISETUJUI': 'primary', 'DISETUJUI SEBAGIAN': 'warning',
    'DITOLAK': 'danger', 'DITERIMA': 'success', 'DITERIMA SEBAGIAN': 'warning',
    'SIAP KIRIM': 'secondary', 'DIKIRIM': 'primary',
};

function BadgeStatus({ status }) {
    if (status === 'DIKIRIM') return <Badge style={{ backgroundColor: '#6f42c1' }}>{status}</Badge>;
    return <Badge bg={WARNA[status] || 'dark'}>{status}</Badge>;
}

// Form putus per item untuk 1 kartu BARU
function PutusForm({ pesanan, onSelesai }) {
    const [mode, setMode] = useState({}); // {itemId: 'PENUHI'|'TOLAK'}
    const [ket, setKet] = useState({}); // {itemId: keterangan}
    const [alasanUmum, setAlasanUmum] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit() {
        const items = (pesanan.items || []).map(it => ({
            id: it.id,
            keputusan: mode[it.id] || 'PENUHI',
            keterangan: ket[it.id] || '',
        }));
        setBusy(true);
        try {
            const res = await putusPesanan(pesanan.idPesan, { items, alasanUmum: alasanUmum.trim() });
            onSelesai(true, res.idKirim ? `${res.pesan} Kirim: ${res.idKirim}` : res.pesan);
        } catch (e) {
            onSelesai(false, e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className='mt-2 border-top pt-2'>
            {(pesanan.items || []).map(it => (
                <div key={it.id} className='mb-2'>
                    <div className='d-flex justify-content-between align-items-center'>
                        <span className='small'>{it.nama} <strong>x{it.qtyPesan}</strong></span>
                        <div className='d-flex gap-1'>
                            <Button size='sm' variant={(mode[it.id] || 'PENUHI') === 'PENUHI' ? 'success' : 'outline-success'}
                                onClick={() => setMode(m => ({ ...m, [it.id]: 'PENUHI' }))}>Penuhi</Button>
                            <Button size='sm' variant={mode[it.id] === 'TOLAK' ? 'danger' : 'outline-danger'}
                                onClick={() => setMode(m => ({ ...m, [it.id]: 'TOLAK' }))}>Tolak</Button>
                        </div>
                    </div>
                    {mode[it.id] === 'TOLAK' && (
                        <Form.Control size='sm' className='mt-1' placeholder='Keterangan wajib (cth: habis)'
                            value={ket[it.id] || ''} onChange={e => setKet(k => ({ ...k, [it.id]: e.target.value }))} />
                    )}
                </div>
            ))}
            <Form.Control size='sm' className='mb-2' placeholder='Alasan umum (wajib bila semua ditolak)'
                value={alasanUmum} onChange={e => setAlasanUmum(e.target.value)} />
            <Button size='sm' variant='primary' className='w-100' disabled={busy} onClick={submit}>
                {busy ? '...' : 'Putuskan'}
            </Button>
        </div>
    );
}

// Tab Buat: pesanan manual masa transisi WA (pakai endpoint outlet yang sama -> ikut blokir P1b)
function BuatForm({ outlets, onSelesai }) {
    const [token, setToken] = useState('');
    const [barang, setBarang] = useState([]);
    const [search, setSearch] = useState('');
    const [keranjang, setKeranjang] = useState({});
    const [nama, setNama] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => { fetchBarang().then(setBarang).catch(() => {}); }, []);
    const hasil = useMemo(() => {
        const q = search.toLowerCase();
        return barang.filter(b => !q || b.nama.toLowerCase().includes(q) || String(b.id).includes(search)).slice(0, 30);
    }, [barang, search]);
    const isi = Object.entries(keranjang).filter(([, q]) => Number(q) > 0).map(([id, qty]) => ({ id, qty: Number(qty) }));

    async function submit() {
        if (!token) return onSelesai(false, 'Pilih outlet dulu.');
        if (!nama.trim()) return onSelesai(false, 'Nama pemesan wajib diisi.');
        if (isi.length === 0) return onSelesai(false, 'Keranjang masih kosong.');
        setBusy(true);
        try {
            const res = await buatPesananOutlet(token, { namaPemesan: nama.trim(), items: isi });
            setKeranjang({}); setNama('');
            onSelesai(true, res.pesan);
        } catch (e) {
            onSelesai(false, e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Form.Select value={token} onChange={e => setToken(e.target.value)} className='mb-2'>
                <option value=''>— Pilih outlet —</option>
                {(outlets || []).map(o => <option key={o.slug} value={o.token}>{o.outlet}</option>)}
            </Form.Select>
            <Form.Control size='sm' value={search} onChange={e => setSearch(e.target.value)} placeholder='Cari barang...' className='mb-2' />
            {hasil.map(b => (
                <div key={b.id} className='d-flex justify-content-between align-items-center small border-bottom py-1'>
                    <span>{b.nama} <span className='text-muted'>{b.varian} • {b.satuanEceran}</span></span>
                    <Form.Control type='number' inputMode='numeric' min='0' size='sm' style={{ width: '100px' }}
                        value={keranjang[b.id] || ''} placeholder='0'
                        onChange={e => setKeranjang(k => ({ ...k, [b.id]: e.target.value }))} />
                </div>
            ))}
            {isi.length > 0 && (
                <div className='small my-2 p-2 bg-light rounded'>
                    {isi.map(it => {
                        const b = barang.find(x => x.id === it.id);
                        return <div key={it.id} className='d-flex justify-content-between'><span>{b?.nama || it.id}</span><strong>x{it.qty}</strong></div>;
                    })}
                </div>
            )}
            <Form.Control size='sm' value={nama} onChange={e => setNama(e.target.value)} placeholder='Nama pemesan (wajib)' className='my-2' />
            <Button variant='success' className='w-100' disabled={busy} onClick={submit}>
                {busy ? '...' : 'Buat Pesanan (BARU)'}
            </Button>
        </>
    );
}

// Hub pesanan gudang (T2d: Daftar + Buat + Lacak).
export default function DaftarPengirimanPage() {
    const navigate = useNavigate();
    const [pesanan, setPesanan] = useState([]);
    const [kiriman, setKiriman] = useState([]);
    const [outlets, setOutlets] = useState([]);
    const [error, setError] = useState(null);
    const [modal, setModal] = useState({ show: false, sukses: false, pesan: '' });
    const [aksi, setAksi] = useState(null); // {mode: 'kirim'|'batal', id}
    const [alasan, setAlasan] = useState('');
    const [lacakId, setLacakId] = useState('');
    const [busy, setBusy] = useState(false);
    const [fStatus, setFStatus] = useState('Semua');
    const [fCari, setFCari] = useState('');
    const [lStatus, setLStatus] = useState('Semua');
    const [lOutlet, setLOutlet] = useState('Semua');
    const [lCari, setLCari] = useState('');

    async function muat() {
        try {
            const [p, k, o] = await Promise.all([fetchPesanan(), fetchPengiriman(), fetchOutlet()]);
            setPesanan(p); setKiriman(k); setOutlets(o); setError(null);
        } catch (e) { setError(e.message); }
    }
    useEffect(() => { muat(); }, []);

    const kirimByPesan = useMemo(() => {
        const m = {};
        for (const k of kiriman) if (k.idPesan && k.idPesan !== '-') m[k.idPesan] = k;
        return m;
    }, [kiriman]);

    const daftar = pesanan.filter(p => {
        if (fStatus !== 'Semua' && p.status !== fStatus) return false;
        if (fCari.trim() && !`${p.idPesan} ${p.outlet}`.toLowerCase().includes(fCari.trim().toLowerCase())) return false;
        return true;
    });

    function selesaiPutus(sukses, pesan) {
        setModal({ show: true, sukses, pesan });
        if (sukses) muat();
    }

    async function jalankanAksi() {
        if (!alasan.trim()) {
            setModal({ show: true, sukses: false, pesan: 'Alasan pembatalan wajib diisi.' });
            return;
        }
        setBusy(true);
        try {
            const res = await batalkanPengiriman(aksi.id, alasan.trim());
            setModal({ show: true, sukses: true, pesan: res.pesan });
            setAksi(null);
            setAlasan('');
            muat();
        } catch (e) {
            setModal({ show: true, sukses: false, pesan: e.message });
        } finally {
            setBusy(false);
        }
    }

    function salinTeks(teks, pesan = 'Disalin.') {
        navigator.clipboard?.writeText(teks).catch(() => {});
        setModal({ show: true, sukses: true, pesan });
    }

    async function resetLink(slug, nama) {
        if (!window.confirm(`Reset link ${nama}? Link lama langsung mati.`)) return;
        try {
            const res = await resetLinkOutlet(slug);
            muat();
            setModal({ show: true, sukses: true, pesan: `${res.pesan} Link: ${window.location.origin}${res.link}` });
        } catch (e) {
            setModal({ show: true, sukses: false, pesan: e.message });
        }
    }

    const lacak = kiriman.find(i => i.idKirim === lacakId);

    if (error) return <p className='text-center py-5 text-danger'>{error}</p>;

    return (
        <Container className='py-4'>
            <div className='d-flex justify-content-between align-items-center mb-3'>
                <h2 className='fw-bold mb-0'>Pesanan & Kirim</h2>
                <Button size='sm' variant='success' onClick={() => navigate('/kirim')}>+ Kirim</Button>
            </div>

            <Tabs defaultActiveKey='daftar' className='mb-3'>
                <Tab eventKey='daftar' title='Daftar'>
                    <Card className='shadow-sm border-0 mb-3'>
                        <Card.Body className='py-2'>
                            <div className='fw-bold small mb-2'>Kelola Link Outlet</div>
                            {(outlets || []).map(o => (
                                <div key={o.slug} className='d-flex justify-content-between align-items-center small border-top py-1 gap-2'>
                                    <span className='text-truncate'>{o.outlet}</span>
                                    <span className='d-flex gap-1 flex-shrink-0'>
                                        <Button size='sm' variant='outline-primary'
                                            onClick={() => salinTeks(`${window.location.origin}${o.link}`, 'Link pesan disalin.')}>Salin</Button>
                                        <Button size='sm' variant='outline-danger' onClick={() => resetLink(o.slug, o.outlet)}>Reset</Button>
                                    </span>
                                </div>
                            ))}
                        </Card.Body>
                    </Card>

                    <div className='d-flex gap-2 mb-2'>
                        <Form.Select size='sm' value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ maxWidth: '180px' }}>
                            {['Semua', 'BARU', 'DISETUJUI', 'DISETUJUI SEBAGIAN', 'DITOLAK', 'SIAP KIRIM', 'DIKIRIM', 'DITERIMA', 'DITERIMA SEBAGIAN'].map(s =>
                                <option key={s} value={s}>{s}</option>)}
                        </Form.Select>
                        <Form.Control size='sm' value={fCari} onChange={e => setFCari(e.target.value)} placeholder='Cari ID / outlet...' />
                    </div>

                    {daftar.length === 0 && <p className='text-center text-muted py-4'>Belum ada pesanan.</p>}
                    {daftar.map(p => {
                        const k = kirimByPesan[p.idPesan];
                        return (
                            <Card key={p.idPesan} className='shadow-sm border-0 mb-2'>
                                <Card.Body className='py-2'>
                                    <div className='d-flex justify-content-between align-items-center mb-1'>
                                        <strong className='small'>{p.idPesan} • {p.outlet}</strong>
                                        <BadgeStatus status={p.status} />
                                    </div>
                                    <div className='text-muted' style={{ fontSize: '11px' }}>
                                        {p.tanggalPesan} • Batch {p.batchMasuk} • Kirim {p.rencanaKirim}
                                    </div>
                                    <div className='text-muted my-1' style={{ fontSize: '11px' }}>{p.ringkasan}</div>
                                    {p.status === 'DITOLAK' && p.alasanTolak && (
                                        <div className='small text-danger'>Alasan: {p.alasanTolak}</div>
                                    )}
                                    {p.status === 'BARU' && <PutusForm pesanan={p} onSelesai={selesaiPutus} />}
                                    {k && (k.status === 'SIAP KIRIM' || k.status === 'DIKIRIM') && (
                                        <div className='d-flex gap-2 mt-2 align-items-center'>
                                            <BadgeStatus status={k.status} />
                                            {k.status === 'SIAP KIRIM' && (
                                                <Button size='sm' variant='primary' onClick={() => navigate('/scan', { state: { mode: 'verifikasi', idKirim: k.idKirim } })}>
                                                    Pindai & Tandai
                                                </Button>
                                            )}
                                            {k.status === 'DIKIRIM' && (
                                                <Button size='sm' variant='outline-danger' onClick={() => setAksi({ mode: 'batal', id: k.idKirim })}>
                                                    Batalkan
                                                </Button>
                                            )}
                                            <Button size='sm' variant='outline-secondary' onClick={() => setLacakId(k.idKirim)}>
                                                Lacak
                                            </Button>
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        );
                    })}
                </Tab>
                <Tab eventKey='buat' title='Buat'>
                    <BuatForm outlets={outlets} onSelesai={(s, pesan) => { setModal({ show: true, sukses: s, pesan }); if (s) muat(); }} />
                </Tab>
                <Tab eventKey='lacak' title='Lacak'>
                    <div className='d-flex gap-2 mb-2'>
                        <Form.Select size='sm' value={lOutlet} onChange={e => { setLOutlet(e.target.value); setLacakId(''); }} style={{ maxWidth: '150px' }}>
                            <option value='Semua'>Semua outlet</option>
                            {(outlets || []).map(o => <option key={o.slug} value={o.outlet}>{o.outlet}</option>)}
                        </Form.Select>
                        <Form.Select size='sm' value={lStatus} onChange={e => { setLStatus(e.target.value); setLacakId(''); }} style={{ maxWidth: '170px' }}>
                            {['Semua', 'SIAP KIRIM', 'DIKIRIM', 'DITERIMA', 'DITERIMA SEBAGIAN'].map(s =>
                                <option key={s} value={s}>{s === 'Semua' ? 'Semua status' : s}</option>)}
                        </Form.Select>
                        <Form.Control size='sm' value={lCari} onChange={e => { setLCari(e.target.value); setLacakId(''); }} placeholder='Cari ID...' />
                    </div>
                    <Form.Select value={lacakId} onChange={e => setLacakId(e.target.value)} className='mb-1'>
                        <option value=''>— Pilih ID Kirim —</option>
                        {kiriman
                            .filter(k => (lOutlet === 'Semua' || k.outlet === lOutlet) &&
                                (lStatus === 'Semua' || k.status === lStatus) &&
                                (!lCari.trim() || `${k.idKirim} ${k.outlet} ${k.ringkasan || ''}`.toLowerCase().includes(lCari.trim().toLowerCase())))
                            .map(k => <option key={k.idKirim} value={k.idKirim}>{k.idKirim} • {k.outlet} • {k.status}</option>)}
                    </Form.Select>
                    {lacak && (
                        <Card className='shadow-sm border-0'>
                            <Card.Body>
                                <div className='d-flex justify-content-between align-items-center mb-2'>
                                    <strong>{lacak.idKirim}</strong>
                                    <BadgeStatus status={lacak.status} />
                                </div>
                                <div className='small text-muted mb-2'>
                                    Outlet: {lacak.outlet}<br />
                                    Dibuat: {lacak.tglBuat || '-'}<br />
                                    Dikirim: {lacak.tglKirim || '-'}<br />
                                    Diterima: {lacak.tglTerima ? `${lacak.tglTerima} oleh ${lacak.namaPenerima}` : '-'}
                                </div>
                                <div className='small mb-1'>{lacak.ringkasan}</div>
                                {lacak.alasan && <div className='small text-muted mb-2'>Alasan: {lacak.alasan}</div>}
                                {lacak.items.map(it => (
                                    <div key={it.id} className='d-flex justify-content-between small border-top py-1'>
                                        <span>{it.nama} <span className='text-muted'>({it.jumlahKirim}{it.jumlahTerima != null && `→${it.jumlahTerima}`})</span>
                                            {it.keterangan && <em className='d-block text-muted'>{it.keterangan}</em>}
                                        </span>
                                        {it.jumlahTerima != null && <Badge bg={it.ceklis ? 'success' : 'warning'}>{it.ceklis ? 'Sesuai' : 'Sebagian'}</Badge>}
                                    </div>
                                ))}
                                {lacak.riwayat && <pre className='mt-2 p-2 bg-light small rounded' style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>{lacak.riwayat}</pre>}
                            </Card.Body>
                        </Card>
                    )}
                </Tab>
            </Tabs>

            {/* Modal konfirmasi batal */}
            <Modal show={!!aksi} onHide={() => setAksi(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className='fs-6'>Batalkan pengiriman?</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className='small mb-2'>ID: <strong>{aksi?.id}</strong></p>
                    <Form.Control
                        placeholder='Alasan wajib (cth: kurir batal, kirim ulang Kamis)'
                        value={alasan} onChange={e => setAlasan(e.target.value)}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button variant='secondary' onClick={() => setAksi(null)}>Batal</Button>
                    <Button variant='danger' disabled={busy} onClick={jalankanAksi}>
                        {busy ? '...' : 'Ya, Batalkan'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={() => setModal(m => ({ ...m, show: false }))} />
        </Container>
    );
}
