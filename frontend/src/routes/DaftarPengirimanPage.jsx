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

// Form putus per item untuk 1 kartu BARU.
// State keyed by POSISI (index), bukan id — ID bisa kembar ('-', duplikat migrasi).
function PutusForm({ pesanan, onSelesai }) {
    const [mode, setMode] = useState({}); // {index: 'PENUHI'|'TOLAK'}
    const [ket, setKet] = useState({}); // {index: keterangan}
    const [busy, setBusy] = useState(false);

    async function submit() {
        const items = (pesanan.items || []).map((it, i) => ({
            id: it.id,
            keputusan: mode[i] || 'PENUHI',
            keterangan: ket[i] || '',
        }));
        setBusy(true);
        try {
            const res = await putusPesanan(pesanan.idPesan, { items });
            onSelesai(true, res.idKirim ? `${res.pesan} Kirim: ${res.idKirim}` : res.pesan);
        } catch (e) {
            onSelesai(false, e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className='mt-2 border-top pt-2'>
            {(pesanan.items || []).map((it, i) => (
                <div key={`${it.id}#${i}`} className='mb-2'>
                    <div className='d-flex justify-content-between align-items-center'>
                        <span className='small'>{it.nama} <strong>x{it.qtyPesan}</strong></span>
                        <div className='d-flex gap-1'>
                            <Button size='sm' variant={(mode[i] || 'PENUHI') === 'PENUHI' ? 'success' : 'outline-success'}
                                onClick={() => setMode(m => ({ ...m, [i]: 'PENUHI' }))}>Penuhi</Button>
                            <Button size='sm' variant={mode[i] === 'TOLAK' ? 'danger' : 'outline-danger'}
                                onClick={() => setMode(m => ({ ...m, [i]: 'TOLAK' }))}>Tolak</Button>
                        </div>
                    </div>
                    {mode[i] === 'TOLAK' && (
                        <Form.Control size='sm' className='mt-1' placeholder='Keterangan wajib (cth: habis)'
                            value={ket[i] || ''} onChange={e => setKet(k => ({ ...k, [i]: e.target.value }))} />
                    )}
                </div>
            ))}
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
    const [keranjang, setKeranjang] = useState({}); // {gi: qty}, gi = index di barang (ID bisa kembar '-')
    const [nama, setNama] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => { fetchBarang().then(setBarang).catch(() => {}); }, []);
    const hasil = useMemo(() => {
        const q = search.toLowerCase();
        return barang.map((b, gi) => ({ b, gi }))
            .filter(({ b }) => !q || b.nama.toLowerCase().includes(q) || String(b.id).includes(search)).slice(0, 30);
    }, [barang, search]);
    const isi = Object.entries(keranjang).filter(([, q]) => Number(q) > 0)
        .map(([gi, qty]) => ({ gi: Number(gi), id: barang[Number(gi)]?.id, qty: Number(qty) }));

    async function submit() {
        if (!token) return onSelesai(false, 'Pilih outlet dulu.');
        if (!nama.trim()) return onSelesai(false, 'Nama pemesan wajib diisi.');
        if (isi.length === 0) return onSelesai(false, 'Keranjang masih kosong.');
        setBusy(true);
        try {
            const res = await buatPesananOutlet(token, { namaPemesan: nama.trim(), items: isi.map(({ id, qty }) => ({ id, qty })) });
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
            {hasil.map(({ b, gi }) => (
                <div key={`${b.id}#${gi}`} className='d-flex justify-content-between align-items-center small border-bottom py-1'>
                    <span>{b.nama} <span className='text-muted'>{b.varian} • {b.satuanEceran}</span></span>
                    <Form.Control type='number' inputMode='numeric' min='0' size='sm' style={{ width: '100px' }}
                        value={keranjang[gi] || ''} placeholder='0'
                        onChange={e => setKeranjang(k => ({ ...k, [gi]: e.target.value }))} />
                </div>
            ))}
            {isi.length > 0 && (
                <div className='small my-2 p-2 bg-light rounded'>
                    {isi.map(it => {
                        const b = barang[it.gi];
                        return <div key={`${it.id}#${it.gi}`} className='d-flex justify-content-between'><span>{b?.nama || it.id}</span><strong>x{it.qty}</strong></div>;
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
    const [tab, setTab] = useState('daftar');
    const [fStatus, setFStatus] = useState('Semua');
    const [fCari, setFCari] = useState('');
    const [lStatus, setLStatus] = useState('Semua');
    const [lOutlet, setLOutlet] = useState('Semua');
    const [lCari, setLCari] = useState('');
    const [batas, setBatas] = useState(20);

    // load pesanan baru
    async function muat(senyap=false) {
        try {
            const [p, k, o] = await Promise.all([fetchPesanan(), fetchPengiriman(), fetchOutlet()]);
            setPesanan(p); setKiriman(k); setOutlets(o); setError(null);
        } catch (e) { if (!senyap) setError(e.message); }
    }
    useEffect(() => { muat(); }, []);

    useEffect(() => {
        if (tab !== 'daftar') return;
        const t = setInterval(() => {
            if (document.hidden || busy || aksi) return;
            muat(true);
        }, 30000);
        return () => clearInterval(t);
    }, [tab, busy, aksi]);

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
        if (!window.confirm(`Reset link ${nama}? Link lama akan mati.`)) return;
        try {
            const res = await resetLinkOutlet(slug);
            muat();
            setModal({ show: true, sukses: true, pesan: `${res.pesan} Link: ${window.location.origin}${res.link}` });
        } catch (e) {
            setModal({ show: true, sukses: false, pesan: e.message });
        }
    }

    // ponytail: slice di frontend, pindah ke limit query bila kiriman > ratusan
    const lacakList = useMemo(() => kiriman.filter(k =>
        (lOutlet === 'Semua' || k.outlet === lOutlet) &&
        (lStatus === 'Semua' || k.status === lStatus) &&
        (!lCari.trim() || `${k.idKirim} ${k.outlet} ${k.ringkasan || ''}`.toLowerCase().includes(lCari.trim().toLowerCase()))
    ), [kiriman, lOutlet, lStatus, lCari]);
    const tampil = lacakList.slice(0, batas);

    if (error) return <p className='text-center py-5 text-danger'>{error}</p>;

    return (
        <Container className='py-4 hub-lebar'>
            <div className='d-flex justify-content-between align-items-center mb-3'>
                <h2 className='fw-bold mb-0'>Pesanan & Kirim</h2>
                <Button size='sm' variant='success' onClick={() => navigate('/kirim')}>+ Kirim</Button>
            </div>

            <Tabs activeKey={tab} onSelect={setTab} className='mb-3'>
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

                    <div className='d-flex gap-2 mb-2 flex-wrap'>
                        <Form.Select size='sm' value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ maxWidth: '180px' }}>
                            {['Semua', 'BARU', 'DISETUJUI', 'DISETUJUI SEBAGIAN', 'DITOLAK', 'SIAP KIRIM', 'DIKIRIM', 'DITERIMA', 'DITERIMA SEBAGIAN'].map(s =>
                                <option key={s} value={s}>{s}</option>)}
                        </Form.Select>
                        <Form.Control size='sm' value={fCari} onChange={e => setFCari(e.target.value)} placeholder='Cari ID / outlet...' />
                    </div>

                    {daftar.length === 0 && <p className='text-center text-muted py-4'>Belum ada pesanan.</p>}
                    <div className='hub-grid'>
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
                                    {p.status === 'BARU' && <PutusForm pesanan={p} onSelesai={selesaiPutus} />}
                                    {k && (k.status === 'SIAP KIRIM' || k.status === 'DIKIRIM') && (
                                        <div className='d-flex gap-2 mt-2 align-items-center flex-wrap'>
                                            <BadgeStatus status={k.status} />
                                            {k.status === 'SIAP KIRIM' && (
                                                <Button size='sm' variant='primary' onClick={() => navigate('/input', { state: { mode: 'verifikasi', idKirim: k.idKirim } })}>
                                                    Verifikasi & Tandai
                                                </Button>
                                            )}
                                            {k.status === 'DIKIRIM' && (
                                                <Button size='sm' variant='outline-danger' onClick={() => setAksi({ mode: 'batal', id: k.idKirim })}>
                                                    Batalkan
                                                </Button>
                                            )}
                                            {k.status === 'DIKIRIM' && k.token && (
                                                <Button size='sm' variant='outline-primary'
                                                    onClick={() => salinTeks(`${window.location.origin}/terima/${k.token}`, 'Link surat jalan disalin.')}>
                                                    Salin Link
                                                </Button>
                                            )}
                                            <Button size='sm' variant='outline-secondary' onClick={() => { setLacakId(k.idKirim); setTab('lacak'); }}>
                                                Lacak
                                            </Button>
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        );
                    })}
                    </div>
                </Tab>
                <Tab eventKey='buat' title='Buat'>
                    <BuatForm outlets={outlets} onSelesai={(s, pesan) => { setModal({ show: true, sukses: s, pesan }); if (s) muat(); }} />
                </Tab>
                <Tab eventKey='lacak' title='Lacak'>
                    <div className='d-flex gap-2 mb-2 flex-wrap'>
                        <Form.Select size='sm' value={lOutlet} onChange={e => { setLOutlet(e.target.value); setBatas(20); }} style={{ maxWidth: '150px' }}>
                            <option value='Semua'>Semua outlet</option>
                            {(outlets || []).map(o => <option key={o.slug} value={o.outlet}>{o.outlet}</option>)}
                        </Form.Select>
                        <Form.Select size='sm' value={lStatus} onChange={e => { setLStatus(e.target.value); setBatas(20); }} style={{ maxWidth: '170px' }}>
                            {['Semua', 'SIAP KIRIM', 'DIKIRIM', 'DITERIMA', 'DITERIMA SEBAGIAN'].map(s =>
                                <option key={s} value={s}>{s === 'Semua' ? 'Semua status' : s}</option>)}
                        </Form.Select>
                        <Form.Control size='sm' value={lCari} onChange={e => { setLCari(e.target.value); setBatas(20); }} placeholder='Cari ID...' />
                    </div>
                    {lacakList.length === 0 && <p className='text-center text-muted py-4'>Belum ada pengiriman.</p>}
                    <div className='hub-grid'>
                    {tampil.map(k => {
                        const buka = k.idKirim === lacakId;
                        return (
                            <Card key={k.idKirim} className='shadow-sm border-0 mb-2'>
                                <Card.Body className='py-2' onClick={() => setLacakId(buka ? '' : k.idKirim)} style={{ cursor: 'pointer' }}>
                                    <div className='d-flex justify-content-between align-items-center'>
                                        <strong className='small'>{k.idKirim} • {k.outlet}</strong>
                                        <BadgeStatus status={k.status} />
                                    </div>
                                    <div className='text-muted' style={{ fontSize: '11px' }}>{k.tglKirim || k.tglBuat || ''} • {k.ringkasan}</div>
                                    {buka && (
                                        <div onClick={e => e.stopPropagation()}>
                                            <div className='small text-muted mt-2'>
                                                Dibuat: {k.tglBuat || '-'}<br />
                                                Dikirim: {k.tglKirim || '-'}<br />
                                                Diterima: {k.tglTerima ? `${k.tglTerima} oleh ${k.namaPenerima}` : '-'}
                                            </div>
                                            {k.alasan && <div className='small text-muted mb-2'>Alasan: {k.alasan}</div>}
                                            {(k.fotoKirim || k.fotoTerima) && (
                                                <div className='d-flex gap-2 my-2'>
                                                    {k.fotoKirim && <a href={k.fotoKirim} target='_blank' rel='noreferrer' className='flex-fill'>
                                                        <img src={k.fotoKirim} alt='Paket dari gudang' className='w-100 rounded' />
                                                        <div className='text-muted text-center' style={{ fontSize: '11px' }}>Kirim</div></a>}
                                                    {k.fotoTerima && <a href={k.fotoTerima} target='_blank' rel='noreferrer' className='flex-fill'>
                                                        <img src={k.fotoTerima} alt='Diterima outlet' className='w-100 rounded' />
                                                        <div className='text-muted text-center' style={{ fontSize: '11px' }}>Terima</div></a>}
                                                </div>
                                            )}
                                            {(k.items || []).map((it, idx) => {
                                                const sudahTerima = it.jumlahTerima != null;
                                                const selisih = sudahTerima ? Number(it.jumlahKirim) - Number(it.jumlahTerima) : 0;
                                                return (
                                                    <div key={`${it.id}#${idx}`} className='small border-top py-1'>
                                                        <div className='d-flex justify-content-between align-items-center flex-wrap gap-1'>
                                                            <strong>{it.nama}</strong>
                                                            <span className='d-flex align-items-center gap-2'>
                                                                <span className='text-muted'>Terkirim: {it.jumlahKirim}</span>
                                                                <span className='text-muted'>|</span>
                                                                <span className='text-muted'>Diterima: {sudahTerima ? it.jumlahTerima : '-'}</span>
                                                                {sudahTerima && <Badge bg={it.ceklis ? 'success' : 'warning'}>{it.ceklis ? 'Sesuai' : 'Sebagian'}</Badge>}
                                                            </span>
                                                        </div>
                                                        {sudahTerima && selisih > 0 && (
                                                            <div className='text-danger' style={{ fontSize: '12px' }}>
                                                                {selisih} barang hilang/kurang — {it.keterangan || '-'}
                                                            </div>
                                                        )}
                                                        {sudahTerima && selisih < 0 && (
                                                            <div className='text-warning' style={{ fontSize: '12px' }}>
                                                                {Math.abs(selisih)} barang berlebih — {it.keterangan || '-'}
                                                            </div>
                                                        )}
                                                        {sudahTerima && selisih === 0 && it.keterangan && (
                                                            <div className='text-muted' style={{ fontSize: '12px' }}>
                                                                Keterangan: {it.keterangan}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {k.riwayat && <pre className='mt-2 p-2 bg-light small rounded' style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>{k.riwayat}</pre>}
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        );
                    })}
                    </div>
                    {lacakList.length > tampil.length && (
                        <Button size='sm' variant='outline-secondary' className='w-100' onClick={() => setBatas(b => b + 20)}>
                            Muat lagi ({lacakList.length - tampil.length} tersisa)
                        </Button>
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
