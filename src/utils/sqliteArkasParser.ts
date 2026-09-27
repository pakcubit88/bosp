import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { BkuItem, SchoolProfile, BelanjaCategory } from '../types/bosp';

let sqlJsInstance: SqlJsStatic | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsInstance) return sqlJsInstance;

  // 1. Fetch wasm binary manually with explicit fallback to prevent "both async and sync fetching of the wasm failed"
  let wasmBinary: ArrayBuffer | null = null;
  const wasmSources = [
    sqlWasmUrl,
    '/sql-wasm.wasm',
    'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm',
    'https://unpkg.com/sql.js@1.12.0/dist/sql-wasm.wasm'
  ];

  for (const src of wasmSources) {
    if (!src) continue;
    try {
      const resp = await fetch(src);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        if (buf && buf.byteLength > 10000) {
          wasmBinary = buf;
          break;
        }
      }
    } catch {
      // Continue to next source
    }
  }

  if (wasmBinary) {
    try {
      sqlJsInstance = await initSqlJs({ wasmBinary });
      return sqlJsInstance;
    } catch (e) {
      console.warn('Init with wasmBinary failed, trying locateFile:', e);
    }
  }

  // 2. Fallback to standard locateFile
  try {
    sqlJsInstance = await initSqlJs({
      locateFile: () => sqlWasmUrl || '/sql-wasm.wasm',
    });
    return sqlJsInstance;
  } catch (err: any) {
    console.error('All SQLite WASM initializations failed:', err);
    throw new Error('Gagal memuat engine SQLite WebAssembly: ' + (err?.message || String(err)));
  }
}

export interface ArkasDbResult {
  items: BkuItem[];
  profile?: Partial<SchoolProfile>;
  tableList: string[];
  totalRows: number;
}

/**
 * Membaca langsung file database ARKAS (.db / .sqlite / .sqlite3)
 * Mendeteksi tabel t_bku, t_bku_rkas, m_sekolah, ref_rekening, ref_kegiatan, ref_rekanan, dll.
 */
