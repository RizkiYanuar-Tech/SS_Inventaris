import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import HomePage from './routes/HomePage'
import StockPage from './routes/StockPage'
import InputManualPage from './routes/InputManualPage'
import TransaksiPage from './routes/TransaksiPage'
import TransaksiBarangPage from './routes/TransaksiBarangPage'
import DaftarPengirimanPage from './routes/DaftarPengirimanPage'
import TerimaBarangPage from './routes/TerimaBarangPage'
import PesanOutletPage from './routes/PesanOutletPage'
import GudangMasukPage from './routes/GudangMasukPage'
import SuratJalanPrintPage from './routes/SuratJalanPrintPage'
import RequireGudang from './components/layout/RequireGudang'
import BottomNav from './components/layout/BottomNav'
import './App.css'

// Halaman publik outlet: tanpa BottomNav gudang (cocok segmen persis agar /pesanan tak ikut hilang)
const sembunyiNav = (pathname) =>
  pathname === '/terima' || pathname.startsWith('/terima/') ||
  pathname === '/pesan' || pathname.startsWith('/pesan/') ||
  pathname === '/gudang-masuk' || pathname.startsWith('/surat-jalan/');

function App() {
  const { pathname } = useLocation();
  const tanpaNav = sembunyiNav(pathname);

  return (
    <div className='app-root' style={{ minHeight: '100vh', paddingBottom: tanpaNav ? 0 : '80px', backgroundColor: '#f3f4f6' }}>
      <Routes>
        {/* Publik: jalur outlet + login gudang */}
        <Route path='/terima/:token' element={<TerimaBarangPage />}></Route>
        <Route path='/pesan/:slugToken' element={<PesanOutletPage />}></Route>
        <Route path='/gudang-masuk' element={<GudangMasukPage />}></Route>
        {/* Gudang: wajib sesi */}
        <Route path='/' element={<RequireGudang><Navigate to='/homepage' replace /></RequireGudang>}></Route>
        <Route path='/homepage' element={<RequireGudang><HomePage /></RequireGudang>}></Route>
        <Route path='/inventory' element={<RequireGudang><StockPage /></RequireGudang>}></Route>
        <Route path='/history' element={<RequireGudang><TransaksiPage /></RequireGudang>}></Route>
        <Route path='/input' element={<RequireGudang><InputManualPage /></RequireGudang>}></Route>
        <Route path='/transaksi-barang' element={<RequireGudang><TransaksiBarangPage /></RequireGudang>}></Route>
        <Route path='/pesanan' element={<RequireGudang><DaftarPengirimanPage /></RequireGudang>}></Route>
        <Route path='/surat-jalan/:idKirim' element={<RequireGudang><SuratJalanPrintPage /></RequireGudang>}></Route>
      </Routes>
      {!tanpaNav && <BottomNav />}
    </div>
  )
}

export default App
