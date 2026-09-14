# Problem → Solve — SS_Inventaris

> Terbaru-di-atas.

NAMA FILE: `server.js` (`catatTransaksi`)
**PROBLEM**: Tulis `harga_satuan` gagal saat kolom belum dibuat via SQL user (server baru restart sebelum migrasi) — semua transaksi ikut gagal.
**SOLVED**: Best-effort seperti pola kolom foto: coba tulis dengan harga, retry tanpa harga bila error menyebut `harga`. Guard pesan migrasi eksplisit di `tambahBarangBaru` + `prosesTransaksi` bila tulis `harga_barang` gagal. Setelah migrasi, fallback jadi pengaman mati. (2026-09-11)

NAMA FILE: `server.js` (`POST /api/pesanan/:id/keputusan`) + `frontend/src/routes/DaftarPengirimanPage.jsx` (`PutusForm`)
**PROBLEM**: Alasan umum tolak redundan — penolakan per item + keterangan per item, dan `Ringkasan` sudah memuat keterangan tiap item yang dibaca outlet/gudang.
**SOLVED**: Cabut `alasanUmum` dari endpoint (termasuk guard 400 + tulis `alasan_tolak`) + input di `PutusForm` + blok tampil `alasanTolak` mati di Daftar & Riwayat outlet. Kolom DB dibiarkan (kosong). Uji API: tolak-tanpa-ket→400, all-tolak-tanpa-umum→200 `DITOLAK` + ringkasan per item. Baris uji dihapus. (2026-09-11)

NAMA FILE: `frontend/src/routes/TerimaBarangPage.jsx`
**PROBLEM**: Di halaman terima, ceklis 1 barang membuat barang lain ikut terceklis. State `laporan` keyed by ID barang (`laporan[it.id]`), padahal banyak item ber-ID sama (`-`) sehingga berbagi 1 slot state. `key={it.id}` kembar memperparah (kartu dianggap komponen sama).
**SOLVED**: `laporan` + `setLap` keyed by posisi index; submit petakan by urutan (backend baca `items[i]`, kontrak tak berubah); key jadi `` `${it.id}#${i}` `` di form + terkunci. Build OK. (2026-09-11)

NAMA FILE: `frontend/src/utils/fotoBukti.js`
**PROBLEM**: Code menunjuk bucket `foto_surat_jalan` yang ternyata tidak ada; bucket yang dibuat user adalah `bukti-kirim`. Upload gagal (bucket not found).
**SOLVED**: Kembalikan `BUCKET = 'bukti-kirim'` (baris 2 & 4); verifikasi upload anon 200 + public-read 200 via Storage REST (file probe dibersihkan). Tidak perlu SQL tambahan. (2026-09-11)

NAMA FILE: `frontend/src/components/scan/ManualVerifikasiKirim.jsx`
**PROBLEM**: Verifikasi ketik-ID per line tidak bisa dipakai: 1795 item ber-ID `-`, `MNL-…` tak bisa diketik andal di HP; cocokkan by ID rapuh untuk ID kembar.
**SOLVED**: Rewrite jadi tap kartu per baris (by index) + 1 foto paket + opsi `Lanjut tanpa foto`. Gagal upload tak blokir Tandai. Terkait: `frontend/src/utils/fotoBukti.js` (baru, kompres canvas ≤1280 JPEG 0.7, upload browser→Storage REST tanpa dep baru); `server.js` gerbang `POST /kirim` by posisi (kurang→409 sebut nama, asing→400), `cara:'ceklis'`; `client.js` teruskan `fotoKirim`. Gate diuji via API (409/400/200), baris uji dihapus. (2026-09-11)

NAMA FILE: `frontend/src/api/client.js`
**PROBLEM**: Edit fungsi `konfirmasiTerima` menghapus baris `fetch` sehingga fungsi rusak (tinggal `method:` tanpa request).
**SOLVED**: Kembalikan baris `fetch(.../konfirmasi ...)`; `payload` opaque sehingga `fotoTerima` lewat tanpa ubah signature. (2026-09-11)

