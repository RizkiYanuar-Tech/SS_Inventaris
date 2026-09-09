import { Modal, Button } from 'react-bootstrap';

export default function ResultModal({ show, sukses, pesan, onClose }) {
    return (
        <Modal show={show} onHide={onClose} centered>
            <Modal.Header closeButton className={sukses ? 'bg-success text-white' : 'bg-danger text-white'}>
                <Modal.Title>{sukses ? 'Berhasil' : 'Gagal'}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="text-center">{pesan}</Modal.Body>
            <Modal.Footer>
                <Button variant={sukses ? 'success' : 'danger'} onClick={onClose} className="w-100">
                    OK
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
