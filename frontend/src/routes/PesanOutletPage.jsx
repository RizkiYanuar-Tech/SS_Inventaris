import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Card, Form, Button, Alert, Tabs, Tab, Collapse } from 'react-bootstrap';
import { lihatPesananOutlet, buatPesananOutlet } from '../api/client';
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
    const [lihatKeranjang, setLihatKeranjang] = useState(false);
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
        } catch (e) { setError(e.message); }
    }
    useEffect(() => { muat(); /* eslint-disable-next-line */ }, [token]);

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
    // Buka kartu keranjang otomatis saat item pertama masuk (sekali per sesi isi).
    useEffect(() => {
        if (isiKeranjang.length === 1 && totalPcs === 1) setLihatKeranjang(true);
        // eslint-disable-next-line
    }, [isiKeranjang.length]);

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
            setLihatKeranjang(false);
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

    return (
        <Container className='py-4' style={{ maxWidth: '480px' }}>
            <div className='d-flex align-items-center justify-content-between mb-1'>
                <span style={{ width: 34 }} />
                <h2 className='mb-0 fw-bold text-center flex-grow-1'>{data.outlet}</h2>
                <RefreshButton onClick={refreshManual} loading={refreshing} />
            </div>
            <p className='text-center text-muted small mb-3'>
                Batch masuk: {data.jadwal?.batchMasuk} • Rencana kirim: {data.jadwal?.rencanaKirim}<br />
                Slot Senin & Kamis, cutoff 15:00 WIB
            </p>

            <Tabs activeKey={tab} onSelect={setTab} className='mb-3'>
                <Tab eventKey='pesan' title='Pesan Baru'>
                    {!data.bolehPesan ? (
                        <Card className='shadow-sm border-0'>
                            <Card.Body className='text-center'>
                                <p className='small mb-1'>
                                    <strong>Hanya menerima pesanan di bawah jam 15.00 WIB.</strong>
                                </p>
                                <p className='text-muted small mb-3'>
                                    Loket buka lagi besok pagi. Pantau pesananmu di Tab Riwayat.
                                </p>
                                <Button size='sm' variant='outline-primary' onClick={() => { setHalRiwayat(1); setTab('riwayat'); }}>
                                    Lihat Riwayat
                                </Button>
                            </Card.Body>
                        </Card>
                    ) : (
                        <>
                            {/* Kartu keranjang melayang: header selalu tampil, rincian ciut/mekar */}
                            <Card className='shadow-sm mb-2' style={{ position: 'sticky', top: 0, zIndex: 15, background: '#FFF8E1', borderColor: '#f0e2b6' }}>
                                <Card.Body className='py-2'>
                                    <div className='d-flex justify-content-between align-items-center'>
                                        <div className='small'>
                                            {isiKeranjang.length === 0
                                                ? <span className='text-muted'>Keranjang kosong — cari lalu tap +</span>
                                                : <span><strong>{isiKeranjang.length} macam • {totalPcs} pcs</strong></span>}
                                        </div>
                                        <Button size='sm' variant={lihatKeranjang ? 'secondary' : 'outline-success'}
                                            disabled={isiKeranjang.length === 0}
                                            onClick={() => setLihatKeranjang(v => !v)}>
                                            {lihatKeranjang ? 'Tutup' : 'Lihat'}
                                        </Button>
                                    </div>
                                    <Collapse in={lihatKeranjang && isiKeranjang.length > 0}>
                                        <div>
                                            <div className='mt-2' style={{ maxHeight: 220, overflowY: 'auto' }}>
                                                {isiKeranjang.map(it => {
                                                    const b = (data.katalog || [])[it.gi];
                                                    return (
                                                        <div key={`${it.id}#${it.gi}`}
                                                            className='d-flex justify-content-between align-items-center py-1'
                                                            style={{ borderBottom: '1px dashed #e0d3a8', fontVariantNumeric: 'tabular-nums' }}>
                                                            <span className='small text-truncate' style={{ maxWidth: '70%' }}>
                                                                {b?.nama || it.id} <span className='text-muted'>x{it.qty}</span>
                                                            </span>
                                                            <span className='d-flex align-items-center gap-1'>
                                                                <Button size='sm' variant='outline-secondary' style={{ width: 24, height: 24, padding: 0, lineHeight: 1 }} onClick={() => kurang(it.gi)} aria-label={`Kurangi ${b?.nama}`}>−</Button>
                                                                <strong className='small' style={{ minWidth: 20, textAlign: 'center' }}>{it.qty}</strong>
                                                                <Button size='sm' variant='outline-secondary' style={{ width: 24, height: 24, padding: 0, lineHeight: 1 }} onClick={() => tambah(it.gi)} aria-label={`Tambah ${b?.nama}`}>+</Button>
                                                                <Button size='sm' variant='link' className='text-danger p-0 ms-1' onClick={() => setQty(it.gi, '')} aria-label={`Hapus ${b?.nama}`}>×</Button>
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <Form.Group className='mt-2'>
                                                <Form.Label className='text-muted small mb-1'>Nama Pemesan (wajib)</Form.Label>
                                                <Form.Control value={nama} onChange={e => setNama(e.target.value)} placeholder='Nama jelas' />
                                            </Form.Group>
                                            <Button variant='success' className='w-100 mt-2' disabled={saving} onClick={handleSubmit}>
                                                {saving ? 'Mengirim...' : `Kirim Pesanan (${isiKeranjang.length} macam)`}
                                            </Button>
                                        </div>
                                    </Collapse>
                                </Card.Body>
                            </Card>

                            <div className='pt-1 pb-2' style={{ background: '#fff' }}>
                                <Form.Control
                                    size='sm' placeholder='Cari barang...'
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    aria-label='Cari barang'
                                />
                            </div>

                            {/* Bar kategori menyamping (sticky): klik → daftar langsung ganti */}
                            {!sedangCari && kelompok.length > 1 && (
                                <div className='d-flex gap-1 mb-2 py-1' role='tablist' aria-label='Kategori barang'
                                    style={{ overflowX: 'auto', position: 'sticky', top: 64, zIndex: 10, background: '#fff' }}>
                                    {kelompok.map(k => {
                                        const terisi = jmlTerisi(k.items);
                                        const aktif = k.nama === katTampil;
                                        return (
                                            <Button key={k.nama} size='sm' role='tab' aria-selected={aktif}
                                                variant={aktif ? 'dark' : 'outline-secondary'} className='flex-shrink-0'
                                                onClick={() => setKatAktif(k.nama)}>
                                                {k.nama} ({k.items.length}){terisi > 0 ? ` • ${terisi}✓` : ''}
                                            </Button>
                                        );
                                    })}
                                </div>
                            )}

                            {daftarTampil.length === 0 && <p className='text-center text-muted small py-3'>Tidak ada barang yang cocok.</p>}
                            {daftarTampil.length > 0 && (
                                <Card className='shadow-sm border-0 mb-2'>
                                    <Card.Body className='py-1 px-3'>
                                        <div className='text-muted py-1' style={{ fontSize: '11px' }}>
                                            {sedangCari ? `Hasil cari (${daftarTampil.length})` : `${katTampil} (${daftarTampil.length})`}
                                        </div>
                                        {daftarTampil.map(({ b, gi }) => (
                                            <div key={`${b.id}#${gi}`}
                                                className='d-flex justify-content-between align-items-center gap-2 py-1'
                                                style={{ borderBottom: '1px solid #f1f3f5' }}>
                                                <div className='flex-grow-1' style={{ minWidth: 0 }}>
                                                    <div className='fw-medium small text-truncate'>{b.nama}</div>
                                                    <div className='text-muted' style={{ fontSize: '11px' }}>
                                                        {[b.varian, b.satuan].filter(Boolean).join(' • ')}
                                                        {sedangCari && b.kategori ? ` • ${b.kategori}` : ''}
                                                    </div>
                                                </div>
                                                <div className='d-flex align-items-center gap-1 flex-shrink-0'>
                                                    <Button size='sm' variant='outline-secondary' style={{ width: 28, height: 28, padding: 0 }} onClick={() => kurang(gi)} aria-label={`Kurangi ${b.nama}`}>−</Button>
                                                    <Form.Control
                                                        type='number' inputMode='numeric' min='0' size='sm'
                                                        style={{ width: 56, textAlign: 'center' }}
                                                        placeholder='0' aria-label={`Jumlah ${b.nama}`}
                                                        value={keranjang[gi] ?? ''}
                                                        onChange={e => setQty(gi, e.target.value)}
                                                    />
                                                    <Button size='sm' variant='outline-success' style={{ width: 28, height: 28, padding: 0 }} onClick={() => tambah(gi)} aria-label={`Tambah ${b.nama}`}>+</Button>
                                                </div>
                                            </div>
                                        ))}
                                    </Card.Body>
                                </Card>
                            )}
                        </>
                    )}
                </Tab>
                <Tab eventKey='riwayat' title={`Riwayat${jmlAktif ? ` (${jmlAktif})` : ''}`}>
                    <div className='d-flex gap-2 mb-3'>
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
                </Tab>
                <Tab eventKey='surat' title={`Surat Jalan${jmlLapor ? ` (${jmlLapor})` : ''}`}>
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
                </Tab>
            </Tabs>

            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={() => setModal(m => ({ ...m, show: false }))} />
        </Container>
    );
}
