export interface User {
  id: number;
  nama_lengkap: string;
  username: string;
  password?: string;
  hak_akses: 'Admin' | 'Pengawas';
  status_aktif?: number;
}

export interface Unit {
  id: number;
  kode_unit: string;
  jenis_unit: string;
  model_unit: string;
  nama_pengawas: string;
  hm_unit_terakhir_diinputkan: number;
  hm_min_standar?: number | null;
  hm_max_standar?: number | null;
  status_aktif?: number;
  updated_at: string;
}

export interface HmStandarConfig {
  min: number;
  max: number;
}

export interface HmStandarResponse {
  hm_min_standar: number;
  hm_max_standar: number;
  hm_min?: number;
  hm_max?: number;
}

export interface AktivitasUnit {
  id: number;
  jenis_unit: string;
  nama_aktivitas: string;
  satuan: string;
  kode_sap: string;
  status_aktif?: number;
}

export interface Operator {
  id: number;
  nama_operator: string;
  nik: string;
  nama_pengawas: string;
  status_aktif?: number;
}

export type UnitStatus = 'OPERASI' | 'STANDBY' | 'BREAKDOWN';

export type StatusSpk = 'MENUNGGU_SPK' | 'SPK_TERBIT' | 'REALISASI_SELESAI' | 'TEREALISASI' | 'MENUNGGU' | string;

export interface Lokasi {
  kode_lokasi: string;
  wilayah: string;
  luas_bruto: number;
  luas_netto: number;
  status_aktif?: number;
  created_at?: string;
}

export interface RencanaKerja {
  id: string;
  nama_pengawas: string;
  tanggal: string;
  tanggal_kerja?: string;
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
  updated_at?: string;
}

export interface MasterKendala {
  id: number;
  nama_kendala: string;
  status_aktif: number; // 1: Aktif, 0: Nonaktif
  created_at: string;
}

export interface KendalaItem {
  id?: number | string;
  nama_kendala: string;
  waktu_mulai?: string; // Format JJ:MM
  waktu_selesai?: string; // Format JJ:MM
  durasi_menit?: number;
  keterangan?: string;
}

export interface AktivitasKendala {
  id: number;
  id_aktivitas: number | string;
  id_kendala?: string | null;
  nama_kendala: string;
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
  durasi_menit?: number | null;
  created_at: string;
}

export interface HasilInputAktivitas {
  id: number | string;
  client_transaction_id?: string | null;
  rencana_id?: string | null;
  id_rencana_kerja?: string | null;
  nama_pengawas: string;
  tanggal: string;
  tanggal_kerja?: string;
  kode_unit: string;
  nama_aktivitas: string;
  kode_sap: string;
  satuan: string;
  operator: string;
  nik_operator: string;
  kode_lokasi?: string;
  lokasi: string;
  nomor_spk?: string | null;
  status_spk?: StatusSpk | null;
  status_realisasi?: 'TEREALISASI' | 'BELUM_INPUT' | string;
  shift_kerja: 'Siang' | 'Malam' | 'SIANG' | 'MALAM';
  jam_kerja?: number | null;
  hm_awal?: number | null;
  hm_akhir?: number | null;
  hm_harian_berjalan?: number | null;
  durasi_hm?: number | null;
  hasil_kerja?: number | null;
  keterangan: string;
  foto_bukti?: string | null;
  has_foto_bukti?: boolean;
  has_foto_solar?: boolean;
  has_foto_hm?: boolean;
  has_foto?: boolean;
  status_unit: UnitStatus;
  is_isi_solar?: boolean | number;
  solar?: number | null;
  jumlah_liter_solar?: number | null;
  stik_awal?: number | null;
  stik_akhir?: number | null;
  kendala_list?: KendalaItem[] | string | null;
  is_hm_awal_corrected?: boolean | number;
  alasan_koreksi_hm?: string | null;
  created_at: string;
  model_unit?: string;
  wilayah?: string;
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
