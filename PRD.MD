# PRD — SS_Inventaris: Pesan → Kirim → Terima

## 1. Latar
- Outlet pesan via WA + spreadsheet manual → lambat, human error, tidak terlacak.
- Gudang kirim tanpa bukti terima terstruktur.
- Tujuan: 1 aplikasi web, tanpa login, link unik per outlet/pengiriman.

## 2. User & Role
- Admin Gudang: kelola stock, lihat pesanan, approve/tolak (per pesanan & per item), tandai dikirim / batalkan pengiriman, monitoring terima.
- Outlet: pesan barang + konfirmasi terima via link permanen (tanpa login).
- Non-goal: login/auth, PIN, expiry token, multi-gudang, harga/faktur, aplikasi kedua untuk outlet.
- Arsitektur (Terkunci): 1 aplikasi, 2 permukaan — permukaan gudang (`/`, `/inventory`, `/history`, `/scan`, `/pesanan`, ada BottomNav) dan permukaan outlet (`/pesan/<slug>-<token>`, `/terima/<token>`, tanpa BottomNav). Sama repo/deploy/domain/Sheet, beda route + tampilan; outlet tidak melihat nav gudang.
- 2 link: link permanen outlet `/pesan/<slug>-<token8>` (permanen, form pesan + riwayat) dan link berita acara `/terima/<token>` (sekali pakai per pengiriman; form ceklis → terkunci jadi ringkasan surat jalan).

## 3. Alur
- P1 Pesan: outlet buka link permanen `/pesan/<slug>-<token>` → Tab `Pesan Baru` (keranjang tanpa angka stock) → submit → `Pesanan/BARU` + info batch masuk & rencana kirim otomatis → popup sukses + otomatis pindah ke Tab `Riwayat`.
- P1b Batas 1 pesanan aktif (Terkunci 2026-09-09): 1 token/outlet hanya boleh punya 1 pesanan aktif (`BARU/DISETUJUI/DISETUJUI SEBAGIAN/SIAP KIRIM/DIKIRIM`). Selama masih ada yang aktif, pesan baru ditolak backend `409` + sebut ID & status aktif (berlaku untuk link outlet MAUPUN Tab Buat manual gudang — blokir total, tanpa pengecualian). Blokir lepas saat pesanan mencapai terminal (`DITERIMA/DITERIMA SEBAGIAN/DITOLAK`). `/kirim` susulan bukan pesanan sehingga tidak terpengaruh aturan ini.
- P1c SOP batal oleh outlet (Terkunci 2026-09-09): outlet TIDAK punya tombol batal; yang mau membatalkan hubungi gudang via WA/telpon → gudang eksekusi Tolak semua item + `Alasan Tolak` (→ `DITOLAK` terminal → blokir lepas → boleh pesan ulang). Tidak ada status BATAL terpisah; `DITOLAK` merangkap fungsi batal.
- P2a Kirim (jalur setuju): gudang approve per item (Penuhi / Tolak per item + keterangan manual) → status `DISETUJUI` (semua dipenuhi) / `DISETUJUI SEBAGIAN` (ada yang ditolak, ada yang dipenuhi) → sistem OTOMATIS membuat record pengiriman berisi item dipenuhi (**stock kurang 1x di titik ini**, atomik dengan approve; TIDAK ada tombol "Buat Pengiriman" manual) → status internal `SIAP KIRIM` (belum terlihat outlet) → gudang klik manual `Tandai Dikirim` (popup konfirmasi "paket sudah diserahkan?") → `DIKIRIM`: link berita acara `/terima/:token` lahir + valid, tombol `Kirim via WA` muncul. Sebelum tombol ini diklik link terima belum valid ("belum dikirim").
- P2a-R Batal kirim (mundur 1 langkah): selama outlet BELUM submit laporan, gudang boleh `Batalkan Pengiriman` (tombol sekundar + popup alasan wajib) → kembali `DISETUJUI`/`DISETUJUI SEBAGIAN` semula, link berita acara lama MATI (dibuka = "dibatalkan, tunggu link baru"), stock tidak diutak-atik, jejak minimal di kolom `RiwayatStatus`. Setelah outlet `DITERIMA`/`DITERIMA SEBAGIAN` → kunci mati, tidak bisa mundur. Tidak ada edit status bebas/dropdown.
- P2c Mirror Pesanan (Terkunci 2026-09-09): baris `Pesanan` mengikuti peristiwa `Pengiriman` (best-effort; sumber kebenaran tetap `Pengiriman`): `Tandai Dikirim` → `DIKIRIM`; `Batalkan` → asal semula (ada TOLAK = `DISETUJUI SEBAGIAN`, else `DISETUJUI`); laporan terima → `DITERIMA`/`DITERIMA SEBAGIAN` (melepas blokir P1b).
- P2b Tolak (jalur terminal): semua item ditolak → `DITOLAK` + alasan umum → **berhenti, tanpa pengiriman, tanpa kurang stock**. Outlet lihat alasan di Tab Riwayat link permanen, pesan ulang bila masih butuh.
- P3 Terima: outlet ceklis per item sesuai/tidak + jumlah terima + keterangan jika beda + nama penerima → submit → `DITERIMA` / `DITERIMA SEBAGIAN`, halaman terkunci. Gudang read-only (hanya terima info, tidak ada tombol konfirmasi terima).

