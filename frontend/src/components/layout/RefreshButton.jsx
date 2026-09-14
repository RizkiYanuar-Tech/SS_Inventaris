import { Button } from 'react-bootstrap'
import { RotateCw } from 'lucide-react'

// Tombol segarkan: kembaran tombol Keluar (outline + ikon + label, 1 bahasa visual).
// Hover/tekan ikut perilaku outline Bootstrap (isi penuh saat hover) — tanpa CSS/state kustom.
// Putaran ikon via keyframe `.putar` di index.css.
export default function RefreshButton({onClick, loading}){
    return (
        <Button variant='outline-primary' size='sm' onClick={onClick} disabled={loading}
            className='d-flex align-items-center gap-1 fw-semibold'>
            <RotateCw size={16} className={loading ? 'putar' : ''} /> {loading ? 'Memuat...' : 'Refresh'}
        </Button>
    )
}
