import { useParams } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import TerimaForm from '../components/outlet/TerimaForm';

// Halaman publik surat jalan (tanpa nav) — fallback/cadangan; cara utama via Tab Surat Jalan di /pesan.
export default function TerimaBarangPage() {
    const { token } = useParams();
    return (
        <Container className='py-4' style={{ maxWidth: '480px' }}>
            <TerimaForm token={token} />
        </Container>
    );
}
