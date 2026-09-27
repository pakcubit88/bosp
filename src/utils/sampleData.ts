import { SchoolProfile, BkuItem, KwitansiItem } from '../types/bosp';

export const initialSchoolProfile: SchoolProfile = {
  namaSekolah: '',
  npsn: '',
  alamat: '',
  desaKelurahan: '',
  kecamatan: '',
  kabupatenKota: '',
  provinsi: '',
  kodePos: '',
  telepon: '',
  email: '',
  dinasPendidikan: '',
  namaKepalaSekolah: '',
  nipKepalaSekolah: '',
  namaBendahara: '',
  nipBendahara: '',
  namaPengurusBarang: '',
  nipPengurusBarang: '',
  tahap: 'Tahap I',
  tahunAnggaran: String(new Date().getFullYear()),
  jenisBosp: 'BOS Reguler',
  namaBank: '',
  noRekening: '',
};

export const sampleBkuItems: BkuItem[] = [];

export const samplePrebuiltKwitansi: KwitansiItem | null = null;
