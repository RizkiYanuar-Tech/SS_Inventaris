import { Card } from 'react-bootstrap'
import { TriangleAlert } from 'lucide-react'

// function untuk pengechekan jumlah barang
function StatusBadge({jumlahStock, reStock}){
    if(jumlahStock == 0){
        return <TriangleAlert size={20} className='text-danger ms-2' />;
    } else if (jumlahStock <= reStock){
        return <TriangleAlert size={20} className='text-warning ms-2' />;
    }
    return null;
}

const getCategoryColors = (kategori) => {
    const namaKategori = kategori ? kategori.toLowerCase().trim() : ''; 
    if (namaKategori === 'minuman') {
        return { bg: '#e7f1ff', text: '#0c63e4', border: '#b6d4fe' }; 
    } else if (namaKategori === 'makanan') {
        return { bg: '#fff3cd', text: '#856404', border: '#ffe8a1' }; 
    } else if (namaKategori === 'bahan baku') {
        return { bg: '#d1e7dd', text: '#0f5132', border: '#a3cfbb' }; 
    }
    return { bg: '#f8f9fa', text: '#6c757d', border: '#dee2e6' };
};

export default function StockTable({ items }) {
    if (!items || items.length === 0) {
        return (
            <p className="text-center text-muted py-5">
                Belum ada stock apapun di gudang
            </p>
        );
    }

    return (
        <div>
            {items.map((item) => {
                console.log("Kategori barang", `${item.kategori}`)
                const colors = getCategoryColors(item.kategori);
                return (
                    <Card 
                        key={item.id} 
                        className="mb-3 shadow-sm border-0"
                        style={{ borderRadius: '12px' }}
                    >
                        <Card.Header className="d-flex justify-content-between align-items-center bg-white border-bottom-0 pt-3 pb-0">
                            <span className="text-muted small fw-medium">ID: {item.id}</span> 
                            <span 
                                className="badge rounded-pill px-3 py-1"
                                style={{
                                    backgroundColor: colors.bg,
                                    color: colors.text,
                                    border: `1px solid ${colors.border}`
                                }}
                            >
                                {item.kategori}
                            </span>
                        </Card.Header>

                        <Card.Body className="d-flex justify-content-between align-items-center py-3">
                            <div>
                                <div className="d-flex align-items-center">
                                    <span className="fw-bold fs-5 mb-0">
                                        {item.nama} {item.varian && <span className="fw-normal text-muted fs-6"> - {item.varian}</span>}
                                    </span>
                                    <StatusBadge jumlahStock={item.stock} reStock={item.threshold} />
                                </div>
                            </div>
                            <div className="text-end">
                                <span className="fw-bolder fs-3 text-dark">{item.stock}</span>
                                <span className="ms-1 text-muted small">{item.satuanEceran}</span>
                            </div>
                        </Card.Body>

                        <Card.Footer 
                            className="bg-light border-top-0 pt-2 pb-3" 
                            style={{ borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}
                        >
                            <span className="text-muted small">
                                <span className="fw-semibold">Batas Restock:</span> {item.threshold} {item.satuanEceran}
                            </span>
                        </Card.Footer>
                    </Card>
                );
            })}
        </div>
    );
}