export default function WeekFilter({ mode, onChange, customRange, onCustomRangeChange }){
    return(
        <div className='flex items-center gap-2'>
            <select
                value={mode}
                onChange={(e) => onChange(e.target.value)}
                className="text-xs border border-gray-200 rounded-full px-3 py-1 bg-gray-50"
            >
                <option value='thisWeek'>Minggu Ini</option>
                <option value='lastWeek'>Minggu Lalu</option>
                <option value='custom'>Pilih Tanggal</option>
            </select>

            {mode === 'custom' && (
                <div className='flex items-center gap-1 text-xs'>
                    <input
                    type='date'
                    value={customRange.start}
                    onChange={(e) => onCustomRangeChange({ ...customRange, start: e.target.value})}
                    className='border border-gray-200 rounded px-1 py-0.5'
                />
                <span>-</span>
                <input
                    type='date'
                    value={customRange.end}
                    onChange={(e) => onCustomRangeChange({ ...customRange, end: e.target.value})}
                    className='border border-gray-200 rounded px-1 py-0.5'
                />
                </div>
            )}
        </div>
    )
}