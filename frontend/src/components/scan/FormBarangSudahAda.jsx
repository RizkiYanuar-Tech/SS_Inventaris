import { useState } from 'react'
import { Card, Form, Button } from 'react-bootstrap'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { formatRibu, parseRibu } from '../../utils/formatRupiah'

// hitungAvg: avgBaru = (totalLama*avgLama + totalBayar) / (totalLama + qtyMasuk eceran).
function hitungAvg(avgLama, totalLama, totalBayar, qtyMasuk) {
    const t = Number(totalLama) || 0;
    const q = Number(qtyMasuk) || 0;
    const bayar = Number(totalBayar) || 0;
    if (!(q > 0) || !(bayar > 0) || (t + q) <= 0) return null;
    const nilaiLama = avgLama != null && avgLama !== '' ? t * Number(avgLama) : 0;
    return (nilaiLama + bayar) / (t + q);
}
// Ribuan id-ID bulat untuk tampil (formatRibu merusak desimal avg, khusus input).
const rpAvg = (n) => n == null ? '-' : Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 });

export default function FormBarangSudahAda({ barang, onSubmit }) {
    const satuanStock = barang.satuanEceran || 'pcs';
    const [jumlah, setJumlah] = useState(1)
    const [totalBayar, setTotalBayar] = useState('')

    const jumlahKonversi = Number(jumlah);

    const keterangan = `${jumlahKonversi} ${satuanStock}`;

    const stockJadiMasuk = barang.stock + jumlahKonversi
    const stockJadiKeluar = barang.stock - jumlahKonversi
    const keluarTidakValid = !(jumlahKonversi > 0) || stockJadiKeluar < 0

    const avgLama = barang.hargaBarang != null ? Number(barang.hargaBarang) : null;
    const bayar = parseRibu(totalBayar);
    const avgBaru = (jumlahKonversi != null && jumlahKonversi > 0 && bayar > 0)
        ? hitungAvg(avgLama, barang.stock, bayar, jumlahKonversi)
        : null;

    return (
        <Card className="shadow-sm border-0 mb-3" style={{ borderRadius: '12px' }}>
            <Card.Body>
                <p className="fw-bold mb-1">Barang ditemukan</p>
                <p className="text-muted small mb-1">
                    ID: {barang.id} | {barang.nama} {barang.varian && `- ${barang.varian}`} ({barang.kategori}) | Stock saat ini: {barang.stock} {satuanStock}
                </p>
                <p className="text-muted small mb-3">
                    Harga kini (avg): {avgLama != null ? `Rp ${rpAvg(avgLama)}` : 'Avg pertama (belum ada harga)'}
                </p>

                <Form.Group className="mb-3">
                    <Form.Label className="text-muted small mb-1">Jumlah ({satuanStock})</Form.Label>
                    <Form.Control
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={jumlah}
                        onChange={(e) => setJumlah(e.target.value)}
                    />
                </Form.Group>

                <p className="text-center fw-semibold text-muted small mb-3">{keterangan}</p>

                <Form.Group className="mb-3">
                    <Form.Label className="text-muted small mb-1">
                        Total bayar (Rp) * <span className="fst-italic">— wajib tiap Barang Masuk</span>
                    </Form.Label>
                    <Form.Control
                        type="text"
                        inputMode="numeric"
                        value={formatRibu(totalBayar)}
                        onChange={(e) => setTotalBayar(e.target.value.replace(/\D/g, ''))}
                        placeholder={barang.hargaBarang != null ? `Avg saat ini Rp ${Number(barang.hargaBarang).toLocaleString('id-ID')}` : 'Wajib untuk harga average pertama'}
                    />
                </Form.Group>

                {avgBaru != null && (
                    <p className="text-center fw-semibold small mb-3">
                        Avg baru → Rp {rpAvg(avgBaru)} (dari {avgLama != null ? `Rp ${rpAvg(avgLama)}` : 'avg pertama'})
                    </p>
                )}

                <div className="d-grid gap-2">
                    <Button
                        variant="success"
                        disabled={!(jumlahKonversi > 0)}
                        className="d-flex align-items-center justify-content-center gap-2"
                        onClick={() => onSubmit('Masuk', jumlahKonversi, satuanStock, parseRibu(totalBayar))}
                    >
                        <ArrowDownCircle size={18} /> Barang Masuk
                        <span className="small">(jadi {stockJadiMasuk} {satuanStock})</span>
                    </Button>

                    <Button
                        variant="danger"
                        disabled={keluarTidakValid}
                        className="d-flex align-items-center justify-content-center gap-2"
                        onClick={() => onSubmit('Keluar', jumlahKonversi, satuanStock)}
                    >
                        <ArrowUpCircle size={18} /> Barang Keluar
                        <span className="small">
                            {keluarTidakValid ? '(stock tidak cukup)' : `(jadi ${stockJadiKeluar} ${satuanStock}${avgLama != null ? ` • avg tetap Rp ${rpAvg(avgLama)}` : ''})`}
                        </span>
                    </Button>
                </div>
            </Card.Body>
        </Card>
    )
}
