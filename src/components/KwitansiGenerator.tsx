import React, { useState, useEffect, useMemo } from 'react';
import { BkuItem, SchoolProfile, KwitansiItem, KwitansiSubItem } from '../types/bosp';
import { terbilang, formatRupiah, formatTanggalIndonesia } from '../utils/terbilang';
import { exportKwitansiListToExcel } from '../utils/excelParser';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle,
  Eye,
  Layers,
  ChevronRight,
  Info,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle
} from 'lucide-react';

interface KwitansiGeneratorProps {
  bkuItems: BkuItem[];
  profile: SchoolProfile;
  selectedBkuIds: string[];
  kwitansiList: KwitansiItem[];
  onSaveKwitansi: (kwitansi: KwitansiItem) => void;
  onDeleteKwitansi: (id: string) => void;
  onSelectBkuIds: (ids: string[]) => void;
}

export const KwitansiGenerator: React.FC<KwitansiGeneratorProps> = ({
  bkuItems,
  profile,
  selectedBkuIds,
  kwitansiList,
  onSaveKwitansi,
  onDeleteKwitansi,
  onSelectBkuIds,
}) => {
  // Mode: 'create' or 'list' or 'preview'
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
  const [previewKwitansi, setPreviewKwitansi] = useState<KwitansiItem | null>(null);

  // Form states for creating / merging Kwitansi
  const [nomorKwitansi, setNomorKwitansi] = useState('');
  const [tanggalKwitansi, setTanggalKwitansi] = useState('');
  const [rekanan, setRekanan] = useState('');
  const [alamatRekanan, setAlamatRekanan] = useState('');
  const [npwpRekanan, setNpwpRekanan] = useState('');
  const [untukPembayaran, setUntukPembayaran] = useState('');
  const [kodeRekening, setKodeRekening] = useState('');
  const [namaRekening, setNamaRekening] = useState('');
  const [ppnRate, setPpnRate] = useState<number>(0);
  const [customPpn, setCustomPpn] = useState<number>(0);
  const [pph21, setPph21] = useState<number>(0);
  const [pph22, setPph22] = useState<number>(0);
  const [pph23, setPph23] = useState<number>(0);
  const [subItems, setSubItems] = useState<KwitansiSubItem[]>([]);
  const [isManualTax, setIsManualTax] = useState(false);

  // Selected BKU objects
  const selectedBkuObjects = useMemo(() => {
    return bkuItems.filter((item) => selectedBkuIds.includes(item.id));
  }, [bkuItems, selectedBkuIds]);

  // When selected BKU IDs change, initialize form fields
  useEffect(() => {
    if (selectedBkuObjects.length > 0) {
      const numbers = selectedBkuObjects.map((b) => b.noBku);
      const first = selectedBkuObjects[0];

      // Auto-generate invoice/kwitansi number
      const kwNum = `KW/BOSP-${numbers.join('_')}/${profile.tahap === 'Tahap I' ? 'I' : 'II'}/${profile.tahunAnggaran}`;
      setNomorKwitansi(kwNum);
      setTanggalKwitansi(first.tanggal || new Date().toISOString().split('T')[0]);
      setRekanan(first.rekanan || 'Penyedia Rekanan');
      setAlamatRekanan(first.alamatRekanan || '');
      setNpwpRekanan(first.npwpRekanan || '');
      setKodeRekening(first.kodeRekening || '5.1.02.01.01.0024');
      setNamaRekening(first.namaRekening || 'Belanja Operasional BOSP');

      // Generate composite description
      if (selectedBkuObjects.length === 1) {
        setUntukPembayaran(first.uraian);
      } else {
        const uSummary = selectedBkuObjects.map((b) => `(No. BKU ${b.noBku}: ${b.uraian})`).join('; ');
        setUntukPembayaran(`Pembayaran Pengeluaran Gabungan BKU No. [${numbers.join(', ')}]: ${uSummary}`);
      }

      // Populate sub-items breakdown
      const initialItems: KwitansiSubItem[] = selectedBkuObjects.map((b, idx) => ({
        id: `sub-${idx}-${b.id}`,
        noBkuRef: b.noBku,
        deskripsi: b.uraian,
        volume: 1,
        satuan: 'Paket',
        hargaSatuan: b.pengeluaran,
        total: b.pengeluaran,
      }));
      setSubItems(initialItems);

      // Auto check PPN if > 2jt and barang
      const totalBelanja = selectedBkuObjects.reduce((acc, curr) => acc + curr.pengeluaran, 0);
      if (totalBelanja >= 2000000 && first.kategori === 'Barang/ATK') {
        setPpnRate(11);
      } else {
        setPpnRate(0);
      }
    }
  }, [selectedBkuIds, selectedBkuObjects, profile]);

  // Calculate total bruto from sub-items
  const totalBruto = useMemo(() => {
    return subItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [subItems]);

  // Calculate PPN and total tax
  const calculatedPpn = useMemo(() => {
    if (isManualTax) return customPpn;
    if (ppnRate > 0) {
      // In Indonesia, PPN from inclusive/exclusive gross: standard BOSP gross includes 11/111 or direct 11%
      // Biasanya nilai belanja di BKU adalah nilai bruto (termasuk pajak)
      // Dasar Pengenaan Pajak (DPP) = (100 / (100 + ppnRate)) * bruto
      // PPN = DPP * (ppnRate / 100)
      const dpp = (100 / (100 + ppnRate)) * totalBruto;
      return Math.round(dpp * (ppnRate / 100));
    }
    return 0;
  }, [isManualTax, customPpn, ppnRate, totalBruto]);

  const totalPajak = calculatedPpn + (pph21 || 0) + (pph22 || 0) + (pph23 || 0);
  const nettoDiterima = totalBruto - totalPajak;
  const teksTerbilang = useMemo(() => terbilang(totalBruto), [totalBruto]);

  // Handle sub-item modifications
  const handleUpdateSubItem = (id: string, field: keyof KwitansiSubItem, value: any) => {
    setSubItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'volume' || field === 'hargaSatuan') {
            const vol = field === 'volume' ? Number(value) : item.volume;
            const price = field === 'hargaSatuan' ? Number(value) : item.hargaSatuan;
            updated.total = (vol || 0) * (price || 0);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleAddSubItem = () => {
    setSubItems((prev) => [
      ...prev,
      {
        id: `sub-add-${Date.now()}`,
        noBkuRef: selectedBkuObjects.map((b) => b.noBku).join('/') || '-',
        deskripsi: 'Item Rincian Baru',
        volume: 1,
        satuan: 'Unit/Rim/Paket',
        hargaSatuan: 0,
        total: 0,
      },
    ]);
  };

  const handleDeleteSubItem = (id: string) => {
    setSubItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Toggle BKU selection from within generator
  const handleToggleBkuFromPicker = (bkuId: string) => {
    if (selectedBkuIds.includes(bkuId)) {
      onSelectBkuIds(selectedBkuIds.filter((id) => id !== bkuId));
    } else {
      onSelectBkuIds([...selectedBkuIds, bkuId]);
    }
  };

  // Save Kwitansi
  const handleSave = () => {
    if (!nomorKwitansi || totalBruto <= 0) {
      alert('Mohon lengkapi nomor kwitansi dan pastikan nilai belanja lebih dari Rp 0');
      return;
    }

    const newKwitansi: KwitansiItem = {
      id: `kw-${Date.now()}`,
      nomorKwitansi,
      tanggal: tanggalKwitansi || new Date().toISOString().split('T')[0],
      tahunAnggaran: profile.tahunAnggaran,
      tahap: profile.tahap,
      bkuIds: selectedBkuIds,
      bkuNumbers: selectedBkuObjects.map((b) => b.noBku),
      rekanan: rekanan || 'Penyedia Rekanan',
      alamatRekanan: alamatRekanan || '',
      npwpRekanan: npwpRekanan || '',
      sudahTerimaDari: `Bendahara BOSP ${profile.namaSekolah}`,
      banyaknyaUang: totalBruto,
      terbilang: teksTerbilang,
      untukPembayaran,
      kodeRekening,
      namaRekening,
      ppnRate,
      ppn: calculatedPpn,
      pph21,
      pph22,
      pph23,
      totalPajak,
      jumlahDiterima: nettoDiterima,
      items: subItems,
      keterangan: 'Barang/Jasa telah diterima dalam keadaan baik dan lengkap.',
    };

    onSaveKwitansi(newKwitansi);
    setPreviewKwitansi(newKwitansi);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Tab bar within Kwitansi */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('create')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              viewMode === 'create'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Buat / Gabung Kwitansi Baru
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              viewMode === 'list'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            <span>Daftar Kwitansi Tersimpan</span>
            <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {kwitansiList.length}
            </span>
          </button>
        </div>

        {viewMode === 'list' && kwitansiList.length > 0 && (
          <button
            onClick={() => exportKwitansiListToExcel(kwitansiList, profile)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Rekap ke Excel</span>
          </button>
        )}
      </div>

      {viewMode === 'list' ? (
        /* List of Saved Kwitansi */
        <div className="space-y-3">
          {kwitansiList.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">Belum ada Kwitansi yang dibuat</p>
              <p className="text-xs text-slate-500 mt-1">
                Pilih satu atau beberapa transaksi BKU di tabel BKU lalu klik tombol &quot;Gabung ke Kwitansi&quot;.
              </p>
              <button
                onClick={() => setViewMode('create')}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
              >
                Mulai Buat Kwitansi
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">No. Kwitansi</th>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">No. BKU Tergabung</th>
                      <th className="py-2.5 px-3">Penerima / Rekanan</th>
                      <th className="py-2.5 px-3">Untuk Pembayaran</th>
                      <th className="py-2.5 px-3 text-right">Nilai Bruto</th>
                      <th className="py-2.5 px-3 text-right">Pajak</th>
                      <th className="py-2.5 px-3 text-right">Netto</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kwitansiList.map((kw) => (
                      <tr key={kw.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono-num font-semibold text-slate-800 whitespace-nowrap">
                          {kw.nomorKwitansi}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{kw.tanggal}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono-num font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                            {kw.bkuNumbers.join(', ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{kw.rekanan}</td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[220px]" title={kw.untukPembayaran}>
                          {kw.untukPembayaran}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">
                          {formatRupiah(kw.banyaknyaUang)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num text-rose-600">
                          {kw.totalPajak > 0 ? formatRupiah(kw.totalPajak) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-bold text-slate-900">
                          {formatRupiah(kw.jumlahDiterima)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setPreviewKwitansi(kw);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1"
                              title="Lihat & Cetak PDF Kwitansi"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Lihat / Cetak</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Hapus kwitansi ${kw.nomorKwitansi}?`)) {
                                  onDeleteKwitansi(kw.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Hapus Kwitansi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Create & Multi-BKU Merge Builder */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form & Selection (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Step 1: Multi-BKU Picker */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Pilih Nomor BKU yang Digabungkan
                  </h3>
                </div>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                  {selectedBkuIds.length} BKU Terpilih
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Centang beberapa nomor BKU untuk digabung menjadi 1 kwitansi tunggal (misal: beberapa nota belanja ATK di toko yang sama).
              </p>

              {/* Scrollable multi-select BKU items list */}
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {bkuItems
                  .filter((b) => b.pengeluaran > 0)
                  .map((bku) => {
                    const isChecked = selectedBkuIds.includes(bku.id);
                    return (
                      <div
                        key={bku.id}
                        onClick={() => handleToggleBkuFromPicker(bku.id)}
                        className={`flex items-center justify-between p-2.5 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                          isChecked ? 'bg-emerald-50/60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent onClick
                            className="rounded text-emerald-600 focus:ring-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono-num font-bold text-slate-900">
                                BKU #{bku.noBku}
                              </span>
                              <span className="text-[11px] text-slate-400">· {bku.tanggal}</span>
                              <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                ({bku.rekanan})
                              </span>
                            </div>
                            <div className="text-slate-600 truncate text-[11px]">
                              {bku.uraian}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                          {formatRupiah(bku.pengeluaran)}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {selectedBkuIds.length === 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Silakan centang minimal 1 nomor BKU di atas untuk membuat kwitansi.</span>
                </div>
              )}
            </div>

            {/* Step 2: Identitas Kwitansi & Rekanan */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                  2
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Informasi Kwitansi & Pihak Rekanan
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nomor Kwitansi *
                  </label>
                  <input
                    type="text"
                    value={nomorKwitansi}
                    onChange={(e) => setNomorKwitansi(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 font-mono-num"
                    placeholder="KW/BOSP-01/I/2026"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal Kwitansi *
                  </label>
                  <input
                    type="date"
                    value={tanggalKwitansi}
                    onChange={(e) => setTanggalKwitansi(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Toko / Rekanan / Penerima *
                  </label>
                  <input
                    type="text"
                    value={rekanan}
                    onChange={(e) => setRekanan(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
                    placeholder="Toko Buku & ATK Pelajar Mandiri"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    NPWP Rekanan (Bila ada)
                  </label>
                  <input
                    type="text"
                    value={npwpRekanan}
                    onChange={(e) => setNpwpRekanan(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 font-mono-num"
                    placeholder="72.345.678.9-445.000"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Alamat Lengkap Toko / Rekanan
                  </label>
                  <input
                    type="text"
                    value={alamatRekanan}
                    onChange={(e) => setAlamatRekanan(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
                    placeholder="Jl. Raya Soreang No. 88, Kab. Bandung"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Untuk Pembayaran (Uraian Belanja Resmi) *
                  </label>
                  <textarea
                    rows={2}
                    value={untukPembayaran}
                    onChange={(e) => setUntukPembayaran(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
                    placeholder="Pembelian ATK dan bahan cetak raport..."
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Rincian Sub-Item Barang / Jasa */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    3
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Rincian Komponen Barang / Jasa pada Kwitansi
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddSubItem}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2 px-2.5 w-16">No BKU</th>
                      <th className="py-2 px-2.5">Deskripsi Barang / Jasa</th>
                      <th className="py-2 px-2 w-16 text-center">Vol</th>
                      <th className="py-2 px-2 w-16">Satuan</th>
                      <th className="py-2 px-2.5 w-24 text-right">Harga Satuan</th>
                      <th className="py-2 px-2.5 w-24 text-right">Total</th>
                      <th className="py-2 px-1.5 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {subItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-1 px-2.5 font-mono-num text-slate-500">
                          {item.noBkuRef}
                        </td>
                        <td className="py-1 px-2.5">
                          <input
                            type="text"
                            value={item.deskripsi}
                            onChange={(e) => handleUpdateSubItem(item.id, 'deskripsi', e.target.value)}
                            className="w-full px-1.5 py-1 text-xs border border-transparent hover:border-slate-300 focus:border-slate-900 rounded focus:outline-none"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            min="1"
                            value={item.volume}
                            onChange={(e) => handleUpdateSubItem(item.id, 'volume', e.target.value)}
                            className="w-full px-1.5 py-1 text-xs text-center border border-transparent hover:border-slate-300 focus:border-slate-900 rounded focus:outline-none font-mono-num"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input
                            type="text"
                            value={item.satuan}
                            onChange={(e) => handleUpdateSubItem(item.id, 'satuan', e.target.value)}
                            className="w-full px-1.5 py-1 text-xs border border-transparent hover:border-slate-300 focus:border-slate-900 rounded focus:outline-none"
                          />
                        </td>
                        <td className="py-1 px-2.5">
                          <input
                            type="number"
                            min="0"
                            value={item.hargaSatuan}
                            onChange={(e) => handleUpdateSubItem(item.id, 'hargaSatuan', e.target.value)}
                            className="w-full px-1.5 py-1 text-xs text-right border border-transparent hover:border-slate-300 focus:border-slate-900 rounded focus:outline-none font-mono-num"
                          />
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                          {formatRupiah(item.total)}
                        </td>
                        <td className="py-1 px-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSubItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold text-slate-900">
                      <td colSpan={5} className="py-2 px-3 text-right">
                        Jumlah Bruto:
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono-num text-emerald-800">
                        {formatRupiah(totalBruto)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Step 4: Pajak & Potongan */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    4
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Perhitungan Pajak & Potongan Resmi
                  </h3>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isManualTax}
                    onChange={(e) => setIsManualTax(e.target.checked)}
                    className="rounded text-slate-900 focus:ring-0"
                  />
                  <span>Input Nominal Pajak Manual</span>
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* PPN */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700 block mb-1">PPN</span>
                  {!isManualTax ? (
                    <>
                      <select
                        value={ppnRate}
                        onChange={(e) => setPpnRate(Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded mb-1"
                      >
                        <option value={0}>Bebas PPN (0%)</option>
                        <option value={11}>PPN 11%</option>
                        <option value={12}>PPN 12%</option>
                      </select>
                      <div className="text-[11px] font-mono-num text-slate-800 font-bold text-right">
                        {formatRupiah(calculatedPpn)}
                      </div>
                    </>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      value={customPpn}
                      onChange={(e) => setCustomPpn(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono-num"
                    />
                  )}
                </div>

                {/* PPh 21 */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700 block mb-1">PPh 21 (Honor/Upah)</span>
                  <input
                    type="number"
                    min="0"
                    value={pph21}
                    onChange={(e) => setPph21(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono-num"
                    placeholder="0"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Bila ada potongan honor</div>
                </div>

                {/* PPh 22 */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700 block mb-1">PPh 22 (Barang &gt; 2jt)</span>
                  <input
                    type="number"
                    min="0"
                    value={pph22}
                    onChange={(e) => setPph22(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono-num"
                    placeholder="0"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">1.5% dari DPP</div>
                </div>

                {/* PPh 23 */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700 block mb-1">PPh 23 (Jasa/Sewa)</span>
                  <input
                    type="number"
                    min="0"
                    value={pph23}
                    onChange={(e) => setPph23(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono-num"
                    placeholder="0"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">2% dari bruto jasa</div>
                </div>
              </div>

              {/* Total Calculation summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs">
                <div>
                  <div className="font-semibold text-emerald-950">
                    Total Bruto: {formatRupiah(totalBruto)} · Total Pajak: {formatRupiah(totalPajak)}
                  </div>
                  <div className="text-[11px] text-emerald-800 italic mt-0.5">
                    &quot;{teksTerbilang}&quot;
                  </div>
                </div>
                <div className="mt-2 sm:mt-0 text-right">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-800 block">
                    Jumlah Bersih Dibayarkan (Netto)
                  </span>
                  <span className="text-base font-bold font-mono-num text-emerald-900">
                    {formatRupiah(nettoDiterima)}
                  </span>
                </div>
              </div>

              {/* Action save & generate */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={selectedBkuIds.length === 0 || totalBruto <= 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Simpan & Lihat Kwitansi Resmi</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Official Indonesian Government Kwitansi Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Pratinjau Format Resmi Kwitansi
                </span>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
              </div>

              {/* Printable sheet container simulating A4 / Kwitansi format */}
              <div className="printable-document bg-white border border-slate-300 rounded-xl p-6 shadow-sm text-slate-900 text-[11px] leading-relaxed">
                {/* Kop Satuan Pendidikan */}
                <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                  <div className="font-bold uppercase tracking-wide text-xs">
                    {profile.dinasPendidikan || 'DINAS PENDIDIKAN'}
                  </div>
                  <div className="font-extrabold uppercase text-sm tracking-wider text-slate-900 mt-0.5">
                    {profile.namaSekolah}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {profile.alamat}, {profile.kabupatenKota}, {profile.provinsi} · NPSN: {profile.npsn}
                  </div>
                </div>

                {/* Judul Kwitansi & Meta */}
                <div className="text-center my-3">
                  <span className="font-bold text-xs uppercase tracking-widest border-b border-slate-800 pb-0.5">
                    KWITANSI / BUKTI PEMBAYARAN PENGELUARAN
                  </span>
                </div>

                <div className="grid grid-cols-2 text-[10.5px] border-b border-slate-200 pb-2 mb-3">
                  <div>
                    <span className="text-slate-500">Nomor Bukti:</span>{' '}
                    <span className="font-mono-num font-bold">{nomorKwitansi || 'KW/...'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Tahun Anggaran:</span>{' '}
                    <span className="font-semibold">{profile.tahunAnggaran} ({profile.tahap})</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-slate-500">Sesuai Nomor BKU:</span>{' '}
                    <span className="font-mono-num font-bold text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {selectedBkuObjects.map((b) => b.noBku).join(', ') || '-'}
                    </span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-slate-500">Mata Anggaran / Kode Rekening:</span>{' '}
                    <span className="font-mono-num">{kodeRekening}</span> ({namaRekening})
                  </div>
                </div>

                {/* Kwitansi Body Fields */}
                <div className="space-y-2 text-[10.5px]">
                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-600">Sudah Terima Dari</span>
                    <span className="col-span-1 text-center">:</span>
                    <span className="col-span-7 font-bold">
                      Bendahara BOSP {profile.namaSekolah}
                    </span>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-600">Banyaknya Uang</span>
                    <span className="col-span-1 text-center">:</span>
                    <span className="col-span-7 italic font-semibold bg-slate-50 p-1.5 border border-slate-200 rounded leading-tight">
                      &quot;{teksTerbilang}&quot;
                    </span>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-600">Untuk Pembayaran</span>
                    <span className="col-span-1 text-center">:</span>
                    <span className="col-span-7 leading-snug">
                      {untukPembayaran || '-'}
                    </span>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-600">Penerima / Rekanan</span>
                    <span className="col-span-1 text-center">:</span>
                    <span className="col-span-7 font-semibold">
                      {rekanan} {alamatRekanan ? `(${alamatRekanan})` : ''}
                    </span>
                  </div>
                </div>

                {/* Mini Item List Table */}
                <div className="mt-3 border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                      <tr>
                        <th className="p-1 pl-2">No</th>
                        <th className="p-1">Uraian Barang/Jasa</th>
                        <th className="p-1 text-center">Vol</th>
                        <th className="p-1 text-right">Harga (Rp)</th>
                        <th className="p-1 text-right pr-2">Jumlah (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {subItems.map((it, idx) => (
                        <tr key={it.id}>
                          <td className="p-1 pl-2 font-mono-num">{idx + 1}</td>
                          <td className="p-1">{it.deskripsi}</td>
                          <td className="p-1 text-center font-mono-num">{it.volume} {it.satuan}</td>
                          <td className="p-1 text-right font-mono-num">{formatRupiah(it.hargaSatuan)}</td>
                          <td className="p-1 text-right pr-2 font-mono-num font-medium">{formatRupiah(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-300 font-semibold">
                      <tr>
                        <td colSpan={4} className="p-1 text-right">Jumlah Bruto:</td>
                        <td className="p-1 text-right pr-2 font-mono-num">{formatRupiah(totalBruto)}</td>
                      </tr>
                      {totalPajak > 0 && (
                        <tr>
                          <td colSpan={4} className="p-1 text-right text-slate-600">
                            Potongan Pajak (PPN {ppnRate}% / PPh):
                          </td>
                          <td className="p-1 text-right pr-2 font-mono-num text-rose-700">
                            - {formatRupiah(totalPajak)}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={4} className="p-1 text-right">Jumlah Bersih Diterima:</td>
                        <td className="p-1 text-right pr-2 font-mono-num text-slate-900">{formatRupiah(nettoDiterima)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Big Nominal Banner */}
                <div className="mt-3 p-2 bg-slate-100 border border-slate-300 rounded flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wide">Terbayar:</span>
                  <span className="font-mono-num font-extrabold text-sm text-slate-900">
                    {formatRupiah(totalBruto)}
                  </span>
                </div>

                {/* Tanda Tangan 3 Kolom Sesuai Regulasi Kemendikbud */}
                <div className="mt-6 pt-3 text-[10px]">
                  <div className="text-right text-[10px] text-slate-600 mb-2">
                    {profile.kabupatenKota}, {formatTanggalIndonesia(tanggalKwitansi || new Date().toISOString().split('T')[0])}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="font-medium text-slate-600">Setuju Dibayar,</div>
                      <div className="font-semibold text-slate-800">Kepala Satuan Pendidikan</div>
                      <div className="h-14"></div>
                      <div className="font-bold underline uppercase">{profile.namaKepalaSekolah}</div>
                      <div className="font-mono-num text-[9.5px]">NIP. {profile.nipKepalaSekolah || '-'}</div>
                    </div>

                    <div>
                      <div className="font-medium text-slate-600">Lunas Dibayar,</div>
                      <div className="font-semibold text-slate-800">Bendahara BOSP</div>
                      <div className="h-14"></div>
                      <div className="font-bold underline uppercase">{profile.namaBendahara}</div>
                      <div className="font-mono-num text-[9.5px]">NIP. {profile.nipBendahara || '-'}</div>
                    </div>

                    <div>
                      <div className="font-medium text-slate-600">Yang Menerima,</div>
                      <div className="font-semibold text-slate-800">Pihak Rekanan / Penerima</div>
                      <div className="h-14"></div>
                      <div className="font-bold underline uppercase">{rekanan}</div>
                      <div className="text-[9.5px] text-slate-500">Tanda Tangan &amp; Cap Toko</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Single Kwitansi from List */}
      {previewKwitansi && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Pratinjau Kwitansi Pembayaran Resmi
                </h3>
                <p className="text-xs text-slate-500">
                  Nomor: {previewKwitansi.nomorKwitansi} · Tergabung BKU: {previewKwitansi.bkuNumbers.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / PDF</span>
                </button>
                <button
                  onClick={() => setPreviewKwitansi(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-md"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="p-8 max-h-[80vh] overflow-y-auto printable-document">
              {/* Kop Satuan Pendidikan */}
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                <div className="font-bold uppercase tracking-wide text-xs">
                  {profile.dinasPendidikan || 'DINAS PENDIDIKAN'}
                </div>
                <div className="font-extrabold uppercase text-sm tracking-wider text-slate-900 mt-0.5">
                  {profile.namaSekolah}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {profile.alamat}, {profile.kabupatenKota}, {profile.provinsi} · NPSN: {profile.npsn}
                </div>
              </div>

              {/* Title */}
              <div className="text-center my-3">
                <span className="font-bold text-sm uppercase tracking-widest border-b border-slate-800 pb-0.5">
                  KWITANSI / BUKTI PEMBAYARAN PENGELUARAN
                </span>
              </div>

              <div className="grid grid-cols-2 text-xs border-b border-slate-200 pb-2 mb-3">
                <div>
                  <span className="text-slate-500">Nomor Bukti:</span>{' '}
                  <span className="font-mono-num font-bold">{previewKwitansi.nomorKwitansi}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Tahun Anggaran:</span>{' '}
                  <span className="font-semibold">{profile.tahunAnggaran} ({profile.tahap})</span>
                </div>
                <div className="col-span-2 mt-1">
                  <span className="text-slate-500">Sesuai Nomor BKU:</span>{' '}
                  <span className="font-mono-num font-bold text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {previewKwitansi.bkuNumbers.join(', ')}
                  </span>
                </div>
                <div className="col-span-2 mt-1">
                  <span className="text-slate-500">Mata Anggaran / Kode Rekening:</span>{' '}
                  <span className="font-mono-num">{previewKwitansi.kodeRekening}</span> ({previewKwitansi.namaRekening})
                </div>
              </div>

              {/* Body */}
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-3 text-slate-600">Sudah Terima Dari</span>
                  <span className="col-span-1 text-center">:</span>
                  <span className="col-span-8 font-bold">
                    Bendahara BOSP {profile.namaSekolah}
                  </span>
                </div>

                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-3 text-slate-600">Banyaknya Uang</span>
                  <span className="col-span-1 text-center">:</span>
                  <span className="col-span-8 italic font-semibold bg-slate-50 p-2 border border-slate-200 rounded leading-relaxed">
                    &quot;{previewKwitansi.terbilang}&quot;
                  </span>
                </div>

                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-3 text-slate-600">Untuk Pembayaran</span>
                  <span className="col-span-1 text-center">:</span>
                  <span className="col-span-8 leading-snug">
                    {previewKwitansi.untukPembayaran}
                  </span>
                </div>

                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-3 text-slate-600">Penerima / Rekanan</span>
                  <span className="col-span-1 text-center">:</span>
                  <span className="col-span-8 font-semibold">
                    {previewKwitansi.rekanan} {previewKwitansi.alamatRekanan ? `(${previewKwitansi.alamatRekanan})` : ''}
                  </span>
                </div>
              </div>

              {/* Items breakdown */}
              <div className="mt-4 border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                    <tr>
                      <th className="p-1.5 pl-2.5">No</th>
                      <th className="p-1.5">Uraian Pengeluaran</th>
                      <th className="p-1.5 text-center">Vol</th>
                      <th className="p-1.5 text-right">Harga (Rp)</th>
                      <th className="p-1.5 text-right pr-2.5">Jumlah (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewKwitansi.items.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="p-1.5 pl-2.5 font-mono-num">{idx + 1}</td>
                        <td className="p-1.5">{it.deskripsi}</td>
                        <td className="p-1.5 text-center font-mono-num">{it.volume} {it.satuan}</td>
                        <td className="p-1.5 text-right font-mono-num">{formatRupiah(it.hargaSatuan)}</td>
                        <td className="p-1.5 text-right pr-2.5 font-mono-num font-medium">{formatRupiah(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-300 font-semibold">
                    <tr>
                      <td colSpan={4} className="p-1.5 text-right">Jumlah Bruto:</td>
                      <td className="p-1.5 text-right pr-2.5 font-mono-num">{formatRupiah(previewKwitansi.banyaknyaUang)}</td>
                    </tr>
                    {previewKwitansi.totalPajak > 0 && (
                      <tr>
                        <td colSpan={4} className="p-1.5 text-right text-slate-600">
                          Potongan Pajak (PPN / PPh):
                        </td>
                        <td className="p-1.5 text-right pr-2.5 font-mono-num text-rose-700">
                          - {formatRupiah(previewKwitansi.totalPajak)}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={4} className="p-1.5 text-right">Jumlah Bersih Diterima:</td>
                      <td className="p-1.5 text-right pr-2.5 font-mono-num text-slate-900">{formatRupiah(previewKwitansi.jumlahDiterima)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Total Banner */}
              <div className="mt-4 p-2.5 bg-slate-100 border border-slate-300 rounded flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wide">Terbayar:</span>
                <span className="font-mono-num font-extrabold text-base text-slate-900">
                  {formatRupiah(previewKwitansi.banyaknyaUang)}
                </span>
              </div>

              {/* Signatures */}
              <div className="mt-8 pt-4 text-xs">
                <div className="text-right text-xs text-slate-600 mb-3">
                  {profile.kabupatenKota}, {formatTanggalIndonesia(previewKwitansi.tanggal)}
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="font-medium text-slate-600">Setuju Dibayar,</div>
                    <div className="font-semibold text-slate-800">Kepala Satuan Pendidikan</div>
                    <div className="h-16"></div>
                    <div className="font-bold underline uppercase">{profile.namaKepalaSekolah}</div>
                    <div className="font-mono-num text-[11px]">NIP. {profile.nipKepalaSekolah || '-'}</div>
                  </div>

                  <div>
                    <div className="font-medium text-slate-600">Lunas Dibayar,</div>
                    <div className="font-semibold text-slate-800">Bendahara BOSP</div>
                    <div className="h-16"></div>
                    <div className="font-bold underline uppercase">{profile.namaBendahara}</div>
                    <div className="font-mono-num text-[11px]">NIP. {profile.nipBendahara || '-'}</div>
                  </div>

                  <div>
                    <div className="font-medium text-slate-600">Yang Menerima,</div>
                    <div className="font-semibold text-slate-800">Pihak Rekanan / Toko</div>
                    <div className="h-16"></div>
                    <div className="font-bold underline uppercase">{previewKwitansi.rekanan}</div>
                    <div className="text-[11px] text-slate-500">Tanda Tangan &amp; Cap Toko</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
