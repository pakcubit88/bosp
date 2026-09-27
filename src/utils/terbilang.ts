/**
 * Utility konversi angka nominal Rupiah menjadi teks terbilang Bahasa Indonesia
 */

const SATUAN = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

function konversiRatusan(n: number): string {
  let hasil = '';

  if (n >= 100) {
    const ratus = Math.floor(n / 100);
    if (ratus === 1) {
      hasil += 'Seratus ';
    } else {
      hasil += SATUAN[ratus] + ' Ratus ';
    }
    n %= 100;
  }

  if (n >= 20) {
    const puluh = Math.floor(n / 10);
    hasil += SATUAN[puluh] + ' Puluh ';
    n %= 10;
  } else if (n >= 12) {
    hasil += SATUAN[n - 10] + ' Belas ';
    n = 0;
  } else if (n > 0) {
    hasil += SATUAN[n] + ' ';
    n = 0;
  }

  if (n > 0) {
    hasil += SATUAN[n] + ' ';
  }

  return hasil;
}

export function terbilang(nominal: number): string {
  if (nominal === 0) return 'Nol Rupiah';
  if (nominal < 0) return 'Minus ' + terbilang(Math.abs(nominal));

  // Bulatkan ke bilangan bulat
  let sisa = Math.round(nominal);
  let hasil = '';

  // Triliun
  if (sisa >= 1_000_000_000_000) {
    const triliun = Math.floor(sisa / 1_000_000_000_000);
    hasil += konversiRatusan(triliun) + 'Triliun ';
    sisa %= 1_000_000_000_000;
  }

  // Miliar
  if (sisa >= 1_000_000_000) {
    const miliar = Math.floor(sisa / 1_000_000_000);
    hasil += konversiRatusan(miliar) + 'Miliar ';
    sisa %= 1_000_000_000;
  }

  // Juta
  if (sisa >= 1_000_000) {
    const juta = Math.floor(sisa / 1_000_000);
    hasil += konversiRatusan(juta) + 'Juta ';
    sisa %= 1_000_000;
  }

  // Ribu
  if (sisa >= 1_000) {
    const ribu = Math.floor(sisa / 1_000);
    if (ribu === 1) {
      hasil += 'Seribu ';
    } else {
      hasil += konversiRatusan(ribu) + 'Ribu ';
    }
    sisa %= 1_000;
  }

  // Ratusan/Satuan
  if (sisa > 0) {
    hasil += konversiRatusan(sisa);
  }

  return hasil.trim() + ' Rupiah';
}

export function formatRupiah(val: number): string {
  if (isNaN(val)) return 'Rp 0';
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

export function formatTanggalIndonesia(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const bulan = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}
