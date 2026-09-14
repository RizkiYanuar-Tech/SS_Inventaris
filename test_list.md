# Test List — Manual T2 + Supabase + Gerbang Scan (ganti versi T1)

> Format lapor gagal: **nomor + yang terjadi vs expected + pesan popup + status baris DB.**
> Siapkan: `node server.js` + `npm run dev -- --host --port 5173` + `ngrok http 5173`;
> 2 Incognito (2 toko); browser gudang. Awali DB kosong: input 2 barang uji
> via `/tambah-barang` (stock ≥ 5, catat ID: BRG-A, BRG-B).

## List Testing (U1–U32)

### Prasyarat
- [ Sukses ] **U1.** Boot tanpa error; BottomNav tampil di semua halaman gudang (termasuk `/pesanan`); halaman outlet/terima tanpa BottomNav.

### Outlet pesan
- [ Sukses ] **U2.** Buka 2 link pesan → header toko benar + jadwal batch/kirim tampil + katalog tanpa angka stock.
- [ Sukses ] **U3.** Ketik qty langsung (cth 200) → keranjang `x200` tanpa tap 200x; keypad angka muncul di HP.
- [ Sukses ] **U4.** Submit (2 barang + nama) → popup sukses + pindah Riwayat; jejak `PESANAN BARU` di log server (WA dicabut 2026-09-14).
- [ Sukses ] **U5.** Tanpa nama / keranjang kosong → popup merah, tanpa baris baru.

### Loket 15:00 + gabung (ganti blokir 1-aktif 2026-09-14)
- [ ] **U6.** Loket buka (<15:00): form selalu tampil, pesan berkali-kali bisa; pesan kedua sehati + masih BARU → gabung ID sama (`digabung`, qty se-ID dijumlah, WA DIGABUNG); beda hari / sudah diputus → ID baru.
- [ ] **U6b.** Loket tutup (≥15:00): kartu info `Hanya menerima pesanan di bawah jam 15.00 WIB` (bukan form); POST langsung → 403 pesan sama.
- [ ] **U6c.** Tab Buat gudang sudah tidak ada (hub = Daftar/Lacak).
- [ ] **U38.** Login gudang: tanpa sesi → buka `/pesanan` dilempar ke `/gudang-masuk`; salah → 401; 10× salah/mnt → 429; benar → masuk + sesi 24 jam; Keluar → balik ke login; Ganti (ketik 2×, min 4) → password baru berlaku, lama mati; restart server → login ulang.
- [ Sukses ] **U7.** Toko lain tetap bisa pesan (per token).

### Putus gudang (Tab Daftar)
- [ ] **U8.** Tab alur Baru/Siap/Dikirim/Selesai/Semua + badge hitung + cari menyempit; Baru terisi FIFO (tertua atas); putus 1 → kartu pindah tab otomatis.
- [ Sukses ] **U9.** Tolak tanpa keterangan → merah; tolak semua cukup keterangan per item (tanpa alasan umum).
- [ Sukses ] **U10.** Sebagian (1 Penuhi + 1 Tolak+ket) → `DISETUJUI SEBAGIAN` + kirim SIAP KIRIM; stock penuhi −qty, tolak tetap; putus ulang → 409. ID-kembar (`-`/`-`/`-`): tolak 1 → hanya 1 TOLAK, 2 PENUHI (anti-nular).

### Verifikasi ceklis + foto (tanpa ID)
- [ Sukses ] **U11.** Tombol `Verifikasi & Tandai` → halaman Input mode verifikasi (tap kartu per line + foto paket, tanpa ketik ID/kamera).
- [ Sukses ] **U12.** Ceklis bisa tap ulang untuk batal; tanpa foto → tombol mati sampai pilih file / centang `Lanjut tanpa foto`.
- [ Sukses ] **U13.** Tombol Tandai mati sebelum N/N + foto; lengkap → tercatat `ceklis` per line.
- [ ] **U14.** Lengkap → Tandai → DIKIRIM + modal link + jejak `LINK BERITA ACARA` di log (WA dicabut); kartu Daftar DIKIRIM bisa buka-ulang link (Salin/Buka/Kirim WA); Lacak tampil jejak `Diverifikasi ceklis` + foto kirim; halaman terima tampil foto gudang; lapor + foto balik → foto tampil di Lacak.

