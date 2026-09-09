import QrScanner from '../components/scan/QrScanner'
import ConfirmCard from '../components/scan/ConfirmCard'
import VerifikasiKirim from '../components/scan/VerifikasiKirim'
import { useScanner } from '../hooks/useScanner'
import { Container, Alert} from 'react-bootstrap'
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function ScanPage(){
    const location = useLocation();
    const modeVerifikasi = location.state?.mode === 'verifikasi' ? location.state?.idKirim : null;
    const { 
        phase,
        pendingCode,
        scannedId,
        dataBarang,
        status,
        handleScanSuccess,
        handleConfirm,
        reset,
        showResult 
    } = useScanner()

    const navigate = useNavigate()

    if (modeVerifikasi) return <VerifikasiKirim idKirim={modeVerifikasi} />;

    useEffect(() => {
        if (phase === 'new'){
            navigate(`/tambah-barang?id=${scannedId}`)
        } else if (phase === 'found') {
            navigate(`/transaksi-barang?id=${scannedId}`, {state: { barang: dataBarang }})
        }
    }, [phase, scannedId, dataBarang, navigate])

    return (
        <Container className='py-4' style={{ maxWidth: '480px' }}>
            <h2 className='mb-4 fw-bold text-center'>Scan Barang</h2>

            {phase === 'scanning' && (
                <QrScanner 
                    onScanSuccess={handleScanSuccess} 
                    onError={(err) => showResult('error', 'Gagal akses kamera' + err)}
                />
            )}

            {/* Menampilkan pesan error atau info */}
            {status && (
                <Alert variant={status.type === 'error' ? 'danger': status.type} className='text-center'>
                    {status.text}
                </Alert>
            )}

            {/* Fase 2: Konfirmasi angka barcode yang terbaca */}
            {phase === 'confirming' && <ConfirmCard code={pendingCode} onConfirm={handleConfirm}></ConfirmCard>}
            
            {/* Fase 3: Menunggu respon dari database */}
            {phase === 'checking' && <p className='text-center text-muted'>Memeriksa Barang...</p>}
            

            {phase !== 'scanning' && phase !== 'new' && phase !== 'found' && (
                <button className='btn btn-outline-secondary w-100' onClick={reset}>
                    Scan Ulang
                </button>
            )}
        
        </Container>
    )
}