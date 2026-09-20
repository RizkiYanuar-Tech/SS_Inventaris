# Test List — Manual T2 + Supabase + Login + Surat Jalan (ganti versi T1)

> Format lapor gagal: **nomor + yang terjadi vs expected + pesan popup + status baris DB.**
> Siapkan: `node server.js` + `npm run dev -- --host --port 5173` (prod: `node server.js` saja, frontend `dist`);
> 2 Incognito (2 toko); browser gudang. Awali DB kosong: input 2 barang uji
> via `/input` (form barang baru, stock ≥ 5, catat ID: BRG-A, BRG-B).
> Catatan: WA/Fonnte DICABUT 2026-09-14 (jejak peristiwa = `console.log` + lonceng web);
> scan/kamera DICABUT 2026-09-14 (input full manual); Tab Buat + `/kirim` DICABUT 2026-09-14;
> reset-link DICABUT 2026-09-15 (token permanen, ganti password cukup);
> route `/terima/<token>` link-only + Salin Link/Kirim WA surat jalan DICABUT total 2026-09-20
> (surat jalan hanya Tab Surat Jalan di balik login outlet; endpoint uuid mati → 404).

## List Testing (U1–U48)

### Prasyarat
- [ Sukses ] **U1.** Boot tanpa error (`Supabase terhubung`); BottomNav 5 item tampil di semua halaman gudang (termasuk `/pesanan`); halaman outlet (`/pesan/*`), `/gudang-masuk`, `/surat-jalan/*` tanpa BottomNav. `/` redirect ke `/homepage`.

### Login gudang + gate penuh
- [ ] **U38.** Login gudang: tanpa sesi → buka `/`, `/homepage`, `/inventory`, `/history`, `/input`, `/pesanan` dilempar ke `/gudang-masuk`; salah → 401 generik; 10× salah/mnt → 429; benar → masuk + sesi opaque 24 jam (restart server = logout ulang); Keluar (homepage, outline-danger + confirm) → balik login; Ganti password (ketik 2×, min 4, wajib sesi) → baru berlaku, lama mati. `GUDANG_GATE=off` → semua terbuka (kill-switch).
- [ ] **U39.** Gate penuh: `GET /api/barang`, `POST /api/pesanan/:id/keputusan`, `GET /api/pengiriman` tanpa sesi → 401; jalur outlet `/pesan/*` (+ `/surat`) wajib sesi outlet (tanpa sesi → 401 + form login); endpoint uuid link-only (`GET /api/pengiriman/:token/lihat`, POST konfirmasi) dan route `/terima/*` sudah mati → 404; login → `/homepage` (atau deep-link tujuan, cth `/input` → login → kembali `/input`); BottomNav skip-fetch badge saat logout (console bersih).

### Login outlet (link permanen)
- [ ] **U43.** Buka link permanen `/pesan/<slug>-<token8>` tanpa sesi → form username+password inline (bukan isi katalog); username NULL (belum di-set gudang) → 403 minta ke gudang; salah → 401 generik (tak bocorkan slug valid); benar → masuk + cookie sesi HttpOnly 24 jam; tutup tab → login ulang (sessionStorage); 10× salah/mnt per slug+IP → 429.
- [ ] **U44.** Klaim pertama: `password_outlet` NULL + link valid + username cocok → form "Buat password pertama" (ketik 2×, min 4, sekali saja via `POST /api/pesan/:token/password-awal`) → auto-masuk; setelah terisi → form "Masukkan password" biasa; coba panggil ulang → 409 terkunci.
- [ ] **U45.** Outlet lupa password → teks di form login (`Lupa password? Hubungi gudang via WA/telepon — reset via Kelola Akun`) → gudang reset via Tab Lainnya hub (Kelola Akun: ketik 2×, hash scrypt di server) → password baru berlaku; outlet bisa ganti-sendiri via ikon Sandi header (modal, wajib sesi outlet). Reset-link lama (`POST /api/outlet/:slug/reset-link`) sudah mati → 404.

