import { useState } from 'react'
import { Container, Row, Col } from 'react-bootstrap'
import StockTable from '../components/stock/StockTable'
import KategoriFilter from '../components/stock/KategoriFilter'
import SearchBar from '../components/stock/SearchBar'
import Pagination from '../components/layout/Pagination'
import { useBarang } from '../hooks/useBarang'
import { filterBarang } from '../utils/filterBarang'
import { usePagination } from '../hooks/usePagination'

export default function StockPage(){
    const {data: items, loading, error } = useBarang();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const filteredBarang = filterBarang(items, search, selectedCategory);
    const {currentItems, currentPage, totalPages, nextPage, prevPage} = usePagination(filteredBarang, 5)

    // Tampilkan pesan loading atau error
    if (loading) return <p className='text-center py-5'>Memuat Data Gudang...</p>
    if (error) return <p className='text-center py-5 text-danger'>Terjadi kesalahan {error}</p>

    return(
        <Container className='py-4'>
            <h2 className='mb-4 fw-bold'>Stock Gudang Pusat</h2>
            <Row className='mb-3'>
                <Col md={8}>
                    <SearchBar search={search} onSearchChange={setSearch} />
                </Col>
                <Col md={4}>
                    <KategoriFilter items={items} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory}/>
                </Col>
            </Row>
            <StockTable items={currentItems} />
            <Pagination currentPage={currentPage} totalPages={totalPages} onPrev={prevPage} onNext={nextPage} />
        </Container>
    )
}