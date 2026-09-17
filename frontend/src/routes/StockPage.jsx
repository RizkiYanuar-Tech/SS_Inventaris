import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Row, Col, ButtonGroup, Button } from 'react-bootstrap'
import { LayoutGrid, List } from 'lucide-react'
import StockTable from '../components/stock/StockTable'
import KategoriFilter from '../components/stock/KategoriFilter'
import SearchBar from '../components/stock/SearchBar'
import Pagination from '../components/layout/Pagination'
import { useBarang } from '../hooks/useBarang'
import { filterBarang } from '../utils/filterBarang'
import { usePagination } from '../hooks/usePagination'

export default function StockPage(){
    const navigate = useNavigate()
    const {data: items, loading, error, refresh} = useBarang();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const [mode, setMode] = useState('kartu'); // 'kartu' | 'tabel'
    const filteredBarang = filterBarang(items, search, selectedCategory);
    const {currentItems, currentPage, totalPages, nextPage, prevPage} = usePagination(filteredBarang, mode === 'tabel' ? 20 : 6)

    // Tampilkan pesan loading atau error
    if (loading) return <p className='text-center py-5'>Memuat Data Gudang...</p>
    if (error) return <p className='text-center py-5 text-danger'>Terjadi kesalahan {error}</p>

    return(
        <Container className='py-4 hub-lebar'>
            <div className='d-flex justify-content-between align-items-center mb-4'>
                <h2 className='mb-0 fw-bold'>Stock Gudang Pusat</h2>
                <span className='d-flex gap-2 align-items-center'>
                <Button size='sm' variant='outline-primary' onClick={() => navigate('/opname')}>
                    Opname
                </Button>
                <ButtonGroup size='sm' aria-label='Mode tampilan'>
                    <Button variant={mode === 'kartu' ? 'dark' : 'outline-secondary'}
                        onClick={() => setMode('kartu')} aria-pressed={mode === 'kartu'} aria-label='Tampilan kartu'>
                        <LayoutGrid size={16} />
                    </Button>
                    <Button variant={mode === 'tabel' ? 'dark' : 'outline-secondary'}
                        onClick={() => setMode('tabel')} aria-pressed={mode === 'tabel'} aria-label='Tampilan tabel'>
                        <List size={16} />
                    </Button>
                </ButtonGroup>
                </span>
            </div>
            <Row className='mb-3'>
                <Col md={8}>
                    <SearchBar search={search} onSearchChange={setSearch} />
                </Col>
                <Col md={4}>
                    <KategoriFilter items={items} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory}/>
                </Col>
            </Row>
            <StockTable key={mode} items={currentItems} semua={items} onBerubah={refresh} mode={mode} />
            <Pagination currentPage={currentPage} totalPages={totalPages} onPrev={prevPage} onNext={nextPage} />
        </Container>
    )
}