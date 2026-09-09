// Format Timestamp pada worksheet transaksi tersimpan sebagai teks hasil
// 14/08/2026, 17.24.01 (DD/MM/YYYY, HH.MM.ss)
// Fungsi akan mengubah menjadi objek date untuk bisa dibandingkan

const BULAN = {
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5, juli: 6,
    agustus: 7, september: 8, oktober: 9, november: 10, desember: 11
}

export function parseTimestamp(str){
    if (!str){
        return null;
    }
    const match = String(str).match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+pukul\s+(\d{2})\.(\d{2})(?:\.(\d{2}))?/i)
    if (!match){
        return null;
    }

    const [, day, bulan, year, hour, minute, second] = match
    const month = BULAN[bulan.toLowerCase()]
    if (month === undefined){
        return null;
    }

    return new Date(
        Number(year),
        month,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second || 0)
    )
}

export function isSameDay(a, b){
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

// Ambil tanggal hari Senin dari minggu yang mengandung "date"
// perminggu dimulai dari hari senin
export function getMondayOf(date){
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
}

export function addDays(date, amount){
    const d = new Date(date)
    d.setDate(d.getDate() + amount)
    return d
}