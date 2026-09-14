import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { sesiGudang } from '../../api/client';

// Gerbang halaman gudang: tanpa flag sesi -> lempar login tanpa request;
// ada flag -> verifikasi sekali ke server (tampil kosong sesaat, tanpa kedip dashboard).
export default function RequireGudang({ children }) {
    const location = useLocation();
    const [status, setStatus] = useState(() =>
        sessionStorage.getItem('gudang-masuk') ? 'cek' : 'tutup'
    );

    useEffect(() => {
        if (status !== 'cek') return;
        sesiGudang()
            .then(() => setStatus('buka'))
            .catch(() => {
                sessionStorage.removeItem('gudang-masuk');
                setStatus('tutup');
            });
    }, [status]);

    if (status === 'tutup') {
        return <Navigate to='/gudang-masuk' replace state={{ from: location.pathname }} />;
    }
    if (status !== 'buka') return null;
    return children;
}
