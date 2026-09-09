import { Table } from 'react-bootstrap';

export default function FastMovingTable({ items }){
    if (items.length == 0){
        return <p className='text-sm text-gray-400 text-center py-6'>Belum ada transaksi dalam 7 hari terakhir.</p>
    }
    
    return(
        <Table responsive='md' borderless hover className='mb-0 align-middle'>
            <tbody>
                {items.map((item, index) => (
                    <tr key={item.nama} 
                        className="flex items-center justify-between py-3"
                        style={{borderBottom: '1px solid #f3f4f6'}}
                    >
                        <td className='py-3' style={{width: '200px' }}>
                            <div className='d-flex align-items-center gap-3'>
                                <span className='text-muted small fw-bold' style={{ width: '20px' }}>
                                    {index + 1}
                                </span>
                                <span className='fw-medium text-gray-500'>
                                    {item.nama}
                                </span>
                            </div>
                        </td>
                        <td className='py-3'
                            style={{width: '90px'}}
                        >
                            <span className='small fw-bold text-success'>
                                In: {item.masuk}
                            </span>
                        </td>
                        <td className='py-3' 
                            style={{width: '80px'}}
                        >
                            <span className='small fw-bold'
                                style={{ color: '#7c3aed'}}>
                                    Out: {item.keluar}
                            </span>
                        </td>
                        <td className='w-10'></td>
                    </tr>
                ))}
            </tbody>
        </Table>
    )
}