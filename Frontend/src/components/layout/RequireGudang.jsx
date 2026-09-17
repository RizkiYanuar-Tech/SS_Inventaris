import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { sesiGudang } from '../../api/client';

// Gerbang halaman gudang (anti-loop + anti-flash):
// - ada flag -> render langsung + verifikasi background (401 -> login).
// - tanpa flag -> splash + cek server dulu (cookie lintas-tab bisa valid;
//   vonis-buta 'tutup' = loop / <-> /gudang-masuk). Endpoint tetap 401 final.
export default function RequireGudang({ children }) {
    const location = useLocation();
    const [status, setStatus] = useState(() =>
        sessionStorage.getItem('gudang-masuk') ? 'buka' : 'verifikasi'
    );

    useEffect(() => {
        let hidup = true;
        sesiGudang()
            .then(() => { if (hidup) setStatus('buka'); })
            .catch(() => {
                if (!hidup) return;
                sessionStorage.removeItem('gudang-masuk');
                setStatus('tutup');
            });
        return () => { hidup = false; };
    }, []);

    if (status === 'tutup') {
        return <Navigate to='/gudang-masuk' replace state={{ from: location.pathname }} />;
    }
    if (status === 'verifikasi') {
        return <p className='text-center py-5 text-muted'>Memeriksa sesi…</p>;
    }
    return children;
}
