import { useState } from 'react';
import { Form, Button } from 'react-bootstrap';

const OPSI_BARU = '__baru__';

// Dropdown kategori tunggal + opsi tambah baru (tanpa tabel kategori).
// value/onChange bertukar string biasa; ketikan baru dinormalisasi uppercase di backend.
export default function InputKategori({ value, onChange, opsi, size, placeholder }) {
  const [modeBaru, setModeBaru] = useState(false);
  const daftar = opsi || [];
  const ada = daftar.some(o => o === value);

  if (modeBaru) {
    return (
      <div>
        <Form.Control size={size} value={value} onChange={onChange}
          placeholder='Ketik kategori baru…' aria-label='Kategori baru' autoFocus />
        <Button variant='link' size='sm' className='p-0 mt-1 text-decoration-none'
          onClick={() => { setModeBaru(false); onChange(''); }}>
          ← kembali ke daftar
        </Button>
      </div>
    );
  }

  return (
    <Form.Select size={size} value={ada ? value : ''} aria-label='Kategori bahan'
      onChange={e => {
        if (e.target.value === OPSI_BARU) { setModeBaru(true); onChange(''); }
        else onChange(e.target.value);
      }}>
      <option value=''>{placeholder || 'Pilih kategori…'}</option>
      {!ada && value && <option value={value}>{value}</option>}
      {daftar.map(o => <option key={o} value={o}>{o}</option>)}
      <option value={OPSI_BARU}>+ Tambah kategori baru…</option>
    </Form.Select>
  );
}
