import { useMemo, useState } from 'react'
import { Card, Button, Form, Modal, Collapse, Alert } from 'react-bootstrap'
import { TriangleAlert } from 'lucide-react'
import { ubahBarang, hapusBarang } from '../../api/client'
import { opsiKategori } from '../../utils/kategori'
import InputKategori from './InputKategori'
import ResultModal from '../common/ResultModal'

// function untuk pengechekan jumlah barang
function statusInfo(jumlahStock, reStock) {
    if (jumlahStock == 0) return { kata: 'Habis', warna: '#dc3545' };
    if (jumlahStock <= reStock) return { kata: 'Menipis', warna: '#b8860b' };
    return { kata: 'Aman', warna: '#198754' };
}

function StatusBadge({jumlahStock, reStock}){
    const st = statusInfo(jumlahStock, reStock);
    if (st.kata === 'Aman') return null;
    return (
        <span className='d-inline-flex align-items-center gap-1 ms-2 small fw-semibold' style={{ color: st.warna }}>
            <TriangleAlert size={16} />{st.kata}
        </span>
    );
}

// Strip ukur stock-vs-batas: satu-satunya elemen khas kartu ini (rel kiri tiket outlet dipakai di sini horizontal).
function StripUkur({ jumlahStock, reStock }) {
    const pct = reStock > 0 ? Math.max(0, Math.min(100, (Number(jumlahStock) / Number(reStock)) * 100)) : (jumlahStock > 0 ? 100 : 0);
    const warna = jumlahStock == 0 ? '#dc3545' : jumlahStock <= reStock ? '#ffc107' : '#198754';
    return (
        <div className='mt-2' role='img' aria-label={`Stock ${pct.toFixed(0)} persen dari batas`}>
            <div style={{ height: 6, borderRadius: 3, background: '#e9ecef', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: warna }} />
            </div>
        </div>
    );
}

const getCategoryColors = (kategori) => {
    const namaKategori = kategori ? kategori.toLowerCase().trim() : '';
    if (namaKategori === 'basah') {
        return { bg: '#e7f1ff', text: '#0c63e4', border: '#b6d4fe' };
    } else if (namaKategori === 'kering') {
        return { bg: '#d1e7dd', text: '#0f5132', border: '#a3cfbb' };
    } else if (namaKategori === 'chemical') {
        return { bg: '#fff1e0', text: '#9a3412', border: '#f3c89b' };
    } else if (namaKategori === 'dairy') {
        return { bg: '#fffdf7', text: '#857a5b', border: '#e6ddc8' };
    } else if (namaKategori === 'kemasan') {
        return { bg: '#e9ecef', text: '#495057', border: '#ced4da' };
    }
    return { bg: '#f8f9fa', text: '#6c757d', border: '#dee2e6' };
};

