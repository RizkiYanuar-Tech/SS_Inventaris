# Test List — Manual T2 + Supabase + Gerbang Scan (ganti versi T1)

> Format lapor gagal: **nomor + yang terjadi vs expected + pesan popup + status baris DB.**
> Siapkan: `node server.js` + `npm run dev -- --host --port 5173` + `ngrok http 5173`;
> 2 Incognito (2 toko); browser gudang. Awali DB kosong: input 2 barang uji
> via `/tambah-barang` (stock ≥ 5, catat ID: BRG-A, BRG-B).

## List Testing (U1–U24)

### Prasyarat
- [ ] **U1.** Boot tanpa error; BottomNav tampil di semua halaman gudang (termasuk `/pesanan`); halaman outlet/terima tanpa BottomNav.

### Outlet pesan
- [ ] **U2.** Buka 2 link pesan → header toko benar + jadwal batch/kirim tampil + katalog tanpa angka stock.
- [ ] **U3.** Ketik qty langsung (cth 200) → keranjang `x200` tanpa tap 200x; keypad angka muncul di HP.
- [ ] **U4.** Submit (2 barang + nama) → popup sukses + pindah Riwayat; WA admin `PESANAN BARU` masuk.
- [ ] **U5.** Tanpa nama / keranjang kosong → popup merah, tanpa baris baru.

### Blokir 1-aktif
- [ ] **U6.** Pesan Baru saat aktif → kartu info (bukan form); Tab Buat gudang untuk toko itu → 409.
- [ ] **U7.** Toko lain tetap bisa pesan (blokir per token).

### Putus gudang (Tab Daftar)
- [ ] **U8.** Badge Pesanan = jumlah BARU; filter status + cari ID/outlet menyempit.
- [ ] **U9.** Tolak tanpa keterangan → merah; alasan umum wajib bila semua ditolak.
- [ ] **U10.** Sebagian (1 Penuhi + 1 Tolak+ket) → `DISETUJUI SEBAGIAN` + kirim SIAP KIRIM; stock penuhi −qty, tolak tetap; putus ulang → 409.

### Gerbang scan + kirim
- [ ] **U11.** Tombol `Pindai & Tandai` → halaman Scan mode verifikasi (checklist line + qty).
- [ ] **U12.** Scan ID luar kiriman → merah "bukan bagian kiriman"; ID tak dikenal → merah "tidak ada di database".
- [ ] **U13.** Tombol Tandai mati sebelum semua ✅; ketik ID manual → terhitung `manual`.
- [ ] **U14.** Lengkap → Tandai → DIKIRIM + modal link + WA admin `LINK BERITA ACARA`; Lacak tampil jejak `Dipindai keluar`.

### Terima outlet
- [ ] **U15.** Link di Incognito → form ceklis; tanpa nama / tanpa-ket-baris-bermasalah → merah.
- [ ] **U16.** Ceklis semua + nama → `DITERIMA`, badge per item hijau; refresh tetap terkunci.
- [ ] **U17.** 1 baris bermasalah (+jumlah+ket) → `DITERIMA SEBAGIAN`; Tab Diterima berisi keduanya; Batal hanya DITOLAK.

### Batal + mirror
- [ ] **U18.** Batalkan + alasan → SIAP KIRIM + pesanan kembali semula + link lama mati; tanpa alasan → merah; pasca-terima → 409.
- [ ] **U19.** Cek mirror: Tandai → pesanan DIKIRIM + link di Riwayat; terima → DITERIMA + boleh pesan lagi.

### Kelola link + Lacak
- [ ] **U20.** Salin link → Incognito valid; Reset (confirm) → lama 404 + baru 200. Catat token baru.
- [ ] **U21.** Lacak: filter outlet + status + cari ID menyempitkan dropdown; ganti filter → pilihan lama kosong.

### Regresi + penutup
- [ ] **U22.** Scan biasa: tambah barang + transaksi Masuk/Keluar manual + qty ketik.
- [ ] **U23.** History filter/pagination + chart + fast moving normal; `/kirim` susulan tetap jalan (input keyboard + cap stock).
- [ ] **U24.** Bersih-bersih: selesaikan/hapus baris uji; cek DB 0 sisa bila fresh.

-----
## Expected Output (E1–E24, peta 1:1 ke U)

- [ ] **E1.** `Terhubung` + `Supabase terhubung (4 tabel)` + `Outlet live`; nav ada di gudang, tidak ada di outlet/terima.
- [ ] **E2.** Nama outlet + `Batch masuk/Rencana kirim` + daftar `nama • varian • satuan` (tanpa stock).
- [ ] **E3.** Kolom terisi `200`, ringkasan `x200`; tidak ada pembatasan tap.
- [ ] **E4.** Popup `Pesanan PSN-... tercatat (BARU)...`; Riwayat badge `(1)` kartu abu; WA `*PESANAN BARU*` + ringkasan + batch/kirim.
- [ ] **E5.** Merah `Nama pemesan wajib diisi.` / `Keranjang masih kosong.`; jumlah baris tetap.
- [ ] **E6.** Kartu `masih aktif (BARU)` + tombol Riwayat; Tab Buat merah `Masih ada pesanan aktif ... (BARU)...`.
- [ ] **E7.** Order toko B sukses `(BARU)`.
- [ ] **E8.** Angka = hitungan BARU; filter/cari tepat.
- [ ] **E9.** Merah `... keterangan wajib karena ditolak.` / `Alasan umum wajib bila semua item ditolak.`
- [ ] **E10.** Status kuning + `KRM-... SIAP KIRIM`; stock A −qty, B tetap; `Transaksi` +1 `Keluar` (cap KRM); putus ulang merah `... hanya untuk BARU.`
- [ ] **E11.** Judul `Pindai Kiriman` + `0/N terpindai` + daftar line + kamera aktif.
- [ ] **E12.** Merah `... ada di database, tapi bukan bagian kiriman ini.` / `ID ... tidak ada di database.`
- [ ] **E13.** Tombol nonaktif `Pindai semua line dulu (n/N)`; manual jadi badge `✓ manual`.
- [ ] **E14.** Modal link + tombol Salin/WA; WA `*LINK BERITA ACARA*` + path; Lacak ada `Dipindai keluar: ... (scan/manual)`.
- [ ] **E15.** Merah `Nama penerima wajib diisi.` / `... keterangan wajib karena tidak diceklis.`
- [ ] **E16.** Alert hijau `DITERIMA`; tiap badge hijau `Sesuai` + `Dikirim X → diterima X`; refresh tidak berubah.
- [ ] **E17.** Kuning `DITERIMA SEBAGIAN`; hanya baris bermasalah badge kuning; keduanya di tab Diterima; Batal cuma DITOLAK.
- [ ] **E18.** Status SIAP KIRIM + pesanan asal; link lama `Link tidak valid.`; merah tanpa alasan; 409 pasca-terima.
- [ ] **E19.** Riwayat: ungu + tombol salin → hijau/kuning + tombol hilang; Pesan Baru aktif lagi.
- [ ] **E20.** Link lama 404, baru 200 + nama toko benar.
- [ ] **E21.** Opsi dropdown menyempit per filter; kartu hilang saat filter diganti.
- [ ] **E22.** Popup sukses + stock berubah sesuai tombol Masuk/Keluar.
- [ ] **E23.** Grafik/tabel normal; susulan SIAP KIRIM + stock kurang + cap stock di input.
- [ ] **E24.** `barang/transaksi/pesanan/pengiriman` kembali ke jumlah awal.