## 4. Fungsional
- F1: halaman pesan outlet = 2 tab (tanpa BottomNav): Tab `Pesan Baru` (default; katalog + search + keranjang, nama + varian + satuan saja TANPA stock, info batch/kirim otomatis, nama pemesan, tombol `Kirim Pesanan`; disembunyikan dan diganti kartu info bila ada pesanan aktif — lihat P1b) dan Tab `Riwayat` (badge = pesanan aktif belum selesai; filter mungil Aktif/Diterima/Batal/Semua; daftar aktif + riwayat terbaru-di-atas; link berita acara muncul di kartu `DIKIRIM`). Validasi stock hanya di sisi gudang saat approve/kirim.
- F2: buat pesanan manual oleh gudang (masa transisi WA) — T2. Memakai endpoint yang sama dengan link outlet sehingga ikut aturan blokir P1b (token terblokir → 409 juga).
- F2b: `/kirim` Kirim Susulan / Non-Pesanan (T1): pengiriman manual tanpa pesanan (susulan kurang, tukar varian keliru, titipan/promosi); memakai fungsi inti yang sama dengan jalur otomatis approve. BUKAN "buat pengiriman" dari pesanan — tidak ada aksi itu.
- F3: approve per item — Penuhi, atau Tolak + keterangan manual per item (mencakup habis & kurang sebagian). Item ditolak = hangus (pesan ulang manual bila masih butuh, tanpa backorder otomatis).
- F4: halaman terima publik: mobile 480px, tanpa nav/BottomNav, bahasa operasional ("Ceklis jika sesuai, betulkan jumlah + tulis keterangan jika tidak"), ceklis per baris item (tanpa ceklis-global; baris bermasalah jangan diceklis + wajib jumlah terima + keterangan), 1 tombol utama `Kirim Laporan Terima` (draf disimpan belakangan = skip), nama penerima wajib, lock setelah submit. Label DITERIMA SEBAGIAN hanya sebagai badge (gudang + riwayat), bukan label form.
- F5: hub gudang `/pesanan` = 1 item BottomNav + 3 tab dalam halaman: Tab `Daftar` (history pemesanan: filter status/slot, aksi Setujui per item/Tolak/Tandai Dikirim/Batalkan Pengiriman — tanpa tombol "Buat Pengiriman"), Tab `Buat` (form pesanan manual masa transisi WA — T2), Tab `Lacak` (tracker: ringkasan surat jalan read-only per ID kirim + badge). BottomNav tetap 5 item (Home, Inventory, Pesanan [+ badge BARU di T2], History, Scan ID). List pengiriman + salin/kirim ulang link + reset link per outlet ikut di hub.
- F6: notif WA (Fonnte) ke admin gudang saja (`TARGET_NUMBER`; Terkunci 2026-09-09: tanpa nomor outlet + penerima berubah-ubah, maka tidak ada WA otomatis ke outlet): pesanan BARU masuk + laporan terima masuk + link berita acara lahir (untuk diteruskan manual) + pengingat stock yang sudah ada. Link terima ke outlet = share manual gudang (Salin Link + `wa.me` di hub `/pesanan`). WA link lahir berisi path `/terima/<token>` saja (domain publik tak dikenal server; URL penuh via Salin). Outlet memantau status via Tab Riwayat link permanen.

