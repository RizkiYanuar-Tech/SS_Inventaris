import Card from 'react-bootstrap/Card'

export default function SummaryCard({ icon: Icon, iconColor, label, value, unit }) {
    return (
        <Card bg='light' className='shadow-sm border-0 h-100' style={{ borderRadius: '12px' }}>
            <Card.Body className='d-flex flex-column p-3'>
                
                <div className='d-flex align-items-center gap-2 mb-3 mr-30'>
                    <div 
                        className='d-flex align-items-center justify-content-center rounded'
                        style={{ 
                            backgroundColor: `${iconColor}15`,
                            width: '36px', 
                            height: '36px',
                            minWidth: '36px'
                        }}
                    >
                        <Icon size={18} color={iconColor} />
                    </div>
                    <span className='text-muted small fw-bold'>{label}</span>
                </div>

                <div className='mt-auto'>
                    <div className='d-flex align-items-baseline gap-2'>
                        <h3 className='fw-bolder mb-0 text-dark fs-2'>{value}</h3>
                        {unit && <span className='text-muted small fw-medium'>{unit}</span>}
                    </div>
                </div>
            </Card.Body>
        </Card>
    )
}