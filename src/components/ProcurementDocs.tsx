import React, { useState, useMemo } from 'react';
import { BkuItem, SchoolProfile, KwitansiItem } from '../types/bosp';
import { terbilang, formatRupiah, formatTanggalIndonesia } from '../utils/terbilang';
import * as XLSX from 'xlsx';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  CheckCircle,
  Truck,
  FileCheck,
  Receipt,
  Plus,
  Trash2
} from 'lucide-react';

interface ProcurementDocsProps {
  bkuItems: BkuItem[];
  profile: SchoolProfile;
  kwitansiList: KwitansiItem[];
}

type DocType = 'sp' | 'bast' | 'invoice';

export const ProcurementDocs: React.FC<ProcurementDocsProps> = ({
  bkuItems,
  profile,
  kwitansiList,
}) => {
  const [activeDoc, setActiveDoc] = useState<DocType>('sp');

  // Selected source BKU / Kwitansi
  const expenseBkuItems = useMemo(
    () => bkuItems.filter((b) => b.pengeluaran > 0),
    [bkuItems]
  );

  const [selectedSourceId, setSelectedSourceId] = useState<string>(
    expenseBkuItems[0]?.id || ''
  );

  // Editable common states
  const currentBku = useMemo(
    () => bkuItems.find((b) => b.id === selectedSourceId) || expenseBkuItems[0],
    [bkuItems, selectedSourceId, expenseBkuItems]
  );

  // SP States
  const [nomorSP, setNomorSP] = useState(
    `027/SP-BOSP/${profile.tahap === 'Tahap I' ? 'I' : 'II'}/${profile.tahunAnggaran}`
  );
  const [waktuPenyelesaian, setWaktuPenyelesaian] = useState('3 (Tiga) Hari Kalender');

  // BAST States
  const [nomorBAST, setNomorBAST] = useState(
    `027/BAST-BOSP/${profile.tahap === 'Tahap I' ? 'I' : 'II'}/${profile.tahunAnggaran}`
  );
  const [namaPimpinanRekanan, setNamaPimpinanRekanan] = useState('');
  const [jabatanRekanan, setJabatanRekanan] = useState('Direktur / Pimpinan Toko');

  // Invoice States
  const [nomorInvoice, setNomorInvoice] = useState(
    `INV/${profile.tahunAnggaran}/${Math.floor(1000 + Math.random() * 9000)}`
  );

  // Dynamic Item rows
  const [docItems, setDocItems] = useState([
    {
      namaBarang: currentBku?.uraian || 'Pengadaan Alat Tulis Kantor & Kertas',
      spesifikasi: 'Standar Nasional Indonesia (SNI) / Original',
      volume: 1,
      satuan: 'Paket',
      hargaSatuan: currentBku?.pengeluaran || 500000,
      total: currentBku?.pengeluaran || 500000,
      kondisi: 'Baik & Lengkap' as const,
    },
  ]);

  // Sync when selected source changes
  const handleSourceChange = (id: string) => {
    setSelectedSourceId(id);
    const item = bkuItems.find((b) => b.id === id);
    if (item) {
      setDocItems([
        {
          namaBarang: item.uraian,
          spesifikasi: 'Standar Nasional Indonesia (SNI) / Original',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: item.pengeluaran,
          total: item.pengeluaran,
          kondisi: 'Baik & Lengkap',
        },
      ]);
    }
  };

  const totalNilai = useMemo(
    () => docItems.reduce((acc, curr) => acc + (curr.total || 0), 0),
    [docItems]
  );

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setDocItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'volume' || field === 'hargaSatuan') {
        const v = field === 'volume' ? Number(value) : copy[index].volume;
        const p = field === 'hargaSatuan' ? Number(value) : copy[index].hargaSatuan;
        copy[index].total = (v || 0) * (p || 0);
      }
      return copy;
    });
  };

  const handleAddItem = () => {
    setDocItems((prev) => [
      ...prev,
      {
        namaBarang: 'Barang Tambahan',
        spesifikasi: 'Standar / Baru',
        volume: 1,
        satuan: 'Unit/Rim/Paket',
        hargaSatuan: 0,
        total: 0,
        kondisi: 'Baik & Lengkap',
      },
    ]);
  };

  const handleDeleteItem = (index: number) => {
    setDocItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    let title = 'Surat_Pesanan';
    let data: any[][] = [];

    if (activeDoc === 'sp') {
      title = 'Surat_Pesanan';
      data = [
        ['SURAT PESANAN (SP) PENGADAAN BARANG/JASA BOSP'],
        [`Satuan Pendidikan : ${profile.namaSekolah}`],
        [`Nomor SP          : ${nomorSP}`],
        [`Penyedia / Rekanan: ${currentBku?.rekanan || 'Penyedia'}`],
        [''],
        ['No', 'Nama Barang / Jasa', 'Spesifikasi', 'Volume', 'Satuan', 'Harga Satuan (Rp)', 'Total (Rp)'],
        ...docItems.map((it, idx) => [
          idx + 1,
          it.namaBarang,
          it.spesifikasi,
          it.volume,
          it.satuan,
          it.hargaSatuan,
          it.total,
        ]),
        ['', '', '', '', 'TOTAL NILAI', '', totalNilai],
      ];
    } else if (activeDoc === 'bast') {
      title = 'BAST_Barang';
      data = [
        ['BERITA ACARA SERAH TERIMA BARANG/JASA (BAST)'],
        [`Satuan Pendidikan : ${profile.namaSekolah}`],
        [`Nomor BAST        : ${nomorBAST}`],
        [`Penyedia / Rekanan: ${currentBku?.rekanan || 'Penyedia'}`],
        [''],
        ['No', 'Nama Barang / Pekerjaan', 'Spesifikasi Teknis', 'Kuantitas', 'Satuan', 'Kondisi Pemeriksaan'],
        ...docItems.map((it, idx) => [
          idx + 1,
          it.namaBarang,
          it.spesifikasi,
          it.volume,
          it.satuan,
          it.kondisi,
        ]),
      ];
    } else {
      title = 'Faktur_Invoice';
      data = [
        ['FAKTUR / INVOICE PENJUALAN'],
        [`Kepada Yth       : Bendahara BOSP ${profile.namaSekolah}`],
        [`Nomor Invoice    : ${nomorInvoice}`],
        [`Penyedia / Toko  : ${currentBku?.rekanan || 'Penyedia'}`],
        [''],
        ['No', 'Deskripsi Produk / Jasa', 'Kuantitas', 'Satuan', 'Harga Satuan (Rp)', 'Subtotal (Rp)'],
        ...docItems.map((it, idx) => [
          idx + 1,
          it.namaBarang,
          it.volume,
          it.satuan,
          it.hargaSatuan,
          it.total,
        ]),
        ['', '', '', 'TOTAL TAGIHAN', '', totalNilai],
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title}_${profile.namaSekolah.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Document Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Dokumen Pengadaan &amp; Pertanggungjawaban (SPJ)
            </h2>
            <p className="text-xs text-slate-500">
              Cetak otomatis Surat Pesanan (SP), Berita Acara Serah Terima (BAST), dan Invoice/Faktur
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Ekspor Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF Dokumen</span>
            </button>
          </div>
        </div>

        {/* Tab Controls for 3 document types */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={() => setActiveDoc('sp')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
              activeDoc === 'sp'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>1. Surat Pesanan (SP)</span>
          </button>

          <button
            onClick={() => setActiveDoc('bast')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
              activeDoc === 'bast'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>2. Berita Acara Serah Terima (BAST)</span>
          </button>

          <button
            onClick={() => setActiveDoc('invoice')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
              activeDoc === 'invoice'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>3. Invoice / Faktur Penjualan</span>
          </button>

          {/* Quick source selector */}
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Dasar Data BKU:</span>
            <select
              value={selectedSourceId}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none max-w-xs truncate"
            >
              {expenseBkuItems.map((bku) => (
                <option key={bku.id} value={bku.id}>
                  BKU #{bku.noBku} - {bku.uraian.substring(0, 35)}... ({formatRupiah(bku.pengeluaran)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Layout: Configuration & Live Paper Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Adjustments (5 cols) */}
        <div className="lg:col-span-5 space-y-4 no-print">
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Pengaturan Isian Dokumen
            </h3>

            {activeDoc === 'sp' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Nomor Surat Pesanan</label>
                  <input
                    type="text"
                    value={nomorSP}
                    onChange={(e) => setNomorSP(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Waktu Penyelesaian Pekerjaan</label>
                  <input
                    type="text"
                    value={waktuPenyelesaian}
                    onChange={(e) => setWaktuPenyelesaian(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            )}

            {activeDoc === 'bast' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Nomor Surat BAST</label>
                  <input
                    type="text"
                    value={nomorBAST}
                    onChange={(e) => setNomorBAST(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Nama Pimpinan / Direktur Rekanan</label>
                  <input
                    type="text"
                    value={namaPimpinanRekanan}
                    onChange={(e) => setNamaPimpinanRekanan(e.target.value)}
                    placeholder="Contoh: Hendra Setiawan"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Jabatan Rekanan</label>
                  <input
                    type="text"
                    value={jabatanRekanan}
                    onChange={(e) => setJabatanRekanan(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            )}

            {activeDoc === 'invoice' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Nomor Faktur / Invoice</label>
                  <input
                    type="text"
                    value={nomorInvoice}
                    onChange={(e) => setNomorInvoice(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono-num"
                  />
                </div>
              </div>
            )}

            {/* Sub-item Table editor */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-xs text-slate-700">Daftar Barang &amp; Spesifikasi</span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Item</span>
                </button>
              </div>

              <div className="space-y-2">
                {docItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">Item #{idx + 1}</span>
                      {docItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div>
                      <input
                        type="text"
                        value={item.namaBarang}
                        onChange={(e) => handleUpdateItem(idx, 'namaBarang', e.target.value)}
                        placeholder="Nama Barang / Pekerjaan"
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={item.spesifikasi}
                        onChange={(e) => handleUpdateItem(idx, 'spesifikasi', e.target.value)}
                        placeholder="Spesifikasi teknis / merk / type"
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block">Volume</label>
                        <input
                          type="number"
                          min="1"
                          value={item.volume}
                          onChange={(e) => handleUpdateItem(idx, 'volume', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">Satuan</label>
                        <input
                          type="text"
                          value={item.satuan}
                          onChange={(e) => handleUpdateItem(idx, 'satuan', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">Harga Satuan</label>
                        <input
                          type="number"
                          min="0"
                          value={item.hargaSatuan}
                          onChange={(e) => handleUpdateItem(idx, 'hargaSatuan', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono-num"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: High Fidelity Printable Document View (7 cols) */}
        <div className="lg:col-span-7">
          <div className="printable-document bg-white border border-slate-300 rounded-xl p-8 shadow-sm text-slate-900 text-xs leading-relaxed">
            {/* Kop Surat Resmi */}
            <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
              <div className="font-bold uppercase tracking-wide text-xs">
                {profile.dinasPendidikan || 'DINAS PENDIDIKAN'}
              </div>
              <div className="font-extrabold uppercase text-base tracking-wider text-slate-900 mt-0.5">
                {profile.namaSekolah}
              </div>
              <div className="text-[10.5px] text-slate-600 mt-0.5">
                {profile.alamat}, {profile.kabupatenKota}, {profile.provinsi} · Telp: {profile.telepon || '-'} · Email: {profile.email || '-'}
              </div>
            </div>

            {/* DOKUMEN 1: SURAT PESANAN */}
            {activeDoc === 'sp' && (
              <div>
                <div className="text-center mb-4">
                  <h3 className="font-bold text-sm uppercase tracking-widest border-b border-slate-800 inline-block pb-0.5">
                    SURAT PESANAN (SP)
                  </h3>
                  <div className="text-[11px] font-mono-num mt-1">Nomor: {nomorSP}</div>
                </div>

                <div className="space-y-1.5 text-xs mb-4">
                  <p>Yang bertanda tangan di bawah ini:</p>
                  <div className="grid grid-cols-12 gap-1 pl-4">
                    <span className="col-span-3 text-slate-600">Nama</span>
                    <span className="col-span-1">:</span>
                    <span className="col-span-8 font-semibold">{profile.namaKepalaSekolah}</span>
                    <span className="col-span-3 text-slate-600">NIP</span>
                    <span className="col-span-1">:</span>
                    <span className="col-span-8 font-mono-num">{profile.nipKepalaSekolah || '-'}</span>
                    <span className="col-span-3 text-slate-600">Jabatan</span>
                    <span className="col-span-1">:</span>
                    <span className="col-span-8">Kepala Satuan Pendidikan {profile.namaSekolah}</span>
                  </div>

                  <p className="pt-2">Dengan ini memesan kepada Penyedia/Rekanan:</p>
                  <div className="grid grid-cols-12 gap-1 pl-4">
                    <span className="col-span-3 text-slate-600">Nama Penyedia</span>
                    <span className="col-span-1">:</span>
                    <span className="col-span-8 font-semibold">{currentBku?.rekanan || 'Penyedia Rekanan'}</span>
                    <span className="col-span-3 text-slate-600">Alamat</span>
                    <span className="col-span-1">:</span>
                    <span className="col-span-8">{currentBku?.alamatRekanan || profile.kabupatenKota}</span>
                  </div>

                  <p className="pt-2">Untuk mengirimkan barang/jasa sesuai rincian berikut:</p>
                </div>

                {/* Tabel Pesanan */}
                <table className="w-full text-xs border border-slate-300 text-left mb-4">
                  <thead className="bg-slate-100 font-semibold border-b border-slate-300">
                    <tr>
                      <th className="p-1.5 pl-2 w-8">No</th>
                      <th className="p-1.5">Nama Barang &amp; Spesifikasi</th>
                      <th className="p-1.5 text-center w-16">Volume</th>
                      <th className="p-1.5 text-right w-24">Harga (Rp)</th>
                      <th className="p-1.5 text-right pr-2 w-28">Total (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {docItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-1.5 pl-2 font-mono-num">{idx + 1}</td>
                        <td className="p-1.5">
                          <div className="font-medium text-slate-900">{item.namaBarang}</div>
                          <div className="text-[10px] text-slate-500">Spesifikasi: {item.spesifikasi}</div>
                        </td>
                        <td className="p-1.5 text-center font-mono-num">{item.volume} {item.satuan}</td>
                        <td className="p-1.5 text-right font-mono-num">{formatRupiah(item.hargaSatuan)}</td>
                        <td className="p-1.5 text-right pr-2 font-mono-num font-semibold">{formatRupiah(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={4} className="p-1.5 text-right">Total Nilai Pesanan:</td>
                      <td className="p-1.5 text-right pr-2 font-mono-num text-slate-900">{formatRupiah(totalNilai)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Syarat Ketentuan */}
                <div className="text-[10.5px] text-slate-700 space-y-1 mb-6">
                  <div className="font-semibold">Syarat dan Ketentuan:</div>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>Waktu penyelesaian pekerjaan / pengiriman: {waktuPenyelesaian}.</li>
                    <li>Barang harus dalam kondisi 100% baru, asli, dan memenuhi spesifikasi yang dipersyaratkan.</li>
                    <li>Pembayaran dibebankan pada dana {profile.jenisBosp} {profile.tahap} TA {profile.tahunAnggaran} melalui rekening resmi sekolah.</li>
                  </ol>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 text-center text-xs mt-6">
                  <div>
                    <div className="text-slate-600">Menerima Pesanan,</div>
                    <div className="font-semibold">{currentBku?.rekanan || 'Penyedia Rekanan'}</div>
                    <div className="h-16"></div>
                    <div className="font-bold underline uppercase">{namaPimpinanRekanan || currentBku?.rekanan || 'Pimpinan Toko'}</div>
                    <div className="text-[10.5px] text-slate-500">Penyedia / Rekanan</div>
                  </div>

                  <div>
                    <div className="text-slate-600">{profile.kabupatenKota}, {formatTanggalIndonesia(currentBku?.tanggal || new Date().toISOString().split('T')[0])}</div>
                    <div className="font-semibold">Kepala Satuan Pendidikan</div>
                    <div className="h-16"></div>
                    <div className="font-bold underline uppercase">{profile.namaKepalaSekolah}</div>
                    <div className="text-[10.5px] font-mono-num">NIP. {profile.nipKepalaSekolah || '-'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* DOKUMEN 2: BERITA ACARA SERAH TERIMA (BAST) */}
            {activeDoc === 'bast' && (
              <div>
                <div className="text-center mb-4">
                  <h3 className="font-bold text-sm uppercase tracking-widest border-b border-slate-800 inline-block pb-0.5">
                    BERITA ACARA SERAH TERIMA BARANG / HASIL PEKERJAAN
                  </h3>
                  <div className="text-[11px] font-mono-num mt-1">Nomor: {nomorBAST}</div>
                </div>

                <div className="space-y-2 text-xs mb-4">
                  <p>
                    Pada hari ini, tanggal <strong>{formatTanggalIndonesia(currentBku?.tanggal || new Date().toISOString().split('T')[0])}</strong>, 
                    kami yang bertanda tangan di bawah ini:
                  </p>

                  <div className="space-y-1.5 pl-3">
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-1 font-bold">1.</span>
                      <span className="col-span-3 text-slate-600">Nama</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-7 font-semibold">{namaPimpinanRekanan || currentBku?.rekanan || 'Pihak Penyedia'}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-1"></span>
                      <span className="col-span-3 text-slate-600">Jabatan</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-7">{jabatanRekanan}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-1"></span>
                      <span className="col-span-3 text-slate-600">Perusahaan/Toko</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-7 font-medium">{currentBku?.rekanan || 'Rekanan Toko'}</span>
                    </div>
                    <div className="text-slate-600 italic text-[11px] pl-4">
                      Selanjutnya disebut sebagai <strong>PIHAK PERTAMA (Penyedia)</strong>.
                    </div>
                  </div>

                  <div className="space-y-1.5 pl-3 pt-2">
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-1 font-bold">2.</span>
                      <span className="col-span-3 text-slate-600">Nama</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-7 font-semibold">{profile.namaPengurusBarang || profile.namaKepalaSekolah}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-1"></span>
                      <span className="col-span-3 text-slate-600">NIP</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-7 font-mono-num">{profile.nipPengurusBarang || profile.nipKepalaSekolah || '-'}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-1"></span>
                      <span className="col-span-3 text-slate-600">Jabatan</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-7">Petugas Pengurus / Penerima Hasil Pekerjaan {profile.namaSekolah}</span>
                    </div>
                    <div className="text-slate-600 italic text-[11px] pl-4">
                      Selanjutnya disebut sebagai <strong>PIHAK KEDUA (Penerima Barang)</strong>.
                    </div>
                  </div>

                  <p className="pt-2">
                    Menyatakan bahwa PIHAK PERTAMA telah menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA telah memeriksa dan menerima dengan baik dan lengkap barang/pekerjaan sebagai berikut:
                  </p>
                </div>

                {/* Tabel Pemeriksaan Barang */}
                <table className="w-full text-xs border border-slate-300 text-left mb-4">
                  <thead className="bg-slate-100 font-semibold border-b border-slate-300">
                    <tr>
                      <th className="p-1.5 pl-2 w-8">No</th>
                      <th className="p-1.5">Nama Barang / Pekerjaan</th>
                      <th className="p-1.5">Spesifikasi</th>
                      <th className="p-1.5 text-center w-20">Volume</th>
                      <th className="p-1.5 text-center pr-2 w-28">Kondisi Hasil Cek</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {docItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-1.5 pl-2 font-mono-num">{idx + 1}</td>
                        <td className="p-1.5 font-medium">{item.namaBarang}</td>
                        <td className="p-1.5 text-[10px] text-slate-500">{item.spesifikasi}</td>
                        <td className="p-1.5 text-center font-mono-num">{item.volume} {item.satuan}</td>
                        <td className="p-1.5 text-center pr-2 font-semibold text-emerald-800">
                          {item.kondisi}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p className="text-xs mb-6 leading-relaxed">
                  Demikian Berita Acara Serah Terima Barang ini dibuat dalam rangkap secukupnya untuk dipergunakan sebagaimana mestinya sebagai kelengkapan pertanggungjawaban SPJ BOSP.
                </p>

                {/* Signatures 2 Kolom + Mengetahui Kepala Sekolah */}
                <div className="grid grid-cols-2 text-center text-xs mt-6">
                  <div>
                    <div className="text-slate-600">PIHAK PERTAMA,</div>
                    <div className="font-semibold">{currentBku?.rekanan || 'Penyedia'}</div>
                    <div className="h-14"></div>
                    <div className="font-bold underline uppercase">{namaPimpinanRekanan || currentBku?.rekanan || 'Pimpinan Rekanan'}</div>
                    <div className="text-[10px] text-slate-500">{jabatanRekanan}</div>
                  </div>

                  <div>
                    <div className="text-slate-600">PIHAK KEDUA,</div>
                    <div className="font-semibold">Petugas Penerima Barang</div>
                    <div className="h-14"></div>
                    <div className="font-bold underline uppercase">{profile.namaPengurusBarang || profile.namaKepalaSekolah}</div>
                    <div className="text-[10px] font-mono-num">NIP. {profile.nipPengurusBarang || profile.nipKepalaSekolah || '-'}</div>
                  </div>

                  <div className="col-span-2 text-center mt-6">
                    <div className="text-slate-600">Mengetahui &amp; Menyetujui,</div>
                    <div className="font-semibold">Kepala Satuan Pendidikan</div>
                    <div className="h-14"></div>
                    <div className="font-bold underline uppercase">{profile.namaKepalaSekolah}</div>
                    <div className="text-[10px] font-mono-num">NIP. {profile.nipKepalaSekolah || '-'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* DOKUMEN 3: INVOICE / FAKTUR PENJUALAN */}
            {activeDoc === 'invoice' && (
              <div>
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-4">
                  <div>
                    <div className="font-bold uppercase text-sm text-slate-900">{currentBku?.rekanan || 'TOKO REKANAN SEKOLAH'}</div>
                    <div className="text-[10.5px] text-slate-600">{currentBku?.alamatRekanan || 'Alamat Toko / Rekanan Penyedia'}</div>
                    <div className="text-[10.5px] text-slate-600 font-mono-num">NPWP: {currentBku?.npwpRekanan || '-'}</div>
                  </div>
                  <div className="text-right">
                    <h3 className="font-extrabold text-base uppercase text-slate-900 tracking-wider">
                      FAKTUR / INVOICE
                    </h3>
                    <div className="text-xs font-mono-num font-semibold text-slate-800">
                      No: {nomorInvoice}
                    </div>
                    <div className="text-[10.5px] text-slate-500">
                      Tanggal: {formatTanggalIndonesia(currentBku?.tanggal || new Date().toISOString().split('T')[0])}
                    </div>
                  </div>
                </div>

                <div className="mb-4 text-xs">
                  <span className="text-slate-500">Ditagihkan Kepada (Pelanggan):</span>
                  <div className="font-bold text-slate-900">{profile.namaSekolah}</div>
                  <div className="text-slate-600">U.p. Bendahara BOSP ({profile.namaBendahara})</div>
                  <div className="text-slate-600">{profile.alamat}, {profile.kabupatenKota}</div>
                </div>

                {/* Items */}
                <table className="w-full text-xs border border-slate-300 text-left mb-4">
                  <thead className="bg-slate-100 font-semibold border-b border-slate-300">
                    <tr>
                      <th className="p-1.5 pl-2 w-8">No</th>
                      <th className="p-1.5">Deskripsi Produk / Jasa</th>
                      <th className="p-1.5 text-center w-16">Kuantitas</th>
                      <th className="p-1.5 text-right w-24">Harga Satuan</th>
                      <th className="p-1.5 text-right pr-2 w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {docItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-1.5 pl-2 font-mono-num">{idx + 1}</td>
                        <td className="p-1.5">{item.namaBarang}</td>
                        <td className="p-1.5 text-center font-mono-num">{item.volume} {item.satuan}</td>
                        <td className="p-1.5 text-right font-mono-num">{formatRupiah(item.hargaSatuan)}</td>
                        <td className="p-1.5 text-right pr-2 font-mono-num font-semibold">{formatRupiah(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold border-t border-slate-300">
                    <tr>
                      <td colSpan={4} className="p-1.5 text-right">Subtotal:</td>
                      <td className="p-1.5 text-right pr-2 font-mono-num">{formatRupiah(totalNilai)}</td>
                    </tr>
                    <tr className="bg-slate-100 font-bold text-slate-900">
                      <td colSpan={4} className="p-1.5 text-right">TOTAL TAGIHAN:</td>
                      <td className="p-1.5 text-right pr-2 font-mono-num text-sm">{formatRupiah(totalNilai)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Terbilang */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs mb-6">
                  <span className="font-semibold text-slate-600 block">Terbilang:</span>
                  <span className="italic font-bold text-slate-800">&quot;{terbilang(totalNilai)}&quot;</span>
                </div>

                {/* Signatures */}
                <div className="flex items-center justify-between text-xs mt-6">
                  <div className="text-[11px] text-slate-500">
                    <div>Catatan:</div>
                    <div>- Pembayaran lunas via transfer BOSP.</div>
                    <div>- Faktur ini merupakan bukti tagihan yang sah.</div>
                  </div>

                  <div className="text-center w-52">
                    <div className="text-slate-600">Hormat Kami,</div>
                    <div className="font-semibold">{currentBku?.rekanan || 'Penyedia / Rekanan'}</div>
                    <div className="h-16"></div>
                    <div className="font-bold underline uppercase">{namaPimpinanRekanan || currentBku?.rekanan || 'Pimpinan Toko'}</div>
                    <div className="text-[10px] text-slate-500">Tanda Tangan &amp; Cap Toko</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
