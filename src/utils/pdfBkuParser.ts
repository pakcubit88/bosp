import * as pdfjsLib from 'pdfjs-dist';
import { BkuItem, BelanjaCategory } from '../types/bosp';

// Setup worker for PDF.js in Vite
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

interface TextItemWithPos {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Parser file PDF Buku Kas Umum (BKU) dari aplikasi ARKAS
 * Kolom BKU ARKAS:
 * 1. Tanggal
 * 2. Kode Kegiatan
 * 3. Kode Rekening
 * 4. No Bukti
 * 5. Uraian
 * 6. Penerimaan
 * 7. Pengeluaran
 * 8. Saldo
 */
export async function parseArkasBkuPdf(file: File): Promise<{ items: BkuItem[]; metadata?: { sekolah?: string; npsn?: string; periode?: string } }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const allPageLines: string[] = [];
  let detectedSekolah = '';
  let detectedNpsn = '';
  let detectedPeriode = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Kumpulkan text items dengan posisi koordinat X dan Y
    const items: TextItemWithPos[] = [];
    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        const str = item.str.trim();
        if (str.length > 0) {
          const transform = item.transform; // [scaleX, skewY, skewX, scaleY, tx, ty]
          items.push({
            text: item.str,
            x: transform[4],
            y: transform[5],
            width: item.width || 0,
            height: item.height || 0,
          });
        }
      }
    }

    // Kelompokkan item berdasarkan baris Y (toleransi 3-5 unit)
    const yTolerance = 4;
    const rows: { y: number; items: TextItemWithPos[] }[] = [];

    // Sort descending by Y (top of page down to bottom)
    items.sort((a, b) => b.y - a.y);

    for (const it of items) {
      let foundRow = rows.find((r) => Math.abs(r.y - it.y) <= yTolerance);
      if (!foundRow) {
        foundRow = { y: it.y, items: [] };
        rows.push(foundRow);
      }
      foundRow.items.push(it);
    }

    // Sort rows from top to bottom
    rows.sort((a, b) => b.y - a.y);

    // Di setiap row, urutkan dari kiri ke kanan (X ascending)
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const lineText = row.items.map((i) => i.text.trim()).join('   ');
      if (lineText.length > 0) {
        allPageLines.push(lineText);

        // Ekstrak info sekolah dari header jika ada
        const lower = lineText.toLowerCase();
        if (lower.includes('nama sekolah') || lower.includes('satuan pendidikan')) {
          const m = lineText.match(/(?:nama sekolah|satuan pendidikan)\s*[:]\s*(.+)/i);
          if (m && m[1]) detectedSekolah = m[1].trim();
        }
        if (lower.includes('npsn')) {
          const m = lineText.match(/npsn\s*[:]\s*([0-9]+)/i);
          if (m && m[1]) detectedNpsn = m[1].trim();
        }
        if (lower.includes('periode') || lower.includes('tahap')) {
          detectedPeriode = lineText;
        }
      }
    }
  }

  // Parse lines into BkuItems
  const parsedItems = parseLinesToBku(allPageLines);

  return {
    items: parsedItems,
    metadata: {
      sekolah: detectedSekolah,
      npsn: detectedNpsn,
      periode: detectedPeriode,
    },
  };
}

/**
 * Menafsirkan baris-baris teks PDF menjadi objek BkuItem terstruktur
 */
