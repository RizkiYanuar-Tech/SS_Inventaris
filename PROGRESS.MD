# PROGRESS — SS_Inventaris (baca file ini + PRD.MD di awal sesi baru)

> Update file ini di akhir setiap sesi eksekusi. PRD.MD = mau dibangun apa; file ini = sudah sampai mana.

## Keputusan terkunci (ringkas; detail di PRD.MD)
- 1 aplikasi 2 permukaan; 1 spreadsheet (isolasi outlet via filter token di API).
- Link permanen `/pesan/<slug>-<token8>` (auth token saja) + link berita acara `/terima/<token>` sekali pakai.
- Slot Senin & Kamis, cutoff 15:00 WIB; `hitungSlot()` + self-check.
- Status: BARU → DISETUJUI / DISETUJUI SEBAGIAN / DITOLAK (terminal) → SIAP KIRIM → DIKIRIM → DITERIMA / DITERIMA SEBAGIAN.
- Approve per item (Penuhi / Tolak + keterangan manual); item ditolak hangus, tanpa backorder.
- Record pengiriman lahir OTOMATIS + atomik saat approve; TIDAK ada tombol buat-manual. `/kirim` = Kirim Susulan/Non-Pesanan (susulan kurang, tukar varian, titipan).
- `Tandai Dikirim` manual → token lahir; `Batalkan` hanya pre-laporan + alasan wajib + link lama mati.
- Terima: ceklis per baris, 1 tombol `Kirim Laporan Terima`, gudang read-only (surat jalan).
- Katalog outlet TANPA stock. Items JSON (mesin) + Ringkasan (manusia) + Alasan (Pengiriman saja, per-item). Header Sheet acuan: `Tanggal Buat/Kirim/Terima` (bukan `Tgl`).
- 1 pesanan aktif per token (blokir total: link outlet + Tab Buat gudang → 409; lepas saat terminal). Outlet tanpa tombol batal (SOP: minta via WA → gudang Tolak semua + Alasan Tolak). WA otomatis ke admin saja (pesanan baru + laporan terima + link lahir); link ke outlet = share manual. Tab `Outlet` (`Slug|Token|Outlet`, tanpa WA).
- BottomNav 5 item (badge BARU = T2). Outlet 2 tab (Pesan Baru | Riwayat) = T2.

