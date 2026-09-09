import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Badge, Alert } from 'react-bootstrap';
import QrScanner from './QrScanner';
import ConfirmCard from './ConfirmCard';
import ResultModal from '../common/ResultModal';
import { fetchPengiriman, cekBarang, tandaiDikirim } from '../../api/client';

// Mode verifikasi kiriman di halaman Scan: pindai tiap line (cek keberadaan di database
// + cocok dengan kiriman), tanpa gerakkan stock. Lengkap semua -> Tandai Dikirim aktif.
export default function VerifikasiKirim({ idKirim }) {
    const navigate = useNavigate();
    const [kirim, setKirim] = useState(null);
    const [error, setError] = useState(null);
    const [terverifikasi, setTerverifikasi] = useState({}); // {itemId: 'scan'|'manual'}
    const [pending, setPending] = useState(null); // kode menunggu konfirmasi
    const [caraPending, setCaraPending] = useState('scan');
    const [status, setStatus] = useState(null);
    const [ketik, setKetik] = useState('');
    const [busy, setBusy] = useState(false);
    const [hasil, setHasil] = useState(null); // {token}
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
    const jmlOk = lines.filter(l => terverifikasi[l.id]).length;
    const lengkap = lines.length > 0 && jmlOk === lines.length;

    async function prosesKode(kode, cara) {
        const id = String(kode || '').trim();
        if (!id) return;
        setStatus({ type: 'info', text: `Memeriksa ID: ${id} ...` });
        try {
            const found = await cekBarang(id);
            if (!found.ditemukan) {
                setStatus({ type: 'error', text: `ID ${id} tidak ada di database.` });
                return;
            }
            const line = lines.find(l => String(l.id) === id);
            if (!line) {
                setStatus({ type: 'error', text: `${found.nama} ada di database, tapi bukan bagian kiriman ini.` });
                return;
            }
            if (terverifikasi[line.id]) {
                setStatus({ type: 'warning', text: `${line.nama} sudah terverifikasi.` });
                return;
            }
            setTerverifikasi(t => ({ ...t, [line.id]: cara }));
            setStatus({ type: 'success', text: `${line.nama} ✓ (${cara}, ${line.jumlahKirim} pcs)` });
        } catch (e) {
            setStatus({ type: 'error', text: e.message });
        } finally {
            setPending(null);
        }
    }

    function salinTeks(teks) {
        navigator.clipboard?.writeText(teks).catch(() => {});
        setModal({ show: true, sukses: true, pesan: 'Disalin.' });
    }

    async function selesaikan() {
        setBusy(true);
        try {
            const res = await tandaiDikirim(idKirim, lines.map(l => ({ id: l.id, cara: terverifikasi[l.id] })));
            setHasil({ token: res.token });
            setModal({ show: true, sukses: true, pesan: res.pesan });
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
        const url = `${window.location.origin}/terima/${hasil.token}`;
        return (
            <Container className='py-4' style={{ maxWidth: '480px' }}>
                <Alert variant='success' className='text-center'>DIKIRIM — link berita acara aktif.</Alert>
                <p className='small text-break bg-light p-2 rounded'>{url}</p>
                <div className='d-flex gap-2 mb-2'>
                    <Button variant='outline-primary' className='flex-fill' onClick={() => salinTeks(url)}>Salin Link</Button>
                    <a className='btn btn-success flex-fill' target='_blank' rel='noreferrer'
                        href={`https://wa.me/?text=${encodeURIComponent(`Paket ${idKirim} dikirim. Cek & lapor terima: ${url}`)}`}>Kirim WA</a>
                </div>
                <Button variant='secondary' className='w-100' onClick={() => navigate('/pesanan')}>Kembali ke Pesanan</Button>
                <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={() => setModal(m => ({ ...m, show: false }))} />
            </Container>
        );
    }

    return (
        <Container className='py-4' style={{ maxWidth: '480px' }}>
            <h2 className='mb-1 fw-bold text-center'>Pindai Kiriman</h2>
            <p className='text-center text-muted small mb-3'>{kirim.idKirim} • {kirim.outlet} • {jmlOk}/{lines.length} terpindai</p>

            {lines.map(l => (
                <Card key={l.id} className='shadow-sm border-0 mb-2'>
                    <Card.Body className='py-2 d-flex justify-content-between align-items-center'>
                        <div>
                            <div className='fw-medium small'>{l.nama}</div>
                            <div className='text-muted' style={{ fontSize: '11px' }}>{l.jumlahKirim} pcs</div>
                        </div>
                        {terverifikasi[l.id]
                            ? <Badge bg='success'>✓ {terverifikasi[l.id]}</Badge>
                            : <Badge bg='secondary'>belum</Badge>}
                    </Card.Body>
                </Card>
            ))}

            {status && <Alert variant={status.type === 'error' ? 'danger' : status.type} className='text-center small py-2'>{status.text}</Alert>}

            {pending ? (
                <ConfirmCard code={pending} onConfirm={() => prosesKode(pending, caraPending)} />
            ) : (
                <QrScanner onScanSuccess={(t) => { setCaraPending('scan'); setPending(t.trim()); }} onError={(e) => setStatus({ type: 'error', text: 'Gagal akses kamera: ' + e })} />
            )}

            <Form.Group className='d-flex gap-2 mt-2'>
                <Form.Control size='sm' value={ketik} onChange={e => setKetik(e.target.value)} placeholder='Ketik ID manual (label rusak)' />
                <Button size='sm' variant='outline-secondary' onClick={() => { if (ketik.trim()) { setCaraPending('manual'); prosesKode(ketik, 'manual'); setKetik(''); } }}>
                    Cek
                </Button>
            </Form.Group>

            <Button variant='primary' className='w-100 mt-3' disabled={!lengkap || busy} onClick={selesaikan}>
                {busy ? '...' : lengkap ? 'Selesai → Tandai Dikirim' : `Pindai semua line dulu (${jmlOk}/${lines.length})`}
            </Button>
            <Button variant='outline-secondary' className='w-100 mt-2' onClick={() => navigate('/pesanan')}>Batal & Kembali</Button>
            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={() => setModal(m => ({ ...m, show: false }))} />
        </Container>
    );
}
