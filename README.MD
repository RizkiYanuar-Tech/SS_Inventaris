# Sistem Inventory

## Latar Belakang
Pengelolaan inventory barang sering kali rentan terhadap masalah operasional dan human error, seperti staf lupa mencatat barang saat datang, pendataan ganda, hingga kehabisan stok secara tiba-tiba karena tidak adanya pemantauan. Sistem barcode tradisional juga kerap membutuhkan alat pemindai khusus yang menambahkan biaya pengadaan.

Sistem ini dibuat memecahkan masalah dengan memanfaatkan perangkat kamera smartphone, mengunci celah kesalahan dengan validasi real-time, dan menambahkan kecerdasan buatan (Artificial Intelligence) agar sistem tidak hanya bertugas mencatat secara pasif, tetapi juga mampu memprediksi kebutuhan di masa depan.

## Tujuan Proyek
Pengembangan sistem ini difokuskan untuk mencapai:
1. Otomatisasi & Aksesibilitas: Memanfaatkan web dan kamera hp untuk membaca barcode bawaan pabrik, sehingga proses pendataan barang masuk dan keluar menjadi sangat cepat & praktis

2. Integritas Data: Menerapkan Pengechekan data di level aplikasi untuk menolak transaksi pengeluaran barang yang stok atau jenis yang belum terdaftar.

3. Manajemen Inventaris: Menerapkan model machine learning untuk analisis data historis pergerakan barang, sehingga sistem dapat memprediksi kecepatan konsumsi dan kebutuhan pesanan.

## Output
Sistem secara otomatis akan menghasilkan output:
1. Aplikasi Web Scanner Responsif: Halaman operasional bagi staf dengan fitur Auto-fill cerdas dan tombol aksi dinamis terintegrasi di HP.

2. Notifikasi Reminder: Pengingat (reminder) otomatis yang dikirimkan via aplikasi pesan (WhatsApp/Email) tepat ketika AI mendeteksi bahwa stok sebuah barang akan habis dalam waktu dekat (misalnya 3 hari ke depan) atau stok sudah menipis sebelum tanggal prediksi.

3. Laporan Rekomendasi Bulanan: Rekapitulasi terjadwal pada setiap tanggal 30 yang berisi sisa stok aktual dan rekomendasi jumlah restock dari AI untuk bulan berikutnya.

## Kebutuhan Minimum
- Browser modern, Android 9+ / iOS 14+.
- RAM 4GB lancar; kamera tidak lagi dibutuhkan (scan dicabut 2026-09-14, input full manual).

## Cara Test di HP via Ngrok (Opsi A, tanpa build)
1. Terminal 1: `node server.js` (backend port 3000, sumber `/api`).
2. Terminal 2: `cd frontend; npm run dev -- --host --port 5173` (frontend live HMR).
3. Terminal 3: `ngrok http 5173` → buka URL HTTPS di HP (Incognito).
4. Jika error `blocked request ... not allowed`: tambah `host: true` + `allowedHosts: ['<url-ngrok>', '.ngrok-free.dev']` di `frontend/vite.config.js`, lalu restart dev server.
- Catatan: tiap edit `frontend/src/` langsung tampil di HP tanpa `npm run build`. `build` hanya wajib untuk `ngrok http 3000` (serve `frontend/dist` via Express).

## Workflow Singkat
- Pesan: outlet buka link permanen `/pesan/<slug>-<token>` (2 tab: Pesan Baru | Riwayat) → keranjang (tanpa stock) → submit → status BARU + batch masuk & rencana kirim otomatis (slot Senin & Kamis, cutoff 15:00 WIB).
- Kirim: gudang approve per item di hub `/pesanan` (Penuhi / Tolak + keterangan manual) → record pengiriman TERBENTUK OTOMATIS + stock berkurang 1x (tanpa tombol buat-manual) → klik manual `Tandai Dikirim` → link berita acara `/terima/:token` valid + dikirim via WA. Batal kirim hanya sebelum outlet konfirmasi (link lama mati, alasan wajib).
- Terima: outlet ceklis per baris yang sesuai (baris bermasalah jangan diceklis + wajib jumlah terima + keterangan) + nama penerima → 1 tombol `Kirim Laporan Terima` → terkunci (DITERIMA/DITERIMA SEBAGIAN = berita acara barang masuk). Gudang terima ringkasan surat jalan read-only.
- Detail lengkap: lihat `PRD.MD`.