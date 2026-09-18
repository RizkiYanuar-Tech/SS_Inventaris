import { useState, useMemo } from 'react'
import TransaksiTable from '../components/transaksi/TransaksiTable'
import KategoriFilter from '../components/stock/KategoriFilter'
import DateRangeFilter from '../components/transaksi/DateRangeFilter'
import SearchBar from '../components/stock/SearchBar'
import { filterTransaksi } from '../utils/filterTransaksi'
import { parseTimestamp } from '../utils/dateParse'
import { Container, Row, Col, Button, Collapse, Form} from 'react-bootstrap'
import { Funnel } from 'lucide-react'
import { useTransaksi } from '../hooks/useTransaksi'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/layout/Pagination'

function defaultDate(daysAgo){
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return date.toISOString().split('T')[0]
}

export default function TransaksiPage(){
    const {data: items, loading, error} = useTransaksi();
    const [search, setSearch] = useState('');
    const [jenis, setJenis] = useState('Semua');
    const [sembunyikanOpname, setSembunyikanOpname] = useState(true);
    const [startDate, setStartDate] = useState(defaultDate(7));
    const [endDate, setEndDate] = useState(defaultDate(0));
    const [showFilter, setShowFilter] = useState(false);

    const filtered = useMemo(() => {
        const hasil = filterTransaksi(items, {search, startDate, endDate, jenis, sembunyikanOpname })
        
        // Urutkan dari atas
        return [...hasil].sort((a, b) =>{
            const tglA = parseTimestamp(a.timestamp)
            const tglB = parseTimestamp(b.timestamp)
            if (!tglA || !tglB) return 0
            return tglB - tglA
        })
    }, [items, search, startDate, endDate, jenis, sembunyikanOpname])
    const {currentItems, currentPage, totalPages, nextPage, prevPage} = usePagination(filtered, 6)

    if (loading) return <p className='text-center py-5'>Memuat History Gudang....</p>
    if (error) return <p className='text-center py-5'>Terjadi Kesalahan: {error}</p>

    return (
        <Container className='py-4 hub-lebar'>
            <h2 className='mb-4 fw-bold'>Riwayat Transaksi</h2>
            <SearchBar search={search} onSearchChange={setSearch} />
        
            <Row className='mb-3 align-items-end g-2'>
                <Col>
                <DateRangeFilter
                    startDate={startDate}
                    endDate={endDate}
                    onStartChange={setStartDate}
                    onEndChange={setEndDate}
                />
                </Col>
                <Col xs='auto'>
                    <Button
                        variant={showFilter ? 'secondary' : 'outline-secondary'}
                        onClick={() => setShowFilter(!showFilter)}
                        className='d-flex align-items-center gap-1'
                    >
                        <Funnel size={16} />
                        Filter
                    </Button>
                </Col>
            </Row>

            <Collapse in={showFilter}>
                <div className='mb-3'>
                    <KategoriFilter items={items} selectedCategory={jenis} onCategoryChange={setJenis} field='jenis' labelSemua='Semua Jenis' />
                </div>
            </Collapse>

            <Form.Check type='checkbox' id='sembunyikan-opname' label='Sembunyikan penyesuaian opname'
                className='mb-3 small text-muted'
                checked={sembunyikanOpname} onChange={(e) => setSembunyikanOpname(e.target.checked)} />

            <TransaksiTable items={currentItems} />
            <Pagination currentPage={currentPage} totalPages={totalPages} onPrev={prevPage} onNext={nextPage} />
        </Container>
    )
}