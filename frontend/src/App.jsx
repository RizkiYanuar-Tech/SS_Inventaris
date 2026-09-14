import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import HomePage from './routes/HomePage'
import StockPage from './routes/StockPage'
import InputManualPage from './routes/InputManualPage'
import TransaksiPage from './routes/TransaksiPage'
import TransaksiBarangPage from './routes/TransaksiBarangPage'
import TambahBarangPage from './routes/TambahBarangPage'
import DaftarPengirimanPage from './routes/DaftarPengirimanPage'
import BuatPengirimanPage from './routes/BuatPengirimanPage'
import TerimaBarangPage from './routes/TerimaBarangPage'
import PesanOutletPage from './routes/PesanOutletPage'
import BottomNav from './components/layout/BottomNav'
import './App.css'

// Halaman publik outlet: tanpa BottomNav gudang (cocok segmen persis agar /pesanan tak ikut hilang)
const sembunyiNav = (pathname) =>
  pathname === '/terima' || pathname.startsWith('/terima/') ||
  pathname === '/pesan' || pathname.startsWith('/pesan/');

// /scan dialihkan ke /input (bawa state verifikasi bila ada). File ScanPage tetap di disk.
function PengalihScan() {
    const { state } = useLocation();
    return <Navigate to='/input' state={state} replace />;
}

function App() {
  const { pathname } = useLocation();
  const tanpaNav = sembunyiNav(pathname);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: tanpaNav ? 0 : '80px', backgroundColor: '#f3f4f6' }}>
      <Routes>
        <Route path='/' element={<HomePage />}></Route>
        <Route path='/inventory' element={<StockPage />}></Route>
        <Route path='/history' element={<TransaksiPage />}></Route>
        <Route path='/input' element={<InputManualPage />}></Route>
        <Route path='/scan' element={<PengalihScan />}></Route>
        <Route path='/tambah-barang' element={<TambahBarangPage />}></Route>
        <Route path='/transaksi-barang' element={<TransaksiBarangPage />}></Route>
        <Route path='/pesanan' element={<DaftarPengirimanPage />}></Route>
        <Route path='/kirim' element={<BuatPengirimanPage />}></Route>
        <Route path='/terima/:token' element={<TerimaBarangPage />}></Route>
        <Route path='/pesan/:slugToken' element={<PesanOutletPage />}></Route>
      </Routes>
      {!tanpaNav && <BottomNav />}
    </div>
  )
}

export default App