## 5. Data (Google Sheets — 1 file, Terkunci)
- 1 spreadsheet untuk gudang + outlet. Isolasi antar-outlet via filter `TokenOutlet` di layer API (link permanen hanya mengembalikan baris milik token itu), BUKAN via file terpisah.
- `Pesanan`: ID Pesan, SlugOutlet, TokenOutlet, Outlet, TanggalPesan (hari + tanggal + jam: `Selasa, 08 September 2026 pukul 08.05 WIB`), BatchMasuk (tanggal slot aktual + hari: `Kamis, 10 September 2026`), RencanaKirim (tanggal slot berikutnya + hari: `Senin, 14 September 2026`), Status (BARU/DISETUJUI/DISETUJUI SEBAGIAN/DITOLAK/SIAP KIRIM/DIKIRIM/DITERIMA/DITERIMA SEBAGIAN), Items JSON [{id, nama, varian, satuan, qtyPesan, keputusan: PENUHI/TOLAK, qtyKirim, keterangan}], Ringkasan, AlasanTolak, RiwayatStatus.
- `Pengiriman`: ID Kirim (KRM-YYYYMMDD-NNN), Token (uuid sekali pakai, lahir saat Tandai Dikirim), ID Pesan ref, Tanggal Buat (otomatis saat approve = record lahir, SIAP KIRIM; format hari + tanggal + jam), Tanggal Kirim (otomatis saat Tandai Dikirim = paket lepas fisik, DIKIRIM; format hari + tanggal + jam), Outlet, Status (SIAP KIRIM/DIKIRIM/DITERIMA/DITERIMA SEBAGIAN), Items JSON [{id, nama, jumlahKirim, jumlahTerima, ceklis, keterangan}], Ringkasan, Nama Penerima, Tanggal Terima (format hari + tanggal + jam), RiwayatStatus.
- Format waktu baku (bukti konkret): timestamp = `Hari, DD Bulan YYYY pukul HH.MM WIB` (sama seperti kolom Timestamp di `Transaksi`); tanggal slot (BatchMasuk/RencanaKirim) = `Hari, DD Bulan YYYY` tanpa jam. WIB Asia/Jakarta, konsisten dengan `dateParse` (detik opsional, tetap ter-parse).
- Kolom `Items JSON` = sumber mesin (app `JSON.parse`); kolom `Ringkasan` = terjemahan manusiawi diisi backend otomatis, contoh: `Susu Greenfield 250ml x10 (Penuhi); Gula Pasir 1kg x5 (Tolak: habis)`. Non-teknis baca `Ringkasan`, app baca JSON. Fungsi `buatRingkasan(items)` dipakai di semua tulis Sheet.
- Reuse `Data Inventory` (single source of truth stock & threshold) + `Transaksi` (Jenis Keluar + ket ID Kirim). Kolom Batas Restock TIDAK dicatat di Transaksi.

## 6. API
- `GET /api/pesan/:token` (auth via token saja, slug diabaikan), `POST /api/pesan/:token` (auto-hitung batch/kirim).
- `GET /api/pesanan`, `POST /api/pesanan/:id/keputusan` (per item + alasan; guard hanya dari BARU; urutan tulis: validasi stock semua penuhi → fungsi internal `buatPengiriman()` langsung → update Pesanan; saat disetujui otomatis buat record pengiriman + kurang stock 1x, tanpa endpoint buat-manual), `POST /api/outlet/:slug/reset-link`.
- `GET /api/pengiriman`, `POST /api/pengiriman/:id/kirim` (manual SIAP KIRIM→DIKIRIM + generate token terima), `POST /api/pengiriman/:id/batal-kirim` (hanya dari DIKIRIM + belum ada laporan + alasan wajib → kembali semula + matikan token), `GET /api/pengiriman/:token`, `POST /api/pengiriman/:token/konfirmasi` (hanya dari DIKIRIM, tolak submit ganda). - `POST /api/pengiriman` HANYA untuk Kirim Susulan (halaman `/kirim`, tanpa pesanan). Jalur approve pesanan (T2) memakai fungsi internal `buatPengiriman()` langsung, bukan endpoint ini (anti dobel-catat).
- Aturan: validasi stock saat kirim, token outlet 8 char acak permanen (ganti hanya via reset), token kirim 128-bit sekali pakai. Tab `Outlet` (`Slug | Token | Outlet`, tanpa WA/nama orang — identitas orang = ketikan bebas per transaksi). POST pesan dari token berpesanan-aktif → 409 + sebut ID & status (P1b).

