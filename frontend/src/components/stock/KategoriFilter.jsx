import { Form } from 'react-bootstrap';

// Generik: field=kategori|jenis (satu filter untuk stock + transaksi).
export default function KategoriFilter({ items, selectedCategory, onCategoryChange, field = 'kategori', labelSemua = 'Semua Kategori' }){
    // Ambil list dari data sebenarnya
    const kategoriList = [...new Set(items.map((item) => item[field]))].filter(Boolean)
    
    return (
        <div className='mb-4'>
            <Form.Select
                value={selectedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                className='shadow-sm border-0'
                style= {{borderRadius: '8px' }}
            >
                <option value='Semua'>{labelSemua}</option>
                {kategoriList.map((kategori) => (
                    <option key={kategori} value={kategori}>
                        {kategori}
                    </option>
                ))}
            </Form.Select>
        </div>
    )
}