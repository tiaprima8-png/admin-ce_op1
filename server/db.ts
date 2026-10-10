import initSqlJs from 'sql.js';
import type { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const DB_FILE_PATH = path.resolve(process.cwd(), 'data', 'heavytrack.sqlite');

export interface UserRow {
  id: number;
  nama_lengkap: string;
  username: string;
  password?: string;
  hak_akses: 'Admin' | 'Pengawas';
}

export interface UnitRow {
  id: number;
  kode_unit: string;
  jenis_unit: string;
  model_unit: string;
  nama_pengawas: string;
  hm_unit_terakhir_diinputkan: number;
  hm_min_standar?: number | null;
  hm_max_standar?: number | null;
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
  jenis_unit: string;
  nama_aktivitas: string;
  satuan: string;
  kode_sap: string;
}

export interface OperatorRow {
  id: number;
  nama_operator: string;
  nik: string;
  nama_pengawas: string;
}

export interface LokasiRow {
  kode_lokasi: string;
  wilayah: string;
  luas_bruto: number;
  luas_netto: number;
  created_at: string;
}

export interface RencanaKerjaRow {
  id: string;
  nama_pengawas: string;
  tanggal: string;
  status_unit: 'OPERASI' | 'STANDBY' | 'BREAKDOWN';
  kode_unit: string;
  operator: string;
  kode_lokasi: string;
  shift_kerja: 'SIANG' | 'MALAM' | 'Siang' | 'Malam';
  nomor_spk?: string | null;
  status_spk: 'MENUNGGU_SPK' | 'SPK_TERBIT' | 'REALISASI_SELESAI';
  keterangan_rencana?: string | null;
  is_realized?: boolean;
  realisasi_count?: number;
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
  client_transaction_id?: string | null;
  rencana_id?: string | null;
  nama_pengawas: string;
  tanggal: string;
  kode_unit: string;
  nama_aktivitas: string;
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
  kendala_list?: string | null;
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
    fs.writeFileSync(DB_FILE_PATH, buffer);
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
      hak_akses TEXT NOT NULL
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
      client_transaction_id TEXT UNIQUE,
      rencana_id TEXT DEFAULT NULL,
      jenis_unit TEXT NOT NULL,
      nama_aktivitas TEXT NOT NULL,
      satuan TEXT NOT NULL,
      kode_sap TEXT NOT NULL,
      is_hm_awal_corrected INTEGER DEFAULT 0,
      alasan_koreksi_hm TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_operator TEXT NOT NULL,
      nik TEXT NOT NULL UNIQUE,
      nama_pengawas TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lokasi (
      kode_lokasi TEXT PRIMARY KEY,
      wilayah TEXT NOT NULL,
      luas_bruto REAL NOT NULL DEFAULT 0.00,
      luas_netto REAL NOT NULL DEFAULT 0.00,
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
      kendala_list TEXT,
      is_hm_awal_corrected INTEGER DEFAULT 0,
      alasan_koreksi_hm TEXT DEFAULT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_unit_tgl ON hasil_input_aktivitas(kode_unit, tanggal DESC);
    CREATE INDEX IF NOT EXISTS idx_pengawas_tgl ON hasil_input_aktivitas(nama_pengawas, tanggal DESC);

    CREATE TABLE IF NOT EXISTS aktivitas_kendala (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_aktivitas INTEGER,
      id_kendala TEXT,
      nama_kendala TEXT,
      waktu_mulai TEXT,
      waktu_selesai TEXT,
      durasi_menit INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
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
      console.log('Added client_transaction_id column to hasil_input_aktivitas');
    }
    try {
      db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_hia_client_tx ON hasil_input_aktivitas(client_transaction_id);");
    } catch (idxErr) {
      console.warn('Index on client_transaction_id already exists or ignored:', idxErr);
    }

    // Migration for aktivitas_unit table
    const actInfo = db.exec("PRAGMA table_info(aktivitas_unit)");
    const actCols = actInfo[0]?.values.map(v => v[1]);
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
    if (actCols && !actCols.includes('rencana_id')) {
      db.run("ALTER TABLE aktivitas_unit ADD COLUMN rencana_id TEXT DEFAULT NULL;");
      console.log('Added rencana_id column to aktivitas_unit');
    }
    try {
      db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_au_client_tx ON aktivitas_unit(client_transaction_id);");
      console.log('Enforced unique index idx_au_client_tx on aktivitas_unit(client_transaction_id)');
    } catch (idxErr) {
      console.warn('Index on aktivitas_unit.client_transaction_id:', idxErr);
    }

    // Migration for rencana_kerja table (updated_at column)
    const rkInfo = db.exec("PRAGMA table_info(rencana_kerja)");
    const rkCols = rkInfo[0]?.values.map(v => v[1]);
    if (rkCols && !rkCols.includes('updated_at')) {
      db.run("ALTER TABLE rencana_kerja ADD COLUMN updated_at TEXT DEFAULT NULL;");
      db.run("UPDATE rencana_kerja SET updated_at = created_at WHERE updated_at IS NULL;");
      console.log('Added updated_at column to rencana_kerja');
    }

    // Ensure aktivitas_kendala table exists
    db.run(`
      CREATE TABLE IF NOT EXISTS aktivitas_kendala (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_aktivitas INTEGER,
        id_kendala TEXT,
        nama_kendala TEXT,
        waktu_mulai TEXT,
        waktu_selesai TEXT,
        durasi_menit INTEGER,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_ak_aktivitas ON aktivitas_kendala(id_aktivitas);
    `);

    // Migration for aktivitas_kendala table columns if missing
    try {
      const akInfo = db.exec("PRAGMA table_info(aktivitas_kendala)");
      const akCols = akInfo[0]?.values.map(v => v[1]);
      if (akCols) {
        if (!akCols.includes('id_kendala')) {
          db.run("ALTER TABLE aktivitas_kendala ADD COLUMN id_kendala TEXT;");
        }
        if (!akCols.includes('nama_kendala')) {
          db.run("ALTER TABLE aktivitas_kendala ADD COLUMN nama_kendala TEXT;");
        }
        if (!akCols.includes('waktu_mulai')) {
          db.run("ALTER TABLE aktivitas_kendala ADD COLUMN waktu_mulai TEXT;");
        }
        if (!akCols.includes('waktu_selesai')) {
          db.run("ALTER TABLE aktivitas_kendala ADD COLUMN waktu_selesai TEXT;");
        }
        if (!akCols.includes('durasi_menit')) {
          db.run("ALTER TABLE aktivitas_kendala ADD COLUMN durasi_menit INTEGER;");
        }
      }
    } catch (akMigErr) {
      console.warn('Migration note for aktivitas_kendala columns:', akMigErr);
    }

    // Migration for units table (hm_min_standar & hm_max_standar override)
    const unitsInfo = db.exec("PRAGMA table_info(units)");
    const unitsCols = unitsInfo[0]?.values.map(v => v[1]);
    if (unitsCols && !unitsCols.includes('hm_min_standar')) {
      db.run("ALTER TABLE units ADD COLUMN hm_min_standar REAL DEFAULT NULL;");
      console.log('Added hm_min_standar column to units');
    }
    if (unitsCols && !unitsCols.includes('hm_max_standar')) {
      db.run("ALTER TABLE units ADD COLUMN hm_max_standar REAL DEFAULT NULL;");
      console.log('Added hm_max_standar column to units');
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

  // Check if users seeded
  const res = db.exec("SELECT COUNT(*) as cnt FROM users");
  const userCount = res[0]?.values[0]?.[0] as number || 0;

  if (userCount === 0) {
    // Seed Users
    db.run(`
      INSERT INTO users (nama_lengkap, username, password, hak_akses) VALUES
      ('Farid Hadi', 'admin', 'admin123', 'Admin'),
      ('Budi Santoso', 'budi.santoso', 'budi123', 'Pengawas'),
      ('Agus Wijaya', 'agus.wijaya', 'agus123', 'Pengawas'),
      ('Rudi Hermawan', 'rudi.h', 'rudi123', 'Pengawas');
    `);

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

    // Seed Aktivitas (Tanpa Kategori)
    db.run(`
      INSERT INTO aktivitas_unit (jenis_unit, nama_aktivitas, satuan, kode_sap) VALUES
      ('EXCAVATOR', 'Galian Tanah Lunak', 'm3', 'ACT-SAP-101'),
      ('EXCAVATOR', 'Loading Overburden (OB)', 'BCM', 'ACT-SAP-102'),
      ('EXCAVATOR', 'Pembuatan Saluran Air (Ditch)', 'm', 'ACT-SAP-103'),
      ('BULLDOZER', 'Clearing & Grubbing Lahan', 'm2', 'ACT-SAP-104'),
      ('BULLDOZER', 'Dozing & Ripping OB', 'm3', 'ACT-SAP-105'),
      ('BULLDOZER', 'Perawatan Disposal Area', 'jam', 'ACT-SAP-106'),
      ('DUMP TRUCK', 'Hauling Overburden ke Disposal', 'rit', 'ACT-SAP-107'),
      ('DUMP TRUCK', 'Hauling Ore / Batubara ke Stockpile', 'ton', 'ACT-SAP-108'),
      ('MOTOR GRADER', 'Perawatan Jalan Tambang (Grading)', 'km', 'ACT-SAP-109'),
      ('WATER TRUCK', 'Penyiraman Jalan Berdebu', 'tangki', 'ACT-SAP-110');
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
  } else {
    // Backfill status_unit & solar for existing records if default or empty
    try {
      db.run("UPDATE hasil_input_aktivitas SET status_unit = 'OPERASI' WHERE status_unit IS NULL OR status_unit = ''");
      db.run("UPDATE hasil_input_aktivitas SET is_isi_solar = 1, jumlah_liter_solar = 185.0 WHERE kode_unit = 'HEH1' AND (jumlah_liter_solar IS NULL OR jumlah_liter_solar = 0)");
      db.run("UPDATE hasil_input_aktivitas SET is_isi_solar = 1, jumlah_liter_solar = 140.0 WHERE kode_unit = 'DZ-01' AND (jumlah_liter_solar IS NULL OR jumlah_liter_solar = 0)");
      db.run("UPDATE hasil_input_aktivitas SET is_isi_solar = 1, jumlah_liter_solar = 120.0 WHERE kode_unit = 'DT-102' AND (jumlah_liter_solar IS NULL OR jumlah_liter_solar = 0)");
      db.run("UPDATE hasil_input_aktivitas SET is_isi_solar = 1, jumlah_liter_solar = 150.0 WHERE kode_unit = 'DT-101' AND (jumlah_liter_solar IS NULL OR jumlah_liter_solar = 0)");
      db.run("UPDATE hasil_input_aktivitas SET is_isi_solar = 1, jumlah_liter_solar = 110.0 WHERE kode_unit = 'DZ-02' AND (jumlah_liter_solar IS NULL OR jumlah_liter_solar = 0)");
      db.run("UPDATE hasil_input_aktivitas SET status_unit = 'STANDBY', is_isi_solar = 0, jumlah_liter_solar = 0.0 WHERE kode_unit = 'GD-01'");
    } catch (e) {
      console.warn('Could not backfill solar & status:', e);
    }
    // Populate photos for existing seed rows that have foto_bukti IS NULL
    const checkPhotos = db.exec("SELECT COUNT(*) FROM hasil_input_aktivitas WHERE foto_bukti IS NOT NULL");
    const photoCount = checkPhotos[0]?.values[0]?.[0] as number || 0;
    if (photoCount === 0) {
      const today = new Date().toISOString().slice(0, 10);
      const photo1 = generateSampleFieldPhoto('HEH1', 'Loading Overburden (OB)', 'Pit Utara Blok C', 'Budi Santoso', today);
      const photo2 = generateSampleFieldPhoto('DZ-01', 'Clearing & Grubbing Lahan', 'Front Loading 3', 'Budi Santoso', today);
      const photo3 = generateSampleFieldPhoto('DT-102', 'Hauling Overburden ke Disposal', 'Disposal Barat', 'Agus Wijaya', today);
      const photo4 = generateSampleFieldPhoto('EX-301', 'Galian Tanah Lunak', 'Pit Selatan ROM 1', 'Agus Wijaya', today);

      try {
        db.run("UPDATE hasil_input_aktivitas SET foto_bukti = ? WHERE kode_unit = 'HEH1'", [photo1]);
        db.run("UPDATE hasil_input_aktivitas SET foto_bukti = ? WHERE kode_unit = 'DZ-01'", [photo2]);
        db.run("UPDATE hasil_input_aktivitas SET foto_bukti = ? WHERE kode_unit = 'DT-102'", [photo3]);
        db.run("UPDATE hasil_input_aktivitas SET foto_bukti = ? WHERE kode_unit = 'EX-301'", [photo4]);
      } catch (e) {
        console.warn('Could not backfill sample photos:', e);
      }
    }
  }

  // Check if lokasi seeded
  const resLok = db.exec("SELECT COUNT(*) as cnt FROM lokasi");
  const lokCount = (resLok[0]?.values[0]?.[0] as number) || 0;
  if (lokCount === 0) {
    db.run(`
      INSERT OR IGNORE INTO lokasi (kode_lokasi, wilayah, luas_bruto, luas_netto, created_at) VALUES
      ('001A', 'PG1', 12.50, 10.80, '2026-10-01 08:00:00'),
      ('002B', 'PG1', 15.00, 13.20, '2026-10-01 08:00:00'),
      ('003A', 'PG2', 8.40, 7.50, '2026-10-01 08:00:00'),
      ('004C', 'PG2', 22.00, 19.40, '2026-10-01 08:00:00'),
      ('100A', 'PG3', 30.50, 27.00, '2026-10-01 08:00:00'),
      ('101B', 'PG3', 18.20, 16.00, '2026-10-01 08:00:00');
    `);
    console.log('Seeded master lokasi.');
  }

  // Check if rencana_kerja seeded
  const resRk = db.exec("SELECT COUNT(*) as cnt FROM rencana_kerja");
  const rkCount = (resRk[0]?.values[0]?.[0] as number) || 0;
  if (rkCount === 0) {
    const today = new Date().toISOString().slice(0, 10);
    db.run(`
      INSERT OR IGNORE INTO rencana_kerja (id, nama_pengawas, tanggal, status_unit, kode_unit, operator, kode_lokasi, shift_kerja, nomor_spk, status_spk, keterangan_rencana, created_at) VALUES
      ('RK-2026-001', 'Budi Santoso', '${today}', 'OPERASI', 'HEH1', 'Hendri Kurniawan', '001A', 'SIANG', NULL, 'MENUNGGU_SPK', 'Overburden stripping pit utara blok C', '${today} 06:30:00'),
      ('RK-2026-002', 'Budi Santoso', '${today}', 'OPERASI', 'DZ-01', 'Bambang Irawan', '002B', 'SIANG', 'SPK-2026-X101', 'SPK_TERBIT', 'Clearing dan land leveling area front 3', '${today} 06:45:00'),
      ('RK-2026-003', 'Agus Wijaya', '${today}', 'OPERASI', 'DT-102', 'Dedi Prasetyo', '003A', 'SIANG', 'SPK-2026-X102', 'REALISASI_SELESAI', 'Hauling overburden ke disposal barat', '${today} 07:00:00'),
      ('RK-2026-004', 'Agus Wijaya', '${today}', 'STANDBY', 'EX-301', 'Supriyanto', '004C', 'SIANG', NULL, 'MENUNGGU_SPK', 'Standby perapihan bench dan inspeksi', '${today} 07:15:00'),
      ('RK-2026-005', 'Rudi Hermawan', '${today}', 'OPERASI', 'GD-01', 'Ahmad Zaki', '100A', 'SIANG', 'SPK-2026-X103', 'SPK_TERBIT', 'Grading main haul road km 2-6', '${today} 07:30:00');
    `);
    console.log('Seeded rencana_kerja.');
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
      { nama_kendala: 'Tunggu Solar', waktu_mulai: '08:30', waktu_selesai: '10:00', durasi_menit: 90 },
      { nama_kendala: 'Perbaikan Implement', waktu_mulai: '13:15', waktu_selesai: '14:00', durasi_menit: 45 }
    ]);
    const sampleKendalaGD01 = JSON.stringify([
      { nama_kendala: 'Tunggu Cuaca', waktu_mulai: '07:00', waktu_selesai: '09:30', durasi_menit: 150 }
    ]);
    const sampleKendalaHEH1 = JSON.stringify([
      { nama_kendala: 'Cek unit, Implement Pemanasan mesin', waktu_mulai: '06:30', waktu_selesai: '07:00', durasi_menit: 30 }
    ]);

    db.run("UPDATE hasil_input_aktivitas SET kendala_list = ? WHERE kode_unit = 'DZ-02' AND (kendala_list IS NULL OR kendala_list = '')", [sampleKendalaDZ02]);
    db.run("UPDATE hasil_input_aktivitas SET kendala_list = ? WHERE kode_unit = 'GD-01' AND (kendala_list IS NULL OR kendala_list = '')", [sampleKendalaGD01]);
    db.run("UPDATE hasil_input_aktivitas SET kendala_list = ? WHERE kode_unit = 'HEH1' AND (kendala_list IS NULL OR kendala_list = '')", [sampleKendalaHEH1]);

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

const db = {
  getDb,
  saveDb,
  queryAll,
  queryOne,
  execute,
  generateSampleFieldPhoto
};

export default db;
export { db };
