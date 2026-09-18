import { Card } from 'react-bootstrap';
import { CircleArrowDown, CircleArrowUp } from 'lucide-react';

export default function TransaksiTable({ items }) {
    if (!items || items.length === 0) {
        return <p className='text-center text-muted py-4'>Belum Ada Transaksi.</p>;        
    }
    
    return (
        <div className='hub-grid'>
            {items.map((item, index) => {
                const isMasuk = item.jenis === "Masuk";
                const Icon = isMasuk ? CircleArrowDown : CircleArrowUp;
                const iconColor = isMasuk ? '#198754' : '#dc3545';
                const textColorClass = isMasuk ? 'text-success' : 'text-danger';

                return (
                    <Card
                        key={index}
                        bg='light'
                        className='mb-3 shadow-sm border-0'
                        style={{ borderRadius: "12px" }}
                    >
                        <Card.Header
                            className='d-flex justify-content-between align-items-center bg-white text-muted border-bottom-0 pt-3 flex-wrap gap-1'
                        >
                            <div className='d-flex align-items-center' style={{ minWidth: 0 }}>
                                <Icon size={18} color={iconColor} className='me-2 flex-shrink-0' />
                                <span className={`fw-semibold ${textColorClass}`}>
                                    {item.jenis}
                                </span>
                            </div>
                            <span className='small ms-auto text-end'>{item.timestamp}</span>
                        </Card.Header>

                        <Card.Body className='py-3'>
                            {item.idKirim && (
                                <div className='mb-1'>
                                    <span className='small fw-semibold' style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', background: '#f1f3f5', borderRadius: 6, padding: '1px 8px' }}>
                                        {item.idKirim}
                                    </span>
                                </div>
                            )}
                            {item.keterangan && (() => {
                                const isVendor = String(item.keterangan).startsWith('Vendor:');
                                return (
                                <div className='mb-1'>
                                    <span className='small fw-semibold' style={isVendor
                                        ? { background: '#d1e7dd', color: '#0f5132', borderRadius: 6, padding: '1px 8px' }
                                        : { background: '#e7f1ff', color: '#0c63e4', borderRadius: 6, padding: '1px 8px' }}>
                                        {item.keterangan}
                                    </span>
                                </div>
                                );
                            })()}
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <span className='d-block text-muted small mb-1'>
                                        {item.kategori}
                                    </span>
                                    <span className='fw-bold fs-5'>
                                        {item.nama} 
                                        {item.varian && (
                                            <span className='fw-normal text-muted fs-6'> - {item.varian}</span>
                                        )}
                                    </span>
                                </div>
                                <div className='text-end'>
                                    <span className='d-block text-muted small mb-1'>Kuantitas</span>
                                    <span className='fw-bold fs-5'>{item.jumlah}</span>
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                );
            })}
        </div>
    );
}