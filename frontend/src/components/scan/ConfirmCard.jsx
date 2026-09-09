import { Card, Button } from 'react-bootstrap'
import { Check } from 'lucide-react'

export default function ConfirmCard({ code, onConfirm}){
    return (
        <Card className='shadow-sm border-0 mb-3' style={{ borderRadius: '12px' }}>
            <Card.Body className='text-center'>
                <p className='text-muted small mb-1'>Kode Barcode:</p>
                <p className='fw-bold fs-5 mb-3'>{code}</p>
                <Button variant="success" onClick={onConfirm} className='d-flex align-items-center justify-content-center gap-2 mx-auto'>
                    <Check size={18} /> Ya
                </Button>
            </Card.Body>
        </Card>
    )
}