### Outlet pesan (3 tab: Pesan | Riwayat | Surat Jalan + Keranjang)
- [ Sukses ] **U2.** Buka 2 link pesan (sesudah login) → header nota outlet benar + info jadwal batch/kirim + katalog nama • varian • satuan (tanpa angka stock); tab kategori horizontal sticky + search flat lintas-kategori.
- [ Sukses ] **U3.** Ketik qty langsung (cth 200) → keranjang `x200` tanpa tap 200x; keypad angka muncul di HP; keranjang hidup di tab ikon 🛒 + badge (bukan bar bawah/modal).
- [ Sukses ] **U4.** Submit (2 barang + nama pemesan) → popup sukses + otomatis pindah Tab Riwayat; jejak `PESANAN BARU` di log server + lonceng gudang ≤30 dtk (bukan WA).
- [ Sukses ] **U5.** Tanpa nama / keranjang kosong → popup merah, tanpa baris baru.

### Loket 15:00 + gabung (ganti blokir 1-aktif 2026-09-14)
- [ ] **U6.** Loket buka (<15:00 WIB tiap hari): Tab Pesan Baru selalu tampil, pesan berkali-kali bisa; pesan kedua sehati + masih BARU → gabung ID sama (`digabung: true`, qty se-ID dijumlah, lonceng DIGABUNG); beda hari / sudah diputus (DISETUJUI/DITOLAK/DIKIRIM) → ID baru.
- [ ] **U6b.** Loket tutup (≥15:00): Tab Pesan Baru diganti kartu info `Hanya menerima pesanan di bawah jam 15.00 WIB` (bukan form); POST langsung → 403 pesan sama.
- [ ] **U6c.** Hub gudang tanpa Tab Buat (3 tab: Daftar/Lacak/Lainnya); outlet tanpa tombol batal (SOP: hubungi gudang via WA/telpon → gudang Tolak semua + keterangan → DITOLAK → boleh pesan ulang).
- [ Sukses ] **U7.** Toko lain tetap bisa pesan (isolasi per token; riwayat hanya milik token).

### Putus gudang (Tab Daftar) + parsial
- [ ] **U8.** Tab alur Baru/Siap Kirim/Dikirim/Selesai/Semua + badge hitung + search; antrean FIFO tertua-di-atas, arsip terbaru; kartu ringkas chip `✓ N dipenuhi`/`✕ M ditolak` + list penuhi ambang 4 + tolak diciutkan; putus 1 → kartu pindah tab otomatis.
- [ Sukses ] **U9.** Tolak tanpa keterangan → merah; tolak semua cukup keterangan per item (tanpa alasan umum terpisah) → DITOLAK terminal, tanpa pengiriman, tanpa kurang stock.
- [ Sukses ] **U10.** Sebagian (1 Penuhi + 1 Tolak+ket) → `DISETUJUI SEBAGIAN` + record pengiriman TERBENTUK OTOMATIS (tanpa tombol buat-manual) berisi item dipenuhi + stock kurang 1x; putus ulang → 409. ID-kembar (`-`/`-`/`-`): tolak 1 line → hanya 1 TOLAK, 2 PENUHI (posisi + multiset, anti-nular).
- [ ] **U41.** Parsial: pesan 10 → putus `qtyKirim` 5 + keterangan wajib → SEBAGIAN + SIAP KIRIM isi 5 + stock −5 + ringkasan `x10 → kirim 5 (kurang 5: ket)`; sisa hangus (tanpa backorder); qty 0/negatif/>pesan/tanpa-ket/stock-kurang → 400 spesifik; payload lama tanpa qty → penuh penuh.

### Verifikasi ceklis + foto (tanpa ID, tanpa kamera-scan)
- [ Sukses ] **U11.** Tombol `Verifikasi & Tandai` di kartu SIAP KIRIM → halaman `/input` mode verifikasi (tap kartu per line by index + 1 foto paket, tanpa ketik ID/kamera).
- [ Sukses ] **U12.** Ceklis bisa tap ulang untuk batal; tanpa foto → tombol mati sampai pilih file / centang `Lanjut tanpa foto` (gagal upload tak blokir Tandai).
- [ Sukses ] **U13.** Tombol Tandai mati sebelum N/N + foto; lengkap → tercatat `ceklis` per line + `foto_kirim` (bucket `bukti-kirim`).
- [ ] **U14.** Lengkap → Tandai (`POST /api/pengiriman/:id/kirim`) → DIKIRIM tanpa token/link/WA (layar sukses: outlet cek Tab Surat Jalan; tanpa Salin Link); kartu DIKIRIM tanpa Salin Link (tersisa Batalkan + Lacak + Print); Lacak tampil jejak `Diverifikasi ceklis` + foto kirim; foto gudang tampil di Tab Surat Jalan outlet; lapor + foto balik → foto terima tampil di Lacak.

