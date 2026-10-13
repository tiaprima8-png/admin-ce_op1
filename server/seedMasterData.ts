import { getDb, queryAll, execute, saveDb } from './db.ts';

// 1. Pemetaan Wilayah untuk masing-masing Kasie (8 Wilayah Kerja Baru)
export const KASIE_WILAYAH_MAP: Record<string, string> = {
  'Agung': 'Geodesi PG1',
  'Zainudin': 'Geodesi PG2',
  'Jaidi': 'Geodesi PG3',
  'Hisar': 'RC PG1',
  'Yono': 'RC PG2',
  'Nyoman': 'RC PG3',
  'Saipul': 'LEBUNG PG12',
  'Galung': 'LEBUNG PG3'
};

// 2. Daftar 50 Unit Master Alat Berat
export interface SeedUnitItem {
  kode_unit: string;
  jenis_unit: string;
  model_unit: string;
  penanggung_jawab: string;
  hm_terakhir: number;
  standar_hm_min: number;
  standar_hm_max: number;
  standar_hm_display: string;
}

export const SEED_UNITS: SeedUnitItem[] = [
  // 14 Unit Eksplisit dari Spesifikasi
  { kode_unit: 'HEH0013', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Long Arm', penanggung_jawab: 'Agung', hm_terakhir: 1, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0015', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Long Arm', penanggung_jawab: 'Agung', hm_terakhir: 2, standar_hm_min: 6.0, standar_hm_max: 10.1, standar_hm_display: '6.0 - 10.1 HM' },
  { kode_unit: 'HEH0016', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Long Arm', penanggung_jawab: 'Zainudin', hm_terakhir: 3, standar_hm_min: 6.0, standar_hm_max: 10.2, standar_hm_display: '6.0 - 10.2 HM' },
  { kode_unit: 'HEH0017', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Long Arm', penanggung_jawab: 'Zainudin', hm_terakhir: 4, standar_hm_min: 6.0, standar_hm_max: 10.3, standar_hm_display: '6.0 - 10.3 HM' },
  { kode_unit: 'HEH0018', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Long Arm', penanggung_jawab: 'Zainudin', hm_terakhir: 5, standar_hm_min: 6.0, standar_hm_max: 10.4, standar_hm_display: '6.0 - 10.4 HM' },
  { kode_unit: 'HEH0004', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Mini', penanggung_jawab: 'Agung', hm_terakhir: 6, standar_hm_min: 6.0, standar_hm_max: 10.5, standar_hm_display: '6.0 - 10.5 HM' },
  { kode_unit: 'HEH0005', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Mini', penanggung_jawab: 'Hisar', hm_terakhir: 7, standar_hm_min: 6.0, standar_hm_max: 10.6, standar_hm_display: '6.0 - 10.6 HM' },
  { kode_unit: 'HEH0006', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Mini', penanggung_jawab: 'Hisar', hm_terakhir: 8, standar_hm_min: 6.0, standar_hm_max: 10.7, standar_hm_display: '6.0 - 10.7 HM' },
  { kode_unit: 'MGC0001', jenis_unit: 'MOTOR GRADER', model_unit: 'Motor Grader', penanggung_jawab: 'Jaidi', hm_terakhir: 9, standar_hm_min: 6.0, standar_hm_max: 10.8, standar_hm_display: '6.0 - 10.8 HM' },
  { kode_unit: 'MGC0003', jenis_unit: 'MOTOR GRADER', model_unit: 'Motor Grader', penanggung_jawab: 'Jaidi', hm_terakhir: 10, standar_hm_min: 6.0, standar_hm_max: 10.9, standar_hm_display: '6.0 - 10.9 HM' },
  { kode_unit: 'MGC0004', jenis_unit: 'MOTOR GRADER', model_unit: 'Motor Grader', penanggung_jawab: 'Jaidi', hm_terakhir: 11, standar_hm_min: 6.0, standar_hm_max: 11.0, standar_hm_display: '6.0 - 11.0 HM' },
  { kode_unit: 'MGC0005', jenis_unit: 'MOTOR GRADER', model_unit: 'Motor Grader', penanggung_jawab: 'Hisar', hm_terakhir: 12, standar_hm_min: 6.0, standar_hm_max: 11.1, standar_hm_display: '6.0 - 11.1 HM' },
  { kode_unit: 'MGC0006', jenis_unit: 'MOTOR GRADER', model_unit: 'Motor Grader', penanggung_jawab: 'Hisar', hm_terakhir: 13, standar_hm_min: 6.0, standar_hm_max: 11.2, standar_hm_display: '6.0 - 11.2 HM' },
  { kode_unit: 'SCC0001', jenis_unit: 'COMPACTOR', model_unit: 'Compactor', penanggung_jawab: 'Agung', hm_terakhir: 14, standar_hm_min: 6.0, standar_hm_max: 11.3, standar_hm_display: '6.0 - 11.3 HM' },

  // Unit Excavator Standar Tambahan untuk Melengkapi 50 Unit (Agung, Zainudin, Jaidi, Hisar, Yono, Nyoman, Saipul, Galung)
  { kode_unit: 'HEH0019', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Yono', hm_terakhir: 15, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0020', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Yono', hm_terakhir: 16, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0021', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Yono', hm_terakhir: 17, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0022', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Nyoman', hm_terakhir: 18, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0023', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Nyoman', hm_terakhir: 19, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0024', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Nyoman', hm_terakhir: 20, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0025', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Saipul', hm_terakhir: 21, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0026', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Saipul', hm_terakhir: 22, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0027', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Galung', hm_terakhir: 23, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0028', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Galung', hm_terakhir: 24, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0029', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Agung', hm_terakhir: 25, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0030', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Agung', hm_terakhir: 26, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0031', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Zainudin', hm_terakhir: 27, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0032', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Zainudin', hm_terakhir: 28, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0033', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Jaidi', hm_terakhir: 29, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0034', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Jaidi', hm_terakhir: 30, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0035', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Hisar', hm_terakhir: 31, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0036', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Hisar', hm_terakhir: 32, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0037', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Yono', hm_terakhir: 33, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0038', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Nyoman', hm_terakhir: 34, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0039', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Saipul', hm_terakhir: 35, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'HEH0040', jenis_unit: 'EXCAVATOR', model_unit: 'Excavator Standar', penanggung_jawab: 'Galung', hm_terakhir: 36, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },

  // Compactor (3 Unit Tambahan: SCC0002, SCC0003, SCC0004)
  { kode_unit: 'SCC0002', jenis_unit: 'COMPACTOR', model_unit: 'Compactor', penanggung_jawab: 'Jaidi', hm_terakhir: 45, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'SCC0003', jenis_unit: 'COMPACTOR', model_unit: 'Compactor', penanggung_jawab: 'Hisar', hm_terakhir: 46, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' },
  { kode_unit: 'SCC0004', jenis_unit: 'COMPACTOR', model_unit: 'Compactor', penanggung_jawab: 'Nyoman', hm_terakhir: 47, standar_hm_min: 6.0, standar_hm_max: 10.0, standar_hm_display: '6.0 - 10.0 HM' }
];

// 3. Daftar 44 Operator Lengkap dari Spesifikasi
export interface SeedOperatorItem {
  nama_operator: string;
  nik: string;
  kasie: string;
}

export const SEED_OPERATORS: SeedOperatorItem[] = [
  // Di bawah Kasie Agung (Geodesi PG1)
  { nama_operator: 'Sudarwin', nik: '123456', kasie: 'Agung' },
  { nama_operator: 'Suyadi', nik: '123457', kasie: 'Agung' },
  { nama_operator: 'Farid', nik: '123458', kasie: 'Agung' },
  { nama_operator: 'Aldo', nik: '123459', kasie: 'Agung' },
  { nama_operator: 'Sofyan Bagus', nik: '123460', kasie: 'Agung' },

  // Di bawah Kasie Zainudin (Geodesi PG2)
  { nama_operator: 'Rendi', nik: '123461', kasie: 'Zainudin' },
  { nama_operator: 'Syaifurohman', nik: '123462', kasie: 'Zainudin' },
  { nama_operator: 'Tugiman', nik: '123463', kasie: 'Zainudin' },
  { nama_operator: 'Ilham Dwi', nik: '123464', kasie: 'Zainudin' },
  { nama_operator: 'Rizki', nik: '123465', kasie: 'Zainudin' },
  { nama_operator: 'Fernando', nik: '123466', kasie: 'Zainudin' },
  { nama_operator: 'S. Bejo', nik: '123467', kasie: 'Zainudin' },
  { nama_operator: 'Ronald', nik: '123468', kasie: 'Zainudin' },

  // Di bawah Kasie Jaidi (Geodesi PG3)
  { nama_operator: 'Somat', nik: '123469', kasie: 'Jaidi' },
  { nama_operator: 'Andri l.w', nik: '123470', kasie: 'Jaidi' },
  { nama_operator: 'Gunawan', nik: '123471', kasie: 'Jaidi' },
  { nama_operator: 'Jepri', nik: '123472', kasie: 'Jaidi' },
  { nama_operator: 'A. Taufik', nik: '123473', kasie: 'Jaidi' },
  { nama_operator: 'Asraf', nik: '123474', kasie: 'Jaidi' },
  { nama_operator: 'Rendi', nik: '123475', kasie: 'Jaidi' },

  // Di bawah Kasie Hisar (RC PG1)
  { nama_operator: 'Iwan S', nik: '123476', kasie: 'Hisar' },
  { nama_operator: 'Habibi', nik: '123477', kasie: 'Hisar' },
  { nama_operator: 'Dwi', nik: '123478', kasie: 'Hisar' },
  { nama_operator: 'Chandra', nik: '123479', kasie: 'Hisar' },
  { nama_operator: 'Agus', nik: '123480', kasie: 'Hisar' },
  { nama_operator: 'Bayu', nik: '123481', kasie: 'Hisar' },
  { nama_operator: 'Fajar', nik: '123482', kasie: 'Hisar' },
  { nama_operator: 'Bayu (2)', nik: '123483', kasie: 'Hisar' },

  // Di bawah Kasie Yono (RC PG2)
  { nama_operator: 'Aziz I.', nik: '123484', kasie: 'Yono' },
  { nama_operator: 'Gus Hamid', nik: '123485', kasie: 'Yono' },
  { nama_operator: 'Rio', nik: '123486', kasie: 'Yono' },
  { nama_operator: 'Suhardi', nik: '123487', kasie: 'Yono' },
  { nama_operator: 'A. Taufiq', nik: '123488', kasie: 'Yono' },

  // Di bawah Kasie Nyoman (RC PG3)
  { nama_operator: 'Simon', nik: '123489', kasie: 'Nyoman' },
  { nama_operator: 'Alex S.', nik: '123490', kasie: 'Nyoman' },
  { nama_operator: 'Subandi', nik: '123491', kasie: 'Nyoman' },
  { nama_operator: 'Ferdiyanto', nik: '123492', kasie: 'Nyoman' },

  // Di bawah Kasie Saipul (LEBUNG PG12)
  { nama_operator: 'Tridiyanto', nik: '123493', kasie: 'Saipul' },
  { nama_operator: 'Simon P.', nik: '123494', kasie: 'Saipul' },
  { nama_operator: 'Suranto', nik: '123495', kasie: 'Saipul' },

  // Di bawah Kasie Galung (LEBUNG PG3)
  { nama_operator: 'Sahroji', nik: '123496', kasie: 'Galung' },
  { nama_operator: 'Andi S.', nik: '123497', kasie: 'Galung' },
  { nama_operator: 'Sutriyono', nik: '123498', kasie: 'Galung' },
  { nama_operator: 'Sugiyono', nik: '123499', kasie: 'Galung' }
];

/**
 * Fungsi Seeding Master Unit dan Operator
 */
export async function seedUnitsAndOperators(): Promise<{
  unitCount: number;
  operatorCount: number;
}> {
  const db = await getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // 1. Kosongkan data lama units & operators agar bersih
  db.run('DELETE FROM units;');
  db.run('DELETE FROM operators;');

  // 2. Insert 50 Units
  for (const u of SEED_UNITS) {
    const wilayah = KASIE_WILAYAH_MAP[u.penanggung_jawab] || 'Geodesi PG1';
    db.run(`
      INSERT INTO units (
        kode_unit, jenis_unit, model_unit, nama_pengawas, kasie, wilayah,
        hm_unit_terakhir_diinputkan, hm_min_standar, hm_max_standar, status_aktif, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [
      u.kode_unit,
      u.jenis_unit,
      u.model_unit,
      u.penanggung_jawab,
      u.penanggung_jawab,
      wilayah,
      u.hm_terakhir,
      u.standar_hm_min,
      u.standar_hm_max,
      now
    ]);
  }

  // 3. Insert 44 Operators
  for (const op of SEED_OPERATORS) {
    const wilayah = KASIE_WILAYAH_MAP[op.kasie] || 'Geodesi PG1';
    db.run(`
      INSERT INTO operators (
        nama_operator, nik, nama_pengawas, kasie, wilayah, status_aktif
      ) VALUES (?, ?, ?, ?, ?, 1)
    `, [
      op.nama_operator,
      op.nik,
      op.kasie,
      op.kasie,
      wilayah
    ]);
  }

  saveDb();

  const countUnitsRes = db.exec("SELECT COUNT(*) as c FROM units;");
  const countOperatorsRes = db.exec("SELECT COUNT(*) as c FROM operators;");

  const unitCount = (countUnitsRes[0]?.values[0]?.[0] as number) || 0;
  const operatorCount = (countOperatorsRes[0]?.values[0]?.[0] as number) || 0;

  console.log(`✅ [SEEDING-COMPLETE] Berhasil menyemai ${unitCount} Unit dan ${operatorCount} Operator dengan relasi Kasie & Wilayah.`);

  return { unitCount, operatorCount };
}
