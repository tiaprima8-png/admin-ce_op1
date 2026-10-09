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

export type StatusSpk = 'MENUNGGU_SPK' | 'SPK_TERBIT' | 'REALISASI_SELESAI';

export interface Lokasi {
  kode_lokasi: string;
  wilayah: string;
  luas_bruto: number;
  luas_netto: number;
  created_at?: string;
}

export interface RencanaKerja {
  id: string;
  nama_pengawas: string;
  tanggal: string;
  status_unit: UnitStatus;
  kode_unit: string;
  model_unit?: string;
  operator: string;
  kode_lokasi: string;
  wilayah?: string;
  shift_kerja: 'SIANG' | 'MALAM' | 'Siang' | 'Malam';
  nomor_spk?: string | null;
  status_spk: StatusSpk;
  keterangan_rencana?: string | null;
  created_at: string;
}

export interface HasilInputAktivitas {
  id: number | string;
  rencana_id?: string | null;
  nama_pengawas: string;
  tanggal: string;
  kode_unit: string;
  nama_aktivitas: string;
  kode_sap: string;
  satuan: string;
  operator: string;
  nik_operator: string;
  kode_lokasi?: string;
  lokasi: string;
  nomor_spk?: string | null;
  shift_kerja: 'Siang' | 'Malam' | 'SIANG' | 'MALAM';
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