### Terima outlet (Tab Surat Jalan, wajib login — tanpa fallback link)
- [ ] **U15.** Surat jalan via Tab Surat Jalan di link pemesanan (wajib login; badge = DIKIRIM perlu lapor; perlu-lapor di atas + arsip terkunci di bawah, pagination 5/halaman; expand inline per kartu); tiket: rel status + langkah-berikutnya + alur Pesan·Siapkan·Kirim·Terima + rincian per barang collapse + thumbnail foto kirim/terima (klik = tab baru); tanpa nama / baris-tak-diceklis tanpa jumlah+keterangan → merah; 1 tombol `Kirim Laporan Terima`. ID-kembar: ceklis 1 line tidak menular (by index). Tanpa sesi → 401 + form login (bukan isi).
- [ ] **U16.** Ceklis semua + jumlah terima = kirim + nama penerima → `DITERIMA`, badge per item hijau; refresh tetap terkunci (tolak submit ganda); gudang read-only (tanpa tombol konfirmasi terima).
- [ ] **U17.** 1 baris bermasalah (kurang/lebih/varian keliru/tak datang + jumlah terima + keterangan) → `DITERIMA SEBAGIAN` otomatis (bukan pilihan manual); Tab Riwayat filter Diterima berisi keduanya; Batal hanya untuk DITOLAK.

### Batal kirim + mirror
- [ ] **U18.** Batalkan Pengiriman (tombol sekundar, hanya pre-lapor) + alasan wajib → kembali `DISETUJUI`/`DISETUJUI SEBAGIAN` semula (tanpa link lama) + alasan di `RiwayatStatus`, stock tak diutak-atik; tanpa alasan → merah; pasca-DITERIMA/SEBAGIAN → 409 kunci mati.
- [ ] **U19.** Cek mirror: Tandai → pesanan DIKIRIM + tombol `Isi/Lihat Surat Jalan` di Riwayat lompat ke Tab Surat Jalan; terima → DITERIMA/SEBAGIAN terminal + Tab Pesan Baru aktif lagi. Refresh/duplikat submit tidak dobel kurang stock.

### Kelola akun + Lacak + surat jalan cetak + lonceng
- [ ] **U20.** Kelola Akun (Tab Lainnya): username pre-set gudang 1× (min 3, UNIQUE, lalu terkunci permanen); reset password kapan saja (ketik 2×). Token permanen (tanpa Reset link).
- [ ] **U21.** Lacak: buka tab langsung tampil list SEMUA pengiriman terbaru-di-atas tanpa pilih dulu (batas 20 + `Muat lagi`); filter outlet/status/cari menyempitkan; klik kartu expand/collapse detail; tombol Lacak di Daftar lompat ke tab Lacak. Per item: `Nama | Terkirim: X | Diterima: Y/-` + baris selisih. Chip `id_kirim` tampil di History (baris lama = tanpa chip).
- [ ] **U40.** Surat jalan cetak: tombol Print di kartu Daftar (hanya DIKIRIM ke atas; SIAP KIRIM → tombol hilang + `GET /api/surat-jalan/:idKirim` 409) + detail Lacak → tab baru `/surat-jalan/:idKirim` judul `SURAT JALAN - {OUTLET}`; angka cocok Lacak (qty/harga moving-average × qty/total, tanpa harga → 0 + footnote); `grandTotal` = Σ kirim saja; tanggal `DD/MM/YYYY`; landscape 1 lembar rapih; kolom Checklist 3 (Procurement|Driver|Outlet) kosong untuk tangan; tombol print manual `window.print()`; tanpa sesi → login; baris TOLAK tercetak urutan pesanan (nama+qty coret overlay, harga/total `-`) + footnote; Note PENUHI = ket gudang.
- [ ] **U42.** Lonceng gudang: order BARU / DIGABUNG / LAPORAN TERIMA → ≤30 dtk badge + bunyi Web Audio (hanya saat hitungan naik; sunyi pra-gesture/hidden/bisu) + getar Android; buka dropdown → Tandai dibaca → badge nol (dibaca global berdua); toggle bisu per HP (`localStorage`); header Home + hub (kecuali Input); poll numpang siklus 20 dtk hub + 30 dtk outlet (skip hidden/saving + fetch saat visible). Tanpa sesi → 401 di 2 endpoint; tulis-tak-gagalkan order; bound 30 hari.
- [ ] **U35.** Responsivitas hub: 360px 1 kolom tanpa luber; ≥768px daftar 2 kolom + hub ≤720px; ≥1200px hub ≤960px; outlet tetap kolom ramping nota (`outlet.css`); tabel inventory ≤480px sembunyi Harga+Batas+Kategori.
- [ ] **U36.** Kategori: ketik di form baru/edit → saran muncul (7 kanonik BASAH/KERING/CHEMICAL/DAIRY/KEMASAN/FROZEN/PERLENGKAPAN + existing); simpan → tersimpan uppercase; varian huruf tak menambah kategori baru.

