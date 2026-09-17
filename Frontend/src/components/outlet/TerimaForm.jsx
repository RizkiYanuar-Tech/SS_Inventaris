import { useEffect, useState } from 'react';
import { Card, Form, Button, Badge, Alert } from 'react-bootstrap';
import { lihatPengiriman, konfirmasiTerima } from '../../api/client';
import { uploadFotoBukti } from '../../utils/fotoBukti';

// Isi surat jalan reusable — dipakai Tab Surat Jalan (/pesan) + halaman /terima/:token.
// token = uuid kiriman sekali pakai; onSelesai opsional (misal refresh riwayat setelah lapor).
export default function TerimaForm({ token, onSelesai }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [laporan, setLaporan] = useState({}); // {index: {ceklis, jumlahTerima, keterangan}}
    const [nama, setNama] = useState('');
    const [foto, setFoto] = useState(null);
    const [saving, setSaving] = useState(false);
    const [hasil, setHasil] = useState(null);

    useEffect(() => {
        if (!token) return;
        setData(null); setError(null); setHasil(null); setLaporan({}); setNama(''); setFoto(null);
        lihatPengiriman(token).then(setData).catch(e => setError(e.message));
    }, [token]);

    // Keyed by POSISI index — ID bisa kembar ('-'); keyed by id menularkan ceklis ke semua line se-ID.
    function setLap(i, patch) {
        setLaporan(prev => ({ ...prev, [i]: { ceklis: false, jumlahTerima: '', keterangan: '', ...(prev[i] || {}), ...patch } }));
    }

    async function handleSubmit() {
        if (!nama.trim()) {
            setHasil({ sukses: false, pesan: 'Nama penerima wajib diisi.' });
            return;
        }
        setSaving(true);
        try {
            const fotoUrl = foto ? await uploadFotoBukti(data.idKirim, 'terima', foto) : null;
            const res = await konfirmasiTerima(token, {
                namaPenerima: nama.trim(),
                fotoTerima: fotoUrl,
                items: data.items.map((it, i) => ({
                    ceklis: laporan[i]?.ceklis === true,
                    jumlahTerima: laporan[i]?.ceklis ? it.jumlahKirim : laporan[i]?.jumlahTerima,
                    keterangan: laporan[i]?.keterangan || ''
                }))
            });
            setHasil({ sukses: true, pesan: res.pesan + (foto && !fotoUrl ? ' (foto gagal diupload)' : ''), status: res.status });
            // Ambil ulang dari server agar tampilan terkunci bawa ceklis/jumlahTerima asli
            const segar = await lihatPengiriman(token);
            setData(segar);
            onSelesai?.(res);
        } catch (e) {
            setHasil({ sukses: false, pesan: e.message });
        } finally {
            setSaving(false);
        }
    }

    if (error) return <Alert variant='danger' className='text-center small'>{error}</Alert>;
    if (!data) return <p className='text-center py-3 text-muted small'>Memuat surat jalan...</p>;

    // Sudah lapor -> ringkasan terkunci
    if (data.sudahDikonfirmasi) {
        return (
            <div>
                <h2 className='mb-1 fw-bold text-center'>Laporan Terkirim</h2>
                <p className='text-center text-muted small mb-3'>{data.idKirim} • {data.outlet}</p>
                <Alert variant={data.status === 'DITERIMA' ? 'success' : 'warning'} className='text-center'>
                    Status: <strong>{data.status}</strong>
                    {data.namaPenerima && <> • Penerima: {data.namaPenerima}</>}
                    {data.tglTerima && <> • {data.tglTerima}</>}
                </Alert>
                {(data.fotoKirim || data.fotoTerima) && (
                    <div className='d-flex gap-2 mb-2'>
                        {data.fotoKirim && <a href={data.fotoKirim} target='_blank' rel='noreferrer' className='flex-fill'>
                            <img src={data.fotoKirim} alt='Paket dari gudang' className='w-100 rounded' />
                            <div className='text-muted text-center' style={{ fontSize: '11px' }}>Paket dari gudang</div></a>}
                        {data.fotoTerima && <a href={data.fotoTerima} target='_blank' rel='noreferrer' className='flex-fill'>
                            <img src={data.fotoTerima} alt='Diterima outlet' className='w-100 rounded' />
                            <div className='text-muted text-center' style={{ fontSize: '11px' }}>Diterima outlet</div></a>}
                    </div>
                )}
                {data.items.map((it, i) => (
                    <Card key={`${it.id}#${i}`} className='shadow-sm border-0 mb-2'>
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
            </div>
        );
    }

    return (
        <div>
            <h2 className='mb-1 fw-bold text-center'>Cek Barang Datang</h2>
            <p className='text-center text-muted small mb-2'>{data.idKirim} • {data.outlet} • {data.tglKirim}</p>

            {hasil && !hasil.sukses && <Alert variant='danger' className='text-center small'>{hasil.pesan}</Alert>}

            {data.fotoKirim && (
                <a href={data.fotoKirim} target='_blank' rel='noreferrer' className='d-block mb-2'>
                    <img src={data.fotoKirim} alt='Paket dari gudang' className='w-100 rounded' />
                    <div className='text-muted text-center' style={{ fontSize: '11px' }}>Foto paket dari gudang — bandingkan dengan fisik</div>
                </a>
            )}

            {data.items.map((it, i) => {
                const lap = laporan[i] || {};
                return (
                    <Card key={`${it.id}#${i}`} className='shadow-sm border-0 mb-2'>
                        <Card.Body>
                            <Form.Check
                                type='checkbox'
                                label={<strong style={{ fontSize: '15px', lineHeight: 1.35 }}>{it.nama} — {it.jumlahKirim} pcs</strong>}
                                checked={lap.ceklis === true}
                                onChange={e => setLap(i, { ceklis: e.target.checked })}
                            />
                            {!lap.ceklis && (
                                <div className='mt-2'>
                                    <Form.Control
                                        type='number' inputMode='numeric' min='0' size='sm' className='mb-1'
                                        placeholder={`Jumlah diterima (dikirim ${it.jumlahKirim})`}
                                        value={lap.jumlahTerima || ''}
                                        onChange={e => setLap(i, { jumlahTerima: e.target.value })}
                                    />
                                    <Form.Control
                                        size='sm' placeholder='Keterangan (wajib jika tidak sesuai, cth: 2 pecah)'
                                        value={lap.keterangan || ''}
                                        onChange={e => setLap(i, { keterangan: e.target.value })}
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

            <Form.Group className='mb-3'>
                <Form.Label className='text-muted small mb-1'>Foto barang diterima (opsional)</Form.Label>
                <Form.Control type='file' accept='image/*' capture='environment'
                    onChange={e => setFoto(e.target.files?.[0] || null)} />
                {foto && <div className='small text-success mt-1'>✓ {foto.name}</div>}
            </Form.Group>

            <Button variant='success' className='w-100' disabled={saving} onClick={handleSubmit}>
                {saving ? 'Mengirim...' : 'Kirim Laporan Terima'}
            </Button>
            <p className='text-center text-muted mt-2' style={{ fontSize: '11px' }}>
                Ceklis jika sesuai. Jika tidak sesuai, isi jumlah + keterangan.
            </p>
        </div>
    );
}
