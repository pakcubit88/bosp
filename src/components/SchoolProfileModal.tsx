import React, { useState } from 'react';
import { SchoolProfile } from '../types/bosp';
import { X, Save, RotateCcw } from 'lucide-react';
import { initialSchoolProfile } from '../utils/sampleData';

interface SchoolProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: SchoolProfile;
  onSave: (updated: SchoolProfile) => void;
}

export const SchoolProfileModal: React.FC<SchoolProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSave,
}) => {
  const [formData, setFormData] = useState<SchoolProfile>(profile);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleReset = () => {
    if (confirm('Kosongkan seluruh isian formulir profil sekolah?')) {
      setFormData(initialSchoolProfile);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Pengaturan Profil Satuan Pendidikan & Pejabat BOSP
            </h2>
            <p className="text-xs text-slate-500">
              Data ini akan dicetak otomatis pada Kop Surat, Kwitansi, SP, BAST, dan BKU Resmi
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Bagian 1: Identitas Sekolah & Anggaran */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              1. Identitas Satuan Pendidikan & Anggaran BOSP
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Satuan Pendidikan / Sekolah *
                </label>
                <input
                  type="text"
                  name="namaSekolah"
                  value={formData.namaSekolah}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  placeholder="Contoh: SD NEGERI 1 CEMERLANG"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  NPSN *
                </label>
                <input
                  type="text"
                  name="npsn"
                  value={formData.npsn}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none font-mono-num"
                  placeholder="20401827"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tahun Anggaran *
                </label>
                <input
                  type="text"
                  name="tahunAnggaran"
                  value={formData.tahunAnggaran}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none font-mono-num"
                  placeholder="2026"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tahap Penyaluran BOSP *
                </label>
                <select
                  name="tahap"
                  value={formData.tahap}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="Tahap I">Tahap I (Januari - Juni)</option>
                  <option value="Tahap II">Tahap II (Juli - Desember)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Jenis Dana BOSP *
                </label>
                <select
                  name="jenisBosp"
                  value={formData.jenisBosp}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="BOS Reguler">BOS Reguler</option>
                  <option value="BOS Kinerja">BOS Kinerja</option>
                  <option value="BOS Afirmasi">BOS Afirmasi</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Header Instansi Kop Surat (Dinas Pendidikan)
                </label>
                <textarea
                  name="dinasPendidikan"
                  value={formData.dinasPendidikan}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  placeholder="PEMERINTAH KABUPATEN BANDUNG&#10;DINAS PENDIDIKAN"
                />
              </div>
            </div>
          </div>

          {/* Bagian 2: Alamat & Kontak */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              2. Alamat & Kontak Satuan Pendidikan
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Jalan / RT / RW *
                </label>
                <input
                  type="text"
                  name="alamat"
                  value={formData.alamat}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  placeholder="Jl. Pendidikan No. 45"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kelurahan / Desa
                </label>
                <input
                  type="text"
                  name="desaKelurahan"
                  value={formData.desaKelurahan}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kecamatan
                </label>
                <input
                  type="text"
                  name="kecamatan"
                  value={formData.kecamatan}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kabupaten / Kota *
                </label>
                <input
                  type="text"
                  name="kabupatenKota"
                  value={formData.kabupatenKota}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Provinsi *
                </label>
                <input
                  type="text"
                  name="provinsi"
                  value={formData.provinsi}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nomor Telepon
                </label>
                <input
                  type="text"
                  name="telepon"
                  value={formData.telepon}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Sekolah
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bank & No Rekening BOSP
                </label>
                <input
                  type="text"
                  name="noRekening"
                  value={formData.noRekening}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none font-mono-num"
                  placeholder="0012938475019 (Bank BJB)"
                />
              </div>
            </div>
          </div>

          {/* Bagian 3: Pejabat Penandatangan */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              3. Pejabat Penandatangan Dokumen (Kwitansi, SP, BAST, BKU)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Kepala Sekolah */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Kepala Satuan Pendidikan / Kepala Sekolah
                </span>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-0.5">
                    Nama Lengkap beserta Gelar *
                  </label>
                  <input
                    type="text"
                    name="namaKepalaSekolah"
                    value={formData.namaKepalaSekolah}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-0.5">
                    NIP Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    name="nipKepalaSekolah"
                    value={formData.nipKepalaSekolah}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none font-mono-num"
                    placeholder="19720514 199803 1 004 / -"
                  />
                </div>
              </div>

              {/* Bendahara */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Bendahara Dana BOSP
                </span>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-0.5">
                    Nama Lengkap beserta Gelar *
                  </label>
                  <input
                    type="text"
                    name="namaBendahara"
                    value={formData.namaBendahara}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-0.5">
                    NIP Bendahara
                  </label>
                  <input
                    type="text"
                    name="nipBendahara"
                    value={formData.nipBendahara}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none font-mono-num"
                    placeholder="19850822 201001 2 018 / -"
                  />
                </div>
              </div>

              {/* Pengurus / Penerima Hasil Pekerjaan (BAST) */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 sm:col-span-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Petugas Penerima / Pengurus Barang (Untuk Berita Acara Serah Terima / BAST)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-0.5">
                      Nama Pengurus / Pemeriksa Barang
                    </label>
                    <input
                      type="text"
                      name="namaPengurusBarang"
                      value={formData.namaPengurusBarang}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-0.5">
                      NIP Pengurus Barang
                    </label>
                    <input
                      type="text"
                      name="nipPengurusBarang"
                      value={formData.nipPengurusBarang}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-none font-mono-num"
                      placeholder="19910315 201902 1 006 / -"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Kosongkan Isian Form</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
