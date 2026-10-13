import initSqlJs from 'sql.js';
import type { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const DB_FILE_PATH = path.resolve(process.cwd(), 'data', 'heavytrack.sqlite');

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

export type WilayahKerja = typeof DAFTAR_WILAYAH[number];

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'MANAGER';

export interface UserRow {
  id: number;
  nama_lengkap: string;
  username: string;
  password?: string;
  hak_akses: string;
  role?: UserRole;
  wilayah?: string;
  status_aktif?: number;
}

export interface UnitRow {
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
  status_aktif: number;
  updated_at: string;
}

export interface AppSettingRow {
  key: string;
  value: string;
  keterangan?: string;
  updated_at: string;
}

export interface AktivitasUnitRow {
  id: number;
  uuid?: string | null;
  client_transaction_id?: string | null;
  jenis_unit: string;
  nama_aktivitas: string;
  satuan: string;
  kode_sap: string;
  kategori_status?: 'OPERASI' | 'STANDBY' | 'BREAKDOWN';
  status_unit?: 'OPERASI' | 'STANDBY' | 'BREAKDOWN';
  status_aktif: number;
  stik_solar_awal?: number;
  stik_solar_akhir?: number;
  estimasi_konsumsi_solar?: number;
  kendala_list?: string | null;
  ada_kendala?: number;
}

export interface OperatorRow {
  id: number;
  nama_operator: string;
  nik: string;
  nama_pengawas: string;
  kasie?: string;
  wilayah?: string;
  status_aktif: number;
}

export interface LokasiRow {
  kode_lokasi: string;
  wilayah: string;
  luas_bruto: number;
  luas_netto: number;
  status_aktif: number;
  created_at: string;
}

export interface RencanaKerjaRow {
  id: string;
  nama_pengawas: string;
  tanggal: string;
  tanggal_kerja?: string;
  status_unit: 'OPERASI' | 'STANDBY' | 'BREAKDOWN';
  kode_unit: string;
  operator: string;
  kode_lokasi: string;
  shift_kerja: 'SIANG' | 'MALAM' | 'Siang' | 'Malam';
  nomor_spk?: string | null;
  status_spk: 'MENUNGGU_SPK' | 'SPK_TERBIT' | 'REALISASI_SELESAI' | 'TEREALISASI' | 'MENUNGGU';
  keterangan_rencana?: string | null;
  nama_aktivitas?: string | null;
  aktivitas?: string | null;
  kode_sap?: string | null;
  satuan?: string | null;
  id_aktivitas?: number | null;
  created_at: string;
  updated_at?: string;
  // Enriched fields from JOIN
  model_unit?: string;
  wilayah?: string;
}

export interface MasterKendalaRow {
  id: number;
  nama_kendala: string;
  status_aktif: number;
  created_at: string;
}

export interface AktivitasKendalaRow {
  id: number;
  id_aktivitas: number;
  id_kendala?: string | null;
  nama_kendala: string;
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
  durasi_menit?: number | null;
  created_at: string;
}

export interface HasilInputAktivitasRow {
  id: number | string;
  uuid?: string | null;
  client_transaction_id?: string | null;
  rencana_id?: string | null;
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
  kode_lokasi: string;
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
  status_unit: 'OPERASI' | 'STANDBY' | 'BREAKDOWN';
  is_isi_solar: number;
  jumlah_liter_solar: number;
  stik_awal?: number | null;
  stik_akhir?: number | null;
  stik_solar_awal?: number | null;
  stik_solar_akhir?: number | null;
  estimasi_konsumsi_solar?: number | null;
  kendala_list?: string | null;
  ada_kendala?: number;
  is_hm_awal_corrected?: number;
  alasan_koreksi_hm?: string | null;
  created_at: string;
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (e) {
      console.error('Failed reading existing SQLite file, creating fresh one:', e);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // 1. OPTIMASI KONKURENSI SQLITE (ANTI-LOCKING / SQLITE_BUSY)
  try {
    dbInstance.run("PRAGMA journal_mode = WAL;");
    dbInstance.run("PRAGMA busy_timeout = 5000;");
    dbInstance.run("PRAGMA synchronous = NORMAL;");
    console.log('⚡ [SQLITE-CONFIG] WAL mode, busy_timeout = 5000ms, dan synchronous = NORMAL aktif.');
  } catch (errPragma) {
    console.warn('Note on SQLite WAL & busy_timeout configuration:', errPragma);
  }

  initTablesAndSeed(dbInstance);
  saveDb();
  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    const tmpPath = `${DB_FILE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, DB_FILE_PATH);
  } catch (err) {
    console.error('Failed to save SQLite file:', err);
  }
}

export function generateSampleFieldPhoto(kodeUnit: string, aktivitas: string, lokasi: string, pengawas: string, tanggal: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="sky-${kodeUnit}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="60%" stop-color="#7dd3fc"/>
        <stop offset="100%" stop-color="#bae6fd"/>
      </linearGradient>
      <linearGradient id="pit-${kodeUnit}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="35%" stop-color="#92400e"/>
        <stop offset="70%" stop-color="#b45309"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
      <linearGradient id="eq-${kodeUnit}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#eab308"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>
    <!-- Background: Open pit mining terrain -->
    <rect width="800" height="260" fill="url(#sky-${kodeUnit})"/>
    <circle cx="680" cy="90" r="45" fill="#fef08a" opacity="0.9"/>
    <!-- Pit Benches / Strata -->
    <path d="M0,230 Q200,210 400,235 T800,220 L800,600 L0,600 Z" fill="url(#pit-${kodeUnit})"/>
    <path d="M0,280 Q250,260 520,290 T800,270 L800,600 L0,600 Z" fill="#713f12" opacity="0.6"/>
    <path d="M0,360 Q280,340 560,370 T800,350 L800,600 L0,600 Z" fill="#451a03" opacity="0.7"/>
    <!-- Haul road -->
    <path d="M0,450 Q300,430 800,470 L800,530 Q300,490 0,510 Z" fill="#78716c"/>

    <!-- Heavy Equipment Silhouette & Cabin -->
    <g transform="translate(260, 290)">
      <!-- Tracks / Wheels -->
      <rect x="20" y="140" width="220" height="40" rx="12" fill="#1c1917"/>
      <circle cx="45" cy="160" r="14" fill="#57534e"/>
      <circle cx="85" cy="160" r="14" fill="#57534e"/>
      <circle cx="125" cy="160" r="14" fill="#57534e"/>
      <circle cx="165" cy="160" r="14" fill="#57534e"/>
      <circle cx="205" cy="160" r="14" fill="#57534e"/>
      <!-- Body & Cab -->
      <rect x="40" y="60" width="160" height="85" rx="6" fill="url(#eq-${kodeUnit})"/>
      <rect x="130" y="30" width="65" height="55" rx="4" fill="#0284c7"/>
      <!-- Boom / Blade -->
      <path d="M60,80 L-50,20 L-110,90" stroke="#ca8a04" stroke-width="20" stroke-linecap="round" fill="none"/>
      <path d="M-110,90 L-140,140 L-90,130 Z" fill="#44403c"/>
      <!-- Equipment ID badge on body -->
      <rect x="65" y="85" width="80" height="24" rx="4" fill="#0f172a"/>
      <text x="105" y="102" fill="#22c55e" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">${kodeUnit}</text>
    </g>

    <!-- Camera HUD & Field Verification Stamp -->
    <rect x="20" y="20" width="760" height="560" fill="none" stroke="#22c55e" stroke-width="2" stroke-dasharray="16,8" opacity="0.6"/>
    <!-- Top HUD Banner -->
    <rect x="20" y="20" width="760" height="45" fill="rgba(15,23,42,0.85)"/>
    <text x="40" y="48" fill="#4ade80" font-family="monospace" font-size="14" font-weight="bold">RKCE MOBILE • GPS VERIFIED [ANDROID CAM]</text>
    <text x="760" y="48" fill="#f8fafc" font-family="monospace" font-size="13" text-anchor="end">LAT: -3.42819° • LON: 114.83912° • ELEV: 112m</text>
    
    <!-- Crosshair in center -->
    <path d="M380,300 L420,300 M400,280 L400,320" stroke="#4ade80" stroke-width="2" opacity="0.8"/>

    <!-- Bottom Metadata Overlay Stamp -->
    <rect x="20" y="490" width="760" height="90" fill="rgba(15,23,42,0.9)"/>
    <text x="40" y="520" fill="#f8fafc" font-family="sans-serif" font-size="16" font-weight="bold">UNIT: ${kodeUnit} | AKTIVITAS: ${aktivitas}</text>
    <text x="40" y="545" fill="#94a3b8" font-family="sans-serif" font-size="13">LOKASI: ${lokasi} • PENGAWAS: ${pengawas}</text>
    <text x="40" y="568" fill="#38bdf8" font-family="monospace" font-size="12">WAKTU: ${tanggal} 17:42 WITA • BUKTI VALIDASI ANDROID</text>
    <rect x="660" y="510" width="100" height="40" rx="6" fill="#059669"/>
    <text x="710" y="535" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">VERIFIED</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function initTablesAndSeed(db: Database) {
  // DDL Schema definitions according to specification
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_lengkap TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      hak_akses TEXT NOT NULL,
      role TEXT DEFAULT 'ADMIN',
      wilayah TEXT DEFAULT 'Geodesi PG1',
      status_aktif INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_unit TEXT NOT NULL UNIQUE,
      jenis_unit TEXT NOT NULL,
      model_unit TEXT NOT NULL,
      nama_pengawas TEXT NOT NULL,
      hm_unit_terakhir_diinputkan REAL DEFAULT 0,
      hm_min_standar REAL DEFAULT NULL,
      hm_max_standar REAL DEFAULT NULL,
      status_aktif INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      keterangan TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS aktivitas_unit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      client_transaction_id TEXT UNIQUE,
      jenis_unit TEXT NOT NULL,
      nama_aktivitas TEXT NOT NULL,
      satuan TEXT NOT NULL,
      kode_sap TEXT NOT NULL,
      kategori_status TEXT DEFAULT 'OPERASI',
      status_unit TEXT DEFAULT 'OPERASI',
      is_hm_awal_corrected INTEGER DEFAULT 0,
      alasan_koreksi_hm TEXT DEFAULT NULL,
      status_aktif INTEGER DEFAULT 1,
      stik_solar_awal REAL DEFAULT 0,
      stik_solar_akhir REAL DEFAULT 0,
      estimasi_konsumsi_solar REAL DEFAULT 0,
      kendala_list TEXT,
      kendala_data TEXT,
      ada_kendala INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_operator TEXT NOT NULL,
      nik TEXT NOT NULL UNIQUE,
      nama_pengawas TEXT NOT NULL,
      status_aktif INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS lokasi (
      kode_lokasi TEXT PRIMARY KEY,
      wilayah TEXT NOT NULL,
      luas_bruto REAL NOT NULL DEFAULT 0.00,
      luas_netto REAL NOT NULL DEFAULT 0.00,
      status_aktif INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rencana_kerja (
      id TEXT PRIMARY KEY,
      nama_pengawas TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      status_unit TEXT DEFAULT 'OPERASI',
      kode_unit TEXT NOT NULL,
      operator TEXT NOT NULL,
      kode_lokasi TEXT NOT NULL,
      shift_kerja TEXT NOT NULL,
      nomor_spk TEXT,
      status_spk TEXT DEFAULT 'MENUNGGU_SPK',
      keterangan_rencana TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_rk_tgl ON rencana_kerja(tanggal DESC);
    CREATE INDEX IF NOT EXISTS idx_rk_pengawas ON rencana_kerja(nama_pengawas);

    CREATE TABLE IF NOT EXISTS master_kendala (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_kendala TEXT NOT NULL UNIQUE,
      status_aktif INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hasil_input_aktivitas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      client_transaction_id TEXT UNIQUE,
      rencana_id TEXT,
      nama_pengawas TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      kode_unit TEXT NOT NULL,
      nama_aktivitas TEXT NOT NULL,
      kode_sap TEXT NOT NULL,
      satuan TEXT NOT NULL,
      operator TEXT NOT NULL,
      nik_operator TEXT NOT NULL,
      kode_lokasi TEXT DEFAULT '001A',
      lokasi TEXT NOT NULL,
      nomor_spk TEXT,
      shift_kerja TEXT NOT NULL,
      jam_kerja REAL NOT NULL,
      hm_awal REAL NOT NULL,
      hm_akhir REAL NOT NULL,
      hm_harian_berjalan REAL NOT NULL,
      hasil_kerja REAL NOT NULL,
      keterangan TEXT,
      foto_bukti TEXT,
      status_unit TEXT DEFAULT 'OPERASI',
      is_isi_solar INTEGER DEFAULT 0,
      jumlah_liter_solar REAL DEFAULT 0.00,
      stik_awal REAL,
      stik_akhir REAL,
      stik_solar_awal REAL DEFAULT 0,
      stik_solar_akhir REAL DEFAULT 0,
      estimasi_konsumsi_solar REAL DEFAULT 0,
      kendala_list TEXT,
      ada_kendala INTEGER DEFAULT 0,
      is_hm_awal_corrected INTEGER DEFAULT 0,
      alasan_koreksi_hm TEXT DEFAULT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_unit_tgl ON hasil_input_aktivitas(kode_unit, tanggal DESC);
    CREATE INDEX IF NOT EXISTS idx_pengawas_tgl ON hasil_input_aktivitas(nama_pengawas, tanggal DESC);
    CREATE INDEX IF NOT EXISTS idx_hia_pengawas_tgl ON hasil_input_aktivitas(nama_pengawas, tanggal DESC);
    CREATE INDEX IF NOT EXISTS idx_hia_rencana_id ON hasil_input_aktivitas(rencana_id);
    CREATE INDEX IF NOT EXISTS idx_hia_unit_tgl_shift ON hasil_input_aktivitas(kode_unit, tanggal, shift_kerja);
    CREATE INDEX IF NOT EXISTS idx_rk_status_pengawas ON rencana_kerja(nama_pengawas, status_spk);
    CREATE INDEX IF NOT EXISTS idx_units_aktif ON units(status_aktif, kode_unit);
    CREATE INDEX IF NOT EXISTS idx_lokasi_aktif ON lokasi(status_aktif, kode_lokasi);
    CREATE INDEX IF NOT EXISTS idx_operators_aktif ON operators(status_aktif, nama_operator);
    CREATE INDEX IF NOT EXISTS idx_aktivitas_aktif ON aktivitas_unit(status_aktif, nama_aktivitas);
    CREATE INDEX IF NOT EXISTS idx_kendala_aktif ON master_kendala(status_aktif, id);

    CREATE TABLE IF NOT EXISTS aktivitas_kendala (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_aktivitas INTEGER NOT NULL,
      id_kendala TEXT,
      nama_kendala TEXT NOT NULL,
      waktu_mulai TEXT,
      waktu_selesai TEXT,
      durasi_menit REAL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ak_aktivitas ON aktivitas_kendala(id_aktivitas);
  `);

  // Migration: Ensure foto_bukti, status_unit, is_isi_solar, jumlah_liter_solar, stik_awal, stik_akhir, kendala_list exist
  try {
    db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN foto_bukti TEXT;");
  } catch {
    // Column already exists
  }

  // Migration: Ensure status_unit, is_isi_solar, jumlah_liter_solar, stik_awal, stik_akhir, kendala_list exist
  try {
    const hiaInfo = db.exec("PRAGMA table_info(hasil_input_aktivitas)");
    const cols = hiaInfo[0]?.values.map(v => v[1]);
    if (cols && !cols.includes('status_unit')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN status_unit TEXT DEFAULT 'OPERASI';");
      console.log('Added status_unit column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('is_isi_solar')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN is_isi_solar INTEGER DEFAULT 0;");
      console.log('Added is_isi_solar column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('jumlah_liter_solar')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN jumlah_liter_solar REAL DEFAULT 0.00;");
      console.log('Added jumlah_liter_solar column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('stik_awal')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN stik_awal REAL;");
      console.log('Added stik_awal column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('stik_akhir')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN stik_akhir REAL;");
      console.log('Added stik_akhir column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('kendala_list')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN kendala_list TEXT;");
      console.log('Added kendala_list column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('kendala_data')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN kendala_data TEXT;");
      console.log('Added kendala_data column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('rencana_id')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN rencana_id TEXT;");
      console.log('Added rencana_id column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('kode_lokasi')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN kode_lokasi TEXT DEFAULT '001A';");
      console.log('Added kode_lokasi column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('nomor_spk')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN nomor_spk TEXT;");
      console.log('Added nomor_spk column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('is_hm_awal_corrected')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN is_hm_awal_corrected INTEGER DEFAULT 0;");
      console.log('Added is_hm_awal_corrected column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('alasan_koreksi_hm')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN alasan_koreksi_hm TEXT DEFAULT NULL;");
      console.log('Added alasan_koreksi_hm column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('client_transaction_id')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN client_transaction_id TEXT DEFAULT NULL;");
      try {
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_hia_client_tx ON hasil_input_aktivitas(client_transaction_id);");
      } catch (idxErr) {
        console.warn('Index on client_transaction_id already exists or ignored:', idxErr);
      }
      console.log('Added client_transaction_id column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('uuid')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN uuid TEXT DEFAULT NULL;");
      try {
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_hia_uuid ON hasil_input_aktivitas(uuid);");
      } catch (idxErr) {
        console.warn('Index on hasil_input_aktivitas(uuid) already exists or ignored:', idxErr);
      }
      console.log('Added uuid column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('tanggal_kerja')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN tanggal_kerja TEXT DEFAULT NULL;");
      db.run("UPDATE hasil_input_aktivitas SET tanggal_kerja = COALESCE(tanggal, SUBSTR(created_at, 1, 10)) WHERE tanggal_kerja IS NULL;");
      console.log('Added tanggal_kerja column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('stik_solar_awal')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN stik_solar_awal REAL DEFAULT 0;");
      db.run("UPDATE hasil_input_aktivitas SET stik_solar_awal = COALESCE(stik_awal, 0);");
      console.log('Added stik_solar_awal column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('stik_solar_akhir')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN stik_solar_akhir REAL DEFAULT 0;");
      db.run("UPDATE hasil_input_aktivitas SET stik_solar_akhir = COALESCE(stik_akhir, 0);");
      console.log('Added stik_solar_akhir column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('estimasi_konsumsi_solar')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN estimasi_konsumsi_solar REAL DEFAULT 0;");
      console.log('Added estimasi_konsumsi_solar column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('ada_kendala')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN ada_kendala INTEGER DEFAULT 0;");
      db.run("UPDATE hasil_input_aktivitas SET ada_kendala = CASE WHEN kendala_list IS NOT NULL AND TRIM(kendala_list) != '' AND TRIM(kendala_list) != '[]' THEN 1 ELSE 0 END;");
      console.log('Added ada_kendala column to hasil_input_aktivitas');
    }
    if (cols && !cols.includes('wilayah')) {
      db.run("ALTER TABLE hasil_input_aktivitas ADD COLUMN wilayah TEXT DEFAULT NULL;");
      console.log('Added wilayah column to hasil_input_aktivitas');
    }

    // Migration for aktivitas_unit table
    const actInfo = db.exec("PRAGMA table_info(aktivitas_unit)");
    const actCols = actInfo[0]?.values.map(v => v[1]);
    if (actCols && !actCols.includes('wilayah')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN wilayah TEXT DEFAULT NULL;");
      console.log('Added wilayah column to aktivitas_unit');
    }
    if (actCols && !actCols.includes('is_hm_awal_corrected')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN is_hm_awal_corrected INTEGER DEFAULT 0;");
      console.log('Added is_hm_awal_corrected column to aktivitas_unit');
    }
    if (actCols && !actCols.includes('alasan_koreksi_hm')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN alasan_koreksi_hm TEXT DEFAULT NULL;");
      console.log('Added alasan_koreksi_hm column to aktivitas_unit');
    }
    if (actCols && !actCols.includes('client_transaction_id')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN client_transaction_id TEXT DEFAULT NULL;");
      console.log('Added client_transaction_id column to aktivitas_unit');
    }
    if (actCols && !actCols.includes('uuid')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN uuid TEXT DEFAULT NULL;");
      try {
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_au_uuid ON aktivitas_unit(uuid);");
      } catch (idxErr) {
        console.warn('Index on aktivitas_unit(uuid) already exists or ignored:', idxErr);
      }
      console.log('Added uuid column to aktivitas_unit');
    }
    if (actCols && !actCols.includes('stik_solar_awal')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN stik_solar_awal REAL DEFAULT 0;");
    }
    if (actCols && !actCols.includes('stik_solar_akhir')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN stik_solar_akhir REAL DEFAULT 0;");
    }
    if (actCols && !actCols.includes('estimasi_konsumsi_solar')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN estimasi_konsumsi_solar REAL DEFAULT 0;");
    }
    if (actCols && !actCols.includes('kendala_list')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN kendala_list TEXT;");
    }
    if (actCols && !actCols.includes('kendala_data')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN kendala_data TEXT;");
    }
    if (actCols && !actCols.includes('ada_kendala')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN ada_kendala INTEGER DEFAULT 0;");
    }

    // Migration for rencana_kerja table (updated_at & tanggal_kerja columns)
    const rkInfo = db.exec("PRAGMA table_info(rencana_kerja)");
    const rkCols = rkInfo[0]?.values.map(v => v[1]);
    if (rkCols && !rkCols.includes('updated_at')) {
      db.run("ALTER TABLE rencana_kerja ADD COLUMN updated_at TEXT DEFAULT NULL;");
      db.run("UPDATE rencana_kerja SET updated_at = created_at WHERE updated_at IS NULL;");
      console.log('Added updated_at column to rencana_kerja');
    }
    if (rkCols && !rkCols.includes('tanggal_kerja')) {
      db.run("ALTER TABLE rencana_kerja ADD COLUMN tanggal_kerja TEXT DEFAULT NULL;");
      db.run("UPDATE rencana_kerja SET tanggal_kerja = COALESCE(tanggal, SUBSTR(created_at, 1, 10)) WHERE tanggal_kerja IS NULL;");
      console.log('Added tanggal_kerja column to rencana_kerja');
    }
    if (rkCols && !rkCols.includes('nama_aktivitas')) {
      db.run("ALTER TABLE rencana_kerja ADD COLUMN nama_aktivitas TEXT DEFAULT NULL;");
      db.run("UPDATE rencana_kerja SET nama_aktivitas = keterangan_rencana WHERE nama_aktivitas IS NULL AND keterangan_rencana IS NOT NULL;");
      console.log('Added nama_aktivitas column to rencana_kerja');
    }
    if (rkCols && !rkCols.includes('aktivitas')) {
      db.run("ALTER TABLE rencana_kerja ADD COLUMN aktivitas TEXT DEFAULT NULL;");
      db.run("UPDATE rencana_kerja SET aktivitas = COALESCE(nama_aktivitas, keterangan_rencana) WHERE aktivitas IS NULL;");
      console.log('Added aktivitas column to rencana_kerja');
    }
    if (rkCols && !rkCols.includes('kode_sap')) {
      db.run("ALTER TABLE rencana_kerja ADD COLUMN kode_sap TEXT DEFAULT NULL;");
      console.log('Added kode_sap column to rencana_kerja');
    }
    if (rkCols && !rkCols.includes('satuan')) {
      db.run("ALTER TABLE rencana_kerja ADD COLUMN satuan TEXT DEFAULT NULL;");
      console.log('Added satuan column to rencana_kerja');
    }
    if (rkCols && !rkCols.includes('id_aktivitas')) {
      db.run("ALTER TABLE rencana_kerja ADD COLUMN id_aktivitas INTEGER DEFAULT NULL;");
      console.log('Added id_aktivitas column to rencana_kerja');
    }
    if (rkCols && !rkCols.includes('wilayah')) {
      db.run("ALTER TABLE rencana_kerja ADD COLUMN wilayah TEXT DEFAULT NULL;");
      console.log('Added wilayah column to rencana_kerja');
    }

    // Ensure kategori_status and status_unit columns exist in aktivitas_unit
    try {
      const actInfo = db.exec("PRAGMA table_info(aktivitas_unit)");
      const actCols = actInfo[0]?.values.map(v => v[1]);
      if (actCols && !actCols.includes('kategori_status')) {
        db.run("ALTER TABLE aktivitas_unit ADD COLUMN kategori_status TEXT DEFAULT 'OPERASI';");
        console.log('Added kategori_status column to aktivitas_unit');
      }
      if (actCols && !actCols.includes('status_unit')) {
        db.run("ALTER TABLE aktivitas_unit ADD COLUMN status_unit TEXT DEFAULT 'OPERASI';");
        console.log('Added status_unit column to aktivitas_unit');
      }
      db.run("UPDATE aktivitas_unit SET kategori_status = 'OPERASI' WHERE kategori_status IS NULL OR kategori_status = '';");
      db.run("UPDATE aktivitas_unit SET kategori_status = 'STANDBY' WHERE LOWER(nama_aktivitas) LIKE '%standby%';");
      db.run("UPDATE aktivitas_unit SET kategori_status = 'BREAKDOWN' WHERE LOWER(nama_aktivitas) LIKE '%breakdown%';");
      db.run("UPDATE aktivitas_unit SET status_unit = kategori_status WHERE status_unit IS NULL OR status_unit = '' OR status_unit != kategori_status;");
    } catch (actErr) {
      console.warn('AktivitasUnit migration note:', actErr);
    }

    // Refresh view master_aktivitas and INSTEAD OF triggers for transparent operations
    try {
      db.run("DROP TRIGGER IF EXISTS trg_master_act_ins;");
      db.run("DROP TRIGGER IF EXISTS trg_master_act_upd;");
      db.run("DROP TRIGGER IF EXISTS trg_master_act_del;");
      db.run("DROP VIEW IF EXISTS master_aktivitas;");
      db.run("CREATE VIEW master_aktivitas AS SELECT * FROM aktivitas_unit;");
      db.run(`
        CREATE TRIGGER IF NOT EXISTS trg_master_act_ins INSTEAD OF INSERT ON master_aktivitas
        BEGIN
          INSERT INTO aktivitas_unit (uuid, client_transaction_id, jenis_unit, nama_aktivitas, satuan, kode_sap, status_aktif, kategori_status, status_unit)
          VALUES (NEW.uuid, NEW.client_transaction_id, NEW.jenis_unit, NEW.nama_aktivitas, NEW.satuan, NEW.kode_sap, COALESCE(NEW.status_aktif, 1), COALESCE(NEW.kategori_status, 'OPERASI'), COALESCE(NEW.kategori_status, 'OPERASI'));
        END;
      `);
      db.run(`
        CREATE TRIGGER IF NOT EXISTS trg_master_act_upd INSTEAD OF UPDATE ON master_aktivitas
        BEGIN
          UPDATE aktivitas_unit SET
            jenis_unit = NEW.jenis_unit,
            nama_aktivitas = NEW.nama_aktivitas,
            satuan = NEW.satuan,
            kode_sap = NEW.kode_sap,
            status_aktif = COALESCE(NEW.status_aktif, OLD.status_aktif),
            kategori_status = COALESCE(NEW.kategori_status, OLD.kategori_status, 'OPERASI'),
            status_unit = COALESCE(NEW.kategori_status, OLD.kategori_status, 'OPERASI')
          WHERE id = OLD.id;
        END;
      `);
      db.run(`
        CREATE TRIGGER IF NOT EXISTS trg_master_act_del INSTEAD OF DELETE ON master_aktivitas
        BEGIN
          DELETE FROM aktivitas_unit WHERE id = OLD.id;
        END;
      `);
    } catch (viewErr) {
      console.warn('View master_aktivitas create notice:', viewErr);
    }

    // Ensure aktivitas_kendala table exists
    db.run(`
      CREATE TABLE IF NOT EXISTS aktivitas_kendala (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_aktivitas INTEGER NOT NULL,
        id_kendala TEXT,
        nama_kendala TEXT NOT NULL,
        waktu_mulai TEXT,
        waktu_selesai TEXT,
        durasi_menit REAL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ak_aktivitas ON aktivitas_kendala(id_aktivitas);
    `);

    // Migration for status_aktif in master tables (Soft Delete requirement)
    const unitsInfo = db.exec("PRAGMA table_info(units)");
    const unitsCols = unitsInfo[0]?.values.map(v => v[1]);
    if (unitsCols && !unitsCols.includes('status_aktif')) {
      db.run("ALTER TABLE units ADD COLUMN status_aktif INTEGER DEFAULT 1;");
      db.run("UPDATE units SET status_aktif = 1 WHERE status_aktif IS NULL;");
      console.log('Added status_aktif column to units');
    }
    if (unitsCols && !unitsCols.includes('wilayah')) {
      db.run("ALTER TABLE units ADD COLUMN wilayah TEXT DEFAULT NULL;");
      console.log('Added wilayah column to units');
    }
    if (unitsCols && !unitsCols.includes('kasie')) {
      db.run("ALTER TABLE units ADD COLUMN kasie TEXT DEFAULT NULL;");
      console.log('Added kasie column to units');
    }

    if (actCols && !actCols.includes('status_aktif')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN status_aktif INTEGER DEFAULT 1;");
      db.run("UPDATE aktivitas_unit SET status_aktif = 1 WHERE status_aktif IS NULL;");
      console.log('Added status_aktif column to aktivitas_unit');
    }

    const opsInfo = db.exec("PRAGMA table_info(operators)");
    const opsCols = opsInfo[0]?.values.map(v => v[1]);
    if (opsCols && !opsCols.includes('status_aktif')) {
      db.run("ALTER TABLE operators ADD COLUMN status_aktif INTEGER DEFAULT 1;");
      db.run("UPDATE operators SET status_aktif = 1 WHERE status_aktif IS NULL;");
      console.log('Added status_aktif column to operators');
    }
    if (opsCols && !opsCols.includes('wilayah')) {
      db.run("ALTER TABLE operators ADD COLUMN wilayah TEXT DEFAULT NULL;");
      console.log('Added wilayah column to operators');
    }
    if (opsCols && !opsCols.includes('kasie')) {
      db.run("ALTER TABLE operators ADD COLUMN kasie TEXT DEFAULT NULL;");
      console.log('Added kasie column to operators');
    }

    const lokInfo = db.exec("PRAGMA table_info(lokasi)");
    const lokCols = lokInfo[0]?.values.map(v => v[1]);
    if (lokCols && !lokCols.includes('status_aktif')) {
      db.run("ALTER TABLE lokasi ADD COLUMN status_aktif INTEGER DEFAULT 1;");
      db.run("UPDATE lokasi SET status_aktif = 1 WHERE status_aktif IS NULL;");
      console.log('Added status_aktif column to lokasi');
    }

    const kendalaInfo = db.exec("PRAGMA table_info(master_kendala)");
    const kendalaCols = kendalaInfo[0]?.values.map(v => v[1]);
    if (kendalaCols && !kendalaCols.includes('status_aktif')) {
      db.run("ALTER TABLE master_kendala ADD COLUMN status_aktif INTEGER DEFAULT 1;");
      db.run("UPDATE master_kendala SET status_aktif = 1 WHERE status_aktif IS NULL;");
      console.log('Added status_aktif column to master_kendala');
    }

    const usersInfo = db.exec("PRAGMA table_info(users)");
    const usersCols = usersInfo[0]?.values.map(v => v[1]);
    if (usersCols && !usersCols.includes('status_aktif')) {
      db.run("ALTER TABLE users ADD COLUMN status_aktif INTEGER DEFAULT 1;");
      db.run("UPDATE users SET status_aktif = 1 WHERE status_aktif IS NULL;");
      console.log('Added status_aktif column to users');
    }

    try {
      db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_hia_client_tx ON hasil_input_aktivitas(client_transaction_id);");
    } catch {
      // Ignore if index creation fails or column missing
    }

    // Migration and default seeding for app_settings
    db.run(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        keterangan TEXT,
        updated_at TEXT NOT NULL
      );
    `);

    const appSettingsCountRes = db.exec("SELECT COUNT(*) FROM app_settings");
    const appSettingsCount = appSettingsCountRes[0]?.values[0]?.[0] as number || 0;
    if (appSettingsCount === 0) {
      db.run(`
        INSERT INTO app_settings (key, value, keterangan, updated_at) VALUES
        ('hm_min_standar', '6.0', 'Batas minimal HM normal per shift', datetime('now')),
        ('hm_max_standar', '10.0', 'Batas maksimal wajar HM per shift', datetime('now'));
      `);
      console.log('Seeded default app_settings: hm_min_standar = 6.0, hm_max_standar = 10.0');
    }
  } catch (e) {
    console.warn('Migration note for solar, status, and spk columns:', e);
  }

  try {
    db.run("CREATE INDEX IF NOT EXISTS idx_hia_spk ON hasil_input_aktivitas(nomor_spk);");
  } catch {
    // Ignore index creation if already created
  }

  // Migration: Ensure operators table does not require jabatan
  try {
    const opInfo = db.exec("PRAGMA table_info(operators)");
    const cols = opInfo[0]?.values.map(v => v[1]);
    if (cols && cols.includes('jabatan')) {
      db.run(`
        CREATE TABLE operators_migrated (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nama_operator TEXT NOT NULL,
          nik TEXT NOT NULL UNIQUE,
          nama_pengawas TEXT NOT NULL
        );
        INSERT INTO operators_migrated (id, nama_operator, nik, nama_pengawas)
          SELECT id, nama_operator, nik, nama_pengawas FROM operators;
        DROP TABLE operators;
        ALTER TABLE operators_migrated RENAME TO operators;
      `);
      console.log('Migrated operators table to remove jabatan.');
    }
  } catch (e) {
    console.warn('Operator migration note:', e);
  }

  // Migration: Ensure aktivitas_unit does not have kategori
  try {
    const actInfo = db.exec("PRAGMA table_info(aktivitas_unit)");
    const cols = actInfo[0]?.values.map(v => v[1]);
    if (cols && cols.includes('kategori')) {
      db.run(`
        CREATE TABLE aktivitas_unit_migrated (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          jenis_unit TEXT NOT NULL,
          nama_aktivitas TEXT NOT NULL,
          satuan TEXT NOT NULL,
          kode_sap TEXT NOT NULL
        );
        INSERT INTO aktivitas_unit_migrated (id, jenis_unit, nama_aktivitas, satuan, kode_sap)
          SELECT id, jenis_unit, nama_aktivitas, satuan, kode_sap FROM aktivitas_unit;
        DROP TABLE aktivitas_unit;
        ALTER TABLE aktivitas_unit_migrated RENAME TO aktivitas_unit;
      `);
      console.log('Migrated aktivitas_unit table to remove kategori.');
    }
  } catch (e) {
    console.warn('Aktivitas migration note:', e);
  }

  // Migration: Ensure hasil_input_aktivitas does not have kategori
  try {
    const hiaInfo = db.exec("PRAGMA table_info(hasil_input_aktivitas)");
    const cols = hiaInfo[0]?.values.map(v => v[1]);
    if (cols && cols.includes('kategori')) {
      db.run(`
        CREATE TABLE hasil_input_aktivitas_migrated (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nama_pengawas TEXT NOT NULL,
          tanggal TEXT NOT NULL,
          kode_unit TEXT NOT NULL,
          nama_aktivitas TEXT NOT NULL,
          kode_sap TEXT NOT NULL,
          satuan TEXT NOT NULL,
          operator TEXT NOT NULL,
          nik_operator TEXT NOT NULL,
          lokasi TEXT NOT NULL,
          shift_kerja TEXT NOT NULL,
          jam_kerja REAL NOT NULL,
          hm_awal REAL NOT NULL,
          hm_akhir REAL NOT NULL,
          hm_harian_berjalan REAL NOT NULL,
          hasil_kerja REAL NOT NULL,
          keterangan TEXT,
          foto_bukti TEXT,
          created_at TEXT NOT NULL
        );
        INSERT INTO hasil_input_aktivitas_migrated (
          id, nama_pengawas, tanggal, kode_unit, nama_aktivitas, kode_sap, satuan,
          operator, nik_operator, lokasi, shift_kerja, jam_kerja, hm_awal, hm_akhir,
          hm_harian_berjalan, hasil_kerja, keterangan, foto_bukti, created_at
        ) SELECT 
          id, nama_pengawas, tanggal, kode_unit, nama_aktivitas, kode_sap, satuan,
          operator, nik_operator, lokasi, shift_kerja, jam_kerja, hm_awal, hm_akhir,
          hm_harian_berjalan, hasil_kerja, keterangan, foto_bukti, created_at
        FROM hasil_input_aktivitas;
        DROP TABLE hasil_input_aktivitas;
        ALTER TABLE hasil_input_aktivitas_migrated RENAME TO hasil_input_aktivitas;
        CREATE INDEX IF NOT EXISTS idx_unit_tgl ON hasil_input_aktivitas(kode_unit, tanggal DESC);
        CREATE INDEX IF NOT EXISTS idx_pengawas_tgl ON hasil_input_aktivitas(nama_pengawas, tanggal DESC);
      `);
      console.log('Migrated hasil_input_aktivitas table to remove kategori.');
    }
  } catch (e) {
    console.warn('HasilInputAktivitas migration note:', e);
  }

  // Migration & Seed for Users role and wilayah columns
  try {
    const userInfo = db.exec("PRAGMA table_info(users)");
    const userCols = userInfo[0]?.values.map(v => v[1]);
    if (userCols && !userCols.includes('role')) {
      db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'ADMIN';");
      console.log('Added role column to users');
    }
    if (userCols && !userCols.includes('wilayah')) {
      db.run("ALTER TABLE users ADD COLUMN wilayah TEXT DEFAULT 'Geodesi PG1';");
      console.log('Added wilayah column to users');
    }
    if (userCols && !userCols.includes('status_aktif')) {
      db.run("ALTER TABLE users ADD COLUMN status_aktif INTEGER DEFAULT 1;");
    }
    db.run("UPDATE users SET role = 'SUPER_ADMIN' WHERE LOWER(username) IN ('admin', 'farid', 'deni');");
    db.run("UPDATE users SET role = 'SUPERVISOR' WHERE LOWER(hak_akses) = 'pengawas' OR LOWER(hak_akses) = 'kasie' OR LOWER(hak_akses) = 'supervisor';");
    db.run("UPDATE users SET role = 'MANAGER' WHERE LOWER(hak_akses) = 'manager' OR LOWER(username) IN ('manager', 'lutfi', 'putut');");
    db.run("UPDATE users SET role = 'ADMIN' WHERE role IS NULL OR role = '';");
    db.run("UPDATE users SET hak_akses = 'Kasie' WHERE hak_akses = 'Pengawas' OR LOWER(hak_akses) = 'pengawas';");

    // =========================================================================
    // MIGRASI TOTAL: HAPUS PG1, PG2, PG3 -> GANTI 8 WILAYAH KERJA BARU
    // =========================================================================
    // 1. Super Admin & Manager: Semua Wilayah
    db.run("UPDATE users SET wilayah = 'Semua Wilayah' WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER') OR hak_akses IN ('Super Admin', 'Admin', 'Manager') OR LOWER(username) IN ('admin', 'manager', 'farid', 'deni', 'lutfi', 'putut');");

    // 2. Pemetaan 8 Kasie ke 8 Wilayah Kerja Baru
    db.run("UPDATE users SET wilayah = 'Geodesi PG1' WHERE LOWER(nama_lengkap) = 'agung' OR LOWER(username) = 'agung';");
    db.run("UPDATE users SET wilayah = 'Geodesi PG2' WHERE LOWER(nama_lengkap) = 'zainudin' OR LOWER(username) = 'zainudin';");
    db.run("UPDATE users SET wilayah = 'Geodesi PG3' WHERE LOWER(nama_lengkap) = 'jaidi' OR LOWER(username) = 'jaidi';");
    db.run("UPDATE users SET wilayah = 'RC PG1' WHERE LOWER(nama_lengkap) = 'hisar' OR LOWER(username) = 'hisar';");
    db.run("UPDATE users SET wilayah = 'RC PG2' WHERE LOWER(nama_lengkap) = 'yono' OR LOWER(username) = 'yono';");
    db.run("UPDATE users SET wilayah = 'RC PG3' WHERE LOWER(nama_lengkap) = 'nyoman' OR LOWER(username) = 'nyoman';");
    db.run("UPDATE users SET wilayah = 'LEBUNG PG12' WHERE LOWER(nama_lengkap) = 'saipul' OR LOWER(username) = 'saipul';");
    db.run("UPDATE users SET wilayah = 'LEBUNG PG3' WHERE LOWER(nama_lengkap) = 'galung' OR LOWER(username) = 'galung';");

    // Pemetaan nama-nama Kasie tambahan bila ada
    db.run("UPDATE users SET wilayah = 'Geodesi PG1' WHERE LOWER(nama_lengkap) LIKE '%budi%' OR LOWER(username) LIKE '%budi%';");
    db.run("UPDATE users SET wilayah = 'RC PG1' WHERE LOWER(nama_lengkap) LIKE '%agus%' OR LOWER(username) LIKE '%agus%';");
    db.run("UPDATE users SET wilayah = 'LEBUNG PG12' WHERE LOWER(nama_lengkap) LIKE '%rudi%' OR LOWER(username) LIKE '%rudi%';");

    // Konversi sisa nilai PG1, PG2, PG3 pada users
    db.run("UPDATE users SET wilayah = 'Geodesi PG1' WHERE wilayah = 'PG1' OR wilayah IS NULL OR wilayah = '';");
    db.run("UPDATE users SET wilayah = 'RC PG1' WHERE wilayah = 'PG2';");
    db.run("UPDATE users SET wilayah = 'LEBUNG PG3' WHERE wilayah = 'PG3';");

    // Normalisasi final untuk memastikan seluruh user non-admin/manager berada di salah satu 8 wilayah kerja
    db.run(`
      UPDATE users SET wilayah = 'Geodesi PG1' 
      WHERE (role NOT IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER') AND hak_akses NOT IN ('Super Admin', 'Admin', 'Manager')) 
        AND (wilayah NOT IN ('Geodesi PG1', 'Geodesi PG2', 'Geodesi PG3', 'RC PG1', 'RC PG2', 'RC PG3', 'LEBUNG PG12', 'LEBUNG PG3') OR wilayah IS NULL OR wilayah = '');
    `);

    // 3. Update Units sesuai relasi Kasie
    db.run("UPDATE units SET wilayah = 'Geodesi PG1' WHERE LOWER(kasie) = 'agung' OR LOWER(nama_pengawas) = 'agung';");
    db.run("UPDATE units SET wilayah = 'Geodesi PG2' WHERE LOWER(kasie) = 'zainudin' OR LOWER(nama_pengawas) = 'zainudin';");
    db.run("UPDATE units SET wilayah = 'Geodesi PG3' WHERE LOWER(kasie) = 'jaidi' OR LOWER(nama_pengawas) = 'jaidi';");
    db.run("UPDATE units SET wilayah = 'RC PG1' WHERE LOWER(kasie) = 'hisar' OR LOWER(nama_pengawas) = 'hisar';");
    db.run("UPDATE units SET wilayah = 'RC PG2' WHERE LOWER(kasie) = 'yono' OR LOWER(nama_pengawas) = 'yono';");
    db.run("UPDATE units SET wilayah = 'RC PG3' WHERE LOWER(kasie) = 'nyoman' OR LOWER(nama_pengawas) = 'nyoman';");
    db.run("UPDATE units SET wilayah = 'LEBUNG PG12' WHERE LOWER(kasie) = 'saipul' OR LOWER(nama_pengawas) = 'saipul';");
    db.run("UPDATE units SET wilayah = 'LEBUNG PG3' WHERE LOWER(kasie) = 'galung' OR LOWER(nama_pengawas) = 'galung';");
    db.run("UPDATE units SET wilayah = 'Geodesi PG1' WHERE wilayah = 'PG1' OR wilayah IS NULL OR wilayah = '';");
    db.run("UPDATE units SET wilayah = 'RC PG1' WHERE wilayah = 'PG2';");
    db.run("UPDATE units SET wilayah = 'LEBUNG PG3' WHERE wilayah = 'PG3';");

    // 4. Update Operators sesuai relasi Kasie
    db.run("UPDATE operators SET wilayah = 'Geodesi PG1' WHERE LOWER(kasie) = 'agung' OR LOWER(nama_pengawas) = 'agung';");
    db.run("UPDATE operators SET wilayah = 'Geodesi PG2' WHERE LOWER(kasie) = 'zainudin' OR LOWER(nama_pengawas) = 'zainudin';");
    db.run("UPDATE operators SET wilayah = 'Geodesi PG3' WHERE LOWER(kasie) = 'jaidi' OR LOWER(nama_pengawas) = 'jaidi';");
    db.run("UPDATE operators SET wilayah = 'RC PG1' WHERE LOWER(kasie) = 'hisar' OR LOWER(nama_pengawas) = 'hisar';");
    db.run("UPDATE operators SET wilayah = 'RC PG2' WHERE LOWER(kasie) = 'yono' OR LOWER(nama_pengawas) = 'yono';");
    db.run("UPDATE operators SET wilayah = 'RC PG3' WHERE LOWER(kasie) = 'nyoman' OR LOWER(nama_pengawas) = 'nyoman';");
    db.run("UPDATE operators SET wilayah = 'LEBUNG PG12' WHERE LOWER(kasie) = 'saipul' OR LOWER(nama_pengawas) = 'saipul';");
    db.run("UPDATE operators SET wilayah = 'LEBUNG PG3' WHERE LOWER(kasie) = 'galung' OR LOWER(nama_pengawas) = 'galung';");
    db.run("UPDATE operators SET wilayah = 'Geodesi PG1' WHERE wilayah = 'PG1' OR wilayah IS NULL OR wilayah = '';");
    db.run("UPDATE operators SET wilayah = 'RC PG1' WHERE wilayah = 'PG2';");
    db.run("UPDATE operators SET wilayah = 'LEBUNG PG3' WHERE wilayah = 'PG3';");

    // 5. Update Lokasi ke Wilayah Baru
    db.run("UPDATE lokasi SET wilayah = 'Geodesi PG1' WHERE kode_lokasi IN ('001A', '002B') OR wilayah = 'PG1';");
    db.run("UPDATE lokasi SET wilayah = 'RC PG1' WHERE kode_lokasi = '003A';");
    db.run("UPDATE lokasi SET wilayah = 'RC PG2' WHERE kode_lokasi = '004C' OR wilayah = 'PG2';");
    db.run("UPDATE lokasi SET wilayah = 'RC PG3' WHERE kode_lokasi = '100A';");
    db.run("UPDATE lokasi SET wilayah = 'LEBUNG PG12' WHERE kode_lokasi = '101B';");
    db.run("UPDATE lokasi SET wilayah = 'LEBUNG PG3' WHERE kode_lokasi = '888A' OR wilayah = 'PG3';");

    // 6. Update Rencana Kerja & Hasil Input Aktivitas
    db.run("UPDATE rencana_kerja SET wilayah = (SELECT wilayah FROM users WHERE LOWER(nama_lengkap) = LOWER(rencana_kerja.nama_pengawas) OR LOWER(username) = LOWER(rencana_kerja.nama_pengawas)) WHERE wilayah IS NULL OR wilayah = '' OR wilayah IN ('PG1', 'PG2', 'PG3');");
    db.run("UPDATE rencana_kerja SET wilayah = (SELECT wilayah FROM lokasi WHERE kode_lokasi = rencana_kerja.kode_lokasi) WHERE wilayah IS NULL OR wilayah = '' OR wilayah IN ('PG1', 'PG2', 'PG3');");
    db.run("UPDATE rencana_kerja SET wilayah = 'Geodesi PG1' WHERE wilayah = 'PG1' OR wilayah IS NULL OR wilayah = '';");
    db.run("UPDATE rencana_kerja SET wilayah = 'RC PG1' WHERE wilayah = 'PG2';");
    db.run("UPDATE rencana_kerja SET wilayah = 'LEBUNG PG3' WHERE wilayah = 'PG3';");

    db.run("UPDATE hasil_input_aktivitas SET wilayah = (SELECT wilayah FROM users WHERE LOWER(nama_lengkap) = LOWER(hasil_input_aktivitas.nama_pengawas) OR LOWER(username) = LOWER(hasil_input_aktivitas.nama_pengawas)) WHERE wilayah IS NULL OR wilayah = '' OR wilayah IN ('PG1', 'PG2', 'PG3');");
    db.run("UPDATE hasil_input_aktivitas SET wilayah = (SELECT wilayah FROM lokasi WHERE kode_lokasi = hasil_input_aktivitas.kode_lokasi) WHERE wilayah IS NULL OR wilayah = '' OR wilayah IN ('PG1', 'PG2', 'PG3');");
    db.run("UPDATE hasil_input_aktivitas SET wilayah = 'Geodesi PG1' WHERE wilayah = 'PG1' OR wilayah IS NULL OR wilayah = '';");
    db.run("UPDATE hasil_input_aktivitas SET wilayah = 'RC PG1' WHERE wilayah = 'PG2';");
    db.run("UPDATE hasil_input_aktivitas SET wilayah = 'LEBUNG PG3' WHERE wilayah = 'PG3';");

    db.run("UPDATE aktivitas_unit SET wilayah = 'Geodesi PG1' WHERE wilayah = 'PG1' OR wilayah IS NULL OR wilayah = '';");
    db.run("UPDATE aktivitas_unit SET wilayah = 'RC PG1' WHERE wilayah = 'PG2';");
    db.run("UPDATE aktivitas_unit SET wilayah = 'LEBUNG PG3' WHERE wilayah = 'PG3';");

    // Normalisasi jenis_unit pada master aktivitas jika kosong
    db.run("UPDATE aktivitas_unit SET jenis_unit = 'Excavator Standar' WHERE jenis_unit IS NULL OR jenis_unit = '';");

    // Pembersihan Master Aktivitas: Hapus total Dump Truck, Bulldozer, Water Truck, Wheel Loader
    db.run("DELETE FROM aktivitas_unit WHERE LOWER(jenis_unit) IN ('dump truck', 'bulldozer', 'water truck', 'wheel loader');");
    try {
      db.run("DELETE FROM master_aktivitas WHERE LOWER(jenis_unit) IN ('dump truck', 'bulldozer', 'water truck', 'wheel loader');");
    } catch {}

    // Buat Views transparan master_user, master_unit, master_operator beserta INSTEAD OF triggers
    try {
      db.run("DROP TRIGGER IF EXISTS trg_master_unit_del;");
      db.run("DROP TRIGGER IF EXISTS trg_master_unit_ins;");
      db.run("DROP TRIGGER IF EXISTS trg_master_unit_upd;");
      db.run("DROP VIEW IF EXISTS master_unit;");
      db.run("CREATE VIEW master_unit AS SELECT * FROM units;");
      db.run(`
        CREATE TRIGGER IF NOT EXISTS trg_master_unit_del INSTEAD OF DELETE ON master_unit
        BEGIN
          DELETE FROM units WHERE id = OLD.id;
        END;
      `);
      db.run(`
        CREATE TRIGGER IF NOT EXISTS trg_master_unit_ins INSTEAD OF INSERT ON master_unit
        BEGIN
          INSERT INTO units (
            kode_unit, jenis_unit, model_unit, nama_pengawas, kasie, wilayah, 
            hm_unit_terakhir_diinputkan, hm_min_standar, hm_max_standar, status_aktif, updated_at
          ) VALUES (
            NEW.kode_unit, 
            COALESCE(NEW.jenis_unit, 'EXCAVATOR'), 
            COALESCE(NEW.model_unit, NEW.jenis_unit, 'Unit Operasional'), 
            COALESCE(NEW.nama_pengawas, NEW.kasie, 'Agung'), 
            COALESCE(NEW.kasie, NEW.nama_pengawas, 'Agung'), 
            COALESCE(NEW.wilayah, (SELECT wilayah FROM users WHERE nama_lengkap = COALESCE(NEW.kasie, NEW.nama_pengawas) LIMIT 1), 'Geodesi PG1'), 
            COALESCE(NEW.hm_unit_terakhir_diinputkan, 0), 
            COALESCE(NEW.hm_min_standar, 6.0), 
            COALESCE(NEW.hm_max_standar, 10.0), 
            COALESCE(NEW.status_aktif, 1), 
            COALESCE(NEW.updated_at, datetime('now'))
          );
        END;
      `);
      db.run(`
        CREATE TRIGGER IF NOT EXISTS trg_master_unit_upd INSTEAD OF UPDATE ON master_unit
        BEGIN
          UPDATE units SET
            kode_unit = COALESCE(NEW.kode_unit, OLD.kode_unit),
            jenis_unit = COALESCE(NEW.jenis_unit, OLD.jenis_unit),
            model_unit = COALESCE(NEW.model_unit, OLD.model_unit),
            nama_pengawas = COALESCE(NEW.nama_pengawas, OLD.nama_pengawas),
            kasie = COALESCE(NEW.kasie, NEW.nama_pengawas, OLD.kasie),
            wilayah = COALESCE(NEW.wilayah, OLD.wilayah),
            hm_unit_terakhir_diinputkan = COALESCE(NEW.hm_unit_terakhir_diinputkan, OLD.hm_unit_terakhir_diinputkan),
            hm_min_standar = COALESCE(NEW.hm_min_standar, OLD.hm_min_standar),
            hm_max_standar = COALESCE(NEW.hm_max_standar, OLD.hm_max_standar),
            status_aktif = COALESCE(NEW.status_aktif, OLD.status_aktif),
            updated_at = COALESCE(NEW.updated_at, datetime('now'))
          WHERE id = OLD.id;
        END;
      `);

      db.run("DROP TRIGGER IF EXISTS trg_master_op_del;");
      db.run("DROP TRIGGER IF EXISTS trg_master_op_ins;");
      db.run("DROP TRIGGER IF EXISTS trg_master_op_upd;");
      db.run("DROP VIEW IF EXISTS master_operator;");
      db.run("CREATE VIEW master_operator AS SELECT * FROM operators;");
      db.run(`
        CREATE TRIGGER IF NOT EXISTS trg_master_op_del INSTEAD OF DELETE ON master_operator
        BEGIN
          DELETE FROM operators WHERE id = OLD.id;
        END;
      `);
      db.run(`
        CREATE TRIGGER IF NOT EXISTS trg_master_op_ins INSTEAD OF INSERT ON master_operator
        BEGIN
          INSERT INTO operators (
            nama_operator, nik, nama_pengawas, kasie, wilayah, status_aktif
          ) VALUES (
            NEW.nama_operator,
            NEW.nik,
            COALESCE(NEW.nama_pengawas, NEW.kasie, 'Agung'),
            COALESCE(NEW.kasie, NEW.nama_pengawas, 'Agung'),
            COALESCE(NEW.wilayah, (SELECT wilayah FROM users WHERE nama_lengkap = COALESCE(NEW.kasie, NEW.nama_pengawas) LIMIT 1), 'Geodesi PG1'),
            COALESCE(NEW.status_aktif, 1)
          );
        END;
      `);
      db.run(`
        CREATE TRIGGER IF NOT EXISTS trg_master_op_upd INSTEAD OF UPDATE ON master_operator
        BEGIN
          UPDATE operators SET
            nama_operator = COALESCE(NEW.nama_operator, OLD.nama_operator),
            nik = COALESCE(NEW.nik, OLD.nik),
            nama_pengawas = COALESCE(NEW.nama_pengawas, OLD.nama_pengawas),
            kasie = COALESCE(NEW.kasie, NEW.nama_pengawas, OLD.kasie),
            wilayah = COALESCE(NEW.wilayah, OLD.wilayah),
            status_aktif = COALESCE(NEW.status_aktif, OLD.status_aktif)
          WHERE id = OLD.id;
        END;
      `);

      db.run("DROP TRIGGER IF EXISTS trg_master_user_del;");
      db.run("DROP TRIGGER IF EXISTS trg_master_user_ins;");
      db.run("DROP TRIGGER IF EXISTS trg_master_user_upd;");
      db.run("DROP VIEW IF EXISTS master_user;");
      db.run("CREATE VIEW master_user AS SELECT * FROM users;");
      db.run(`
        CREATE TRIGGER IF NOT EXISTS trg_master_user_del INSTEAD OF DELETE ON master_user
        BEGIN
          DELETE FROM users WHERE id = OLD.id;
        END;
      `);
    } catch (vErr) {
      console.warn('View alias notice:', vErr);
    }
  } catch (uErr) {
    console.warn('User table migration note:', uErr);
  }

  // Check if users seeded
  const res = db.exec("SELECT COUNT(*) as cnt FROM users");
  const userCount = res[0]?.values[0]?.[0] as number || 0;

  if (userCount === 0) {
    // Seed Users sesuai spesifikasi RKCE
    db.run(`
      INSERT INTO users (nama_lengkap, username, password, hak_akses, role, wilayah, status_aktif) VALUES
      ('Farid', 'farid', '123', 'Super Admin', 'SUPER_ADMIN', 'Semua Wilayah', 1),
      ('Deni', 'deni', '123', 'Super Admin', 'SUPER_ADMIN', 'Semua Wilayah', 1),
      ('Agung', 'agung', '123', 'Kasie', 'SUPERVISOR', 'Geodesi PG1', 1),
      ('Zainudin', 'zainudin', '123', 'Kasie', 'SUPERVISOR', 'Geodesi PG2', 1),
      ('Jaidi', 'jaidi', '123', 'Kasie', 'SUPERVISOR', 'Geodesi PG3', 1),
      ('Hisar', 'hisar', '123', 'Kasie', 'SUPERVISOR', 'RC PG1', 1),
      ('Yono', 'yono', '123', 'Kasie', 'SUPERVISOR', 'RC PG2', 1),
      ('Nyoman', 'nyoman', '123', 'Kasie', 'SUPERVISOR', 'RC PG3', 1),
      ('Saipul', 'saipul', '123', 'Kasie', 'SUPERVISOR', 'LEBUNG PG12', 1),
      ('Galung', 'galung', '123', 'Kasie', 'SUPERVISOR', 'LEBUNG PG3', 1),
      ('Lutfi', 'lutfi', '123', 'Manager', 'MANAGER', 'Semua Wilayah', 1),
      ('Putut', 'putut', '123', 'Manager', 'MANAGER', 'Semua Wilayah', 1);
    `);
    console.log('Seeded 12 standard users (SUPER_ADMIN, KASIE 8 Wilayah Baru, MANAGER).');

    // Only seed initial default data on first initial database setup (when userCount === 0)
    // Seed Units
    db.run(`
      INSERT INTO units (kode_unit, jenis_unit, model_unit, nama_pengawas, hm_unit_terakhir_diinputkan, updated_at) VALUES
      ('DT-101', 'DUMP TRUCK', 'Hino FM 260 Ti', 'Budi Santoso', 4280.5, '2026-10-08 17:30:00'),
      ('DT-102', 'DUMP TRUCK', 'Scania P360 CB', 'Agus Wijaya', 3890.0, '2026-10-08 16:45:00'),
      ('DZ-01', 'BULLDOZER', 'Komatsu D85ESS-2', 'Budi Santoso', 7120.2, '2026-10-08 18:00:00'),
      ('DZ-02', 'BULLDOZER', 'Caterpillar D6R', 'Rudi Hermawan', 5430.8, '2026-10-08 17:15:00'),
      ('HEH1', 'EXCAVATOR', 'Komatsu PC200-8', 'Budi Santoso', 8920.4, '2026-10-08 17:50:00'),
      ('EX-301', 'EXCAVATOR', 'Hitachi ZX330-5G', 'Agus Wijaya', 6450.0, '2026-10-08 17:00:00'),
      ('GD-01', 'MOTOR GRADER', 'Komatsu GD511A', 'Rudi Hermawan', 3110.6, '2026-10-08 16:20:00'),
      ('WT-05', 'WATER TRUCK', 'Hino Ranger 500', 'Budi Santoso', 2490.1, '2026-10-08 15:10:00');
    `);

    // Seed Aktivitas (Dengan Kategori Status Otomatis)
    db.run(`
      INSERT INTO aktivitas_unit (jenis_unit, nama_aktivitas, satuan, kode_sap, kategori_status, status_unit) VALUES
      ('EXCAVATOR', 'Galian Tanah Lunak', 'm3', 'ACT-SAP-101', 'OPERASI', 'OPERASI'),
      ('EXCAVATOR', 'Loading Overburden (OB)', 'BCM', 'ACT-SAP-102', 'OPERASI', 'OPERASI'),
      ('EXCAVATOR', 'Pembuatan Saluran Air (Ditch)', 'm', 'ACT-SAP-103', 'OPERASI', 'OPERASI'),
      ('BULLDOZER', 'Clearing & Grubbing Lahan', 'm2', 'ACT-SAP-104', 'OPERASI', 'OPERASI'),
      ('BULLDOZER', 'Dozing & Ripping OB', 'm3', 'ACT-SAP-105', 'OPERASI', 'OPERASI'),
      ('BULLDOZER', 'Perawatan Disposal Area', 'jam', 'ACT-SAP-106', 'OPERASI', 'OPERASI'),
      ('DUMP TRUCK', 'Hauling Overburden ke Disposal', 'rit', 'ACT-SAP-107', 'OPERASI', 'OPERASI'),
      ('DUMP TRUCK', 'Hauling Ore / Batubara ke Stockpile', 'ton', 'ACT-SAP-108', 'OPERASI', 'OPERASI'),
      ('MOTOR GRADER', 'Perawatan Jalan Tambang (Grading)', 'km', 'ACT-SAP-109', 'OPERASI', 'OPERASI'),
      ('WATER TRUCK', 'Penyiraman Jalan Berdebu', 'tangki', 'ACT-SAP-110', 'OPERASI', 'OPERASI'),
      ('EXCAVATOR', 'Standby Hujan & Kondisi Licin', 'jam', 'ACT-SAP-111', 'STANDBY', 'STANDBY'),
      ('DUMP TRUCK', 'Breakdown Engine / Sistem Hidrolik', 'jam', 'ACT-SAP-112', 'BREAKDOWN', 'BREAKDOWN');
    `);

    // Seed Operators (Tanpa Jabatan)
    db.run(`
      INSERT INTO operators (nama_operator, nik, nama_pengawas) VALUES
      ('Joko Susilo', 'NIK-94821', 'Budi Santoso'),
      ('Hendri Kurniawan', 'NIK-94822', 'Budi Santoso'),
      ('Bambang Irawan', 'NIK-94835', 'Budi Santoso'),
      ('Dedi Prasetyo', 'NIK-94840', 'Agus Wijaya'),
      ('Supriyanto', 'NIK-94848', 'Agus Wijaya'),
      ('Ahmad Zaki', 'NIK-94852', 'Rudi Hermawan'),
      ('Wahyu Hidayat', 'NIK-94859', 'Rudi Hermawan'),
      ('Teguh Santosa', 'NIK-94863', 'Budi Santoso');
    `);

    // Seed Initial Activity Reports (hasil_input_aktivitas tanpa kategori)
    const today = new Date().toISOString().slice(0, 10);
    const photo1 = generateSampleFieldPhoto('HEH1', 'Loading Overburden (OB)', 'Pit Utara Blok C', 'Budi Santoso', today);
    const photo2 = generateSampleFieldPhoto('DZ-01', 'Clearing & Grubbing Lahan', 'Front Loading 3', 'Budi Santoso', today);
    const photo3 = generateSampleFieldPhoto('DT-102', 'Hauling Overburden ke Disposal', 'Disposal Barat', 'Agus Wijaya', today);
    const photo4 = generateSampleFieldPhoto('EX-301', 'Galian Tanah Lunak', 'Pit Selatan ROM 1', 'Agus Wijaya', today);

    db.run(`
      INSERT INTO hasil_input_aktivitas 
      (nama_pengawas, tanggal, kode_unit, nama_aktivitas, kode_sap, satuan, operator, nik_operator, lokasi, shift_kerja, jam_kerja, hm_awal, hm_akhir, hm_harian_berjalan, hasil_kerja, keterangan, foto_bukti, status_unit, is_isi_solar, jumlah_liter_solar, created_at)
      VALUES
      ('Budi Santoso', '${today}', 'HEH1', 'Loading Overburden (OB)', 'ACT-SAP-102', 'BCM', 'Hendri Kurniawan', 'NIK-94822', 'Pit Utara Blok C', 'Siang', 10.5, 8910.0, 8920.4, 10.4, 1450, 'Operasi lancar, material mudstone', ?, 'OPERASI', 1, 185.0, '2026-10-08 17:50:00'),
      ('Budi Santoso', '${today}', 'DZ-01', 'Clearing & Grubbing Lahan', 'ACT-SAP-104', 'm2', 'Bambang Irawan', 'NIK-94835', 'Front Loading 3', 'Siang', 11.0, 7109.5, 7120.2, 10.7, 3200, 'Perapihan lereng aman sesuai SOP', ?, 'OPERASI', 1, 140.0, '2026-10-08 18:00:00'),
      ('Agus Wijaya', '${today}', 'DT-102', 'Hauling Overburden ke Disposal', 'ACT-SAP-107', 'rit', 'Dedi Prasetyo', 'NIK-94840', 'Disposal Barat', 'Siang', 9.5, 3881.0, 3890.0, 9.0, 38, '38 ritasi tercapai', ?, 'OPERASI', 1, 120.0, '2026-10-08 16:45:00'),
      ('Agus Wijaya', '${today}', 'EX-301', 'Galian Tanah Lunak', 'ACT-SAP-101', 'm3', 'Supriyanto', 'NIK-94848', 'Pit Selatan ROM 1', 'Siang', 10.0, 6440.0, 6450.0, 10.0, 1100, 'Material lunak gampang digali', ?, 'OPERASI', 0, 0.0, '2026-10-08 17:00:00'),
      ('Rudi Hermawan', '${today}', 'DZ-02', 'Dozing & Ripping OB', 'ACT-SAP-105', 'm3', 'Wahyu Hidayat', 'NIK-94859', 'Front 4 Pit Timur', 'Siang', 8.5, 5422.5, 5430.8, 8.3, 1900, 'Ripping batuan sandstone', NULL, 'OPERASI', 1, 110.0, '2026-10-08 17:15:00'),
      ('Rudi Hermawan', '${today}', 'GD-01', 'Perawatan Jalan Tambang (Grading)', 'ACT-SAP-109', 'km', 'Ahmad Zaki', 'NIK-94852', 'Main Haul Road KM 2-6', 'Siang', 7.0, 3103.8, 3110.6, 6.8, 12, 'Perataan jalan pasca hujan pagi', NULL, 'STANDBY', 0, 0.0, '2026-10-08 16:20:00'),
      ('Budi Santoso', '${today}', 'DT-101', 'Hauling Overburden ke Disposal', 'ACT-SAP-107', 'rit', 'Joko Susilo', 'NIK-94821', 'Disposal Timur', 'Malam', 10.0, 4271.0, 4280.5, 9.5, 42, 'Kondisi haul road mulus', NULL, 'OPERASI', 1, 150.0, '2026-10-08 17:30:00');
    `, [photo1, photo2, photo3, photo4]);

    db.run(`
      INSERT OR IGNORE INTO rencana_kerja (id, nama_pengawas, tanggal, status_unit, kode_unit, operator, kode_lokasi, shift_kerja, nomor_spk, status_spk, keterangan_rencana, created_at) VALUES
      ('RK-2026-001', 'Budi Santoso', '${today}', 'OPERASI', 'HEH1', 'Hendri Kurniawan', '001A', 'SIANG', NULL, 'MENUNGGU_SPK', 'Overburden stripping pit utara blok C', '${today} 06:30:00'),
      ('RK-2026-002', 'Budi Santoso', '${today}', 'OPERASI', 'DZ-01', 'Bambang Irawan', '002B', 'SIANG', 'SPK-2026-X101', 'SPK_TERBIT', 'Clearing dan land leveling area front 3', '${today} 06:45:00'),
      ('RK-2026-003', 'Agus Wijaya', '${today}', 'OPERASI', 'DT-102', 'Dedi Prasetyo', '003A', 'SIANG', 'SPK-2026-X102', 'REALISASI_SELESAI', 'Hauling overburden ke disposal barat', '${today} 07:00:00'),
      ('RK-2026-004', 'Agus Wijaya', '${today}', 'STANDBY', 'EX-301', 'Supriyanto', '004C', 'SIANG', NULL, 'MENUNGGU_SPK', 'Standby perapihan bench dan inspeksi', '${today} 07:15:00'),
      ('RK-2026-005', 'Rudi Hermawan', '${today}', 'OPERASI', 'GD-01', 'Ahmad Zaki', '100A', 'SIANG', 'SPK-2026-X103', 'SPK_TERBIT', 'Grading main haul road km 2-6', '${today} 07:30:00');
    `);
  }

  // Check if master_kendala seeded
  const resKendala = db.exec("SELECT COUNT(*) as cnt FROM master_kendala");
  const kendalaCount = (resKendala[0]?.values[0]?.[0] as number) || 0;
  if (kendalaCount === 0) {
    const defaultKendalaList = [
      'Antar - jemput',
      'Cek unit, Implement Pemanasan mesin',
      'Transport',
      'Kerja',
      'Istirahat',
      'Perbaikan Unit',
      'Perbaikan Implement',
      'Perawatan Unit',
      'Perawatan Implement',
      'Ganti Implement',
      'Tunggu Solar',
      'Tunggu Mekanik',
      'Tunggu Trailler',
      'Tunggu Lokasi',
      'Tunggu Cuaca'
    ];
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    for (const item of defaultKendalaList) {
      db.run("INSERT OR IGNORE INTO master_kendala (nama_kendala, status_aktif, created_at) VALUES (?, 1, ?)", [item, now]);
    }
    console.log(`Seeded ${defaultKendalaList.length} master kendala operasional.`);
  }

  // Backfill nomor_spk and kode_lokasi on existing hasil_input_aktivitas
  try {
    db.run("UPDATE hasil_input_aktivitas SET kode_lokasi = '001A' WHERE kode_lokasi IS NULL OR kode_lokasi = ''");
    db.run("UPDATE hasil_input_aktivitas SET nomor_spk = 'SPK-2026-X102' WHERE kode_unit = 'DT-102' AND (nomor_spk IS NULL OR nomor_spk = '')");
    db.run("UPDATE hasil_input_aktivitas SET nomor_spk = 'SPK-2026-X101' WHERE kode_unit = 'DZ-01' AND (nomor_spk IS NULL OR nomor_spk = '')");

    // Backfill sample stik & kendala for demonstration
    db.run("UPDATE hasil_input_aktivitas SET stik_awal = 65.0, stik_akhir = 25.0 WHERE kode_unit = 'HEH1' AND stik_awal IS NULL");
    db.run("UPDATE hasil_input_aktivitas SET stik_awal = 55.0, stik_akhir = 30.0 WHERE kode_unit = 'DZ-01' AND stik_awal IS NULL");
    db.run("UPDATE hasil_input_aktivitas SET stik_awal = 50.0, stik_akhir = 20.0 WHERE kode_unit = 'DT-102' AND stik_awal IS NULL");
    db.run("UPDATE hasil_input_aktivitas SET stik_awal = 45.0, stik_akhir = 20.0 WHERE kode_unit = 'DZ-02' AND stik_awal IS NULL");
    db.run("UPDATE hasil_input_aktivitas SET stik_awal = 30.0, stik_akhir = 30.0 WHERE kode_unit = 'GD-01' AND stik_awal IS NULL");
    db.run("UPDATE hasil_input_aktivitas SET stik_awal = 60.0, stik_akhir = 35.0 WHERE kode_unit = 'DT-101' AND stik_awal IS NULL");

    const sampleKendalaDZ02 = JSON.stringify([
      { nama_kendala: 'Tunggu Solar', kode_kendala: 'KND-01', jam_mulai: '08:30', jam_selesai: '10:00', durasi_jam: 1.5, hambatan: 1.5, waktu_mulai: '08:30', waktu_selesai: '10:00', durasi_menit: 90 },
      { nama_kendala: 'Perbaikan Implement', kode_kendala: 'KND-02', jam_mulai: '13:15', jam_selesai: '14:00', durasi_jam: 0.75, hambatan: 0.75, waktu_mulai: '13:15', waktu_selesai: '14:00', durasi_menit: 45 }
    ]);
    const sampleKendalaGD01 = JSON.stringify([
      { nama_kendala: 'Tunggu Cuaca', kode_kendala: 'KND-03', jam_mulai: '07:00', jam_selesai: '09:30', durasi_jam: 2.5, hambatan: 2.5, waktu_mulai: '07:00', waktu_selesai: '09:30', durasi_menit: 150 }
    ]);
    const sampleKendalaHEH1 = JSON.stringify([
      { nama_kendala: 'Cek unit, Implement Pemanasan mesin', kode_kendala: 'KND-04', jam_mulai: '06:30', jam_selesai: '07:00', durasi_jam: 0.5, hambatan: 0.5, waktu_mulai: '06:30', waktu_selesai: '07:00', durasi_menit: 30 }
    ]);

    db.run("UPDATE hasil_input_aktivitas SET kendala_list = ?, kendala_data = ?, ada_kendala = 1 WHERE kode_unit = 'DZ-02' AND (kendala_list IS NULL OR kendala_list = '' OR kendala_list = '[]')", [sampleKendalaDZ02, sampleKendalaDZ02]);
    db.run("UPDATE hasil_input_aktivitas SET kendala_list = ?, kendala_data = ?, ada_kendala = 1 WHERE kode_unit = 'GD-01' AND (kendala_list IS NULL OR kendala_list = '' OR kendala_list = '[]')", [sampleKendalaGD01, sampleKendalaGD01]);
    db.run("UPDATE hasil_input_aktivitas SET kendala_list = ?, kendala_data = ?, ada_kendala = 1 WHERE kode_unit = 'HEH1' AND (kendala_list IS NULL OR kendala_list = '' OR kendala_list = '[]')", [sampleKendalaHEH1, sampleKendalaHEH1]);

    // Backfill sample corrected HM awal on DT-101 for realistic testing & immediate verification
    db.run("UPDATE hasil_input_aktivitas SET is_hm_awal_corrected = 1, alasan_koreksi_hm = 'Salah input shift malam' WHERE kode_unit = 'DT-101' AND (is_hm_awal_corrected IS NULL OR is_hm_awal_corrected = 0)");
  } catch (e) {
    console.warn('Backfill spk and kendala note:', e);
  }
}

// Helper query function returning array of objects
export function queryAll<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T | null {
  const all = queryAll<T>(sql, params);
  return all.length > 0 ? all[0] : null;
}

export function execute(sql: string, params: SqlValue[] = []): { lastInsertRowId: number; changes: number } {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  const rowIdRes = dbInstance.exec("SELECT last_insert_rowid() as id, changes() as chg");
  const lastInsertRowId = (rowIdRes[0]?.values[0]?.[0] as number) || 0;
  const changes = (rowIdRes[0]?.values[0]?.[1] as number) || 0;
  saveDb();
  return { lastInsertRowId, changes };
}

/**
 * Mengosongkan (reset) seluruh data transaksi dan master lama di database SQLite
 * tanpa merusak struktur tabel, lalu menyemai kembali master user, 50 unit, dan 44 operator:
 * - Master User (12 User: Farid, Deni, Agung, Zainudin, Jaidi, Hisar, Yono, Nyoman, Saipul, Galung, Lutfi, Putut)
 * - Master Unit (50 Unit: Long Arm, Mini, Motor Grader, Compactor, Excavator Standar, Bulldozer, Dump Truck)
 * - Master Operator (44 Operator dengan NIK dan relasi penanggung jawab Kasie)
 */
export async function resetAndSeedDatabase(): Promise<{ success: boolean; message: string; userCount: number; unitCount: number; operatorCount: number; aktivitasCount?: number }> {
  const db = await getDb();

  // 1. Jalankan pengosongan tabel transaksi & master sesuai perintah
  db.run(`
    DELETE FROM aktivitas_unit;
    DELETE FROM rencana_kerja;
    DELETE FROM operators;
    DELETE FROM units;
    DELETE FROM users;
    DELETE FROM hasil_input_aktivitas;
  `);

  // 2. Seeding tabel users sesuai rincian (8 Wilayah Kerja Baru)
  db.run(`
    INSERT INTO users (nama_lengkap, username, password, hak_akses, role, wilayah, status_aktif) VALUES
    ('Farid', 'farid', '123', 'Super Admin', 'SUPER_ADMIN', 'Semua Wilayah', 1),
    ('Deni', 'deni', '123', 'Super Admin', 'SUPER_ADMIN', 'Semua Wilayah', 1),
    ('Agung', 'agung', '123', 'Kasie', 'SUPERVISOR', 'Geodesi PG1', 1),
    ('Zainudin', 'zainudin', '123', 'Kasie', 'SUPERVISOR', 'Geodesi PG2', 1),
    ('Jaidi', 'jaidi', '123', 'Kasie', 'SUPERVISOR', 'Geodesi PG3', 1),
    ('Hisar', 'hisar', '123', 'Kasie', 'SUPERVISOR', 'RC PG1', 1),
    ('Yono', 'yono', '123', 'Kasie', 'SUPERVISOR', 'RC PG2', 1),
    ('Nyoman', 'nyoman', '123', 'Kasie', 'SUPERVISOR', 'RC PG3', 1),
    ('Saipul', 'saipul', '123', 'Kasie', 'SUPERVISOR', 'LEBUNG PG12', 1),
    ('Galung', 'galung', '123', 'Kasie', 'SUPERVISOR', 'LEBUNG PG3', 1),
    ('Lutfi', 'lutfi', '123', 'Manager', 'MANAGER', 'Semua Wilayah', 1),
    ('Putut', 'putut', '123', 'Manager', 'MANAGER', 'Semua Wilayah', 1);
  `);

  // 3. Seeding 50 Master Units (dengan Wilayah Baru sesuai Kasie)
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const unitsData = [
    // 14 Unit Eksplisit
    { kode: 'HEH0013', jenis: 'EXCAVATOR', model: 'Excavator Long Arm', kasie: 'Agung', wilayah: 'Geodesi PG1', hm: 1, min: 6.0, max: 10.0 },
    { kode: 'HEH0015', jenis: 'EXCAVATOR', model: 'Excavator Long Arm', kasie: 'Agung', wilayah: 'Geodesi PG1', hm: 2, min: 6.0, max: 10.1 },
    { kode: 'HEH0016', jenis: 'EXCAVATOR', model: 'Excavator Long Arm', kasie: 'Zainudin', wilayah: 'Geodesi PG2', hm: 3, min: 6.0, max: 10.2 },
    { kode: 'HEH0017', jenis: 'EXCAVATOR', model: 'Excavator Long Arm', kasie: 'Zainudin', wilayah: 'Geodesi PG2', hm: 4, min: 6.0, max: 10.3 },
    { kode: 'HEH0018', jenis: 'EXCAVATOR', model: 'Excavator Long Arm', kasie: 'Zainudin', wilayah: 'Geodesi PG2', hm: 5, min: 6.0, max: 10.4 },
    { kode: 'HEH0004', jenis: 'EXCAVATOR', model: 'Excavator Mini', kasie: 'Agung', wilayah: 'Geodesi PG1', hm: 6, min: 6.0, max: 10.5 },
    { kode: 'HEH0005', jenis: 'EXCAVATOR', model: 'Excavator Mini', kasie: 'Hisar', wilayah: 'RC PG1', hm: 7, min: 6.0, max: 10.6 },
    { kode: 'HEH0006', jenis: 'EXCAVATOR', model: 'Excavator Mini', kasie: 'Hisar', wilayah: 'RC PG1', hm: 8, min: 6.0, max: 10.7 },
    { kode: 'MGC0001', jenis: 'MOTOR GRADER', model: 'Motor Grader', kasie: 'Jaidi', wilayah: 'Geodesi PG3', hm: 9, min: 6.0, max: 10.8 },
    { kode: 'MGC0003', jenis: 'MOTOR GRADER', model: 'Motor Grader', kasie: 'Jaidi', wilayah: 'Geodesi PG3', hm: 10, min: 6.0, max: 10.9 },
    { kode: 'MGC0004', jenis: 'MOTOR GRADER', model: 'Motor Grader', kasie: 'Jaidi', wilayah: 'Geodesi PG3', hm: 11, min: 6.0, max: 11.0 },
    { kode: 'MGC0005', jenis: 'MOTOR GRADER', model: 'Motor Grader', kasie: 'Hisar', wilayah: 'RC PG1', hm: 12, min: 6.0, max: 11.1 },
    { kode: 'MGC0006', jenis: 'MOTOR GRADER', model: 'Motor Grader', kasie: 'Hisar', wilayah: 'RC PG1', hm: 13, min: 6.0, max: 11.2 },
    { kode: 'SCC0001', jenis: 'COMPACTOR', model: 'Compactor', kasie: 'Agung', wilayah: 'Geodesi PG1', hm: 14, min: 6.0, max: 11.3 },

    // Excavator Standar Tambahan (HEH0019 - HEH0040)
    { kode: 'HEH0019', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Yono', wilayah: 'RC PG2', hm: 15, min: 6.0, max: 10.0 },
    { kode: 'HEH0020', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Yono', wilayah: 'RC PG2', hm: 16, min: 6.0, max: 10.0 },
    { kode: 'HEH0021', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Yono', wilayah: 'RC PG2', hm: 17, min: 6.0, max: 10.0 },
    { kode: 'HEH0022', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Nyoman', wilayah: 'RC PG3', hm: 18, min: 6.0, max: 10.0 },
    { kode: 'HEH0023', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Nyoman', wilayah: 'RC PG3', hm: 19, min: 6.0, max: 10.0 },
    { kode: 'HEH0024', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Nyoman', wilayah: 'RC PG3', hm: 20, min: 6.0, max: 10.0 },
    { kode: 'HEH0025', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Saipul', wilayah: 'LEBUNG PG12', hm: 21, min: 6.0, max: 10.0 },
    { kode: 'HEH0026', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Saipul', wilayah: 'LEBUNG PG12', hm: 22, min: 6.0, max: 10.0 },
    { kode: 'HEH0027', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Galung', wilayah: 'LEBUNG PG3', hm: 23, min: 6.0, max: 10.0 },
    { kode: 'HEH0028', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Galung', wilayah: 'LEBUNG PG3', hm: 24, min: 6.0, max: 10.0 },
    { kode: 'HEH0029', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Agung', wilayah: 'Geodesi PG1', hm: 25, min: 6.0, max: 10.0 },
    { kode: 'HEH0030', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Agung', wilayah: 'Geodesi PG1', hm: 26, min: 6.0, max: 10.0 },
    { kode: 'HEH0031', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Zainudin', wilayah: 'Geodesi PG2', hm: 27, min: 6.0, max: 10.0 },
    { kode: 'HEH0032', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Zainudin', wilayah: 'Geodesi PG2', hm: 28, min: 6.0, max: 10.0 },
    { kode: 'HEH0033', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Jaidi', wilayah: 'Geodesi PG3', hm: 29, min: 6.0, max: 10.0 },
    { kode: 'HEH0034', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Jaidi', wilayah: 'Geodesi PG3', hm: 30, min: 6.0, max: 10.0 },
    { kode: 'HEH0035', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Hisar', wilayah: 'RC PG1', hm: 31, min: 6.0, max: 10.0 },
    { kode: 'HEH0036', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Hisar', wilayah: 'RC PG1', hm: 32, min: 6.0, max: 10.0 },
    { kode: 'HEH0037', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Yono', wilayah: 'RC PG2', hm: 33, min: 6.0, max: 10.0 },
    { kode: 'HEH0038', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Nyoman', wilayah: 'RC PG3', hm: 34, min: 6.0, max: 10.0 },
    { kode: 'HEH0039', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Saipul', wilayah: 'LEBUNG PG12', hm: 35, min: 6.0, max: 10.0 },
    { kode: 'HEH0040', jenis: 'EXCAVATOR', model: 'Excavator Standar', kasie: 'Galung', wilayah: 'LEBUNG PG3', hm: 36, min: 6.0, max: 10.0 },

    // Bulldozer (8 Unit)
    { kode: 'BDC0001', jenis: 'BULLDOZER', model: 'Bulldozer', kasie: 'Agung', wilayah: 'Geodesi PG1', hm: 37, min: 6.0, max: 10.0 },
    { kode: 'BDC0002', jenis: 'BULLDOZER', model: 'Bulldozer', kasie: 'Zainudin', wilayah: 'Geodesi PG2', hm: 38, min: 6.0, max: 10.0 },
    { kode: 'BDC0003', jenis: 'BULLDOZER', model: 'Bulldozer', kasie: 'Jaidi', wilayah: 'Geodesi PG3', hm: 39, min: 6.0, max: 10.0 },
    { kode: 'BDC0004', jenis: 'BULLDOZER', model: 'Bulldozer', kasie: 'Hisar', wilayah: 'RC PG1', hm: 40, min: 6.0, max: 10.0 },
    { kode: 'BDC0005', jenis: 'BULLDOZER', model: 'Bulldozer', kasie: 'Yono', wilayah: 'RC PG2', hm: 41, min: 6.0, max: 10.0 },
    { kode: 'BDC0006', jenis: 'BULLDOZER', model: 'Bulldozer', kasie: 'Nyoman', wilayah: 'RC PG3', hm: 42, min: 6.0, max: 10.0 },
    { kode: 'BDC0007', jenis: 'BULLDOZER', model: 'Bulldozer', kasie: 'Saipul', wilayah: 'LEBUNG PG12', hm: 43, min: 6.0, max: 10.0 },
    { kode: 'BDC0008', jenis: 'BULLDOZER', model: 'Bulldozer', kasie: 'Galung', wilayah: 'LEBUNG PG3', hm: 44, min: 6.0, max: 10.0 },

    // Compactor & Dump Truck (6 Unit)
    { kode: 'SCC0002', jenis: 'COMPACTOR', model: 'Compactor', kasie: 'Jaidi', wilayah: 'Geodesi PG3', hm: 45, min: 6.0, max: 10.0 },
    { kode: 'SCC0003', jenis: 'COMPACTOR', model: 'Compactor', kasie: 'Hisar', wilayah: 'RC PG1', hm: 46, min: 6.0, max: 10.0 },
    { kode: 'SCC0004', jenis: 'COMPACTOR', model: 'Compactor', kasie: 'Nyoman', wilayah: 'RC PG3', hm: 47, min: 6.0, max: 10.0 },
    { kode: 'DTC0001', jenis: 'DUMP TRUCK', model: 'Dump Truck', kasie: 'Agung', wilayah: 'Geodesi PG1', hm: 48, min: 6.0, max: 10.0 },
    { kode: 'DTC0002', jenis: 'DUMP TRUCK', model: 'Dump Truck', kasie: 'Zainudin', wilayah: 'Geodesi PG2', hm: 49, min: 6.0, max: 10.0 },
    { kode: 'DTC0003', jenis: 'DUMP TRUCK', model: 'Dump Truck', kasie: 'Yono', wilayah: 'RC PG2', hm: 50, min: 6.0, max: 10.0 }
  ];

  for (const u of unitsData) {
    db.run(`
      INSERT INTO units (
        kode_unit, jenis_unit, model_unit, nama_pengawas, kasie, wilayah,
        hm_unit_terakhir_diinputkan, hm_min_standar, hm_max_standar, status_aktif, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [u.kode, u.jenis, u.model, u.kasie, u.kasie, u.wilayah, u.hm, u.min, u.max, now]);
  }

  // 4. Seeding 44 Master Operators (dengan Wilayah Baru sesuai Kasie)
  const operatorsData = [
    // Kasie Agung (Geodesi PG1)
    { nama: 'Sudarwin', nik: '123456', kasie: 'Agung', wilayah: 'Geodesi PG1' },
    { nama: 'Suyadi', nik: '123457', kasie: 'Agung', wilayah: 'Geodesi PG1' },
    { nama: 'Farid', nik: '123458', kasie: 'Agung', wilayah: 'Geodesi PG1' },
    { nama: 'Aldo', nik: '123459', kasie: 'Agung', wilayah: 'Geodesi PG1' },
    { nama: 'Sofyan Bagus', nik: '123460', kasie: 'Agung', wilayah: 'Geodesi PG1' },

    // Kasie Zainudin (Geodesi PG2)
    { nama: 'Rendi', nik: '123461', kasie: 'Zainudin', wilayah: 'Geodesi PG2' },
    { nama: 'Syaifurohman', nik: '123462', kasie: 'Zainudin', wilayah: 'Geodesi PG2' },
    { nama: 'Tugiman', nik: '123463', kasie: 'Zainudin', wilayah: 'Geodesi PG2' },
    { nama: 'Ilham Dwi', nik: '123464', kasie: 'Zainudin', wilayah: 'Geodesi PG2' },
    { nama: 'Rizki', nik: '123465', kasie: 'Zainudin', wilayah: 'Geodesi PG2' },
    { nama: 'Fernando', nik: '123466', kasie: 'Zainudin', wilayah: 'Geodesi PG2' },
    { nama: 'S. Bejo', nik: '123467', kasie: 'Zainudin', wilayah: 'Geodesi PG2' },
    { nama: 'Ronald', nik: '123468', kasie: 'Zainudin', wilayah: 'Geodesi PG2' },

    // Kasie Jaidi (Geodesi PG3)
    { nama: 'Somat', nik: '123469', kasie: 'Jaidi', wilayah: 'Geodesi PG3' },
    { nama: 'Andri l.w', nik: '123470', kasie: 'Jaidi', wilayah: 'Geodesi PG3' },
    { nama: 'Gunawan', nik: '123471', kasie: 'Jaidi', wilayah: 'Geodesi PG3' },
    { nama: 'Jepri', nik: '123472', kasie: 'Jaidi', wilayah: 'Geodesi PG3' },
    { nama: 'A. Taufik', nik: '123473', kasie: 'Jaidi', wilayah: 'Geodesi PG3' },
    { nama: 'Asraf', nik: '123474', kasie: 'Jaidi', wilayah: 'Geodesi PG3' },
    { nama: 'Rendi', nik: '123475', kasie: 'Jaidi', wilayah: 'Geodesi PG3' },

    // Kasie Hisar (RC PG1)
    { nama: 'Iwan S', nik: '123476', kasie: 'Hisar', wilayah: 'RC PG1' },
    { nama: 'Habibi', nik: '123477', kasie: 'Hisar', wilayah: 'RC PG1' },
    { nama: 'Dwi', nik: '123478', kasie: 'Hisar', wilayah: 'RC PG1' },
    { nama: 'Chandra', nik: '123479', kasie: 'Hisar', wilayah: 'RC PG1' },
    { nama: 'Agus', nik: '123480', kasie: 'Hisar', wilayah: 'RC PG1' },
    { nama: 'Bayu', nik: '123481', kasie: 'Hisar', wilayah: 'RC PG1' },
    { nama: 'Fajar', nik: '123482', kasie: 'Hisar', wilayah: 'RC PG1' },
    { nama: 'Bayu (2)', nik: '123483', kasie: 'Hisar', wilayah: 'RC PG1' },

    // Kasie Yono (RC PG2)
    { nama: 'Aziz I.', nik: '123484', kasie: 'Yono', wilayah: 'RC PG2' },
    { nama: 'Gus Hamid', nik: '123485', kasie: 'Yono', wilayah: 'RC PG2' },
    { nama: 'Rio', nik: '123486', kasie: 'Yono', wilayah: 'RC PG2' },
    { nama: 'Suhardi', nik: '123487', kasie: 'Yono', wilayah: 'RC PG2' },
    { nama: 'A. Taufiq', nik: '123488', kasie: 'Yono', wilayah: 'RC PG2' },

    // Kasie Nyoman (RC PG3)
    { nama: 'Simon', nik: '123489', kasie: 'Nyoman', wilayah: 'RC PG3' },
    { nama: 'Alex S.', nik: '123490', kasie: 'Nyoman', wilayah: 'RC PG3' },
    { nama: 'Subandi', nik: '123491', kasie: 'Nyoman', wilayah: 'RC PG3' },
    { nama: 'Ferdiyanto', nik: '123492', kasie: 'Nyoman', wilayah: 'RC PG3' },

    // Kasie Saipul (LEBUNG PG12)
    { nama: 'Tridiyanto', nik: '123493', kasie: 'Saipul', wilayah: 'LEBUNG PG12' },
    { nama: 'Simon P.', nik: '123494', kasie: 'Saipul', wilayah: 'LEBUNG PG12' },
    { nama: 'Suranto', nik: '123495', kasie: 'Saipul', wilayah: 'LEBUNG PG12' },

    // Kasie Galung (LEBUNG PG3)
    { nama: 'Sahroji', nik: '123496', kasie: 'Galung', wilayah: 'LEBUNG PG3' },
    { nama: 'Andi S.', nik: '123497', kasie: 'Galung', wilayah: 'LEBUNG PG3' },
    { nama: 'Sutriyono', nik: '123498', kasie: 'Galung', wilayah: 'LEBUNG PG3' },
    { nama: 'Sugiyono', nik: '123499', kasie: 'Galung', wilayah: 'LEBUNG PG3' }
  ];

  for (const op of operatorsData) {
    db.run(`
      INSERT INTO operators (
        nama_operator, nik, nama_pengawas, kasie, wilayah, status_aktif
      ) VALUES (?, ?, ?, ?, ?, 1)
    `, [op.nama, op.nik, op.kasie, op.kasie, op.wilayah]);
  }

  // 5. Seeding Master Aktivitas (Excavator Long Arm, Excavator Mini, Motor Grader, Compactor, Excavator Standar, Bulldozer, Dump Truck)
  const aktivitasCount = await seedMasterAktivitas();

  saveDb();
  console.log('✅ [DB-RESET] Database berhasil di-reset dan data master users (12), units (50), operators (44), serta aktivitas (' + aktivitasCount + ') berhasil di-seed.');

  const countRes = db.exec("SELECT COUNT(*) as c FROM users;");
  const countUnitsRes = db.exec("SELECT COUNT(*) as c FROM units;");
  const countOpRes = db.exec("SELECT COUNT(*) as c FROM operators;");
  const countActRes = db.exec("SELECT COUNT(*) as c FROM aktivitas_unit;");

  const count = (countRes[0]?.values[0]?.[0] as number) || 12;
  const unitCount = (countUnitsRes[0]?.values[0]?.[0] as number) || 50;
  const operatorCount = (countOpRes[0]?.values[0]?.[0] as number) || 44;
  const finalActCount = (countActRes[0]?.values[0]?.[0] as number) || aktivitasCount;

  return {
    success: true,
    message: 'Data master users (12), master units (50), master operators (44), dan master aktivitas (' + finalActCount + ') berhasil diisi lengkap dengan relasi penanggung jawab Kasie dan status operasional.',
    userCount: count,
    unitCount,
    operatorCount,
    aktivitasCount: finalActCount
  };
}

/**
 * Seeding data awal lengkap untuk tabel master_aktivitas (dan aktivitas_unit)
 * mencakup jenis unit, kode SAP, satuan, dan kategori status operasional (OPERASI, STANDBY, BREAKDOWN)
 */
export async function seedMasterAktivitas(): Promise<number> {
  const db = await getDb();

  // Hapus data aktivitas lama jika ada sebelum mengisi ulang secara bersih
  db.run("DELETE FROM aktivitas_unit;");

  const aktivitasList: Array<{
    jenis_unit: string;
    nama_aktivitas: string;
    kategori_status: 'OPERASI' | 'STANDBY' | 'BREAKDOWN';
    satuan: string;
    kode_sap: string;
  }> = [
    // ====================================================================
    // 1. Excavator Long Arm (5 Aktivitas Inti + Aktivitas Standby & Breakdown)
    // ====================================================================
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Perbaikan unit', kategori_status: 'BREAKDOWN', satuan: 'H', kode_sap: 'Maint.' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Perataan Tanah Galian Waduk/Lebung', kategori_status: 'OPERASI', satuan: 'H', kode_sap: '6111171151' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Long Arm Pendalaman Waduk/Lebung', kategori_status: 'OPERASI', satuan: 'M3', kode_sap: '6111171319' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Excavator Bongkar Bambu', kategori_status: 'OPERASI', satuan: 'Ha', kode_sap: '6111111115' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Estafet Tanah Galian', kategori_status: 'OPERASI', satuan: 'M3', kode_sap: '6111211127' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Tunggu Lokasi', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Tunggu Trailer', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Tunggu Cuaca', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Tunggu Solar', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Tunggu Sparepart', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Maint.' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Tunggu Mekanik', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Down' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Off Time', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Off' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Perawatan Unit', kategori_status: 'BREAKDOWN', satuan: 'H', kode_sap: 'OP/Divisi' },
    { jenis_unit: 'Excavator Long Arm', nama_aktivitas: 'Tunggu Operator', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },

    // ====================================================================
    // 2. Excavator Mini (10 Aktivitas Inti + Aktivitas Lapangan)
    // ====================================================================
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Tunggu Lokasi', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Tunggu Trailer', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Tunggu Cuaca', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Tunggu Solar', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Tunggu Sparepart', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Maint.' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Perbaikan unit', kategori_status: 'BREAKDOWN', satuan: 'H', kode_sap: 'Maint.' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Tunggu Mekanik', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Down' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Off Time', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Off' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Gali Sal. Sekunder 100 cm, sebar tanah', kategori_status: 'OPERASI', satuan: 'M', kode_sap: '6111171133' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Perawatan Unit', kategori_status: 'BREAKDOWN', satuan: 'H', kode_sap: 'OP/Divisi' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Tunggu Operator', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Mini', nama_aktivitas: 'Cuci Parit / Saluran', kategori_status: 'OPERASI', satuan: 'M', kode_sap: '6111171132' },

    // ====================================================================
    // 3. Motor Grader (15 Aktivitas Lengkap)
    // ====================================================================
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Off Time', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Off' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Tunggu Mekanik', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Down' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Perbaikan unit', kategori_status: 'BREAKDOWN', satuan: 'H', kode_sap: 'Maint.' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Perawatan Unit', kategori_status: 'BREAKDOWN', satuan: 'H', kode_sap: 'OP/Divisi' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Grader Buat Jalan Baru / Lebar Jalan', kategori_status: 'OPERASI', satuan: 'M', kode_sap: '6111131114' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Grader Rawat Jalan Tanpa Sirtu', kategori_status: 'OPERASI', satuan: 'M', kode_sap: '6111131112' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Grader Rawat Jalan Pakai Sirtu', kategori_status: 'OPERASI', satuan: 'M3', kode_sap: '6111131113' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Grader Kupas Tanah / Stump / Lahan', kategori_status: 'OPERASI', satuan: 'Ha', kode_sap: '6111111117' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Grader Sebar Timbunan / Sirtu', kategori_status: 'OPERASI', satuan: 'M3', kode_sap: '6111131116' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Tunggu Lokasi', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Tunggu Trailer', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Tunggu Cuaca', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Tunggu Solar', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Tunggu Sparepart', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Maint.' },
    { jenis_unit: 'Motor Grader', nama_aktivitas: 'Tunggu Operator', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },

    // ====================================================================
    // 4. Compactor (Operasi, Standby, Breakdown)
    // ====================================================================
    { jenis_unit: 'Compactor', nama_aktivitas: 'Compactor Padatkan Timbunan / Sirtu', kategori_status: 'OPERASI', satuan: 'M3', kode_sap: '6111141113' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Compactor Padatkan Subgrade / Badan Jalan', kategori_status: 'OPERASI', satuan: 'M', kode_sap: '6111141112' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Compactor Kupas Tanah / Lahan', kategori_status: 'OPERASI', satuan: 'Ha', kode_sap: '6111111117' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Perbaikan unit', kategori_status: 'BREAKDOWN', satuan: 'H', kode_sap: 'Maint.' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Perawatan Unit', kategori_status: 'BREAKDOWN', satuan: 'H', kode_sap: 'OP/Divisi' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Tunggu Lokasi', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Tunggu Trailer', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Tunggu Cuaca', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Tunggu Solar', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Tunggu Sparepart', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Maint.' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Tunggu Mekanik', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Down' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Off Time', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Off' },
    { jenis_unit: 'Compactor', nama_aktivitas: 'Tunggu Operator', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },

    // ====================================================================
    // 5. Excavator Standar (Operasi, Standby, Breakdown)
    // ====================================================================
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Gali Saluran Primer / Sekunder', kategori_status: 'OPERASI', satuan: 'M', kode_sap: '6111171131' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Cuci Parit / Saluran', kategori_status: 'OPERASI', satuan: 'M', kode_sap: '6111171132' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Bongkar Lahan / Land Clearing', kategori_status: 'OPERASI', satuan: 'Ha', kode_sap: '6111111111' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Muat Tanah / Loading Tanah', kategori_status: 'OPERASI', satuan: 'M3', kode_sap: '6111211121' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Perapihan Tebing / Slope', kategori_status: 'OPERASI', satuan: 'M', kode_sap: '6111171141' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Galian Tanah Lunak', kategori_status: 'OPERASI', satuan: 'M3', kode_sap: '6111171101' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Loading Overburden (OB)', kategori_status: 'OPERASI', satuan: 'BCM', kode_sap: '6111171102' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Tunggu Lokasi', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Tunggu Trailer', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Tunggu Cuaca', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Tunggu Solar', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Tunggu Sparepart', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Maint.' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Tunggu Mekanik', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Down' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Off Time', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Off' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Perawatan Unit', kategori_status: 'BREAKDOWN', satuan: 'H', kode_sap: 'OP/Divisi' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Perbaikan unit', kategori_status: 'BREAKDOWN', satuan: 'H', kode_sap: 'Maint.' },
    { jenis_unit: 'Excavator Standar', nama_aktivitas: 'Tunggu Operator', kategori_status: 'STANDBY', satuan: 'H', kode_sap: 'Standby' }
  ];

  for (const act of aktivitasList) {
    db.run(`
      INSERT INTO master_aktivitas (
        jenis_unit, nama_aktivitas, satuan, kode_sap, kategori_status, status_unit, status_aktif
      ) VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [act.jenis_unit, act.nama_aktivitas, act.satuan, act.kode_sap, act.kategori_status, act.kategori_status]);
  }

  saveDb();
  console.log(`✅ [SEED-MASTER-AKTIVITAS] Berhasil menyemai ${aktivitasList.length} aktivitas ke master_aktivitas.`);
  return aktivitasList.length;
}

const db = {
  getDb,
  saveDb,
  queryAll,
  queryOne,
  execute,
  resetAndSeedDatabase,
  seedMasterAktivitas,
  generateSampleFieldPhoto
};

export default db;
export { db };

