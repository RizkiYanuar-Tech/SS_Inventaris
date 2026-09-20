import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Badge, Alert } from 'react-bootstrap';
import ResultModal from '../common/ResultModal';
import { fetchPengiriman, tandaiDikirim } from '../../api/client';
import { uploadFotoBukti } from '../../utils/fotoBukti';

// Verifikasi kiriman: ceklis per baris (tap kartu) + 1 foto paket.
// Keyed by POSISI index — ID bisa kembar ('-'). Tanpa ketik ID, tanpa kamera scan.
// Foto dianjurkan (jadi foto_kirim berita acara); gagal upload / tanpa foto tak blokir Tandai.
export default function ManualVerifikasiKirim({ idKirim }) {
    const navigate = useNavigate();
    const [kirim, setKirim] = useState(null);
    const [error, setError] = useState(null);
    const [ceklis, setCeklis] = useState({}); // {index: true}
    const [foto, setFoto] = useState(null);
    const [tanpaFoto, setTanpaFoto] = useState(false);
    const [busy, setBusy] = useState(false);
    const [hasil, setHasil] = useState(null);
    const [modal, setModal] = useState({ show: false, sukses: false, pesan: '' });

    useEffect(() => {
        fetchPengiriman()
            .then(all => {
                const k = all.find(x => x.idKirim === idKirim);
                if (!k) setError('Kiriman tidak ditemukan.');
                else if (k.status !== 'SIAP KIRIM') setError(`Status ${k.status}, hanya SIAP KIRIM yang bisa diverifikasi.`);
                else setKirim(k);
            })
            .catch(e => setError(e.message));
    }, [idKirim]);

    const lines = kirim?.items || [];
    const jmlOk = lines.filter((_, i) => ceklis[i]).length;
    const lengkap = lines.length > 0 && jmlOk === lines.length;
    const bolehKirim = lengkap && (foto || tanpaFoto) && !busy;

    function toggle(i) {
        setCeklis(c => ({ ...c, [i]: !c[i] }));
    }

    async function selesaikan() {
        setBusy(true);
        try {
            let fotoUrl = null;
            let fotoNote = '';
            if (foto) {
                setModal({ show: true, sukses: true, pesan: 'Mengupload foto...' });
                fotoUrl = await uploadFotoBukti(idKirim, 'kirim', foto);
                if (!fotoUrl) fotoNote = ' (foto gagal diupload, lanjut tanpa foto)';
            }
            const res = await tandaiDikirim(idKirim, lines.map((_, i) => ({ index: i, cara: 'ceklis' })), fotoUrl);
            setHasil({ ok: true });
            setModal({ show: true, sukses: true, pesan: res.pesan + fotoNote });
        } catch (e) {
            setModal({ show: true, sukses: false, pesan: e.message });
        } finally {
            setBusy(false);
        }
    }

    if (error) return <Container className='py-5 text-center' style={{ maxWidth: '480px' }}>
        <Alert variant='danger'>{error}</Alert>
        <Button variant='secondary' onClick={() => navigate('/pesanan')}>Kembali</Button>
    </Container>;
    if (!kirim) return <p className='text-center py-5 text-muted'>Memuat kiriman...</p>;

    if (hasil) {
        return (
            <Container className='py-4' style={{ maxWidth: '480px' }}>
                <Alert variant='success' className='text-center'>DIKIRIM — outlet cek Tab Surat Jalan di link pesanannya.</Alert>
                <Button variant='secondary' className='w-100' onClick={() => navigate('/pesanan')}>Kembali ke Pesanan</Button>
                <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={() => setModal(m => ({ ...m, show: false }))} />
            </Container>
        );
    }

    return (
        <Container className='py-4' style={{ maxWidth: '480px' }}>
            <h2 className='mb-1 fw-bold text-center'>Verifikasi Kiriman</h2>
            <p className='text-center text-muted small mb-3'>{kirim.idKirim} • {kirim.outlet} • {jmlOk}/{lines.length} diceklis</p>
            <p className='text-center text-muted small'>Tap kartu saat barang sudah masuk paket.</p>

            {lines.map((l, i) => (
                <Card key={`${l.id}#${i}`} className='shadow-sm border-0 mb-2'
                    onClick={() => toggle(i)} style={{ cursor: 'pointer' }}>
                    <Card.Body className='py-2 d-flex justify-content-between align-items-center'>
                        <div>
                            <div className='fw-medium small'>{l.nama}{l.varian ? ` • ${l.varian}` : ''}</div>
                            <div className='text-muted' style={{ fontSize: '11px' }}>{l.jumlahKirim} pcs</div>
                        </div>
                        {ceklis[i]
                            ? <Badge bg='success'>✓ masuk paket</Badge>
                            : <Badge bg='secondary'>belum</Badge>}
                    </Card.Body>
                </Card>
            ))}

            <Form.Group className='mt-3'>
                <Form.Label className='text-muted small mb-1'>Foto paket (jadi bukti kirim di berita acara)</Form.Label>
                <Form.Control type='file' accept='image/*' capture='environment'
                    onChange={e => { setFoto(e.target.files?.[0] || null); if (e.target.files?.[0]) setTanpaFoto(false); }} />
                {foto && <div className='small text-success mt-1'>✓ {foto.name}</div>}
                {!foto && (
                    <Form.Check type='checkbox' className='mt-2 small'
                        label='Lanjut tanpa foto'
                        checked={tanpaFoto} onChange={e => setTanpaFoto(e.target.checked)} />
                )}
            </Form.Group>

            <Button variant='primary' className='w-100 mt-3' disabled={!bolehKirim} onClick={selesaikan}>
                {busy ? '...' : lengkap ? (foto || tanpaFoto ? 'Selesai → Tandai Dikirim' : 'Pilih foto / centang tanpa foto') : `Ceklis semua dulu (${jmlOk}/${lines.length})`}
            </Button>
            <Button variant='outline-secondary' className='w-100 mt-2' onClick={() => navigate('/pesanan')}>Batal & Kembali</Button>
            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={() => setModal(m => ({ ...m, show: false }))} />
        </Container>
    );
}
