# Generator sekali pakai: DAFTAR BARANG.csv -> migrasi_barang_baru.sql
# Aturan terkunci: sub-header dibuang; divisi/istilah tidak dipakai; satuan = wadah
# hitung (dus/karton/ctn beda); kalimat isi -> keterangan; QTY apa adanya
# (titik = ribuan); kosong -> 0; duplikat digabung (stock dijumlah);
# satuan_gudang kosong semua; isi_per_gudang NULL; harga kol 14 = avg awal.
import csv
import re
import collections

SRC = 'DAFTAR BARANG.csv'
DST = 'migrasi_barang_baru.sql'

ALIAS = {
    'l': 'liter', 'ltr': 'liter', 'litre': 'liter', 'liter': 'liter',
    'ml': 'ml', 'mili': 'ml',
    'pcs': 'pcs', 'pc': 'pcs', 'piece': 'pcs', 'pieces': 'pcs', '1pcs': 'pcs',
    'pack': 'pack', 'pck': 'pack',
    'kg': 'kg', 'kilo': 'kg', 'kilogram': 'kg',
    'gr': 'gr', 'gram': 'gr', 'grams': 'gr', 'g': 'gr',
    'ctn': 'karton', 'karton': 'karton', 'kartoon': 'karton',
    'dus': 'dus', 'doos': 'dus',
    'botol': 'botol', 'btl': 'botol',
    'bungkus': 'bungkus', 'bks': 'bungkus',
    'lembar': 'lembar', 'lbr': 'lembar',
}
KNOWN = set(ALIAS.values())


def norm_satuan(raw):
    s = (raw or '').strip()
    if not s:
        return 'Pcs', ''
    low = s.lower().replace(',', ' ')
    if low in ALIAS:
        kanon = ALIAS[low]
        return ('Pcs' if kanon == 'pcs' else kanon.capitalize()), s
    toks = re.findall(r'[a-zA-Z]+', low)
    for t in toks:
        if t in ALIAS:
            kanon = ALIAS[t]
            return ('Pcs' if kanon == 'pcs' else kanon.capitalize()), s
    for t in toks:  # token alfa pertama sebagai satuan apa adanya
        return t.capitalize(), s
    return 'Pcs', s


def norm_merk(raw):
    s = (raw or '').strip()
    if not s:
        return ''
    if s.lower().replace(' ', '') in ('nomerk(pasar)', 'nomerk(pasar)'.replace(' ', ''), 'no merk(pasar)', 'nomerkpasar'):
        return 'No Merk(pasar)'
    if re.fullmatch(r'\d+\s*x\s*\d+\s*cm?', s, re.I):
        return ''  # dimensi -> pindah ke keterangan oleh pemanggil
    return s


def parse_angka(raw):
    """Format Indonesia titik-ribuan. Kembalikan (int|None, sisa_nonangka)."""
    s = (raw or '').strip()
    if not s:
        return None, ''
    m = re.match(r'[\d\.,]+', s)
    if not m:
        return None, s
    angka = m.group(0).replace('.', '')
    if ',' in angka:  # desimal koma -> bulatkan
        try:
            return int(round(float(angka.replace(',', '.')))), s[m.end():].strip()
        except ValueError:
            return None, s
    try:
        return int(angka), s[m.end():].strip()
    except ValueError:
        return None, s


def sql_str(v):
    if v is None:
        return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"


rows = list(csv.reader(open(SRC, encoding='utf-8-sig')))
data = [r for r in rows[2:] if len(r) > 2 and r[2].strip()]

