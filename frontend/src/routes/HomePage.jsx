import { useTransaksi } from '../hooks/useTransaksi'
import { useBarang } from '../hooks/useBarang'
import FastMovingTable from  '../components/homepage/FastMovingTable'
import SummaryCard from '../components/homepage/SummaryCard'
import TrendChart from '../components/homepage/TrendChart'
import WeekFilter from '../components/homepage/WeekFilter'
import { Package, TriangleAlert, CircleArrowDown, CircleArrowUp, Banknote, LogOut } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseTimestamp, isSameDay, getMondayOf, addDays} from '../utils/dateParse';
import RefreshButton from '../components/layout/RefreshButton'
import LoncengGudang from '../components/layout/LoncengGudang'
import { keluarGudang, fetchNotifikasi } from '../api/client'

// Import komponen React Bootstrap
import { Container, Row, Col, Card, Button } from 'react-bootstrap';

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

    const handleRefresh = () => {
        refreshBarang()
        refreshTransaksi()
        muatNotifikasi()
    }

    const navigate = useNavigate()
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
                    <Row className="g-3 mb-4">
                        <Col xs={6} md={4}>
                            <SummaryCard icon={Package} iconColor='#2563eb' label='Jumlah Barang' value={totalBarang}/>
                        </Col>
                        <Col xs={6} md={4}>
                            <SummaryCard icon={Banknote} iconColor='#16a34a' label='Total Aset Inventory' value={totalAsetRp} unit={belumHarga > 0 ? `${belumHarga} item belum ada harga` : null} />
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
                </>
            )}
        </Container>
    )
}