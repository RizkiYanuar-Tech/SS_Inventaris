import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Navbar, Container, Badge } from 'react-bootstrap';
import { Home, History, Package, PackagePlus, ClipboardList } from 'lucide-react';
import { fetchPesanan } from '../../api/client';

const navItems = [
    {to: '/homepage', label: "Home", icon: Home, end: true, warna: '#2563eb'},
    {to: '/inventory', label: "Inventory", icon: Package, warna: '#16a34a'},
    {to: '/pesanan', label: "Pesanan", icon: ClipboardList, warna: '#7c3aed'},
    {to: '/history', label: "History", icon: History, warna: '#f70505'},
    {to: '/input', label: "Input", icon: PackagePlus, warna: '#00a000'}
]

export default function BottomNav() {
    const { pathname } = useLocation();
    const [baru, setBaru] = useState(0);

    useEffect(() => {
        // Tanpa flag sesi: jangan tembak API yang pasti 401 (hindari console merah).
        if (!sessionStorage.getItem('gudang-masuk')) { setBaru(0); return; }
        fetchPesanan()
            .then(rows => setBaru(rows.filter(r => String(r.status).trim() === 'BARU').length))
            .catch(e => {
                if (/login gudang/i.test(e.message || '')) sessionStorage.removeItem('gudang-masuk');
                setBaru(0);
            });
    }, [pathname]);

    return (
        <Navbar 
            fixed="bottom" 
            bg="white" 
            className="border-top py-2" 
            style={{ maxWidth: '480px', margin: '0 auto', left: 0, right: 0 }}
        >
            <Container className="d-flex justify-content-around px-0">
                {navItems.map(({ to, label, icon: Icon, end, warna }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) => `bnav-item d-flex flex-column align-items-center text-decoration-none px-3${isActive ? ' bnav-aktif' : ''}`}
                        style={{ fontSize: '12px', position: 'relative', '--aksen': warna }}
                    >
                        <Icon size={24} className="mb-1" />
                        <span>{label}</span>
                        {to === '/pesanan' && baru > 0 && (
                            <Badge bg='danger' pill style={{ position: 'absolute', top: 0, right: '8px' }}>{baru}</Badge>
                        )}
                    </NavLink>
                ))}
            </Container>
        </Navbar>
    )
}