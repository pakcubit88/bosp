import React, { useState, useRef } from 'react';
import { BkuItem, SchoolProfile } from '../types/bosp';
import { parseArkasDatabase, createSampleArkasDatabase } from '../utils/sqliteArkasParser';
import { parseArkasBkuPdf } from '../utils/pdfBkuParser';
import { parseArkasBkuExcel } from '../utils/excelParser';
import {
  X,
  CheckCircle,
  AlertCircle,
  Database,
  FileText,
  FileSpreadsheet,
  Loader2,
  FolderOpen,
  Sparkles,
  Building2,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { formatRupiah } from '../utils/terbilang';

interface ImportBkuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (
    items: BkuItem[],
    mode: 'replace' | 'append',
    profileData?: Partial<SchoolProfile>
  ) => void;
}

export const ImportBkuModal: React.FC<ImportBkuModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEncryptedDbError, setIsEncryptedDbError] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<BkuItem[] | null>(null);
  const [detectedProfile, setDetectedProfile] = useState<Partial<SchoolProfile> | undefined>(undefined);
  const [detectedTables, setDetectedTables] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'sqlite' | 'pdf' | 'excel'>('sqlite');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    setErrorMsg(null);
    setIsEncryptedDbError(false);
    setFileName(file.name);

    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv');

    try {
      if (isExcel) {
        setFileType('excel');
        const items = await parseArkasBkuExcel(file);
        if (!items || items.length === 0) {
          throw new Error('Tidak ada baris transaksi BKU yang ditemukan di dalam file Excel ini.');
        }
        setParsedPreview(items);
        setDetectedProfile(undefined);
        setDetectedTables([]);
      } else if (isPdf) {
        setFileType('pdf');
        const result = await parseArkasBkuPdf(file);
        if (!result.items || result.items.length === 0) {
          throw new Error('Tidak ditemukan transaksi BKU yang valid dalam berkas PDF ini.');
        }
        setParsedPreview(result.items);
        setDetectedProfile(
          result.metadata?.sekolah
            ? { namaSekolah: result.metadata.sekolah, npsn: result.metadata.npsn }
            : undefined
        );
        setDetectedTables([]);
      } else {
        // SQLite database file (.db, .sqlite, .sqlite3)
        setFileType('sqlite');
        const result = await parseArkasDatabase(file);
        if (!result.items || result.items.length === 0) {
          throw new Error('Tidak ada data transaksi BKU yang ditemukan di dalam database ARKAS ini.');
        }
        setParsedPreview(result.items);
        setDetectedProfile(result.profile);
        setDetectedTables(result.tableList);
      }
    } catch (err: any) {
      console.error('Error parsing ARKAS file:', err);
      const msg = err?.message || String(err);

      if (msg.includes('ENCRYPTED_ARKAS_DATABASE') || msg.includes('SQLCipher') || msg.includes('not a database')) {
        setIsEncryptedDbError(true);
        setErrorMsg('Database arkas.db ini terkunci oleh proteksi enkripsi SQLCipher resmi ARKAS.');
      } else {
        setIsEncryptedDbError(false);
        setErrorMsg(msg);
      }
      setParsedPreview(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestWithSampleDb = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setIsEncryptedDbError(false);
    setFileName('arkas_contoh.db (Database SQLite Standar)');
    try {
      const sampleFile = await createSampleArkasDatabase();
      await processFile(sampleFile);
    } catch (err: any) {
      setErrorMsg('Gagal membuat contoh database: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedPreview || parsedPreview.length === 0) return;
    onImportSuccess(parsedPreview, importMode, detectedProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-700" />
              <span>Impor Data BKU dari ARKAS</span>
            </h2>
            <p className="text-xs text-slate-500">
              Mendukung Berkas Database ARKAS (<code className="font-mono text-slate-700">.db</code>), Ekspor Excel (<code className="font-mono text-slate-700">.xlsx</code>), dan PDF BKU Resmi
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Penjelasan Enkripsi Database ARKAS jika terdeteksi */}
          {isEncryptedDbError && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-amber-900 text-sm">
                    Berkas Database `arkas.db` Terkunci Enkripsi Resmi (SQLCipher AES-256)
                  </h4>
                  <p className="text-amber-800 leading-relaxed">
                    Aplikasi desktop ARKAS (Kemendikbudristek) secara bawaan mengunci file fisik database dengan sandi enkripsi rahasia demi keamanan sistem MARKAS, sehingga file mentah <code className="font-mono bg-amber-100 px-1 rounded">.db</code> tidak dapat dibaca oleh software lain tanpa kunci tersebut.
                  </p>
                </div>
              </div>

              {/* Solusi Resmi Ekspor */}
              <div className="bg-white p-3.5 rounded-lg border border-amber-200 text-slate-800 space-y-2">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Solusi Resmi 1 Menit: Ekspor dari Aplikasi ARKAS</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[11.5px]">
                  <li>Buka aplikasi <strong>ARKAS</strong> di laptop/komputer bendahara.</li>
                  <li>Buka menu <strong>Penatausahaan</strong> &gt; pilih <strong>Buku Kas Umum (BKU)</strong> bulan berjalan.</li>
                  <li>Klik tombol <strong>"Export Excel"</strong> (menghasilkan berkas <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">.xlsx</code>) atau tombol <strong>"Cetak Dokumen"</strong> (pilih simpan sebagai PDF).</li>
                  <li>Pilih atau seret berkas <strong>Excel (.xlsx)</strong> atau <strong>PDF</strong> tersebut ke kotak di bawah ini!</li>
                </ol>
              </div>
            </div>
          )}

          {/* Panduan 3 Format Masukan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-1.5 font-bold text-emerald-950 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>1. Excel ARKAS (.xlsx / .xls)</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Hasil dari menu <em>Penatausahaan BKU &gt; Export Excel</em> di ARKAS. <strong>Paling cepat &amp; 100% akurat</strong>.
              </p>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-1.5 font-bold text-blue-950 mb-1">
                <FileText className="w-4 h-4 text-blue-700" />
                <span>2. PDF BKU ARKAS (.pdf)</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Hasil cetak laporan BKU resmi ARKAS. Sistem mengekstrak otomatis 8 kolom transaksi &amp; kop sekolah.
              </p>
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-1.5 font-bold text-purple-950 mb-1">
                <Database className="w-4 h-4 text-purple-700" />
                <span>3. Database SQLite (.db)</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                File database SQLite standar (atau unencrypted backup ARKAS/rkas.db).
              </p>
            </div>
          </div>

          {/* Upload Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-600 bg-emerald-50/50'
                : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.pdf,.db,.sqlite,.sqlite3,.csv"
              className="hidden"
            />
            {isLoading ? (
              <div className="py-4">
                <Loader2 className="w-8 h-8 mx-auto text-emerald-700 animate-spin mb-2" />
                <p className="text-xs font-semibold text-slate-800">
                  Sedang membaca berkas transaksi BKU ARKAS...
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mengekstrak kode kegiatan, rekening belanja, nomor bukti, uraian, dan nominal transaksi
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 shadow-xs">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 shadow-xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-700 shadow-xs">
                    <Database className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-900 mb-1">
                  Pilih Berkas BKU ARKAS (<code className="font-mono text-emerald-800">.xlsx</code> / <code className="font-mono text-blue-800">.pdf</code> / <code className="font-mono text-purple-800">.db</code>)
                </p>
                <p className="text-xs text-slate-500">
                  Klik untuk mencari file dari komputer atau seret file ke area ini
                </p>
                {fileName && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs font-mono font-semibold text-slate-800 mt-3">
                    {fileType === 'excel' && <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />}
                    {fileType === 'pdf' && <FileText className="w-3.5 h-3.5 text-blue-700" />}
                    {fileType === 'sqlite' && <Database className="w-3.5 h-3.5 text-purple-700" />}
                    <span>{fileName}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quick test option */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-600 gap-2">
            <span className="text-slate-500 text-[11.5px]">
              Ingin menguji kemampuan pembacaan database SQLite sekarang?
            </span>
            <button
              type="button"
              onClick={handleTestWithSampleDb}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Uji Coba Database Contoh (.db)</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && !isEncryptedDbError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Gagal Membaca File</p>
                <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Parsed Preview Table & Detected Metadata */}
          {parsedPreview && (
            <div className="space-y-3 pt-2">
              {/* Detected School Profile Info Card */}
              {detectedProfile && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-700" />
                    <div>
                      <span className="font-bold text-slate-900">
                        {detectedProfile.namaSekolah || 'Satuan Pendidikan Terdeteksi'}
                      </span>
                      {detectedProfile.npsn && (
                        <span className="text-slate-500 ml-1">· NPSN: {detectedProfile.npsn}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-600">
                    {detectedProfile.namaKepalaSekolah && (
                      <div className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                        <span>Kepsek: {detectedProfile.namaKepalaSekolah}</span>
                      </div>
                    )}
                    {detectedProfile.namaBendahara && (
                      <div className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                        <span>Bendahara: {detectedProfile.namaBendahara}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900">
                    Berhasil Membaca {parsedPreview.length} Baris Transaksi BKU ({fileType.toUpperCase()})
                  </span>
                  {detectedTables.length > 0 && (
                    <span className="text-[11px] text-slate-500">
                      ({detectedTables.length} tabel terdeteksi)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1 text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-slate-900 focus:ring-0"
                    />
                    <span>Ganti Seluruh Data BKU</span>
                  </label>
                  <label className="flex items-center gap-1 text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-slate-900 focus:ring-0"
                    />
                    <span>Tambahkan ke Data Saat Ini</span>
                  </label>
                </div>
              </div>

              {/* Table preview with 8 columns */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 text-[11px] text-slate-600 font-semibold">
                    <tr>
                      <th className="px-2 py-1.5 text-center">No BKU</th>
                      <th className="px-2 py-1.5 text-left">Tanggal</th>
                      <th className="px-2 py-1.5 text-left">Kode Kegiatan</th>
                      <th className="px-2 py-1.5 text-left">Kode Rekening</th>
                      <th className="px-2 py-1.5 text-left">No Bukti</th>
                      <th className="px-2 py-1.5 text-left">Uraian Transaksi</th>
                      <th className="px-2 py-1.5 text-right">Penerimaan</th>
                      <th className="px-2 py-1.5 text-right">Pengeluaran</th>
                      <th className="px-2 py-1.5 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedPreview.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-2 py-1 text-center font-mono-num font-semibold text-slate-700">
                          {item.noBku}
                        </td>
                        <td className="px-2 py-1 text-slate-700 whitespace-nowrap font-mono-num">
                          {item.tanggal}
                        </td>
                        <td className="px-2 py-1 font-mono-num text-[11px] text-slate-700">
                          {item.kodeKegiatan}
                        </td>
                        <td className="px-2 py-1 font-mono-num text-[11px] text-slate-700">
                          {item.kodeRekening}
                        </td>
                        <td className="px-2 py-1 font-mono-num text-[11px] text-slate-600">
                          {item.noBukti}
                        </td>
                        <td className="px-2 py-1 text-slate-900 truncate max-w-[200px]" title={item.uraian}>
                          {item.uraian}
                        </td>
                        <td className="px-2 py-1 text-right font-mono-num text-emerald-700">
                          {item.penerimaan > 0 ? formatRupiah(item.penerimaan) : '-'}
                        </td>
                        <td className="px-2 py-1 text-right font-mono-num font-semibold text-slate-900">
                          {item.pengeluaran > 0 ? formatRupiah(item.pengeluaran) : '-'}
                        </td>
                        <td className="px-2 py-1 text-right font-mono-num font-medium text-slate-900">
                          {formatRupiah(item.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!parsedPreview || parsedPreview.length === 0}
            onClick={handleConfirmImport}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-xs"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Terapkan Data BKU ({parsedPreview?.length || 0} Transaksi)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
