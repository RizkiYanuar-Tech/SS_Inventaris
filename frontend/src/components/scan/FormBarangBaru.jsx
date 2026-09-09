import { useState, useMemo } from 'react';
import { Form, Button, Card } from 'react-bootstrap';
import { PackagePlus } from 'lucide-react';

export default function FormBarangBaru({id, onSubmit}){
    const [nama, setNama] = useState('')
    const [kategori, setKategori] = useState('')
    const [varian, setVarian] = useState('')
    const [satuanEceran, setSatuanEceran] = useState('pcs')
    const [satuanGrosir, setSatuanGrosir] = useState('')
    const [isiPerGrosir, setIsiPerGrosir] = useState(1)
    const [jumlahKemasan, setJumlahKemasan] = useState(1)
    const [batasRestock, setBatasRestock] = useState(5)
    const [errorMsg, setErrorMsg] = useState(null)

    const totalStock = useMemo(() =>{
        return Number(jumlahKemasan || 0) * Number(isiPerGrosir || 0)
    }, [jumlahKemasan, isiPerGrosir])

    function handleSubmit(){
        if( !nama || !kategori || !satuanEceran){
            setErrorMsg('Nama Barang, Kategori, dan Satuan Eceran harus diisi')
            return
        }
        if ( !satuanGrosir || !isiPerGrosir){
            setErrorMsg('Nama Kemasan dan Isi per Kemasan wajib diisi')
            return
        }

        setErrorMsg(null)
        onSubmit({
            id,
            nama,
            kategori,
            varian,
            satuanEceran,
            satuanGrosir,
            isiPerGrosir,
            jumlah: totalStock,
            restock: batasRestock
        })
    }

    return (
        <Card className="shadow-sm border-0 mb-3" style={{ borderRadius: '12px' }}>
            <Card.Body>
                <p className="fw-bold mb-1">Barang baru</p>
                <p className="text-muted small mb-3">ID: {id}</p>
        
                {errorMsg && <Alert variant="danger" className="py-2 small">{errorMsg}</Alert>}
        
                <Form.Group className="mb-2">
                  <Form.Label className="text-muted small mb-1">Nama Barang</Form.Label>
                  <Form.Control value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Susu Greenfield" />
                </Form.Group>
        
                <Form.Group className="mb-2">
                  <Form.Label className="text-muted small mb-1">Kategori</Form.Label>
                  <Form.Control value={kategori} onChange={(e) => setKategori(e.target.value)} placeholder="Minuman" />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label className="text-muted small mb-1">Varian</Form.Label>
                  <Form.Control value={varian} onChange={(e) => setVarian(e.target.value)} placeholder="Rasa Coklat, 250ml" />
                </Form.Group>
        
                <Form.Group className="mb-2">
                  <Form.Label className="text-muted small mb-1">Satuan Eceran (Satuan Terkecil)</Form.Label>
                  <Form.Control value={satuanEceran} onChange={(e) => setSatuanEceran(e.target.value)} placeholder="Pcs, Botol, Kg" />
                </Form.Group>
        
                <Form.Group className="mb-2">
                  <Form.Label className="text-muted small mb-1">Nama Kemasan (Satuan Grosir)</Form.Label>
                  <Form.Control value={satuanGrosir} onChange={(e) => setSatuanGrosir(e.target.value)} placeholder="Box, Karton" />
                </Form.Group>
        
                <Form.Group className="mb-2">
                  <Form.Label className="text-muted small mb-1">Isi per Kemasan (dalam Satuan Eceran)</Form.Label>
                  <Form.Control type="number" inputMode="numeric" min="1" value={isiPerGrosir} onChange={(e) => setIsiPerGrosir(e.target.value)} />
                </Form.Group>
        
                <Form.Group className="mb-2">
                  <Form.Label className="text-muted small mb-1">Jumlah Kemasan yang Diterima</Form.Label>
                  <Form.Control type="number" inputMode="numeric" min="1" value={jumlahKemasan} onChange={(e) => setJumlahKemasan(e.target.value)} />
                </Form.Group>
        
                <Form.Group className="mb-2">
                  <Form.Label className="text-muted small mb-1">Total Stock Awal (otomatis)</Form.Label>
                  <Form.Control value={`${totalStock} ${satuanEceran}`} readOnly className="bg-light fw-bold" />
                </Form.Group>
        
                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small mb-1">Batas Minimum Restock</Form.Label>
                  <Form.Control type="number" inputMode="numeric" min="1" value={batasRestock} onChange={(e) => setBatasRestock(e.target.value)} />
                </Form.Group>
        
                <Button variant="success" className="w-100 d-flex align-items-center justify-content-center gap-2" onClick={handleSubmit}>
                  <PackagePlus size={18} /> Simpan sebagai Barang Masuk
                </Button>
            </Card.Body>
        </Card>
    )
}