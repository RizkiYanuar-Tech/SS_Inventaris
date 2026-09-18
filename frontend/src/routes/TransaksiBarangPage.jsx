import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Container, Button} from 'react-bootstrap';
import FormBarangSudahAda from '../components/scan/FormBarangSudahAda'
import ResultModal from '../components/common/ResultModal';
import { prosesTransaksi } from '../api/client';

export default function TransaksiBarangPage(){
    const location = useLocation();
    const navigate = useNavigate();
    const dataBarang = location.state?.barang;
    const [status, setStatus] = useState(null);
    const [modal, setModal] = useState({ show: false, sukses: false, pesan: '' });

    function closeModal(){
        const sukses = modal.sukses;
        setModal(m => ({ ...m, show: false }));
        if (sukses) navigate('/input');
    }

    if (!dataBarang) {
        return (
            <Container className="py-5 text-center" style={{ maxWidth: '480px'}}>
                <p className="mb-4">
                    Data barang tidak ditemukan. Silakan cari dari halaman Input.
                </p>
                <Button variant="secondary" onClick={() => navigate('/input')}>
                    Kembali ke Halaman Input
                </Button>
            </Container>
        );
    }

    async function handleSubmit(jenis, jumlah, satuanInput, totalBayar, vendor){
        setStatus({type: 'info', text: 'Memproses transaksi...'});

        try{
            const result = await prosesTransaksi({
                id: dataBarang.id,
                jenis,
                jumlah,
                satuanInput,
                totalBayar,
                vendor
            });

            if (result && result.sukses){
                setStatus(null);
                setModal({ show: true, sukses: true, pesan: result.pesan || 'Transaksi berhasil dicatat!' });
            } else{
                setStatus(null);
                setModal({ show: true, sukses: false, pesan: result.pesan || 'Gagal memproses transaksi.' });
            }
        } catch(error){
            setStatus(null);
            setModal({ show: true, sukses: false, pesan: error.message || 'Terjadi kesalahan jaringan.' });
        }
    }

    return (
        <Container className="py-4" style={{ maxWidth: '480px'}}>
            <h2 className="mb-4 fw-bold text-center">Transaksi Barang</h2>

            {status && (
                <p className="text-center text-muted small">
                    {status.text}
                </p>
            )}

            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={closeModal} />

            <FormBarangSudahAda 
                barang={dataBarang} 
                onSubmit={handleSubmit} 
            />
            
            <Button 
                variant="outline-secondary" 
                className="w-100 mt-2" 
                onClick={() => navigate('/input')}
            >
                Batal & Kembali
            </Button>
        </Container>
    );
}