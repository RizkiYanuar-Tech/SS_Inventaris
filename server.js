// Forwarder opsi A — kode pindah ke backend/. Jangan taruh logika di sini.
// `node server.js` tetap jalan seperti dulu (README tidak berubah).
const srv = require('./backend/server');

if (process.argv.includes('--self-check')) srv.jalankanSelfCheck();
else srv.mulaiServer();

module.exports = srv;
