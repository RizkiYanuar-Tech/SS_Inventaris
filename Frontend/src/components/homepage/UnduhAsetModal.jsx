import { useMemo, useState } from 'react';
import { Modal, Button, Form, Table } from 'react-bootstrap';
import { hitungAsetPerTanggal, asetPerTanggalKeCsv } from '../../utils/asetPerTanggal';
import { barangKeCsv, unduhCsv } from '../../utils/unduhCsv';

// Modal unduh aset: preview (hanya barang bermutasi s/d H) + unduh kini/per-tanggal.
// Preview dan CSV pakai hitungan yang sama (hitungAsetPerTanggal).
export default function UnduhAsetModal({ show, onTutup, barang, transaksi }) {
    const hariIni = new Date().toISOString().slice(0, 10);
    const [tgl, setTgl] = useState(hariIni);

    const hasil = useMemo(
        () => hitungAsetPerTanggal(barang, transaksi, tgl || hariIni),
        [barang, transaksi, tgl, hariIni]);
    const tampil = hasil.rows.filter(r => r.adaMutasi);
    const sembunyi = hasil.rows.length - tampil.length;

    const rp = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(n) || 0);

    function unduhKini() {
        const ymd = hariIni.replace(/-/g, '');
        unduhCsv(`aset-inventory-${ymd}.csv`, barangKeCsv(barang));
    }

    function unduhTanggal() {
        if (!tgl) return;
        unduhCsv(`aset-inventory-${tgl.replace(/-/g, '')}-per-tanggal.csv`,
            asetPerTanggalKeCsv(barang, transaksi, tgl));
    }

    return (
        <Modal show={show} onHide={onTutup} size='lg' centered>
            <Modal.Header closeButton>
                <Modal.Title className='fs-6'>Unduh Aset (CSV)</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='d-flex gap-2 align-items-end mb-2'>
                    <Form.Group className='flex-fill'>
                        <Form.Label className='text-muted small mb-1'>Tanggal (posisi akhir hari itu, WIB)</Form.Label>
                        <Form.Control type='date' value={tgl} max={hariIni}
                            onChange={e => setTgl(e.target.value)} />
                    </Form.Group>
                    <Button variant='outline-primary' onClick={unduhTanggal} disabled={!tgl}>
                        Unduh per tanggal
                    </Button>
                    <Button variant='primary' onClick={unduhKini}>
                        Unduh kini
                    </Button>
                </div>
                <p className='small text-muted mb-2'>
                    Preview: {tampil.length} barang bermutasi s/d {tgl || hariIni}
                    {sembunyi > 0 && ` (+ ${sembunyi} tanpa mutasi disembunyikan)`}
                    {' • '}TOTAL Rp {rp(hasil.total)}
                </p>
                <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                    <Table striped bordered hover size='sm' className='mb-0'>
                        <thead>
                            <tr>
                                <th>Nama</th>
                                <th className='text-end'>Stock</th>
                                <th className='text-end'>Harga</th>
                                <th className='text-end'>Total</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tampil.map(r => (
                                <tr key={r.id}>
                                    <td>{r.nama}{r.merk ? ` - ${r.merk}` : ''}</td>
                                    <td className='text-end'>{r.stock} {r.satuan}</td>
                                    <td className='text-end'>{r.harga != null ? rp(r.harga) : '-'}</td>
                                    <td className='text-end'>{r.total != null ? rp(r.total) : '-'}</td>
                                    <td>{r.status}</td>
                                </tr>
                            ))}
                            {tampil.length === 0 && (
                                <tr><td colSpan={5} className='text-center text-muted'>
                                    Kosong (sebelum data pertama masuk).
                                </td></tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            </Modal.Body>
        </Modal>
    );
}
