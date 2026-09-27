import * as XLSX from 'xlsx';
import { BkuItem, SchoolProfile, KwitansiItem, BelanjaCategory } from '../types/bosp';

/**
 * Deteksi dan konversi data mentah dari Excel/CSV ARKAS ke BkuItem[]
 */
export async function parseArkasBkuExcel(file: File): Promise<BkuItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        // Ambil sheet pertama
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Konversi ke array of array
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

        if (!rows || rows.length === 0) {
          throw new Error('File Excel kosong atau tidak memiliki data.');
        }

        // Cari baris header yang mengandung kata kunci seperti 'uraian' / 'tanggal' / 'pengeluaran' / 'kode'
        let headerRowIndex = -1;
        let colMap: Record<string, number> = {};

        for (let i = 0; i < Math.min(rows.length, 25); i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;

          const rowStr = row.map(c => String(c || '').toLowerCase().trim());
          const hasUraian = rowStr.some(c => c.includes('uraian') || c.includes('keterangan') || c.includes('transaksi'));
          const hasUang = rowStr.some(c => c.includes('pengeluaran') || c.includes('kredit') || c.includes('debet') || c.includes('penerimaan'));
          
          if (hasUraian && hasUang) {
            headerRowIndex = i;
            // Map columns
            rowStr.forEach((cell, idx) => {
              if (cell.includes('no') && (cell.includes('bku') || cell === 'no' || cell === 'no.')) colMap['noBku'] = idx;
              else if (cell.includes('tgl') || cell.includes('tanggal')) colMap['tanggal'] = idx;
              else if (cell.includes('kode') || cell.includes('rekening') || cell.includes('kegiatan')) colMap['kodeRekening'] = idx;
              else if (cell.includes('bukti') || cell.includes('faktur') || cell.includes('dokumen')) colMap['noBukti'] = idx;
              else if (cell.includes('uraian') || cell.includes('keterangan')) colMap['uraian'] = idx;
              else if (cell.includes('terima') || cell.includes('penerimaan') || cell.includes('debit') || cell.includes('debet')) colMap['penerimaan'] = idx;
              else if (cell.includes('keluar') || cell.includes('pengeluaran') || cell.includes('kredit')) colMap['pengeluaran'] = idx;
              else if (cell.includes('saldo')) colMap['saldo'] = idx;
              else if (cell.includes('rekanan') || cell.includes('penerima') || cell.includes('toko') || cell.includes('pihak')) colMap['rekanan'] = idx;
            });
            break;
          }
        }

        const items: BkuItem[] = [];
        const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 1;

        // Default column fallbacks if standard header not exact
        const idxNoBku = colMap['noBku'] ?? 0;
        const idxTanggal = colMap['tanggal'] ?? 1;
        const idxKode = colMap['kodeRekening'] ?? 2;
        const idxNoBukti = colMap['noBukti'] ?? 3;
        const idxUraian = colMap['uraian'] ?? 4;
        const idxTerima = colMap['penerimaan'] ?? 5;
        const idxKeluar = colMap['pengeluaran'] ?? 6;
        const idxSaldo = colMap['saldo'] ?? 7;
        const idxRekanan = colMap['rekanan'] ?? -1;

        let autoIndex = 1;
        let cumulativeSaldo = 0;

        for (let r = startRow; r < rows.length; r++) {
          const row = rows[r];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          const rawUraian = String(row[idxUraian] || '').trim();
          const rawTerima = parseNumber(row[idxTerima]);
          const rawKeluar = parseNumber(row[idxKeluar]);

          // Abaikan baris ringkasan/total di bawah atau baris kosong
          if (!rawUraian && rawTerima === 0 && rawKeluar === 0) continue;
          if (rawUraian.toLowerCase().startsWith('jumlah') || rawUraian.toLowerCase().startsWith('total') || rawUraian.toLowerCase().startsWith('sisa')) {
            continue;
          }

          const rawNoBku = String(row[idxNoBku] || '').trim() || String(autoIndex).padStart(3, '0');
          const rawTgl = parseDate(row[idxTanggal]);
          const rawKode = String(row[idxKode] || '').trim();
          const rawNoBukti = String(row[idxNoBukti] || '').trim() || `BKT-${rawNoBku}`;
          const rawRekanan = idxRekanan !== -1 && row[idxRekanan] ? String(row[idxRekanan]).trim() : extractRekananFromUraian(rawUraian);

          cumulativeSaldo += (rawTerima - rawKeluar);

          // Tentukan kategori belanja dari uraian/kode
          const kategori = categorizeExpense(rawUraian, rawKode);

          items.push({
            id: `bku-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
            noBku: rawNoBku,
            tanggal: rawTgl,
            kodeKegiatan: '02.01.01',
            kodeRekening: rawKode || '5.1.02.01.01.0024',
            namaRekening: getNamaRekeningFromKode(rawKode, rawUraian),
            noBukti: rawNoBukti,
            uraian: rawUraian,
            penerimaan: rawTerima,
            pengeluaran: rawKeluar,
            saldo: parseNumber(row[idxSaldo]) || cumulativeSaldo,
            rekanan: rawRekanan,
            kategori: kategori,
          });

          autoIndex++;
        }

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9,-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  // Jika format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Jika format DD/MM/YYYY
  const parts = str.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return new Date().toISOString().split('T')[0];
}

function extractRekananFromUraian(uraian: string): string {
  if (!uraian) return 'Penyedia Rekanan';
  // Check patterns like "kepada Toko X", "di Toko X", "CV. X", "PT. X"
  const match = uraian.match(/(?:toko|cv\.?|pt\.?|ud\.?|rekanan|kepada|dari)\s+([A-Za-z0-9\s.]+?)(?:[\.,;]|$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  if (uraian.toLowerCase().includes('honor')) {
    return 'Penerima Honorarium';
  }
  if (uraian.toLowerCase().includes('pln') || uraian.toLowerCase().includes('listrik')) {
    return 'PT PLN (Persero)';
  }
  if (uraian.toLowerCase().includes('telkom') || uraian.toLowerCase().includes('wifi') || uraian.toLowerCase().includes('internet')) {
    return 'PT Telkom Indonesia';
  }
  return 'Toko Rekanan Sekolah';
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

function getNamaRekeningFromKode(kode: string, uraian: string): string {
  if (kode.startsWith('5.1.02.01')) return 'Belanja Barang dan Bahan ATK';
  if (kode.startsWith('5.1.02.02')) return 'Belanja Jasa & Pemeliharaan';
  if (kode.startsWith('5.1.02.04')) return 'Belanja Perjalanan Dinas';
  if (kode.startsWith('5.1.02.05')) return 'Belanja Honorarium';
  if (kode.startsWith('5.2.02')) return 'Belanja Modal Peralatan dan Mesin';
  if (kode.startsWith('5.2.05')) return 'Belanja Modal Aset Tetap Lainnya / Buku';
  return 'Belanja Operasional Satuan Pendidikan';
}

/**
 * Generate dan unduh template BKU ARKAS dalam format Excel
 */
export function downloadBkuTemplateExcel() {
  const wsData = [
    ['BUKU KAS UMUM (BKU) DANA BOSP - FORMAT IMPOR ARKAS'],
    ['Nama Sekolah: CONTOH SD/SMP NEGERI'],
    ['Tahun Anggaran: 2026'],
    [''],
    ['No BKU', 'Tanggal', 'Kode Rekening', 'No Bukti', 'Uraian Transaksi', 'Penerimaan', 'Pengeluaran', 'Saldo', 'Rekanan / Penerima'],
    ['001', '2026-01-15', '4.1.01.01', 'SALUR-01', 'Penerimaan Penyaluran Dana BOSP Tahap I', 75000000, 0, 75000000, 'Kemenkeu / Kasda'],
    ['002', '2026-01-18', '5.1.02.01.01.0024', 'BKT-002', 'Pembelian Kertas HVS F4 dan A4 (10 Rim)', 0, 550000, 74450000, 'Toko Alat Tulis Pelajar'],
    ['003', '2026-01-18', '5.1.02.01.01.0024', 'BKT-003', 'Pembelian Tinta Printer Epson Black & Color (4 Botol)', 0, 440000, 74010000, 'Toko Alat Tulis Pelajar'],
    ['004', '2026-01-20', '5.1.02.02.01.0063', 'BKT-004', 'Pembayaran Langganan Internet & Wifi Sekolah Januari', 0, 500000, 73510000, 'PT Telkom Indonesia'],
    ['005', '2026-01-25', '5.1.02.01.01.0052', 'BKT-005', 'Konsumsi Snack Rapat Dewan Guru Persiapan Asesmen', 0, 350000, 73160000, 'Katering Bu Barokah'],
    ['006', '2026-02-05', '5.2.02.05.01.0001', 'BKT-006', 'Pengadaan Laptop Chromebook Inventaris Guru', 0, 6500000, 66660000, 'CV Citra Komputindo'],
    ['007', '2026-02-28', '5.1.02.05.01.0001', 'BKT-007', 'Honorarium Guru Non-ASN Bulan Februari (2 Orang)', 0, 2400000, 64260000, 'Penerima Honorarium']
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 10 }, // No BKU
    { wch: 14 }, // Tanggal
    { wch: 22 }, // Kode Rekening
    { wch: 16 }, // No Bukti
    { wch: 45 }, // Uraian
    { wch: 16 }, // Penerimaan
    { wch: 16 }, // Pengeluaran
    { wch: 16 }, // Saldo
    { wch: 28 }, // Rekanan
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BKU_ARKAS');
  XLSX.writeFile(wb, 'Format_Template_BKU_ARKAS.xlsx');
}

/**
 * Ekspor data BKU saat ini ke file Excel resmi BOSP
 */
export function exportBkuToExcel(items: BkuItem[], profile: SchoolProfile) {
  const wsData: any[][] = [
    ['BUKU KAS UMUM (BKU) BANTUAN OPERASIONAL SATUAN PENDIDIKAN (BOSP)'],
    [`Satuan Pendidikan : ${profile.namaSekolah} (NPSN: ${profile.npsn})`],
    [`Tahap / Tahun     : ${profile.tahap} / Tahun Anggaran ${profile.tahunAnggaran}`],
    [`Jenis BOSP        : ${profile.jenisBosp}`],
    [`Alamat Sekolah    : ${profile.alamat}, ${profile.kabupatenKota}, ${profile.provinsi}`],
    [''],
    ['No BKU', 'Tanggal', 'Kode Kegiatan', 'Kode Rekening', 'No Bukti', 'Uraian Transaksi', 'Penerimaan (Rp)', 'Pengeluaran (Rp)', 'Saldo (Rp)', 'Pihak Rekanan', 'Kategori', 'Status Kwitansi'],
  ];

  let totalTerima = 0;
  let totalKeluar = 0;

  items.forEach(item => {
    totalTerima += item.penerimaan;
    totalKeluar += item.pengeluaran;
    wsData.push([
      item.noBku,
      item.tanggal,
      item.kodeKegiatan || '02.01.01',
      item.kodeRekening,
      item.noBukti,
      item.uraian,
      item.penerimaan,
      item.pengeluaran,
      item.saldo,
      item.rekanan || '-',
      item.kategori,
      item.kwitansiId ? 'Sudah Kwitansi' : 'Belum'
    ]);
  });

  // Baris Total
  wsData.push([
    '', '', '', '', '', 'TOTAL', totalTerima, totalKeluar, totalTerima - totalKeluar, '', '', ''
  ]);

  wsData.push(['']);
  wsData.push([
    '', '', '', `Mengetahui,`, '', '', '', `Lunas Dibayar / Dibukukan,`, '', '', '', ''
  ]);
  wsData.push([
    '', '', '', `Kepala Sekolah`, '', '', '', `Bendahara BOSP`, '', '', '', ''
  ]);
  wsData.push(['', '', '', '', '', '', '', '', '', '', '', '']);
  wsData.push(['', '', '', '', '', '', '', '', '', '', '', '']);
  wsData.push([
    '', '', '', `${profile.namaKepalaSekolah}`, '', '', '', `${profile.namaBendahara}`, '', '', '', ''
  ]);
  wsData.push([
    '', '', '', `NIP. ${profile.nipKepalaSekolah}`, '', '', '', `NIP. ${profile.nipBendahara}`, '', '', '', ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 20 },
    { wch: 30 },
    { wch: 16 },
    { wch: 45 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BKU_BOSP');
  const filename = `BKU_${profile.namaSekolah.replace(/[^a-zA-Z0-9]/g, '_')}_${profile.tahap.replace(' ', '_')}_${profile.tahunAnggaran}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Ekspor Rekap Kwitansi ke Excel
 */
export function exportKwitansiListToExcel(kwitansiList: KwitansiItem[], profile: SchoolProfile) {
  const wsData: any[][] = [
    ['DAFTAR REKAPITULASI KWITANSI BOSP'],
    [`Satuan Pendidikan : ${profile.namaSekolah}`],
    [`Tahun Anggaran     : ${profile.tahunAnggaran} - ${profile.tahap}`],
    [''],
    ['No Kwitansi', 'Tanggal', 'Nomor BKU Tergabung', 'Penerima / Rekanan', 'Uraian Keperluan', 'Nilai Bruto (Rp)', 'PPN', 'PPh 21', 'PPh 22/23', 'Total Pajak', 'Netto Dibayar (Rp)'],
  ];

  let sumBruto = 0;
  let sumPajak = 0;
  let sumNetto = 0;

  kwitansiList.forEach(kw => {
    sumBruto += kw.banyaknyaUang;
    sumPajak += kw.totalPajak;
    sumNetto += kw.jumlahDiterima;

    wsData.push([
      kw.nomorKwitansi,
      kw.tanggal,
      kw.bkuNumbers.join(', '),
      kw.rekanan,
      kw.untukPembayaran,
      kw.banyaknyaUang,
      kw.ppn,
      kw.pph21,
      kw.pph22 + kw.pph23,
      kw.totalPajak,
      kw.jumlahDiterima,
    ]);
  });

  wsData.push([
    'TOTAL', '', '', '', '', sumBruto, '', '', '', sumPajak, sumNetto
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 20 },
    { wch: 14 },
    { wch: 24 },
    { wch: 28 },
    { wch: 45 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Kwitansi');
  XLSX.writeFile(wb, `Rekap_Kwitansi_${profile.namaSekolah.replace(/[^a-zA-Z0-9]/g, '_')}_${profile.tahunAnggaran}.xlsx`);
}
