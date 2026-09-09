import { useState, useMemo } from 'react'
import { Card, Form, Button } from 'react-bootstrap'
import {ArrowDownCircle, ArrowUpCircle} from 'lucide-react'

export default function FormBarangSudahAda({ barang, onSubmit }){
    const [jumlah, setJumlah] = useState(1)
    const [satuanInput, setSatuanInput] = useState(barang.satuanEceran)

    const jumlahKonversi = useMemo(() => {
        if(satuanInput === barang.satuanGrosir && barang.isiPerGrosir) {
            return Number(jumlah) * barang.isiPerGrosir
        }
        return Number(jumlah)
    }, [jumlah, satuanInput, barang])

    const keterangan = satuanInput === barang.satuanGrosir && barang.isiPerGrosir
    ? `${jumlah} ${barang.satuanGrosir} = ${jumlahKonversi} ${barang.satuanEceran}`
    : `${jumlahKonversi} ${barang.satuanEceran}`

    const stockJadiMasuk = barang.stock + jumlahKonversi
    const stockJadiKeluar = barang.stock - jumlahKonversi
    const keluarTidakValid = stockJadiKeluar < 0

    return (
        <Card className="shadow-sm border-0 mb-3" style={{ borderRadius: '12px' }}>
              <Card.Body>
                <p className="fw-bold mb-1">Barang ditemukan</p>
                <p className="text-muted small mb-3">
                  ID: {barang.id} | {barang.nama} {barang.varian && `- ${barang.varian}`} ({barang.kategori}) | Stock saat ini: {barang.stock} {barang.satuanEceran}
                </p>
        
                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small mb-1">Satuan Input</Form.Label>
                  <Form.Select value={satuanInput} onChange={(e) => setSatuanInput(e.target.value)}>
                    <option value={barang.satuanEceran}>{barang.satuanEceran}</option>
                    {barang.satuanGrosir && barang.isiPerGrosir && (
                      <option value={barang.satuanGrosir}>
                        {barang.satuanGrosir} (1 {barang.satuanGrosir} = {barang.isiPerGrosir} {barang.satuanEceran})
                      </option>
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
        
                <div className="d-grid gap-2">
                  <Button
                    variant="success"
                    className="d-flex align-items-center justify-content-center gap-2"
                    onClick={() => onSubmit('Masuk', jumlah, satuanInput)}
                  >
                    <ArrowDownCircle size={18} /> Barang Masuk
                    <span className="small">(jadi {stockJadiMasuk} {barang.satuanEceran})</span>
                  </Button>
        
                  <Button
                    variant="danger"
                    disabled={keluarTidakValid}
                    className="d-flex align-items-center justify-content-center gap-2"
                    onClick={() => onSubmit('Keluar', jumlah, satuanInput)}
                  >
                    <ArrowUpCircle size={18} /> Barang Keluar
                    <span className="small">
                      {keluarTidakValid ? '(stock tidak cukup)' : `(jadi ${stockJadiKeluar} ${barang.satuanEceran})`}
                    </span>
                  </Button>
                </div>
            </Card.Body>
        </Card>
    )
}