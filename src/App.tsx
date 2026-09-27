/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SchoolProfile, BkuItem, KwitansiItem } from './types/bosp';
import { initialSchoolProfile, sampleBkuItems, samplePrebuiltKwitansi } from './utils/sampleData';
import { Header } from './components/Header';
import { BkuTable } from './components/BkuTable';
import { KwitansiGenerator } from './components/KwitansiGenerator';
import { ProcurementDocs } from './components/ProcurementDocs';
import { BkuPrintReport } from './components/BkuPrintReport';
import { SchoolProfileModal } from './components/SchoolProfileModal';
import { ImportBkuModal } from './components/ImportBkuModal';
import { Download, Upload, RotateCcw, ShieldCheck } from 'lucide-react';

export default function App() {
  // Load state from localStorage or empty default
  const [profile, setProfile] = useState<SchoolProfile>(() => {
    try {
      const saved = localStorage.getItem('sibosp_profile');
      return saved ? JSON.parse(saved) : initialSchoolProfile;
    } catch {
      return initialSchoolProfile;
    }
  });

  const [bkuItems, setBkuItems] = useState<BkuItem[]>(() => {
    try {
      const saved = localStorage.getItem('sibosp_bku');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [kwitansiList, setKwitansiList] = useState<KwitansiItem[]>(() => {
    try {
      const saved = localStorage.getItem('sibosp_kwitansi');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'bku' | 'kwitansi' | 'procurement' | 'laporan-bku'>('bku');
  const [selectedBkuIds, setSelectedBkuIds] = useState<string[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sibosp_profile', JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile to localStorage', e);
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem('sibosp_bku', JSON.stringify(bkuItems));
    } catch (e) {
      console.error('Failed to save BKU to localStorage', e);
    }
  }, [bkuItems]);

  useEffect(() => {
    try {
      localStorage.setItem('sibosp_kwitansi', JSON.stringify(kwitansiList));
    } catch (e) {
      console.error('Failed to save kwitansi to localStorage', e);
    }
  }, [kwitansiList]);

  // Handlers for BKU
  const handleToggleSelectBku = (id: string) => {
    setSelectedBkuIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllBku = (ids: string[]) => {
    setSelectedBkuIds(ids);
  };

  const handleClearSelection = () => {
    setSelectedBkuIds([]);
  };

  const handleUpdateBkuItem = (updated: BkuItem) => {
    setBkuItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleAddBkuItem = (newItem: BkuItem) => {
    setBkuItems((prev) => [...prev, newItem]);
  };

  const handleDeleteBkuItem = (id: string) => {
    setBkuItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedBkuIds((prev) => prev.filter((itemId) => itemId !== id));
  };

  const handleImportSuccess = (
    imported: BkuItem[],
    mode: 'replace' | 'append',
    profileData?: Partial<SchoolProfile>
  ) => {
    if (mode === 'replace') {
      setBkuItems(imported);
      setSelectedBkuIds([]);
    } else {
      setBkuItems((prev) => [...prev, ...imported]);
    }

    // Auto-update school profile if data was extracted from ARKAS database
    if (profileData) {
      setProfile((prev) => ({
        ...prev,
        namaSekolah: profileData.namaSekolah || prev.namaSekolah,
        npsn: profileData.npsn || prev.npsn,
        alamat: profileData.alamat || prev.alamat,
        desaKelurahan: profileData.desaKelurahan || prev.desaKelurahan,
        kecamatan: profileData.kecamatan || prev.kecamatan,
        kabupatenKota: profileData.kabupatenKota || prev.kabupatenKota,
        provinsi: profileData.provinsi || prev.provinsi,
        telepon: profileData.telepon || prev.telepon,
        email: profileData.email || prev.email,
        namaKepalaSekolah: profileData.namaKepalaSekolah || prev.namaKepalaSekolah,
        nipKepalaSekolah: profileData.nipKepalaSekolah || prev.nipKepalaSekolah,
        namaBendahara: profileData.namaBendahara || prev.namaBendahara,
        nipBendahara: profileData.nipBendahara || prev.nipBendahara,
        namaBank: profileData.namaBank || prev.namaBank,
        noRekening: profileData.noRekening || prev.noRekening,
      }));
    }
  };

  // Merge selected BKUs to 1 Kwitansi
  const handleMergeToKwitansi = () => {
    if (selectedBkuIds.length === 0) {
      alert('Pilih minimal satu transaksi pengeluaran BKU dengan mencentang kotak pada tabel.');
      return;
    }
    setActiveTab('kwitansi');
  };

  // Handlers for Kwitansi
  const handleSaveKwitansi = (newKwitansi: KwitansiItem) => {
    setKwitansiList((prev) => {
      const existsIndex = prev.findIndex((k) => k.id === newKwitansi.id);
      if (existsIndex >= 0) {
        const copy = [...prev];
        copy[existsIndex] = newKwitansi;
        return copy;
      }
      return [newKwitansi, ...prev];
    });

    // Mark corresponding BKU items with kwitansiId
    setBkuItems((prev) =>
      prev.map((item) => {
        if (newKwitansi.bkuIds.includes(item.id)) {
          return { ...item, kwitansiId: newKwitansi.id };
        }
        return item;
      })
    );
  };

  const handleDeleteKwitansi = (id: string) => {
    setKwitansiList((prev) => prev.filter((k) => k.id !== id));
    // Unmark BKU items
    setBkuItems((prev) =>
      prev.map((item) => {
        if (item.kwitansiId === id) {
          const { kwitansiId, ...rest } = item;
          return rest as BkuItem;
        }
        return item;
      })
    );
  };

  // Backup and Restore JSON
  const handleBackupData = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      profile,
      bkuItems,
      kwitansiList,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `SI_BOSP_Backup_${profile.namaSekolah.replace(/[^a-zA-Z0-9]/g, '_')}_${profile.tahunAnggaran}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.profile) setProfile(json.profile);
        if (json.bkuItems && Array.isArray(json.bkuItems)) setBkuItems(json.bkuItems);
        if (json.kwitansiList && Array.isArray(json.kwitansiList)) setKwitansiList(json.kwitansiList);
        alert('Data berhasil dipulihkan dari file backup!');
      } catch (err) {
        alert('Format file backup tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = () => {
    if (confirm('Kosongkan seluruh data transaksi BKU dan daftar kwitansi saat ini?')) {
      setBkuItems([]);
      setKwitansiList([]);
      setSelectedBkuIds([]);
      localStorage.removeItem('sibosp_bku');
      localStorage.removeItem('sibosp_kwitansi');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        profile={profile}
        onOpenImport={() => setIsImportModalOpen(true)}
        selectedBkuCount={selectedBkuIds.length}
        onMergeToKwitansi={handleMergeToKwitansi}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation context banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2 no-print border-b border-slate-200 mb-5">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            {profile.namaSekolah ? (
              <span className="font-semibold text-slate-800">{profile.namaSekolah}</span>
            ) : (
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="font-semibold text-rose-700 hover:text-rose-800 underline decoration-rose-300"
              >
                + Masukkan Nama &amp; Data Sekolah
              </button>
            )}
            {profile.npsn && (
              <>
                <span aria-hidden="true">·</span>
                <span>NPSN: {profile.npsn}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-emerald-800 font-medium">{profile.jenisBosp}</span>
            <span aria-hidden="true">·</span>
            <span>{profile.tahap} TA {profile.tahunAnggaran}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleBackupData}
              className="flex items-center gap-1 text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-200/60 transition-colors"
              title="Cadangkan seluruh database BKU & Kwitansi ke berkas JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup</span>
            </button>

            <label className="flex items-center gap-1 text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-200/60 transition-colors cursor-pointer" title="Pulihkan data dari cadangan JSON">
              <Upload className="w-3.5 h-3.5" />
              <span>Restore</span>
              <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
            </label>

            {bkuItems.length > 0 && (
              <button
                onClick={handleClearAllData}
                className="flex items-center gap-1 text-slate-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                title="Kosongkan data BKU"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kosongkan BKU</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Buku Kas Umum (BKU) Table */}
        {activeTab === 'bku' && (
          <BkuTable
            items={bkuItems}
            profile={profile}
            selectedIds={selectedBkuIds}
            onToggleSelect={handleToggleSelectBku}
            onSelectAll={handleSelectAllBku}
            onClearSelection={handleClearSelection}
            onUpdateItem={handleUpdateBkuItem}
            onAddItem={handleAddBkuItem}
            onDeleteItem={handleDeleteBkuItem}
            onOpenImport={() => setIsImportModalOpen(true)}
            onMergeToKwitansi={handleMergeToKwitansi}
            onPrintBku={() => setActiveTab('laporan-bku')}
          />
        )}

        {/* Tab 2: Generator & Multi-BKU Merge Kwitansi */}
        {activeTab === 'kwitansi' && (
          <KwitansiGenerator
            bkuItems={bkuItems}
            profile={profile}
            selectedBkuIds={selectedBkuIds}
            kwitansiList={kwitansiList}
            onSaveKwitansi={handleSaveKwitansi}
            onDeleteKwitansi={handleDeleteKwitansi}
            onSelectBkuIds={setSelectedBkuIds}
          />
        )}

        {/* Tab 3: Dokumen Pengadaan (SP, BAST, Invoice) */}
        {activeTab === 'procurement' && (
          <ProcurementDocs
            bkuItems={bkuItems}
            profile={profile}
            kwitansiList={kwitansiList}
          />
        )}

        {/* Tab 4: Official Kemendikbud BKU Printable Sheet */}
        {activeTab === 'laporan-bku' && (
          <BkuPrintReport
            items={bkuItems}
            profile={profile}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Format pelaporan BKU, Kwitansi, SP, dan BAST terstandarisasi Permendikbudristek RI</span>
          </div>
          <div>
            Sistem Informasi Pelaporan BOSP Terintegrasi ARKAS
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SchoolProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
        onSave={(updated) => setProfile(updated)}
      />

      <ImportBkuModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
