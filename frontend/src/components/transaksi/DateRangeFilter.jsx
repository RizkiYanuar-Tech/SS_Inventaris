import { Form, Row, Col } from 'react-bootstrap'

export default function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange }){
    return(
        <Row className='g-2'>
            <Col xs={6}>
                <Form.Group>
                    <Form.Label className='text-muted small mb-1'>Dari Tanggal</Form.Label>
                    <Form.Control
                        type='date'
                        value={startDate}
                        onChange={(e) => onStartChange(e.target.value)}
                        className="shadow-sm border-0"
                    />
                </Form.Group>
            </Col>
            <Col xs={6}>
            <Form.Group>
                <Form.Label className='text-muted small mb-1'>Sampai Tanggal</Form.Label>
                <Form.Control 
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndChange(e.target.value)}
                    className='shadow-sm border-0'
                />
            </Form.Group>
            </Col>
        </Row>
    )
}