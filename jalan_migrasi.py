# Runner sekali pakai: eksekusi migrasi_barang_baru.sql ke Supabase via REST bulk.
# Aman di-rerun sebagian? TIDAK — abort bila barang_inventory tidak kosong.
import json
import re
import urllib.request

BASE = None
KEY = None


def env():
    global BASE, KEY
    d = {}
    for line in open('.env', encoding='utf-8'):
        line = line.strip()
        if line and '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            d[k.strip()] = v.strip().strip('"').strip("'")
    BASE = d.get('SUPABASE_URL') or d.get('VITE_SUPABASE_URL')
    KEY = (d.get('SUPABASE_SERVICE_KEY') or d.get('SUPABASE_SERVICE_ROLE')
           or d.get('VITE_SUPABASE_SERVICE_ROLE'))
    assert BASE and KEY, 'ENV Supabase tak lengkap'


def req(method, path, body=None):
    r = urllib.request.Request(
        BASE + '/rest/v1/' + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY,
                 'Content-Type': 'application/json',
                 'Prefer': 'return=minimal'})
    try:
        with urllib.request.urlopen(r) as x:
            return x.status, x.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def count(t):
    s, b = req('GET', t + '?select=id&limit=0')
    # PostgREST count butuh Prefer count=exact; pakai head via rpc? fallback: select id limit besar
    s, b = req('GET', t + '?select=id_barang&limit=10000')
    if s != 200:
        # tabel lain (transaksi pakai id_transaksi)
        s, b = req('GET', t + '?select=id_transaksi&limit=10000')
        if s != 200:
            raise RuntimeError(t + ' baca gagal: ' + b)
    return len(json.loads(b))


def split_vals(s):
    """Pecah daftar VALUES SQL sadar-quote ('' = escape)."""
    parts, cur, i, inq = [], '', 0, False
    while i < len(s):
        c = s[i]
        if inq:
            if c == "'":
                if i + 1 < len(s) and s[i + 1] == "'":
                    cur += "'"
                    i += 2
                    continue
                inq = False
                i += 1
                continue
            cur += c
            i += 1
        else:
            if c == "'":
                inq = True
                i += 1
            elif c == ',':
                parts.append(cur.strip())
                cur = ''
                i += 1
            else:
                cur += c
                i += 1
    parts.append(cur.strip())
    return parts


def num(v):
    v = v.strip()
    if v.upper() == 'NULL' or v == '':
        return None
    return float(v) if '.' in v else int(v)


env()
n0 = count('barang_inventory')
print('barang sekarang:', n0)
if n0 != 0:
    raise SystemExit('ABORT: tabel tidak kosong, migrasi dibatalkan agar tak dobel.')

stmts = [l.strip() for l in open('migrasi_barang_baru.sql', encoding='utf-8')
         if l.strip().startswith(('INSERT', 'DELETE'))]
masters, saldos = [], []
for st in stmts:
    if st.startswith('DELETE'):
        continue  # probe dihapus via API di bawah
    m = re.match(r"INSERT INTO (\w+) \((.+?)\) VALUES \((.+)\);$", st)
    cols = [c.strip() for c in m.group(1) and m.group(2).split(',')]
    vals = split_vals(m.group(3))
    row = {}
    for c, v in zip(cols, vals):
        v = v.strip()
        if v.startswith("'") or v.upper() == 'NULL' and False:
            pass
        # nilai string sudah tanpa kutip luar via split_vals; angka/NULL mentah
        if c in ('total', 'harga_barang', 'harga_satuan', 'jumlah', 'minimum_stock'):
            row[c] = num(v)
        else:
            row[c] = None if v.upper() == 'NULL' else v
    (masters if m.group(1) == 'barang_inventory' else saldos).append(row)

print('master parsed:', len(masters), '| saldo parsed:', len(saldos))

# 1. hapus probe
s, b = req('DELETE', 'transaksi?id_barang=eq.__probe__')
print('hapus probe:', s, b[:100])

# 2. bulk insert per 100
for i in range(0, len(masters), 100):
    s, b = req('POST', 'barang_inventory', masters[i:i + 100])
    print('master batch', i, '->', s, b[:150])
    assert s in (200, 201, 204), b
for i in range(0, len(saldos), 100):
    s, b = req('POST', 'transaksi', saldos[i:i + 100])
    print('saldo batch', i, '->', s, b[:150])
    assert s in (200, 201, 204), b

print('SELESAI')
