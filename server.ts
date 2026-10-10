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
  UserRow,
  LokasiRow,
  RencanaKerjaRow
} from './server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
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
      message: 'Tersambung ke WebSocket RKCE (Rencana Kerja Unit Civil Engineering) Server',
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
      service: 'RKCE (Rencana Kerja Unit Civil Engineering) Portal API',
      wsClients: clients.size,
      uptime: process.uptime()
    });
  });

  // 1. GET /api/master-data?pengawas=:nama
  // Bundle master data (units, aktivitas, operators, lokasi) filtered by supervisor for Android offline sync
  app.get('/api/master-data', (req: Request, res: Response) => {
    try {
      const pengawas = (req.query.pengawas as string | undefined)?.trim();

      let units: UnitRow[];
      let operators: OperatorRow[];
      let aktivitas: AktivitasUnitRow[];
      const lokasi: LokasiRow[] = queryAll<LokasiRow>('SELECT * FROM lokasi ORDER BY kode_lokasi ASC');

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
        total_lokasi: lokasi.length,
        data: {
          units,
          aktivitas,
          operators,
          lokasi
        }
      });
    } catch (err: unknown) {
      console.error('Error fetching master data:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 1B. RENCANA KERJA ENDPOINTS (GET, POST, PUT TERBITKAN-SPK, DELETE)
  app.get('/api/rencana-kerja', (req: Request, res: Response) => {
    try {
      const { search, pengawas, status_spk, tanggal } = req.query;
      let sql = `
        SELECT 
          r.*,
          u.model_unit,
          l.wilayah
        FROM rencana_kerja r
        LEFT JOIN units u ON r.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
        WHERE 1=1
      `;
      const params: (string | number)[] = [];

      if (search && typeof search === 'string' && search.trim() !== '') {
        const s = `%${search.trim()}%`;
        sql += ` AND (r.nama_pengawas LIKE ? OR r.kode_unit LIKE ? OR r.operator LIKE ? OR r.kode_lokasi LIKE ? OR r.nomor_spk LIKE ?)`;
        params.push(s, s, s, s, s);
      }

      if (pengawas && typeof pengawas === 'string' && pengawas !== 'Semua') {
        sql += ' AND r.nama_pengawas = ?';
        params.push(pengawas);
      }

      if (status_spk && typeof status_spk === 'string' && status_spk !== 'Semua') {
        sql += ' AND r.status_spk = ?';
        params.push(status_spk);
      }

      if (tanggal && typeof tanggal === 'string' && tanggal.trim() !== '') {
        sql += ' AND r.tanggal = ?';
        params.push(tanggal.trim());
      }

      sql += ' ORDER BY r.tanggal DESC, r.created_at DESC';

      const rows = queryAll<RencanaKerjaRow>(sql, params);

      // Pastikan field nomor_spk dan status_spk selalu disertakan dalam response JSON
      const formattedRows = rows.map(r => ({
        ...r,
        nomor_spk: r.nomor_spk !== undefined && r.nomor_spk !== null && r.nomor_spk !== '' ? String(r.nomor_spk) : null,
        status_spk: (r.status_spk as string) || (r.nomor_spk ? 'SPK_TERBIT' : 'MENUNGGU_SPK')
      }));

      res.json({
        status: 'success',
        total: formattedRows.length,
        data: formattedRows
      });
    } catch (err: unknown) {
      console.error('Error fetching rencana-kerja:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/rencana-kerja', (req: Request, res: Response) => {
    try {
      const {
        id: customId,
        nama_pengawas,
        tanggal,
        status_unit: rawStatusUnit,
        kode_unit,
        operator,
        kode_lokasi,
        shift_kerja: rawShift,
        nomor_spk,
        status_spk: rawStatusSpk,
        keterangan_rencana
      } = req.body;

      if (!nama_pengawas || !kode_unit || !operator || !kode_lokasi) {
        return res.status(400).json({
          error: 'Field wajib tidak lengkap: nama_pengawas, kode_unit, operator, dan kode_lokasi diperlukan.'
        });
      }

      const id = (customId && String(customId).trim()) || `RK-${Date.now()}`;
      const tgl = tanggal || new Date().toISOString().slice(0, 10);
      const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const status_unit = (rawStatusUnit || 'OPERASI').toUpperCase();
      const shift_kerja = (rawShift || 'SIANG').toUpperCase();
      const status_spk = rawStatusSpk || (nomor_spk ? 'SPK_TERBIT' : 'MENUNGGU_SPK');

      const insertSql = `
        INSERT INTO rencana_kerja (
          id, nama_pengawas, tanggal, status_unit, kode_unit,
          operator, kode_lokasi, shift_kerja, nomor_spk, status_spk,
          keterangan_rencana, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      execute(insertSql, [
        id,
        nama_pengawas,
        tgl,
        status_unit,
        kode_unit,
        operator,
        kode_lokasi,
        shift_kerja,
        nomor_spk || null,
        status_spk,
        keterangan_rencana || '',
        createdAt
      ]);

      const newRow = queryOne<RencanaKerjaRow>(`
        SELECT r.*, u.model_unit, l.wilayah
        FROM rencana_kerja r
        LEFT JOIN units u ON r.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
        WHERE r.id = ?
      `, [id]);

      broadcast({
        event: 'NEW_RENCANA',
        message: `Rencana kerja baru dari ${nama_pengawas} (Unit ${kode_unit})`,
        data: newRow,
        timestamp: new Date().toISOString()
      });

      res.status(201).json({
        status: 'success',
        message: 'Rencana kerja berhasil disimpan.',
        data: newRow
      });
    } catch (err: unknown) {
      console.error('Error saving rencana-kerja:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PUT /api/rencana-kerja/:id/terbitkan-spk: Admin menginput/mengupdate nomor_spk.
  // Begitu SPK terbit, kirim broadcast WebSocket ke Android agar nomor SPK otomatis terisi di form realisasi pengawas.
  app.put('/api/rencana-kerja/:id/terbitkan-spk', (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const { nomor_spk } = req.body;

      if (!nomor_spk || typeof nomor_spk !== 'string' || !nomor_spk.trim()) {
        return res.status(400).json({ error: 'Nomor SPK wajib diisi.' });
      }

      const cleanSpk = nomor_spk.trim();
      execute(
        `UPDATE rencana_kerja SET nomor_spk = ?, status_spk = 'SPK_TERBIT' WHERE id = ?`,
        [cleanSpk, id]
      );

      const updatedRow = queryOne<RencanaKerjaRow>(`
        SELECT r.*, u.model_unit, l.wilayah
        FROM rencana_kerja r
        LEFT JOIN units u ON r.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
        WHERE r.id = ?
      `, [id]);

      if (!updatedRow) {
        return res.status(404).json({ error: 'Rencana kerja tidak ditemukan.' });
      }

      // Format payload SPK sesuai spesifikasi integrasi Android RKCE Mobile
      const spkPayload = {
        id: updatedRow.id,
        nomor_spk: updatedRow.nomor_spk || cleanSpk,
        nama_pengawas: updatedRow.nama_pengawas,
        kode_unit: updatedRow.kode_unit,
        status_spk: updatedRow.status_spk || 'SPK_TERBIT'
      };

      // 1. Broadcast event 'SPK_PUBLISHED' dengan Payload: { id, nomor_spk, nama_pengawas, kode_unit, status_spk }
      broadcast({
        event: 'SPK_PUBLISHED',
        ...spkPayload,
        payload: spkPayload,
        data: {
          ...updatedRow,
          nomor_spk: updatedRow.nomor_spk || cleanSpk,
          status_spk: 'SPK_TERBIT'
        },
        message: `Nomor SPK ${cleanSpk} telah diterbitkan untuk ${updatedRow.nama_pengawas} (Unit ${updatedRow.kode_unit})`,
        timestamp: new Date().toISOString()
      });

      // 2. Broadcast kompatibilitas 'SPK_TERBIT' dan 'UPDATE_RENCANA'
      broadcast({
        event: 'SPK_TERBIT',
        message: `Nomor SPK ${cleanSpk} telah diterbitkan untuk ${updatedRow.nama_pengawas} (Unit ${updatedRow.kode_unit})`,
        data: updatedRow,
        payload: spkPayload,
        timestamp: new Date().toISOString()
      });

      broadcast({
        event: 'UPDATE_RENCANA',
        data: updatedRow,
        payload: spkPayload,
        timestamp: new Date().toISOString()
      });

      console.log(`📜 [SPK_PUBLISHED] Nomor SPK ${cleanSpk} diterbitkan untuk Rencana #${id} & dibroadcast via WebSocket`);

      res.json({
        status: 'success',
        message: `Nomor SPK ${cleanSpk} berhasil diterbitkan & disinkronkan ke aplikasi Android.`,
        data: {
          ...updatedRow,
          nomor_spk: updatedRow.nomor_spk || cleanSpk,
          status_spk: 'SPK_TERBIT'
        },
        payload: spkPayload
      });
    } catch (err: unknown) {
      console.error('Error updating SPK:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/rencana-kerja/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const {
        nama_pengawas,
        tanggal,
        status_unit,
        kode_unit,
        operator,
        kode_lokasi,
        shift_kerja,
        nomor_spk,
        status_spk,
        keterangan_rencana
      } = req.body;

      execute(`
        UPDATE rencana_kerja SET
          nama_pengawas = ?, tanggal = ?, status_unit = ?, kode_unit = ?,
          operator = ?, kode_lokasi = ?, shift_kerja = ?, nomor_spk = ?,
          status_spk = ?, keterangan_rencana = ?
        WHERE id = ?
      `, [
        nama_pengawas, tanggal, status_unit, kode_unit,
        operator, kode_lokasi, shift_kerja, nomor_spk || null,
        status_spk, keterangan_rencana || '', id
      ]);

      const updatedRow = queryOne<RencanaKerjaRow>(`
        SELECT r.*, u.model_unit, l.wilayah
        FROM rencana_kerja r
        LEFT JOIN units u ON r.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
        WHERE r.id = ?
      `, [id]);

      broadcast({
        event: 'UPDATE_RENCANA',
        data: updatedRow,
        timestamp: new Date().toISOString()
      });

      res.json({ status: 'success', data: updatedRow });
    } catch (err: unknown) {
      console.error('Error updating rencana-kerja:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/rencana-kerja/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      execute('DELETE FROM rencana_kerja WHERE id = ?', [id]);

      broadcast({
        event: 'DELETE_RENCANA',
        id,
        timestamp: new Date().toISOString()
      });

      res.json({ status: 'success', message: 'Rencana kerja berhasil dihapus' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 1C. MASTER LOKASI REST API & BULK IMPORT
  app.get('/api/master/lokasi', (req: Request, res: Response) => {
    try {
      const rows = queryAll<LokasiRow>('SELECT * FROM lokasi ORDER BY kode_lokasi ASC');
      res.json(rows);
    } catch (err: unknown) {
      console.error('Error fetching lokasi:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/master/lokasi', (req: Request, res: Response) => {
    try {
      const { kode_lokasi, wilayah, luas_bruto, luas_netto } = req.body;
      if (!kode_lokasi || !wilayah) {
        return res.status(400).json({ error: 'Kode lokasi dan wilayah wajib diisi.' });
      }
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      execute(`
        INSERT OR REPLACE INTO lokasi (kode_lokasi, wilayah, luas_bruto, luas_netto, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [
        kode_lokasi.trim(),
        wilayah.trim(),
        parseFloat(luas_bruto) || 0,
        parseFloat(luas_netto) || 0,
        now
      ]);

      const inserted = queryOne<LokasiRow>('SELECT * FROM lokasi WHERE kode_lokasi = ?', [kode_lokasi.trim()]);
      res.status(201).json(inserted);
    } catch (err: unknown) {
      console.error('Error saving lokasi:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/master/lokasi/:kode_lokasi', (req: Request, res: Response) => {
    try {
      const kode = req.params.kode_lokasi;
      const { wilayah, luas_bruto, luas_netto } = req.body;
      execute(`
        UPDATE lokasi SET wilayah = ?, luas_bruto = ?, luas_netto = ?
        WHERE kode_lokasi = ?
      `, [wilayah, parseFloat(luas_bruto) || 0, parseFloat(luas_netto) || 0, kode]);

      const updated = queryOne<LokasiRow>('SELECT * FROM lokasi WHERE kode_lokasi = ?', [kode]);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/master/lokasi/:kode_lokasi', (req: Request, res: Response) => {
    try {
      const kode = req.params.kode_lokasi;
      execute('DELETE FROM lokasi WHERE kode_lokasi = ?', [kode]);
      res.json({ status: 'success', message: 'Lokasi berhasil dihapus' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/master/lokasi/bulk-import: Menerima array JSON data lokasi dari file Excel (.xlsx) untuk Bulk UPSERT
  app.post('/api/master/lokasi/bulk-import', (req: Request, res: Response) => {
    try {
      const rawItems = Array.isArray(req.body) ? req.body : req.body.data;
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return res.status(400).json({ error: 'Data import tidak valid atau kosong.' });
      }

      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      let importedCount = 0;

      for (const item of rawItems) {
        const kode = (item.kode_lokasi || item.lokasi || item.Kode || '').toString().trim();
        const wilayah = (item.wilayah || item.Wilayah || 'PG1').toString().trim();
        const bruto = parseFloat(item.luas_bruto ?? item['luas bruto'] ?? item.luasBruto ?? 0) || 0;
        const netto = parseFloat(item.luas_netto ?? item['luas netto'] ?? item.luasNetto ?? 0) || 0;

        if (kode) {
          execute(`
            INSERT OR REPLACE INTO lokasi (kode_lokasi, wilayah, luas_bruto, luas_netto, created_at)
            VALUES (?, ?, ?, ?, ?)
          `, [kode, wilayah, bruto, netto, now]);
          importedCount++;
        }
      }

      const allLokasi = queryAll<LokasiRow>('SELECT * FROM lokasi ORDER BY kode_lokasi ASC');
      res.json({
        status: 'success',
        message: `${importedCount} data lokasi berhasil diimpor / diperbarui ke database secara massal.`,
        importedCount,
        data: allLokasi
      });
    } catch (err: unknown) {
      console.error('Error bulk import lokasi:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 2. POST /api/aktivitas-unit
  // Atomic transaction from Android app or manual dashboard entry (supports Base64 JSON & multipart/form-data)
  app.post('/api/aktivitas-unit', upload.single('foto_bukti') as unknown as express.RequestHandler, (req: Request, res: Response) => {
    try {
      const {
        rencana_id,
        nama_pengawas,
        tanggal,
        kode_unit,
        nama_aktivitas,
        kode_sap,
        satuan,
        operator,
        nik_operator,
        kode_lokasi: rawKodeLokasi,
        lokasi: rawLokasi,
        nomor_spk,
        shift_kerja: rawShiftKerja,
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

      const kode_lokasi = (rawKodeLokasi || rawLokasi || '001A').toString().trim();
      const lokasi = (rawLokasi || rawKodeLokasi || 'Pit Operasional').toString().trim();
      const shift_kerja = (rawShiftKerja || 'SIANG').toUpperCase() === 'MALAM' ? 'Malam' : 'Siang';

      // 1. Simpan baris baru ke tabel hasil_input_aktivitas
      const insertSql = `
        INSERT INTO hasil_input_aktivitas (
          rencana_id, nama_pengawas, tanggal, kode_unit, nama_aktivitas, kode_sap, satuan,
          operator, nik_operator, kode_lokasi, lokasi, nomor_spk, shift_kerja, jam_kerja, hm_awal, hm_akhir,
          hm_harian_berjalan, hasil_kerja, keterangan, foto_bukti,
          status_unit, is_isi_solar, jumlah_liter_solar, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const insertResult = execute(insertSql, [
        rencana_id || null,
        nama_pengawas,
        currentDate,
        kode_unit,
        nama_aktivitas,
        kode_sap || 'ACT-SAP-101',
        satuan || 'm3',
        operator || 'Operator Default',
        nik_operator || 'NIK-00000',
        kode_lokasi,
        lokasi,
        nomor_spk || null,
        shift_kerja,
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

      // 3. Jika ada rencana_id, update status_spk menjadi 'REALISASI_SELESAI' di tabel rencana_kerja
      if (rencana_id) {
        try {
          if (nomor_spk) {
            execute(
              `UPDATE rencana_kerja SET status_spk = 'REALISASI_SELESAI', nomor_spk = ? WHERE id = ?`,
              [nomor_spk, rencana_id]
            );
          } else {
            execute(
              `UPDATE rencana_kerja SET status_spk = 'REALISASI_SELESAI' WHERE id = ?`,
              [rencana_id]
            );
          }
          const updatedPlan = queryOne<RencanaKerjaRow>(`
            SELECT r.*, u.model_unit, l.wilayah
            FROM rencana_kerja r
            LEFT JOIN units u ON r.kode_unit = u.kode_unit
            LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
            WHERE r.id = ?
          `, [rencana_id]);
          if (updatedPlan) {
            broadcast({
              event: 'UPDATE_RENCANA',
              data: updatedPlan,
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          console.warn('Error updating linked rencana_kerja status:', e);
        }
      }

      // Ambil row lengkap yang baru tersimpan
      const newRow = queryOne<HasilInputAktivitasRow>(
        'SELECT * FROM hasil_input_aktivitas WHERE id = ?',
        [newRowId]
      );

      // 4. Broadcast event 'NEW_REALIZATION' & 'NEW_ACTIVITY' via WebSocket
      broadcast({
        event: 'NEW_REALIZATION',
        message: `Realisasi aktivitas baru diterima dari ${nama_pengawas} (Unit ${kode_unit})`,
        data: newRow,
        timestamp: new Date().toISOString()
      });

      broadcast({
        event: 'NEW_ACTIVITY',
        message: `Laporan baru diterima dari ${nama_pengawas} (Unit ${kode_unit})`,
        data: newRow,
        timestamp: new Date().toISOString()
      });

      console.log(`✨ [TRANS-OK] Realisasi kerja #${newRowId} tersimpan & dibroadcast via WebSocket`);

      return res.status(201).json({
        status: 'success',
        message: 'Laporan realisasi aktivitas unit berhasil disimpan & disinkronisasi.',
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
  app.put('/api/rekapitulasi/:id', upload.single('foto_bukti') as unknown as express.RequestHandler, (req: Request, res: Response) => {
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

  // 8. MASTER USERS CRUD & AUTH
  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username dan kata sandi wajib diisi.' });
      }

      const user = queryOne<UserRow>(
        'SELECT id, nama_lengkap, username, password, hak_akses FROM users WHERE LOWER(username) = LOWER(?)',
        [username.trim()]
      );

      if (!user) {
        return res.status(401).json({ error: 'Username atau kata sandi tidak sesuai.' });
      }

      if (user.password !== password) {
        return res.status(401).json({ error: 'Username atau kata sandi tidak sesuai.' });
      }

      res.json({
        status: 'success',
        message: 'Login berhasil.',
        token: `rkce_token_${user.id}_${Date.now()}`,
        user: {
          id: user.id,
          nama_lengkap: user.nama_lengkap,
          username: user.username,
          hak_akses: user.hak_akses,
          email: `${user.username}@rkce.co.id`
        }
      });
    } catch (err: unknown) {
      console.error('Error during login:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

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
        const lokasi = queryAll('SELECT * FROM lokasi');
        const rencana_kerja = queryAll('SELECT * FROM rencana_kerja');
        const laporan = queryAll('SELECT * FROM hasil_input_aktivitas');

        res.setHeader('Content-Disposition', 'attachment; filename="rkce_backup.json"');
        res.setHeader('Content-Type', 'application/json');
        return res.json({
          system: 'RKCE (Rencana Kerja Unit Civil Engineering) Database Backup',
          exported_at: new Date().toISOString(),
          tables: {
            users,
            units,
            aktivitas_unit: aktivitas,
            operators,
            lokasi,
            rencana_kerja,
            hasil_input_aktivitas: laporan
          }
        });
      } else {
        // SQL dump format
        let sqlDump = `-- RKCE (Rencana Kerja Unit Civil Engineering) SQL Dump\n-- Exported At: ${new Date().toISOString()}\n\n`;
        const tables = ['users', 'units', 'aktivitas_unit', 'operators', 'lokasi', 'rencana_kerja', 'hasil_input_aktivitas'];

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

        res.setHeader('Content-Disposition', 'attachment; filename="rkce_backup.sql"');
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
    console.log(`🚀 RKCE (Rencana Kerja Unit Civil Engineering) Server running at http://0.0.0.0:${PORT}`);
    console.log(`🔌 WebSocket server listening on ws://0.0.0.0:${PORT}/ws`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