function parseLinesToBku(lines: string[]): BkuItem[] {
  const result: BkuItem[] = [];
  let autoNoBku = 1;
  let cumulativeSaldo = 0;

  // Regex pola tanggal: YYYY-MM-DD atau DD/MM/YYYY atau DD-MM-YYYY
  const datePattern = /(?:^|\s)(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})(?:\s|$)/;
  // Regex pola angka nominal rupiah (e.g. 1.250.000, 500.000, 0, dsb)
  const currencyNumPattern = /(?:^|\s)(?:Rp\.?\s*)?(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\b0\b)(?:\s|$)/g;

  let currentPendingItem: Partial<BkuItem> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Abaikan header atau footer lembar BKU
    const lowerLine = line.toLowerCase();
    if (
      lowerLine.includes('buku kas umum') ||
      lowerLine.includes('halaman') ||
      lowerLine.includes('kementerian pendidikan') ||
      lowerLine.includes('kode kegiatan') && lowerLine.includes('kode rekening') ||
      lowerLine.startsWith('tanggal   kode') ||
      lowerLine.startsWith('jumlah   ') ||
      lowerLine.startsWith('total   ') ||
      lowerLine.includes('mengetahui') ||
      lowerLine.includes('kepala sekolah') ||
      lowerLine.includes('bendahara bosp')
    ) {
      if (currentPendingItem && isValidBkuItem(currentPendingItem)) {
        result.push(finalizeBkuItem(currentPendingItem, autoNoBku++, cumulativeSaldo));
        cumulativeSaldo = result[result.length - 1].saldo;
        currentPendingItem = null;
      }
      continue;
    }

    // Cek apakah baris ini diawali tanggal transaksi
    const dateMatch = line.match(datePattern);

    if (dateMatch && dateMatch.index !== undefined && dateMatch.index < 10) {
      // Selesaikan item sebelumnya jika ada
      if (currentPendingItem && isValidBkuItem(currentPendingItem)) {
        const finalized = finalizeBkuItem(currentPendingItem, autoNoBku++, cumulativeSaldo);
        cumulativeSaldo = finalized.saldo;
        result.push(finalized);
      }

      const rawDate = dateMatch[1];
      const normalizedDate = normalizeDate(rawDate);
      const remainder = line.substring(dateMatch.index + rawDate.length).trim();

      // Ekstrak pola-pola dari baris ini
      const parsedRow = parseRowContent(remainder, normalizedDate);
      currentPendingItem = parsedRow;
    } else if (currentPendingItem) {
      // Baris lanjutan uraian transaksi (multiline uraian pada kolom BKU PDF)
      // Periksa apakah baris ini berisi nominal pengeluaran/saldo yang terpisah di baris bawah
      const numbersInLine = extractNumbers(line);
      if (numbersInLine.length >= 2 && currentPendingItem.penerimaan === undefined && currentPendingItem.pengeluaran === undefined) {
        currentPendingItem.pengeluaran = numbersInLine[0];
        currentPendingItem.saldo = numbersInLine[1];
      } else {
        // Gabungkan ke uraian
        currentPendingItem.uraian = ((currentPendingItem.uraian || '') + ' ' + line).trim();
      }
    }
  }

  // Selesaikan item terakhir jika masih ada
  if (currentPendingItem && isValidBkuItem(currentPendingItem)) {
    result.push(finalizeBkuItem(currentPendingItem, autoNoBku++, cumulativeSaldo));
  }

  return result;
}

function parseRowContent(text: string, dateStr: string): Partial<BkuItem> {
  const tokens = text.split(/\s{2,}|\t/).map((t) => t.trim()).filter(Boolean);

  let kodeKegiatan = '';
  let kodeRekening = '';
  let noBukti = '';
  let uraian = '';
  let penerimaan = 0;
  let pengeluaran = 0;
  let saldo = 0;

  // Pola kode rekening: e.g. 5.1.02.01.01.0024 atau 5.2.02... atau 4.1.01...
  // Pola kode kegiatan: e.g. 02.01.01 atau 03.02.01 atau 01.02.03
  // Pola no bukti: BKT-..., SP2D-..., KWT-..., 001/..., etc.

  // Ekstrak angka-angka nominal di bagian akhir
  const numbers = extractNumbers(text);

  if (numbers.length >= 3) {
    penerimaan = numbers[numbers.length - 3];
    pengeluaran = numbers[numbers.length - 2];
    saldo = numbers[numbers.length - 1];
  } else if (numbers.length === 2) {
    penerimaan = 0;
    pengeluaran = numbers[0];
    saldo = numbers[1];
  } else if (numbers.length === 1) {
    pengeluaran = numbers[0];
  }

  // Temukan kode rekening dan kode kegiatan di tokens awal
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!kodeKegiatan && /^\d{2}\.\d{2}(?:\.\d{2})?$/.test(t)) {
      kodeKegiatan = t;
    } else if (!kodeRekening && /^\d\.\d(?:\.\d{2})*(?:\.\d{4})?$/.test(t)) {
      kodeRekening = t;
    } else if (!noBukti && (t.includes('/') || t.toUpperCase().includes('BKT') || t.toUpperCase().includes('SP2D') || t.toUpperCase().includes('KW') || /^[A-Z0-9\-_]{3,}$/.test(t)) && !isNumber(t)) {
      noBukti = t;
    } else if (!isNumber(t) && t !== kodeKegiatan && t !== kodeRekening && t !== noBukti) {
      uraian = (uraian + ' ' + t).trim();
    }
  }

  // Jika kode kegiatan belum terisi, coba regex
  if (!kodeKegiatan) {
    const m = text.match(/\b\d{2}\.\d{2}(?:\.\d{2})?\b/);
    if (m) kodeKegiatan = m[0];
  }

  // Jika kode rekening belum terisi, coba regex
  if (!kodeRekening) {
    const m = text.match(/\b\d\.\d(?:\.\d{2})*(?:\.\d{4})?\b/);
    if (m) kodeRekening = m[0];
  }

  // Bersihkan uraian dari angka nominal di akhir
  uraian = cleanUraianText(uraian);

  return {
    tanggal: dateStr,
    kodeKegiatan: kodeKegiatan || '02.01.01',
    kodeRekening: kodeRekening || '5.1.02.01.01.0024',
    noBukti: noBukti || '',
    uraian: uraian || 'Belanja BOSP',
    penerimaan,
    pengeluaran,
    saldo,
  };
}

