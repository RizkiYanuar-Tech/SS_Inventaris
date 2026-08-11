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

2. Dataset Time Series: Tabel data terstruktur yang dikompilasi secara otomatis di belakang layar (background process) dari log transaksi mentah, siap untuk diproses oleh algoritma prediksi.

3. Notifikasi Reminder: Pengingat (reminder) otomatis yang dikirimkan via aplikasi pesan (WhatsApp/Email) tepat ketika AI mendeteksi bahwa stok sebuah barang akan habis dalam waktu dekat (misalnya 3 hari ke depan) atau stok sudah menipis sebelum tanggal prediksi.

4. Laporan Rekomendasi Bulanan: Rekapitulasi terjadwal pada setiap tanggal 30 yang berisi sisa stok aktual dan rekomendasi jumlah restock dari AI untuk bulan berikutnya.