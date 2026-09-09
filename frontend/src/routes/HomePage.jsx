import { useTransaksi } from '../hooks/useTransaksi'
import { useBarang } from '../hooks/useBarang'
import FastMovingTable from  '../components/homepage/FastMovingTable'
import SummaryCard from '../components/homepage/SummaryCard'
import TrendChart from '../components/homepage/TrendChart'
import WeekFilter from '../components/homepage/WeekFilter'
import { Package, TriangleAlert, CircleArrowDown, CircleArrowUp} from 'lucide-react'
import { useMemo, useState} from 'react'
import { parseTimestamp, isSameDay, getMondayOf, addDays} from '../utils/dateParse';
import RefreshButton from '../components/layout/RefreshButton'

// Import komponen React Bootstrap
import { Container, Row, Col, Card } from 'react-bootstrap';

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export default function HomePage(){
    const { data: barang, loading: loadingBarang, refresh: refreshBarang} = useBarang()
    const { data: transaksi, loading: loadingTransaksi, refresh: refreshTransaksi} = useTransaksi()

    const [weekMode, setWeekMode] = useState('thisWeek')
    const [customRange, setCustomRange] = useState({ start: '', end: ''})

    const today = new Date()
    const isLoading = loadingBarang || loadingTransaksi

    const totalBarang = barang.length
    const lowStockCount = barang.filter((b) => b.stock < b.threshold).length

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

    const handleRefresh = () => {
        refreshBarang()
        refreshTransaksi()
    }

    return (
        <Container className="py-4" style={{ maxWidth: '480px' }}>
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
                <RefreshButton onClick={handleRefresh} loading={isLoading} />
            </div>

            {isLoading ? (
                <p className="text-muted text-center py-5">Memuat data...</p>
            ) : (
                <>
                    <Row className="g-3 mb-4">
                        <Col xs={6}>
                            <SummaryCard icon={Package} iconColor='#2563eb' label='Jumlah Barang' value={totalBarang}/>
                        </Col>
                        <Col xs={6}>
                            <SummaryCard icon={TriangleAlert} iconColor='#f70505' label='Low Stock' value={lowStockCount}/>
                        </Col>
                        <Col xs={6}>
                            <SummaryCard icon={CircleArrowUp} iconColor='#7c3aed' label='Barang Keluar' value={keluarHariIni} unit="Hari Ini" />
                        </Col>
                        <Col xs={6}>
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