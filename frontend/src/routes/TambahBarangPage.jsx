import { useState } from 'react';
import { useSearchParams, useNavigate} from 'react-router-dom';
import { Container, Button } from 'react-bootstrap';
import FormBarangBaru from '../components/scan/FormBarangBaru';
import ResultModal from '../components/common/ResultModal';
import { tambahBarangBaru } from '../api/client';

export default function TambahBarangPage(){
    // Ambil ID dari URL
    const [searchParams] = useSearchParams();
    const idUrl = searchParams.get('id');
    const navigate = useNavigate();

    const [status, setStatus] = useState(null);
    const [modal, setModal] = useState({ show: false, sukses: false, pesan: '' });

    function closeModal(){
        const sukses = modal.sukses;
        setModal(m => ({ ...m, show: false }));
        if (sukses) navigate('/scan');
    }

    if (!idUrl){
        return(
            <Container
                className='py-5 text-center'
                style={{ maxWidth: '480px'}}
            >
                <p className='mb-4'>
                    ID Barang tidak ditemukan, Silakan lakukan scan terlebih dahulu.
                </p>
                <Button variant='secondary' onClick={() => navigate('/scan')}>
                    Kembali ke Halaman Scan Barcode
                </Button>
            </Container>
        );
    }

    async function handleSubmitBarangBaru(payload){
        setStatus({type: 'info', text: 'Menyimpan data....'});
        try{
            const result = await tambahBarangBaru(payload);
            if (result && result.sukses){
                setStatus(null);
                setModal({ show: true, sukses: true, pesan: result.pesan || "Barang berhasil ditambahkan!" });
            }else{
                setStatus(null);
                setModal({ show: true, sukses: false, pesan: result.pesan || "Gagal menyimpan barang" });
            }
        } catch (error) {
            setStatus(null);
            setModal({ show: true, sukses: false, pesan: error.message || 'Terjadi kesalahan jaringan' });
        }
    }

    return (
        <Container 
            className='py-4'
            style={{ maxWidth: '480px'}}
        >
            <h2 className='mb-4 fw-bold text-center'>
                Tambah Barang
            </h2>

            {status && (
                <p className='text-center text-muted small'>
                    {status.text}
                </p>
            )}

            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={closeModal} />

            <FormBarangBaru id={idUrl} onSubmit={handleSubmitBarangBaru} />
            <Button
                variant='outline-secondary'
                className='w-100 mt-2'
                onClick={() => navigate('/scan')}
            >
                Batal & Kembali
            </Button>
        </Container>
    );
}
