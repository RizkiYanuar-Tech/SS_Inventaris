import { Button } from 'react-bootstrap'
import { CircleChevronLeft, CircleChevronRight } from 'lucide-react'

export default function Pagination({currentPage, totalPages, onPrev, onNext }){
    if(totalPages <= 1){
        return null;
    }

    return(
        <div className='d-flex justify-content-between align-items-center mt-4'>
            <Button
                variant='outline-dark'
                onClick={onPrev}
                disabled={currentPage === 1}
                className='d-flex align-items-center rounded-pill px-3'
            >
            <CircleChevronLeft size={18} className='me-1' /> Prev
            </Button>
        
            <span className='text-muted small fw-medium'>
                Halaman {currentPage} dari {totalPages}
            </span>

            <Button
                variant='outline-dark'
                onClick={onNext}
                disabled={currentPage === totalPages}
                className='d-flex align-items-center rounded-pill px-3'
            >
            <CircleChevronRight size={18} className='me-1' /> Next
            </Button>
        </div>
    );
}