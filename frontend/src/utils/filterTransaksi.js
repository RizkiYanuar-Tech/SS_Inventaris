import { parseTimestamp } from './dateParse'

function parseDateInputLocal(dateStr){
    if (!dateStr){
        return null;
    }
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
}

export function isOpname(item){
    return String(item?.keterangan || '').startsWith('Opname #');
}

export function filterTransaksi(items, {search, startDate, endDate, jenis, sembunyikanOpname }){
    const start = parseDateInputLocal(startDate)
    const end = parseDateInputLocal(endDate)
    
    // Set end ke jam (23.59.59)
    if (end) end.setHours(23, 59,59, 999)

    return items.filter((item) => {
        if (sembunyikanOpname && isOpname(item)) return false;
        const isSearchMatch =
            item.nama.toLowerCase().includes(search.toLowerCase()) ||
            (item.varian && item.varian.toLowerCase().includes(search.toLowerCase())) ||
            (item.idKirim && item.idKirim.toLowerCase().includes(search.toLowerCase())) ||
            (item.keterangan && item.keterangan.toLowerCase().includes(search.toLowerCase())) ||
            (item.idBarang != null && String(item.idBarang).toLowerCase().includes(search.toLowerCase()))
            
        const tanggal = parseTimestamp(item.timestamp)
        const isDateMatch = !tanggal || ((!start || tanggal >= start) && (!end || tanggal <= end))
        const isJenisMatch = jenis === 'Semua' || item.jenis === jenis
    
        return isSearchMatch && isDateMatch && isJenisMatch
    })
}