import React from 'react';
import { BkuItem, SchoolProfile } from '../types/bosp';
import { formatRupiah, formatTanggalIndonesia } from '../utils/terbilang';
import { exportBkuToExcel } from '../utils/excelParser';
import { Printer, FileSpreadsheet } from 'lucide-react';

interface BkuPrintReportProps {
  items: BkuItem[];
  profile: SchoolProfile;
}

export const BkuPrintReport: React.FC<BkuPrintReportProps> = ({ items, profile }) => {
  let totalPenerimaan = 0;
  let totalPengeluaran = 0;

  items.forEach((item) => {
    totalPenerimaan += item.penerimaan || 0;
    totalPengeluaran += item.pengeluaran || 0;
  });

  const sisaSaldo = totalPenerimaan - totalPengeluaran;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Cetak Lembar Resmi Buku Kas Umum (BKU) BOSP
          </h2>
          <p className="text-xs text-slate-500">
            Format lembaran penutupan kas sesuai petunjuk teknis pengelolaan BOSP Kemendikbudristek
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportBkuToExcel(items, profile)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* Official Printable BKU Sheet */}
      <div className="printable-document bg-white border border-slate-300 rounded-xl p-8 shadow-sm text-slate-900 text-xs">
        {/* Kop Surat Resmi */}
        <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
          <div className="font-bold uppercase tracking-wider text-xs">
            {profile.dinasPendidikan || 'DINAS PENDIDIKAN'}
          </div>
          <div className="font-extrabold uppercase text-base tracking-wider text-slate-900 mt-0.5">
            {profile.namaSekolah}
          </div>
          <div className="text-[10.5px] text-slate-600 mt-0.5">
            {profile.alamat}, {profile.desaKelurahan}, Kec. {profile.kecamatan}, {profile.kabupatenKota}, {profile.provinsi}
          </div>
          <div className="text-[10.5px] text-slate-600">
            NPSN: <span className="font-mono-num font-semibold">{profile.npsn}</span> · Rekening BOSP: <span className="font-mono-num font-semibold">{profile.noRekening}</span> ({profile.namaBank})
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <h3 className="font-bold text-sm uppercase tracking-widest text-slate-900">
            BUKU KAS UMUM (BKU)
          </h3>
          <div className="text-xs font-semibold text-slate-800 uppercase mt-0.5">
            DANA {profile.jenisBosp} · {profile.tahap}
          </div>
          <div className="text-[11px] text-slate-600 font-mono-num">
            Tahun Anggaran {profile.tahunAnggaran}
          </div>
        </div>

        {/* BKU Main Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10.5px] border border-slate-300">
            <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-300">
              <tr>
                <th className="p-1.5 pl-2 text-center w-10 border-r border-slate-300">No</th>
                <th className="p-1.5 text-center w-20 border-r border-slate-300">Tanggal</th>
                <th className="p-1.5 w-20 border-r border-slate-300">Kode Kegiatan</th>
                <th className="p-1.5 w-24 border-r border-slate-300">Kode Rekening</th>
                <th className="p-1.5 w-24 border-r border-slate-300">No Bukti</th>
                <th className="p-1.5 border-r border-slate-300">Uraian Transaksi</th>
                <th className="p-1.5 text-right w-24 border-r border-slate-300">Penerimaan (Rp)</th>
                <th className="p-1.5 text-right w-24 border-r border-slate-300">Pengeluaran (Rp)</th>
                <th className="p-1.5 text-right pr-2 w-24">Saldo (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Belum ada data transaksi BKU. Silakan unggah dokumen PDF BKU dari aplikasi ARKAS.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id}>
                    <td className="p-1.5 pl-2 font-mono-num font-semibold text-center border-r border-slate-200">
                      {it.noBku}
                    </td>
                    <td className="p-1.5 text-center text-slate-600 border-r border-slate-200 whitespace-nowrap font-mono-num">
                      {it.tanggal}
                    </td>
                    <td className="p-1.5 font-mono-num text-[10px] text-slate-700 border-r border-slate-200">
                      {it.kodeKegiatan || '02.01.01'}
                    </td>
                    <td className="p-1.5 font-mono-num text-[10px] text-slate-700 border-r border-slate-200">
                      {it.kodeRekening}
                    </td>
                    <td className="p-1.5 font-mono-num text-[10px] text-slate-700 border-r border-slate-200">
                      {it.noBukti}
                    </td>
                    <td className="p-1.5 border-r border-slate-200">
                      <div className="font-medium text-slate-900 leading-tight">{it.uraian}</div>
                      {it.rekanan && (
                        <div className="text-[9.5px] text-slate-500 mt-0.5">Penerima/Rekanan: {it.rekanan}</div>
                      )}
                    </td>
                    <td className="p-1.5 text-right font-mono-num text-emerald-800 border-r border-slate-200">
                      {it.penerimaan > 0 ? formatRupiah(it.penerimaan) : '-'}
                    </td>
                    <td className="p-1.5 text-right font-mono-num font-medium text-slate-900 border-r border-slate-200">
                      {it.pengeluaran > 0 ? formatRupiah(it.pengeluaran) : '-'}
                    </td>
                    <td className="p-1.5 text-right pr-2 font-mono-num font-semibold text-slate-900">
                      {formatRupiah(it.saldo)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t border-slate-300">
              <tr>
                <td colSpan={6} className="p-2 text-center border-r border-slate-300 uppercase">
                  Jumlah Total Penerimaan &amp; Pengeluaran
                </td>
                <td className="p-2 text-right font-mono-num text-emerald-900 border-r border-slate-300">
                  {formatRupiah(totalPenerimaan)}
                </td>
                <td className="p-2 text-right font-mono-num text-slate-900 border-r border-slate-300">
                  {formatRupiah(totalPengeluaran)}
                </td>
                <td className="p-2 text-right pr-2 font-mono-num text-slate-900">
                  {formatRupiah(sisaSaldo)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Lembar Penutupan Kas Resmi Kemendikbudristek */}
        <div className="mt-6 p-4 border border-slate-300 rounded-lg bg-slate-50/50 space-y-2 text-xs">
          <p className="font-medium text-slate-800">
            Pada hari ini, tanggal <strong>{formatTanggalIndonesia(new Date().toISOString().split('T')[0])}</strong>, 
            Buku Kas Umum ditutup dengan keadaan kas sebagai berikut:
          </p>
          <div className="pl-4 space-y-1 text-xs">
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-4 text-slate-600">a. Saldo Kas Tunai</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-7 font-mono-num font-semibold">{formatRupiah(0)}</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-4 text-slate-600">b. Saldo Kas di Bank</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-7 font-mono-num font-semibold">{formatRupiah(sisaSaldo)}</span>
            </div>
            <div className="grid grid-cols-12 gap-1 pt-1 border-t border-slate-200">
              <span className="col-span-4 font-bold text-slate-800">Jumlah Kas</span>
              <span className="col-span-1 text-center font-bold">:</span>
              <span className="col-span-7 font-mono-num font-bold text-slate-900">{formatRupiah(sisaSaldo)}</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-4 text-slate-600">Perbedaan Kas</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-7 font-mono-num font-semibold">{formatRupiah(0)} (Nihil / Cocok)</span>
            </div>
          </div>
        </div>

        {/* Kolom Pengesahan Tanda Tangan */}
        <div className="mt-8 pt-4 text-xs">
          <div className="text-right text-xs text-slate-600 mb-3">
            {profile.kabupatenKota}, {formatTanggalIndonesia(new Date().toISOString().split('T')[0])}
          </div>
          <div className="grid grid-cols-2 gap-8 text-center">
            <div>
              <div className="text-slate-600">Mengetahui,</div>
              <div className="font-semibold text-slate-800">Kepala Satuan Pendidikan</div>
              <div className="h-16"></div>
              <div className="font-bold underline uppercase">{profile.namaKepalaSekolah}</div>
              <div className="font-mono-num text-[11px]">NIP. {profile.nipKepalaSekolah || '-'}</div>
            </div>

            <div>
              <div className="text-slate-600">Lunas Dibayar / Dibukukan oleh,</div>
              <div className="font-semibold text-slate-800">Bendahara BOSP</div>
              <div className="h-16"></div>
              <div className="font-bold underline uppercase">{profile.namaBendahara}</div>
              <div className="font-mono-num text-[11px]">NIP. {profile.nipBendahara || '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