gabung = collections.OrderedDict()  # kunci nama lower -> agregat
PENGECUALIAN = {('kapulaga', '100gr')}  # ukuran beda = barang beda (live: MNL-0419)
anomali = []
for r in data:
    nama = re.sub(r'\s+', ' ', r[2].strip())
    kunci = nama.lower()
    ukuran = (r[6] if len(r) > 6 else '').strip()
    if (kunci, ukuran.lower()) in PENGECUALIAN:
        kunci = kunci + '|' + ukuran.lower()
    cat = (r[3] if len(r) > 3 else '').strip().upper() or 'LAINNYA'
    merk_raw = r[5] if len(r) > 5 else ''
    merk = norm_merk(merk_raw)
    ukuran = (r[6] if len(r) > 6 else '').strip()
    sat_raw = (r[7] if len(r) > 7 else '').strip()
    satuan, _ = norm_satuan(sat_raw or ukuran)
    # satuan kanonik tampilan: pcs/Pcs? samakan gaya lama: 'Pcs' kapital
    if satuan == 'pcs':
        satuan = 'Pcs'
    # keterangan: kalimat ukuran/isi (bukan konversi)
    ket_parts = []
    if re.fullmatch(r'\d+\s*x\s*\d+\s*cm?', (merk_raw or '').strip(), re.I):
        ket_parts.append((merk_raw or '').strip())
    if ukuran and ukuran.lower() != satuan.lower():
        ket_parts.append(ukuran)
    if sat_raw and sat_raw.lower() != satuan.lower() and sat_raw != ukuran:
        ket_parts.append(sat_raw)
    keterangan = ' / '.join(ket_parts)
    qty, sisa_qty = parse_angka(r[14] if len(r) > 14 else '')
    if sisa_qty and (qty is not None):
        anomali.append(f'{nama}: QTY {r[14].strip()!r} -> {qty} (sisa {sisa_qty!r})')
    harga, _ = parse_angka(r[13] if len(r) > 13 else '')
    if qty is None:
        qty = 0
    g = gabung.get(kunci)
    if g is None:
        gabung[kunci] = {'nama': nama, 'merk': merk, 'kategori': cat,
                         'satuan': satuan, 'keterangan': keterangan,
                         'total': qty, 'harga': harga}
    else:
        g['total'] += qty
        if harga is not None:
            g['harga'] = harga
        # Satuan default (dari sel kosong) diganti bila baris lain membawa satuan nyata.
        if g['satuan'] == 'Pcs' and satuan != 'Pcs':
            g['satuan'] = satuan
        if not g['merk'] and merk:
            g['merk'] = merk
        if g['kategori'] in ('', 'LAINNYA') and cat not in ('', 'LAINNYA'):
            g['kategori'] = cat
        if keterangan and keterangan not in g['keterangan']:
            g['keterangan'] = (g['keterangan'] + ' / ' + keterangan).strip(' /')

items = list(gabung.values())
# Pengecualian (Kapulaga 100gr) pindah ke akhir agar MNL lama tak bergeser.
for _kunci in [k for k in gabung if '|' in k]:
    items.remove(gabung[_kunci])
    items.append(gabung[_kunci])
out = []
out.append('-- Migrasi master barang dari DAFTAR BARANG.csv (generator: skrip_impor_barang.py)')
out.append('-- Jalankan di Supabase SQL editor SETELAH CREATE TABLE barang_inventory (final).')
out.append('DELETE FROM transaksi WHERE id_barang = %s;' % sql_str('__probe__'))
for i, b in enumerate(items, 1):
    bid = 'MNL-%04d' % i
    b['id'] = bid
    out.append(
        'INSERT INTO barang_inventory (id_barang, nama_barang, merk, kategori, satuan,'
        ' satuan_gudang, isi_per_gudang, total, harga_barang, keterangan, minimum_stock)'
        ' VALUES (%s, %s, %s, %s, %s, %s, NULL, %s, %s, %s, 5);' % (
            sql_str(bid), sql_str(b['nama']), sql_str(b['merk']), sql_str(b['kategori']),
            sql_str(b['satuan']), sql_str(''), b['total'],
            'NULL' if b['harga'] is None else b['harga'], sql_str(b['keterangan'])))
n_saldo = 0
for b in items:
    if b['total'] > 0:
        # snapshot transaksi pakai nama kolom lama (varian/kategori_bahan) — tabel transaksi tak berubah
        out.append(
            "INSERT INTO transaksi (id_barang, nama_barang, varian, kategori_bahan, jenis,"
            " jumlah, satuan, harga_satuan) VALUES (%s, %s, %s, %s, 'Masuk', %s, %s, %s);" % (
                sql_str(b['id']), sql_str(b['nama']), sql_str(b['merk']),
                sql_str(b['kategori']), b['total'], sql_str(b['satuan']),
                'NULL' if b['harga'] is None else b['harga']))
        n_saldo += 1

open(DST, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('baris valid :', len(data))
print('master      :', len(items))
print('saldo-awal  :', n_saldo)
print('tanpa harga :', sum(1 for b in items if b['harga'] is None))
print('stock 0     :', sum(1 for b in items if b['total'] == 0))
print('kategori    :', collections.Counter(b['kategori'] for b in items).most_common())
print('satuan top  :', collections.Counter(b['satuan'] for b in items).most_common(15))
print('--- anomali QTY ---')
for a in anomali:
    print(a)
