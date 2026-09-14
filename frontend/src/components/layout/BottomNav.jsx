import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Navbar, Container, Nav, Badge } from 'react-bootstrap';
import { Home, History, Package, PackagePlus, ClipboardList } from 'lucide-react';
import { fetchPesanan } from '../../api/client';

const navItems = [
    {to: '/', label: "Home", icon: Home, end: true},
    {to: '/inventory', label: "Inventory", icon: Package},
    {to: '/pesanan', label: "Pesanan", icon: ClipboardList},
    {to: '/history', label: "History", icon: History},
    {to: '/input', label: "Input", icon: PackagePlus}
]

export default function BottomNav() {
    const { pathname } = useLocation();
    const [baru, setBaru] = useState(0);

    useEffect(() => {
        fetchPesanan()
            .then(rows => setBaru(rows.filter(r => String(r.status).trim() === 'BARU').length))
            .catch(() => {});
    }, [pathname]);

    return (
        <Navbar 
            fixed="bottom" 
            bg="white" 
            className="border-top py-2" 
            style={{ maxWidth: '480px', margin: '0 auto', left: 0, right: 0 }}
        >
            <Container className="d-flex justify-content-around px-0">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                    <Nav.Link
                        key={to}
                        as={NavLink}
                        to={to}
                        end={end}
                        className="d-flex flex-column align-items-center text-decoration-none px-3 text-muted"
                        style={{ fontSize: '12px', position: 'relative' }}
                    >
                        <Icon size={24} className="mb-1" />
                        <span>{label}</span>
                        {to === '/pesanan' && baru > 0 && (
                            <Badge bg='danger' pill style={{ position: 'absolute', top: 0, right: '8px' }}>{baru}</Badge>
                        )}
                    </Nav.Link>
                ))}
            </Container>
        </Navbar>
    )
}