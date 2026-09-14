-- Tabel kredensial gudang (1 baris id=1, UPDATE-only dari aplikasi).
-- Skema aktual: id | password_gudang (hash scrypt, BUKAN plaintext) | created_at.
-- Jalankan di Supabase SQL Editor SEKALI.
create table if not exists gudang (
  id int primary key,
  password_gudang text,
  created_at timestamptz default now()
);

-- Hak akses (wajib: tanpa ini server dapat "permission denied for table gudang"):
grant all on table public.gudang to service_role;

-- Seed awal (ganti HASH_DARI_PERINTAH dengan hasil perintah buat-hash):
-- insert into gudang (id, password_gudang) values (1, 'HASH_DARI_PERINTAH');

-- Reset bila lupa (ganti HASH_BARU dengan hash baru):
-- update gudang set password_gudang = 'HASH_BARU' where id = 1;

-- Buat hash (jalankan di terminal, ganti PASSWORD_PILIHAN, min 4):
-- node "C:\Users\DELL\AppData\Local\Temp\opencode\buat_hash.js" "PASSWORD_PILIHAN"
