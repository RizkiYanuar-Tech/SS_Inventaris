import { useState } from 'react';
import { Card, Button, Badge, Collapse } from 'react-bootstrap';

// Warna rel kiri = warna badge yang sudah ada (tanpa warna baru).
const REL = {
    'BARU': '#6c757d', 'DISETUJUI': '#0d6efd', 'DISETUJUI SEBAGIAN': '#ffc107',
    'SIAP KIRIM': '#6c757d', 'DIKIRIM': '#6f42c1', 'DITOLAK': '#dc3545',
    'DITERIMA': '#198754', 'DITERIMA SEBAGIAN': '#ffc107',
};
const WARNA = {
    'BARU': 'secondary', 'DISETUJUI': 'primary', 'DISETUJUI SEBAGIAN': 'warning',
    'DITOLAK': 'danger', 'DITERIMA': 'success', 'DITERIMA SEBAGIAN': 'warning',
};

export function BadgeStatus({ status }) {
    if (status === 'DIKIRIM') {
        return <Badge style={{ backgroundColor: '#6f42c1' }}>{status}</Badge>;
    }
    return <Badge bg={WARNA[status] || 'dark'}>{status}</Badge>;
}

// Pager mungil ‹n/m› — dipakai Tab Riwayat + Surat Jalan (5/halaman).
export function Pager({ hal, total, onHal }) {
    if (total <= 1) return null;
    return (
        <div className='d-flex justify-content-center align-items-center gap-2 mt-2'>
            <Button size='sm' variant='outline-secondary' disabled={hal <= 1}
                onClick={() => onHal(hal - 1)} aria-label='Halaman sebelumnya'>‹</Button>
            <span className='small text-muted' style={{ fontVariantNumeric: 'tabular-nums' }}>{hal}/{total}</span>
            <Button size='sm' variant='outline-secondary' disabled={hal >= total}
                onClick={() => onHal(hal + 1)} aria-label='Halaman berikutnya'>›</Button>
        </div>
    );
}

// Kalimat sisi-pengguna: apa yang terjadi + apa yang harus dilakukan.
function langkah(status) {
    switch (status) {
        case 'BARU': return 'Menunggu konfirmasi gudang.';
        case 'DISETUJUI':
        case 'DISETUJUI SEBAGIAN':
        case 'SIAP KIRIM': return 'Disiapkan gudang — tunggu paket dikirim.';
        case 'DIKIRIM': return 'Paket dikirim — isi surat jalan sekarang.';
        case 'DITERIMA':
        case 'DITERIMA SEBAGIAN': return 'Selesai — barang sudah diterima.';
        case 'DITOLAK': return 'Ditolak gudang — pesan ulang bila masih butuh.';
        default: return '';
    }
}

// Indeks tahap aktif di alur Pesan·Siapkan·Kirim·Terima (kontennya sekuens, jadi penanda urutan di sini justified).
function tahap(status) {
    if (status === 'BARU') return 0;
    if (status === 'DIKIRIM') return 2;
    if (status === 'DITERIMA' || status === 'DITERIMA SEBAGIAN') return 3;
    return 1; // DISETUJUI / SEBAGIAN / SIAP KIRIM
}

function Alur({ status }) {
    if (status === 'DITOLAK') {
        return (
            <div className='d-flex align-items-center gap-1 my-2' aria-label='Alur: dipesan lalu ditolak'>
                <span className='small'>● Pesan</span>
                <span className='flex-grow-1' style={{ borderTop: '2px solid #dc3545' }} />
                <span className='small fw-bold text-danger'>● Ditolak</span>
            </div>
        );
    }
    const judul = ['Pesan', 'Siapkan', 'Kirim', 'Terima'];
    const aktif = tahap(status);
    return (
        <div className='d-flex align-items-center my-2' aria-label={`Alur: tahap ${judul[aktif]}`}>
            {judul.map((j, i) => (
                <span key={j} className='d-flex align-items-center' style={{ flex: i < judul.length - 1 ? 1 : 'none' }}>
                    <span className={i <= aktif ? 'small fw-bold' : 'small text-muted'}>
                        {i <= aktif ? '●' : '○'} {j}
                    </span>
                    {i < judul.length - 1 && (
                        <span className='flex-grow-1 mx-1' style={{ borderTop: `2px solid ${i < aktif ? '#198754' : '#dee2e6'}` }} />
                    )}
                </span>
            ))}
        </div>
    );
}

