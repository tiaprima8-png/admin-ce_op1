export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'MANAGER';

export const DAFTAR_WILAYAH = [
  'Geodesi PG1',
  'Geodesi PG2',
  'Geodesi PG3',
  'RC PG1',
  'RC PG2',
  'RC PG3',
  'LEBUNG PG12',
  'LEBUNG PG3'
] as const;

export const DAFTAR_WILAYAH_FILTER = [
  'Semua Wilayah',
  'Geodesi PG1',
  'Geodesi PG2',
  'Geodesi PG3',
  'RC PG1',
  'RC PG2',
  'RC PG3',
  'LEBUNG PG12',
  'LEBUNG PG3'
] as const;

export type WilayahKerja = typeof DAFTAR_WILAYAH[number];
export type WilayahFilterOption = typeof DAFTAR_WILAYAH_FILTER[number];

export const DAFTAR_JENIS_UNIT_AKTIF = [
  'Excavator Long Arm',
  'Excavator Mini',
  'Excavator Standar',
  'Motor Grader',
  'Compactor'
] as const;

export type JenisUnitAktif = typeof DAFTAR_JENIS_UNIT_AKTIF[number];

export function getWilayahBadgeClass(wilayah?: string | null): string {
  const w = (wilayah || '').trim().toUpperCase();
  if (w === 'GEODESI PG1') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (w === 'GEODESI PG2') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (w === 'GEODESI PG3') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (w === 'RC PG1') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (w === 'RC PG2') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (w === 'RC PG3') return 'bg-green-50 text-green-700 border-green-200';
  if (w === 'LEBUNG PG12') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (w === 'LEBUNG PG3') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (w === 'SEMUA WILAYAH' || w === 'SEMUA') return 'bg-slate-100 text-slate-700 border-slate-300';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export interface User {
  id: number;
  nama_lengkap: string;
  username: string;
  password?: string;
  hak_akses: 'Admin' | 'Pengawas' | 'Kasie' | 'Manager' | 'Super Admin' | string;
  role?: UserRole;
  wilayah?: string;
  status_aktif?: number;
}

export interface AuthUser {
  id: number;
  nama_lengkap: string;
  username: string;
  hak_akses: string;
  role?: UserRole;
  wilayah?: string;
  email?: string;
  token?: string;
}

export interface Unit {
  id: number;
  kode_unit: string;
  jenis_unit: string;
  model_unit: string;
  nama_pengawas: string;
  kasie?: string;
  wilayah?: string;
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
  wilayah?: string;
  kategori_status?: UnitStatus;
  status_unit?: UnitStatus;
  status_aktif?: number;
  stik_solar_awal?: number;
  stik_solar_akhir?: number;
  estimasi_konsumsi_solar?: number;
  kendala_list?: KendalaItem[] | string | null;
  ada_kendala?: number;
}

export interface Operator {
  id: number;
  nama_operator: string;
  nik: string;
  nama_pengawas: string;
  kasie?: string;
  wilayah?: string;
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
  kategori_status?: UnitStatus;
  kode_unit: string;
  model_unit?: string;
  operator: string;
  kode_lokasi: string;
  wilayah?: string;
  shift_kerja: 'SIANG' | 'MALAM' | 'Siang' | 'Malam';
  nomor_spk?: string | null;
  status_spk: StatusSpk;
  keterangan_rencana?: string | null;
  nama_aktivitas?: string | null;
  aktivitas?: string | null;
  kode_sap?: string | null;
  satuan?: string | null;
  id_aktivitas?: number | null;
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
  id_aktivitas?: number | string | null;
  unit?: string | null;
  client_transaction_id?: string | null;
  rencana_id?: string | null;
  id_rencana_kerja?: string | null;
  nama_pengawas: string;
  tanggal: string;
  tanggal_kerja?: string;
  kode_unit: string;
  nama_aktivitas: string;
  aktivitas?: string | null;
  aktivitas_aktual?: string | null;
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
  kategori_status?: UnitStatus;
  is_isi_solar?: boolean | number;
  solar?: number | null;
  jumlah_liter_solar?: number | null;
  stik_awal?: number | null;
  stik_akhir?: number | null;
  stik_solar_awal?: number | null;
  stik_solar_akhir?: number | null;
  estimasi_konsumsi_solar?: number | null;
  ada_kendala?: number | boolean;
  kendala?: any[] | null;
  kendala_list?: KendalaItem[] | string | null;
  kendala_data?: any;
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
  total_jam_operasi?: number;
  total_jam_standby?: number;
  total_jam_breakdown?: number;
  pa?: number;
  ua?: number;
}

export interface AnalyticsSummary {
  totalSolar: number;
  totalHm: number;
  rasioKonsumsi: number;
  totalRecords: number;
  total_jam_operasi?: number;
  total_jam_standby?: number;
  total_jam_breakdown?: number;
  pa?: number;
  ua?: number;
  unitData: UnitAnalyticsRow[];
  aktivitasData: AktivitasAnalyticsRow[];
  statusWaktu: StatusWaktuAnalytics;
}