function extractNumbers(str: string): number[] {
  const matches = str.match(/(?:Rp\.?\s*)?-?\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\b[0-9]{4,12}\b|\b0\b/g);
  if (!matches) return [];
  return matches
    .map((m) => {
      const clean = m.replace(/[^0-9,-]/g, '').replace(',', '.');
      return parseFloat(clean);
    })
    .filter((n) => !isNaN(n));
}

function isNumber(val: string): boolean {
  const clean = val.replace(/[^0-9,-]/g, '').replace(',', '.');
  return !isNaN(parseFloat(clean)) && clean.length > 0;
}

function cleanUraianText(text: string): string {
  // Hapus kode rekening atau nomor bukti yang mungkin tertinggal di uraian
  return text
    .replace(/\b\d\.\d(?:\.\d{2})*(?:\.\d{4})?\b/g, '')
    .replace(/\b\d{2}\.\d{2}(?:\.\d{2})?\b/g, '')
    .replace(/(?:Rp\.?\s*)?-?\d{1,3}(?:\.\d{3})+(?:,\d{2})?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const parts = raw.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return raw;
}

function isValidBkuItem(item: Partial<BkuItem>): boolean {
  return !!item.tanggal && ((item.pengeluaran || 0) > 0 || (item.penerimaan || 0) > 0 || !!item.uraian);
}

function finalizeBkuItem(item: Partial<BkuItem>, noBkuIndex: number, currentSaldo: number): BkuItem {
  const noBku = String(noBkuIndex).padStart(3, '0');
  const pengeluaran = item.pengeluaran || 0;
  const penerimaan = item.penerimaan || 0;
  const saldo = item.saldo || currentSaldo + (penerimaan - pengeluaran);
  const uraian = item.uraian || 'Transaksi BKU BOSP';
  const rekanan = extractRekananFromUraian(uraian);
  const kategori = categorizeExpense(uraian, item.kodeRekening || '');

  return {
    id: `bku-pdf-${Date.now()}-${noBkuIndex}-${Math.random().toString(36).substring(2, 6)}`,
    noBku,
    tanggal: item.tanggal || new Date().toISOString().split('T')[0],
    kodeKegiatan: item.kodeKegiatan || '02.01.01',
    kodeRekening: item.kodeRekening || '5.1.02.01.01.0024',
    namaRekening: getNamaRekeningFromKode(item.kodeRekening || ''),
    noBukti: item.noBukti || `BKT-${noBku}`,
    uraian,
    penerimaan,
    pengeluaran,
    saldo,
    rekanan,
    kategori,
  };
}

function extractRekananFromUraian(uraian: string): string {
  if (!uraian) return 'Penyedia Rekanan';
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
  return 'Penyedia Rekanan BOSP';
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
