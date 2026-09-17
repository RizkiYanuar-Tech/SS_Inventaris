import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Card, Form, Button, Alert, Collapse, InputGroup, Modal } from 'react-bootstrap';
import { Eye, EyeOff, LogOut, ShoppingCart, KeyRound } from 'lucide-react';
import '../outlet.css';
import { lihatPesananOutlet, buatPesananOutlet, masukOutlet, buatPasswordAwalOutlet, gantiPasswordOutlet } from '../api/client';
import TerimaForm from '../components/outlet/TerimaForm';
import TiketPesanan, { Pager } from '../components/outlet/TiketPesanan';
import ResultModal from '../components/common/ResultModal';
import RefreshButton from '../components/layout/RefreshButton';

// Halaman publik outlet (tanpa nav, Incognito-friendly): Tab Pesan Baru + Riwayat + Surat Jalan.
// Link: /pesan/<slug>-<token8>; auth via token saja (slug diabaikan, ikut backend).
const STATUS_AKTIF = ['BARU', 'DISETUJUI', 'DISETUJUI SEBAGIAN', 'SIAP KIRIM', 'DIKIRIM'];

export default function PesanOutletPage() {
    const { slugToken } = useParams();
    const token = (slugToken || '').slice((slugToken || '').lastIndexOf('-') + 1);
    const slug = (slugToken || '').slice(0, Math.max(0, (slugToken || '').lastIndexOf('-')));
    const kunciSesi = `outlet-masuk:${token}`;
    const [masuk, setMasuk] = useState(() => sessionStorage.getItem(`outlet-masuk:${(slugToken || '').slice((slugToken || '').lastIndexOf('-') + 1)}`) === '1');
    const [uNama, setUNama] = useState('');
    const [uSandi, setUSandi] = useState('');
    const [modeAwal, setModeAwal] = useState(false); // true = form buat password pertama
    const [bPw1, setBPw1] = useState('');
    const [bPw2, setBPw2] = useState('');
    const [busyMasuk, setBusyMasuk] = useState(false);
    const [errMasuk, setErrMasuk] = useState(null);
    const [lihatMasuk, setLihatMasuk] = useState(false); // toggle intip: form masuk + buat-pertama + ganti
    const [tampilGanti, setTampilGanti] = useState(false);
    const [gPw1, setGPw1] = useState('');
    const [gPw2, setGPw2] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('pesan');
    const [filter, setFilter] = useState('Aktif');
    const [search, setSearch] = useState('');
    const [keranjang, setKeranjang] = useState({}); // {gi: qty}, gi = index di data.katalog (ID bisa kembar '-')
    const [nama, setNama] = useState('');
    const [saving, setSaving] = useState(false);
    const [modal, setModal] = useState({ show: false, sukses: false, pesan: '' });
    const [katAktif, setKatAktif] = useState(null); // kategori yang tampil (1 layar = 1 kategori)
    const katAktifRef = useRef(null);
    // Strip tak tahu state React — geser manual ke tombol aktif tiap ganti.
    useEffect(() => {
        const halus = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        katAktifRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: halus ? 'smooth' : 'auto' });
    }, [katAktif]);
    const [suratExpand, setSuratExpand] = useState(null); // idPesan yang surat jalannya dibuka
    const [halSurat, setHalSurat] = useState(1); // pagination Tab Surat Jalan (5/halaman)
    const [halRiwayat, setHalRiwayat] = useState(1); // pagination Tab Riwayat (5/halaman)
    const [refreshing, setRefreshing] = useState(false); // spinner tombol refresh manual

    // Refresh manual: fetch penuh (termasuk katalog), data lama tetap tampil selama loading.
    async function refreshManual() {
        if (refreshing) return;
        setRefreshing(true);
        try { await muat(); } finally { setRefreshing(false); }
    }

    // ringan=true untuk poll: respons tanpa katalog, pakai katalog fetch penuh pertama.
    async function muat(ringan = false) {
        try {
            const segar = await lihatPesananOutlet(token, ringan);
            if (ringan && (!segar.katalog || segar.katalog.length === 0)) {
                setData(prev => (prev ? { ...segar, katalog: prev.katalog } : segar));
            } else {
                setData(segar);
            }
            setError(null);
        } catch (e) {
            // Sesi mati (restart server / cookie habis) -> kembali ke form login, bukan error merah.
            if (/login outlet/i.test(e.message || '')) {
                sessionStorage.removeItem(kunciSesi);
                setMasuk(false);
                setData(null);
                return;
            }
            setError(e.message);
        }
    }
    useEffect(() => { if (masuk) muat();}, [token, masuk]);

    async function submitMasuk(e) {
        e?.preventDefault();
        if (!uNama.trim() || !uSandi) {
            setErrMasuk('Isi username dan password dulu.');
            return;
        }
        setBusyMasuk(true);
        setErrMasuk(null);
        try {
            await masukOutlet(token, uNama.trim(), uSandi);
            sessionStorage.setItem(kunciSesi, '1');
            setUSandi('');
            setMasuk(true);
        } catch (err) {
            if (err.buatPertama) {
                setModeAwal(true);
                setErrMasuk(null);
            } else {
                setErrMasuk(err.message);
            }
        } finally {
            setBusyMasuk(false);
        }
    }

    async function submitAwal(e) {
        e?.preventDefault();
        setBusyMasuk(true);
        setErrMasuk(null);
        try {
            await buatPasswordAwalOutlet(token, uNama.trim(), bPw1, bPw2);
            sessionStorage.setItem(kunciSesi, '1');
            setBPw1(''); setBPw2(''); setUSandi('');
            setModeAwal(false);
            setMasuk(true);
        } catch (err) {
            setErrMasuk(err.message);
        } finally {
            setBusyMasuk(false);
        }
    }

    async function submitGanti() {
        try {
            const res = await gantiPasswordOutlet(token, gPw1, gPw2);
            setGPw1(''); setGPw2(''); setTampilGanti(false);
            setModal({ show: true, sukses: true, pesan: res.pesan });
        } catch (err) {
            setModal({ show: true, sukses: false, pesan: err.message });
        }
    }

    // Poll hemat: segarkan riwayat/surat tiap 30 dtk hanya saat tab itu aktif;
    // diam saat tab disembunyikan / sedang submit; fetch sekali saat kembali terlihat.
    useEffect(() => {
        if (tab !== 'riwayat' && tab !== 'surat') return;
        const t = setInterval(() => {
            if (document.hidden || saving) return;
            muat(true);
        }, 30000);
        const saatTerlihat = () => { if (!document.hidden) muat(true); };
        document.addEventListener('visibilitychange', saatTerlihat);
        return () => { clearInterval(t); document.removeEventListener('visibilitychange', saatTerlihat); };
        // eslint-disable-next-line
    }, [tab, token, saving]);

    // Kelompok kategori: 1 layar = 1 kategori, pindah via tab menyamping (ala hub gudang).
    const kelompok = useMemo(() => {
        const map = new Map();
        ((data?.katalog) || []).forEach((b, gi) => {
            const kat = String(b.kategori || '').trim() || 'Lainnya';
            if (!map.has(kat)) map.set(kat, []);
            map.get(kat).push({ b, gi });
        });
        return [...map.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], 'id'))
            .map(([namaKat, items]) => ({ nama: namaKat, items }));
    }, [data]);

    const sedangCari = search.trim().length > 0;
    const hasilCari = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return ((data?.katalog) || [])
            .map((b, gi) => ({ b, gi }))
            .filter(({ b }) => (`${b.nama} ${b.varian} ${b.id} ${b.kategori || ''}`.toLowerCase().includes(q)));
    }, [data, search]);

    const katTampil = kelompok.some(k => k.nama === katAktif) ? katAktif : (kelompok[0]?.nama || null);
    const daftarTampil = sedangCari
        ? hasilCari
        : (kelompok.find(k => k.nama === katTampil)?.items || []);

    const isiKeranjang = useMemo(() =>
        Object.entries(keranjang)
            .filter(([, q]) => Number(q) > 0)
            .map(([gi, qty]) => ({ gi: Number(gi), id: (data?.katalog || [])[Number(gi)]?.id, qty: Number(qty) })),
        [keranjang, data]);
    const totalPcs = isiKeranjang.reduce((a, it) => a + it.qty, 0);

    function setQty(gi, qty) {
        setKeranjang(prev => ({ ...prev, [gi]: qty }));
    }
    function tambah(gi) {
        setKeranjang(prev => ({ ...prev, [gi]: Number(prev[gi] || 0) + 1 }));
    }
    function kurang(gi) {
        setKeranjang(prev => {
            const next = { ...prev };
            const v = Number(prev[gi] || 0) - 1;
            if (v <= 0) delete next[gi];
            else next[gi] = v;
            return next;
        });
    }
    // Bar bawah hanya penanda — daftar dibuka via modal agar katalog tak tertutup.

    function jmlTerisi(items) {
        let n = 0;
        for (const { gi } of items) if (Number(keranjang[gi] || 0) > 0) n++;
        return n;
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
            const res = await buatPesananOutlet(token, { namaPemesan: nama.trim(), items: isiKeranjang.map(({ id, qty }) => ({ id, qty })) });
            setModal({ show: true, sukses: true, pesan: res.pesan });
            setKeranjang({});
            setNama('');
            setTab('riwayat');
            setHalRiwayat(1); // pesanan baru = terbaru-di-atas halaman 1
            muat();
        } catch (e) {
            setModal({ show: true, sukses: false, pesan: e.message });
        } finally {
            setSaving(false);
        }
    }

    function tokenDariLink(linkTerima) {
        return String(linkTerima || '').split('/terima/')[1] || '';
    }

    // Belum login -> form password inline (tanpa BottomNav; username = bukan slug).
    if (!masuk) {
        return (
            <div className='outlet-wrap'>
            <Container className='outlet-login'>
                <p className='text-center small fw-bold mb-1' style={{ letterSpacing: '0.14em', color: '#7a5200' }}>GUDANG PUSAT • PEMESANAN</p>
                <h2 className='outlet-nama text-center mb-1'>{slug || 'Outlet'}</h2>
                <p className='text-center text-muted small mb-3'>
                    {modeAwal ? 'Buat password pertamamu (sekali saja)' : 'Masuk untuk pesan & pantau kiriman'}
                </p>
                <Card className='shadow-sm border-0'>
                    <Card.Body>
                        {!modeAwal ? (
                            <Form onSubmit={submitMasuk}>
                                <Form.Group className='mb-2'>
                                    <Form.Label className='text-muted small mb-1'>Username</Form.Label>
                                    <Form.Control value={uNama} onChange={e => setUNama(e.target.value)}
                                        placeholder='Username dari gudang' autoFocus autoCapitalize='none' />
                                </Form.Group>
                                <Form.Group className='mb-2'>
                                    <Form.Label className='text-muted small mb-1'>Password</Form.Label>
                                    <InputGroup>
                                        <Form.Control type={lihatMasuk ? 'text' : 'password'} value={uSandi} onChange={e => setUSandi(e.target.value)}
                                            placeholder='Password' />
                                        <Button variant='outline-secondary' onClick={() => setLihatMasuk(v => !v)}
                                            aria-label={lihatMasuk ? 'Sembunyikan password' : 'Tampilkan password'}>
                                            {lihatMasuk ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </Button>
                                    </InputGroup>
                                </Form.Group>
                                {errMasuk && <Alert variant='danger' className='small text-center py-2'>{errMasuk}</Alert>}
                                <Button variant='dark' className='w-100 masuk' disabled={busyMasuk} onClick={submitMasuk}>
                                    {busyMasuk ? '...' : 'Masuk'}
                                </Button>
                            </Form>
                        ) : (
                            <Form onSubmit={submitAwal}>
                                <p className='small text-muted mb-2'>Username: <strong>{uNama}</strong></p>
                                <Form.Group className='mb-2'>
                                    <Form.Label className='text-muted small mb-1'>Password baru (min 4)</Form.Label>
                                    <InputGroup>
                                        <Form.Control type={lihatMasuk ? 'text' : 'password'} value={bPw1} onChange={e => setBPw1(e.target.value)}
                                            placeholder='Password baru' autoFocus />
                                        <Button variant='outline-secondary' onClick={() => setLihatMasuk(v => !v)}
                                            aria-label={lihatMasuk ? 'Sembunyikan password' : 'Tampilkan password'}>
                                            {lihatMasuk ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </Button>
                                    </InputGroup>
                                </Form.Group>
                                <Form.Group className='mb-2'>
                                    <Form.Label className='text-muted small mb-1'>Ketik ulang</Form.Label>
                                    <Form.Control type={lihatMasuk ? 'text' : 'password'} value={bPw2} onChange={e => setBPw2(e.target.value)}
                                        placeholder='Ketik ulang password' />
                                </Form.Group>
                                {errMasuk && <Alert variant='danger' className='small text-center py-2'>{errMasuk}</Alert>}
                                <Button variant='dark' className='w-100 masuk' disabled={busyMasuk} onClick={submitAwal}>
                                    {busyMasuk ? '...' : 'Buat & Masuk'}
                                </Button>
                            </Form>
                        )}
                    </Card.Body>
                </Card>
            </Container>
            </div>
        );
    }

    if (error) return <Container className='py-5 text-center' style={{ maxWidth: '480px' }}><Alert variant='danger'>{error}</Alert></Container>;
    if (!data) return <p className='text-center py-5 text-muted'>Memuat...</p>;

    const riwayat = data.riwayat || [];
    const jmlAktif = riwayat.filter(r => STATUS_AKTIF.includes(String(r.status || '').trim())).length;
    const perluLapor = (r) => String(r.status || '').trim() === 'DIKIRIM';
    // Perlu-lapor di atas, arsip di bawah; tiap grup tetap terbaru-di-atas (sort stabil).
    const daftarSurat = riwayat.filter(r => r.linkTerima)
        .sort((a, b) => (perluLapor(b) ? 1 : 0) - (perluLapor(a) ? 1 : 0));
    const jmlLapor = daftarSurat.filter(perluLapor).length;
    // Pagination 5/halaman agar rapih di HP
    const BATAS_SURAT = 5;
    const totalHalSurat = Math.max(1, Math.ceil(daftarSurat.length / BATAS_SURAT));
    const halSuratAktif = Math.min(halSurat, totalHalSurat);
    const suratTampil = daftarSurat.slice((halSuratAktif - 1) * BATAS_SURAT, halSuratAktif * BATAS_SURAT);
    function bukaSuratJalan(idPesan) {
        const idx = daftarSurat.findIndex(r => r.idPesan === idPesan);
        if (idx >= 0) setHalSurat(Math.floor(idx / BATAS_SURAT) + 1);
        setSuratExpand(prev => (prev === idPesan ? null : idPesan));
        setTab('surat');
    }
    const tampil = riwayat.filter(r => {
        const s = String(r.status || '').trim();
        const aktif = STATUS_AKTIF.includes(s);
        if (filter === 'Aktif') return aktif;
        if (filter === 'Diterima') return s === 'DITERIMA' || s === 'DITERIMA SEBAGIAN';
        if (filter === 'Batal') return s === 'DITOLAK';
        return true;
    });
    // Pagination Riwayat 5/halaman (pola sama dengan Surat Jalan)
    const BATAS_RIWAYAT = 5;
    const totalHalRiwayat = Math.max(1, Math.ceil(tampil.length / BATAS_RIWAYAT));
    const halRiwayatAktif = Math.min(halRiwayat, totalHalRiwayat);
    const riwayatTampil = tampil.slice((halRiwayatAktif - 1) * BATAS_RIWAYAT, halRiwayatAktif * BATAS_RIWAYAT);

    async function handleKeluar() {
        if (!window.confirm('Keluar? Nanti login lagi untuk pesan.')) return;
        sessionStorage.removeItem(kunciSesi);
        setMasuk(false);
        setData(null);
    }

    return (
        <div className='outlet-wrap'>
        <Container className='outlet-kolom py-3 px-3'>
            <p className='text-center small fw-bold mb-1' style={{ letterSpacing: '0.14em', color: '#7a5200', fontSize: '11px' }}>GUDANG PUSAT • PEMESANAN</p>
            <h2 className='outlet-nama text-center'>{data.outlet}</h2>
            <div className='outlet-jadwal mt-2 mb-2'>
                <span className='chip'>Masuk: {data.jadwal?.batchMasuk}</span>
                <span className='chip'>Kirim: {data.jadwal?.rencanaKirim}</span>
            </div>
            <div className='outlet-aksi justify-content-center mb-3'>
                <Button variant='outline-danger' size='sm' onClick={handleKeluar}
                    className='d-flex align-items-center gap-1 fw-semibold'>
                    <LogOut size={16} /> Keluar
                </Button>
                <Button variant='outline-secondary' size='sm' onClick={() => setTampilGanti(true)}
                    className='d-flex align-items-center gap-1 fw-semibold' aria-label='Ganti password'>
                    <KeyRound size={16} /> Sandi
                </Button>
                <RefreshButton onClick={refreshManual} loading={refreshing} />
            </div>

            <div className='outlet-lengket'>
            <div className='outlet-tabs' role='tablist' aria-label='Menu outlet'>
                <button role='tab' aria-selected={tab === 'pesan'} onClick={() => setTab('pesan')}>Pesan</button>
                <button role='tab' aria-selected={tab === 'riwayat'} onClick={() => { setHalRiwayat(1); setTab('riwayat'); }}>
                    Riwayat{jmlAktif ? <span className='bdg'>{jmlAktif}</span> : null}
                </button>
                <button role='tab' aria-selected={tab === 'surat'} onClick={() => setTab('surat')}>
                    Surat{jmlLapor ? <span className='bdg'>{jmlLapor}</span> : null}
                </button>
                <button role='tab' aria-selected={tab === 'keranjang'} onClick={() => setTab('keranjang')}
                    aria-label={`Keranjang, ${isiKeranjang.length} macam`} className='cart'>
                    <ShoppingCart size={20} />
                    {isiKeranjang.length > 0 && <span className='bdg cart'>{isiKeranjang.length}</span>}
                </button>
            </div>
            {tab === 'pesan' && data.bolehPesan && (
                <>
                <div className='outlet-cari'>
                    <Form.Control
                        placeholder='Cari barang… (cth: gula, susu)'
                        value={search} onChange={e => setSearch(e.target.value)}
                        aria-label='Cari barang'
                    />
                </div>
                {!sedangCari && kelompok.length > 1 && (
                    <div className='outlet-kat' role='tablist' aria-label='Kategori barang'>
                        {kelompok.map(k => {
                            const terisi = jmlTerisi(k.items);
                            const aktif = k.nama === katTampil;
                            return (
                                <button key={k.nama} role='tab' aria-selected={aktif}
                                    ref={aktif ? katAktifRef : null}
                                    onClick={() => setKatAktif(k.nama)}>
                                    {k.nama} · {k.items.length}{terisi > 0 ? <span className='isi'> • {terisi}✓</span> : ''}
                                </button>
                            );
                        })}
                    </div>
                )}
                </>
            )}
            </div>
            {tab === 'pesan' && (
                <div>
                    {!data.bolehPesan ? (
                        <div className='outlet-tutup'>
                                <p className='small mb-1'>
                                    <strong>Hanya menerima pesanan di bawah jam 15.00 WIB.</strong>
                                </p>
                                <p className='text-muted small mb-3'>
                                    Loket buka lagi besok pagi. Pantau pesananmu di Tab Riwayat.
                                </p>
                                <Button size='sm' variant='outline-primary' onClick={() => { setHalRiwayat(1); setTab('riwayat'); }}>
                                    Lihat Riwayat
                                </Button>
                        </div>
                    ) : (
                        <>
                            {daftarTampil.length === 0 && <p className='text-center text-muted small py-3'>Tidak ada barang yang cocok.</p>}
                            {daftarTampil.length > 0 && (
                                <Card className='shadow-sm border-0 mb-2'>
                                    <Card.Body className='py-1 px-3'>
                                        <div className='text-muted py-1' style={{ fontSize: '11px' }}>
                                            {sedangCari ? `Hasil cari (${daftarTampil.length})` : `${katTampil} (${daftarTampil.length})`}
                                        </div>
                                        {daftarTampil.map(({ b, gi }) => (
                                            <div key={`${b.id}#${gi}`} className='outlet-item'>
                                                <div className='flex-grow-1' style={{ minWidth: 0 }}>
                                                    <div className='nm'>{b.nama}</div>
                                                    <div className='mt'>
                                                        {[b.varian, b.satuan].filter(Boolean).join(' • ')}
                                                        {sedangCari && b.kategori ? ` • ${b.kategori}` : ''}
                                                    </div>
                                                </div>
                                                <div className='stepper'>
                                                    <button onClick={() => kurang(gi)} aria-label={`Kurangi ${b.nama}`}>−</button>
                                                    <Form.Control
                                                        type='number' inputMode='numeric' min='0'
                                                        placeholder='0' aria-label={`Jumlah ${b.nama}`}
                                                        value={keranjang[gi] ?? ''}
                                                        onChange={e => setQty(gi, e.target.value)}
                                                    />
                                                    <button className='tambah' onClick={() => tambah(gi)} aria-label={`Tambah ${b.nama}`}>+</button>
                                                </div>
                                            </div>
                                        ))}
                                    </Card.Body>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            )}
            {tab === 'keranjang' && (
                <div>
                    <p className='text-muted small mb-2'>Keranjang • {isiKeranjang.length} macam • {totalPcs} pcs</p>
                    {isiKeranjang.length === 0 && (
                        <Card className='shadow-sm border-0'>
                            <Card.Body className='text-center py-4'>
                                <p className='small text-muted mb-3'>Keranjang kosong — cari barang lalu tap +.</p>
                                <Button size='sm' variant='outline-primary' onClick={() => setTab('pesan')}>
                                    Kembali pesan
                                </Button>
                            </Card.Body>
                        </Card>
                    )}
                    {isiKeranjang.length > 0 && (
                    <Card className='shadow-sm border-0 mb-2'>
                        <Card.Body className='py-1 px-3'>
                            {isiKeranjang.map(it => {
                                const b = (data.katalog || [])[it.gi];
                                return (
                                    <div key={`${it.id}#${it.gi}`} className='outlet-item'>
                                        <div className='flex-grow-1' style={{ minWidth: 0 }}>
                                            <div className='nm'>{b?.nama || it.id}</div>
                                            <div className='mt'>{[b?.varian, b?.satuan].filter(Boolean).join(' • ')}</div>
                                        </div>
                                        <div className='stepper'>
                                            <button onClick={() => kurang(it.gi)} aria-label={`Kurangi ${b?.nama}`}>−</button>
                                            <strong style={{ minWidth: 28, textAlign: 'center', fontSize: '17px' }}>{it.qty}</strong>
                                            <button className='tambah' onClick={() => tambah(it.gi)} aria-label={`Tambah ${b?.nama}`}>+</button>
                                            <button onClick={() => setQty(it.gi, '')} aria-label={`Hapus ${b?.nama}`}>×</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </Card.Body>
                    </Card>
                    )}
                    {isiKeranjang.length > 0 && (
                    <>
                    <Form.Control className='mb-2' value={nama} onChange={e => setNama(e.target.value)}
                        placeholder='Nama pemesan (wajib)' aria-label='Nama pemesan' />
                    <Button variant='success' className='w-100' disabled={saving} onClick={handleSubmit}>
                        {saving ? 'Mengirim…' : `Kirim pesanan (${isiKeranjang.length} macam)`}
                    </Button>
                    </>
                    )}
                </div>
            )}
            {tab === 'riwayat' && (
                <div>
                    <div className='outlet-filter'>
                        {['Aktif', 'Diterima', 'Batal', 'Semua'].map(f => (
                            <Button key={f} size='sm' variant={filter === f ? 'dark' : 'outline-secondary'} onClick={() => { setFilter(f); setHalRiwayat(1); }}>
                                {f}
                            </Button>
                        ))}
                    </div>
                    {tampil.length === 0 && <p className='text-center text-muted small py-3'>Belum ada riwayat.</p>}
                    {riwayatTampil.map(r => (
                        <TiketPesanan key={r.idPesan} pesanan={r} cta={r.linkTerima && (
                            <Button size='sm' variant='outline-primary' className='w-100'
                                onClick={() => bukaSuratJalan(r.idPesan)}>
                                {String(r.status || '').trim() === 'DIKIRIM' ? 'Isi Surat Jalan' : 'Lihat Surat Jalan'}
                            </Button>
                        )} />
                    ))}
                    <Pager hal={halRiwayatAktif} total={totalHalRiwayat} onHal={setHalRiwayat} />
                </div>
            )}
            {tab === 'surat' && (
                <div>
                    {daftarSurat.length === 0 && <p className='text-center text-muted small py-3'>Belum ada surat jalan. Muncul di sini setelah paket ditandai dikirim.</p>}
                    {suratTampil.map(r => {
                        const buka = suratExpand === r.idPesan;
                        const perluIsi = perluLapor(r);
                        return (
                            <TiketPesanan key={r.idPesan} pesanan={r}
                                cta={
                                    <Button size='sm' variant={buka ? 'secondary' : 'outline-primary'} className='w-100'
                                        onClick={() => setSuratExpand(buka ? null : r.idPesan)}>
                                        {buka ? 'Tutup' : (perluIsi ? 'Isi Surat Jalan' : 'Lihat Arsip')}
                                    </Button>
                                }
                                bawah={
                                    <Collapse in={buka}>
                                        <div className='mt-2 pt-2' style={{ borderTop: '1px dashed #dee2e6' }}>
                                            {buka && <TerimaForm token={tokenDariLink(r.linkTerima)} onSelesai={() => muat()} />}
                                        </div>
                                    </Collapse>
                                }
                            />
                        );
                    })}
                    <Pager hal={halSuratAktif} total={totalHalSurat} onHal={setHalSurat} />
                </div>
            )}

            <Modal show={tampilGanti} onHide={() => { setTampilGanti(false); setGPw1(''); setGPw2(''); }}
                centered dialogClassName='outlet-modal' aria-label='Ganti password'>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '17px', fontWeight: 800 }}>Ganti password</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <InputGroup className='mb-2'>
                        <Form.Control type={lihatMasuk ? 'text' : 'password'} value={gPw1} onChange={e => setGPw1(e.target.value)}
                            placeholder='Password baru (min 4)' aria-label='Password baru' />
                        <Button variant='outline-secondary' onClick={() => setLihatMasuk(v => !v)}
                            aria-label={lihatMasuk ? 'Sembunyikan password' : 'Tampilkan password'}>
                            {lihatMasuk ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                    </InputGroup>
                    <Form.Control type={lihatMasuk ? 'text' : 'password'} value={gPw2} onChange={e => setGPw2(e.target.value)}
                        placeholder='Ketik ulang password baru' aria-label='Ketik ulang password baru' />
                </Modal.Body>
                <Modal.Footer>
                    <Button variant='secondary' onClick={() => { setTampilGanti(false); setGPw1(''); setGPw2(''); }}>Batal</Button>
                    <Button variant='success' onClick={submitGanti}>Simpan</Button>
                </Modal.Footer>
            </Modal>

            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={() => setModal(m => ({ ...m, show: false }))} />
        </Container>
        </div>
    );
}
