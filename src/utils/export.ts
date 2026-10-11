import * as XLSX from 'xlsx';
import { HasilInputAktivitas, UnitAnalyticsRow, AktivitasAnalyticsRow, AnalyticsSummary } from '../types';

function formatKendalaForExcel(kendala: unknown): string {
  if (!kendala) return '-';
  let items: Array<{ nama_kendala?: string; waktu_mulai?: string; waktu_selesai?: string; durasi_menit?: number }> = [];
  if (Array.isArray(kendala)) {
    items = kendala;
  } else if (typeof kendala === 'string') {
    try {
      const parsed = JSON.parse(kendala);
      if (Array.isArray(parsed)) items = parsed;
      else return kendala;
    } catch {
      return kendala;
    }
  }
  if (!items || items.length === 0) return '-';
  return items.map((k, idx) => {
    const nama = k.nama_kendala || 'Kendala';
    const range = (k.waktu_mulai && k.waktu_selesai) ? `${k.waktu_mulai} - ${k.waktu_selesai}` : '';
    const durasi = k.durasi_menit !== undefined ? `${k.durasi_menit} menit` : '';
    const detail = [range, durasi].filter(Boolean).join(' | ');
    return `${idx + 1}. ${nama}${detail ? ` (${detail})` : ''}`;
  }).join('; ');
}

