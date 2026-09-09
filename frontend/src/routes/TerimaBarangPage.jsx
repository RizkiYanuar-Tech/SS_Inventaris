import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Card, Form, Button, Badge, Alert } from 'react-bootstrap';
import { lihatPengiriman, konfirmasiTerima } from '../api/client';

// Halaman publik outlet (tanpa nav): ceklis terima -> 1 tombol Kirim Laporan Terima.
export default function TerimaBarangPage() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [laporan, setLaporan] = useState({}); // {id: {ceklis, jumlahTerima, keterangan}}
    const [nama, setNama] = useState('');
    const [saving, setSaving] = useState(false);
    const [hasil, setHasil] = useState(null);

    useEffect(() => {
        lihatPengiriman(token).then(setData).catch(e => setError(e.message));
    }, [token]);

    function setLap(id, patch) {
        setLaporan(prev => ({ ...prev, [id]: { ceklis: false, jumlahTerima: '', keterangan: '', ...(prev[id] || {}), ...patch } }));
    }

    async function handleSubmit() {
        if (!nama.trim()) {
            setHasil({ sukses: false, pesan: 'Nama penerima wajib diisi.' });
            return;
        }
        setSaving(true);
        try {
            const res = await konfirmasiTerima(token, {
                namaPenerima: nama.trim(),
                items: data.items.map(it => ({
                    ceklis: laporan[it.id]?.ceklis === true,
                    jumlahTerima: laporan[it.id]?.ceklis ? it.jumlahKirim : laporan[it.id]?.jumlahTerima,
                    keterangan: laporan[it.id]?.keterangan || ''
                }))
            });
            setHasil({ sukses: true, pesan: res.pesan, status: res.status });
            // Ambil ulang dari server agar tampilan terkunci bawa ceklis/jumlahTerima asli
            const segar = await lihatPengiriman(token);
            setData(segar);
        } catch (e) {
            setHasil({ sukses: false, pesan: e.message });
        } finally {
            setSaving(false);
        }
    }

    if (error) return <Container className='py-5 text-center' style={{ maxWidth: '480px' }}><Alert variant='danger'>{error}</Alert></Container>;
    if (!data) return <p className='text-center py-5 text-muted'>Memuat...</p>;

    // Sudah lapor -> ringkasan terkunci
    if (data.sudahDikonfirmasi) {
        return (
            <Container className='py-4' style={{ maxWidth: '480px' }}>
                <h2 className='mb-1 fw-bold text-center'>Laporan Terkirim</h2>
                <p className='text-center text-muted small mb-3'>{data.idKirim} • {data.outlet}</p>
                <Alert variant={data.status === 'DITERIMA' ? 'success' : 'warning'} className='text-center'>
                    Status: <strong>{data.status}</strong>
                    {data.namaPenerima && <> • Penerima: {data.namaPenerima}</>}
                    {data.tglTerima && <> • {data.tglTerima}</>}
                </Alert>
                {data.items.map(it => (
                    <Card key={it.id} className='shadow-sm border-0 mb-2'>
                        <Card.Body className='py-2 d-flex justify-content-between align-items-center'>
                            <div>
                                <div className='fw-medium small'>{it.nama}</div>
                                <div className='text-muted' style={{ fontSize: '11px' }}>
                                    Dikirim {it.jumlahKirim}{it.jumlahTerima != null && <> → diterima {it.jumlahTerima}</>}
                                    {it.keterangan && <> • {it.keterangan}</>}
                                </div>
                            </div>
                            <Badge bg={it.ceklis ? 'success' : 'warning'}>{it.ceklis ? 'Sesuai' : 'Sebagian'}</Badge>
                        </Card.Body>
                    </Card>
                ))}
            </Container>
        );
    }

    return (
        <Container className='py-4' style={{ maxWidth: '480px' }}>
            <h2 className='mb-1 fw-bold text-center'>Cek Barang Datang</h2>
            <p className='text-center text-muted small mb-3'>{data.idKirim} • {data.outlet} • {data.tglKirim}</p>

            {hasil && !hasil.sukses && <Alert variant='danger' className='text-center small'>{hasil.pesan}</Alert>}

            {data.items.map(it => {
                const lap = laporan[it.id] || {};
                return (
                    <Card key={it.id} className='shadow-sm border-0 mb-2'>
                        <Card.Body>
                            <Form.Check
                                type='checkbox'
                                label={<strong className='small'>{it.nama} — {it.jumlahKirim} pcs</strong>}
                                checked={lap.ceklis === true}
                                onChange={e => setLap(it.id, { ceklis: e.target.checked })}
                            />
                            {!lap.ceklis && (
                                <div className='mt-2'>
                                    <Form.Control
                                        type='number' inputMode='numeric' min='0' size='sm' className='mb-1'
                                        placeholder={`Jumlah diterima (dikirim ${it.jumlahKirim})`}
                                        value={lap.jumlahTerima || ''}
                                        onChange={e => setLap(it.id, { jumlahTerima: e.target.value })}
                                    />
                                    <Form.Control
                                        size='sm' placeholder='Keterangan (wajib jika tidak sesuai, cth: 2 pecah)'
                                        value={lap.keterangan || ''}
                                        onChange={e => setLap(it.id, { keterangan: e.target.value })}
                                    />
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                );
            })}

            <Form.Group className='my-3'>
                <Form.Label className='text-muted small mb-1'>Nama Penerima (wajib)</Form.Label>
                <Form.Control value={nama} onChange={e => setNama(e.target.value)} placeholder='Nama jelas' />
            </Form.Group>

            <Button variant='success' className='w-100' disabled={saving} onClick={handleSubmit}>
                {saving ? 'Mengirim...' : 'Kirim Laporan Terima'}
            </Button>
            <p className='text-center text-muted mt-2' style={{ fontSize: '11px' }}>
                Ceklis jika sesuai. Jika tidak sesuai, isi jumlah + keterangan.
            </p>
        </Container>
    );
}