### Regresi + penutup
- [ ] **U22.** Input manual (`/input`): cari-nama → kandidat → Masuk/Keluar (dropdown satuan/gudang + preview konversi, tolak merah bila tanpa pasangan) / form baru 10 field (tanpa kolom ID, ID auto `MNL-…`, + field Isi per Satuan Gudang opsional); Masuk wajib `totalBayar` (avg); route `/tambah-barang` + `/scan` sudah mati.
- [ ] **U23.** History filter/pagination + chart + fast moving normal; kartu Total Aset (moving-average + `N item belum ada harga`) + ikon Unduh → modal (tanggal + preview bermutasi + Unduh kini/per-tanggal, tanpa elemen meluber); tabel Explorer (toggle Kartu/Tabel, sort header, expand baris, 20/baris).
- [ ] **U24.** Bersih-bersih: selesaikan/hapus baris uji; cek DB 0 sisa bila fresh.
- [ ] **U46.** Poll ringan `?ringan=1`: poll/visible tanpa katalog (1742 vs 44022 bytes), riwayat sama; mount/submit/lapor tetap fetch penuh.
- [ ] **U47.** Pagination Riwayat + Surat Jalan 5/halaman (reset hal 1 saat ganti filter/submit/lompat; lompat dari Riwayat buka halaman tepat).
- [ ] **U48.** Pecah server: `node --check` 10/10 + `node server.js --self-check` 7/7+3/3 + route 22/22 + boot Supabase OK (`/api/gudang/sesi` 401, `/api/pesan/xxx` tanpa sesi 401 / dengan sesi 404); root `server.js` forwarder 2-baris.
- [ ] **U49.** Vendor (homepage): tambah (nama wajib; mirip → 409) → list refresh; edit inline → tersimpan; hapus (confirm) → hilang; tanpa sesi → 401.

### Duplikat nama barang (case-insensitive)
- [ ] **U25.** Input nama sama beda kapital (`BERAS` saat `Beras` ada) → popup merah 409 + sebut nama & ID existing; jumlah baris DB tetap.
- [ ] **U26.** Nama mengandung `%` / `_` (`100%`, `A_B`) → TIDAK 409 palsu; tersimpan sebagai barang baru normal.
- [ ] **U27.** Ketik mirip tapi beda (`Baso SP` vs `Bakso SP`) → kartu kandidat muncul → `Pakai ini` buka form transaksi; `Buat baru` membuat baris baru (tercatat sebagai duplikat ejaan).
- [ ] **U28.** Submit 2x cepat nama sama persis → satu sukses + satu gagal constraint; DB tepat 1 baris (uji unique index).
- [ ] **U29.** Nama berspasi berlebih → ternormalisasi (trim + rapat); hasil akhir sama persis → 409.

### Konversi terstruktur (isi_per_gudang)
- [ ] **U30.** Keluar pilih satuan gudang berpasangan (cth 1 pack Bakso SP) → stock kurang 60 pcs + pesan `1 pack (= 60 pcs)`; preview form cocok.
- [ ] **U31.** Keluar pilih satuan gudang TANPA pasangan (cth Beras/Karung) → merah tolak + stock tetap; pesan sebut `Lengkapi Isi per Satuan Gudang` (NULL = terkunci-SO).
- [ ] **U32.** Form baru isi `Isi per Satuan Gudang` (cth 24) → transaksi berikutnya opsi kemasan terbuka + konversi benar; kosongkan → terkunci-SO.

### Edit/hapus barang (kartu inventory)
- [ ] **U33.** Edit kartu (nama/merk/kategori/restock/ket/gudang/isi/harga) → tersimpan + list refresh; nama duplikat → 409 + sebut ID; satuan tanpa ketik-ulang persis → 400; ID + stock tak terkirim.
- [ ] **U34.** Hapus kartu → modal tampil Nama/Varian/Kategori/Jumlah + `Ya, hapus`/`Batalkan`; `Ya` → barang + transaksi miliknya hilang; dipakai di pesanan/pengiriman → 409 berpesan; Batalkan → tak berubah.

