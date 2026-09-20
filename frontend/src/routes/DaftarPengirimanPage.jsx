import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Badge, Modal, Form, Tabs, Tab, InputGroup, Collapse } from 'react-bootstrap';
import { Eye, EyeOff } from 'lucide-react';
import {
    fetchPengiriman, batalkanPengiriman,
    fetchPesanan, putusPesanan, fetchOutlet, setUsernameOutlet, resetPasswordOutlet,
    setPasswordGudang, fetchNotifikasi,
} from '../api/client';
import LoncengGudang from '../components/layout/LoncengGudang';
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
// State keyd by POSISI (index), bukan id — ID bisa kembar ('-', duplikat migrasi).
function PutusForm({ pesanan, onSelesai }) {
    const [mode, setMode] = useState({}); // {index: 'PENUHI'|'TOLAK'}
    const [qty, setQty] = useState({}); // {index: qtyKirim} kosong = penuh
    const [ket, setKet] = useState({}); // {index: keterangan}
    const [busy, setBusy] = useState(false);

    async function submit() {
        const items = (pesanan.items || []).map((it, i) => ({
            id: it.id,
            keputusan: mode[i] || 'PENUHI',
            qtyKirim: (mode[i] || 'PENUHI') === 'PENUHI' && String(qty[i] ?? '') !== '' ? Number(qty[i]) : undefined,
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
            {(pesanan.items || []).map((it, i) => {
                const m = mode[i] || 'PENUHI';
                const parsial = m === 'PENUHI' && String(qty[i] ?? '') !== '' && Number(qty[i]) < Number(it.qtyPesan);
                return (
                <div key={`${it.id}#${i}`} className='mb-2'>
                    <div className='d-flex justify-content-between align-items-center'>
                        <span className='small'>{it.nama} <strong>x{it.qtyPesan}</strong></span>
                        <div className='d-flex gap-1'>
                            <Button size='sm' variant={m === 'PENUHI' ? 'success' : 'outline-success'}
                                onClick={() => setMode(md => ({ ...md, [i]: 'PENUHI' }))}>Penuhi</Button>
                            <Button size='sm' variant={m === 'TOLAK' ? 'danger' : 'outline-danger'}
                                onClick={() => setMode(md => ({ ...md, [i]: 'TOLAK' }))}>Tolak</Button>
                        </div>
                    </div>
                    {m === 'PENUHI' && (
                        <Form.Control size='sm' type='number' inputMode='numeric' min='0' className='mt-1'
                            placeholder={`Kirim (= ${it.qtyPesan}), kosongkan bila penuh`}
                            value={qty[i] ?? ''}
                            onChange={e => setQty(q => ({ ...q, [i]: e.target.value }))} />
                    )}
                    {(m === 'TOLAK' || parsial) && (
                        <Form.Control size='sm' className='mt-1'
                            placeholder={m === 'TOLAK' ? 'Keterangan wajib (cth: habis)' : 'Keterangan wajib: kenapa kurang (cth: stok tinggal 5)'}
                            value={ket[i] || ''} onChange={e => setKet(k => ({ ...k, [i]: e.target.value }))} />
                    )}
                </div>
                );
            })}
            <Button size='sm' variant='primary' className='w-100' disabled={busy} onClick={submit}>
                {busy ? '...' : 'Putuskan'}
            </Button>
        </div>
    );
}

// Hub pesanan gudang (Daftar + Lacak + Lainnya; Tab Buat manual dicabut 2026-09-14).

// Ringkasan putus terstruktur: chip hitung + grup 1 baris tampil langsung
// (tanpa toggle) + list penuhi dibatasi ambang + meta tanggal 2 baris.
const BATAS_TAMPIL = 4;
function RingkasanPutus({ pesanan }) {
    const [bukaPenuhi, setBukaPenuhi] = useState(false);
    const [bukaTolak, setBukaTolak] = useState(false);
    const items = pesanan.items || [];
    const diputus = items.some(it => it.keputusan);
    if (!diputus) {
        const pcs = items.reduce((a, it) => a + (Number(it.qtyPesan) || 0), 0);
        return <div className='text-muted my-1' style={{ fontSize: '11px' }}>{items.length} macam • {pcs} pcs</div>;
    }
    const penuhi = items.filter(it => String(it.keputusan || '').toUpperCase() === 'PENUHI');
    const tolak = items.filter(it => String(it.keputusan || '').toUpperCase() === 'TOLAK');
    const garis = { borderBottom: '1px solid #f1f3f5' };
    const barisPenuhi = (it, i) => (
        <div key={`p-${i}`} className='small py-1 d-flex gap-1' style={garis}>
            <span className='text-success fw-bold'>✓</span>
            <span>{it.nama} <strong>x{it.qtyKirim ?? it.qtyPesan}</strong></span>
        </div>
    );
    const barisTolak = (it, i) => (
        <div key={`t-${i}`} className='small py-1 d-flex gap-1 text-muted' style={garis}>
            <span className='text-danger fw-bold'>✕</span>
            <span>{it.nama} <strong>x{it.qtyPesan}</strong>{it.keterangan && <> — {it.keterangan}</>}</span>
        </div>
    );
    return (
        <div className='my-1'>
            <div className='d-flex gap-1 flex-wrap mb-1'>
                {penuhi.length > 0 && <Badge bg='success'>✓ {penuhi.length} dipenuhi</Badge>}
                {tolak.length > 0 && <Badge bg='danger'>✕ {tolak.length} ditolak</Badge>}
            </div>
            {(bukaPenuhi ? penuhi : penuhi.slice(0, BATAS_TAMPIL)).map(barisPenuhi)}
            {penuhi.length > BATAS_TAMPIL && !bukaPenuhi && (
                <Button size='sm' variant='link' className='p-0 text-decoration-none fw-semibold text-primary'
                    onClick={() => setBukaPenuhi(true)}>
                    {`▾ Lihat semua ${penuhi.length} dipenuhi`}
                </Button>
            )}
            {tolak.length === 1 && barisTolak(tolak[0], 0)}
            {tolak.length > 1 && !bukaTolak && (
                <Button size='sm' variant='link' className='p-0 text-decoration-none fw-semibold text-primary'
                    onClick={() => setBukaTolak(true)}>
                    {`▾ Lihat ${tolak.length} ditolak`}
                </Button>
            )}
            <Collapse in={bukaTolak && tolak.length > 1}>
                <div>{tolak.length > 1 && tolak.map(barisTolak)}</div>
            </Collapse>
            {(bukaPenuhi && penuhi.length > BATAS_TAMPIL) || (bukaTolak && tolak.length > 1) ? (
                <div>
                    {bukaPenuhi && penuhi.length > BATAS_TAMPIL && (
                        <Button size='sm' variant='link' className='p-0 text-decoration-none fw-semibold text-primary'
                            onClick={() => setBukaPenuhi(false)}>
                            ▴ Ciutkan dipenuhi
                        </Button>
                    )}
                    {bukaTolak && tolak.length > 1 && (
                        <Button size='sm' variant='link' className='p-0 text-decoration-none fw-semibold text-primary ms-3'
                            onClick={() => setBukaTolak(false)}>
                            ▴ Sembunyikan ditolak
                        </Button>
                    )}
                </div>
            ) : null}
        </div>
    );
}
export default function DaftarPengirimanPage() {
    const navigate = useNavigate();
    const [pesanan, setPesanan] = useState([]);
    const [kiriman, setKiriman] = useState([]);
    const [outlets, setOutlets] = useState([]);
    const [notifikasi, setNotifikasi] = useState(null);
    const [error, setError] = useState(null);
    const [modal, setModal] = useState({ show: false, sukses: false, pesan: '' });
    const [aksi, setAksi] = useState(null); // {mode: 'kirim'|'batal', id}
    const [alasan, setAlasan] = useState('');
    const [lacakId, setLacakId] = useState('');
    const [busy, setBusy] = useState(false);
    const [tab, setTab] = useState('daftar');
    const [fCari, setFCari] = useState('');
    // Tab alur ganti dropdown status: antrean FIFO tertua-di-atas, arsip terbaru-di-atas.
    const TAB_ALUR = [
        { id: 'baru', label: 'Baru', status: ['BARU'], fifo: true },
        { id: 'siap', label: 'Siap Kirim', status: ['DISETUJUI', 'DISETUJUI SEBAGIAN', 'SIAP KIRIM'], fifo: true },
        { id: 'dikirim', label: 'Dikirim', status: ['DIKIRIM'], fifo: true },
        { id: 'diterima', label: 'Diterima', status: ['DITERIMA', 'DITERIMA SEBAGIAN'], fifo: false },
        { id: 'ditolak', label: 'Ditolak', status: ['DITOLAK'], fifo: false },
        { id: 'semua', label: 'Semua', status: null, fifo: false },
    ];
    const [fTab, setFTab] = useState('baru');
    const tabAlur = TAB_ALUR.find(t => t.id === fTab) || TAB_ALUR.find(t => t.id === 'semua');
    const hitungTab = (t) => pesanan.filter(p => !t.status || t.status.includes(p.status)).length;
    const [lStatus, setLStatus] = useState('Semua');
    const [lOutlet, setLOutlet] = useState('Semua');
    const [lCari, setLCari] = useState('');
    const [batas, setBatas] = useState(20);

    // load pesanan baru; sesi gudang mati (401) -> lempar ke halaman masuk.
    // Guard anti-tumpuk: tick baru dilewati bila siklus sebelumnya belum selesai.
    // Hemat render: state hanya diganti bila signature (id+status) berubah —
    // poll 20 dtk tanpa perubahan data = tanpa render ulang = tanpa kedip.
    const sedangMuat = useRef(false);
    const sigBear = useRef({ p: '', k: '', o: '', n: -1 });
    const sig = (arr, kunci) => (arr || []).map(x => kunci(x)).join('|');
    async function muat(senyap=false) {
        if (sedangMuat.current) return;
        sedangMuat.current = true;
        try {
            const [p, k, o, n] = await Promise.all([fetchPesanan(), fetchPengiriman(), fetchOutlet(), fetchNotifikasi()]);
            const s = {
                p: sig(p, x => `${x.idPesan}:${x.status}`),
                k: sig(k, x => `${x.idKirim}:${x.status}:${x.token ? 1 : ''}`),
                o: sig(o, x => `${x.slug}:${x.username || ''}:${x.punyaPassword ? 1 : ''}`),
                n: n ? n.belumBaca : -1,
            };
            const lama = sigBear.current;
            if (s.p !== lama.p) setPesanan(p);
            if (s.k !== lama.k) setKiriman(k);
            if (s.o !== lama.o) setOutlets(o);
            if (s.n !== lama.n) setNotifikasi(n);
            sigBear.current = s;
            setError(null);
        } catch (e) {
            if (/login gudang/i.test(e.message || '')) {
                sessionStorage.removeItem('gudang-masuk');
                navigate('/gudang-masuk', { replace: true });
                return;
            }
            if (!senyap) setError(e.message);
        } finally {
            sedangMuat.current = false;
        }
    }

    function pindahTab(t) {
        setTab(t);
        muat(true);
    }

    // Ganti password gudang (ketik 2x, wajib sesi)
    const [tampilPw, setTampilPw] = useState(false);
    const [pw1, setPw1] = useState('');
    const [pw2, setPw2] = useState('');
    const [lihatPw, setLihatPw] = useState(false); // 1 toggle untuk kedua kolom ketik 2x
    async function simpanPw() {
        try {
            const res = await setPasswordGudang(pw1, pw2);
            setPw1(''); setPw2(''); setTampilPw(false);
            setModal({ show: true, sukses: true, pesan: res.pesan });
        } catch (e) {
            if (/login gudang/i.test(e.message || '')) {
                sessionStorage.removeItem('gudang-masuk');
                navigate('/gudang-masuk', { replace: true });
                return;
            }
            setModal({ show: true, sukses: false, pesan: e.message });
        }
    }

    useEffect(() => { muat(); }, []);

    // Poll 20 dtk di SEMUA tab hub (Daftar + Lacak) + fetch saat tab browser kembali
    // dibuka. Lewati saat hidden/sibuk/aksi; anti-tumpuk via sedangMuat.
    useEffect(() => {
        const t = setInterval(() => {
            if (document.hidden || busy || aksi) return;
            muat(true);
        }, 20000);
        const saatTerlihat = () => { if (!document.hidden) muat(true); };
        document.addEventListener('visibilitychange', saatTerlihat);
        return () => { clearInterval(t); document.removeEventListener('visibilitychange', saatTerlihat); };
        // eslint-disable-next-line
    }, [busy, aksi]);

    const kirimByPesan = useMemo(() => {
        const m = {};
        for (const k of kiriman) if (k.idPesan && k.idPesan !== '-') m[k.idPesan] = k;
        return m;
    }, [kiriman]);

    const daftar = pesanan
        .filter(p => (!tabAlur.status || tabAlur.status.includes(p.status)) &&
            (!fCari.trim() || `${p.idPesan} ${p.outlet}`.toLowerCase().includes(fCari.trim().toLowerCase())))
        .sort((a, b) => {
            const da = a.dibuatPada || '', db = b.dibuatPada || '';
            return tabAlur.fifo ? da.localeCompare(db) : db.localeCompare(da);
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

    // Kelola akun outlet: username set SEKALI (terkunci permanen) + reset password kapan saja.
    const [kelolaSlug, setKelolaSlug] = useState(null);
    const [uBaru, setUBaru] = useState('');
    const [pBaru1, setPBaru1] = useState('');
    const [pBaru2, setPBaru2] = useState('');
    const [lihatKO, setLihatKO] = useState(false); // 1 toggle untuk kedua kolom password outlet
    function resetKelola() { setKelolaSlug(null); setUBaru(''); setPBaru1(''); setPBaru2(''); }
    async function simpanUsername(slug) {
        try {
            const res = await setUsernameOutlet(slug, uBaru.trim());
            resetKelola();
            muat();
            setModal({ show: true, sukses: true, pesan: res.pesan });
        } catch (e) {
            setModal({ show: true, sukses: false, pesan: e.message });
        }
    }
    async function resetPassword(slug, nama) {
        if (!pBaru1 && !pBaru2) {
            setModal({ show: true, sukses: false, pesan: 'Isi password baru 2x dulu.' });
            return;
        }
        if (!window.confirm(`Reset password ${nama}? Sampaikan password baru ke outlet.`)) return;
        try {
            const res = await resetPasswordOutlet(slug, pBaru1, pBaru2);
            resetKelola();
            muat();
            setModal({ show: true, sukses: true, pesan: res.pesan });
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
                <LoncengGudang data={notifikasi} onMuat={() => muat(true)} />
            </div>

            <Tabs activeKey={tab} onSelect={pindahTab} className='mb-3'>
                <Tab eventKey='daftar' title='Daftar'>
                    <div className='d-flex gap-1 mb-2 py-1' role='tablist' aria-label='Tahap pesanan'
                        style={{ overflowX: 'auto' }}>
                        {TAB_ALUR.map(t => {
                            const n = hitungTab(t);
                            const aktif = t.id === fTab;
                            return (
                                <Button key={t.id} size='sm' role='tab' aria-selected={aktif}
                                    variant={aktif ? 'dark' : 'outline-secondary'} className='flex-shrink-0'
                                    onClick={() => setFTab(t.id)}>
                                    {t.label}{n > 0 ? ` (${n})` : ''}
                                </Button>
                            );
                        })}
                    </div>
                    <div className='d-flex gap-2 mb-2 flex-wrap'>
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
                                        <div>Dipesan {p.tanggalPesan}</div>
                                        <div>Kirim {p.rencanaKirim}</div>
                                    </div>
                                    <RingkasanPutus pesanan={p} />
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
                                            <Button size='sm' variant='outline-secondary' onClick={() => { setLacakId(k.idKirim); setTab('lacak'); }}>
                                                Lacak
                                            </Button>
                                            {k.status !== 'SIAP KIRIM' && (
                                                <Button size='sm' variant='outline-secondary' onClick={() => window.open(`/surat-jalan/${k.idKirim}`, '_blank')}>
                                                    Print
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        );
                    })}
                    </div>
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
                                            {k.status !== 'SIAP KIRIM' && (
                                                <Button size='sm' variant='outline-secondary' className='mb-2' onClick={() => window.open(`/surat-jalan/${k.idKirim}`, '_blank')}>
                                                    Print / PDF
                                                </Button>
                                            )}
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
                <Tab eventKey='lainnya' title='Lainnya'>
                    <Card className='shadow-sm border-0 mb-3'>
                        <Card.Body className='py-2'>
                            <div className='fw-bold small mb-2'>Kelola Akun Outlet</div>
                            {(outlets || []).map(o => {
                                const buka = kelolaSlug === o.slug;
                                return (
                                    <div key={o.slug} className='small border-top py-1'>
                                        <div className='d-flex justify-content-between align-items-center gap-2'>
                                            <span className='text-truncate'>{o.outlet} <span className='text-muted'>• {o.username ? `@${o.username}` : '(tanpa username)'}</span></span>
                                            <span className='d-flex gap-1 flex-shrink-0'>
                                                <Button size='sm' variant='outline-primary'
                                                    onClick={() => salinTeks(`${window.location.origin}${o.link}`, 'Link pesan disalin.')}>Salin</Button>
                                                <Button size='sm' variant={buka ? 'secondary' : 'outline-secondary'}
                                                    onClick={() => { buka ? resetKelola() : (resetKelola(), setKelolaSlug(o.slug)); }}>
                                                    {buka ? 'Tutup' : 'Akun'}
                                                </Button>
                                            </span>
                                        </div>
                                        <Collapse in={buka}>
                                            <div className='pt-2'>
                                                {!o.username ? (
                                                    <InputGroup size='sm' className='mb-1'>
                                                        <Form.Control value={uBaru} onChange={e => setUBaru(e.target.value)}
                                                            placeholder='Username baru (min 3, sekali saja)' />
                                                        <Button variant='outline-success' onClick={() => simpanUsername(o.slug)}>Set</Button>
                                                    </InputGroup>
                                                ) : (
                                                    <div className='text-muted mb-1'>Username <strong>@{o.username}</strong> terkunci{!o.punyaPassword && ' • outlet belum buat password'}.</div>
                                                )}
                                                <InputGroup size='sm' className='mb-1'>
                                                    <Form.Control type={lihatKO ? 'text' : 'password'} value={pBaru1} onChange={e => setPBaru1(e.target.value)}
                                                        placeholder='Password baru (min 4)' />
                                                    <Button variant='outline-secondary' onClick={() => setLihatKO(v => !v)}
                                                        aria-label={lihatKO ? 'Sembunyikan password' : 'Tampilkan password'}>
                                                        {lihatKO ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </Button>
                                                </InputGroup>
                                                <Form.Control size='sm' type={lihatKO ? 'text' : 'password'} value={pBaru2} onChange={e => setPBaru2(e.target.value)}
                                                    placeholder='Ketik ulang password baru' className='mb-1' />
                                                <Button size='sm' variant='outline-danger' onClick={() => resetPassword(o.slug, o.outlet)}>
                                                    Reset password
                                                </Button>
                                            </div>
                                        </Collapse>
                                    </div>
                                );
                            })}
                        </Card.Body>
                    </Card>

                    <Card className='shadow-sm border-0 mb-3'>
                        <Card.Body className='py-2'>
                            <div className='fw-bold small mb-2'>Password Gudang</div>
                            {!tampilPw ? (
                                <Button size='sm' variant='outline-secondary' onClick={() => setTampilPw(true)}>Ganti</Button>
                            ) : (
                                <>
                                    <InputGroup size='sm' className='mb-1'>
                                        <Form.Control type={lihatPw ? 'text' : 'password'} value={pw1}
                                            onChange={e => setPw1(e.target.value)}
                                            placeholder='Password baru (min 4)' />
                                        <Button variant='outline-secondary' onClick={() => setLihatPw(v => !v)}
                                            aria-label={lihatPw ? 'Sembunyikan password' : 'Tampilkan password'}>
                                            {lihatPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </Button>
                                    </InputGroup>
                                    <Form.Control size='sm' type={lihatPw ? 'text' : 'password'} value={pw2}
                                        onChange={e => setPw2(e.target.value)}
                                        placeholder='Ketik ulang password baru' className='mb-1' />
                                    <span className='d-flex gap-1'>
                                        <Button size='sm' variant='success' onClick={simpanPw}>Simpan</Button>
                                        <Button size='sm' variant='secondary' onClick={() => { setTampilPw(false); setPw1(''); setPw2(''); }}>Batal</Button>
                                    </span>
                                </>
                            )}
                        </Card.Body>
                    </Card>
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
