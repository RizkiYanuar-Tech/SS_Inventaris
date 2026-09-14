import { useState, useMemo } from 'react'
import { Card, Form, Button } from 'react-bootstrap'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { formatRibu, parseRibu } from '../../utils/formatRupiah'

// Faktor terstruktur: 1 <satuanGudang> = <isiPerGudang> <satuan> (sama dgn backend).
const ALIAS_SATUAN = {
    gram: 'gr', grams: 'gr', g: 'gr', kilo: 'kg', kilogram: 'kg',
    litre: 'liter', ltr: 'liter', l: 'liter',
    pieces: 'pcs', piece: 'pcs', pc: 'pcs',
};
const normSatuan = (u) => ALIAS_SATUAN[String(u || '').trim().toLowerCase()] || String(u || '').trim().toLowerCase();
const FAKTOR_METRIK = { 'kg>gr': 1000, 'gr>kg': 0.001, 'liter>ml': 1000, 'ml>liter': 0.001 };
function faktorKonversi(isiPerGudang, gudangItem, dari, ke) {
    const d = normSatuan(dari);
    const k = normSatuan(ke);
    if (!d || d === k) return 1;
    if (FAKTOR_METRIK[`${d}>${k}`]) return FAKTOR_METRIK[`${d}>${k}`];
    const n = Number(isiPerGudang);
    if (d === normSatuan(gudangItem) && Number.isFinite(n) && n > 0) return n;
    return null;
}

export default function FormBarangSudahAda({ barang, onSubmit }) {
    const satuanStock = barang.satuanEceran || 'Pcs';
    const satuanGudang = barang.satuanGrosir || null;
    const [jumlah, setJumlah] = useState(1)
    const [satuanInput, setSatuanInput] = useState(satuanStock)
    const [totalBayar, setTotalBayar] = useState('')

    const faktor = useMemo(
        () => faktorKonversi(barang.isiPerGudang, satuanGudang, satuanInput, satuanStock),
        [barang.isiPerGudang, satuanGudang, satuanInput, satuanStock]
    );
    const jumlahKonversi = faktor == null ? null : Number(jumlah) * faktor;

    const keterangan = jumlahKonversi == null
        ? `Tak ada konversi ${satuanInput} → ${satuanStock}. Lengkapi Isi per Satuan Gudang.`
        : faktor !== 1
            ? `${jumlah} ${satuanInput} = ${jumlahKonversi} ${satuanStock}`
            : `${jumlahKonversi} ${satuanStock}`;

    const stockJadiMasuk = jumlahKonversi == null ? null : barang.stock + jumlahKonversi
    const stockJadiKeluar = jumlahKonversi == null ? null : barang.stock - jumlahKonversi
    const keluarTidakValid = jumlahKonversi == null || stockJadiKeluar < 0

    return (
        <Card className="shadow-sm border-0 mb-3" style={{ borderRadius: '12px' }}>
            <Card.Body>
                <p className="fw-bold mb-1">Barang ditemukan</p>
                <p className="text-muted small mb-3">
                    ID: {barang.id} | {barang.nama} {barang.varian && `- ${barang.varian}`} ({barang.kategori}) | Stock saat ini: {barang.stock} {satuanStock}
                </p>

                <Form.Group className="mb-3">
                    <Form.Label className="text-muted small mb-1">Satuan Input</Form.Label>
                    <Form.Select value={satuanInput} onChange={(e) => setSatuanInput(e.target.value)}>
                        <option value={satuanStock}>{satuanStock}</option>
                        {satuanGudang && satuanGudang.toLowerCase() !== satuanStock.toLowerCase() && (
                            <option value={satuanGudang}>{satuanGudang}</option>
                        )}
                    </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className="text-muted small mb-1">Jumlah</Form.Label>
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

                <div className="d-grid gap-2">
                    <Button
                        variant="success"
                        disabled={jumlahKonversi == null}
                        className="d-flex align-items-center justify-content-center gap-2"
                        onClick={() => onSubmit('Masuk', jumlah, satuanInput, parseRibu(totalBayar))}
                    >
                        <ArrowDownCircle size={18} /> Barang Masuk
                        <span className="small">(jadi {stockJadiMasuk} {satuanStock})</span>
                    </Button>

                    <Button
                        variant="danger"
                        disabled={keluarTidakValid}
                        className="d-flex align-items-center justify-content-center gap-2"
                        onClick={() => onSubmit('Keluar', jumlah, satuanInput)}
                    >
                        <ArrowUpCircle size={18} /> Barang Keluar
                        <span className="small">
                            {keluarTidakValid ? '(stock tidak cukup)' : `(jadi ${stockJadiKeluar} ${satuanStock})`}
                        </span>
                    </Button>
                </div>
            </Card.Body>
        </Card>
    )
}