export function exportToExcel(
  data: HasilInputAktivitas[],
  filename = `rekapitulasi_rkce_${new Date().toISOString().slice(0, 10)}.xlsx`
): void {
  if (data.length === 0) {
    return;
  }

  // Map rows with clean enterprise Indonesian column names
  const rows = data.map((item, index) => ({
    'No': index + 1,
    'Nomor SPK': item.nomor_spk || '-',
    'Tanggal': item.tanggal,
    'Shift': item.shift_kerja ? item.shift_kerja.toUpperCase() : 'SIANG',
    'Pengawas': item.nama_pengawas,
    'Kode Unit': item.kode_unit,
    'Status Unit': item.status_unit || 'OPERASI',
    'HM Awal': item.hm_awal,
    'Koreksi HM Awal': (item.is_hm_awal_corrected === 1 || item.is_hm_awal_corrected === true) ? 'YA' : 'TIDAK',
    'Alasan Koreksi HM': item.alasan_koreksi_hm || '-',
    'HM Akhir': item.hm_akhir,
    'HM Berjalan': item.hm_harian_berjalan,
    'Jam Kerja (Jam)': item.jam_kerja,
    'Stik Solar Awal': item.stik_awal !== undefined && item.stik_awal !== null ? item.stik_awal : '-',
    'Stik Solar Akhir': item.stik_akhir !== undefined && item.stik_akhir !== null ? item.stik_akhir : '-',
    'Konsumsi Solar (Liter)': item.jumlah_liter_solar && item.jumlah_liter_solar > 0 ? item.jumlah_liter_solar : 0,
    'Nama Aktivitas': item.nama_aktivitas,
    'Kode SAP': item.kode_sap,
    'Satuan': item.satuan,
    'Hasil Kerja': item.hasil_kerja,
    'Daftar Kendala (Nama, Waktu Mulai, Waktu Selesai, Total Menit)': formatKendalaForExcel(item.kendala_list),
    'Keterangan Lapangan': item.keterangan || '-',
    'Operator': item.operator,
    'NIK Operator': item.nik_operator,
    'Kode Lokasi': item.kode_lokasi || item.lokasi,
    'Foto Bukti': item.foto_bukti ? 'Ada Foto Bukti' : 'Tanpa Foto'
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set explicit column widths for professional layout
  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 16 }, // Nomor SPK
    { wch: 13 }, // Tanggal
    { wch: 10 }, // Shift
    { wch: 18 }, // Pengawas
    { wch: 12 }, // Kode Unit
    { wch: 14 }, // Status Unit
    { wch: 12 }, // HM Awal
    { wch: 16 }, // Koreksi HM Awal
    { wch: 28 }, // Alasan Koreksi HM
    { wch: 12 }, // HM Akhir
    { wch: 14 }, // HM Berjalan
    { wch: 16 }, // Jam Kerja
    { wch: 15 }, // Stik Solar Awal
    { wch: 15 }, // Stik Solar Akhir
    { wch: 22 }, // Konsumsi Solar
    { wch: 30 }, // Nama Aktivitas
    { wch: 14 }, // Kode SAP
    { wch: 10 }, // Satuan
    { wch: 14 }, // Hasil Kerja
    { wch: 45 }, // Daftar Kendala
    { wch: 35 }, // Keterangan Lapangan
    { wch: 20 }, // Operator
    { wch: 14 }, // NIK Operator
    { wch: 14 }, // Kode Lokasi
    { wch: 16 }  // Foto Bukti
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekapitulasi Aktivitas');

  // Trigger browser download of .xlsx file
  XLSX.writeFile(workbook, filename);
}

export function exportAnalyticsToExcel(
  unitData: UnitAnalyticsRow[],
  aktivitasData: AktivitasAnalyticsRow[],
  summary: AnalyticsSummary,
  filename = `rangkuman_analitik_rkce_${new Date().toISOString().slice(0, 10)}.xlsx`
): void {
  const workbook = XLSX.utils.book_new();

  // 1. Sheet Rangkuman Per Unit
  let grandTotalJam = 0;
  let grandTotalHm = 0;
  let grandTotalSolar = 0;
  let grandTotalVolume = 0;
  let grandTotalFreq = 0;

  const unitRows = unitData.map((u, idx) => {
    grandTotalJam += u.total_jam_kerja;
    grandTotalHm += u.total_hm;
    grandTotalSolar += u.total_solar;
    grandTotalVolume += u.total_volume;
    grandTotalFreq += u.freq_breakdown_standby;

    return {
      'No': idx + 1,
      'Kode Unit': u.kode_unit,
      'Model Alat': u.model_unit,
      'Pengawas Penanggung Jawab': u.nama_pengawas,
      'Total Jam Kerja (Jam)': u.total_jam_kerja,
      'Total HM Berjalan': u.total_hm,
      'Jumlah Solar Unit (Liter)': u.total_solar,
      'Rasio Efisiensi (Liter/HM)': u.rasio_efisiensi,
      'Frekuensi Breakdown / Standby': u.freq_breakdown_standby,
      'Total Volume Hasil Kerja': u.total_volume
    };
  });

  // Append Total Ringkasan Row
  const overallRatio = grandTotalHm > 0 ? Math.round((grandTotalSolar / grandTotalHm) * 100) / 100 : 0;
  unitRows.push({
    'No': 'TOTAL' as unknown as number,
    'Kode Unit': `TOTAL (${unitData.length} UNIT)`,
    'Model Alat': '-',
    'Pengawas Penanggung Jawab': 'SELURUH PENGAWAS',
    'Total Jam Kerja (Jam)': Math.round(grandTotalJam * 10) / 10,
    'Total HM Berjalan': Math.round(grandTotalHm * 10) / 10,
    'Jumlah Solar Unit (Liter)': Math.round(grandTotalSolar * 10) / 10,
    'Rasio Efisiensi (Liter/HM)': overallRatio,
    'Frekuensi Breakdown / Standby': grandTotalFreq,
    'Total Volume Hasil Kerja': Math.round(grandTotalVolume * 10) / 10
  });

  const wsUnit = XLSX.utils.json_to_sheet(unitRows);
  wsUnit['!cols'] = [
    { wch: 8 },  // No
    { wch: 16 }, // Kode Unit
    { wch: 22 }, // Model Alat
    { wch: 26 }, // Pengawas
    { wch: 20 }, // Total Jam Kerja
    { wch: 18 }, // Total HM Berjalan
    { wch: 24 }, // Jumlah Solar Unit
    { wch: 24 }, // Rasio Efisiensi
    { wch: 28 }, // Frekuensi Breakdown
    { wch: 24 }  // Total Volume
  ];
  XLSX.utils.book_append_sheet(workbook, wsUnit, 'Rangkuman Per Unit');

  // 2. Sheet Rangkuman Per Aktivitas
  const actRows = aktivitasData.map((act, idx) => ({
    'No': idx + 1,
    'Nama Aktivitas': act.nama_aktivitas,
    'Kode SAP': act.kode_sap,
    'Satuan': act.satuan,
    'Total Akumulasi Volume': act.total_volume,
    'Total Alokasi HM': act.total_hm,
    'Jumlah Unit Terlibat': act.unit_terlibat
  }));

  const wsAct = XLSX.utils.json_to_sheet(actRows);
  wsAct['!cols'] = [
    { wch: 8 },  // No
    { wch: 34 }, // Nama Aktivitas
    { wch: 16 }, // Kode SAP
    { wch: 12 }, // Satuan
    { wch: 24 }, // Total Volume
    { wch: 18 }, // Total HM
    { wch: 20 }  // Unit Terlibat
  ];
  XLSX.utils.book_append_sheet(workbook, wsAct, 'Rangkuman Per Aktivitas');

  // 3. Sheet Ringkasan Metrik Operasional
  const summaryRows = [
    { 'Indikator Kinerja Utama (KPI)': 'Total Penggunaan Seluruh Solar', 'Nilai': `${summary.totalSolar.toLocaleString('id-ID')} Liter`, 'Deskripsi': 'Akumulasi total konsumsi solar periode terpilih' },
    { 'Indikator Kinerja Utama (KPI)': 'Total Seluruh HM Berjalan', 'Nilai': `${summary.totalHm.toLocaleString('id-ID')} HM`, 'Deskripsi': 'Akumulasi seluruh jam operasi Hour Meter fleet' },
    { 'Indikator Kinerja Utama (KPI)': 'Rata-rata Rasio Konsumsi Solar', 'Nilai': `${summary.rasioKonsumsi.toLocaleString('id-ID')} Liter/HM`, 'Deskripsi': 'Rasio konsumsi bahan bakar rata-rata armada' },
    { 'Indikator Kinerja Utama (KPI)': 'Persentase Waktu Efektif Operasi', 'Nilai': `${summary.statusWaktu.operasi_percent}% (${summary.statusWaktu.operasi_hours} Jam)`, 'Deskripsi': `${summary.statusWaktu.operasi_count} transaksi status OPERASI` },
    { 'Indikator Kinerja Utama (KPI)': 'Persentase Waktu Standby', 'Nilai': `${summary.statusWaktu.standby_percent}% (${summary.statusWaktu.standby_hours} Jam)`, 'Deskripsi': `${summary.statusWaktu.standby_count} transaksi status STANDBY` },
    { 'Indikator Kinerja Utama (KPI)': 'Persentase Waktu Breakdown', 'Nilai': `${summary.statusWaktu.breakdown_percent}% (${summary.statusWaktu.breakdown_hours} Jam)`, 'Deskripsi': `${summary.statusWaktu.breakdown_count} transaksi status BREAKDOWN` }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 36 },
    { wch: 24 },
    { wch: 50 }
  ];
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Ringkasan Metrik');

  XLSX.writeFile(workbook, filename);
}
