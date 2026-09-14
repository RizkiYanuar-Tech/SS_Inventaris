import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Dropdown } from 'react-bootstrap';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import { bacaNotifikasi } from '../../api/client';

// Bunyi 1 pola untuk semua peristiwa (Web Audio, tanpa aset).
// Kembali false bila belum boleh bunyi (pra-gesture) — sunyi tanpa error.
async function mainkanBunyi(ctxRef) {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!ctxRef.current) ctxRef.current = new Ctx();
        const ctx = ctxRef.current;
        await ctx.resume();
        if (ctx.state !== 'running') return;
        [880, 660].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.22;
            gain.gain.setValueAtTime(0.001, t);
            gain.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.22);
        });
        if (navigator.vibrate) navigator.vibrate(200);
    } catch { /* sunyi saja */ }
}

// Lonceng gudang: data milik parent (numpang siklus fetch yang ada).
// Bunyi hanya saat hitungan naik vs poll sebelumnya (baseline saat mount).
export default function LoncengGudang({ data, onMuat }) {
    const navigate = useNavigate();
    const [buka, setBuka] = useState(false);
    const [bunyiOn, setBunyiOn] = useState(() => localStorage.getItem('lonceng-bunyi') !== 'mati');
    const prev = useRef(null);
    const ctxRef = useRef(null);

    useEffect(() => {
        if (!data) return;
        if (prev.current != null && data.belumBaca > prev.current && bunyiOn) mainkanBunyi(ctxRef);
        prev.current = data.belumBaca;
    }, [data, bunyiOn]);

    function toggleBunyi() {
        setBunyiOn(v => {
            localStorage.setItem('lonceng-bunyi', v ? 'mati' : 'bunyi');
            return !v;
        });
    }

    async function tandaiDibaca() {
        try {
            await bacaNotifikasi();
            onMuat?.();
        } catch { /* badge refresh berikutnya */ }
    }

    const daftar = data?.daftar || [];
    const belum = data?.belumBaca || 0;

    return (
        <Dropdown show={buka} onToggle={setBuka} align='end'>
            <Dropdown.Toggle variant='outline-secondary' size='sm' id='lonceng-gudang'
                className='d-flex align-items-center position-relative' aria-label='Notifikasi gudang'>
                <Bell size={16} />
                {belum > 0 && (
                    <Badge bg='danger' pill className='position-absolute top-0 start-100 translate-middle'>
                        {belum > 9 ? '9+' : belum}
                    </Badge>
                )}
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ width: '300px', maxHeight: '70vh', overflowY: 'auto' }}>
                <div className='d-flex justify-content-between align-items-center px-3 py-2 border-bottom'>
                    <strong className='small'>Notifikasi</strong>
                    <span className='d-flex gap-1'>
                        <Button size='sm' variant='link' className='p-0 text-decoration-none'
                            onClick={toggleBunyi} aria-label={bunyiOn ? 'Bisukan' : 'Bunyikan'}>
                            {bunyiOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </Button>
                        <Button size='sm' variant='link' className='p-0 text-decoration-none'
                            onClick={tandaiDibaca}>
                            Tandai dibaca
                        </Button>
                    </span>
                </div>
                {daftar.length === 0 && (
                    <div className='text-center text-muted small py-3'>Belum ada notifikasi.</div>
                )}
                {daftar.map(n => (
                    <Dropdown.Item key={n.id} className='small'
                        style={{ whiteSpace: 'normal', background: n.dibaca ? undefined : '#f0f6ff' }}
                        onClick={() => { tandaiDibaca(); setBuka(false); navigate('/pesanan'); }}>
                        <div className='fw-bold'>{n.judul}</div>
                        <div className='text-muted text-truncate'>{n.isi}</div>
                    </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    );
}