// Form edit metadata (ID + stock terkunci; satuan butuh ketik-ulang konfirmasi)
function EditForm({ item, opsiKategoriList, onSelesai }) {
    const [f, setF] = useState({
        nama: item.nama || '', varian: item.varian || '', kategori: item.kategori || '',
        divisi: item.divisi || '', restock: item.threshold ?? '', keterangan: item.keterangan || '',
        istilah: item.istilah || '', satuanGudang: item.satuanGrosir || '', isi: item.isiPerGrosir ?? '',
        harga: item.hargaBarang ?? '', satuanBaru: '', konfirmasiSatuan: '',
    });
    const [saving, setSaving] = useState(false);
    const [tampilSatuan, setTampilSatuan] = useState(false);
    const [err, setErr] = useState('');
    const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }));
    const gantiSatuan = f.satuanBaru.trim() !== '' && f.satuanBaru.trim() !== (item.satuanEceran || 'Pcs');

    async function submit() {
        setErr('');
        const payload = {
            nama: f.nama, varian: f.varian, kategori: f.kategori, divisi: f.divisi,
            restock: f.restock === '' ? undefined : Number(f.restock),
            keterangan: f.keterangan, istilah: f.istilah,
            satuanGudang: f.satuanGudang, isiPerGudang: f.isi,
            hargaBarang: f.harga === '' ? null : Number(f.harga),
        };
        if (gantiSatuan) {
            payload.satuanEceran = f.satuanBaru.trim();
            payload.konfirmasiSatuan = f.konfirmasiSatuan;
        }
        setSaving(true);
        try {
            const res = await ubahBarang(item.id, payload);
            onSelesai(true, res.pesan);
        } catch (e) {
            setErr(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className='mt-2 pt-2' style={{ borderTop: '1px dashed #dee2e6' }}>
            {err && <Alert variant='danger' className='small py-2'>{err}</Alert>}
            <Form.Group className='mb-2'>
                <Form.Label className='text-muted small mb-1'>Nama Barang</Form.Label>
                <Form.Control size='sm' value={f.nama} onChange={set('nama')} />
            </Form.Group>
            <Form.Group className='mb-2'>
                <Form.Label className='text-muted small mb-1'>Varian</Form.Label>
                <Form.Control size='sm' value={f.varian} onChange={set('varian')} />
            </Form.Group>
            <div className='d-flex gap-2'>
                <Form.Group className='mb-2 flex-fill'>
                    <Form.Label className='text-muted small mb-1'>Divisi</Form.Label>
                    <Form.Control size='sm' value={f.divisi} onChange={set('divisi')} />
                </Form.Group>
                <Form.Group className='mb-2 flex-fill'>
                    <Form.Label className='text-muted small mb-1'>Batas Restock</Form.Label>
                    <Form.Control size='sm' type='number' inputMode='numeric' min='0' value={f.restock} onChange={set('restock')} />
                </Form.Group>
            </div>
                <Form.Group className='mb-2'>
                    <Form.Label className='text-muted small mb-1'>Kategori</Form.Label>
                    <InputKategori size='sm' value={f.kategori}
                        onChange={(v) => setF(prev => ({ ...prev, kategori: v }))} opsi={opsiKategoriList} />
                </Form.Group>
            <Form.Group className='mb-2'>
                <Form.Label className='text-muted small mb-1'>Istilah Data Resep (alias)</Form.Label>
                <Form.Control size='sm' value={f.istilah} onChange={set('istilah')} />
            </Form.Group>
            <div className='d-flex gap-2'>
                <Form.Group className='mb-2 flex-fill'>
                    <Form.Label className='text-muted small mb-1'>Satuan Gudang</Form.Label>
                    <Form.Control size='sm' value={f.satuanGudang} onChange={set('satuanGudang')} placeholder='cth: pack' />
                </Form.Group>
                <Form.Group className='mb-2 flex-fill'>
                    <Form.Label className='text-muted small mb-1'>Isi per Gudang</Form.Label>
                    <Form.Control size='sm' type='number' inputMode='numeric' min='0' value={f.isi} onChange={set('isi')} placeholder='cth: 24' />
                </Form.Group>
                <Form.Group className='mb-2 flex-fill'>
                    <Form.Label className='text-muted small mb-1'>Harga (Rp)</Form.Label>
                    <Form.Control size='sm' type='number' inputMode='numeric' min='0' value={f.harga} onChange={set('harga')} />
                </Form.Group>
            </div>
            <div className='mb-2'>
                <span className='text-muted small'>Satuan Eceran: <strong>{item.satuanEceran}</strong></span>
                {' • '}
                <Button variant='link' size='sm' className='p-0 text-decoration-none'
                    aria-expanded={tampilSatuan}
                    onClick={() => setTampilSatuan(v => !v)}>
                    {tampilSatuan ? 'tutup ganti satuan' : 'ganti satuan'}
                </Button>
            </div>
            {tampilSatuan && (
            <div className='p-2 rounded mb-2' style={{ background: '#fff8e1', border: '1px solid #f0e2b6' }}>
                <div className='d-flex gap-2'>
                    <Form.Control size='sm' value={f.satuanBaru} onChange={set('satuanBaru')} placeholder='Satuan baru' aria-label='Satuan baru' />
                    <Form.Control size='sm' value={f.konfirmasiSatuan} onChange={set('konfirmasiSatuan')} placeholder='Ketik ulang persis' aria-label='Ketik ulang satuan baru' />
                </div>
                {gantiSatuan && <div className='small text-danger mt-1'>Stock {item.stock} ikut berubah makna menjadi {f.satuanBaru.trim()}.</div>}
            </div>
            )}
            <Button size='sm' variant='primary' className='w-100' disabled={saving} onClick={submit}>
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
        </div>
    );
}

export default function StockTable({ items, semua, onBerubah }) {
    const [editId, setEditId] = useState(null);
    const [hapus, setHapus] = useState(null); // item yang dikonfirmasi hapus
    const [busy, setBusy] = useState(false);
    const [modal, setModal] = useState({ show: false, sukses: false, pesan: '' });
    const daftarKategori = useMemo(() => opsiKategori(semua || items), [semua, items]);

    if (!items || items.length === 0) {
        return (
            <p className="text-center text-muted py-5">
                Belum ada stock apapun di gudang
            </p>
        );
    }

    async function jalankanHapus() {
        if (!hapus) return;
        setBusy(true);
        try {
            const res = await hapusBarang(hapus.id);
            setHapus(null);
            setModal({ show: true, sukses: true, pesan: res.pesan });
            onBerubah?.();
        } catch (e) {
            setHapus(null);
            setModal({ show: true, sukses: false, pesan: e.message });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="hub-grid">
            {items.map((item, i) => {
                const colors = getCategoryColors(item.kategori);
                const buka = editId === `${item.id}#${i}`;
                return (
                    <Card
                        key={`${item.id}#${i}`}
                        className="mb-3 shadow-sm border-0"
                        style={{ borderRadius: '12px' }}
                    >
                        <Card.Header className="d-flex justify-content-between align-items-center bg-white border-bottom-0 pt-3 pb-0">
                            <span className="text-muted small fw-medium" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{item.id}</span>
                            <span
                                className="badge rounded-pill px-3 py-1"
                                style={{
                                    backgroundColor: colors.bg,
                                    color: colors.text,
                                    border: `1px solid ${colors.border}`
                                }}
                            >
                                {item.kategori}
                            </span>
                        </Card.Header>

                        <Card.Body className="py-3">
                            <div className="d-flex align-items-center flex-wrap gap-1">
                                <span className="fw-bold fs-5 mb-0">
                                    {item.nama} {item.varian && <span className="fw-normal text-muted fs-6"> - {item.varian}</span>}
                                </span>
                                <StatusBadge jumlahStock={item.stock} reStock={item.threshold} />
                            </div>
                            <div className="d-flex align-items-baseline gap-1 mt-1">
                                <span className="fw-bolder fs-3 text-dark" style={{ fontVariantNumeric: 'tabular-nums' }}>{item.stock}</span>
                                <span className="text-muted small">{item.satuanEceran}</span>
                                <span className="text-muted small ms-auto">dari batas {item.threshold} {item.satuanEceran}</span>
                            </div>
                            <StripUkur jumlahStock={item.stock} reStock={item.threshold} />
                            <Collapse in={buka}>
                                <div>
                                    {buka && <EditForm item={item} opsiKategoriList={daftarKategori} onSelesai={(s, pesan) => {
                                        setEditId(null);
                                        setModal({ show: true, sukses: s, pesan });
                                        if (s) onBerubah?.();
                                    }} />}
                                </div>
                            </Collapse>
                        </Card.Body>

                        <Card.Footer
                            className="bg-light border-top-0 pt-2 pb-3"
                            style={{ borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}
                        >
                            <div className="d-flex gap-3 small">
                                <span className="text-muted">
                                    <span className="fw-semibold">Batas:</span> {item.threshold} {item.satuanEceran}
                                </span>
                                {item.divisi && (
                                    <span className="text-muted">
                                        <span className="fw-semibold">Divisi:</span> {item.divisi}
                                    </span>
                                )}
                            </div>
                            {(item.satuanGrosir || item.keterangan) && (
                                <div className="text-muted small mt-1">
                                    {item.satuanGrosir && (
                                        <span>
                                            <span className="fw-semibold">Kemasan:</span> 1 {item.satuanGrosir}
                                            {item.isiPerGrosir != null ? ` = ${item.isiPerGrosir} ${item.satuanEceran}` : ' (isi belum diisi)'}
                                            {item.keterangan ? ' • ' : ''}
                                        </span>
                                    )}
                                    {item.keterangan && <span>{item.keterangan}</span>}
                                </div>
                            )}
                            <div className="d-flex gap-2 mt-2">
                                <Button size="sm" variant="primary" className="flex-fill"
                                    onClick={() => setEditId(buka ? null : `${item.id}#${i}`)}>
                                    {buka ? 'Tutup' : 'Edit'}
                                </Button>
                                <Button size="sm" variant="outline-danger" className="flex-fill"
                                    onClick={() => setHapus(item)}>
                                    Hapus
                                </Button>
                            </div>
                        </Card.Footer>
                    </Card>
                );
            })}

            <Modal show={!!hapus} onHide={() => !busy && setHapus(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className="fs-6">Hapus barang ini?</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {hapus && (
                        <div className="small">
                            <div className="d-flex gap-2 py-1" style={{ borderBottom: '1px solid #f1f3f5' }}>
                                <span className="text-muted" style={{ width: 90 }}>Nama</span>
                                <strong>{hapus.nama}</strong>
                            </div>
                            <div className="d-flex gap-2 py-1" style={{ borderBottom: '1px solid #f1f3f5' }}>
                                <span className="text-muted" style={{ width: 90 }}>Varian</span>
                                <span>{hapus.varian || '-'}</span>
                            </div>
                            <div className="d-flex gap-2 py-1" style={{ borderBottom: '1px solid #f1f3f5' }}>
                                <span className="text-muted" style={{ width: 90 }}>Kategori</span>
                                <span>{hapus.kategori || '-'}</span>
                            </div>
                            <div className="d-flex gap-2 py-1">
                                <span className="text-muted" style={{ width: 90 }}>Jumlah</span>
                                <span>{hapus.stock} {hapus.satuanEceran}</span>
                            </div>
                            <Alert variant="warning" className="small mt-2 mb-0">
                                Riwayat transaksi milik barang ini ikut terhapus. Batal bila barang pernah dipakai order.
                            </Alert>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" disabled={busy} onClick={() => setHapus(null)}>
                        Batalkan
                    </Button>
                    <Button variant="danger" disabled={busy} onClick={jalankanHapus}>
                        {busy ? '...' : 'Ya, hapus'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <ResultModal show={modal.show} sukses={modal.sukses} pesan={modal.pesan} onClose={() => setModal(m => ({ ...m, show: false }))} />
        </div>
    );
}