NAMA FILE: — (operasional, tanpa file)
**PROBLEM**: Respons uji API masih pesan lama: server user berjalan dengan code lama di port 3000 sehingga instance uji gagal bind diam-diam dan request dijawab server lama.
**SOLVED**: Jalankan server uji di port 3100 (`$env:PORT="3100"`); server user di :3000 dibiarkan. User wajib restart `node server.js` setelah update agar code baru berlaku. (2026-09-11)

NAMA FILE: `server.js` (`simpanPengiriman`)
**PROBLEM**: Tulis `foto_kirim/foto_terima` gagal saat kolom belum dibuat via SQL user.
**SOLVED**: Tulis best-effort — sertakan kolom foto bila di-set, retry tanpa foto bila error menyebut `foto`. Kolom kini sudah ada; fallback jadi pengaman. (2026-09-11)

NAMA FILE: `frontend/.env`
**PROBLEM**: Hanya berisi `VITE_API_BACKEND`; upload browser→Storage butuh URL + anon key sehingga `fotoBukti.js` tak bisa jalan.
**SOLVED**: Salin `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` dari root `.env` (publishable = publik by design). Tetap tanpa dep `@supabase/supabase-js` (pakai fetch REST). (2026-09-11)

NAMA FILE: `frontend/src/routes/DaftarPengirimanPage.jsx` (`PutusForm`) + `server.js` (`POST /api/pesanan/:id/keputusan`)
**PROBLEM**: Tolak 1 line ikut menolak line lain yang ID-nya sama (`-`).
**SOLVED**: Cocokkan by posisi + cek multiset ID; simulasi 3×`-` lolos (hanya 1 TOLAK). (2026-09-10)

NAMA FILE: `frontend/src/routes/DaftarPengirimanPage.jsx` (Tab Lacak)
**PROBLEM**: `key={it.id}` tabrakan untuk item se-ID di list expand Lacak.
**SOLVED**: Key jadi `` `${it.id}#${idx}` ``. (2026-09-10)

NAMA FILE: `frontend/src/routes/PesanOutletPage.jsx`
**PROBLEM**: Keranjang keyed by ID (`keranjang[b.id]`) + `key={it.id}`: item se-ID (`-`) berbagi 1 input qty (ketik di satu, muncul di semua) dan 1 slot keranjang; kartu katalog key kembar.
**SOLVED**: Keranjang keyed by index katalog (`gi`, stabil terhadap search karena index ke array penuh); kartu key `` `${b.id}#${gi}` ``; ringkasan key `` `${it.id}#${it.gi}` ``; payload submit tetap `{id, qty}` sehingga backend tak berubah. Build OK. (2026-09-11)

NAMA FILE: `frontend/src/routes/DaftarPengirimanPage.jsx` (`BuatForm`) + `frontend/src/routes/BuatPengirimanPage.jsx`
**PROBLEM**: Keranjang keyed by ID (`keranjang[b.id]`): item se-ID (`-`) berbagi 1 input qty/stepper dan 1 slot keranjang; key kartu/ringkasan kembar.
**SOLVED**: Keranjang keyed by index array (`gi`/`bi`, stabil karena array hanya di-load sekali); key `` `${id}#${index}` ``; payload submit distrip ke `{id, qty}` / `{id, jumlah, satuan}` sehingga backend tak berubah. Build OK. (2026-09-11)

NAMA FILE: `frontend/src/routes/InputManualPage.jsx` + `frontend/src/components/stock/StockTable.jsx`
**PROBLEM**: `key={b.id}` / `key={item.id}` kembar di list kandidat dan kartu stock (display-only, risiko salah render + warning React).
**SOLVED**: Key jadi `` `${id}#${index}` ``. `VerifikasiKirim.jsx` (file mati, tak di-route) sengaja dibiarkan. Build OK. (2026-09-11)

NAMA FILE: `frontend/src/routes/PesanOutletPage.jsx:160`, `frontend/src/routes/DaftarPengirimanPage.jsx:126`
**PROBLEM**: Masih `key={it.id}` (tabrakan potensial, di luar bug yang dilaporkan).
**SOLVED**: Keduanya selesai (lihat dua blok di atas).