### Terima outlet
- [ ] **U15.** Surat jalan via Tab Surat Jalan di link pemesanan (badge = perlu lapor; expand kartu → isi form) + fallback link `/terima` di Incognito → form ceklis; kartu tiket: rel status + langkah-berikutnya + alur + rincian per barang (collapse) + thumbnail foto kirim/terima (klik = tab baru); hub gudang tanpa jalan mengisi (tanpa Buka/WA, hanya Salin); tanpa nama / tanpa-ket-baris-bermasalah → merah. ID-kembar: ceklis 1 line tidak menular ke line se-ID.
- [ ] **U16.** Ceklis semua + nama → `DITERIMA`, badge per item hijau; refresh tetap terkunci.
- [ ] **U17.** 1 baris bermasalah (+jumlah+ket) → `DITERIMA SEBAGIAN`; Tab Diterima berisi keduanya; Batal hanya DITOLAK.

### Batal + mirror
- [ ] **U18.** Batalkan + alasan → SIAP KIRIM + pesanan kembali semula + link lama mati; tanpa alasan → merah; pasca-terima → 409.
- [ ] **U19.** Cek mirror: Tandai → pesanan DIKIRIM + link di Riwayat; terima → DITERIMA + boleh pesan lagi.

### Kelola link + Lacak
- [ ] **U20.** Salin link → Incognito valid; Reset (confirm) → lama 404 + baru 200. Catat token baru.
- [ ] **U21.** Lacak: buka tab langsung tampil list terbaru-di-atas tanpa pilih dulu; filter outlet + status + cari ID menyempitkan list; klik kartu expand/collapse detail; `Muat lagi` nambah 20; tombol `Lacak` di Daftar lompat ke tab Lacak.
- [ ] **U35.** Responsivitas hub: 360px 1 kolom tanpa luber; ≥768px daftar kartu 2 kolom + hub ≤720px; ≥1200px hub ≤960px; outlet tetap kolom ramping.
- [ ] **U36.** Kategori: ketik di form baru/edit → saran muncul (5 kanonik + existing); simpan → tersimpan uppercase; varian huruf tak menambah kategori baru.

### Regresi + penutup
- [ ] **U22.** Input manual: cari-nama → kandidat → tambah barang (10 field) + transaksi Masuk/Keluar + pilih satuan + preview konversi.
- [ ] **U23.** History filter/pagination + chart + fast moving normal.
- [ ] **U24.** Bersih-bersih: selesaikan/hapus baris uji; cek DB 0 sisa bila fresh.

### Duplikat nama barang (case-insensitive)
- [ ] **U25.** Input nama sama beda kapital (`BERAS` saat `Beras` ada) → popup merah 409 + sebut nama & ID existing; jumlah baris DB tetap.
- [ ] **U26.** Nama mengandung `%` / `_` (`100%`, `A_B`) → TIDAK 409 palsu; tersimpan sebagai barang baru normal.
- [ ] **U27.** Ketik mirip tapi beda (`Baso SP` vs `Bakso SP`) → kartu kandidat muncul → `Pakai ini` buka form transaksi; `Buat baru` membuat baris baru (tercatat sebagai duplikat ejaan).
- [ ] **U28.** Submit 2x cepat nama sama persis → satu sukses + satu gagal constraint; DB tepat 1 baris (uji unique index).
- [ ] **U29.** Nama berspasi (`Beras` berlebih spasi) → ternormalisasi (trim + rapat); yang hasil akhirnya sama persis → 409.