## 7. Jadwal Slot (Terkunci)
- Slot: Senin & Kamis, cutoff 15:00 WIB (Asia/Jakarta). Gudang hanya memproses & mengirim di hari slot.
- `batchMasuk` = slot terdekat >= waktu pesan (hari slot tapi >= 15:00 → slot berikutnya; non-slot → slot berikutnya).
- `rencanaKirim` = slot berikutnya setelah `batchMasuk`.
- Contoh: Senin 10:00 → masuk Senin → kirim Kamis; Senin 16:00 → masuk Kamis → kirim Senin depan; Selasa/Rabu → masuk Kamis → kirim Senin depan; Kamis 10:00 → masuk Kamis → kirim Senin depan; Kamis 16:00 / Jumat–Minggu → masuk Senin → kirim Kamis.
- Fungsi murni `hitungSlot(waktuPesan)` + self-check; 1 implementasi dipakai POST & GET.

## 8. UI/UX
- Gudang: BottomNav 5 item (Home, Inventory, Pesanan [+ badge BARU di T2], History, Scan ID). Hub `/pesanan` 3 tab (Daftar/Buat/Lacak, aksi Setujui per item/Tolak/Tandai Dikirim/Batalkan Pengiriman — tanpa "Buat Pengiriman"); `/kirim` Kirim Susulan (T1, manual tanpa pesanan); history badge; reuse Bootstrap + BottomNav.
- Outlet link permanen (tanpa BottomNav, 1 link, 2 tab): header outlet + info jadwal; Tab `Pesan Baru` (form tanpa stock); Tab `Riwayat` (filter Aktif/Selesai/Semua, daftar terbaru-di-atas, badge warna: BARU abu / DISETUJUI biru / DISETUJUI SEBAGIAN kuning / DITOLAK merah + alasan / DIKIRIM ungu + link berita acara / DITERIMA hijau / DITERIMA SEBAGIAN kuning); Incognito-friendly. Bahasa operasional di form terima; link berita acara juga dikirim via WA sebagai cadangan.
- Validasi: qty > 0, nama pemesan/penerima wajib, baris terima tanpa ceklis wajib jumlah terima + keterangan, alasan batal-kirim wajib, tolak submit ganda, 1 pesanan aktif per token (pesan baru saat aktif → 409).

## 9. Definisi DITERIMA SEBAGIAN (Terkunci)
- DITERIMA SEBAGIAN = berita acara mini outlet tentang barang fisik yang masuk vs yang dikirim (sistem menentukan otomatis, bukan dipilih manual).
- Semua item ceklis + jumlah terima = jumlah kirim → DITERIMA. Satu saja beda (kurang/lebih/varian keliru/tidak datang + keterangan) → DITERIMA SEBAGIAN.
- Konsumen: gudang (susulan/retur/komplain, manual per kasus) + arsip (nama penerima + tanggal + rincian per item).

## 10. Non-fungsional
- HP min: HTTPS, kamera AF, Android 9+/iOS 14+, RAM 4GB (fallback 640x480/fps5).
- Scanner tetap: fps10, ideal 1280x720 (tidak diubah).
- Ngrok hanya untuk test; prod perlu URL permanen.

## 11. Acceptance
- [ ] Pesan tanpa login tercatat BARU + batch/kirim benar untuk 7 contoh jadwal (simulasi jam).
- [ ] Pesan kedua saat masih ada aktif → 409 + sebut ID aktif (berlaku link outlet + Tab Buat); setelah terminal (DITERIMA/SEBAGIAN/DITOLAK) → boleh pesan lagi; token lain tidak terpengaruh.
- [ ] Approve per item + tolak 1 item berketerangan → DISETUJUI SEBAGIAN, record pengiriman TERBENTUK OTOMATIS berisi item dipenuhi + stock kurang 1x (tanpa klik tambahan).
- [ ] Semua item ditolak → DITOLAK + alasan terlihat di link outlet.
- [ ] Tandai dikirim manual → link terima lahir + valid (sebelumnya "belum dikirim"); terima tanpa nama / baris bermasalah tanpa keterangan ditolak; lengkap → kunci + DITERIMA/DITERIMA SEBAGIAN benar; tombol tunggal `Kirim Laporan Terima`.
- [ ] Batalkan pengiriman sebelum konfirmasi outlet → kembali semula + link lama mati + alasan tercatat; setelah DITERIMA/DITERIMA SEBAGIAN → ditolak (kunci mati).
- [ ] Refresh/duplikat submit tidak dobel kurang stock; gudang tidak bisa mengubah status terima.
- [ ] Link tanpa token valid ditolak; reset link mematikan link lama.

## 12. Tahap
- T1: Terima + Kirim (prioritas). T2: Pesan outlet + slot + per-item. T3: Polish (dropdown outlet, foto bukti).
- Skip: auth/PIN/expiry, app kedua, tombol "Buat Pengiriman" manual, backorder otomatis, split shipment, status DIKEMAS.
