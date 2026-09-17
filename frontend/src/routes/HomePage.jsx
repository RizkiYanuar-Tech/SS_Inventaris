import { useTransaksi } from '../hooks/useTransaksi'
import { useBarang } from '../hooks/useBarang'
import FastMovingTable from  '../components/homepage/FastMovingTable'
import SummaryCard from '../components/homepage/SummaryCard'
import TrendChart from '../components/homepage/TrendChart'
import WeekFilter from '../components/homepage/WeekFilter'
import { Package, TriangleAlert, CircleArrowDown, CircleArrowUp, Banknote, LogOut, Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseTimestamp, isSameDay, getMondayOf, addDays} from '../utils/dateParse';
import RefreshButton from '../components/layout/RefreshButton'
import UnduhAsetModal from '../components/homepage/UnduhAsetModal'
import LoncengGudang from '../components/layout/LoncengGudang'
import { keluarGudang, fetchNotifikasi, fetchVendor, tambahVendor, ubahVendor, hapusVendor } from '../api/client'

// Import komponen React Bootstrap
import { Container, Row, Col, Card, Button, Form } from 'react-bootstrap';

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export default function HomePage(){
    const { data: barang, loading: loadingBarang, refresh: refreshBarang} = useBarang()
    const { data: transaksi, loading: loadingTransaksi, refresh: refreshTransaksi} = useTransaksi()

    const [weekMode, setWeekMode] = useState('thisWeek')
    const [customRange, setCustomRange] = useState({ start: '', end: ''})

    const today = new Date()
    const isLoading = loadingBarang || loadingTransaksi

    const totalBarang = barang.length
    const lowStockCount = barang.filter((b) => b.stock <= b.threshold && b.stock > 0).length
    const emptyStockCount = barang.filter((b) => b.stock === 0).length

    // Total Aset Inventory (moving-average): Σ stock × harga_barang, tanpa item belum berhHarga.
    const { totalAset, belumHarga } = useMemo(() => {
        let total = 0, belum = 0
        for (const b of barang) {
            if (b.hargaBarang == null) { belum++; continue }
            total += (Number(b.stock) || 0) * Number(b.hargaBarang)
        }
        return { totalAset: total, belumHarga: belum }
    }, [barang])
    const totalAsetRp = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalAset)

    const transaksiHariIni = useMemo(() => {
        return transaksi.filter((t) => {
            const tanggal = parseTimestamp(t.timestamp)
            return tanggal && isSameDay(tanggal, today)
        })
    }, [transaksi])

    const masukHariIni = transaksiHariIni.filter((t) => t.jenis === 'Masuk').length
    const keluarHariIni = transaksiHariIni.filter((t) => t.jenis === 'Keluar').length

    // Tren Barang (Mingguan)
    const rentangMinggu = useMemo(() => {
        if (weekMode === 'custom' && customRange.start && customRange.end) {
            const start = new Date(customRange.start)
            start.setHours(0, 0, 0, 0)
            const end = new Date(customRange.end)
            end.setHours(23, 59, 59, 999)
            return { start, end }
        }
        
        const seninMingguIni = getMondayOf(today)
        const senin = weekMode === 'lastWeek' ? addDays(seninMingguIni, -7) : seninMingguIni
        const minggu = addDays(senin, 6)
        minggu.setHours(23, 59, 59, 999)
        return { start: senin, end: minggu }
    }, [weekMode, customRange])

    const trenData = useMemo(() => {
        const bucket = HARI.map((hari) => ({ hari, masuk: 0, keluar: 0}))

        transaksi.forEach((t) => {
            const tanggal = parseTimestamp(t.timestamp)
            if (!tanggal) return
            if (tanggal < rentangMinggu.start || tanggal > rentangMinggu.end) return
        
            const hariIndex = (tanggal.getDay() + 6) % 7
            const jumlah = Number(t.jumlah) || 0
            if (t.jenis === 'Masuk'){
                bucket[hariIndex].masuk += jumlah
            } else if (t.jenis === 'Keluar'){
                bucket[hariIndex].keluar += jumlah
            }
        })
        return bucket
    }, [transaksi, rentangMinggu])

    //Fast Moving Stock (7 hari terakhir)
    const fastMoving = useMemo(() => {
        const batasWaktu = addDays(today, -7)
        const rekap = {}

        transaksi.forEach((t) => {
            const tanggal = parseTimestamp(t.timestamp)
            if (!tanggal || tanggal < batasWaktu) return

            if (!rekap[t.nama]) rekap[t.nama] = { nama: t.nama, masuk: 0, keluar: 0}
            const jumlah = Number(t.jumlah) || 0
            if (t.jenis === 'Masuk'){
                rekap[t.nama].masuk += jumlah
            } else if (t.jenis === 'Keluar'){
                rekap[t.nama].keluar += jumlah
            }
        })

        return Object.values(rekap)
            .sort((a, b) => b.masuk + b.keluar - (a.masuk + a.keluar))
            .slice(0, 5)
    }, [transaksi])

    const [notifikasi, setNotifikasi] = useState(null)
    function muatNotifikasi() {
        fetchNotifikasi().then(setNotifikasi).catch(() => {});
    }
    useEffect(() => { muatNotifikasi() }, [])

    // Master vendor (CRUD sederhana; tanpa relasi; ikut loading/refresh)
    const [vendor, setVendor] = useState([]);
    const [vNama, setVNama] = useState('');
    const [vNomor, setVNomor] = useState('');
    const [vAlamat, setVAlamat] = useState('');
    const [vEdit, setVEdit] = useState(null); // {id, nama, nomor, alamat}
    const [vPesan, setVPesan] = useState('');
    function muatVendor() {
        fetchVendor().then(d => { setVendor(d); setVEdit(null); }).catch(() => setVendor([]));
    }
    useEffect(() => { muatVendor() }, []);
    async function simpanVendorBaru() {
        try {
            const res = await tambahVendor({ nama: vNama, nomor: vNomor, alamat: vAlamat });
            setVPesan(res.pesan || 'Tersimpan.');
            setVNama(''); setVNomor(''); setVAlamat('');
            muatVendor();
        } catch (e) { setVPesan(e.message); }
    }
    async function simpanVendorEdit() {
        if (!vEdit || !(Number(vEdit.id) > 0)) { setVPesan('Pilih baris vendor dulu lewat tombol Edit.'); return; }
        if (!String(vEdit.nama || '').trim()) { setVPesan('Nama vendor wajib diisi.'); return; }
        try {
            const res = await ubahVendor(vEdit.id, { nama: vEdit.nama, nomor: vEdit.nomor, alamat: vEdit.alamat });
            setVPesan(res.pesan || 'Diperbarui.');
            setVEdit(null);
            muatVendor();
        } catch (e) { setVPesan(e.message); }
    }
    async function buangVendor(v) {
        if (!window.confirm(`Hapus vendor ${v.nama}?`)) return;
        try {
            const res = await hapusVendor(v.id);
            setVPesan(res.pesan || 'Dihapus.');
            muatVendor();
        } catch (e) { setVPesan(e.message); }
    }

    const handleRefresh = () => {
        refreshBarang()
        refreshTransaksi()
        muatNotifikasi()
        muatVendor()
    }

    const navigate = useNavigate()
    // Unduh rincian aset via modal (preview + kini/per-tanggal).
    const [bukaUnduh, setBukaUnduh] = useState(false);
    function handleUnduhAset() {
        setBukaUnduh(true);
    }
    async function handleKeluar() {
        if (!window.confirm('Keluar dari sesi gudang?')) return
        try { await keluarGudang() } catch { /* sesi sudah mati, tetap keluar */ }
        sessionStorage.removeItem('gudang-masuk')
        navigate('/gudang-masuk', { replace: true })
    }

    return (
        <Container className="py-4 hub-lebar">
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h1 className="h4 fw-bold text-dark mb-0">Dashboard</h1>
                    <p className="text-muted small mb-0">
                        {today.toLocaleDateString('id-ID', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </p>
                </div>
                <span className='d-flex align-items-center gap-2'>
                    <LoncengGudang data={notifikasi} onMuat={muatNotifikasi} />
                    <Button variant='outline-danger' size='sm' onClick={handleKeluar}
                        className='d-flex align-items-center gap-1 fw-semibold'>
                        <LogOut size={16} /> Keluar
                    </Button>
                    <RefreshButton onClick={handleRefresh} loading={isLoading} />
                </span>
            </div>

            {isLoading ? (
                <p className="text-muted text-center py-5">Memuat data...</p>
            ) : (
                <>
                    <Row className="g-3 mb-3">
                        <Col xs={12}>
                            <div className='position-relative h-100'>
                                <SummaryCard icon={Banknote} iconColor='#16a34a' label='Total Aset Inventory' value={totalAsetRp} unit={belumHarga > 0 ? `${belumHarga} item belum ada harga` : null} ukuran='fs-4' />
                                <Button variant='link' size='sm' className='position-absolute top-0 end-0 p-2 text-muted'
                                    onClick={handleUnduhAset} disabled={isLoading || barang.length === 0}
                                    aria-label='Unduh rincian aset (CSV)' title='Unduh rincian aset (CSV)'>
                                    <Download size={16} />
                                </Button>
                            </div>
                        </Col>
                    </Row>
                    <Row className="g-3 mb-4">
                        <Col xs={6} md={4}>
                            <SummaryCard icon={Package} iconColor='#2563eb' label='Jumlah Barang' value={totalBarang}/>
                        </Col>
                        <Col xs={6} md={4}>
                            <SummaryCard icon={TriangleAlert} iconColor='#f70505' label='Stock Habis' value={emptyStockCount} unit="barang habis" rel='#dc3545'/>
                        </Col>
                        <Col xs={6} md={4}>
                            <SummaryCard icon={TriangleAlert} iconColor='#ffc107' label='Stock Menipis' value={lowStockCount} unit='barang menipis' rel='#ffc107'/>
                        </Col>
                        <Col xs={6} md={4}>
                            <SummaryCard icon={CircleArrowUp} iconColor='#7c3aed' label='Barang Keluar' value={keluarHariIni} unit="Hari Ini" />
                        </Col>
                        <Col xs={6} md={4}>
                            <SummaryCard icon={CircleArrowDown} iconColor='#00f000' label='Barang Masuk' value={masukHariIni} unit="Hari Ini" />
                        </Col>
                    </Row>

                    <Card className="mb-4 shadow-sm border-0" style={{ borderRadius: '1rem' }}>
                        <Card.Body>
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <h2 className="h6 fw-bold text-dark mb-0">Tren Arus Barang</h2>
                                <WeekFilter
                                    mode={weekMode} 
                                    onChange={setWeekMode}
                                    customRange={customRange}
                                    onCustomRangeChange={setCustomRange}
                                />
                            </div>
                            <TrendChart data={trenData} />
                        </Card.Body>
                    </Card>

                    <Card className="shadow-sm border-0" style={{ borderRadius: '1rem' }}>
                        <Card.Body>
                            <h2 className="h6 fw-bold text-dark mb-3">Fast Moving Stock</h2>
                            <FastMovingTable items={fastMoving} />
                        </Card.Body>
                    </Card>

                    <Card className="mt-4 shadow-sm border-0" style={{ borderRadius: '1rem' }}>
                        <Card.Body>
                            <h2 className="h6 fw-bold text-dark mb-3">Vendor ({vendor.length})</h2>
                            {vPesan && <p className='small text-muted mb-2'>{vPesan}</p>}
                            {vendor.map(v => {
                                const editing = vEdit?.id === v.id;
                                return (
                                <div key={v.id} className='py-2' style={{ borderBottom: '1px solid #f1f3f5' }}>
                                    <div className='d-flex justify-content-between align-items-center gap-2'>
                                        <div className='flex-fill'>
                                            {editing ? (
                                                <Row className='g-1'>
                                                    <Col xs={12} md={4}>
                                                        <Form.Control size='sm' value={vEdit.nama || ''}
                                                            onChange={e => setVEdit(p => ({ ...p, nama: e.target.value }))} placeholder='Nama' aria-label='Nama vendor' />
                                                    </Col>
                                                    <Col xs={6} md={4}>
                                                        <Form.Control size='sm' value={vEdit.nomor || ''}
                                                            onChange={e => setVEdit(p => ({ ...p, nomor: e.target.value }))} placeholder='Kontak' aria-label='Kontak vendor' />
                                                    </Col>
                                                    <Col xs={6} md={4}>
                                                        <Form.Control size='sm' value={vEdit.alamat || ''}
                                                            onChange={e => setVEdit(p => ({ ...p, alamat: e.target.value }))} placeholder='Alamat' aria-label='Alamat vendor' />
                                                    </Col>
                                                </Row>
                                            ) : (
                                                <>
                                                    <div className='fw-medium small'>{v.nama}</div>
                                                    <div className='text-muted' style={{ fontSize: '11px' }}>
                                                        {[v.nomor, v.alamat].filter(Boolean).join(' • ') || '-'}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <span className='d-flex gap-1 flex-shrink-0'>
                                            {editing ? (
                                                <>
                                                    <Button size='sm' variant='success'
                                                        disabled={!String(vEdit.nama || '').trim()}
                                                        onClick={simpanVendorEdit}>
                                                        Simpan
                                                    </Button>
                                                    <Button size='sm' variant='secondary' onClick={() => setVEdit(null)}>
                                                        Batal
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button size='sm' variant='outline-primary'
                                                        onClick={() => setVEdit({ ...v })}>
                                                        Edit
                                                    </Button>
                                                    <Button size='sm' variant='outline-danger' onClick={() => buangVendor(v)}>
                                                        Hapus
                                                    </Button>
                                                </>
                                            )}
                                        </span>
                                    </div>
                                </div>
                                );
                            })}
                            {vendor.length === 0 && <p className='small text-muted'>Belum ada vendor.</p>}
                            <Row className='g-1 mt-2'>
                                <Col xs={12} md={4}>
                                    <Form.Label className='text-muted small mb-1'>Nama vendor baru</Form.Label>
                                    <Form.Control size='sm' value={vNama} onChange={e => setVNama(e.target.value)} placeholder='Nama vendor baru' />
                                </Col>
                                <Col xs={6} md={3}>
                                    <Form.Label className='text-muted small mb-1'>Kontak</Form.Label>
                                    <Form.Control size='sm' value={vNomor} onChange={e => setVNomor(e.target.value)} placeholder='Kontak' />
                                </Col>
                                <Col xs={6} md={4}>
                                    <Form.Label className='text-muted small mb-1'>Alamat</Form.Label>
                                    <Form.Control size='sm' value={vAlamat} onChange={e => setVAlamat(e.target.value)} placeholder='Alamat' />
                                </Col>
                                <Col xs={12} md={1} className='d-flex align-items-end'>
                                    <Button size='sm' variant='primary' className='w-100'
                                        disabled={!vNama.trim()} onClick={simpanVendorBaru}>+</Button>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </>
            )}
            <UnduhAsetModal show={bukaUnduh} onTutup={() => setBukaUnduh(false)}
                barang={barang} transaksi={transaksi} />
        </Container>
    )
}