## Status eksekusi (2026-09-08)
- [x] Step 0.2 — `hitungSlot()`, `buatRingkasan()`, `formatTanggalSlot()`, `formatWaktuBukti()`, self-check 7/7 (`node server.js --self-check`). File: `server.js`.
- [x] Perbaikan umum — timestamp `weekday + timeZoneName WIB` tanpa detik (`server.js`); `dateParse` detik opsional (filter/sort aman); hapus `Batas Restock` dari `Transaksi`; popup `ResultModal` di Tambah/Transaksi Barang; pagination `TransaksiPage`; SPA fallback Express 5 (`/{*splat}`); `cekHeaderPengiriman()` (lawan silent-drop lib).
- [x] T1 Kirim + Terima — backend: ref sheet toleran-boot, `buatIdKirim`, 6 endpoint pengiriman. Frontend: `client.js` +6 fn, `BottomNav` (+Pesanan, tanpa badge), `App.jsx` (route + nav kondisional), `DaftarPengirimanPage` (Daftar+Lacak), `BuatPengirimanPage`, `TerimaBarangPage`. Build OK.
- [x] 2026-09-09 Ringkasan/Alasan Pengiriman — `buatRingkasanKirim()` (`Pasta 10 -> 9`) + `buatAlasan()` (`Nama: ket; ...`) di `server.js`; header ke-13 `Alasan`; kartu Daftar tampil Alasan bila ada. `buatRingkasan()` lama dipertahankan untuk Pesanan/T2. Self-check + build OK.
- [x] Step 0.1 (MANUAL user, terverifikasi 2026-09-09 via headerValues) — `Pengiriman` 13 header (+`Alasan`), `Pesanan` 12 header (+`RiwayatStatus`), tab baru `Outlet` (`Slug | Token | Outlet`, 2 baris: sanusa-kitchen, er-coffelab).
- [ ] Step 0.1 (MANUAL user) — buat tab `Pengiriman` + `Pesanan` + header persis (lihat PRD seksi 5). Status: `Pengiriman` dibuat user ( urgensi: header sempat beda `Tgl` vs `Tanggal` → sudah diselaraskan ke `Tanggal`).
- [x] T2a backend pesan (2026-09-09, live-test lolos) — `GET /api/pesan/:token` (identitas + katalog tanpa stock + jadwal live + riwayat milik token + bolehPesan/pesananAktif), `POST /api/pesan/:token` (BARU + `hitungSlot` + guard 409 1-aktif + WA admin), `GET /api/pesanan`; guard header Pesanan/Outlet; `loadHeaderRow` saat boot (fix headerValues fresh-boot); `client.js` +3 fn. Baris uji dihapus, sheet bersih.
- [x] T2c halaman outlet (2026-09-09, build OK + route live 200) — `PesanOutletPage.jsx` 2 tab (Pesan Baru: search + keranjang tanpa stock + nama wajib + kartu blokir saat aktif | Riwayat: badge aktif + filter Aktif/Selesai/Semua + badge warna PRD + alasan DITOLAK + salin link DIKIRIM), route `/pesan/:slugToken` (token = segmen setelah strip terakhir), tanpa BottomNav.
- [x] T2b keputusan (2026-09-09, e2e lolos + sheet bersih) — `POST /api/pesanan/:id/keputusan` (guard BARU/409, set eksak, TOLAK wajib ket, semua-tolak wajib alasanUmum → DITOLAK tanpa kirim/stock; else validasi stock → `buatPengiriman()` internal → DISETUJUI/SEBAGIAN), `POST /api/outlet/:slug/reset-link` (token 8 char, lama mati), mirror P2c best-effort di kirim/batal/terima; `client.js` +2 fn. Tanpa WA di titik ini.
- [x] T2d hub gudang (2026-09-09, build OK + live lolos + sheet bersih) — `/pesanan` 3 tab: Daftar (Kelola Link Salin/Reset di atas + filter status/cari + PutusForm per item + Tandai/Batal via kiriman relasi + terminal read-only), Buat (dropdown outlet + keranjang + nama → endpoint outlet yang sama, ikut blokir), Lacak (+Alasan); badge BARU di BottomNav (refresh tiap navigasi); `GET /api/outlet` (gudang-internal, termasuk token — konsisten dgn /api/pengiriman); `client.js` +fetchOutlet. Deviasi plan: tanpa `POST /api/pesanan/manual` (token via GET sudah cukup, lebih sedikit endpoint).
- [x] T2e WA admin (2026-09-09, e2e lolos + sheet bersih) — fire-and-forget di Tandai (`*LINK BERITA ACARA*` + path) + konfirmasi (`*LAPORAN TERIMA*` + ringkasan/alasan/penerima); bukti 3x `Fonnte response` di log. Tanpa WA di titik putus.
- [x] MIGRASI Supabase (2026-09-09, full-flow lolos + DB 0/0/0/0 bersih) — `db.js` baru; `server.js` baca/tulis Supabase (4 tabel, kontrak API + frontend NOL berubah); Outlet tetap live Sheet; PK natural (transaksi surrogate `id_transaksi`), FK RESTRICT dua arah + index, `dibuat_pada` utk urutan, `satuan` + `id_kirim` di transaksi; kurang-stock atomik + kompensasi tulis. Temuan saat migrasi: kolom angka dibuat sbg text (fix via ALTER), tulis-harus-urut hormati FK, `err_message` typo ikut dibetulkan. Sheet = arsip (dikosongkan user, fresh start) kecuali tab Outlet.
- [x] Gerbang scan keluar (2026-09-09, backend lolos + DB bersih) — `POST /:id/kirim` wajib `pindaian` eksak (kurang→409 sebut ID, asing→400, kosong→409) + jejak `dipindai/cara` + riwayat; `VerifikasiKirim.jsx` di halaman Scan (mode kiriman via state; cek DB + cocok line + manual fallback bertanda; lengkap→Tandai aktif + layar link); hub tombol jadi `Pindai & Tandai`, modal kirim lama dicabut. Tanpa gerak stock di verifikasi (Masuk/Keluar manual tetap satu-satunya via scan biasa).
- [ ] T3 — Polish (dropdown outlet, foto bukti). Skip sampai T2 hidup.

## Hutang / bug diketahui
- Baris `Pengiriman` lama (pre-fix header) `Tanggal Kirim` kosong — kosmetik, tidak perlu migrasi.
- Baris historis `SELISIH` (bila ada) tetap tampil apa adanya; istilah baru hanya untuk laporan baru.
- Chunk JS > 500 kB warning (pre-existing, abaikan).
- Aturan: user edit manual kadang; eksekusi oleh AI hanya saat diminta eksplisit.

## Cara lanjut sesi baru
1. Baca `PROGRESS.MD` + `PRD.MD` + `test_list.md`.
2. Perintah mulai: "eksekusi T2" (atau step kecilnya).
