import { useEffect, useState } from 'react'
import { Card, Form, Button } from 'react-bootstrap'
import { ArrowDownCircle, ArrowUpCircle, Minus, Plus } from 'lucide-react'
import { formatRibu, parseRibu } from '../../utils/formatRupiah'
import { fetchVendor } from '../../api/client'

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
    const [vendorId, setVendorId] = useState('')
    const [daftarVendor, setDaftarVendor] = useState([])

    useEffect(() => {
        fetchVendor().then(setDaftarVendor).catch(() => setDaftarVendor([]));
    }, []);

    const jumlahKonversi = Number(jumlah);

    const stockJadiMasuk = barang.stock + jumlahKonversi
    const stockJadiKeluar = barang.stock - jumlahKonversi
    const keluarTidakValid = !(jumlahKonversi > 0) || stockJadiKeluar < 0

    const avgLama = barang.hargaBarang != null ? Number(barang.hargaBarang) : null;
    const bayar = parseRibu(totalBayar);
    const avgBaru = (jumlahKonversi != null && jumlahKonversi > 0 && bayar > 0)
        ? hitungAvg(avgLama, barang.stock, bayar, jumlahKonversi)
        : null;

    const stepJumlah = (arah) => {
        const kini = Number(jumlah) || 0;
        setJumlah(Math.max(0, kini + arah));
    };

    return (
        <Card className="gd-input shadow-sm border-0 mb-3">
            <Card.Body className="p-0">
                {/* Zona 1: identitas + angka stock hero */}
                <div className="gd-input-head">
                    <div className="gd-input-eyebrow">
                        <span>{barang.kategori || 'Tanpa kategori'}</span>
                        <span className="gd-input-id">{barang.id}</span>
                    </div>
                    <div className="gd-input-nama">{barang.nama}{barang.varian && <span className="gd-input-varian"> — {barang.varian}</span>}</div>
                    <div className="gd-input-stockrow">
                        <span className="gd-input-stocklabel">Stock</span>
                        <span className="gd-input-stock">{barang.stock} <small>{satuanStock}</small></span>
                    </div>
                    <div className="gd-input-avg">
                        {avgLama != null ? `Avg Rp ${rpAvg(avgLama)}` : 'Avg pertama (belum ada harga)'}
                    </div>
                </div>

                {/* Zona 2: stepper jumlah */}
                <div className="gd-input-zona">
                    <Form.Label className="gd-input-label">Jumlah ({satuanStock})</Form.Label>
                    <div className="gd-input-stepper">
                        <Button variant="light" className="gd-input-step" aria-label="Kurangi jumlah"
                            disabled={!(jumlahKonversi > 0)} onClick={() => stepJumlah(-1)}>
                            <Minus size={20} />
                        </Button>
                        <Form.Control
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={jumlah}
                            aria-label={`Jumlah dalam ${satuanStock}`}
                            onChange={(e) => setJumlah(e.target.value)}
                        />
                        <Button variant="light" className="gd-input-step" aria-label="Tambah jumlah"
                            onClick={() => stepJumlah(1)}>
                            <Plus size={20} />
                        </Button>
                    </div>
                </div>

                {/* Zona 3: bayar + vendor */}
                <div className="gd-input-zona">
                    <Form.Label className="gd-input-label">
                        Total bayar (Rp) * <span className="fst-italic">— wajib tiap Barang Masuk</span>
                    </Form.Label>
                    <Form.Control
                        type="text"
                        inputMode="numeric"
                        value={formatRibu(totalBayar)}
                        onChange={(e) => setTotalBayar(e.target.value.replace(/\D/g, ''))}
                        placeholder={barang.hargaBarang != null ? `Avg saat ini Rp ${Number(barang.hargaBarang).toLocaleString('id-ID')}` : 'Wajib untuk harga average pertama'}
                    />
                    {avgBaru != null && (
                        <p className="gd-input-avgbaru">
                            Avg baru → Rp {rpAvg(avgBaru)} (dari {avgLama != null ? `Rp ${rpAvg(avgLama)}` : 'avg pertama'})
                        </p>
                    )}
                    <Form.Label className="gd-input-label mt-3">
                        Vendor <span className="fst-italic">— opsional, khusus Barang Masuk</span>
                    </Form.Label>
                    <Form.Select size="sm" value={vendorId} onChange={(e) => setVendorId(e.target.value)}
                        aria-label="Vendor (opsional)">
                        <option value="">— Tanpa vendor —</option>
                        {daftarVendor.map(v => (
                            <option key={v.id} value={v.id}>{v.nama}</option>
                        ))}
                    </Form.Select>
                </div>

                {/* Cap keputusan */}
                <div className="gd-input-cap">
                    <Button
                        className="gd-input-capbtn gd-input-masuk"
                        disabled={!(jumlahKonversi > 0)}
                        onClick={() => onSubmit('Masuk', jumlahKonversi, satuanStock, parseRibu(totalBayar), vendorId ? Number(vendorId) : undefined)}
                    >
                        <span className="gd-input-captitle"><ArrowDownCircle size={18} /> Barang Masuk</span>
                        <span className="gd-input-capsub">jadi {stockJadiMasuk} {satuanStock}</span>
                    </Button>
                    <Button
                        className="gd-input-capbtn gd-input-keluar"
                        disabled={keluarTidakValid}
                        onClick={() => onSubmit('Keluar', jumlahKonversi, satuanStock)}
                    >
                        <span className="gd-input-captitle"><ArrowUpCircle size={18} /> Barang Keluar</span>
                        <span className="gd-input-capsub">
                            {keluarTidakValid ? 'stock tidak cukup' : `jadi ${stockJadiKeluar} ${satuanStock}`}
                        </span>
                    </Button>
                </div>
            </Card.Body>
        </Card>
    )
}
