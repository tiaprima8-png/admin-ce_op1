import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import {
  getDb,
  queryAll,
  queryOne,
  execute,
  saveDb,
  HasilInputAktivitasRow,
  UnitRow,
  AktivitasUnitRow,
  OperatorRow,
  UserRow
} from './server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Multer memory storage configuration for multipart/form-data photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

async function startServer() {
  // Initialize Database
  await getDb();
  console.log('✅ SQLite Database initialized successfully.');

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const server = http.createServer(app);

  // Initialize WebSocket Server
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    console.log(`📡 WebSocket Client connected. Total clients: ${clients.size}`);

    // Send welcome packet with current server time
    ws.send(JSON.stringify({
      event: 'CONNECTED',
      message: 'Tersambung ke WebSocket HeavyTrack Enterprise Server',
      timestamp: new Date().toISOString(),
      activeClients: clients.size
    }));

    ws.on('message', (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch (e) {
        // Ignore non-json ping
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`🔌 WebSocket Client disconnected. Total clients: ${clients.size}`);
    });
  });

  // Broadcast function
  function broadcast(data: Record<string, unknown>) {
    const payload = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  // --- REST API ENDPOINTS ---

  // Health check & Server Status
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'HeavyTrack Enterprise Portal API',
      wsClients: clients.size,
      uptime: process.uptime()
    });
  });

  // 1. GET /api/master-data?pengawas=:nama
  // Bundle master data (units, aktivitas, operators) filtered by supervisor for Android offline sync
  app.get('/api/master-data', (req: Request, res: Response) => {
    try {
      const pengawas = (req.query.pengawas as string | undefined)?.trim();

      let units: UnitRow[];
      let operators: OperatorRow[];
      let aktivitas: AktivitasUnitRow[];

      if (pengawas && pengawas !== 'Semua') {
        units = queryAll<UnitRow>('SELECT * FROM units WHERE nama_pengawas = ? ORDER BY kode_unit ASC', [pengawas]);
        operators = queryAll<OperatorRow>('SELECT * FROM operators WHERE nama_pengawas = ? ORDER BY nama_operator ASC', [pengawas]);
        aktivitas = queryAll<AktivitasUnitRow>('SELECT * FROM aktivitas_unit ORDER BY jenis_unit ASC, nama_aktivitas ASC');
      } else {
        units = queryAll<UnitRow>('SELECT * FROM units ORDER BY kode_unit ASC');
        operators = queryAll<OperatorRow>('SELECT * FROM operators ORDER BY nama_operator ASC');
        aktivitas = queryAll<AktivitasUnitRow>('SELECT * FROM aktivitas_unit ORDER BY jenis_unit ASC, nama_aktivitas ASC');
      }

      res.json({
        status: 'success',
        synced_at: new Date().toISOString(),
        pengawas_filter: pengawas || 'Semua',
        total_units: units.length,
        total_operators: operators.length,
        total_aktivitas: aktivitas.length,
        data: {
          units,
          aktivitas,
          operators
        }
      });
    } catch (err: unknown) {
      console.error('Error fetching master data:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 2. POST /api/aktivitas-unit
  // Atomic transaction from Android app or manual dashboard entry (supports Base64 JSON & multipart/form-data)
  app.post('/api/aktivitas-unit', upload.single('foto_bukti'), (req: Request, res: Response) => {
    try {
      const {
        nama_pengawas,
        tanggal,
        kode_unit,
        nama_aktivitas,
        kode_sap,
        satuan,
        operator,
        nik_operator,
        lokasi,
        shift_kerja,
        jam_kerja,
        hm_awal,
        hm_akhir,
        hm_harian_berjalan,
        hasil_kerja,
        keterangan,
        status_unit: rawStatusUnit,
        is_isi_solar: rawIsIsiSolar,
        jumlah_liter_solar: rawJumlahLiterSolar
      } = req.body;

      // Extract foto_bukti either from multipart/form-data file upload or Base64 JSON string
      let foto_bukti = req.body.foto_bukti || null;
      if (req.file) {
        foto_bukti = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      if (!nama_pengawas || !kode_unit || !nama_aktivitas || hm_awal === undefined || hm_akhir === undefined) {
        return res.status(400).json({
          error: 'Field wajib tidak lengkap: nama_pengawas, kode_unit, nama_aktivitas, hm_awal, dan hm_akhir diperlukan.'
        });
      }

      const numHmAwal = parseFloat(hm_awal) || 0;
      const numHmAkhir = parseFloat(hm_akhir) || 0;
      const calculatedHmBerjalan = hm_harian_berjalan !== undefined 
        ? parseFloat(hm_harian_berjalan) 
        : Math.round((numHmAkhir - numHmAwal) * 10) / 10;
      const numJamKerja = parseFloat(jam_kerja) || 0;
      const numHasilKerja = parseFloat(hasil_kerja) || 0;
      const currentDate = tanggal || new Date().toISOString().slice(0, 10);
      const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

      // Status Unit & Solar handling
      const statusUnitStr = (rawStatusUnit || 'OPERASI').toUpperCase();
      const status_unit = ['OPERASI', 'STANDBY', 'BREAKDOWN'].includes(statusUnitStr) ? statusUnitStr : 'OPERASI';
      const is_isi_solar = (rawIsIsiSolar === true || rawIsIsiSolar === 1 || rawIsIsiSolar === '1' || rawIsIsiSolar === 'true') ? 1 : 0;
      const jumlah_liter_solar = is_isi_solar === 1 ? (parseFloat(rawJumlahLiterSolar) || 0) : 0;

      // 1. Simpan baris baru ke tabel hasil_input_aktivitas (tanpa kategori)
      const insertSql = `
        INSERT INTO hasil_input_aktivitas (
          nama_pengawas, tanggal, kode_unit, nama_aktivitas, kode_sap, satuan,
          operator, nik_operator, lokasi, shift_kerja, jam_kerja, hm_awal, hm_akhir,
          hm_harian_berjalan, hasil_kerja, keterangan, foto_bukti,
          status_unit, is_isi_solar, jumlah_liter_solar, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const insertResult = execute(insertSql, [
        nama_pengawas,
        currentDate,
        kode_unit,
        nama_aktivitas,
        kode_sap || 'ACT-SAP-101',
        satuan || 'm3',
        operator || 'Operator Default',
        nik_operator || 'NIK-00000',
        lokasi || 'Pit Operasional',
        shift_kerja || 'Siang',
        numJamKerja,
        numHmAwal,
        numHmAkhir,
        calculatedHmBerjalan,
        numHasilKerja,
        keterangan || '',
        foto_bukti,
        status_unit,
        is_isi_solar,
        jumlah_liter_solar,
        createdAt
      ]);

      const newRowId = insertResult.lastInsertRowId;

      // 2. Update kolom hm_unit_terakhir_diinputkan di tabel units menjadi hm_akhir yang baru
      const updateUnitSql = `
        UPDATE units 
        SET hm_unit_terakhir_diinputkan = ?, updated_at = ? 
        WHERE kode_unit = ?
      `;
      execute(updateUnitSql, [numHmAkhir, createdAt, kode_unit]);

      // Ambil row lengkap yang baru tersimpan (termasuk foto_bukti)
      const newRow = queryOne<HasilInputAktivitasRow>(
        'SELECT * FROM hasil_input_aktivitas WHERE id = ?',
        [newRowId]
      );

      // 3. Broadcast event 'NEW_ACTIVITY' via WebSocket ke seluruh klien Web Admin aktif beserta payload foto_bukti
      broadcast({
        event: 'NEW_ACTIVITY',
        message: `Laporan baru diterima dari ${nama_pengawas} (Unit ${kode_unit})`,
        data: newRow,
        timestamp: new Date().toISOString()
      });

      console.log(`✨ [TRANS-OK] Laporan baru #${newRowId} tersimpan (foto_bukti: ${foto_bukti ? 'ada' : 'tidak'}) & dibroadcast via WebSocket`);

      return res.status(201).json({
        status: 'success',
        message: 'Laporan aktivitas unit berhasil disimpan & disinkronisasi.',
        data: newRow
      });
    } catch (err: unknown) {
      console.error('Error saving aktivitas unit:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3. GET /api/rekapitulasi
  // Filterable table data
  app.get('/api/rekapitulasi', (req: Request, res: Response) => {
    try {
      const { search, pengawas, unit, shift, status, startDate, endDate } = req.query;

      let sql = 'SELECT * FROM hasil_input_aktivitas WHERE 1=1';
      const params: (string | number)[] = [];

      if (search && typeof search === 'string' && search.trim() !== '') {
        const s = `%${search.trim()}%`;
        sql += ` AND (nama_pengawas LIKE ? OR kode_unit LIKE ? OR kode_sap LIKE ? OR operator LIKE ? OR nama_aktivitas LIKE ? OR lokasi LIKE ?)`;
        params.push(s, s, s, s, s, s);
      }

      if (pengawas && typeof pengawas === 'string' && pengawas !== 'Semua') {
        sql += ' AND nama_pengawas = ?';
        params.push(pengawas);
      }

      if (unit && typeof unit === 'string' && unit !== 'Semua') {
        sql += ' AND kode_unit = ?';
        params.push(unit);
      }

      if (shift && typeof shift === 'string' && shift !== 'Semua') {
        sql += ' AND shift_kerja = ?';
        params.push(shift);
      }

      if (status && typeof status === 'string' && status !== 'Semua') {
        sql += ' AND status_unit = ?';
        params.push(status);
      }

      if (startDate && typeof startDate === 'string') {
        sql += ' AND tanggal >= ?';
        params.push(startDate);
      }

      if (endDate && typeof endDate === 'string') {
        sql += ' AND tanggal <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY id DESC';

      const rows = queryAll<HasilInputAktivitasRow>(sql, params);
      res.json({
        status: 'success',
        total: rows.length,
        data: rows
      });
    } catch (err: unknown) {
      console.error('Error fetching rekapitulasi:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PUT /api/rekapitulasi/:id
  app.put('/api/rekapitulasi/:id', upload.single('foto_bukti'), (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const {
        nama_pengawas,
        tanggal,
        kode_unit,
        nama_aktivitas,
        kode_sap,
        satuan,
        operator,
        nik_operator,
        lokasi,
        shift_kerja,
        jam_kerja,
        hm_awal,
        hm_akhir,
        hm_harian_berjalan,
        hasil_kerja,
        keterangan,
        status_unit: rawStatusUnit,
        is_isi_solar: rawIsIsiSolar,
        jumlah_liter_solar: rawJumlahLiterSolar
      } = req.body;

      const numHmAwal = parseFloat(hm_awal) || 0;
      const numHmAkhir = parseFloat(hm_akhir) || 0;
      const calculatedHmBerjalan = hm_harian_berjalan !== undefined
        ? parseFloat(hm_harian_berjalan)
        : Math.round((numHmAkhir - numHmAwal) * 10) / 10;

      // Status Unit & Solar handling
      const statusUnitStr = (rawStatusUnit || 'OPERASI').toUpperCase();
      const status_unit = ['OPERASI', 'STANDBY', 'BREAKDOWN'].includes(statusUnitStr) ? statusUnitStr : 'OPERASI';
      const is_isi_solar = (rawIsIsiSolar === true || rawIsIsiSolar === 1 || rawIsIsiSolar === '1' || rawIsIsiSolar === 'true') ? 1 : 0;
      const jumlah_liter_solar = is_isi_solar === 1 ? (parseFloat(rawJumlahLiterSolar) || 0) : 0;

      // Check if new photo was uploaded or passed in body
      let foto_bukti = req.body.foto_bukti;
      if (req.file) {
        foto_bukti = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      // If foto_bukti is undefined, keep existing foto_bukti in DB
      let sql: string;
      let params: (string | number | null)[];

      if (foto_bukti !== undefined) {
        sql = `
          UPDATE hasil_input_aktivitas SET
            nama_pengawas = ?, tanggal = ?, kode_unit = ?, nama_aktivitas = ?,
            kode_sap = ?, satuan = ?, operator = ?, nik_operator = ?, lokasi = ?,
            shift_kerja = ?, jam_kerja = ?, hm_awal = ?, hm_akhir = ?, hm_harian_berjalan = ?,
            hasil_kerja = ?, keterangan = ?, foto_bukti = ?,
            status_unit = ?, is_isi_solar = ?, jumlah_liter_solar = ?
          WHERE id = ?
        `;
        params = [
          nama_pengawas,
          tanggal,
          kode_unit,
          nama_aktivitas,
          kode_sap,
          satuan,
          operator,
          nik_operator,
          lokasi,
          shift_kerja,
          parseFloat(jam_kerja) || 0,
          numHmAwal,
          numHmAkhir,
          calculatedHmBerjalan,
          parseFloat(hasil_kerja) || 0,
          keterangan || '',
          foto_bukti || null,
          status_unit,
          is_isi_solar,
          jumlah_liter_solar,
          id
        ];
      } else {
        sql = `
          UPDATE hasil_input_aktivitas SET
            nama_pengawas = ?, tanggal = ?, kode_unit = ?, nama_aktivitas = ?,
            kode_sap = ?, satuan = ?, operator = ?, nik_operator = ?, lokasi = ?,
            shift_kerja = ?, jam_kerja = ?, hm_awal = ?, hm_akhir = ?, hm_harian_berjalan = ?,
            hasil_kerja = ?, keterangan = ?,
            status_unit = ?, is_isi_solar = ?, jumlah_liter_solar = ?
          WHERE id = ?
        `;
        params = [
          nama_pengawas,
          tanggal,
          kode_unit,
          nama_aktivitas,
          kode_sap,
          satuan,
          operator,
          nik_operator,
          lokasi,
          shift_kerja,
          parseFloat(jam_kerja) || 0,
          numHmAwal,
          numHmAkhir,
          calculatedHmBerjalan,
          parseFloat(hasil_kerja) || 0,
          keterangan || '',
          status_unit,
          is_isi_solar,
          jumlah_liter_solar,
          id
        ];
      }

      execute(sql, params);

      const updatedRow = queryOne<HasilInputAktivitasRow>(
        'SELECT * FROM hasil_input_aktivitas WHERE id = ?',
        [id]
      );

      broadcast({
        event: 'UPDATE_ACTIVITY',
        data: updatedRow,
        timestamp: new Date().toISOString()
      });

      res.json({ status: 'success', data: updatedRow });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // DELETE /api/rekapitulasi/:id
  app.delete('/api/rekapitulasi/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      execute('DELETE FROM hasil_input_aktivitas WHERE id = ?', [id]);

      broadcast({
        event: 'DELETE_ACTIVITY',
        id,
        timestamp: new Date().toISOString()
      });

      res.json({ status: 'success', message: 'Data aktivitas berhasil dihapus' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 4. KPI STATS ENDPOINT
  app.get('/api/stats', (req: Request, res: Response) => {
    try {
      const rows = queryAll<HasilInputAktivitasRow>('SELECT * FROM hasil_input_aktivitas');
      
      let totalHmBerjalan = 0;
      let totalJamKerja = 0;
      let totalSolarTerpakai = 0;
      const unitSet = new Set<string>();
      let shiftSiangCount = 0;
      let shiftMalamCount = 0;

      rows.forEach((r) => {
        totalHmBerjalan += r.hm_harian_berjalan || 0;
        totalJamKerja += r.jam_kerja || 0;
        totalSolarTerpakai += r.jumlah_liter_solar || 0;
        if (r.kode_unit) unitSet.add(r.kode_unit);
        if (r.shift_kerja === 'Siang') shiftSiangCount++;
        else if (r.shift_kerja === 'Malam') shiftMalamCount++;
      });

      res.json({
        totalHmBerjalan: Math.round(totalHmBerjalan * 10) / 10,
        totalJamKerja: Math.round(totalJamKerja * 10) / 10,
        unitBeroperasi: unitSet.size,
        totalLaporanMasuk: rows.length,
        shiftSiangCount,
        shiftMalamCount,
        totalSolarTerpakai: Math.round(totalSolarTerpakai * 10) / 10
      });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 4B. ANALYTICS & SUMMARY AGGREGATION ENDPOINT
  // Fast SQL Queries with GROUP BY (kode_unit, nama_aktivitas, status_unit)
  app.get('/api/analytics', (req: Request, res: Response) => {
    try {
      const { startDate, endDate, pengawas, unit } = req.query;
      let whereClause = ' WHERE 1=1';
      const params: (string | number)[] = [];

      if (startDate && typeof startDate === 'string') {
        whereClause += ' AND h.tanggal >= ?';
        params.push(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        whereClause += ' AND h.tanggal <= ?';
        params.push(endDate);
      }
      if (pengawas && typeof pengawas === 'string' && pengawas !== 'Semua') {
        whereClause += ' AND h.nama_pengawas = ?';
        params.push(pengawas);
      }
      if (unit && typeof unit === 'string' && unit !== 'Semua') {
        whereClause += ' AND h.kode_unit = ?';
        params.push(unit);
      }

      // 1. Aggregation per Unit (Panel Rangkuman Per Unit)
      const unitSql = `
        SELECT 
          h.kode_unit,
          COALESCE(u.model_unit, 'Fleet Model') as model_unit,
          COALESCE(u.nama_pengawas, h.nama_pengawas) as nama_pengawas,
          ROUND(SUM(h.jam_kerja), 1) as total_jam_kerja,
          ROUND(SUM(h.hm_harian_berjalan), 1) as total_hm,
          ROUND(SUM(h.jumlah_liter_solar), 1) as total_solar,
          ROUND(SUM(h.hasil_kerja), 1) as total_volume,
          SUM(CASE WHEN h.status_unit IN ('BREAKDOWN', 'STANDBY') THEN 1 ELSE 0 END) as freq_breakdown_standby
        FROM hasil_input_aktivitas h
        LEFT JOIN units u ON h.kode_unit = u.kode_unit
        ${whereClause}
        GROUP BY h.kode_unit
        ORDER BY total_hm DESC
      `;
      const rawUnitData = queryAll<Record<string, unknown>>(unitSql, params);
      const unitData = rawUnitData.map(r => {
        const totalHm = Number(r.total_hm || 0);
        const totalSolar = Number(r.total_solar || 0);
        return {
          kode_unit: String(r.kode_unit || ''),
          model_unit: String(r.model_unit || '-'),
          nama_pengawas: String(r.nama_pengawas || '-'),
          total_jam_kerja: Number(r.total_jam_kerja || 0),
          total_hm: totalHm,
          total_solar: totalSolar,
          rasio_efisiensi: totalHm > 0 ? Math.round((totalSolar / totalHm) * 100) / 100 : 0,
          freq_breakdown_standby: Number(r.freq_breakdown_standby || 0),
          total_volume: Number(r.total_volume || 0)
        };
      });

      // 2. Aggregation per Aktivitas (Panel Rangkuman Per Aktivitas)
      const actSql = `
        SELECT 
          h.nama_aktivitas,
          h.kode_sap,
          h.satuan,
          ROUND(SUM(h.hasil_kerja), 1) as total_volume,
          ROUND(SUM(h.hm_harian_berjalan), 1) as total_hm,
          COUNT(DISTINCT h.kode_unit) as unit_terlibat
        FROM hasil_input_aktivitas h
        ${whereClause}
        GROUP BY h.nama_aktivitas, h.kode_sap, h.satuan
        ORDER BY total_hm DESC
      `;
      const rawActData = queryAll<Record<string, unknown>>(actSql, params);
      const aktivitasData = rawActData.map(r => ({
        nama_aktivitas: String(r.nama_aktivitas || ''),
        kode_sap: String(r.kode_sap || ''),
        satuan: String(r.satuan || ''),
        total_volume: Number(r.total_volume || 0),
        total_hm: Number(r.total_hm || 0),
        unit_terlibat: Number(r.unit_terlibat || 0)
      }));

      // 3. Status Waktu Kerja (Panel Rangkuman Status Waktu Kerja: Jam Kerja Efektif vs Standby vs Breakdown)
      const statusSql = `
        SELECT 
          h.status_unit,
          COUNT(*) as count,
          ROUND(SUM(h.jam_kerja), 1) as total_jam
        FROM hasil_input_aktivitas h
        ${whereClause}
        GROUP BY h.status_unit
      `;
      const rawStatusData = queryAll<Record<string, unknown>>(statusSql, params);
      let operasiCount = 0, operasiHours = 0;
      let standbyCount = 0, standbyHours = 0;
      let breakdownCount = 0, breakdownHours = 0;

      rawStatusData.forEach(r => {
        const st = String(r.status_unit || 'OPERASI').toUpperCase();
        const hrs = Number(r.total_jam || 0);
        const cnt = Number(r.count || 0);
        if (st === 'OPERASI') {
          operasiCount += cnt;
          operasiHours += hrs;
        } else if (st === 'STANDBY') {
          standbyCount += cnt;
          standbyHours += hrs;
        } else if (st === 'BREAKDOWN') {
          breakdownCount += cnt;
          breakdownHours += hrs;
        }
      });

      const totalHours = Math.round((operasiHours + standbyHours + breakdownHours) * 10) / 10;
      const statusWaktu = {
        operasi_count: operasiCount,
        operasi_hours: Math.round(operasiHours * 10) / 10,
        operasi_percent: totalHours > 0 ? Math.round((operasiHours / totalHours) * 100) : 0,
        standby_count: standbyCount,
        standby_hours: Math.round(standbyHours * 10) / 10,
        standby_percent: totalHours > 0 ? Math.round((standbyHours / totalHours) * 100) : 0,
        breakdown_count: breakdownCount,
        breakdown_hours: Math.round(breakdownHours * 10) / 10,
        breakdown_percent: totalHours > 0 ? Math.round((breakdownHours / totalHours) * 100) : 0,
        total_hours: totalHours
      };

      // 4. Metric Grand Totals
      let totalSolar = 0;
      let totalHm = 0;
      unitData.forEach(u => {
        totalSolar += u.total_solar;
        totalHm += u.total_hm;
      });
      totalSolar = Math.round(totalSolar * 10) / 10;
      totalHm = Math.round(totalHm * 10) / 10;
      const rasioKonsumsi = totalHm > 0 ? Math.round((totalSolar / totalHm) * 100) / 100 : 0;

      res.json({
        totalSolar,
        totalHm,
        rasioKonsumsi,
        totalRecords: unitData.length,
        unitData,
        aktivitasData,
        statusWaktu
      });
    } catch (err: unknown) {
      console.error('Error fetching analytics:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 5. MASTER UNITS CRUD
  app.get('/api/units', (req: Request, res: Response) => {
    try {
      const rows = queryAll<UnitRow>('SELECT * FROM units ORDER BY id DESC');
      res.json(rows);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/units', (req: Request, res: Response) => {
    try {
      const { kode_unit, jenis_unit, model_unit, nama_pengawas, hm_unit_terakhir_diinputkan } = req.body;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const resDb = execute(`
        INSERT INTO units (kode_unit, jenis_unit, model_unit, nama_pengawas, hm_unit_terakhir_diinputkan, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [kode_unit, jenis_unit, model_unit, nama_pengawas, parseFloat(hm_unit_terakhir_diinputkan) || 0, now]);

      const inserted = queryOne<UnitRow>('SELECT * FROM units WHERE id = ?', [resDb.lastInsertRowId]);
      res.status(201).json(inserted);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/units/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { kode_unit, jenis_unit, model_unit, nama_pengawas, hm_unit_terakhir_diinputkan } = req.body;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      execute(`
        UPDATE units SET kode_unit = ?, jenis_unit = ?, model_unit = ?, nama_pengawas = ?, hm_unit_terakhir_diinputkan = ?, updated_at = ?
        WHERE id = ?
      `, [kode_unit, jenis_unit, model_unit, nama_pengawas, parseFloat(hm_unit_terakhir_diinputkan) || 0, now, id]);

      const updated = queryOne<UnitRow>('SELECT * FROM units WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/units/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      execute('DELETE FROM units WHERE id = ?', [id]);
      res.json({ message: 'Unit berhasil dihapus' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 6. MASTER AKTIVITAS CRUD
  app.get('/api/aktivitas', (req: Request, res: Response) => {
    try {
      const rows = queryAll<AktivitasUnitRow>('SELECT * FROM aktivitas_unit ORDER BY id DESC');
      res.json(rows);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/aktivitas', (req: Request, res: Response) => {
    try {
      const { jenis_unit, nama_aktivitas, satuan, kode_sap } = req.body;
      const resDb = execute(`
        INSERT INTO aktivitas_unit (jenis_unit, nama_aktivitas, satuan, kode_sap)
        VALUES (?, ?, ?, ?)
      `, [jenis_unit, nama_aktivitas, satuan, kode_sap]);

      const inserted = queryOne<AktivitasUnitRow>('SELECT * FROM aktivitas_unit WHERE id = ?', [resDb.lastInsertRowId]);
      res.status(201).json(inserted);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/aktivitas/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { jenis_unit, nama_aktivitas, satuan, kode_sap } = req.body;
      execute(`
        UPDATE aktivitas_unit SET jenis_unit = ?, nama_aktivitas = ?, satuan = ?, kode_sap = ?
        WHERE id = ?
      `, [jenis_unit, nama_aktivitas, satuan, kode_sap, id]);

      const updated = queryOne<AktivitasUnitRow>('SELECT * FROM aktivitas_unit WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/aktivitas/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      execute('DELETE FROM aktivitas_unit WHERE id = ?', [id]);
      res.json({ message: 'Aktivitas berhasil dihapus' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 7. MASTER OPERATORS CRUD
  app.get('/api/operators', (req: Request, res: Response) => {
    try {
      const rows = queryAll<OperatorRow>('SELECT * FROM operators ORDER BY id DESC');
      res.json(rows);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/operators', (req: Request, res: Response) => {
    try {
      const { nama_operator, nik, nama_pengawas } = req.body;
      const resDb = execute(`
        INSERT INTO operators (nama_operator, nik, nama_pengawas)
        VALUES (?, ?, ?)
      `, [nama_operator, nik, nama_pengawas]);

      const inserted = queryOne<OperatorRow>('SELECT * FROM operators WHERE id = ?', [resDb.lastInsertRowId]);
      res.status(201).json(inserted);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/operators/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { nama_operator, nik, nama_pengawas } = req.body;
      execute(`
        UPDATE operators SET nama_operator = ?, nik = ?, nama_pengawas = ?
        WHERE id = ?
      `, [nama_operator, nik, nama_pengawas, id]);

      const updated = queryOne<OperatorRow>('SELECT * FROM operators WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/operators/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      execute('DELETE FROM operators WHERE id = ?', [id]);
      res.json({ message: 'Operator berhasil dihapus' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 8. MASTER USERS CRUD
  app.get('/api/users', (req: Request, res: Response) => {
    try {
      const rows = queryAll<UserRow>('SELECT id, nama_lengkap, username, hak_akses FROM users ORDER BY id ASC');
      res.json(rows);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/users', (req: Request, res: Response) => {
    try {
      const { nama_lengkap, username, password, hak_akses } = req.body;
      const resDb = execute(`
        INSERT INTO users (nama_lengkap, username, password, hak_akses)
        VALUES (?, ?, ?, ?)
      `, [nama_lengkap, username, password, hak_akses || 'Pengawas']);

      const inserted = queryOne<UserRow>('SELECT id, nama_lengkap, username, hak_akses FROM users WHERE id = ?', [resDb.lastInsertRowId]);
      res.status(201).json(inserted);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/users/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { nama_lengkap, username, password, hak_akses } = req.body;
      if (password) {
        execute('UPDATE users SET nama_lengkap = ?, username = ?, password = ?, hak_akses = ? WHERE id = ?',
          [nama_lengkap, username, password, hak_akses, id]);
      } else {
        execute('UPDATE users SET nama_lengkap = ?, username = ?, hak_akses = ? WHERE id = ?',
          [nama_lengkap, username, hak_akses, id]);
      }

      const updated = queryOne<UserRow>('SELECT id, nama_lengkap, username, hak_akses FROM users WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/users/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      execute('DELETE FROM users WHERE id = ?', [id]);
      res.json({ message: 'User berhasil dihapus' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 9. BACKUP & EXPORT
  app.get('/api/backup/export', (req: Request, res: Response) => {
    try {
      const format = req.query.format === 'sql' ? 'sql' : 'json';

      if (format === 'json') {
        const users = queryAll('SELECT id, nama_lengkap, username, hak_akses FROM users');
        const units = queryAll('SELECT * FROM units');
        const aktivitas = queryAll('SELECT * FROM aktivitas_unit');
        const operators = queryAll('SELECT * FROM operators');
        const laporan = queryAll('SELECT * FROM hasil_input_aktivitas');

        res.setHeader('Content-Disposition', 'attachment; filename="heavytrack_backup.json"');
        res.setHeader('Content-Type', 'application/json');
        return res.json({
          system: 'HeavyTrack Enterprise Database Backup',
          exported_at: new Date().toISOString(),
          tables: {
            users,
            units,
            aktivitas_unit: aktivitas,
            operators,
            hasil_input_aktivitas: laporan
          }
        });
      } else {
        // SQL dump format
        let sqlDump = `-- HeavyTrack Enterprise SQL Dump\n-- Exported At: ${new Date().toISOString()}\n\n`;
        const tables = ['users', 'units', 'aktivitas_unit', 'operators', 'hasil_input_aktivitas'];

        for (const tbl of tables) {
          const rows = queryAll(`SELECT * FROM ${tbl}`);
          sqlDump += `-- Table: ${tbl}\n`;
          for (const row of rows) {
            const keys = Object.keys(row).join(', ');
            const vals = Object.values(row).map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v === null ? 'NULL' : v).join(', ');
            sqlDump += `INSERT INTO ${tbl} (${keys}) VALUES (${vals});\n`;
          }
          sqlDump += '\n';
        }

        res.setHeader('Content-Disposition', 'attachment; filename="heavytrack_backup.sql"');
        res.setHeader('Content-Type', 'text/plain');
        return res.send(sqlDump);
      }
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Setup Vite in Dev or Serve Static in Prod
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HeavyTrack Enterprise Server running at http://0.0.0.0:${PORT}`);
    console.log(`🔌 WebSocket server listening on ws://0.0.0.0:${PORT}/ws`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
