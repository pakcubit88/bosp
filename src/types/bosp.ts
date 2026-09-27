export interface SchoolProfile {
  namaSekolah: string;
  npsn: string;
  alamat: string;
  desaKelurahan: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
  kodePos: string;
  telepon: string;
  email: string;
  dinasPendidikan: string;
  namaKepalaSekolah: string;
  nipKepalaSekolah: string;
  namaBendahara: string;
  nipBendahara: string;
  namaPengurusBarang: string;
  nipPengurusBarang: string;
  tahap: 'Tahap I' | 'Tahap II';
  tahunAnggaran: string;
  jenisBosp: 'BOS Reguler' | 'BOS Kinerja' | 'BOS Afirmasi';
  namaBank: string;
  noRekening: string;
}

export type BelanjaCategory = 'Barang/ATK' | 'Jasa/Pemeliharaan' | 'Modal/Aset' | 'Honor' | 'Konsumsi' | 'Lainnya';

export interface BkuItem {
  id: string;
  noBku: string;
  tanggal: string; // YYYY-MM-DD
  kodeKegiatan: string; // e.g. 02.01.01
  kodeRekening: string; // e.g. 5.1.02.01.01.0024
  namaRekening: string;
  noBukti: string;
  uraian: string;
  penerimaan: number;
  pengeluaran: number;
  saldo: number;
  rekanan: string;
  alamatRekanan?: string;
  npwpRekanan?: string;
  kategori: BelanjaCategory;
  kwitansiId?: string;
}

export interface KwitansiSubItem {
  id: string;
  noBkuRef: string;
  deskripsi: string;
  volume: number;
  satuan: string;
  hargaSatuan: number;
  total: number;
}

export interface KwitansiItem {
  id: string;
  nomorKwitansi: string;
  tanggal: string;
  tahunAnggaran: string;
  tahap: string;
  bkuIds: string[];
  bkuNumbers: string[];
  rekanan: string;
  alamatRekanan: string;
  npwpRekanan: string;
  sudahTerimaDari: string;
  banyaknyaUang: number;
  terbilang: string;
  untukPembayaran: string;
  kodeRekening: string;
  namaRekening: string;
  ppnRate: number; // e.g. 11 or 12 or 0
  ppn: number;
  pph21: number;
  pph22: number;
  pph23: number;
  totalPajak: number;
  jumlahDiterima: number;
  items: KwitansiSubItem[];
  keterangan?: string;
}

export interface SuratPesananItem {
  id: string;
  nomorSP: string;
  tanggalSP: string;
  nomorKwitansiRef?: string;
  rekanan: string;
  alamatRekanan: string;
  waktuPenyelesaian: string; // e.g. "3 (Tiga) Hari Kalender"
  sumberDana: string;
  items: Array<{
    namaBarang: string;
    spesifikasi: string;
    volume: number;
    satuan: string;
    hargaSatuan: number;
    total: number;
  }>;
  totalNilai: number;
  terbilang: string;
  syaratKetentuan: string[];
}

export interface BastItem {
  id: string;
  nomorBAST: string;
  tanggalBAST: string;
  nomorSPRef: string;
  tanggalSPRef: string;
  rekanan: string;
  namaPimpinanRekanan: string;
  jabatanRekanan: string;
  alamatRekanan: string;
  items: Array<{
    namaBarang: string;
    spesifikasi: string;
    volume: number;
    satuan: string;
    kondisi: 'Baik' | 'Lengkap' | 'Sesuai';
  }>;
  totalNilai: number;
  kesimpulan: string;
}

export interface InvoiceItem {
  id: string;
  nomorInvoice: string;
  tanggalInvoice: string;
  nomorSuratJalan?: string;
  rekanan: string;
  alamatRekanan: string;
  npwpRekanan: string;
  items: Array<{
    deskripsi: string;
    volume: number;
    satuan: string;
    hargaSatuan: number;
    subtotal: number;
  }>;
  subtotal: number;
  diskon: number;
  ppn: number;
  totalTagihan: number;
  terbilang: string;
}