export async function parseArkasDatabase(file: File): Promise<ArkasDbResult> {
  const buffer = await file.arrayBuffer();
  const u8Array = new Uint8Array(buffer);

  // Periksa header magic number SQLite
  const headerBytes = u8Array.slice(0, 16);
  const headerStr = String.fromCharCode(...headerBytes);

  if (!headerStr.startsWith('SQLite format 3')) {
    // Database terenkripsi dengan SQLCipher atau bukan format SQLite standar
    throw new Error(
      'ENCRYPTED_ARKAS_DATABASE: Berkas database arkas.db ini terenkripsi oleh sistem keamanan ARKAS (SQLCipher AES-256). ' +
      'Aplikasi resmi ARKAS dari Kemendikbudristek secara baku mengunci file fisik database dengan sandi keamanan. ' +
      'Gunakan fitur resmi ekspor ARKAS: Buka ARKAS > Penatausahaan BKU > klik "Export Excel (.xlsx)" atau "Cetak ke PDF", lalu unggah berkas tersebut ke sini.'
    );
  }

  const SQL = await getSqlJs();

  let db: Database;
  try {
    db = new SQL.Database(u8Array);
  } catch (err: any) {
    throw new Error('Gagal membuka file database SQLite. Pastikan berkas adalah file .db ARKAS yang valid dan tidak korup.');
  }

  // 1. Dapatkan semua nama tabel dalam database
  const tablesQuery = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  const tableList: string[] = tablesQuery[0]?.values.map((v) => String(v[0])) || [];

  if (tableList.length === 0) {
    throw new Error('Database SQLite kosong atau tidak memiliki tabel.');
  }

  // 2. Baca informasi Profil Sekolah (jika ada tabel sekolah/m_sekolah/t_sekolah/config)
  const profile = extractSchoolProfileFromDb(db, tableList);

  // 3. Bangun lookup map untuk referensi kegiatan, rekening, dan rekanan
  const refKegiatanMap = extractReferenceMap(db, tableList, ['kegiatan', 'ref_kegiatan', 'm_kegiatan']);
  const refRekeningMap = extractReferenceMap(db, tableList, ['rekening', 'ref_rekening', 'm_rekening']);
  const refRekananMap = extractRekananMap(db, tableList);

  // 4. Cari tabel BKU
  const bkuTableCandidates = [
    't_bku',
    't_bku_rkas',
    'bku',
    't_transaksi',
    'bku_umum',
    't_kas',
    'bku_bank',
    'bku_tunai',
  ];

  let selectedBkuTable = tableList.find((t) => bkuTableCandidates.includes(t.toLowerCase()));

  // Jika tidak ditemukan dengan nama spesifik di atas, cari tabel yang memiliki kolom tanggal, uraian, dan kredit/pengeluaran
  if (!selectedBkuTable) {
    for (const t of tableList) {
      const colInfo = db.exec(`PRAGMA table_info("${t}");`)[0]?.values || [];
      const colNames = colInfo.map((c) => String(c[1]).toLowerCase());
      const hasDate = colNames.some((c) => c.includes('tgl') || c.includes('tanggal') || c.includes('date'));
      const hasUraian = colNames.some((c) => c.includes('uraian') || c.includes('keterangan') || c.includes('memo') || c.includes('desc'));
      const hasNominal = colNames.some((c) => c.includes('keluar') || c.includes('kredit') || c.includes('debet') || c.includes('nominal') || c.includes('jumlah') || c.includes('pengeluaran'));
      if (hasDate && hasUraian && hasNominal) {
        selectedBkuTable = t;
        break;
      }
    }
  }

  if (!selectedBkuTable) {
    throw new Error(
      `Tabel BKU tidak terdeteksi dalam database ARKAS. Tabel yang ditemukan: ${tableList.slice(0, 10).join(', ')}...`
    );
  }

  // 5. Ekstrak data dari tabel BKU
  const rawRowsQuery = db.exec(`SELECT * FROM "${selectedBkuTable}";`);
  if (!rawRowsQuery[0] || rawRowsQuery[0].values.length === 0) {
    return {
      items: [],
      profile,
      tableList,
      totalRows: 0,
    };
  }

  const columns = rawRowsQuery[0].columns;
  const colIndexMap: Record<string, number> = {};
  columns.forEach((col, idx) => {
    colIndexMap[col.toLowerCase()] = idx;
  });

  const getColVal = (row: any[], candidates: string[]): any => {
    for (const c of candidates) {
      if (colIndexMap[c] !== undefined) return row[colIndexMap[c]];
      const found = Object.keys(colIndexMap).find((k) => k.includes(c));
      if (found) return row[colIndexMap[found]];
    }
    return null;
  };

  const items: BkuItem[] = [];
  let cumulativeSaldo = 0;
  let autoIndex = 1;

  for (let r = 0; r < rawRowsQuery[0].values.length; r++) {
    const row = rawRowsQuery[0].values[r];

    const rawNoBku = getColVal(row, ['no_bku', 'no_urut', 'urutan', 'nobku', 'kode_bku', 'id']);
    const rawTgl = getColVal(row, ['tanggal', 'tgl_transaksi', 'tgl', 'date', 'created_at']);
    const rawKodeKeg = getColVal(row, ['kode_kegiatan', 'id_kegiatan', 'kegiatan_id', 'kode_program', 'kegiatan']);
    const rawKodeRek = getColVal(row, ['kode_rekening', 'id_rekening', 'rekening_id', 'kode_belanja', 'rekening']);
    const rawNoBukti = getColVal(row, ['no_bukti', 'nobukti', 'nomor_bukti', 'bukti', 'no_faktur']);
    const rawUraian = getColVal(row, ['uraian', 'keterangan', 'uraian_transaksi', 'memo', 'deskripsi']);
    const rawTerima = getColVal(row, ['penerimaan', 'debet', 'debit', 'terima', 'kas_masuk']);
    const rawKeluar = getColVal(row, ['pengeluaran', 'kredit', 'keluar', 'kas_keluar', 'nominal', 'jumlah']);
    const rawSaldo = getColVal(row, ['saldo', 'sisa_kas', 'sisa_saldo']);
    const rawRekanan = getColVal(row, ['id_rekanan', 'rekanan_id', 'rekanan', 'nama_rekanan', 'penerima', 'pihak_ketiga']);

    const penerimaan = parseNum(rawTerima);
    const pengeluaran = parseNum(rawKeluar);

    if (!rawUraian && penerimaan === 0 && pengeluaran === 0) continue;

    cumulativeSaldo += penerimaan - pengeluaran;
    const finalSaldo = rawSaldo !== null ? parseNum(rawSaldo) : cumulativeSaldo;

    const kodeKegiatanStr = resolveKegiatan(rawKodeKeg, refKegiatanMap);
    const kodeRekeningStr = resolveRekening(rawKodeRek, refRekeningMap);
    const rekananInfo = resolveRekanan(rawRekanan, refRekananMap, String(rawUraian || ''));

    const uraianStr = String(rawUraian || 'Belanja BOSP').trim();
    const kategori = categorizeExpense(uraianStr, kodeRekeningStr);

    const noBkuFormatted = rawNoBku !== null ? String(rawNoBku).padStart(3, '0') : String(autoIndex).padStart(3, '0');

    items.push({
      id: `bku-db-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
      noBku: noBkuFormatted,
      tanggal: parseDateVal(rawTgl),
      kodeKegiatan: kodeKegiatanStr || '02.01.01',
      kodeRekening: kodeRekeningStr || '5.1.02.01.01.0024',
      namaRekening: getNamaRekeningFromKode(kodeRekeningStr),
      noBukti: rawNoBukti ? String(rawNoBukti).trim() : `BKT-${noBkuFormatted}`,
      uraian: uraianStr,
      penerimaan,
      pengeluaran,
      saldo: finalSaldo,
      rekanan: rekananInfo.nama || 'Penyedia Rekanan BOSP',
      alamatRekanan: rekananInfo.alamat || '',
      npwpRekanan: rekananInfo.npwp || '',
      kategori,
    });

    autoIndex++;
  }

  items.sort((a, b) => (a.tanggal > b.tanggal ? 1 : -1));

  return {
    items,
    profile,
    tableList,
    totalRows: items.length,
  };
}

function parseNum(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const clean = String(val).replace(/[^0-9,-]/g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function parseDateVal(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  const parts = str.split(/[/.-]/);
  if (parts.length >= 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else {
      return `${parts[2].substring(0, 4)}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return new Date().toISOString().split('T')[0];
}

function extractSchoolProfileFromDb(db: Database, tableList: string[]): Partial<SchoolProfile> | undefined {
  const profileTableNames = ['m_sekolah', 'sekolah', 't_sekolah', 'profil', 't_profil', 'config', 'pengaturan'];
  const foundTable = tableList.find((t) => profileTableNames.includes(t.toLowerCase()));

  if (!foundTable) return undefined;

  try {
    const res = db.exec(`SELECT * FROM "${foundTable}" LIMIT 1;`);
    if (!res[0] || res[0].values.length === 0) return undefined;

    const cols = res[0].columns.map((c) => c.toLowerCase());
    const row = res[0].values[0];

    const getVal = (candidates: string[]) => {
      for (const cand of candidates) {
        const idx = cols.findIndex((c) => c === cand || c.includes(cand));
        if (idx !== -1 && row[idx] !== null && row[idx] !== undefined) {
          return String(row[idx]).trim();
        }
      }
      return '';
    };

    const namaSekolah = getVal(['nama_sekolah', 'nama', 'sekolah']);
    const npsn = getVal(['npsn', 'kode_sekolah']);
    const alamat = getVal(['alamat_sekolah', 'alamat', 'jalan']);
    const desaKelurahan = getVal(['kelurahan', 'desa']);
    const kecamatan = getVal(['kecamatan']);
    const kabupatenKota = getVal(['kabupaten', 'kota', 'kab_kota']);
    const provinsi = getVal(['provinsi']);
    const telepon = getVal(['no_telp', 'telepon', 'telp']);
    const email = getVal(['email']);
    const namaKepalaSekolah = getVal(['nama_kepala_sekolah', 'nama_kepsek', 'kepala_sekolah', 'kepsek']);
    const nipKepalaSekolah = getVal(['nip_kepala_sekolah', 'nip_kepsek']);
    const namaBendahara = getVal(['nama_bendahara', 'bendahara']);
    const nipBendahara = getVal(['nip_bendahara']);
    const namaBank = getVal(['nama_bank', 'bank']);
    const noRekening = getVal(['no_rekening', 'rekening', 'norek']);

    return {
      namaSekolah: namaSekolah || undefined,
      npsn: npsn || undefined,
      alamat: alamat || undefined,
      desaKelurahan: desaKelurahan || undefined,
      kecamatan: kecamatan || undefined,
      kabupatenKota: kabupatenKota || undefined,
      provinsi: provinsi || undefined,
      telepon: telepon || undefined,
      email: email || undefined,
      namaKepalaSekolah: namaKepalaSekolah || undefined,
      nipKepalaSekolah: nipKepalaSekolah || undefined,
      namaBendahara: namaBendahara || undefined,
      nipBendahara: nipBendahara || undefined,
      namaBank: namaBank || undefined,
      noRekening: noRekening || undefined,
    };
  } catch {
    return undefined;
  }
}

function extractReferenceMap(db: Database, tableList: string[], candidates: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const table = tableList.find((t) => candidates.includes(t.toLowerCase()));
  if (!table) return map;

  try {
    const res = db.exec(`SELECT * FROM "${table}";`);
    if (!res[0]) return map;

    const cols = res[0].columns.map((c) => c.toLowerCase());
    const idIdx = cols.findIndex((c) => c === 'id' || c.endsWith('_id') || c.includes('kode'));
    const kodeIdx = cols.findIndex((c) => c.includes('kode') || c === 'code');

    for (const row of res[0].values) {
      const idKey = idIdx !== -1 ? String(row[idIdx]) : '';
      const kodeVal = kodeIdx !== -1 && row[kodeIdx] ? String(row[kodeIdx]) : (idKey || '');

      if (idKey) map.set(idKey, kodeVal);
      if (kodeVal) map.set(kodeVal, kodeVal);
    }
  } catch {}
  return map;
}

interface RekananDetail {
  nama: string;
  alamat?: string;
  npwp?: string;
}

function extractRekananMap(db: Database, tableList: string[]): Map<string, RekananDetail> {
  const map = new Map<string, RekananDetail>();
  const candidateNames = ['m_rekanan', 'ref_rekanan', 'rekanan', 't_rekanan', 'penyedia'];
  const table = tableList.find((t) => candidateNames.includes(t.toLowerCase()));
  if (!table) return map;

  try {
    const res = db.exec(`SELECT * FROM "${table}";`);
    if (!res[0]) return map;

    const cols = res[0].columns.map((c) => c.toLowerCase());
    const idIdx = cols.findIndex((c) => c === 'id' || c.includes('id_rekanan'));
    const namaIdx = cols.findIndex((c) => c.includes('nama') || c.includes('rekanan'));
    const alamatIdx = cols.findIndex((c) => c.includes('alamat'));
    const npwpIdx = cols.findIndex((c) => c.includes('npwp'));

    for (const row of res[0].values) {
      const idKey = idIdx !== -1 ? String(row[idIdx]) : '';
      const nama = namaIdx !== -1 && row[namaIdx] ? String(row[namaIdx]).trim() : '';
      const alamat = alamatIdx !== -1 && row[alamatIdx] ? String(row[alamatIdx]).trim() : '';
      const npwp = npwpIdx !== -1 && row[npwpIdx] ? String(row[npwpIdx]).trim() : '';

      if (idKey && nama) {
        map.set(idKey, { nama, alamat, npwp });
      }
      if (nama) {
        map.set(nama, { nama, alamat, npwp });
      }
    }
  } catch {}
  return map;
}

function resolveKegiatan(val: any, map: Map<string, string>): string {
  if (!val) return '02.01.01';
  const str = String(val).trim();
  if (/^\d{2}\.\d{2}(?:\.\d{2})?$/.test(str)) return str;
  return map.get(str) || str || '02.01.01';
}

function resolveRekening(val: any, map: Map<string, string>): string {
  if (!val) return '5.1.02.01.01.0024';
  const str = String(val).trim();
  if (/^\d\.\d(?:\.\d{2})*(?:\.\d{4})?$/.test(str)) return str;
  return map.get(str) || str || '5.1.02.01.01.0024';
}

function resolveRekanan(val: any, map: Map<string, RekananDetail>, uraian: string): RekananDetail {
  if (val) {
    const key = String(val).trim();
    if (map.has(key)) return map.get(key)!;
    if (key.length > 2 && !/^\d+$/.test(key)) {
      return { nama: key };
    }
  }

  const match = uraian.match(/(?:toko|cv\.?|pt\.?|ud\.?|rekanan|kepada|dari)\s+([A-Za-z0-9\s.]+?)(?:[\.,;]|$)/i);
  if (match && match[1]) {
    return { nama: match[1].trim() };
  }
  if (uraian.toLowerCase().includes('honor')) {
    return { nama: 'Penerima Honorarium' };
  }
  if (uraian.toLowerCase().includes('pln') || uraian.toLowerCase().includes('listrik')) {
    return { nama: 'PT PLN (Persero)' };
  }
  if (uraian.toLowerCase().includes('telkom') || uraian.toLowerCase().includes('wifi') || uraian.toLowerCase().includes('internet')) {
    return { nama: 'PT Telkom Indonesia' };
  }
  return { nama: 'Penyedia Rekanan BOSP' };
}

function categorizeExpense(uraian: string, kode: string): BelanjaCategory {
  const text = (uraian + ' ' + kode).toLowerCase();
  if (text.includes('honor') || text.includes('gaji') || text.includes('narasumber') || text.includes('insentif')) {
    return 'Honor';
  }
  if (text.includes('modal') || text.includes('laptop') || text.includes('komputer') || text.includes('printer') || text.includes('proyektor') || text.includes('5.2.')) {
    return 'Modal/Aset';
  }
  if (text.includes('makan') || text.includes('snack') || text.includes('konsumsi') || text.includes('kue') || text.includes('minum')) {
    return 'Konsumsi';
  }
  if (text.includes('jasa') || text.includes('pemeliharaan') || text.includes('service') || text.includes('perbaikan') || text.includes('langganan') || text.includes('internet')) {
    return 'Jasa/Pemeliharaan';
  }
  return 'Barang/ATK';
}

function getNamaRekeningFromKode(kode: string): string {
  if (kode.startsWith('5.1.02.01')) return 'Belanja Barang dan Bahan ATK';
  if (kode.startsWith('5.1.02.02')) return 'Belanja Jasa & Pemeliharaan';
  if (kode.startsWith('5.1.02.04')) return 'Belanja Perjalanan Dinas';
  if (kode.startsWith('5.1.02.05')) return 'Belanja Honorarium';
  if (kode.startsWith('5.2.02')) return 'Belanja Modal Peralatan dan Mesin';
  if (kode.startsWith('5.2.05')) return 'Belanja Modal Aset Tetap Lainnya / Buku';
  return 'Belanja Operasional BOSP';
}

/**
 * Membuat file SQLite ARKAS (.db) contoh yang valid untuk pengujian
 */
export async function createSampleArkasDatabase(): Promise<File> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE m_sekolah (
      id INTEGER PRIMARY KEY,
      npsn TEXT,
      nama_sekolah TEXT,
      alamat_sekolah TEXT,
      kelurahan TEXT,
      kecamatan TEXT,
      kabupaten TEXT,
      provinsi TEXT,
      no_telp TEXT,
      email TEXT,
      nama_kepsek TEXT,
      nip_kepsek TEXT,
      nama_bendahara TEXT,
      nip_bendahara TEXT,
      bank TEXT,
      no_rekening TEXT
    );
  `);

  db.run(`
    INSERT INTO m_sekolah VALUES (
      1,
      '20401827',
      'SD NEGERI 1 CEMERLANG',
      'Jl. Pendidikan Nusantara No. 45',
      'Sukamaju',
      'Cilincing',
      'Kabupaten Bandung',
      'Jawa Barat',
      '(022) 87654321',
      'sdn1cemerlang@pendidikan.sch.id',
      'Drs. H. Bambang Suryono, M.Pd.',
      '19720514 199803 1 004',
      'Siti Rahmawati, S.Pd.',
      '19850822 201001 2 018',
      'Bank BJB',
      '0012938475019'
    );
  `);

  db.run(`
    CREATE TABLE t_bku (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_bku TEXT,
      tanggal TEXT,
      kode_kegiatan TEXT,
      kode_rekening TEXT,
      no_bukti TEXT,
      uraian TEXT,
      penerimaan REAL,
      pengeluaran REAL,
      saldo REAL,
      rekanan TEXT
    );
  `);

  db.run(`
    INSERT INTO t_bku VALUES 
    (1, '001', '2026-01-15', '01.01.01', '4.1.01.01', 'SP2D-01/BOSP/I/2026', 'Penerimaan Penyaluran Dana BOSP Tahap I Tahun 2026', 84600000, 0, 84600000, 'KPPN / Kas Daerah'),
    (2, '002', '2026-01-20', '02.01.01', '5.1.02.01.01.0024', 'BKT-002/I/2026', 'Pembelian Kertas HVS SiDU F4 75gr (15 Rim) keperluan pembelajaran', 0, 825000, 83775000, 'Toko Buku & ATK Pelajar Mandiri'),
    (3, '003', '2026-01-20', '02.01.01', '5.1.02.01.01.0024', 'BKT-003/I/2026', 'Pembelian Tinta Printer Epson 003 Black & Color (4 Set) cetak raport', 0, 1360000, 82415000, 'Toko Buku & ATK Pelajar Mandiri'),
    (4, '004', '2026-01-20', '02.01.01', '5.1.02.01.01.0024', 'BKT-004/I/2026', 'Pembelian Map Plastik dan Spidol Whiteboard Snowman keperluan asesmen', 0, 415000, 82000000, 'Toko Buku & ATK Pelajar Mandiri'),
    (5, '005', '2026-01-25', '03.02.01', '5.1.02.02.01.0063', 'BKT-005/I/2026', 'Pembayaran Tagihan Langganan Internet Sekolah 100 Mbps Bulan Januari 2026', 0, 550000, 81450000, 'PT Telkom Indonesia'),
    (6, '006', '2026-02-02', '04.01.02', '5.1.02.01.01.0052', 'BKT-006/II/2026', 'Konsumsi Snack Kotak dan Air Mineral Rapat Persiapan Asesmen Guru', 0, 625000, 80825000, 'Katering Berkah Rasa'),
    (7, '007', '2026-02-10', '05.01.01', '5.2.02.05.01.0001', 'BKT-007/II/2026', 'Pengadaan 1 Unit Laptop Chromebook Acer dan 1 Unit Proyektor Epson', 0, 12500000, 68325000, 'CV Citra Mega Solusindo'),
    (8, '008', '2026-02-28', '06.01.01', '5.1.02.05.01.0001', 'BKT-008/II/2026', 'Pembayaran Honorarium Guru Non-ASN Terdaftar Dapodik Bulan Februari (2 Orang)', 0, 3000000, 65325000, 'Penerima Honorarium');
  `);

  const binaryArray = db.export();
  const arrayBuffer = binaryArray.buffer.slice(binaryArray.byteOffset, binaryArray.byteOffset + binaryArray.byteLength) as ArrayBuffer;
  return new File([arrayBuffer], 'arkas.db', { type: 'application/x-sqlite3' });
}
