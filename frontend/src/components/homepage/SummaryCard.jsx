import Card from 'react-bootstrap/Card'

export default function SummaryCard({ icon: Icon, iconColor, label, value, unit, sub, rel, onKlik }) {
    const bisaKlik = typeof onKlik === 'function';
    return (
        <Card bg='light' className='shadow-sm border-0 h-100' style={{ borderRadius: '12px', ...(rel ? { borderLeft: `4px solid ${rel}` } : {}), ...(bisaKlik ? { cursor: 'pointer' } : {}) }}
            onClick={bisaKlik ? onKlik : undefined}
            role={bisaKlik ? 'button' : undefined} tabIndex={bisaKlik ? 0 : undefined}
            aria-label={bisaKlik ? label : undefined}
            onKeyDown={bisaKlik ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKlik(); } }) : undefined}>
            <Card.Body className='d-flex flex-column p-3'>
                
                <div className='d-flex gap-2 mb-3 mr-30' style={{ minHeight: '2.5em', alignItems: 'flex-start' }}>
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

                <div>
                    <div className='d-flex align-items-baseline gap-2 flex-wrap'>
                        <h3 className='fw-bolder mb-0 text-dark fs-2' style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</h3>
                        {unit && <span className='text-muted small fw-medium'>{unit}</span>}
                    </div>
                    {sub && <div className='text-muted small mt-1'>{sub}</div>}
                </div>
            </Card.Body>
        </Card>
    )
}