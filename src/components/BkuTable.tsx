import React, { useState, useMemo } from 'react';
import { BkuItem, SchoolProfile, BelanjaCategory } from '../types/bosp';
import { formatRupiah, formatTanggalIndonesia } from '../utils/terbilang';
import { exportBkuToExcel } from '../utils/excelParser';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckSquare,
  Square,
  Layers,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  X,
  Save,
  CheckCircle2,
  Database
} from 'lucide-react';

interface BkuTableProps {
  items: BkuItem[];
  profile: SchoolProfile;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onUpdateItem: (updated: BkuItem) => void;
  onAddItem: (newItem: BkuItem) => void;
  onDeleteItem: (id: string) => void;
  onOpenImport: () => void;
  onMergeToKwitansi: () => void;
  onPrintBku: () => void;
}

export const BkuTable: React.FC<BkuTableProps> = ({
  items,
  profile,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onOpenImport,
  onMergeToKwitansi,
  onPrintBku,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal edit / add item
  const [editingItem, setEditingItem] = useState<BkuItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form state for add/edit
  const [formValues, setFormValues] = useState<Partial<BkuItem>>({});

  // Summary calculations
  const stats = useMemo(() => {
    let totalPenerimaan = 0;
    let totalPengeluaran = 0;
    items.forEach((item) => {
      totalPenerimaan += item.penerimaan || 0;
      totalPengeluaran += item.pengeluaran || 0;
    });
    const sisaKas = totalPenerimaan - totalPengeluaran;
    return {
      totalPenerimaan,
      totalPengeluaran,
      sisaKas,
      count: items.length,
    };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.uraian.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.noBku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.kodeRekening.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.rekanan && item.rekanan.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = categoryFilter === 'all' || item.kategori === categoryFilter;

      const itemMonth = item.tanggal ? new Date(item.tanggal).getMonth() + 1 : 0;
      const matchMonth = monthFilter === 'all' || itemMonth === parseInt(monthFilter, 10);

      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'kwitansi'
          ? !!item.kwitansiId
          : !item.kwitansiId;

      return matchSearch && matchCategory && matchMonth && matchStatus;
    });
  }, [items, searchTerm, categoryFilter, monthFilter, statusFilter]);

  const allFilteredIds = useMemo(() => filteredItems.map((i) => i.id), [filteredItems]);
  const isAllSelected =
    filteredItems.length > 0 &&
    filteredItems.every((i) => selectedIds.includes(i.id));

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      onClearSelection();
    } else {
      onSelectAll(allFilteredIds);
    }
  };

  const startEdit = (item: BkuItem) => {
    setEditingItem(item);
    setFormValues({ ...item });
  };

  const startAddNew = () => {
    setIsAddingNew(true);
    const lastNo = items.length > 0 ? String(items.length + 1).padStart(3, '0') : '001';
    setFormValues({
      noBku: lastNo,
      tanggal: new Date().toISOString().split('T')[0],
      kodeKegiatan: '02.01.01',
      kodeRekening: '5.1.02.01.01.0024',
      namaRekening: 'Belanja Alat Tulis Kantor (ATK)',
      noBukti: `BKT-${lastNo}/${profile.tahap === 'Tahap I' ? 'I' : 'II'}/${profile.tahunAnggaran}`,
      uraian: '',
      penerimaan: 0,
      pengeluaran: 0,
      saldo: 0,
      rekanan: '',
      alamatRekanan: '',
      npwpRekanan: '',
      kategori: 'Barang/ATK',
    });
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingNew) {
      const newItem: BkuItem = {
        id: `bku-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        noBku: formValues.noBku || '001',
        tanggal: formValues.tanggal || new Date().toISOString().split('T')[0],
        kodeKegiatan: formValues.kodeKegiatan || '02.01.01',
        kodeRekening: formValues.kodeRekening || '5.1.02.01.01.0024',
        namaRekening: formValues.namaRekening || 'Belanja Alat Tulis Kantor',
        noBukti: formValues.noBukti || 'BKT-001',
        uraian: formValues.uraian || '',
        penerimaan: Number(formValues.penerimaan) || 0,
        pengeluaran: Number(formValues.pengeluaran) || 0,
        saldo: Number(formValues.saldo) || 0,
        rekanan: formValues.rekanan || 'Penyedia Rekanan',
        alamatRekanan: formValues.alamatRekanan || '',
        npwpRekanan: formValues.npwpRekanan || '',
        kategori: (formValues.kategori as BelanjaCategory) || 'Barang/ATK',
      };
      onAddItem(newItem);
      setIsAddingNew(false);
    } else if (editingItem) {
      const updated: BkuItem = {
        ...editingItem,
        ...formValues,
        penerimaan: Number(formValues.penerimaan) || 0,
        pengeluaran: Number(formValues.pengeluaran) || 0,
      } as BkuItem;
      onUpdateItem(updated);
      setEditingItem(null);
    }
    setFormValues({});
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Penyaluran BOSP (Tahap)</span>
            <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono-num">
            {formatRupiah(stats.totalPenerimaan)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total penerimaan kas transfer BOSP
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Realisasi Belanja</span>
            <ArrowUpCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono-num">
            {formatRupiah(stats.totalPengeluaran)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total SPJ & pengeluaran operasional
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Sisa Saldo Kas</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div className={`text-xl font-bold font-mono-num ${stats.sisaKas >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatRupiah(stats.sisaKas)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Kas tunai + saldo bank penampung
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Volume Transaksi BKU</span>
            <Layers className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono-num">
            {stats.count} Transaksi
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {profile.jenisBosp} · {profile.tahap}
          </div>
        </div>
      </div>

      {/* 2. Action Controls & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari uraian transaksi, no BKU, kode, atau rekanan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={onMergeToKwitansi}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
                title="Gabungkan transaksi BKU yang dipilih menjadi 1 kwitansi"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Gabung {selectedIds.length} BKU ke Kwitansi</span>
              </button>
            )}

            <button
              onClick={startAddNew}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tambah Transaksi</span>
            </button>

            <button
              onClick={onOpenImport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Impor BKU ARKAS (Excel / PDF / DB)</span>
            </button>

            <button
              onClick={() => exportBkuToExcel(items, profile)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Ekspor format tabel BKU resmi ke Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Ekspor Excel</span>
            </button>

            <button
              onClick={onPrintBku}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Cetak lembaran Buku Kas Umum resmi kementerian"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Cetak BKU</span>
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-700">Filter:</span>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-none"
          >
            <option value="all">Semua Kategori Belanja</option>
            <option value="Barang/ATK">Barang / ATK</option>
            <option value="Jasa/Pemeliharaan">Jasa / Pemeliharaan</option>
            <option value="Modal/Aset">Modal / Aset</option>
            <option value="Konsumsi">Konsumsi Rapat</option>
            <option value="Honor">Honorarium Pendidik</option>
            <option value="Lainnya">Lainnya</option>
          </select>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-none"
          >
            <option value="all">Semua Bulan</option>
            <option value="1">Januari</option>
            <option value="2">Februari</option>
            <option value="3">Maret</option>
            <option value="4">April</option>
            <option value="5">Mei</option>
            <option value="6">Juni</option>
            <option value="7">Juli</option>
            <option value="8">Agustus</option>
            <option value="9">September</option>
            <option value="10">Oktober</option>
            <option value="11">November</option>
            <option value="12">Desember</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-none"
          >
            <option value="all">Semua Status Kwitansi</option>
            <option value="belum">Belum Dibuat Kwitansi</option>
            <option value="kwitansi">Sudah Dibuat Kwitansi</option>
          </select>

          <div className="ml-auto text-slate-500">
            Menampilkan <span className="font-semibold text-slate-800">{filteredItems.length}</span> dari {items.length} transaksi
          </div>
        </div>
      </div>

      {/* 3. High-Density Structured Table with 8 ARKAS columns */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3 w-10 text-center">
                  <button
                    onClick={handleSelectAllToggle}
                    className="p-0.5 hover:text-slate-900 transition-colors"
                    title={isAllSelected ? 'Batalkan Semua' : 'Pilih Semua untuk Gabung Kwitansi'}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-2 w-14 text-center">No BKU</th>
                <th className="py-2.5 px-2.5 w-24">Tanggal</th>
                <th className="py-2.5 px-2.5 w-28">Kode Kegiatan</th>
                <th className="py-2.5 px-2.5 w-32">Kode Rekening</th>
                <th className="py-2.5 px-2.5 w-28">No Bukti</th>
                <th className="py-2.5 px-3">Uraian Transaksi</th>
                <th className="py-2.5 px-3 w-28">Pihak Rekanan</th>
                <th className="py-2.5 px-2.5 w-24 text-right">Penerimaan</th>
                <th className="py-2.5 px-2.5 w-24 text-right">Pengeluaran</th>
                <th className="py-2.5 px-2.5 w-24 text-right">Saldo</th>
                <th className="py-2.5 px-2 w-24 text-center">Status</th>
                <th className="py-2.5 px-2 w-16 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-slate-500">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 mb-3 shadow-xs">
                      <Database className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      {items.length === 0 ? 'Basis Data BKU Masih Kosong' : 'Tidak Ada Data yang Cocok dengan Filter'}
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                      {items.length === 0
                        ? 'Unggah berkas Excel (.xlsx) hasil export dari ARKAS, cetakan PDF BKU resmi, atau berkas database SQLite (.db) untuk memuat 8 kolom transaksi secara otomatis.'
                        : 'Sesuaikan kata kunci pencarian atau reset filter di bagian atas.'}
                    </p>
                    {items.length === 0 && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={onOpenImport}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>Impor BKU ARKAS Sekarang (Excel / PDF / DB)</span>
                        </button>
                        <button
                          onClick={startAddNew}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Manual</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isExpense = item.pengeluaran > 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      {/* Checkbox select for merge */}
                      <td className="py-2 px-3 text-center">
                        {isExpense ? (
                          <button
                            onClick={() => onToggleSelect(item.id)}
                            className="p-0.5 hover:text-slate-900 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-700" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                            )}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-300">-</span>
                        )}
                      </td>

                      {/* No BKU */}
                      <td className="py-2 px-2 font-mono-num font-semibold text-slate-800 text-center">
                        {item.noBku}
                      </td>

                      {/* 1. Tanggal */}
                      <td className="py-2 px-2.5 text-slate-700 whitespace-nowrap font-mono-num">
                        {item.tanggal}
                      </td>

                      {/* 2. Kode Kegiatan */}
                      <td className="py-2 px-2.5">
                        <span className="font-mono-num text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.kodeKegiatan || '02.01.01'}
                        </span>
                      </td>

                      {/* 3. Kode Rekening */}
                      <td className="py-2 px-2.5">
                        <div className="font-mono-num text-[11px] font-semibold text-slate-800">
                          {item.kodeRekening}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]" title={item.namaRekening}>
                          {item.namaRekening}
                        </div>
                      </td>

                      {/* 4. No Bukti */}
                      <td className="py-2 px-2.5 font-mono-num text-[11px] text-slate-700 truncate max-w-[110px]" title={item.noBukti}>
                        {item.noBukti || '-'}
                      </td>

                      {/* 5. Uraian */}
                      <td className="py-2 px-3">
                        <div className="text-slate-900 font-medium leading-snug">
                          {item.uraian}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Kategori: {item.kategori}
                        </div>
                      </td>

                      {/* Rekanan */}
                      <td className="py-2 px-3 text-slate-700 truncate max-w-[130px]" title={item.rekanan}>
                        {item.rekanan || '-'}
                      </td>

                      {/* 6. Penerimaan */}
                      <td className="py-2 px-2.5 text-right font-mono-num font-medium text-emerald-700 whitespace-nowrap">
                        {item.penerimaan > 0 ? formatRupiah(item.penerimaan) : '-'}
                      </td>

                      {/* 7. Pengeluaran */}
                      <td className="py-2 px-2.5 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                        {item.pengeluaran > 0 ? formatRupiah(item.pengeluaran) : '-'}
                      </td>

                      {/* 8. Saldo */}
                      <td className="py-2 px-2.5 text-right font-mono-num font-medium text-slate-800 whitespace-nowrap">
                        {formatRupiah(item.saldo)}
                      </td>

                      {/* Status Kwitansi */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        {item.kwitansiId ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Kwitansi Ada
                          </span>
                        ) : isExpense ? (
                          <button
                            onClick={() => {
                              onClearSelection();
                              onToggleSelect(item.id);
                              onMergeToKwitansi();
                            }}
                            className="text-[11px] text-slate-600 hover:text-slate-900 font-medium underline decoration-slate-300"
                          >
                            + Kwitansi
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Penyaluran</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="Edit baris transaksi BKU"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Hapus transaksi No. BKU ${item.noBku}?`)) {
                                onDeleteItem(item.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Hapus transaksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal Edit / Add Item */}
      {(editingItem || isAddingNew) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {isAddingNew ? 'Tambah Transaksi BKU Baru' : `Edit Transaksi No. BKU: ${editingItem?.noBku}`}
              </h3>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsAddingNew(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nomor BKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formValues.noBku || ''}
                    onChange={(e) => setFormValues({ ...formValues, noBku: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 font-mono-num"
                    placeholder="001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal Transaksi *
                  </label>
                  <input
                    type="date"
                    required
                    value={formValues.tanggal || ''}
                    onChange={(e) => setFormValues({ ...formValues, tanggal: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kode Kegiatan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formValues.kodeKegiatan || ''}
                    onChange={(e) => setFormValues({ ...formValues, kodeKegiatan: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 font-mono-num"
                    placeholder="02.01.01"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kode Rekening *
                  </label>
                  <input
                    type="text"
                    required
                    value={formValues.kodeRekening || ''}
                    onChange={(e) => setFormValues({ ...formValues, kodeRekening: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 font-mono-num"
                    placeholder="5.1.02.01.01.0024"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nomor Bukti
                  </label>
                  <input
                    type="text"
                    value={formValues.noBukti || ''}
                    onChange={(e) => setFormValues({ ...formValues, noBukti: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 font-mono-num"
                    placeholder="BKT-001/I/2026"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Rekening / Program
                </label>
                <input
                  type="text"
                  value={formValues.namaRekening || ''}
                  onChange={(e) => setFormValues({ ...formValues, namaRekening: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
                  placeholder="Belanja Alat Tulis Kantor (ATK)"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Uraian Lengkap Transaksi *
                </label>
                <textarea
                  rows={2}
                  required
                  value={formValues.uraian || ''}
                  onChange={(e) => setFormValues({ ...formValues, uraian: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
                  placeholder="Pembelian Kertas HVS 15 Rim dari Toko Pelajar Mandiri"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Penerimaan (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formValues.penerimaan ?? 0}
                    onChange={(e) => setFormValues({ ...formValues, penerimaan: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pengeluaran / Belanja (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formValues.pengeluaran ?? 0}
                    onChange={(e) => setFormValues({ ...formValues, pengeluaran: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pihak Rekanan / Toko / Penerima
                  </label>
                  <input
                    type="text"
                    value={formValues.rekanan || ''}
                    onChange={(e) => setFormValues({ ...formValues, rekanan: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
                    placeholder="Toko Buku & ATK Pelajar Mandiri"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kategori Belanja
                  </label>
                  <select
                    value={formValues.kategori || 'Barang/ATK'}
                    onChange={(e) => setFormValues({ ...formValues, kategori: e.target.value as BelanjaCategory })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="Barang/ATK">Barang / ATK</option>
                    <option value="Jasa/Pemeliharaan">Jasa / Pemeliharaan</option>
                    <option value="Modal/Aset">Modal / Aset</option>
                    <option value="Konsumsi">Konsumsi Rapat</option>
                    <option value="Honor">Honorarium Pendidik</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setIsAddingNew(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Transaksi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