function BarisItem({ it }) {
    const kanan = it.keputusan === 'TOLAK'
        ? <span className='text-danger small'>✕{it.keterangan ? ` ${it.keterangan}` : ''}</span>
        : it.qtyKirim != null
            ? <span className='text-success small'>✓ kirim {it.qtyKirim}</span>
            : <span className='text-muted small'>×{it.qtyPesan}</span>;
    return (
        <div className='d-flex justify-content-between gap-2 py-1' style={{ borderBottom: '1px solid #f1f3f5' }}>
            <span className='small text-truncate'>{it.nama}{it.varian ? ` • ${it.varian}` : ''} <span className='text-muted'>×{it.qtyPesan}</span></span>
            <span className='flex-shrink-0 text-end'>{kanan}</span>
        </div>
    );
}

// Kartu tiket pesanan — dipakai Tab Riwayat + Tab Surat Jalan.
// Props: pesanan (bentuk pesananKeJson), cta (tombol aksi), bawah (konten di bawah CTA, misal TerimaForm inline).
export default function TiketPesanan({ pesanan: r, cta, bawah }) {
    const [buka, setBuka] = useState(false);
    const status = String(r.status || '').trim();
    const items = r.items || [];
    const totalPcs = items.reduce((a, it) => a + (Number(it.qtyPesan) || 0), 0);
    const idRinci = `rinci-${r.idPesan}`;

    return (
        <Card className='shadow-sm border-0 mb-2' style={{ borderLeft: `4px solid ${REL[status] || '#dee2e6'}` }}>
            <Card.Body className='py-2'>
                <div className='d-flex justify-content-between align-items-center mb-1 gap-2'>
                    <strong className='small' style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{r.idPesan}</strong>
                    <BadgeStatus status={status} />
                </div>
                <div className='small fw-medium'>▸ {langkah(status)}</div>
                <Alur status={status} />
                <div style={{ fontSize: '12px' }}>
                    <div className='d-flex gap-2'><span className='text-muted flex-shrink-0' style={{ width: 88 }}>Dipesan</span><span>{r.tanggalPesan}</span></div>
                    <div className='d-flex gap-2'><span className='text-muted flex-shrink-0' style={{ width: 88 }}>Batch masuk</span><span>{r.batchMasuk}</span></div>
                    <div className='d-flex gap-2'><span className='text-muted flex-shrink-0' style={{ width: 88 }}>Rencana kirim</span><span>{r.rencanaKirim}</span></div>
                </div>
                {items.length > 0 && (
                    <div className='mt-1'>
                        <Button variant='link' size='sm' className='p-0 text-decoration-none'
                            aria-expanded={buka} aria-controls={idRinci}
                            onClick={() => setBuka(v => !v)}>
                            {buka ? '▾' : '▸'} {items.length} barang • {totalPcs} pcs
                        </Button>
                        <Collapse in={buka}>
                            <div id={idRinci}>
                                {items.map((it, i) => <BarisItem key={`${it.id}#${i}`} it={it} />)}
                            </div>
                        </Collapse>
                    </div>
                )}
                {(r.fotoKirim || r.fotoTerima) && (
                    <div className='d-flex gap-2 mt-2'>
                        {r.fotoKirim && <a href={r.fotoKirim} target='_blank' rel='noreferrer' className='flex-fill'>
                            <img src={r.fotoKirim} alt='Paket dari gudang' className='w-100 rounded' loading='lazy' />
                            <div className='text-muted text-center' style={{ fontSize: '11px' }}>Paket dari gudang</div></a>}
                        {r.fotoTerima && <a href={r.fotoTerima} target='_blank' rel='noreferrer' className='flex-fill'>
                            <img src={r.fotoTerima} alt='Diterima outlet' className='w-100 rounded' loading='lazy' />
                            <div className='text-muted text-center' style={{ fontSize: '11px' }}>Diterima outlet</div></a>}
                    </div>
                )}
                {cta && <div className='mt-2'>{cta}</div>}
                {bawah}
            </Card.Body>
        </Card>
    );
}
