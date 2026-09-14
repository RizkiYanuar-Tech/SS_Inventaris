import { Table } from 'react-bootstrap';

// Bar arus = proporsi Masuk vs Keluar per baris; mengisi ruang kanan tabel
// dengan informasi (bukan dekorasi): hijau = masuk, ungu = keluar.
export default function FastMovingTable({ items }){
    if (items.length == 0){
        return <p className='text-sm text-gray-400 text-center py-6'>Belum ada transaksi dalam 7 hari terakhir.</p>
    }

    return(
        <Table responsive='md' borderless hover className='mb-0 align-middle'>
            <tbody>
                {items.map((item, index) => {
                    const total = (Number(item.masuk) || 0) + (Number(item.keluar) || 0);
                    const pctIn = total ? Math.round((Number(item.masuk) || 0) / total * 100) : 0;
                    return (
                        <tr key={`${item.nama}#${index}`}
                            style={{borderBottom: '1px solid #f3f4f6'}}
                        >
                            <td className='py-3' style={{width: '36px'}}>
                                <span className='text-muted small fw-bold'>
                                    {index + 1}
                                </span>
                            </td>
                            <td className='py-3'>
                                <span className='fw-medium text-gray-500'>
                                    {item.nama}
                                </span>
                            </td>
                            <td className='py-3 text-nowrap' style={{fontVariantNumeric: 'tabular-nums'}}>
                                <span className='small fw-bold text-success'>
                                    In: {item.masuk}
                                </span>
                            </td>
                            <td className='py-3 text-nowrap' style={{fontVariantNumeric: 'tabular-nums'}}>
                                <span className='small fw-bold'
                                    style={{ color: '#7c3aed'}}>
                                        Out: {item.keluar}
                                </span>
                            </td>
                            <td className='py-3' style={{minWidth: '140px', width: '32%'}}>
                                <div className='d-flex align-items-center gap-2'>
                                    <div className='flex-grow-1 rounded-pill' title={`${pctIn}% masuk`}
                                        style={{height: '8px', background: '#f3f4f6', overflow: 'hidden'}}>
                                        <div className='h-100 rounded-pill'
                                            style={{width: `${pctIn}%`, background: '#16a34a'}} />
                                    </div>
                                    <span className='small text-muted fw-bold text-nowrap'
                                        style={{fontVariantNumeric: 'tabular-nums'}}>
                                        {total}
                                    </span>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </Table>
    )
}