### Konversi terstruktur (isi_per_gudang)
- [ ] **U30.** Keluar pilih satuan gudang berpasangan (cth 1 pack Bakso SP) → stock kurang 60 pcs + pesan `1 pack (= 60 pcs)`; preview form cocok.
- [ ] **U31.** Keluar pilih satuan gudang TANPA pasangan (cth Beras/Karung) → merah tolak + stock tetap; pesan sebut `Lengkapi Isi per Satuan Gudang`.
- [ ] **U32.** Form baru isi `Isi per Satuan Gudang` (cth 24) → transaksi berikutnya opsi kemasan terbuka + konversi benar; kosongkan → terkunci-SO.

### Edit/hapus barang (kartu inventory)
- [ ] **U33.** Edit kartu (nama/varian/kategori/divisi/restock/ket/istilah/gudang/isi/harga) → tersimpan + list refresh; nama duplikat → 409 + sebut ID; satuan tanpa ketik-ulang persis → 400; ID + stock tak terkirim.
- [ ] **U34.** Hapus kartu → modal tampil Nama/Varian/Kategori/Jumlah + `Ya, hapus`/`Batalkan`; `Ya` → barang + transaksi miliknya hilang; dipakai di pesanan/pengiriman → 409 berpesan; Batalkan → tak berubah.

-----
## Expected Output (E1–E32, peta 1:1 ke U)

