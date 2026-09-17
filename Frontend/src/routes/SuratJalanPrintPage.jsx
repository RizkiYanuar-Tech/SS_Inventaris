import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Button, Alert, Table } from 'react-bootstrap';
import { lihatSuratJalan } from '../api/client';

const rp = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(n) || 0);

// Surat jalan cetak (F8, format spreadsheet): A4 landscape, tombol print manual.
export default function SuratJalanPrintPage() {
    const { idKirim } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        lihatSuratJalan(idKirim).then(setData).catch(e => setError(e.message));
        // eslint-disable-next-line
    }, [idKirim]);

    if (error) return <Container className='py-5 text-center'><Alert variant='danger'>{error}</Alert></Container>;
    if (!data) return <p className='text-center py-5 text-muted'>Memuat surat jalan...</p>;

    return (
        <Container className='py-4 surat-jalan'>
            <div className='d-flex justify-content-between align-items-center mb-3 no-print'>
                <strong className='small text-muted'>{data.idKirim}</strong>
                <Button size='sm' variant='primary' onClick={() => window.print()}>Print / Simpan PDF</Button>
            </div>

            <h2 className='text-center fw-bold mb-3' style={{ fontSize: '18px' }}>
                SURAT JALAN - {String(data.outlet || '').toUpperCase()}
            </h2>

            <div className='d-flex justify-content-between mb-3 sj-info'>
                <table className='sj-box'>
                    <tbody>
                        <tr><th colSpan={2}>Tanggal</th></tr>
                        <tr><td>Pemesan</td><td>Pengiriman</td></tr>
                        <tr><td>{data.tglPesan}</td><td>{data.tglKirim}</td></tr>
                    </tbody>
                </table>
                <table className='sj-box'>
                    <tbody>
                        <tr><th>Barang</th><td rowSpan={2}>{data.outlet}</td></tr>
                        <tr><th>Outlet</th></tr>
                    </tbody>
                </table>
            </div>

            <Table bordered size='sm' className='sj-tabel mb-1'>
                <thead>
                    <tr>
                        <th rowSpan={2}>Outlet</th>
                        <th rowSpan={2}>Nama Barang</th>
                        <th rowSpan={2}>Note</th>
                        <th rowSpan={2}>Qty</th>
                        <th rowSpan={2}>Satuan</th>
                        <th rowSpan={2}>Harga satuan</th>
                        <th rowSpan={2}>Total Biaya</th>
                        <th colSpan={3}>Checklist</th>
                    </tr>
                    <tr>
                        <th>Procurement</th>
                        <th>Driver</th>
                        <th>Outlet</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items.map(it => (
                        <tr key={it.no} className={it.ditolak ? 'text-muted sj-coret' : ''}>
                            <td>{it.outlet}</td>
                            <td>{it.nama}</td>
                            <td>{it.note}</td>
                            <td className='text-end'>{it.qty}</td>
                            <td>{it.satuan}</td>
                            <td className='text-end'>{it.ditolak ? '-' : rp(it.harga)}</td>
                            <td className='text-end'>{it.ditolak ? '-' : rp(it.total)}</td>
                            <td />
                            <td />
                            <td />
                        </tr>
                    ))}
                    <tr className='fw-bold'>
                        <td colSpan={6} className='text-center'>GRAND TOTAL</td>
                        <td className='text-end'>{rp(data.grandTotal)}</td>
                        <td colSpan={3} />
                    </tr>
                </tbody>
            </Table>
            {data.items.some(it => it.ditolak) && (
                <div className='small text-muted'>* dicoret = ditolak gudang (tidak dikirim, tidak dihitung).</div>
            )}
            {data.adaTanpaHarga && (
                <div className='small text-muted mb-2'>* ada item belum ada harga (dihitung 0).</div>
            )}

            <div className='d-flex justify-content-around text-center mt-4'>
                <div>Penerima<br /><br /><br />( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
                <div>PIC Pengirim<br /><br /><br />( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
            </div>
        </Container>
    );
}
