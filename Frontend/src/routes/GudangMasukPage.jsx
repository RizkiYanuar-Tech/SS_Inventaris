import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { Eye, EyeOff } from 'lucide-react';
import { masukGudang, sesiGudang } from '../api/client';

// Login gudang tahap 1 (tanpa BottomNav): 1 kredensial bersama.
export default function GudangMasukPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const tujuan = location.state?.from || '/homepage';
    const [password, setPassword] = useState('');
    const [lihat, setLihat] = useState(false);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        sesiGudang().then(() => navigate(tujuan, { replace: true })).catch(() => {});
        // eslint-disable-next-line
    }, []);

    async function submit(e) {
        e?.preventDefault();
        if (!password) {
            setError('Isi password dulu.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await masukGudang(password);
            sessionStorage.setItem('gudang-masuk', '1');
            navigate(tujuan, { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Container className='py-5' style={{ maxWidth: '400px' }}>
            <h2 className='mb-1 fw-bold text-center'>Gudang</h2>
            <p className='text-center text-muted small mb-3'>Masuk untuk kelola pesanan & kiriman</p>
            <Card className='shadow-sm border-0'>
                <Card.Body>
                    <Form onSubmit={submit}>
                        <Form.Group className='mb-2'>
                            <Form.Label className='text-muted small mb-1'>Password</Form.Label>
                            <InputGroup>
                                <Form.Control type={lihat ? 'text' : 'password'} value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder='Password gudang' autoFocus />
                                <Button variant='outline-secondary' onClick={() => setLihat(v => !v)}
                                    aria-label={lihat ? 'Sembunyikan password' : 'Tampilkan password'}>
                                    {lihat ? <EyeOff size={16} /> : <Eye size={16} />}
                                </Button>
                            </InputGroup>
                        </Form.Group>
                        {error && <Alert variant='danger' className='small text-center py-2'>{error}</Alert>}
                        <Button variant='dark' className='w-100' disabled={busy} onClick={submit}>
                            {busy ? '...' : 'Masuk'}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
}
