// Auth gudang: scrypt + cookie manual + sesi opaque di memori + rate-limit.
// Tanpa dep baru: scrypt via crypto bawaan. Hoist dari server.js lama (dulu di bawah, dipakai di atas).
const crypto = require('crypto');

// Hash format `scrypt$salt$hash` (pola sama untuk password outlet menyusul).
function hashKataSandi(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plain || ''), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function cekKataSandi(plain, tersimpan) {
  try {
    const [tag, salt, hash] = String(tersimpan || '').split('$');
    if (tag !== 'scrypt' || !salt || !hash) return false;
    const cek = crypto.scryptSync(String(plain || ''), salt, 64).toString('hex');
    const a = Buffer.from(cek, 'hex'), b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

// Rate-limit geser 10/mnt per kunci (login gudang; login outlet menyusul pola sama).
const emberRate = new Map(); // kunci -> [ms, ...]
function kenaRate(kunci, batas = 10, jendelaMs = 60000) {
  const kini = Date.now();
  const list = (emberRate.get(kunci) || []).filter(t => kini - t < jendelaMs);
  if (list.length >= batas) { emberRate.set(kunci, list); return true; }
  list.push(kini);
  emberRate.set(kunci, list);
  return false;
}

function bacaCookie(req, nama) {
  const h = req.headers.cookie || '';
  for (const pot of h.split(';')) {
    const i = pot.indexOf('=');
    if (i < 0) continue;
    if (pot.slice(0, i).trim() === nama) return decodeURIComponent(pot.slice(i + 1).trim());
  }
  return '';
}

const sesiGudang = new Map(); // token -> expMs (restart server = logout ulang, password tetap)
const UMUR_SESI_GUDANG_MS = 24 * 3600 * 1000;
function wajibGudang(req, res, next) {
  if (String(process.env.GUDANG_GATE || '').toLowerCase() === 'off') return next(); // kill-switch uji
  const tok = bacaCookie(req, 'sesi_gudang');
  const exp = tok ? sesiGudang.get(tok) : 0;
  if (!tok || !exp || exp < Date.now()) {
    if (tok) sesiGudang.delete(tok);
    return res.status(401).json({ error: 'Login gudang dulu.' });
  }
  next();
}

// Sesi outlet: token sesi -> {tokenOutlet, exp} (terikat 1 link; restart = logout ulang).
// Cookie per link (sesi_outlet_<token>): banyak link hidup berdampingan, login B tak menendang A.
// Tutup tab = login ulang via flag sessionStorage di frontend (cookie HttpOnly 24 jam ditimpa saat masuk ulang).
const sesiOutlet = new Map();
const UMUR_SESI_OUTLET_MS = 24 * 3600 * 1000;
function namaCookieOutlet(token) {
  const t = String(token || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 32) || 'x';
  return `sesi_outlet_${t}`;
}
function wajibOutlet(req, res, next) {
  const tok = bacaCookie(req, namaCookieOutlet(req.params.token));
  const sesi = tok ? sesiOutlet.get(tok) : null;
  // Mismatch/kedaluwarsa = 401 saja TANPA menghapus (sesi itu mungkin masih sah untuk link asalnya di tab sebelah).
  if (!tok || !sesi || sesi.exp < Date.now() || sesi.tokenOutlet !== String(req.params.token || '').trim()) {
    return res.status(401).json({ error: 'Login outlet dulu.' });
  }
  next();
}

// HTTPS di belakang proxy (ngrok/hosting): percayai X-Forwarded-Proto (lihat `trust proxy` di server.js).
function apakahHttps(req) {
  if (!req) return false;
  if (req.secure) return true;
  const proto = req.headers && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}
// Flag `; Secure` hanya saat HTTPS (HTTP localhost/dev tetap bisa login).
function atributSecure(req) {
  return apakahHttps(req) ? '; Secure' : '';
}

// Sapu entri kedaluwarsa tiap jam (sesi 24 jam + rate 1 mnt); tanpa ubah perilaku.
function mulaiPruneSesi() {
  const sapu = () => {
    try {
      const kini = Date.now();
      for (const [tok, exp] of sesiGudang) if (!(exp > kini)) sesiGudang.delete(tok);
      for (const [tok, s] of sesiOutlet) if (!s || !(s.exp > kini)) sesiOutlet.delete(tok);
      for (const [kunci, list] of emberRate) {
        const sisa = (list || []).filter(t => kini - t < 60000);
        if (sisa.length) emberRate.set(kunci, sisa);
        else emberRate.delete(kunci);
      }
    } catch (e) { console.warn('prune sesi gagal:', e.message); }
  };
  const timer = setInterval(sapu, 3600 * 1000);
  if (timer.unref) timer.unref();
}

module.exports = {
  hashKataSandi, cekKataSandi, kenaRate, bacaCookie,
  sesiGudang, UMUR_SESI_GUDANG_MS, wajibGudang,
  sesiOutlet, UMUR_SESI_OUTLET_MS, namaCookieOutlet, wajibOutlet,
  apakahHttps, atributSecure, mulaiPruneSesi,
};
