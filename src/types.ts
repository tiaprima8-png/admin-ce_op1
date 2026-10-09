export interface User {
  id: number;
  nama_lengkap: string;
  username: string;
  password?: string;
  hak_akses: 'Admin' | 'Pengawas';
}

export interface Unit {
  id: number;
  kode_unit: string;
  jenis_unit: string;
  model_unit: string;
  nama_pengawas: string;
  hm_unit_terakhir_diinputkan: number;
  updated_at: string;
}

export interface AktivitasUnit {
  id: number;
  jenis_unit: string;
  nama_aktivitas: string;
  satuan: string;
  kode_sap: string;
}

export interface Operator {
  id: number;
  nama_operator: string;
  nik: string;
  nama_pengawas: string;
}

export type UnitStatus = 'OPERASI' | 'STANDBY' | 'BREAKDOWN';

export interface HasilInputAktivitas {
  id: number;
  nama_pengawas: string;
  tanggal: string;
  kode_unit: string;
  nama_aktivitas: string;
  kode_sap: string;
  satuan: string;
  operator: string;
  nik_operator: string;
  lokasi: string;
  shift_kerja: 'Siang' | 'Malam';
  jam_kerja: number;
  hm_awal: number;
  hm_akhir: number;
  hm_harian_berjalan: number;
  hasil_kerja: number;
  keterangan: string;
  foto_bukti?: string | null;
  status_unit: UnitStatus;
  is_isi_solar: boolean | number;
  jumlah_liter_solar: number;
  created_at: string;
  _isNew?: boolean; // UI highlight flag
}

export interface KpiStats {
  totalHmBerjalan: number;
  totalJamKerja: number;
  unitBeroperasi: number;
  totalLaporanMasuk: number;
  shiftSiangCount: number;
  shiftMalamCount: number;
  totalSolarTerpakai: number;
}

export interface UnitAnalyticsRow {
  kode_unit: string;
  model_unit: string;
  nama_pengawas: string;
  total_jam_kerja: number;
  total_hm: number;
  total_solar: number;
  rasio_efisiensi: number; // Liter / HM
  freq_breakdown_standby: number;
  total_volume: number;
}

export interface AktivitasAnalyticsRow {
  nama_aktivitas: string;
  kode_sap: string;
  satuan: string;
  total_volume: number;
  total_hm: number;
  unit_terlibat: number;
}

export interface StatusWaktuAnalytics {
  operasi_count: number;
  operasi_hours: number;
  operasi_percent: number;
  standby_count: number;
  standby_hours: number;
  standby_percent: number;
  breakdown_count: number;
  breakdown_hours: number;
  breakdown_percent: number;
  total_hours: number;
}

export interface AnalyticsSummary {
  totalSolar: number;
  totalHm: number;
  rasioKonsumsi: number;
  totalRecords: number;
  unitData: UnitAnalyticsRow[];
  aktivitasData: AktivitasAnalyticsRow[];
  statusWaktu: StatusWaktuAnalytics;
}