-----
## Expected Output (E1–E48, peta 1:1 ke U)

- [ ] **E1.** `Terhubung` + `Supabase terhubung`; nav 5 item ada di gudang, tidak ada di outlet/gudang-masuk/surat-jalan; `/` → `/homepage`.
- [ ] **E38.** Redirect login bekerja; pesan error persis (401 generik, 429 rate-limit); sesi 24 jam; password lama mati setelah ganti; `GUDANG_GATE=off` terbuka semua.
- [ ] **E39.** Tanpa sesi gudang semua endpoint gudang 401; jalur outlet `/pesan/*` wajib sesi (tanpa sesi 401 + form login); endpoint uuid + route `/terima/*` 404; deep-link kembali sesudah login; BottomNav tak fetch badge saat logout.
- [ ] **E43.** Tanpa sesi → form login (bukan katalog); username NULL → 403; salah → 401 generik; benar → masuk 24 jam; tutup tab → login ulang; 10×/mnt → 429.
- [ ] **E44.** Klaim pertama sekali + auto-masuk, lalu terkunci (panggil ulang 409); min 4 + konfirmasi sama.
- [ ] **E45.** Teks lupa-password tampil di form login; reset gudang + ganti-sendiri outlet berlaku; endpoint reset-link lama 404.
- [ ] **E2.** Nama outlet + `Batch masuk/Rencana kirim` + daftar `nama • varian • satuan` (tanpa stock) + tab kategori + search.
- [ ] **E3.** Kolom terisi `200`, ringkasan `x200`; tab 🛒 badge = macam; tidak ada pembatasan tap.
- [ ] **E4.** Popup `Pesanan PSN-... tercatat (BARU)...`; Riwayat badge `(1)`; log `PESANAN BARU` + ringkasan + batch/kirim + lonceng ≤30 dtk.
- [ ] **E5.** Merah `Nama pemesan wajib diisi.` / `Keranjang masih kosong.`; jumlah baris tetap.
- [ ] **E6.** Pesan kedua gabung ID sama + respons `digabung: true` + lonceng DIGABUNG; ID baru bila beda hari/sudah diputus.
- [ ] **E6b.** Kartu tutup + POST 403 pesan persis `Hanya menerima pesanan di bawah jam 15.00 WIB`.
- [ ] **E6c.** Hub tanpa Tab Buat; outlet tanpa tombol batal.
- [ ] **E7.** Order toko B sukses `(BARU)` (isolasi token).
- [ ] **E8.** Angka = hitungan BARU per tab alur; FIFO antrean, arsip terbaru; chip `✓/✕` + ambang 4.
- [ ] **E9.** Merah `... keterangan wajib karena ditolak.`; tolak semua → `DITOLAK` + ringkasan per item, tanpa kirim/stock.
- [ ] **E10.** Status kuning + `KRM-... SIAP KIRIM`; stock penuhi −qty, tolak tetap; `Transaksi` +1 `Keluar` (cap KRM + `id_kirim`); putus ulang merah `... hanya untuk BARU.`
- [ ] **E41.** Ringkasan `x10 → kirim 5 (kurang 5: ket)`; stock −5; terima vs 5 → DITERIMA bila cocok; Note surat = ket gudang; 400 spesifik untuk qty invalid.
- [ ] **E11.** Judul `Verifikasi Kiriman` + `n/N diceklis` + input foto paket, tanpa ketik ID/kamera.
- [ ] **E12.** Tap ulang melepas ceklis; tanpa file & tanpa centang → tombol nonaktif; gagal upload tak blokir.
- [ ] **E13.** Tombol nonaktif `Ceklis semua dulu (n/N)`; badge `✓ masuk paket`.
- [ ] **E14.** DIKIRIM tanpa token/link/WA + tanpa Salin Link di kartu maupun layar sukses; Lacak ada `Diverifikasi ceklis` + thumbnail; Tab Surat Jalan tampil foto gudang.
- [ ] **E15.** Merah `Nama penerima wajib diisi.` / `... keterangan wajib karena tidak diceklis.`; 1 tombol `Kirim Laporan Terima`.
- [ ] **E16.** Alert hijau `DITERIMA`; tiap badge hijau `Sesuai` + `Dikirim X → diterima X`; refresh terkunci.
- [ ] **E17.** Kuning `DITERIMA SEBAGIAN`; hanya baris bermasalah badge kuning; keduanya di filter Diterima; Batal cuma DITOLAK.
- [ ] **E18.** Status kembali asal + pesanan asal; tanpa link lama; merah tanpa alasan; 409 pasca-terima.
- [ ] **E19.** Riwayat: ungu DIKIRIM + `Isi Surat Jalan` → hijau/kuning + tombol hilang; Pesan Baru aktif lagi; tanpa dobel stock.
- [ ] **E20.** Kelola Akun: username terkunci permanen; password baru berlaku; token permanen (tanpa reset-link).
- [ Sukses ] **E21.** List tampil langsung (20 awal) terbaru-di-atas; filter tepat; klik kartu buka detail (tanggal, alasan, item, riwayat) + klik lagi tutup; `Muat lagi (N tersisa)` muncul bila >20; ganti filter reset ke 20 awal.
- [ ] **E40.** Tab baru judul `SURAT JALAN - {OUTLET}`; angka cocok Lacak; `grandTotal` = Σ kirim; footnote bila harga kosong; landscape 1 lembar; Checklist 3 kosong; SIAP KIRIM tanpa tombol + 409; TOLAK coret + footnote.
- [ ] **E42.** Badge + bunyi + getar ≤30 dtk; buka → baca → nol; bisu → badge saja; tanpa sesi 401; tulis-tak-gagalkan; bound 30 hari.
- [ ] **E35.** 360px 1 kolom; ≥768px 2 kolom ≤720px; ≥1200px ≤960px; outlet nota ramping.
- [ ] **E36.** Saran kategori muncul; tersimpan uppercase; varian huruf tak menambah kategori.
- [ ] **E22.** Popup sukses + stock berubah sesuai Masuk/Keluar; ID auto `MNL-…`; `/tambah-barang` + `/scan` mati.
- [ ] **E23.** Grafik/tabel normal; Total Aset + modal CSV (preview = CSV, H pre-migrasi kosong + TOTAL 0).
- [ ] **E24.** `barang/transaksi/pesanan/pengiriman` kembali ke jumlah awal.
- [ ] **E46.** Poll ringan bytes kecil, riwayat sama; penuh saat mount/submit/lapor.
- [ ] **E47.** 5/halaman; reset hal 1; lompat Riwayat → halaman tepat.
- [ ] **E48.** Self-check 7/7+3/3 + route 22/22 + boot OK (401 tanpa sesi = gate hidup).
- [ ] **E49.** Vendor tersimpan/berubah/hilang + list refresh; merah nama-kosong/mirip; 401 tanpa sesi.
- [ ] **E50.** Sesi SELESAI + arsip; stock = fisik; avg tak bergerak; BATAL tanpa tulis; tanpa sesi 401.
- [ ] **U50.** Opname: Mulai (409 bila ada terbuka) → isi fisik + Simpan → Review (4 kolom + selisih warna; ←Hitung betulkan) → Putus (confirm; stock berubah = selisih; jejak `Opname #SOP` di History) / Batal (tanpa tulis).
- [ ] **E25.** Merah `Nama mirip sudah ada: Beras (MNL-...). Pakai yang ada atau ubah nama.`; count barang tetap.
- [ ] **E26.** Sukses tersimpan; nama tampil apa adanya (`100%`).
- [ ] **E27.** Kartu kandidat (nama • kategori • satuan • stock) + tombol `Pakai ini`; baris baru hanya bila user paksa buat baru.
- [ ] **E28.** Satu sukses + satu gagal unik; count `lower(nama)` = 1.
- [ ] **E29.** Nama tersimpan rapi tanpa spasi berlebih; duplikat hasil normalisasi → E25.
- [ ] **E30.** `total` −60 (satuan), `transaksi` +1 `Keluar` satuan; pesan `1 pack (= 60 pcs)`.
- [ ] **E31.** Merah tak-ada-konversi; `total` dan `transaksi` tak berubah.
- [ ] **E32.** Opsi kemasan muncul + faktor dipakai; bila dikosongkan → E31.
- [ ] **E33.** Metadata berubah + list refresh; merah duplikat / satuan-tanpa-ketik; ID/stock tetap.
- [ ] **E34.** Modal detail + `Ya, hapus` → hilang total; 409 bila dipakai order; Batalkan → utuh.
