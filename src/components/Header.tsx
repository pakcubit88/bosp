import React from 'react';
import { SchoolProfile } from '../types/bosp';
import { BookOpen, FileText, Settings, UploadCloud, FileSpreadsheet, Database } from 'lucide-react';

interface HeaderProps {
  activeTab: 'bku' | 'kwitansi' | 'procurement' | 'laporan-bku';
  setActiveTab: (tab: 'bku' | 'kwitansi' | 'procurement' | 'laporan-bku') => void;
  onOpenProfile: () => void;
  profile: SchoolProfile;
  onOpenImport: () => void;
  selectedBkuCount: number;
  onMergeToKwitansi: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenProfile,
  profile,
  onOpenImport,
  selectedBkuCount,
  onMergeToKwitansi,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold text-base shadow-xs">
            B
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-900 leading-tight">
              SI-BOSP
            </span>
            <span className="text-[11px] text-slate-500 font-medium leading-none truncate max-w-[200px] sm:max-w-xs">
              {profile.namaSekolah || 'Data Sekolah Belum Diatur'} · {profile.tahunAnggaran} {profile.tahap}
            </span>
          </div>
        </div>

        {/* Zone 2: 4 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('bku')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'bku'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Buku Kas Umum (BKU)</span>
          </button>

          <button
            onClick={() => setActiveTab('kwitansi')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'kwitansi'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Kwitansi Gabungan</span>
          </button>

          <button
            onClick={() => setActiveTab('procurement')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'procurement'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Dokumen SP, BAST & Invoice</span>
          </button>

          <button
            onClick={() => setActiveTab('laporan-bku')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'laporan-bku'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Cetak BKU Resmi</span>
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2">
          {selectedBkuCount > 0 && activeTab === 'bku' && (
            <button
              onClick={onMergeToKwitansi}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap animate-pulse"
              title="Gabungkan nomor BKU yang dipilih menjadi 1 kwitansi"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Gabung {selectedBkuCount} BKU ke Kwitansi</span>
            </button>
          )}

          <button
            onClick={onOpenImport}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap shadow-xs"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Impor BKU ARKAS</span>
          </button>

          <button
            onClick={onOpenProfile}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            title="Pengaturan Profil Sekolah & Penandatangan"
            aria-label="Pengaturan Sekolah"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex border-t border-slate-200 overflow-x-auto py-1 px-3 gap-1 bg-slate-50">
        <button
          onClick={() => setActiveTab('bku')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'bku' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          BKU ARKAS
        </button>
        <button
          onClick={() => setActiveTab('kwitansi')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'kwitansi' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          Kwitansi
        </button>
        <button
          onClick={() => setActiveTab('procurement')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'procurement' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          SP/BAST/Invoice
        </button>
        <button
          onClick={() => setActiveTab('laporan-bku')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'laporan-bku' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          Format Kemdikbud
        </button>
      </div>
    </header>
  );
};