- [ ] **E1.** `Terhubung` + `Supabase terhubung (5 tabel)`; nav ada di gudang, tidak ada di outlet/terima.
- [ ] **E2.** Nama outlet + `Batch masuk/Rencana kirim` + daftar `nama • varian • satuan` (tanpa stock).
- [ ] **E3.** Kolom terisi `200`, ringkasan `x200`; tidak ada pembatasan tap.
- [ ] **E4.** Popup `Pesanan PSN-... tercatat (BARU)...`; Riwayat badge `(1)` kartu abu; log `*PESANAN BARU*` + ringkasan + batch/kirim.
- [ ] **E5.** Merah `Nama pemesan wajib diisi.` / `Keranjang masih kosong.`; jumlah baris tetap.
- [ ] **E6.** Pesan kedua gabung ID sama + popup sebut digabung; ID baru bila beda hari/sudah diputus.
- [ ] **E6b.** Kartu tutup + POST 403 pesan persis `Hanya menerima pesanan di bawah jam 15.00 WIB`.
- [ ] **E6c.** Hub tanpa tab Buat.
- [ ] **E38.** Redirect login bekerja; pesan error persis (`Password salah.` / rate-limit); sesi 24 jam; password lama mati setelah ganti.
- [ ] **U40.** Surat jalan: tombol Print di kartu Daftar + detail Lacak → tab baru judul `SURAT JALAN - {OUTLET}`; angka cocok Lacak; `grandTotal` = Σ; footnote bila harga kosong; tanpa sesi → login.
- [ ] **E40.** Cetak landscape 1 lembar rapih; kolom Checklist 3 (Procurement|Driver|Outlet) kosong untuk tangan.
- [ ] **U42.** Lonceng: order/lapor uji → ≤30 dtk badge + bunyi + getar (HP); buka dropdown → Tandai dibaca → badge nol; toggle bisu → badge saja; 2 HP setting masing-masing.
- [ ] **E42.** Tanpa sesi 401 di 2 endpoint; tulis-tak-gagalkan (order tercatat walau insert lonceng gagal); bound 30 hari.
- [ ] **U40b.** SIAP KIRIM: tanpa tombol Print + endpoint 409 pesan persis; pesanan campur: baris TOLAK coret + footnote, grandTotal hanya yang dikirim.
- [ ] **U41.** Parsial: pesan 10 → putus 5 + ket → SEBAGIAN + SIAP KIRIM isi 5 + stock −5 + WA `→ kirim 5`; qty 0/negatif/>pesan/tanpa-ket/stock-kurang → 400 spesifik; payload lama tanpa qty → penuh.
- [ ] **E41.** Ringkasan `x10 → kirim 5 (kurang 5: ket)`; terima vs 5 → DITERIMA bila cocok; Note surat = ket gudang.
- [ ] **U39.** Gate penuh: tanpa sesi → `/`, `/inventory`, `/input` melempar `/gudang-masuk`; `/api/barang` + `keputusan` → 401; outlet (`/pesan`, `/terima`) tetap publik; login → `/homepage`; deep-link `/input` → login → kembali `/input`; `GUDANG_GATE=off` → terbuka semua.
- [ ] **E7.** Order toko B sukses `(BARU)`.
- [ ] **E8.** Angka = hitungan BARU; filter/cari tepat.
- [ ] **E9.** Merah `... keterangan wajib karena ditolak.`; tolak semua → `DITOLAK` + ringkasan per item.
- [ ] **E10.** Status kuning + `KRM-... SIAP KIRIM`; stock A −qty, B tetap; `Transaksi` +1 `Keluar` (cap KRM); putus ulang merah `... hanya untuk BARU.`
- [ ] **E11.** Judul `Verifikasi Kiriman` + `n/N diceklis` + input foto paket, tanpa ketik ID/kamera.
- [ ] **E12.** Tap ulang melepas ceklis; tanpa file & tanpa centang → tombol nonaktif.
- [ ] **E13.** Tombol nonaktif `Ceklis semua dulu (n/N)`; badge `✓ masuk paket`.
- [ ] **E14.** Modal link + tombol Salin/WA; log `*LINK BERITA ACARA*` + path; Lacak ada `Diverifikasi ceklis` + thumbnail Kirim/Terima; halaman terima tampil foto gudang sebelum lapor.
- [ ] **E15.** Merah `Nama penerima wajib diisi.` / `... keterangan wajib karena tidak diceklis.`
- [ ] **E16.** Alert hijau `DITERIMA`; tiap badge hijau `Sesuai` + `Dikirim X → diterima X`; refresh tidak berubah.
- [ ] **E17.** Kuning `DITERIMA SEBAGIAN`; hanya baris bermasalah badge kuning; keduanya di tab Diterima; Batal cuma DITOLAK.
- [ ] **E18.** Status SIAP KIRIM + pesanan asal; link lama `Link tidak valid.`; merah tanpa alasan; 409 pasca-terima.
- [ ] **E19.** Riwayat: ungu + tombol salin → hijau/kuning + tombol hilang; Pesan Baru aktif lagi.
- [ ] **E20.** Link lama 404, baru 200 + nama toko benar.
- [ Sukses ] **E21.** List tampil langsung (20 awal) terbaru-di-atas; filter tepat; klik kartu buka detail (tanggal, alasan, item, riwayat) + klik lagi tutup; `Muat lagi (N tersisa)` muncul bila >20; ganti filter reset ke 20 awal.
- [ ] **E22.** Popup sukses + stock berubah sesuai tombol Masuk/Keluar.
- [ ] **E23.** Grafik/tabel normal.
- [ ] **E24.** `barang/transaksi/pesanan/pengiriman` kembali ke jumlah awal.
- [ ] **E25.** Merah `Nama mirip sudah ada: Beras (MNL-...). Pakai yang ada atau ubah nama.`; count barang tetap.
- [ ] **E26.** Sukses tersimpan; nama tampil apa adanya (`100%`).
- [ ] **E27.** Kartu kandidat (nama • kategori • divisi • satuan • total) + tombol `Pakai ini`; baris baru hanya bila user paksa buat baru.
- [ ] **E28.** Satu sukses + satu gagal unik; count `lower(nama)` = 1.
- [ ] **E29.** Nama tersimpan rapi tanpa spasi berlebih; duplikat hasil normalisasi → E25.
- [ ] **E30.** `total` −60 (satuan), `transaksi` +1 `Keluar` satuan; pesan `1 pack (= 60 pcs)`.
- [ ] **E31.** Merah tak-ada-konversi; `total` dan `transaksi` tak berubah.
- [ ] **E32.** Opsi kemasan muncul + faktor dipakai; bila dikosongkan → E31.
- [ ] **E33.** Metadata berubah + list refresh; merah duplikat / satuan-tanpa-ketik; ID/stock tetap.
- [ ] **E34.** Modal detail + `Ya, hapus` → hilang total; 409 bila dipakai order; Batalkan → utuh.
