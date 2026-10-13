import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import db, {
  getDb,
  queryAll,
  queryOne,
  execute,
  saveDb,
  type HasilInputAktivitasRow,
  type UnitRow,
  type AktivitasUnitRow,
  type OperatorRow,
  type UserRow,
  type UserRole,
  type LokasiRow,
  type RencanaKerjaRow,
  type MasterKendalaRow,
  type AppSettingRow
} from './server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
// Port configuration: Read dynamic process.env.PORT if provided, defaulting to 3000 for AI Studio
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Multer memory storage configuration for multipart/form-data photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

function generateSampleFieldPhoto(kodeUnit: string, aktivitas: string, lokasi: string, pengawas: string, tanggal: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#0f172a"/>
    <rect x="20" y="20" width="760" height="560" rx="16" fill="#1e293b" stroke="#334155" stroke-width="4"/>
    <path d="M50 480 L250 220 L420 380 L580 180 L750 480 Z" fill="#334155" opacity="0.6"/>
    <path d="M120 480 L320 280 L480 420 L620 240 L750 480 Z" fill="#059669" opacity="0.4"/>
    <text x="400" y="100" font-family="sans-serif" font-size="28" font-weight="bold" fill="#10b981" text-anchor="middle">FOTO BUKTI LAPANGAN REALISASI</text>
    <rect x="60" y="440" width="680" height="110" rx="12" fill="#020617" opacity="0.95" stroke="#1e293b" stroke-width="2"/>
    <text x="80" y="475" font-family="sans-serif" font-size="18" font-weight="bold" fill="#ffffff">Unit: ${kodeUnit} | Activity: ${aktivitas}</text>
    <text x="80" y="505" font-family="sans-serif" font-size="15" fill="#94a3b8">Lokasi: ${lokasi} | Pengawas: ${pengawas}</text>
    <text x="80" y="530" font-family="sans-serif" font-size="14" font-weight="bold" fill="#10b981">Tanggal: ${tanggal} | Verified RKCE Mobile</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Normalisasi format tanggal bisnis (ke ISO YYYY-MM-DD)
 * Menjamin tanggal operasional (seperti "09/10/2026") tersimpan presisi dan tidak bergeser
 * akibat fallback new Date() / CURRENT_DATE
 */
function formatToISODate(dateStr: unknown): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const s = String(dateStr).trim();
  if (!s) return new Date().toISOString().split('T')[0];

  // Jika user memilih atau mengirim format DD/MM/YYYY atau YYYY/MM/DD
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      const [p1, p2, p3] = parts;
      if (p1.length === 4) {
        // YYYY/MM/DD
        return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
      }
      // DD/MM/YYYY
      let y = p3;
      if (y.length === 2) y = `20${y}`;
      return `${y}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
    }
  }

  // Jika formatnya DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Jika formatnya sudah ISO (YYYY-MM-DD) atau ISO Timestamp
  return s.split('T')[0];
}

async function startServer() {
  // Initialize Database
  await getDb();
  console.log('✅ SQLite Database initialized successfully.');

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Helper to extract role of requesting user from Headers, Token, or Body
  function getRequesterRole(req: Request): string | null {
    // 1. Explicit header: x-user-role or x-role
    const roleHeader = req.headers['x-user-role'] || req.headers['x-role'];
    if (typeof roleHeader === 'string' && roleHeader.trim()) {
      return roleHeader.trim().toUpperCase();
    }

    // 2. Authorization Bearer token (format: rkce_token_<userId>_<timestamp>)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const tokenMatch = token.match(/^rkce_token_(\d+)_/);
      if (tokenMatch) {
        const userId = parseInt(tokenMatch[1], 10);
        const user = queryOne<UserRow>('SELECT role, hak_akses FROM users WHERE id = ?', [userId]);
        if (user) {
          const r = user.role || (user.hak_akses?.toLowerCase() === 'manager' ? 'MANAGER' : (user.hak_akses?.toLowerCase() === 'pengawas' ? 'SUPERVISOR' : 'ADMIN'));
          return r.toUpperCase();
        }
      }
    }

    // 3. User ID header: x-user-id
    const userIdHeader = req.headers['x-user-id'];
    if (userIdHeader) {
      const userId = parseInt(String(userIdHeader), 10);
      if (!isNaN(userId)) {
        const user = queryOne<UserRow>('SELECT role, hak_akses FROM users WHERE id = ?', [userId]);
        if (user) {
          const r = user.role || (user.hak_akses?.toLowerCase() === 'manager' ? 'MANAGER' : (user.hak_akses?.toLowerCase() === 'pengawas' ? 'SUPERVISOR' : 'ADMIN'));
          return r.toUpperCase();
        }
      }
    }

    // 4. Request query or body fallback for role if supplied
    if (req.query?.user_role && typeof req.query.user_role === 'string') {
      return (req.query.user_role as string).trim().toUpperCase();
    }
    if (req.body?.user_role && typeof req.body.user_role === 'string') {
      return (req.body.user_role as string).trim().toUpperCase();
    }

    return null;
  }

  // RBAC Middleware: Protect Master Data & Deletions for MANAGER Role
  // Manager: Read-only (GET allowed everywhere, mutating POST/PUT/PATCH/DELETE on master data & data deletion blocked with 403 Forbidden)
  const rbacMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    // Allow all GET / HEAD / OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next();
    }

    // Allow auth endpoints (login, logout)
    if (req.path.startsWith('/auth/')) {
      return next();
    }

    const role = getRequesterRole(req);
    if (role === 'MANAGER') {
      const pathUrl = req.path.toLowerCase();
      const isMasterOrWriteRoute = 
        pathUrl.startsWith('/master-') ||
        pathUrl.startsWith('/master/') ||
        pathUrl.startsWith('/master') ||
        pathUrl.startsWith('/units') ||
        pathUrl.startsWith('/aktivitas') ||
        pathUrl.startsWith('/lokasi') ||
        pathUrl.startsWith('/operators') ||
        pathUrl.startsWith('/kendala') ||
        pathUrl.startsWith('/users') ||
        pathUrl.startsWith('/settings') ||
        pathUrl.startsWith('/app-settings') ||
        pathUrl.startsWith('/rencana-kerja') ||
        pathUrl.startsWith('/rekapitulasi');

      if (isMasterOrWriteRoute && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_MANAGER_ROLE',
          error: 'Akses Ditolak (403 Forbidden): Peran MANAGER memiliki hak akses Monitoring & Executive View (Read-Only) dan dilarang menambah, mengubah, atau menghapus Master Data serta Rencana/Realisasi Kerja.',
          role: 'MANAGER'
        });
      }

      if (method === 'DELETE') {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_MANAGER_ROLE',
          error: 'Akses Ditolak (403 Forbidden): Peran MANAGER dilarang menghapus data sistem.',
          role: 'MANAGER'
        });
      }
    }

    next();
  };

  app.use('/api', rbacMiddleware);

  const server = http.createServer(app);

  // Initialize WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  const clients = new Set<WebSocket>();

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url?.split('?')[0] || '';
    if (pathname.startsWith('/@vite')) {
      return; // Biarkan Vite menangani HMR dev internal jika ada
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
    clients.add(ws);
    console.log(`📡 WebSocket Client connected (${request.url}). Total clients: ${clients.size}`);

    // Send welcome packet with current server time
    ws.send(JSON.stringify({
      event: 'CONNECTED',
      type: 'CONNECTED',
      message: 'Tersambung ke WebSocket RKCE (Rencana Kerja Unit Civil Engineering) Server',
      timestamp: new Date().toISOString(),
      activeClients: clients.size
    }));

    ws.on('message', (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === 'PING' || parsed.event === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', event: 'PONG', timestamp: new Date().toISOString() }));
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
  function broadcast(data: Record<string, unknown>): number {
    const payload = JSON.stringify(data);
    let count = 0;
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
          count++;
        } catch (err) {
          console.warn('Error sending WS message to client:', err);
        }
      }
    }
    return count;
  }

  // Socket.io compatible broadcast helper
  const io = {
    emit: (event: string, payload: Record<string, unknown>) => {
      const count = broadcast({
        event,
        type: event,
        ...payload,
        data: payload,
        payload,
        timestamp: new Date().toISOString()
      });
      console.log(`📡 [WS-EMIT] Event "${event}" broadcasted ke ${count} WebSocket client aktif.`);
    }
  };

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

  // ======================================================================
  // ENDPOINT: GET & POST /api/mobile/bootstrap-data (Full Initial Sync)
  // Sinkronisasi data awal lengkap saat pengawas login di aplikasi Android
  // ======================================================================
  const handleMobileBootstrap = (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const rawPengawas = (
        (req.query.pengawas as string | undefined) ||
        (req.query.supervisor as string | undefined) ||
        (req.query.user_id as string | undefined) ||
        (req.query.nik as string | undefined) ||
        (req.body?.pengawas as string | undefined) ||
        (req.body?.supervisor as string | undefined) ||
        (req.body?.user_id as string | undefined)
      )?.trim();

      const rawTanggal = (
        (req.query.tanggal as string | undefined) ||
        (req.query.date as string | undefined) ||
        (req.body?.tanggal as string | undefined) ||
        (req.body?.date as string | undefined)
      )?.trim();

      // 1. Resolusi Identitas Pengawas (Mendukung Nama Lengkap, Username / NIK, atau User ID)
      let resolvedSupervisorName = '';
      let resolvedUsername = '';

      if (rawPengawas && rawPengawas !== 'Semua') {
        const user = queryOne<UserRow>(
          `SELECT * FROM users WHERE LOWER(nama_lengkap) = LOWER(?) OR LOWER(username) = LOWER(?) OR CAST(id AS TEXT) = ? LIMIT 1`,
          [rawPengawas, rawPengawas, rawPengawas]
        );
        if (user) {
          resolvedSupervisorName = user.nama_lengkap;
          resolvedUsername = user.username;
        } else {
          // Cari berdasarkan NIK operator jika diteruskan NIK
          const op = queryOne<OperatorRow>(
            `SELECT * FROM operators WHERE nik = ? OR LOWER(nama_operator) = LOWER(?) LIMIT 1`,
            [rawPengawas, rawPengawas]
          );
          if (op && op.nama_pengawas) {
            resolvedSupervisorName = op.nama_pengawas;
          } else {
            resolvedSupervisorName = rawPengawas;
          }
        }
      }

      // 2. Normalisasi Tanggal Operasional Hari Ini (YYYY-MM-DD) & Rentang 30 Hari
      const operationalDate = formatToISODate(rawTanggal || new Date().toISOString().split('T')[0]);
      const opDateObj = new Date(operationalDate);
      const date30DaysAgoObj = new Date(opDateObj.getTime() - 30 * 24 * 60 * 60 * 1000);
      const date30DaysAgoStr = isNaN(date30DaysAgoObj.getTime())
        ? '2000-01-01'
        : date30DaysAgoObj.toISOString().split('T')[0];

      // ------------------------------------------------------------------
      // 3. LOGIKA 1: RENCANA KERJA AKTIF (Pending Realisasi Lapangan)
      //    Status SPK_TERBIT atau MENUNGGU, dan belum memiliki realisasi di aktivitas_unit (hasil_input_aktivitas)
      // ------------------------------------------------------------------
      let rkSql = `
        SELECT 
          r.id,
          r.id as id_rencana_kerja,
          r.id as rencana_id,
          r.nomor_spk,
          r.tanggal,
          COALESCE(r.tanggal_kerja, r.tanggal) as tanggal_kerja,
          r.nama_pengawas,
          r.kode_unit,
          COALESCE(u.model_unit, r.kode_unit) as model_unit,
          COALESCE(u.jenis_unit, '-') as jenis_unit,
          COALESCE(u.hm_unit_terakhir_diinputkan, 0) as hm_terakhir,
          COALESCE(u.hm_unit_terakhir_diinputkan, 0) as hm_unit_terakhir,
          COALESCE(u.hm_min_standar, 6.0) as hm_min_standar,
          COALESCE(u.hm_max_standar, 10.0) as hm_max_standar,
          r.operator,
          COALESCE(op.nik, '-') as nik_operator,
          r.kode_lokasi,
          COALESCE(l.wilayah, r.kode_lokasi) as lokasi,
          COALESCE(l.wilayah, r.kode_lokasi) as nama_lokasi,
          COALESCE(l.wilayah, r.kode_lokasi) as wilayah,
          COALESCE(r.nama_aktivitas, r.aktivitas, ma.nama_aktivitas, r.keterangan_rencana, 'Operasional Lapangan') as aktivitas,
          COALESCE(r.nama_aktivitas, r.aktivitas, ma.nama_aktivitas, r.keterangan_rencana, 'Operasional Lapangan') as nama_aktivitas,
          COALESCE(r.kode_sap, ma.kode_sap, 'ACT-SAP-101') as kode_sap,
          COALESCE(r.satuan, ma.satuan, 'm3') as satuan,
          r.shift_kerja,
          r.shift_kerja as shift,
          COALESCE(r.status_spk, 'MENUNGGU') as status_spk,
          COALESCE(r.status_unit, 'OPERASI') as status_unit,
          COALESCE(r.keterangan_rencana, '') as keterangan_rencana,
          r.created_at
        FROM rencana_kerja r
        LEFT JOIN units u ON r.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
        LEFT JOIN operators op ON (r.operator = op.nama_operator OR op.nik = r.operator)
        LEFT JOIN aktivitas_unit ma ON (
          (r.id_aktivitas IS NOT NULL AND ma.id = r.id_aktivitas) OR
          (r.kode_sap IS NOT NULL AND ma.kode_sap = r.kode_sap) OR
          (r.nama_aktivitas IS NOT NULL AND LOWER(ma.nama_aktivitas) = LOWER(r.nama_aktivitas))
        )
        WHERE (r.status_spk IN ('SPK_TERBIT', 'MENUNGGU', 'MENUNGGU_SPK') OR r.status_spk IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM hasil_input_aktivitas h 
            WHERE h.rencana_id = r.id 
               OR (
                 (h.rencana_id IS NULL OR h.rencana_id = '') 
                 AND h.kode_unit = r.kode_unit 
                 AND (h.tanggal = r.tanggal OR h.tanggal_kerja = r.tanggal) 
                 AND LOWER(h.shift_kerja) = LOWER(r.shift_kerja)
               )
          )
      `;
      const rkParams: (string | number)[] = [];

      if (resolvedSupervisorName) {
        rkSql += ` AND (LOWER(r.nama_pengawas) = LOWER(?) OR r.nama_pengawas = ? OR LOWER(r.nama_pengawas) = LOWER(?))`;
        rkParams.push(resolvedSupervisorName, resolvedSupervisorName, resolvedUsername || resolvedSupervisorName);
      }

      rkSql += ` ORDER BY r.tanggal DESC, r.created_at DESC`;

      interface RawRencanaAktif {
        id: string;
        id_rencana_kerja: string;
        rencana_id: string;
        nomor_spk: string | null;
        tanggal: string;
        tanggal_kerja: string;
        nama_pengawas: string;
        kode_unit: string;
        model_unit: string;
        jenis_unit: string;
        hm_terakhir: number;
        hm_unit_terakhir: number;
        hm_min_standar: number;
        hm_max_standar: number;
        operator: string;
        nik_operator: string;
        kode_lokasi: string;
        lokasi: string;
        nama_lokasi: string;
        wilayah: string;
        aktivitas: string;
        nama_aktivitas: string;
        kode_sap: string;
        satuan: string;
        shift_kerja: string;
        shift: string;
        status_spk: string;
        status_unit: string;
        keterangan_rencana: string;
        created_at: string;
      }

      const rawRencanaList = queryAll<RawRencanaAktif>(rkSql, rkParams);
      const rencana_aktif = rawRencanaList.map((r) => ({
        id: r.id,
        id_rencana_kerja: r.id,
        rencana_id: r.id,
        nomor_spk: r.nomor_spk || null,
        unit: r.kode_unit,
        kode_unit: r.kode_unit,
        nama_unit: r.model_unit || r.kode_unit,
        model_unit: r.model_unit || r.kode_unit,
        jenis_unit: r.jenis_unit || '-',
        operator: r.operator,
        nama_operator: r.operator,
        nik_operator: r.nik_operator || '-',
        lokasi: r.lokasi,
        kode_lokasi: r.kode_lokasi,
        nama_lokasi: r.nama_lokasi,
        wilayah: r.wilayah,
        aktivitas: r.aktivitas,
        nama_aktivitas: r.nama_aktivitas,
        kode_sap: r.kode_sap,
        satuan: r.satuan,
        shift: r.shift,
        shift_kerja: r.shift_kerja,
        hm_terakhir: Number(r.hm_terakhir || 0),
        hm_unit_terakhir: Number(r.hm_unit_terakhir || 0),
        hm_awal_rekomendasi: Number(r.hm_terakhir || 0),
        hm_min_standar: r.hm_min_standar,
        hm_max_standar: r.hm_max_standar,
        status_spk: r.status_spk,
        status_unit: r.status_unit || 'OPERASI',
        tanggal: r.tanggal,
        tanggal_kerja: r.tanggal_kerja || r.tanggal,
        keterangan_rencana: r.keterangan_rencana || '',
        created_at: r.created_at
      }));

      // ------------------------------------------------------------------
      // 4. LOGIKA 2: RIWAYAT REALISASI PENGAWAS (30 Hari Terakhir)
      //    Data hasil_input_aktivitas (realisasi aktivitas unit) milik pengawas
      // ------------------------------------------------------------------
      let riwayatSql = `
        SELECT 
          h.id,
          h.uuid,
          h.client_transaction_id,
          h.rencana_id,
          h.nama_pengawas,
          h.tanggal,
          COALESCE(h.tanggal_kerja, h.tanggal) as tanggal_kerja,
          h.kode_unit,
          COALESCE(u.model_unit, h.kode_unit) as model_unit,
          COALESCE(u.jenis_unit, '-') as jenis_unit,
          h.nama_aktivitas,
          h.kode_sap,
          h.satuan,
          h.operator,
          h.nik_operator,
          h.kode_lokasi,
          COALESCE(h.lokasi, l.wilayah, h.kode_lokasi) as lokasi,
          h.nomor_spk,
          h.shift_kerja,
          h.jam_kerja,
          h.hm_awal,
          h.hm_akhir,
          h.hm_harian_berjalan,
          h.hasil_kerja,
          h.keterangan,
          h.status_unit,
          h.is_isi_solar,
          h.jumlah_liter_solar,
          COALESCE(h.stik_solar_awal, h.stik_awal) as stik_solar_awal,
          COALESCE(h.stik_solar_akhir, h.stik_akhir) as stik_solar_akhir,
          COALESCE(h.stik_solar_awal, h.stik_awal) as stik_awal,
          COALESCE(h.stik_solar_akhir, h.stik_akhir) as stik_akhir,
          COALESCE(h.estimasi_konsumsi_solar, 0) as estimasi_konsumsi_solar,
          COALESCE(h.ada_kendala, CASE WHEN h.kendala_list IS NOT NULL AND TRIM(h.kendala_list) != '' AND TRIM(h.kendala_list) != '[]' THEN 1 ELSE 0 END) as ada_kendala,
          h.kendala_list,
          h.is_hm_awal_corrected,
          h.alasan_koreksi_hm,
          h.created_at,
          CASE WHEN h.foto_bukti IS NOT NULL AND LENGTH(h.foto_bukti) > 0 THEN 1 ELSE 0 END as has_foto
        FROM hasil_input_aktivitas h
        LEFT JOIN units u ON h.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON h.kode_lokasi = l.kode_lokasi
        WHERE 1=1
      `;
      const riwayatParams: (string | number)[] = [];

      if (resolvedSupervisorName) {
        riwayatSql += ` AND (LOWER(h.nama_pengawas) = LOWER(?) OR h.nama_pengawas = ? OR LOWER(h.nama_pengawas) = LOWER(?))`;
        riwayatParams.push(resolvedSupervisorName, resolvedSupervisorName, resolvedUsername || resolvedSupervisorName);
      }

      riwayatSql += ` AND (h.tanggal >= ? OR h.tanggal_kerja >= ?)`;
      riwayatParams.push(date30DaysAgoStr, date30DaysAgoStr);

      riwayatSql += ` ORDER BY h.tanggal DESC, h.created_at DESC`;

      interface RawRiwayatRow extends HasilInputAktivitasRow {
        model_unit: string;
        jenis_unit: string;
        has_foto: number;
      }

      const rawRiwayatList = queryAll<RawRiwayatRow>(riwayatSql, riwayatParams);
      const riwayat_aktivitas = rawRiwayatList.map((h) => {
        let parsedKendala: unknown = h.kendala_list;
        if (typeof h.kendala_list === 'string' && h.kendala_list.trim() !== '') {
          try {
            parsedKendala = JSON.parse(h.kendala_list);
          } catch {
            parsedKendala = h.kendala_list;
          }
        }

        return {
          id: h.id,
          uuid: h.uuid || null,
          client_transaction_id: h.client_transaction_id || null,
          rencana_id: h.rencana_id || null,
          nomor_spk: h.nomor_spk || null,
          tanggal: h.tanggal,
          tanggal_kerja: h.tanggal_kerja || h.tanggal,
          shift: h.shift_kerja,
          shift_kerja: h.shift_kerja,
          unit: h.kode_unit,
          kode_unit: h.kode_unit,
          model_unit: h.model_unit,
          operator: h.operator,
          nik_operator: h.nik_operator,
          durasi_jam_kerja: Number(h.jam_kerja || 0),
          jam_kerja: Number(h.jam_kerja || 0),
          hm_awal: Number(h.hm_awal || 0),
          hm_akhir: Number(h.hm_akhir || 0),
          durasi_hm: Number(h.hm_harian_berjalan || 0),
          hm_harian_berjalan: Number(h.hm_harian_berjalan || 0),
          solar: Number(h.jumlah_liter_solar || 0),
          jumlah_liter_solar: Number(h.jumlah_liter_solar || 0),
          is_isi_solar: Number(h.is_isi_solar || 0),
          stik_awal: h.stik_awal != null ? Number(h.stik_awal) : (h.stik_solar_awal != null ? Number(h.stik_solar_awal) : null),
          stik_akhir: h.stik_akhir != null ? Number(h.stik_akhir) : (h.stik_solar_akhir != null ? Number(h.stik_solar_akhir) : null),
          stik_solar_awal: h.stik_solar_awal != null ? Number(h.stik_solar_awal) : (h.stik_awal != null ? Number(h.stik_awal) : null),
          stik_solar_akhir: h.stik_solar_akhir != null ? Number(h.stik_solar_akhir) : (h.stik_akhir != null ? Number(h.stik_akhir) : null),
          estimasi_konsumsi_solar: h.estimasi_konsumsi_solar != null ? Number(h.estimasi_konsumsi_solar) : 0,
          ada_kendala: Number(h.ada_kendala || 0),
          status: h.status_unit || 'OPERASI',
          status_unit: h.status_unit || 'OPERASI',
          kendala: parsedKendala,
          kendala_list: parsedKendala,
          aktivitas: h.nama_aktivitas,
          nama_aktivitas: h.nama_aktivitas,
          kode_sap: h.kode_sap,
          satuan: h.satuan,
          lokasi: h.lokasi,
          kode_lokasi: h.kode_lokasi,
          hasil_kerja: Number(h.hasil_kerja || 0),
          keterangan: h.keterangan || '',
          foto_bukti_url: `/api/rekapitulasi/${h.id}/foto`,
          has_foto_bukti: Boolean(h.has_foto),
          is_hm_awal_corrected: Boolean(h.is_hm_awal_corrected),
          alasan_koreksi_hm: h.alasan_koreksi_hm || null,
          created_at: h.created_at
        };
      });

      // ------------------------------------------------------------------
      // 5. LOGIKA 3: MASTER DATA PENDUKUNG (Unit, Lokasi, Aktivitas, Operator, Kendala, Kasie)
      // ------------------------------------------------------------------
      const masterUnits = queryAll<UnitRow>(
        `SELECT id, kode_unit, jenis_unit, model_unit, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, (SELECT wilayah FROM users WHERE nama_lengkap = units.nama_pengawas OR username = units.nama_pengawas), 'PG1') as wilayah, hm_unit_terakhir_diinputkan as hm_terakhir, hm_unit_terakhir_diinputkan, hm_min_standar, hm_max_standar, status_aktif, updated_at FROM units WHERE status_aktif = 1 ORDER BY kode_unit ASC`
      );
      const masterLokasi = queryAll<LokasiRow>(
        `SELECT kode_lokasi, wilayah, luas_bruto, luas_netto, status_aktif, created_at FROM lokasi WHERE status_aktif = 1 ORDER BY kode_lokasi ASC`
      );
      const masterAktivitas = queryAll<AktivitasUnitRow>(
        `SELECT id, uuid, jenis_unit, nama_aktivitas, satuan, kode_sap, COALESCE(kategori_status, 'OPERASI') as kategori_status, COALESCE(status_unit, kategori_status, 'OPERASI') as status_unit, status_aktif, COALESCE(wilayah, 'PG1') as wilayah FROM aktivitas_unit WHERE status_aktif = 1 ORDER BY jenis_unit ASC, nama_aktivitas ASC`
      );
      const masterOperator = queryAll<OperatorRow>(
        `SELECT id, nama_operator, nik, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, (SELECT wilayah FROM users WHERE nama_lengkap = operators.nama_pengawas OR username = operators.nama_pengawas), 'PG1') as wilayah, status_aktif FROM operators WHERE status_aktif = 1 ORDER BY nama_operator ASC`
      );
      const masterKendala = queryAll<MasterKendalaRow>(
        `SELECT id, nama_kendala, status_aktif, created_at FROM master_kendala WHERE status_aktif = 1 ORDER BY id ASC`
      );
      const masterKasie = queryAll<UserRow>(
        `SELECT id, nama_lengkap, username, hak_akses, role, wilayah, status_aktif FROM users WHERE (hak_akses = 'Kasie' OR hak_akses = 'Pengawas' OR role = 'SUPERVISOR') AND status_aktif = 1 ORDER BY nama_lengkap ASC`
      );
      const masterUsers = queryAll<UserRow>(
        `SELECT id, nama_lengkap, username, hak_akses, role, wilayah, status_aktif FROM users WHERE status_aktif = 1 ORDER BY id ASC`
      );

      const minSetting = queryOne<AppSettingRow>("SELECT value FROM app_settings WHERE key = 'hm_min_standar'");
      const maxSetting = queryOne<AppSettingRow>("SELECT value FROM app_settings WHERE key = 'hm_max_standar'");
      const hmStandar = {
        min: minSetting ? parseFloat(minSetting.value) || 6.0 : 6.0,
        max: maxSetting ? parseFloat(maxSetting.value) || 10.0 : 10.0
      };

      // ------------------------------------------------------------------
      // 6. LOGIKA 4: RINGKASAN METRIK ANALITIK
      //    Total Jam Operasi, Total HM berjalan, Total Solar, dan Jumlah Unit Terselesaikan
      // ------------------------------------------------------------------
      interface StatRow {
        total_laporan: number;
        total_hm: number;
        total_solar: number;
        total_jam_operasi: number;
        unit_terselesaikan: number;
      }

      // Agregasi untuk tanggal operasional yang diminta
      let todayStatSql = `
        SELECT 
          COUNT(*) as total_laporan,
          COALESCE(ROUND(SUM(hm_harian_berjalan), 1), 0.0) as total_hm,
          COALESCE(ROUND(SUM(jumlah_liter_solar), 1), 0.0) as total_solar,
          COALESCE(ROUND(SUM(jam_kerja), 1), 0.0) as total_jam_operasi,
          COUNT(DISTINCT kode_unit) as unit_terselesaikan
        FROM hasil_input_aktivitas
        WHERE (tanggal = ? OR tanggal_kerja = ?)
      `;
      const todayStatParams: (string | number)[] = [operationalDate, operationalDate];

      if (resolvedSupervisorName) {
        todayStatSql += ` AND (LOWER(nama_pengawas) = LOWER(?) OR nama_pengawas = ? OR LOWER(nama_pengawas) = LOWER(?))`;
        todayStatParams.push(resolvedSupervisorName, resolvedSupervisorName, resolvedUsername || resolvedSupervisorName);
      }
      const todayStats = queryOne<StatRow>(todayStatSql, todayStatParams);

      // Agregasi kumulatif 30 hari terakhir
      let monthStatSql = `
        SELECT 
          COUNT(*) as total_laporan,
          COALESCE(ROUND(SUM(hm_harian_berjalan), 1), 0.0) as total_hm,
          COALESCE(ROUND(SUM(jumlah_liter_solar), 1), 0.0) as total_solar,
          COALESCE(ROUND(SUM(jam_kerja), 1), 0.0) as total_jam_operasi,
          COUNT(DISTINCT kode_unit) as unit_terselesaikan
        FROM hasil_input_aktivitas
        WHERE (tanggal >= ? OR tanggal_kerja >= ?)
      `;
      const monthStatParams: (string | number)[] = [date30DaysAgoStr, date30DaysAgoStr];

      if (resolvedSupervisorName) {
        monthStatSql += ` AND (LOWER(nama_pengawas) = LOWER(?) OR nama_pengawas = ? OR LOWER(nama_pengawas) = LOWER(?))`;
        monthStatParams.push(resolvedSupervisorName, resolvedSupervisorName, resolvedUsername || resolvedSupervisorName);
      }
      const monthStats = queryOne<StatRow>(monthStatSql, monthStatParams);

      // Sesuai spesifikasi prompt format JSON ringkasan_analitik:
      const ringkasan_analitik = {
        total_hm: Number(todayStats?.total_hm || 0),
        total_solar: Number(todayStats?.total_solar || 0),
        total_laporan: Number(todayStats?.total_laporan || 0),
        total_jam_operasi: Number(todayStats?.total_jam_operasi || 0),
        jumlah_unit_terselesaikan: Number(todayStats?.unit_terselesaikan || 0),
        kumulatif_30_hari: {
          total_hm: Number(monthStats?.total_hm || 0),
          total_solar: Number(monthStats?.total_solar || 0),
          total_laporan: Number(monthStats?.total_laporan || 0),
          total_jam_operasi: Number(monthStats?.total_jam_operasi || 0),
          jumlah_unit_terselesaikan: Number(monthStats?.unit_terselesaikan || 0)
        }
      };

      const durationMs = Date.now() - startTime;

      // 7. Payload Response
      res.json({
        success: true,
        pengawas: resolvedSupervisorName || rawPengawas || 'Semua',
        tanggal: operationalDate,
        synced_at: new Date().toISOString(),
        execution_time_ms: durationMs,
        rencana_aktif,
        riwayat_aktivitas,
        master_data: {
          unit: masterUnits,
          lokasi: masterLokasi,
          aktivitas: masterAktivitas,
          operator: masterOperator,
          kendala: masterKendala,
          kasie: masterKasie,
          users: masterUsers,
          hm_standar: hmStandar
        },
        ringkasan_analitik
      });
    } catch (err: unknown) {
      console.error('Error in /api/mobile/bootstrap-data:', err);
      res.status(500).json({
        success: false,
        error: (err as Error).message
      });
    }
  };

  app.get(['/api/mobile/bootstrap-data', '/api/mobile/bootstrap'], handleMobileBootstrap);
  app.post(['/api/mobile/bootstrap-data', '/api/mobile/bootstrap'], handleMobileBootstrap);

  // 1. GET /api/master-data?pengawas=:nama
  // Bundle master data (units, aktivitas, operators, lokasi) filtered by supervisor for Android offline sync
  app.get('/api/master-data', (req: Request, res: Response) => {
    try {
      const pengawas = (req.query.pengawas as string | undefined)?.trim();

      let units: UnitRow[];
      let operators: OperatorRow[];
      let aktivitas: AktivitasUnitRow[];
      const lokasi: LokasiRow[] = queryAll<LokasiRow>('SELECT * FROM lokasi WHERE status_aktif = 1 ORDER BY kode_lokasi ASC');
      const kendala: MasterKendalaRow[] = queryAll<MasterKendalaRow>('SELECT * FROM master_kendala WHERE status_aktif = 1 ORDER BY id ASC');
      const usersList: UserRow[] = queryAll<UserRow>('SELECT id, nama_lengkap, username, hak_akses, role, wilayah, status_aktif FROM users WHERE status_aktif = 1 ORDER BY id ASC');
      const kasieList: UserRow[] = queryAll<UserRow>("SELECT id, nama_lengkap, username, hak_akses, role, wilayah, status_aktif FROM users WHERE (hak_akses = 'Kasie' OR hak_akses = 'Pengawas' OR role = 'SUPERVISOR') AND status_aktif = 1 ORDER BY nama_lengkap ASC");

      const minSetting = queryOne<AppSettingRow>("SELECT value FROM app_settings WHERE key = 'hm_min_standar'");
      const maxSetting = queryOne<AppSettingRow>("SELECT value FROM app_settings WHERE key = 'hm_max_standar'");
      const hm_min = minSetting ? parseFloat(minSetting.value) || 6.0 : 6.0;
      const hm_max = maxSetting ? parseFloat(maxSetting.value) || 10.0 : 10.0;
      const hm_standar = { min: hm_min, max: hm_max };

      if (pengawas && pengawas !== 'Semua') {
        units = queryAll<UnitRow>('SELECT id, kode_unit, jenis_unit, model_unit, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, (SELECT wilayah FROM users WHERE nama_lengkap = units.nama_pengawas OR username = units.nama_pengawas), "PG1") as wilayah, hm_unit_terakhir_diinputkan, hm_min_standar, hm_max_standar, status_aktif, updated_at FROM units WHERE (nama_pengawas = ? OR kasie = ?) AND status_aktif = 1 ORDER BY kode_unit ASC', [pengawas, pengawas]);
        operators = queryAll<OperatorRow>('SELECT id, nama_operator, nik, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, (SELECT wilayah FROM users WHERE nama_lengkap = operators.nama_pengawas OR username = operators.nama_pengawas), "PG1") as wilayah, status_aktif FROM operators WHERE (nama_pengawas = ? OR kasie = ?) AND status_aktif = 1 ORDER BY nama_operator ASC', [pengawas, pengawas]);
        aktivitas = queryAll<AktivitasUnitRow>('SELECT id, uuid, jenis_unit, nama_aktivitas, satuan, kode_sap, COALESCE(kategori_status, \'OPERASI\') as kategori_status, COALESCE(status_unit, kategori_status, \'OPERASI\') as status_unit, status_aktif, COALESCE(wilayah, "PG1") as wilayah FROM aktivitas_unit WHERE status_aktif = 1 ORDER BY jenis_unit ASC, nama_aktivitas ASC');
      } else {
        units = queryAll<UnitRow>('SELECT id, kode_unit, jenis_unit, model_unit, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, (SELECT wilayah FROM users WHERE nama_lengkap = units.nama_pengawas OR username = units.nama_pengawas), "PG1") as wilayah, hm_unit_terakhir_diinputkan, hm_min_standar, hm_max_standar, status_aktif, updated_at FROM units WHERE status_aktif = 1 ORDER BY kode_unit ASC');
        operators = queryAll<OperatorRow>('SELECT id, nama_operator, nik, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, (SELECT wilayah FROM users WHERE nama_lengkap = operators.nama_pengawas OR username = operators.nama_pengawas), "PG1") as wilayah, status_aktif FROM operators WHERE status_aktif = 1 ORDER BY nama_operator ASC');
        aktivitas = queryAll<AktivitasUnitRow>('SELECT id, uuid, jenis_unit, nama_aktivitas, satuan, kode_sap, COALESCE(kategori_status, \'OPERASI\') as kategori_status, COALESCE(status_unit, kategori_status, \'OPERASI\') as status_unit, status_aktif, COALESCE(wilayah, "PG1") as wilayah FROM aktivitas_unit WHERE status_aktif = 1 ORDER BY jenis_unit ASC, nama_aktivitas ASC');
      }

      res.json({
        status: 'success',
        synced_at: new Date().toISOString(),
        pengawas_filter: pengawas || 'Semua',
        total_units: units.length,
        total_operators: operators.length,
        total_aktivitas: aktivitas.length,
        total_lokasi: lokasi.length,
        total_kendala: kendala.length,
        total_kasie: kasieList.length,
        hm_standar,
        data: {
          units,
          aktivitas,
          operators,
          lokasi,
          kendala,
          kasie: kasieList,
          users: usersList,
          hm_standar
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
      const { search, pengawas, pengawas_id, status_spk, tanggal, wilayah } = req.query;
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

      if (wilayah && typeof wilayah === 'string' && wilayah.toUpperCase() !== 'SEMUA' && wilayah !== 'Semua Wilayah') {
        sql += ' AND (r.wilayah = ? OR u.wilayah = ? OR l.wilayah = ? OR r.nama_pengawas IN (SELECT nama_lengkap FROM users WHERE wilayah = ?))';
        params.push(wilayah, wilayah, wilayah, wilayah);
      }

      const rawPengawasFilter = (pengawas_id || pengawas) as string | undefined;
      if (rawPengawasFilter && typeof rawPengawasFilter === 'string' && rawPengawasFilter.trim() !== '' && rawPengawasFilter !== 'Semua') {
        const p = rawPengawasFilter.trim();
        sql += ' AND (r.nama_pengawas = ? OR r.nama_pengawas IN (SELECT nama_lengkap FROM users WHERE username = ? OR CAST(id AS TEXT) = ?))';
        params.push(p, p, p);
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

      // Pastikan field nomor_spk, status_spk, dan updated_at selalu disertakan dalam response JSON & deduplikasi ID
      const seenIds = new Set<string>();
      const formattedRows = rows
        .filter(r => {
          if (!r.id || seenIds.has(String(r.id))) return false;
          seenIds.add(String(r.id));
          return true;
        })
        .map(r => ({
          ...r,
          nomor_spk: r.nomor_spk !== undefined && r.nomor_spk !== null && r.nomor_spk !== '' ? String(r.nomor_spk) : null,
          status_spk: (r.status_spk as string) || (r.nomor_spk ? 'SPK_TERBIT' : 'MENUNGGU_SPK'),
          nama_aktivitas: r.nama_aktivitas || r.aktivitas || r.keterangan_rencana || '-',
          aktivitas: r.aktivitas || r.nama_aktivitas || r.keterangan_rencana || '-',
          kode_sap: r.kode_sap || 'ACT-SAP-101',
          satuan: r.satuan || 'm3',
          updated_at: r.updated_at || r.created_at
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
        keterangan_rencana,
        nama_aktivitas: rawNamaAktivitas,
        aktivitas: rawAktivitas,
        id_aktivitas: rawIdAktivitas,
        kode_sap: rawKodeSap,
        satuan: rawSatuan
      } = req.body;

      if (!nama_pengawas || !kode_unit || !operator || !kode_lokasi) {
        return res.status(400).json({
          error: 'Field wajib tidak lengkap: nama_pengawas, kode_unit, operator, dan kode_lokasi diperlukan.'
        });
      }

      const id = (customId && String(customId).trim()) || `RK-${Date.now()}`;
      // Normalisasi format tanggal bisnis (ke ISO YYYY-MM-DD) dan simpan langsung ke kolom tanggal SQLite
      const tgl = formatToISODate(tanggal);
      const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const shift_kerja = (rawShift || 'SIANG').toUpperCase();
      const status_spk = rawStatusSpk || (nomor_spk ? 'SPK_TERBIT' : 'MENUNGGU_SPK');

      // Ambil nilai wilayah dari payload, ATAU cari otomatis dari tabel users berdasarkan Kasie penanggung jawab yang dipilih
      let resolvedWilayah = (req.body.wilayah || '').toString().trim();
      if (!resolvedWilayah || resolvedWilayah === 'Semua' || resolvedWilayah === 'Semua Wilayah') {
        const userRow = queryOne<{ wilayah: string }>(
          'SELECT wilayah FROM users WHERE LOWER(nama_lengkap) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1',
          [nama_pengawas, nama_pengawas]
        );
        if (userRow?.wilayah && userRow.wilayah !== 'Semua Wilayah') {
          resolvedWilayah = userRow.wilayah;
        } else if (nama_pengawas.toLowerCase().includes('budi')) {
          resolvedWilayah = 'PG1';
        } else if (nama_pengawas.toLowerCase().includes('agus')) {
          resolvedWilayah = 'PG2';
        } else if (nama_pengawas.toLowerCase().includes('rudi')) {
          resolvedWilayah = 'PG3';
        } else {
          const unitRow = queryOne<{ wilayah: string }>('SELECT wilayah FROM units WHERE kode_unit = ? LIMIT 1', [kode_unit]);
          if (unitRow?.wilayah) {
            resolvedWilayah = unitRow.wilayah;
          } else {
            const lokRow = queryOne<{ wilayah: string }>('SELECT wilayah FROM lokasi WHERE kode_lokasi = ? LIMIT 1', [kode_lokasi]);
            resolvedWilayah = lokRow?.wilayah || 'PG1';
          }
        }
      }

      let resolvedNamaAktivitas = (rawNamaAktivitas || rawAktivitas || keterangan_rencana || '').trim();
      let resolvedKodeSap = (rawKodeSap || '').trim();
      let resolvedSatuan = (rawSatuan || 'm3').trim();

      // Look up master activity by ID or Kode SAP or matching name to get kategori_status automatically
      let actMatch: AktivitasUnitRow | null = null;
      if (rawIdAktivitas) {
        actMatch = queryOne<AktivitasUnitRow>('SELECT * FROM master_aktivitas WHERE id = ?', [rawIdAktivitas]);
      }
      if (!actMatch && resolvedKodeSap) {
        actMatch = queryOne<AktivitasUnitRow>('SELECT * FROM master_aktivitas WHERE kode_sap = ?', [resolvedKodeSap]);
      }
      if (!actMatch && resolvedNamaAktivitas) {
        actMatch = queryOne<AktivitasUnitRow>(
          'SELECT * FROM master_aktivitas WHERE LOWER(nama_aktivitas) = LOWER(?) OR LOWER(?) LIKE "%" || LOWER(nama_aktivitas) || "%" LIMIT 1',
          [resolvedNamaAktivitas, resolvedNamaAktivitas]
        );
      }

      if (actMatch) {
        if (!rawNamaAktivitas && !rawAktivitas) resolvedNamaAktivitas = actMatch.nama_aktivitas;
        if (!resolvedKodeSap) resolvedKodeSap = actMatch.kode_sap;
        if (!rawSatuan) resolvedSatuan = actMatch.satuan;
      }
      if (!resolvedKodeSap) {
        resolvedKodeSap = 'ACT-SAP-101';
      }

      // Otomatis tentukan status_unit berdasarkan kategori_status dari master aktivitas
      const autoStatus = actMatch?.kategori_status || actMatch?.status_unit || null;
      const statusCandidate = (rawStatusUnit || autoStatus || 'OPERASI').toUpperCase();
      const status_unit = ['OPERASI', 'STANDBY', 'BREAKDOWN'].includes(statusCandidate)
        ? statusCandidate
        : 'OPERASI';

      const insertSql = `
        INSERT INTO rencana_kerja (
          id, nama_pengawas, tanggal, status_unit, kode_unit,
          operator, kode_lokasi, shift_kerja, nomor_spk, status_spk,
          keterangan_rencana, nama_aktivitas, aktivitas, kode_sap, satuan,
          wilayah, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        resolvedNamaAktivitas || keterangan_rencana || '',
        resolvedNamaAktivitas || keterangan_rencana || '',
        resolvedKodeSap,
        resolvedSatuan,
        resolvedWilayah,
        createdAt,
        createdAt
      ]);

      const newRow = queryOne<RencanaKerjaRow>(`
        SELECT r.*, u.model_unit, l.wilayah
        FROM rencana_kerja r
        LEFT JOIN units u ON r.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
        WHERE r.id = ?
      `, [id]);

      // Payload rencana kerja baru untuk sinkronisasi real-time ke Beranda
      const dataRencanaBaru = {
        ...newRow,
        id: newRow?.id || id,
        id_rencana_kerja: newRow?.id || id,
        rencana_id: newRow?.id || id,
        nama_pengawas,
        tanggal: tgl,
        tanggal_kerja: tgl,
        kode_unit,
        model_unit: newRow?.model_unit,
        operator,
        nik_operator: '-',
        kode_lokasi,
        lokasi: newRow?.wilayah || kode_lokasi,
        wilayah: newRow?.wilayah,
        shift_kerja: shift_kerja === 'MALAM' ? 'Malam' : 'Siang',
        status_unit,
        nomor_spk: nomor_spk || null,
        status_spk: newRow?.status_spk || status_spk || 'MENUNGGU',
        status_realisasi: 'BELUM_INPUT',
        nama_aktivitas: resolvedNamaAktivitas || keterangan_rencana || '-',
        aktivitas: resolvedNamaAktivitas || keterangan_rencana || '-',
        keterangan_rencana: keterangan_rencana || '',
        keterangan: keterangan_rencana || '',
        kode_sap: resolvedKodeSap,
        satuan: resolvedSatuan || 'm3',
        hm_awal: null,
        hm_akhir: null,
        hm_harian_berjalan: null,
        durasi_hm: null,
        jam_kerja: null,
        hasil_kerja: null,
        is_isi_solar: 0,
        jumlah_liter_solar: null,
        stik_awal: null,
        stik_akhir: null,
        kendala_list: null,
        foto_bukti: null,
        has_foto_bukti: false,
        created_at: createdAt,
        timestamp: new Date().toISOString()
      };

      // 1. Broadcast event WebSocket NEW_RENCANA_KERJA ke seluruh client admin agar Beranda ter-update instan
      io.emit("NEW_RENCANA_KERJA", {
        ...dataRencanaBaru,
        nama_aktivitas: dataRencanaBaru.nama_aktivitas || dataRencanaBaru.aktivitas,
        kode_sap: dataRencanaBaru.kode_sap,
      });

      console.log(`✨ [TRANS-OK] Rencana kerja #${id} tersimpan (Aktivitas: ${dataRencanaBaru.nama_aktivitas}, SAP: ${dataRencanaBaru.kode_sap}) & dibroadcast via io.emit('NEW_RENCANA_KERJA')`);

      res.status(201).json({
        status: 'success',
        message: 'Rencana kerja berhasil disimpan.',
        data: dataRencanaBaru
      });
    } catch (err: unknown) {
      console.error('Error saving rencana-kerja:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Fallback endpoint for Android mobile reconnect resilience: GET /api/rencana-kerja/active-spk
  app.get('/api/rencana-kerja/active-spk', (req: Request, res: Response) => {
    try {
      const pengawas = (req.query.pengawas as string | undefined)?.trim();
      const tanggal = (req.query.tanggal as string | undefined)?.trim();
      const unit = (req.query.unit as string | undefined)?.trim();

      let sql = `
        SELECT r.*, u.model_unit, l.wilayah
        FROM rencana_kerja r
        LEFT JOIN units u ON r.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
        WHERE r.status_spk = 'SPK_TERBIT'
      `;
      const params: string[] = [];

      if (pengawas) {
        sql += ' AND (LOWER(r.nama_pengawas) = LOWER(?) OR r.nama_pengawas = ?)';
        params.push(pengawas, pengawas);
      }
      if (tanggal) {
        sql += ' AND (r.tanggal = ? OR r.tanggal_kerja = ?)';
        params.push(tanggal, tanggal);
      }
      if (unit) {
        sql += ' AND r.kode_unit = ?';
        params.push(unit);
      }

      sql += ' ORDER BY r.tanggal DESC, r.created_at DESC';
      const rows = queryAll<RencanaKerjaRow>(sql, params);

      const activeSpks = rows.map(r => ({
        ...r,
        id_rencana_kerja: r.id,
        shift: r.shift_kerja,
        unit_id: r.kode_unit,
        nama_unit: r.model_unit || r.kode_unit,
        lokasi: r.wilayah || r.kode_lokasi,
        pengawas: r.nama_pengawas,
        aktivitas: r.keterangan_rencana || 'Operasional Lapangan'
      }));

      res.json({
        status: 'success',
        count: activeSpks.length,
        data: activeSpks
      });
    } catch (err: unknown) {
      console.error('Error fetching active SPKs:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST & PUT /api/rencana-kerja/:id/terbitkan-spk: Admin menerbitkan nomor SPK
  // Begitu SPK terbit, kirim broadcast WebSocket ke Android agar nomor SPK otomatis terisi di form realisasi pengawas.
  const handleTerbitkanSpkRoute = (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const existing = queryOne<RencanaKerjaRow>('SELECT * FROM rencana_kerja WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Rencana kerja tidak ditemukan.' });
      }

      // 1. Generate nomor SPK resmi: SPK/CE/YYYY/MM/NNN (misal: 'SPK/CE/2026/10/375')
      let generatedNomorSpk = typeof req.body?.nomor_spk === 'string' ? req.body.nomor_spk.trim() : '';
      if (!generatedNomorSpk) {
        const d = existing.tanggal || new Date().toISOString().slice(0, 10);
        const [yyyy, mm] = d.split('-');
        const prefix = `SPK/CE/${yyyy}/${mm}/`;
        
        const existingSpks = queryAll<{ nomor_spk: string }>(
          "SELECT nomor_spk FROM rencana_kerja WHERE nomor_spk LIKE ?",
          [`${prefix}%`]
        );
        let maxSeq = 0;
        for (const row of existingSpks) {
          if (row.nomor_spk) {
            const parts = row.nomor_spk.split('/');
            const lastPart = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastPart) && lastPart > maxSeq) {
              maxSeq = lastPart;
            }
          }
        }
        const nextSeq = String(maxSeq + 1).padStart(3, '0');
        generatedNomorSpk = `${prefix}${nextSeq}`;
      }

      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

      // 2. Update data di database SQLite:
      //    status_spk = 'SPK_TERBIT'
      //    nomor_spk = generatedNomorSpk
      execute(
        `UPDATE rencana_kerja SET nomor_spk = ?, status_spk = 'SPK_TERBIT', updated_at = ? WHERE id = ?`,
        [generatedNomorSpk, now, id]
      );
      saveDb();

      const updatedRow = queryOne<RencanaKerjaRow>(`
        SELECT r.*, u.model_unit, l.wilayah
        FROM rencana_kerja r
        LEFT JOIN units u ON r.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
        WHERE r.id = ?
      `, [id]);

      if (!updatedRow) {
        return res.status(404).json({ success: false, error: 'Rencana kerja tidak ditemukan setelah pembaruan.' });
      }

      // 3. Payload SPK resmi sesuai spesifikasi Android RKCE Mobile
      const payloadSpk = {
        id_rencana_kerja: updatedRow.id,
        unit_kode: updatedRow.kode_unit,        // misal 'DT-102'
        nomor_spk: generatedNomorSpk,           // 'SPK/CE/2026/10/375'
        status_spk: 'SPK_TERBIT',
        pengawas: updatedRow.nama_pengawas,
        operator: updatedRow.operator,
        lokasi: updatedRow.wilayah || updatedRow.kode_lokasi,
        shift: updatedRow.shift_kerja,
        tanggal: updatedRow.tanggal,
        // Helper aliases untuk fleksibilitas klien
        id: updatedRow.id,
        unit: updatedRow.kode_unit,
        kode_unit: updatedRow.kode_unit,
        nama_unit: updatedRow.model_unit || updatedRow.kode_unit,
        model_unit: updatedRow.model_unit || updatedRow.kode_unit,
        nama_pengawas: updatedRow.nama_pengawas,
        kode_lokasi: updatedRow.kode_lokasi,
        shift_kerja: updatedRow.shift_kerja,
        aktivitas: updatedRow.nama_aktivitas || updatedRow.aktivitas || updatedRow.keterangan_rencana || 'Operasional Lapangan',
        published_at: now
      };

      // 4. WAJIB broadcast event WebSocket ke seluruh client mobile:
      io.emit("SPK_PUBLISHED", payloadSpk);
      io.emit("RENCANA_KERJA_UPDATED", payloadSpk);
      io.emit("SPK_TERBIT", payloadSpk);
      io.emit("UPDATE_RENCANA", payloadSpk);

      console.log(`📜 [SPK_PUBLISHED] Nomor SPK ${generatedNomorSpk} diterbitkan untuk Rencana #${id} & dibroadcast via WebSocket`);

      // 5. Kirim respon JSON 200 OK dengan payloadSpk tersebut ke Web Admin
      return res.status(200).json({
        success: true,
        status: 'success',
        message: `Nomor SPK ${generatedNomorSpk} berhasil diterbitkan & disinkronkan ke aplikasi Android.`,
        ...payloadSpk,
        data: {
          ...updatedRow,
          id: updatedRow.id,
          id_rencana_kerja: updatedRow.id,
          unit_kode: updatedRow.kode_unit,
          nomor_spk: generatedNomorSpk,
          status_spk: 'SPK_TERBIT'
        },
        payload: payloadSpk,
        payloadSpk
      });
    } catch (err: unknown) {
      console.error('Error updating SPK:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  };

  app.post('/api/rencana-kerja/:id/terbitkan-spk', handleTerbitkanSpkRoute);
  app.put('/api/rencana-kerja/:id/terbitkan-spk', handleTerbitkanSpkRoute);

  // ======================================================================
  // 2. ENDPOINT SYNC CHECK PENGGANTI MOCKUP:
  //    GET & POST /api/mobile/rencana-kerja/active?pengawas={nama_pengawas}
  //    Mengembalikan seluruh rencana kerja aktif pengawas beserta status SPK
  //    dan nomor SPK terbarunya dari database server SQLite
  // ======================================================================
  const handleMobileRencanaKerjaActive = (req: Request, res: Response) => {
    try {
      const rawPengawas = (
        (req.query.pengawas as string | undefined) ||
        (req.query.supervisor as string | undefined) ||
        (req.query.user_id as string | undefined) ||
        (req.query.nik as string | undefined) ||
        (req.body?.pengawas as string | undefined) ||
        (req.body?.supervisor as string | undefined)
      )?.trim();

      const rawTanggal = (
        (req.query.tanggal as string | undefined) ||
        (req.query.date as string | undefined) ||
        (req.body?.tanggal as string | undefined)
      )?.trim();

      let resolvedSupervisorName = '';
      let resolvedUsername = '';

      if (rawPengawas && rawPengawas !== 'Semua') {
        const user = queryOne<UserRow>(
          `SELECT * FROM users WHERE LOWER(nama_lengkap) = LOWER(?) OR LOWER(username) = LOWER(?) OR CAST(id AS TEXT) = ? LIMIT 1`,
          [rawPengawas, rawPengawas, rawPengawas]
        );
        if (user) {
          resolvedSupervisorName = user.nama_lengkap;
          resolvedUsername = user.username;
        } else {
          const op = queryOne<OperatorRow>(
            `SELECT * FROM operators WHERE nik = ? OR LOWER(nama_operator) = LOWER(?) LIMIT 1`,
            [rawPengawas, rawPengawas]
          );
          if (op && op.nama_pengawas) {
            resolvedSupervisorName = op.nama_pengawas;
          } else {
            resolvedSupervisorName = rawPengawas;
          }
        }
      }

      let sql = `
        SELECT 
          r.id,
          r.id as id_rencana_kerja,
          r.id as rencana_id,
          r.nomor_spk,
          r.status_spk,
          r.status_unit,
          r.tanggal,
          COALESCE(r.tanggal_kerja, r.tanggal) as tanggal_kerja,
          r.nama_pengawas,
          r.nama_pengawas as pengawas,
          r.kode_unit,
          r.kode_unit as unit_kode,
          r.kode_unit as unit,
          COALESCE(u.model_unit, r.kode_unit) as model_unit,
          COALESCE(u.model_unit, r.kode_unit) as nama_unit,
          COALESCE(u.jenis_unit, '-') as jenis_unit,
          COALESCE(u.hm_unit_terakhir_diinputkan, 0) as hm_terakhir,
          COALESCE(u.hm_unit_terakhir_diinputkan, 0) as hm_unit_terakhir,
          COALESCE(u.hm_min_standar, 6.0) as hm_min_standar,
          COALESCE(u.hm_max_standar, 10.0) as hm_max_standar,
          r.operator,
          COALESCE(op.nik, '-') as nik_operator,
          r.kode_lokasi,
          COALESCE(l.wilayah, r.kode_lokasi) as lokasi,
          COALESCE(l.wilayah, r.kode_lokasi) as nama_lokasi,
          COALESCE(l.wilayah, r.kode_lokasi) as wilayah,
          COALESCE(r.nama_aktivitas, r.aktivitas, ma.nama_aktivitas, r.keterangan_rencana, 'Operasional Lapangan') as aktivitas,
          COALESCE(r.nama_aktivitas, r.aktivitas, ma.nama_aktivitas, r.keterangan_rencana, 'Operasional Lapangan') as nama_aktivitas,
          COALESCE(r.kode_sap, ma.kode_sap, 'ACT-SAP-101') as kode_sap,
          COALESCE(r.satuan, ma.satuan, 'm3') as satuan,
          r.shift_kerja,
          r.shift_kerja as shift,
          COALESCE(r.keterangan_rencana, '') as keterangan_rencana,
          r.created_at,
          r.updated_at
        FROM rencana_kerja r
        LEFT JOIN units u ON r.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
        LEFT JOIN operators op ON (r.operator = op.nama_operator OR op.nik = r.operator)
        LEFT JOIN aktivitas_unit ma ON (
          (r.id_aktivitas IS NOT NULL AND ma.id = r.id_aktivitas) OR
          (r.kode_sap IS NOT NULL AND ma.kode_sap = r.kode_sap) OR
          (r.nama_aktivitas IS NOT NULL AND LOWER(ma.nama_aktivitas) = LOWER(r.nama_aktivitas))
        )
        WHERE (r.status_spk IN ('SPK_TERBIT', 'MENUNGGU', 'MENUNGGU_SPK') OR r.status_spk IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM hasil_input_aktivitas h 
            WHERE h.rencana_id = r.id 
               OR (
                 (h.rencana_id IS NULL OR h.rencana_id = '') 
                 AND h.kode_unit = r.kode_unit 
                 AND (h.tanggal = r.tanggal OR h.tanggal_kerja = r.tanggal) 
                 AND LOWER(h.shift_kerja) = LOWER(r.shift_kerja)
               )
          )
      `;
      const params: (string | number)[] = [];

      if (resolvedSupervisorName) {
        sql += ` AND (LOWER(r.nama_pengawas) = LOWER(?) OR r.nama_pengawas = ? OR LOWER(r.nama_pengawas) = LOWER(?))`;
        params.push(resolvedSupervisorName, resolvedSupervisorName, resolvedUsername || resolvedSupervisorName);
      }

      if (rawTanggal) {
        const isoTanggal = formatToISODate(rawTanggal);
        sql += ` AND (r.tanggal = ? OR r.tanggal_kerja = ? OR r.status_spk = 'SPK_TERBIT')`;
        params.push(isoTanggal, isoTanggal);
      }

      sql += ` ORDER BY r.tanggal DESC, r.created_at DESC`;

      interface RawRencanaItem {
        id: string;
        id_rencana_kerja: string;
        rencana_id: string;
        nomor_spk: string | null;
        status_spk: string;
        status_unit: string;
        tanggal: string;
        tanggal_kerja: string;
        nama_pengawas: string;
        pengawas: string;
        kode_unit: string;
        unit_kode: string;
        unit: string;
        model_unit: string;
        nama_unit: string;
        jenis_unit: string;
        hm_terakhir: number;
        hm_unit_terakhir: number;
        hm_min_standar: number;
        hm_max_standar: number;
        operator: string;
        nik_operator: string;
        kode_lokasi: string;
        lokasi: string;
        nama_lokasi: string;
        wilayah: string;
        aktivitas: string;
        nama_aktivitas: string;
        kode_sap: string;
        satuan: string;
        shift_kerja: string;
        shift: string;
        keterangan_rencana: string;
        created_at: string;
        updated_at: string;
      }

      const rows = queryAll<RawRencanaItem>(sql, params);

      const items = rows.map((r) => ({
        id_rencana_kerja: r.id,
        id: r.id,
        rencana_id: r.id,
        unit_kode: r.kode_unit,
        unit: r.kode_unit,
        kode_unit: r.kode_unit,
        nama_unit: r.model_unit || r.kode_unit,
        model_unit: r.model_unit || r.kode_unit,
        jenis_unit: r.jenis_unit || '-',
        nomor_spk: r.nomor_spk || null,
        status_spk: r.status_spk || 'MENUNGGU_SPK',
        pengawas: r.nama_pengawas,
        nama_pengawas: r.nama_pengawas,
        operator: r.operator,
        nama_operator: r.operator,
        nik_operator: r.nik_operator || '-',
        lokasi: r.lokasi,
        kode_lokasi: r.kode_lokasi,
        nama_lokasi: r.nama_lokasi,
        wilayah: r.wilayah,
        shift: r.shift,
        shift_kerja: r.shift_kerja,
        tanggal: r.tanggal,
        tanggal_kerja: r.tanggal_kerja || r.tanggal,
        aktivitas: r.aktivitas,
        nama_aktivitas: r.nama_aktivitas,
        kode_sap: r.kode_sap,
        satuan: r.satuan,
        hm_terakhir: Number(r.hm_terakhir || 0),
        hm_unit_terakhir: Number(r.hm_unit_terakhir || 0),
        hm_min_standar: r.hm_min_standar,
        hm_max_standar: r.hm_max_standar,
        status_unit: r.status_unit || 'OPERASI',
        keterangan_rencana: r.keterangan_rencana || '',
        created_at: r.created_at,
        updated_at: r.updated_at || r.created_at
      }));

      return res.status(200).json({
        success: true,
        status: 'success',
        pengawas: resolvedSupervisorName || rawPengawas || 'Semua',
        total: items.length,
        count: items.length,
        synced_at: new Date().toISOString(),
        data: items,
        rencana_aktif: items
      });
    } catch (err: unknown) {
      console.error('Error fetching mobile active rencana kerja:', err);
      return res.status(500).json({
        success: false,
        error: (err as Error).message
      });
    }
  };

  app.get('/api/mobile/rencana-kerja/active', handleMobileRencanaKerjaActive);
  app.post('/api/mobile/rencana-kerja/active', handleMobileRencanaKerjaActive);
  app.get('/api/mobile/rencana-kerja/active-spk', handleMobileRencanaKerjaActive);

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
      // 1. Unbind nomor SPK / unbind relasi pada aktivitas terkait jika ada
      execute('UPDATE hasil_input_aktivitas SET rencana_id = NULL, nomor_spk = NULL WHERE rencana_id = ?', [id]);
      
      // 2. Jalankan query penghapusan rencana kerja
      execute('DELETE FROM rencana_kerja WHERE id = ?', [id]);

      // 3. Pancarkan event WebSocket (baik format Socket.io io.emit maupun broadcast standar)
      io.emit("RENCANA_KERJA_DELETED", { id });
      broadcast({
        event: 'DELETE_RENCANA',
        type: 'DELETE_RENCANA',
        id,
        timestamp: new Date().toISOString()
      });

      // 4. Kembalikan respons sukses
      res.json({ success: true, status: 'success', message: 'Data rencana berhasil dihapus' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 1C. MASTER LOKASI REST API & BULK IMPORT
  app.get('/api/master/lokasi', (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      let sql = 'SELECT * FROM lokasi WHERE 1=1';
      const params: (string | number)[] = [];

      if (status !== undefined && status !== 'Semua' && status !== '') {
        sql += ' AND status_aktif = ?';
        params.push(status === '1' || status === 'true' || status === 'aktif' ? 1 : 0);
      }

      sql += ' ORDER BY kode_lokasi ASC';
      const rows = queryAll<LokasiRow>(sql, params);
      res.json(rows);
    } catch (err: unknown) {
      console.error('Error fetching lokasi:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/master/lokasi', (req: Request, res: Response) => {
    try {
      const { kode_lokasi, wilayah, luas_bruto, luas_netto, status_aktif } = req.body;
      if (!kode_lokasi || !wilayah) {
        return res.status(400).json({ error: 'Kode lokasi dan wilayah wajib diisi.' });
      }
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const activeStatus = status_aktif === 0 || status_aktif === '0' || status_aktif === false ? 0 : 1;
      execute(`
        INSERT OR REPLACE INTO lokasi (kode_lokasi, wilayah, luas_bruto, luas_netto, status_aktif, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        kode_lokasi.trim(),
        wilayah.trim(),
        parseFloat(luas_bruto) || 0,
        parseFloat(luas_netto) || 0,
        activeStatus,
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
      const { wilayah, luas_bruto, luas_netto, status_aktif } = req.body;
      const existing = queryOne<LokasiRow>('SELECT * FROM lokasi WHERE kode_lokasi = ?', [kode]);
      const activeStatus = status_aktif !== undefined
        ? (status_aktif === 0 || status_aktif === '0' || status_aktif === false ? 0 : 1)
        : (existing?.status_aktif ?? 1);

      execute(`
        UPDATE lokasi SET wilayah = ?, luas_bruto = ?, luas_netto = ?, status_aktif = ?
        WHERE kode_lokasi = ?
      `, [wilayah, parseFloat(luas_bruto) || 0, parseFloat(luas_netto) || 0, activeStatus, kode]);

      const updated = queryOne<LokasiRow>('SELECT * FROM lokasi WHERE kode_lokasi = ?', [kode]);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/master/lokasi/:kode_lokasi', (req: Request, res: Response) => {
    try {
      const kode = req.params.kode_lokasi;
      execute('UPDATE lokasi SET status_aktif = 0 WHERE kode_lokasi = ?', [kode]);
      res.json({ status: 'success', message: 'Lokasi berhasil dinonaktifkan (soft delete)' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Toggle status endpoint for Master Lokasi
  app.patch(['/api/master-lokasi/:id/toggle-status', '/api/lokasi/:id/toggle-status', '/api/master/lokasi/:kode_lokasi/toggle-status', '/api/master/lokasi/:id/toggle-status'], (req: Request, res: Response) => {
    try {
      const targetId = (req.params.id || req.params.kode_lokasi || '').trim();
      const existing = queryOne<LokasiRow>('SELECT * FROM lokasi WHERE UPPER(kode_lokasi) = UPPER(?)', [targetId]);
      if (!existing) {
        return res.status(404).json({ error: 'Lokasi tidak ditemukan' });
      }
      const newStatus = (existing.status_aktif ?? 1) === 1 ? 0 : 1;
      execute('UPDATE lokasi SET status_aktif = ? WHERE UPPER(kode_lokasi) = UPPER(?)', [newStatus, targetId]);
      const updated = queryOne<LokasiRow>('SELECT * FROM lokasi WHERE UPPER(kode_lokasi) = UPPER(?)', [targetId]);
      res.json({
        status: 'success',
        message: `Status lokasi ${existing.kode_lokasi} berhasil diubah menjadi ${newStatus === 1 ? 'Aktif' : 'Nonaktif'}`,
        data: updated
      });
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

  // 1D. MASTER KENDALA OPERASIONAL REST API
  // Mengembalikan ke-15 data kendala standar operasional (dengan id, nama_kendala, status_aktif: 1)
  app.get('/api/master-kendala', (req: Request, res: Response) => {
    try {
      const { search, status } = req.query;
      let sql = 'SELECT * FROM master_kendala WHERE 1=1';
      const params: (string | number)[] = [];

      if (search && typeof search === 'string' && search.trim() !== '') {
        sql += ' AND nama_kendala LIKE ?';
        params.push(`%${search.trim()}%`);
      }

      if (status !== undefined && status !== 'Semua' && status !== '') {
        sql += ' AND status_aktif = ?';
        params.push(status === '1' || status === 'true' || status === 'aktif' ? 1 : 0);
      }

      sql += ' ORDER BY id ASC';
      const rows = queryAll<MasterKendalaRow>(sql, params);
      res.json(rows);
    } catch (err: unknown) {
      console.error('Error fetching master kendala:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/master-kendala', (req: Request, res: Response) => {
    try {
      const { nama_kendala, status_aktif } = req.body;
      if (!nama_kendala || typeof nama_kendala !== 'string' || nama_kendala.trim() === '') {
        return res.status(400).json({ error: 'Nama kendala wajib diisi.' });
      }

      const activeStatus = status_aktif === 0 || status_aktif === false || status_aktif === '0' ? 0 : 1;
      const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

      const result = execute(
        'INSERT INTO master_kendala (nama_kendala, status_aktif, created_at) VALUES (?, ?, ?)',
        [nama_kendala.trim(), activeStatus, createdAt]
      );

      const newRow = queryOne<MasterKendalaRow>('SELECT * FROM master_kendala WHERE id = ?', [result.lastInsertRowId]);
      res.status(201).json({ status: 'success', data: newRow });
    } catch (err: unknown) {
      console.error('Error creating master kendala:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/master-kendala/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { nama_kendala, status_aktif } = req.body;

      const existing = queryOne<MasterKendalaRow>('SELECT * FROM master_kendala WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Data kendala tidak ditemukan.' });
      }

      const updatedName = nama_kendala !== undefined ? String(nama_kendala).trim() : existing.nama_kendala;
      const updatedStatus = status_aktif !== undefined ? (status_aktif === 0 || status_aktif === false || status_aktif === '0' ? 0 : 1) : existing.status_aktif;

      execute('UPDATE master_kendala SET nama_kendala = ?, status_aktif = ? WHERE id = ?', [
        updatedName,
        updatedStatus,
        id
      ]);

      const updatedRow = queryOne<MasterKendalaRow>('SELECT * FROM master_kendala WHERE id = ?', [id]);
      res.json({ status: 'success', data: updatedRow });
    } catch (err: unknown) {
      console.error('Error updating master kendala:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/master-kendala/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      execute('UPDATE master_kendala SET status_aktif = 0 WHERE id = ?', [id]);
      res.json({ status: 'success', message: 'Data kendala berhasil dinonaktifkan (soft delete).' });
    } catch (err: unknown) {
      console.error('Error deleting master kendala:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 2. POST /api/aktivitas-unit
  // Atomic transaction from Android app or manual dashboard entry (supports Base64 JSON & multipart/form-data)
  // Implements UPSERT via UUID to prevent duplicate data on Android sync, and robust operator & work duration mapping
  app.post('/api/aktivitas-unit', upload.single('foto_bukti') as unknown as express.RequestHandler, (req: Request, res: Response) => {
    try {
      const {
        rencana_id: rawRencanaId,
        id_rencana_kerja: rawIdRencanaKerja,
        uuid: rawUuid,
        client_uuid: rawClientUuid,
        id_offline: rawIdOffline,
        client_transaction_id: rawClientTxId,
        nama_pengawas: rawNamaPengawas,
        pengawas: rawPengawas,
        tanggal,
        tanggal_kerja: rawTanggalKerja,
        kode_unit: rawKodeUnit,
        nama_aktivitas: rawNamaAktivitas,
        aktivitas: rawAktivitas,
        kode_sap,
        satuan,
        operator: rawOperator,
        nama_operator: rawNamaOperator,
        operator_name: rawOperatorName,
        nik_operator: rawNikOperator,
        nik: rawNik,
        kode_lokasi: rawKodeLokasi,
        lokasi: rawLokasi,
        nomor_spk,
        shift_kerja: rawShiftKerja,
        shift: rawShift,
        jam_kerja: rawJamKerja,
        durasi_jam_kerja: rawDurasiJamKerja,
        durasi_jam_shift: rawDurasiJamShift,
        durasi: rawDurasi,
        total_jam_kerja: rawTotalJamKerja,
        hm_awal,
        hm_akhir,
        hm_harian_berjalan,
        hasil_kerja,
        keterangan,
        status_unit: rawStatusUnit,
        is_isi_solar: rawIsIsiSolar,
        jumlah_liter_solar: rawJumlahLiterSolar,
        stik_awal: rawStikAwal,
        stik_akhir: rawStikAkhir,
        kendala_list: rawKendalaList,
        is_hm_awal_corrected: rawIsHmAwalCorrected,
        alasan_koreksi_hm: rawAlasanKoreksiHm
      } = req.body;

      // Extract UUID & Rencana ID
      const uuid = (rawUuid || rawClientUuid || rawIdOffline || rawClientTxId || '').toString().trim() || null;
      const targetRencanaId = (rawIdRencanaKerja || rawRencanaId || '').toString().trim() || null;

      // Anti-pergeseran tanggal operasional: normalisasi format bisnis ke ISO YYYY-MM-DD
      const rawDateInput = tanggal || rawTanggalKerja;
      const normalizedDate = formatToISODate(rawDateInput);
      const tanggal_kerja = normalizedDate;
      const currentDate = normalizedDate;
      const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

      // Pre-fetch linked rencana kerja if targetRencanaId or (kode_unit + date) is available
      let linkedPlan: RencanaKerjaRow | null = null;
      if (targetRencanaId) {
        linkedPlan = queryOne<RencanaKerjaRow>('SELECT * FROM rencana_kerja WHERE id = ?', [targetRencanaId]);
      }
      if (!linkedPlan && rawKodeUnit) {
        linkedPlan = queryOne<RencanaKerjaRow>(
          `SELECT * FROM rencana_kerja 
           WHERE kode_unit = ? AND (tanggal = ? OR tanggal_kerja = ?) 
           ORDER BY CASE WHEN status_spk = 'SPK_TERBIT' THEN 0 WHEN status_spk = 'MENUNGGU_SPK' THEN 1 ELSE 2 END ASC, id DESC LIMIT 1`,
          [rawKodeUnit, currentDate, tanggal_kerja]
        );
      }

      const kode_unit = (rawKodeUnit || linkedPlan?.kode_unit || '').toString().trim();
      const nama_pengawas = (rawNamaPengawas || rawPengawas || linkedPlan?.nama_pengawas || 'Pengawas Lapangan').toString().trim();
      const nama_aktivitas = (rawNamaAktivitas || rawAktivitas || linkedPlan?.keterangan_rencana || 'Operasional Unit').toString().trim();

      if (!kode_unit || !nama_pengawas) {
        return res.status(400).json({
          error: 'Field wajib tidak lengkap: kode_unit dan nama_pengawas diperlukan.'
        });
      }

      // Pemetaan durasi jam kerja secara benar dari berbagai kemungkinan key dari klien Android
      const durasiJamKerja = parseFloat(
        rawDurasiJamKerja ||
        rawJamKerja ||
        rawDurasiJamShift ||
        rawDurasi ||
        rawTotalJamKerja ||
        0
      ) || 0;

      // HM Awal & HM Akhir handling
      let numHmAwal = parseFloat(hm_awal);
      if (isNaN(numHmAwal)) {
        const unitData = queryOne<UnitRow>('SELECT hm_unit_terakhir_diinputkan FROM units WHERE kode_unit = ?', [kode_unit]);
        numHmAwal = unitData ? (unitData.hm_unit_terakhir_diinputkan || 0) : 0;
      }
      let numHmAkhir = parseFloat(hm_akhir);
      if (isNaN(numHmAkhir)) {
        numHmAkhir = numHmAwal + (durasiJamKerja > 0 ? durasiJamKerja : 0);
      }

      const calculatedHmBerjalan = hm_harian_berjalan !== undefined && hm_harian_berjalan !== null && hm_harian_berjalan !== ''
        ? parseFloat(hm_harian_berjalan)
        : Math.round((numHmAkhir - numHmAwal) * 10) / 10;

      // Jam kerja final: gunakan durasiJamKerja jika > 0, jika 0 fallback ke calculatedHmBerjalan agar tidak 0 Jam
      const numJamKerja = durasiJamKerja > 0 ? durasiJamKerja : (calculatedHmBerjalan > 0 ? calculatedHmBerjalan : 0);
      const numHasilKerja = parseFloat(hasil_kerja) || 0;

      // Pemetaan Operator secara benar: cegah fallback ke "Operator Default" jika operator dikirim atau ada di rencana kerja
      let resolvedOperator = (
        rawOperator ||
        rawNamaOperator ||
        rawOperatorName ||
        req.body.nama ||
        req.body.driver ||
        req.body.operatorName ||
        ''
      ).toString().trim();

      if (!resolvedOperator && linkedPlan?.operator?.trim()) {
        resolvedOperator = linkedPlan.operator.trim();
      }

      if (!resolvedOperator && kode_unit) {
        const matchedPlan = queryOne<RencanaKerjaRow>(
          `SELECT operator FROM rencana_kerja WHERE kode_unit = ? AND (tanggal = ? OR tanggal_kerja = ?) AND operator IS NOT NULL AND operator != '' LIMIT 1`,
          [kode_unit, normalizedDate, normalizedDate]
        );
        if (matchedPlan?.operator?.trim()) {
          resolvedOperator = matchedPlan.operator.trim();
        }
      }

      if (!resolvedOperator && (rawNikOperator || rawNik)) {
        const opRow = queryOne<OperatorRow>('SELECT nama_operator FROM operators WHERE nik = ? LIMIT 1', [rawNikOperator || rawNik]);
        if (opRow?.nama_operator) {
          resolvedOperator = opRow.nama_operator.trim();
        }
      }

      if (!resolvedOperator) {
        resolvedOperator = 'Operator Default';
      }

      // Pemetaan NIK Operator
      let resolvedNik = (
        rawNikOperator ||
        rawNik ||
        req.body.nikOperator ||
        req.body.id_operator ||
        ''
      ).toString().trim();

      if (!resolvedNik && resolvedOperator && resolvedOperator !== 'Operator Default') {
        const opRow = queryOne<OperatorRow>('SELECT nik FROM operators WHERE nama_operator = ? LIMIT 1', [resolvedOperator]);
        if (opRow?.nik) {
          resolvedNik = opRow.nik;
        }
      }
      if (!resolvedNik) {
        resolvedNik = 'NIK-00000';
      }

      // Extract foto_bukti either from multipart/form-data file upload or Base64 JSON string
      let foto_bukti = req.body.foto_bukti || null;
      if (req.file) {
        foto_bukti = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      // Status Unit & Solar handling: Otomatis tentukan status dari master_aktivitas jika tidak disertakan
      let autoActStatus: string | null = null;
      if (kode_sap || nama_aktivitas) {
        const matchedAct = queryOne<AktivitasUnitRow>(
          `SELECT kategori_status, status_unit FROM master_aktivitas WHERE (kode_sap = ? AND kode_sap != '') OR LOWER(nama_aktivitas) = LOWER(?) LIMIT 1`,
          [kode_sap || '', nama_aktivitas || '']
        );
        if (matchedAct) {
          autoActStatus = matchedAct.kategori_status || matchedAct.status_unit || null;
        }
      }
      const statusUnitStr = (rawStatusUnit || autoActStatus || linkedPlan?.status_unit || 'OPERASI').toUpperCase();
      const status_unit = ['OPERASI', 'STANDBY', 'BREAKDOWN'].includes(statusUnitStr) ? statusUnitStr : 'OPERASI';
      const is_isi_solar = (rawIsIsiSolar === true || rawIsIsiSolar === 1 || rawIsIsiSolar === '1' || rawIsIsiSolar === 'true') ? 1 : 0;
      const jumlah_liter_solar = is_isi_solar === 1 ? (parseFloat(rawJumlahLiterSolar) || 0) : 0;

      // Stik BBM & Kendala handling (sesuai spesifikasi)
      const stikAwal = parseFloat(req.body.stik_solar_awal || req.body.stik_awal || rawStikAwal || 0);
      const stikAkhir = parseFloat(req.body.stik_solar_akhir || req.body.stik_akhir || rawStikAkhir || 0);
      let estimasiKonsumsi = parseFloat(req.body.estimasi_konsumsi_solar || req.body.konsumsi_solar || 0);
      if ((!estimasiKonsumsi || isNaN(estimasiKonsumsi)) && jumlah_liter_solar > 0 && (stikAkhir - stikAwal) > 0) {
        estimasiKonsumsi = Math.round((jumlah_liter_solar / (stikAkhir - stikAwal)) * 10) / 10;
      }

      // 1. Tangkap seluruh kemungkinan key kendala dari Android:
      const rawKendala = 
        req.body.kendala_lapangan || 
        req.body.kendala_list || 
        req.body.kendala || 
        req.body.daftar_kendala || 
        rawKendalaList || 
        [];

      // Pastikan tersimpan sebagai format JSON String yang valid
      const kendalaJson = typeof rawKendala === 'string' 
        ? rawKendala 
        : JSON.stringify(Array.isArray(rawKendala) ? rawKendala : [rawKendala]);

      const jumlahKendala = Array.isArray(rawKendala) ? rawKendala.length : (rawKendala ? 1 : 0);

      // Parse array objek kendala untuk respons & broadcast real-time
      let parsedKendalaArr: any[] = [];
      try {
        const parsed = typeof rawKendala === 'string' ? JSON.parse(rawKendala || '[]') : (rawKendala || []);
        const arr = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
        parsedKendalaArr = arr.map((item: any, idx: number) => {
          if (typeof item === 'string') {
            const trimmed = item.trim();
            return {
              nama_kendala: trimmed,
              kendala: trimmed,
              nama: trimmed,
              kode_kendala: '-',
              kode: '-',
              jam_mulai: '-',
              jam_awal: '-',
              jam_selesai: '-',
              jam_akhir: '-',
              durasi_jam: 0,
              durasi: 0,
              hambatan: 0
            };
          }
          const nama = item.nama_kendala || item.kendala || item.nama || `Kendala #${idx + 1}`;
          const kode = item.kode_kendala || item.kode || item.id_kendala || '-';
          const jamMulai = item.jam_mulai || item.jam_awal || item.waktu_mulai || '-';
          const jamSelesai = item.jam_selesai || item.jam_akhir || item.waktu_selesai || '-';
          const durasi = item.durasi_jam !== undefined ? item.durasi_jam : (item.durasi !== undefined ? item.durasi : (item.hambatan !== undefined ? item.hambatan : (item.durasi_menit ? Math.round((item.durasi_menit / 60) * 10) / 10 : 0)));
          return {
            ...item,
            nama_kendala: nama,
            kendala: nama,
            nama: nama,
            kode_kendala: kode,
            kode: kode,
            jam_mulai: jamMulai,
            jam_awal: jamMulai,
            jam_selesai: jamSelesai,
            jam_akhir: jamSelesai,
            durasi_jam: durasi,
            durasi: durasi,
            hambatan: durasi
          };
        });
      } catch {
        if (typeof rawKendala === 'string' && rawKendala.trim() && rawKendala !== '[]') {
          parsedKendalaArr = [{
            nama_kendala: rawKendala.trim(),
            kendala: rawKendala.trim(),
            nama: rawKendala.trim(),
            kode_kendala: '-',
            kode: '-',
            jam_mulai: '-',
            jam_awal: '-',
            jam_selesai: '-',
            jam_akhir: '-',
            durasi_jam: 0,
            durasi: 0,
            hambatan: 0
          }];
        }
      }

      const kendalaListStr = kendalaJson;
      const adaKendala = (jumlahKendala > 0 || parsedKendalaArr.length > 0) ? 1 : 0;

      // HM Awal Correction Audit handling
      const is_hm_awal_corrected = (rawIsHmAwalCorrected === true || rawIsHmAwalCorrected === 1 || rawIsHmAwalCorrected === '1' || rawIsHmAwalCorrected === 'true') ? 1 : 0;
      const alasan_koreksi_hm = is_hm_awal_corrected === 1
        ? (rawAlasanKoreksiHm !== undefined && rawAlasanKoreksiHm !== null && String(rawAlasanKoreksiHm).trim() !== '' ? String(rawAlasanKoreksiHm).trim() : null)
        : null;

      const kode_lokasi = (rawKodeLokasi || rawLokasi || linkedPlan?.kode_lokasi || '001A').toString().trim();
      const lokasi = (rawLokasi || rawKodeLokasi || linkedPlan?.wilayah || 'Pit Operasional').toString().trim();
      const shift_kerja = ((rawShiftKerja || rawShift || linkedPlan?.shift_kerja || 'SIANG').toString().toUpperCase() === 'MALAM') ? 'Malam' : 'Siang';

      // ======================================================================
      // 1. CEGAH DUPLIKASI DATA (IMPLEMENTASI UPSERT VIA UUID & ID RENCANA)
      // ======================================================================
      let existingHia: { id: number | string } | null = null;
      if (uuid) {
        existingHia = queryOne<{ id: number | string }>(
          'SELECT id FROM hasil_input_aktivitas WHERE uuid = ? OR client_transaction_id = ? LIMIT 1',
          [uuid, uuid]
        );
      }
      if (!existingHia && targetRencanaId) {
        existingHia = queryOne<{ id: number | string }>(
          'SELECT id FROM hasil_input_aktivitas WHERE rencana_id = ? LIMIT 1',
          [targetRencanaId]
        );
      }

      let existingAu: { id: number } | null = null;
      if (uuid) {
        existingAu = queryOne<{ id: number }>(
          'SELECT id FROM aktivitas_unit WHERE uuid = ? OR client_transaction_id = ? LIMIT 1',
          [uuid, uuid]
        );
      }

      // Ambil nilai wilayah dari payload, ATAU cari otomatis dari tabel users / linked plan / unit
      let resolvedWilayah = (req.body.wilayah || linkedPlan?.wilayah || '').toString().trim();
      if (!resolvedWilayah || resolvedWilayah === 'Semua' || resolvedWilayah === 'Semua Wilayah') {
        const userRow = queryOne<{ wilayah: string }>(
          'SELECT wilayah FROM users WHERE LOWER(nama_lengkap) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1',
          [nama_pengawas, nama_pengawas]
        );
        if (userRow?.wilayah && userRow.wilayah !== 'Semua Wilayah') {
          resolvedWilayah = userRow.wilayah;
        } else if (nama_pengawas.toLowerCase().includes('budi')) {
          resolvedWilayah = 'PG1';
        } else if (nama_pengawas.toLowerCase().includes('agus')) {
          resolvedWilayah = 'PG2';
        } else if (nama_pengawas.toLowerCase().includes('rudi')) {
          resolvedWilayah = 'PG3';
        } else {
          const unitRow = queryOne<{ wilayah: string }>('SELECT wilayah FROM units WHERE kode_unit = ? LIMIT 1', [kode_unit]);
          resolvedWilayah = unitRow?.wilayah || 'PG1';
        }
      }

      let activeRowId: number | string;
      let isUpdateOperation = false;

      if (existingHia) {
        // Lakukan UPDATE (jangan INSERT baru) agar tidak terjadi data ganda!
        activeRowId = existingHia.id;
        isUpdateOperation = true;

        const updateHiaSql = `
          UPDATE hasil_input_aktivitas SET
            uuid = COALESCE(?, uuid),
            client_transaction_id = COALESCE(?, client_transaction_id),
            rencana_id = COALESCE(?, rencana_id),
            nama_pengawas = ?,
            tanggal = ?,
            tanggal_kerja = ?,
            kode_unit = ?,
            nama_aktivitas = ?,
            kode_sap = ?,
            satuan = ?,
            operator = ?,
            nik_operator = ?,
            kode_lokasi = ?,
            lokasi = ?,
            nomor_spk = COALESCE(?, nomor_spk),
            shift_kerja = ?,
            jam_kerja = ?,
            hm_awal = ?,
            hm_akhir = ?,
            hm_harian_berjalan = ?,
            hasil_kerja = ?,
            keterangan = ?,
            foto_bukti = COALESCE(?, foto_bukti),
            status_unit = ?,
            is_isi_solar = ?,
            jumlah_liter_solar = ?,
            stik_awal = ?,
            stik_akhir = ?,
            stik_solar_awal = ?,
            stik_solar_akhir = ?,
            estimasi_konsumsi_solar = ?,
            kendala_list = ?,
            ada_kendala = ?,
            is_hm_awal_corrected = ?,
            alasan_koreksi_hm = ?,
            wilayah = COALESCE(?, wilayah)
          WHERE id = ?
        `;

        execute(updateHiaSql, [
          uuid,
          uuid,
          targetRencanaId || linkedPlan?.id || null,
          nama_pengawas,
          currentDate,
          tanggal_kerja,
          kode_unit,
          nama_aktivitas,
          kode_sap || 'ACT-SAP-101',
          satuan || 'm3',
          resolvedOperator,
          resolvedNik,
          kode_lokasi,
          lokasi,
          nomor_spk || linkedPlan?.nomor_spk || null,
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
          stikAwal,
          stikAkhir,
          stikAwal,
          stikAkhir,
          estimasiKonsumsi,
          kendalaListStr,
          adaKendala,
          is_hm_awal_corrected,
          alasan_koreksi_hm,
          resolvedWilayah,
          existingHia.id
        ]);

        if (existingAu) {
          execute(
            'UPDATE aktivitas_unit SET uuid = COALESCE(?, uuid), nama_aktivitas = ?, satuan = ?, kode_sap = ?, stik_solar_awal = ?, stik_solar_akhir = ?, estimasi_konsumsi_solar = ?, kendala_list = ?, ada_kendala = ?, wilayah = COALESCE(?, wilayah) WHERE id = ?',
            [uuid, nama_aktivitas, satuan || 'm3', kode_sap || 'ACT-SAP-101', stikAwal, stikAkhir, estimasiKonsumsi, kendalaListStr, adaKendala, resolvedWilayah, existingAu.id]
          );
        } else if (uuid) {
          execute(
            'INSERT OR IGNORE INTO aktivitas_unit (uuid, client_transaction_id, jenis_unit, nama_aktivitas, satuan, kode_sap, status_aktif, stik_solar_awal, stik_solar_akhir, estimasi_konsumsi_solar, kendala_list, ada_kendala, wilayah) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)',
            [uuid, uuid, status_unit || 'Excavator', nama_aktivitas, satuan || 'm3', kode_sap || 'ACT-SAP-101', stikAwal, stikAkhir, estimasiKonsumsi, kendalaListStr, adaKendala, resolvedWilayah]
          );
        }

        console.log(`🔄 [UPSERT-UPDATE] Laporan aktivitas #${existingHia.id} berhasil diperbarui (UUID: ${uuid || 'N/A'}). Mencegah duplikasi data.`);
      } else {
        // Belum ada data dengan UUID atau rencana ini, lakukan INSERT
        const insertSql = `
          INSERT INTO hasil_input_aktivitas (
            uuid, client_transaction_id, rencana_id, nama_pengawas, tanggal, tanggal_kerja, kode_unit, nama_aktivitas, kode_sap, satuan,
            operator, nik_operator, kode_lokasi, lokasi, nomor_spk, shift_kerja, jam_kerja, hm_awal, hm_akhir,
            hm_harian_berjalan, hasil_kerja, keterangan, foto_bukti,
            status_unit, is_isi_solar, jumlah_liter_solar, stik_awal, stik_akhir, stik_solar_awal, stik_solar_akhir, estimasi_konsumsi_solar, kendala_list, ada_kendala,
            is_hm_awal_corrected, alasan_koreksi_hm, wilayah, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertResult = execute(insertSql, [
          uuid,
          uuid,
          targetRencanaId || linkedPlan?.id || null,
          nama_pengawas,
          currentDate,
          tanggal_kerja,
          kode_unit,
          nama_aktivitas,
          kode_sap || 'ACT-SAP-101',
          satuan || 'm3',
          resolvedOperator,
          resolvedNik,
          kode_lokasi,
          lokasi,
          nomor_spk || linkedPlan?.nomor_spk || null,
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
          stikAwal,
          stikAkhir,
          stikAwal,
          stikAkhir,
          estimasiKonsumsi,
          kendalaListStr,
          adaKendala,
          is_hm_awal_corrected,
          alasan_koreksi_hm,
          resolvedWilayah,
          createdAt
        ]);

        activeRowId = insertResult.lastInsertRowId;

        if (uuid) {
          execute(
            'INSERT OR IGNORE INTO aktivitas_unit (uuid, client_transaction_id, jenis_unit, nama_aktivitas, satuan, kode_sap, status_aktif, stik_solar_awal, stik_solar_akhir, estimasi_konsumsi_solar, kendala_list, ada_kendala) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)',
            [uuid, uuid, status_unit || 'Excavator', nama_aktivitas, satuan || 'm3', kode_sap || 'ACT-SAP-101', stikAwal, stikAkhir, estimasiKonsumsi, kendalaListStr, adaKendala]
          );
        }

        console.log(`✨ [UPSERT-INSERT] Laporan aktivitas baru #${activeRowId} berhasil disimpan (UUID: ${uuid || 'N/A'}).`);
      }

      // Update kolom hm_unit_terakhir_diinputkan di tabel units menjadi hm_akhir yang baru
      const updateUnitSql = `
        UPDATE units 
        SET hm_unit_terakhir_diinputkan = ?, updated_at = ? 
        WHERE kode_unit = ?
      `;
      execute(updateUnitSql, [numHmAkhir, createdAt, kode_unit]);

      // Auto-Update Status Rencana Kerja: Update status_spk menjadi 'TEREALISASI'
      const finalTargetPlanId = targetRencanaId || linkedPlan?.id || null;
      try {
        if (finalTargetPlanId) {
          if (nomor_spk || linkedPlan?.nomor_spk) {
            execute(
              `UPDATE rencana_kerja SET status_spk = 'TEREALISASI', nomor_spk = ?, updated_at = ? WHERE id = ?`,
              [nomor_spk || linkedPlan?.nomor_spk, createdAt, finalTargetPlanId]
            );
          } else {
            execute(
              `UPDATE rencana_kerja SET status_spk = 'TEREALISASI', updated_at = ? WHERE id = ?`,
              [createdAt, finalTargetPlanId]
            );
          }
          const updatedPlan = queryOne<RencanaKerjaRow>(`
            SELECT r.*, u.model_unit, l.wilayah
            FROM rencana_kerja r
            LEFT JOIN units u ON r.kode_unit = u.kode_unit
            LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
            WHERE r.id = ?
          `, [finalTargetPlanId]);
          if (updatedPlan) {
            broadcast({
              event: 'RENCANA_STATUS_UPDATED',
              id: finalTargetPlanId,
              id_rencana_kerja: finalTargetPlanId,
              status: 'TEREALISASI',
              data: updatedPlan,
              timestamp: new Date().toISOString()
            });

            broadcast({
              event: 'UPDATE_RENCANA',
              data: updatedPlan,
              timestamp: new Date().toISOString()
            });
            console.log(`📋 [RENCANA-AUTO-UPDATE] Rencana #${finalTargetPlanId} diperbarui menjadi status 'TEREALISASI'`);
          }
        }
      } catch (e) {
        console.warn('Error updating linked rencana_kerja status:', e);
      }

      // Ambil row lengkap yang baru tersimpan/terupdate beserta join model_unit dan wilayah lokasi
      const finalRow = queryOne<HasilInputAktivitasRow & { model_unit?: string; wilayah?: string }>(`
        SELECT h.*, u.model_unit, l.wilayah
        FROM hasil_input_aktivitas h
        LEFT JOIN units u ON h.kode_unit = u.kode_unit
        LEFT JOIN lokasi l ON h.kode_lokasi = l.kode_lokasi
        WHERE h.id = ?
      `, [activeRowId]);

      // Susun payload lengkap real-time menyertakan tanggal, shift, unit, operator, pengawas, hm_awal, hm_akhir, durasi_hm, solar, kendala
      const dataAktivitas = {
        ...(finalRow || {}),
        id: activeRowId,
        uuid: uuid || finalRow?.uuid,
        id_rencana_kerja: finalTargetPlanId || (finalRow ? finalRow.rencana_id : null),
        rencana_id: finalTargetPlanId || (finalRow ? finalRow.rencana_id : null),
        tanggal: finalRow?.tanggal_kerja || finalRow?.tanggal || currentDate,
        tanggal_kerja: finalRow?.tanggal_kerja || currentDate,
        shift: finalRow?.shift_kerja || shift_kerja,
        shift_kerja: finalRow?.shift_kerja || shift_kerja,
        unit: finalRow?.kode_unit || kode_unit,
        kode_unit: finalRow?.kode_unit || kode_unit,
        nama_unit: finalRow?.model_unit || finalRow?.kode_unit || kode_unit,
        operator: finalRow?.operator || resolvedOperator,
        nama_operator: finalRow?.operator || resolvedOperator,
        nik_operator: finalRow?.nik_operator || resolvedNik,
        pengawas: finalRow?.nama_pengawas || nama_pengawas,
        nama_pengawas: finalRow?.nama_pengawas || nama_pengawas,
        hm_awal: finalRow?.hm_awal !== undefined ? finalRow.hm_awal : numHmAwal,
        hm_akhir: finalRow?.hm_akhir !== undefined ? finalRow.hm_akhir : numHmAkhir,
        durasi_hm: finalRow?.hm_harian_berjalan !== undefined ? finalRow.hm_harian_berjalan : calculatedHmBerjalan,
        hm_harian_berjalan: finalRow?.hm_harian_berjalan !== undefined ? finalRow.hm_harian_berjalan : calculatedHmBerjalan,
        jam_kerja: finalRow?.jam_kerja !== undefined ? finalRow.jam_kerja : numJamKerja,
        durasi_jam_kerja: finalRow?.jam_kerja !== undefined ? finalRow.jam_kerja : numJamKerja,
        durasi: finalRow?.jam_kerja !== undefined ? finalRow.jam_kerja : numJamKerja,
        solar: finalRow?.jumlah_liter_solar !== undefined ? finalRow.jumlah_liter_solar : jumlah_liter_solar,
        jumlah_liter_solar: finalRow?.jumlah_liter_solar !== undefined ? finalRow.jumlah_liter_solar : jumlah_liter_solar,
        stik_awal: stikAwal,
        stik_akhir: stikAkhir,
        stik_solar_awal: stikAwal,
        stik_solar_akhir: stikAkhir,
        estimasi_konsumsi_solar: estimasiKonsumsi,
        ada_kendala: adaKendala,
        status_realisasi: 'TEREALISASI',
        status_spk: 'TEREALISASI',
        kendala: parsedKendalaArr,
        kendala_list: parsedKendalaArr,
        created_at: finalRow?.created_at || createdAt,
        timestamp: new Date().toISOString()
      };

      // Backend memancarkan (broadcast) event WebSocket ke seluruh client yang terhubung
      io.emit("NEW_REALISASI_SUBMITTED", dataAktivitas);

      broadcast({
        event: 'NEW_REALIZATION',
        message: `Realisasi aktivitas diterima dari ${nama_pengawas} (Unit ${kode_unit})`,
        data: dataAktivitas,
        aktivitas: dataAktivitas,
        timestamp: new Date().toISOString()
      });

      broadcast({
        event: 'NEW_ACTIVITY',
        message: `Laporan diterima dari ${nama_pengawas} (Unit ${kode_unit})`,
        data: dataAktivitas,
        aktivitas: dataAktivitas,
        timestamp: new Date().toISOString()
      });

      if (isUpdateOperation) {
        return res.status(200).json({
          status: 'updated',
          message: 'Data berhasil diperbarui',
          id: activeRowId,
          data: dataAktivitas
        });
      }

      return res.status(201).json({
        status: 'success',
        message: 'Laporan realisasi aktivitas unit berhasil disimpan & disinkronisasi.',
        id: activeRowId,
        data: dataAktivitas
      });
    } catch (err: unknown) {
      console.error('Error saving aktivitas unit:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3. GET /api/beranda, /api/rekapitulasi & /api/aktivitas-unit
  // Rekonsiliasi data Beranda secara real-time: LEFT JOIN rencana_kerja & hasil_input_aktivitas
  app.get(['/api/beranda', '/api/rekapitulasi', '/api/aktivitas-unit'], (req: Request, res: Response) => {
    try {
      const { search, pengawas, unit, shift, status, startDate, endDate, wilayah } = req.query;

      let baseSql = `
        SELECT * FROM (
          SELECT
            COALESCE(h.id, r.id) as id,
            h.id as id_aktivitas,
            r.id as id_rencana_kerja,
            r.id as rencana_id,
            COALESCE(h.nama_pengawas, r.nama_pengawas) as nama_pengawas,
            r.tanggal as tanggal,
            COALESCE(h.tanggal_kerja, h.tanggal, r.tanggal) as tanggal_kerja,
            COALESCE(ma_act.kategori_status, ma_r.kategori_status, h.status_unit, r.status_unit, 'OPERASI') as status_unit,
            COALESCE(ma_act.kategori_status, ma_r.kategori_status, h.status_unit, r.status_unit, 'OPERASI') as kategori_status,
            COALESCE(h.kode_unit, r.kode_unit) as kode_unit,
            COALESCE(h.kode_unit, r.kode_unit) as unit,
            h.nama_aktivitas as aktivitas_aktual,
            COALESCE(
              h.nama_aktivitas,
              r.nama_aktivitas,
              r.aktivitas,
              ma_r.nama_aktivitas,
              r.keterangan_rencana,
              '-'
            ) as nama_aktivitas,
            COALESCE(
              r.aktivitas,
              r.nama_aktivitas,
              h.nama_aktivitas,
              ma_r.nama_aktivitas,
              r.keterangan_rencana,
              '-'
            ) as aktivitas,
            COALESCE(
              h.kode_sap,
              r.kode_sap,
              ma_r.kode_sap,
              ma_act.kode_sap,
              'ACT-SAP-101'
            ) as kode_sap,
            COALESCE(
              h.satuan,
              r.satuan,
              ma_r.satuan,
              ma_act.satuan,
              'm3'
            ) as satuan,
            COALESCE(h.operator, r.operator) as operator,
            COALESCE(h.nik_operator, '-') as nik_operator,
            COALESCE(h.kode_lokasi, r.kode_lokasi) as kode_lokasi,
            COALESCE(h.lokasi, l.wilayah, r.kode_lokasi) as lokasi,
            COALESCE(h.nomor_spk, r.nomor_spk) as nomor_spk,
            COALESCE(h.shift_kerja, r.shift_kerja) as shift_kerja,
            h.jam_kerja,
            h.hm_awal,
            h.hm_akhir,
            h.hm_harian_berjalan,
            h.hasil_kerja,
            COALESCE(h.keterangan, r.keterangan_rencana) as keterangan,
            h.foto_bukti,
            h.is_isi_solar,
            h.jumlah_liter_solar,
            COALESCE(h.stik_solar_awal, h.stik_awal) as stik_solar_awal,
            COALESCE(h.stik_solar_akhir, h.stik_akhir) as stik_solar_akhir,
            COALESCE(h.stik_solar_awal, h.stik_awal) as stik_awal,
            COALESCE(h.stik_solar_akhir, h.stik_akhir) as stik_akhir,
            COALESCE(h.estimasi_konsumsi_solar, 0) as estimasi_konsumsi_solar,
            COALESCE(h.ada_kendala, CASE WHEN h.kendala_list IS NOT NULL AND TRIM(h.kendala_list) != '' AND TRIM(h.kendala_list) != '[]' THEN 1 ELSE 0 END) as ada_kendala,
            h.kendala_list,
            h.is_hm_awal_corrected,
            h.alasan_koreksi_hm,
            COALESCE(r.status_spk, 'MENUNGGU') as status_spk,
            CASE WHEN h.id IS NOT NULL THEN 'TEREALISASI' ELSE 'BELUM_INPUT' END as status_realisasi,
            COALESCE(h.created_at, r.created_at) as created_at,
            u.model_unit,
            l.wilayah
          FROM rencana_kerja r
          LEFT JOIN hasil_input_aktivitas h ON (
            h.rencana_id = r.id OR 
            (h.rencana_id IS NULL AND h.kode_unit = r.kode_unit AND h.tanggal = r.tanggal AND LOWER(h.shift_kerja) = LOWER(r.shift_kerja))
          )
          LEFT JOIN units u ON r.kode_unit = u.kode_unit
          LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
          LEFT JOIN master_aktivitas ma_r ON (
            (r.id_aktivitas IS NOT NULL AND ma_r.id = r.id_aktivitas) OR
            (r.kode_sap IS NOT NULL AND ma_r.kode_sap = r.kode_sap) OR
            (r.nama_aktivitas IS NOT NULL AND (LOWER(ma_r.nama_aktivitas) = LOWER(r.nama_aktivitas) OR LOWER(r.nama_aktivitas) LIKE '%' || LOWER(ma_r.nama_aktivitas) || '%')) OR
            (r.keterangan_rencana IS NOT NULL AND (LOWER(ma_r.nama_aktivitas) = LOWER(r.keterangan_rencana) OR LOWER(r.keterangan_rencana) LIKE '%' || LOWER(ma_r.nama_aktivitas) || '%'))
          )
          LEFT JOIN master_aktivitas ma_act ON (
            h.kode_sap IS NOT NULL AND ma_act.kode_sap = h.kode_sap
          )

          UNION ALL

          SELECT
            h.id as id,
            h.id as id_aktivitas,
            h.rencana_id as id_rencana_kerja,
            h.rencana_id as rencana_id,
            h.nama_pengawas,
            h.tanggal,
            COALESCE(h.tanggal_kerja, h.tanggal) as tanggal_kerja,
            COALESCE(ma_h.kategori_status, h.status_unit, 'OPERASI') as status_unit,
            COALESCE(ma_h.kategori_status, h.status_unit, 'OPERASI') as kategori_status,
            h.kode_unit,
            h.kode_unit as unit,
            h.nama_aktivitas as aktivitas_aktual,
            h.nama_aktivitas as nama_aktivitas,
            h.nama_aktivitas as aktivitas,
            COALESCE(h.kode_sap, ma_h.kode_sap, 'ACT-SAP-101') as kode_sap,
            COALESCE(h.satuan, ma_h.satuan, 'm3') as satuan,
            h.operator,
            h.nik_operator,
            h.kode_lokasi,
            COALESCE(h.lokasi, l.wilayah, h.kode_lokasi) as lokasi,
            h.nomor_spk,
            h.shift_kerja,
            h.jam_kerja,
            h.hm_awal,
            h.hm_akhir,
            h.hm_harian_berjalan,
            h.hasil_kerja,
            h.keterangan,
            h.foto_bukti,
            h.is_isi_solar,
            h.jumlah_liter_solar,
            COALESCE(h.stik_solar_awal, h.stik_awal) as stik_solar_awal,
            COALESCE(h.stik_solar_akhir, h.stik_akhir) as stik_solar_akhir,
            COALESCE(h.stik_solar_awal, h.stik_awal) as stik_awal,
            COALESCE(h.stik_solar_akhir, h.stik_akhir) as stik_akhir,
            COALESCE(h.estimasi_konsumsi_solar, 0) as estimasi_konsumsi_solar,
            COALESCE(h.ada_kendala, CASE WHEN h.kendala_list IS NOT NULL AND TRIM(h.kendala_list) != '' AND TRIM(h.kendala_list) != '[]' THEN 1 ELSE 0 END) as ada_kendala,
            h.kendala_list,
            h.is_hm_awal_corrected,
            h.alasan_koreksi_hm,
            'TEREALISASI' as status_spk,
            'TEREALISASI' as status_realisasi,
            h.created_at,
            u.model_unit,
            l.wilayah
          FROM hasil_input_aktivitas h
          LEFT JOIN units u ON h.kode_unit = u.kode_unit
          LEFT JOIN lokasi l ON h.kode_lokasi = l.kode_lokasi
          LEFT JOIN master_aktivitas ma_h ON (
            (h.kode_sap IS NOT NULL AND ma_h.kode_sap = h.kode_sap) OR
            (h.nama_aktivitas IS NOT NULL AND (LOWER(ma_h.nama_aktivitas) = LOWER(h.nama_aktivitas) OR LOWER(h.nama_aktivitas) LIKE '%' || LOWER(ma_h.nama_aktivitas) || '%'))
          )
          WHERE h.id NOT IN (
            SELECT h2.id FROM rencana_kerja r2
            JOIN hasil_input_aktivitas h2 ON (
              h2.rencana_id = r2.id OR 
              (h2.rencana_id IS NULL AND h2.kode_unit = r2.kode_unit AND h2.tanggal = r2.tanggal AND LOWER(h2.shift_kerja) = LOWER(r2.shift_kerja))
            )
          )
        ) unified
        WHERE 1=1
      `;

      const params: (string | number)[] = [];

      if (search && typeof search === 'string' && search.trim() !== '') {
        const s = `%${search.trim()}%`;
        baseSql += ` AND (nama_pengawas LIKE ? OR kode_unit LIKE ? OR kode_sap LIKE ? OR operator LIKE ? OR nama_aktivitas LIKE ? OR lokasi LIKE ?)`;
        params.push(s, s, s, s, s, s);
      }

      if (wilayah && typeof wilayah === 'string' && wilayah.toUpperCase() !== 'SEMUA' && wilayah !== 'Semua Wilayah') {
        baseSql += ' AND (wilayah = ? OR lokasi = ? OR nama_pengawas IN (SELECT nama_lengkap FROM users WHERE wilayah = ?) OR kode_unit IN (SELECT kode_unit FROM units WHERE wilayah = ? OR nama_pengawas IN (SELECT nama_lengkap FROM users WHERE wilayah = ?)))';
        params.push(wilayah, wilayah, wilayah, wilayah, wilayah);
      }

      if (pengawas && typeof pengawas === 'string' && pengawas !== 'Semua') {
        baseSql += ' AND nama_pengawas = ?';
        params.push(pengawas);
      }

      if (unit && typeof unit === 'string' && unit !== 'Semua') {
        baseSql += ' AND kode_unit = ?';
        params.push(unit);
      }

      if (shift && typeof shift === 'string' && shift !== 'Semua') {
        baseSql += ' AND (shift_kerja = ? OR LOWER(shift_kerja) = LOWER(?))';
        params.push(shift, shift);
      }

      if (status && typeof status === 'string' && status !== 'Semua') {
        baseSql += ' AND status_unit = ?';
        params.push(status);
      }

      if (startDate && typeof startDate === 'string' && startDate.trim() !== '') {
        baseSql += ' AND COALESCE(tanggal_kerja, tanggal) >= ?';
        params.push(startDate.trim());
      }

      if (endDate && typeof endDate === 'string' && endDate.trim() !== '') {
        baseSql += ' AND COALESCE(tanggal_kerja, tanggal) <= ?';
        params.push(endDate.trim());
      }

      baseSql += ' ORDER BY COALESCE(tanggal_kerja, tanggal) DESC, created_at DESC';

      const rows = queryAll<any>(baseSql, params);
      const seenIds = new Set<string | number>();
      const formattedRows = rows
        .filter(r => {
          if (!r.id || seenIds.has(r.id)) return false;
          seenIds.add(r.id);
          return true;
        })
        .map(r => {
        let parsedKendala: Array<any> = [];
        try {
          const rawK = r.kendala_list || r.kendala_data || '[]';
          const parsed = typeof rawK === 'string' ? JSON.parse(rawK || '[]') : (rawK || []);
          const arr = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
          parsedKendala = arr.map((item: any, idx: number) => {
            if (typeof item === 'string') {
              const trimmed = item.trim();
              return {
                nama_kendala: trimmed,
                kendala: trimmed,
                nama: trimmed,
                kode_kendala: '-',
                kode: '-',
                jam_mulai: '-',
                jam_awal: '-',
                jam_selesai: '-',
                jam_akhir: '-',
                durasi_jam: 0,
                durasi: 0,
                hambatan: 0
              };
            }
            const nama = item.nama_kendala || item.kendala || item.nama || `Kendala #${idx + 1}`;
            const kode = item.kode_kendala || item.kode || item.id_kendala || '-';
            const jamMulai = item.jam_mulai || item.jam_awal || item.waktu_mulai || '-';
            const jamSelesai = item.jam_selesai || item.jam_akhir || item.waktu_selesai || '-';
            const durasi = item.durasi_jam !== undefined ? item.durasi_jam : (item.durasi !== undefined ? item.durasi : (item.hambatan !== undefined ? item.hambatan : (item.durasi_menit ? Math.round((item.durasi_menit / 60) * 10) / 10 : 0)));
            return {
              ...item,
              nama_kendala: nama,
              kendala: nama,
              nama: nama,
              kode_kendala: kode,
              kode: kode,
              jam_mulai: jamMulai,
              jam_awal: jamMulai,
              jam_selesai: jamSelesai,
              jam_akhir: jamSelesai,
              durasi_jam: durasi,
              durasi: durasi,
              hambatan: durasi
            };
          });
        } catch {
          parsedKendala = r.kendala_list ? [{
            nama_kendala: String(r.kendala_list),
            kendala: String(r.kendala_list),
            nama: String(r.kendala_list),
            kode_kendala: '-',
            kode: '-',
            jam_mulai: '-',
            jam_awal: '-',
            jam_selesai: '-',
            jam_akhir: '-',
            durasi_jam: 0,
            durasi: 0,
            hambatan: 0
          }] : [];
        }
        const hasFoto = Boolean(r.foto_bukti && String(r.foto_bukti).trim() !== '');
        const hasFotoSolar = Boolean(r.is_isi_solar === 1 || hasFoto);

        const aktivitasTampil = 
          r.aktivitas_aktual || 
          r.nama_aktivitas || 
          r.aktivitas || 
          '-';

        const stikSolarAwal = r.stik_solar_awal !== null && r.stik_solar_awal !== undefined ? parseFloat(r.stik_solar_awal) : (r.stik_awal !== null && r.stik_awal !== undefined ? parseFloat(r.stik_awal) : null);
        const stikSolarAkhir = r.stik_solar_akhir !== null && r.stik_solar_akhir !== undefined ? parseFloat(r.stik_solar_akhir) : (r.stik_akhir !== null && r.stik_akhir !== undefined ? parseFloat(r.stik_akhir) : null);
        let estKonsumsi = r.estimasi_konsumsi_solar !== null && r.estimasi_konsumsi_solar !== undefined ? parseFloat(r.estimasi_konsumsi_solar) : 0;
        if ((!estKonsumsi || estKonsumsi === 0) && r.jumlah_liter_solar && stikSolarAwal !== null && stikSolarAkhir !== null && (stikSolarAkhir - stikSolarAwal) > 0) {
          estKonsumsi = Math.round((parseFloat(r.jumlah_liter_solar) / (stikSolarAkhir - stikSolarAwal)) * 10) / 10;
        }

        const adaKendala = (r.ada_kendala === 1 || parsedKendala.length > 0) ? 1 : 0;

        return {
          ...r,
          id: r.id,
          tanggal: r.tanggal,
          tanggal_kerja: r.tanggal_kerja || r.tanggal,
          nama_aktivitas: aktivitasTampil,
          aktivitas: aktivitasTampil,
          aktivitas_aktual: r.aktivitas_aktual || null,
          kode_sap: r.kode_sap || null,
          satuan: r.satuan || 'm3',
          foto_bukti: null, // Exclude heavy Base64 payload from table list for instant UI loading
          has_foto_bukti: hasFoto,
          has_foto_solar: hasFotoSolar,
          has_foto_hm: hasFoto,
          has_foto_unit: hasFoto,
          has_foto: hasFoto,
          kendala: parsedKendala,
          kendala_list: parsedKendala,
          ada_kendala: adaKendala,
          stik_awal: stikSolarAwal,
          stik_akhir: stikSolarAkhir,
          stik_solar_awal: stikSolarAwal,
          stik_solar_akhir: stikSolarAkhir,
          estimasi_konsumsi_solar: estKonsumsi,
          hm_awal: r.hm_awal !== null && r.hm_awal !== undefined ? parseFloat(r.hm_awal) : null,
          hm_akhir: r.hm_akhir !== null && r.hm_akhir !== undefined ? parseFloat(r.hm_akhir) : null,
          hm_harian_berjalan: r.hm_harian_berjalan !== null && r.hm_harian_berjalan !== undefined ? parseFloat(r.hm_harian_berjalan) : null,
          jam_kerja: r.jam_kerja !== null && r.jam_kerja !== undefined ? parseFloat(r.jam_kerja) : null,
          hasil_kerja: r.hasil_kerja !== null && r.hasil_kerja !== undefined ? parseFloat(r.hasil_kerja) : null,
          jumlah_liter_solar: r.jumlah_liter_solar !== null && r.jumlah_liter_solar !== undefined ? parseFloat(r.jumlah_liter_solar) : null
        };
      });

      res.json({
        status: 'success',
        total: formattedRows.length,
        data: formattedRows
      });
    } catch (err: unknown) {
      console.error('Error fetching rekapitulasi/beranda:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3B. GET /api/rekapitulasi/:id/foto & /api/aktivitas-unit/:id/foto (Dedicated Lazy-Loading Photo Endpoint)
  app.get('/api/rekapitulasi/:id/foto', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const row = queryOne<HasilInputAktivitasRow>(
        'SELECT id, foto_bukti, kode_unit, nama_aktivitas, lokasi, nama_pengawas, tanggal, shift_kerja, jam_kerja, hm_awal, hm_akhir, hm_harian_berjalan, operator, nik_operator, keterangan FROM hasil_input_aktivitas WHERE id = ?',
        [id]
      );

      if (!row) {
        return res.status(404).json({ error: 'Data aktivitas tidak ditemukan.' });
      }

      let foto_bukti = row.foto_bukti;
      if (!foto_bukti || foto_bukti.trim() === '') {
        foto_bukti = generateSampleFieldPhoto(
          row.kode_unit || 'UNIT-01',
          row.nama_aktivitas || 'Operasional',
          row.lokasi || 'Pit Operasional',
          row.nama_pengawas || 'Pengawas Lapangan',
          row.tanggal || new Date().toISOString().slice(0, 10)
        );
      }

      res.json({
        status: 'success',
        data: {
          id: row.id,
          kode_unit: row.kode_unit,
          nama_aktivitas: row.nama_aktivitas,
          foto_bukti,
          foto_stik_solar: foto_bukti,
          foto_hm: foto_bukti,
          foto_unit: foto_bukti,
          has_foto_bukti: true,
          has_foto_solar: true,
          has_foto_hm: true
        }
      });
    } catch (err: unknown) {
      console.error('Error fetching photo detail:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/aktivitas-unit/:id/foto', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const row = queryOne<HasilInputAktivitasRow>(
        'SELECT id, foto_bukti, kode_unit, nama_aktivitas, lokasi, nama_pengawas, tanggal, shift_kerja, jam_kerja, hm_awal, hm_akhir, hm_harian_berjalan, operator, nik_operator, keterangan FROM hasil_input_aktivitas WHERE id = ?',
        [id]
      );

      if (!row) {
        return res.status(404).json({ error: 'Data aktivitas tidak ditemukan.' });
      }

      let foto_bukti = row.foto_bukti;
      if (!foto_bukti || foto_bukti.trim() === '') {
        foto_bukti = generateSampleFieldPhoto(
          row.kode_unit || 'UNIT-01',
          row.nama_aktivitas || 'Operasional',
          row.lokasi || 'Pit Operasional',
          row.nama_pengawas || 'Pengawas Lapangan',
          row.tanggal || new Date().toISOString().slice(0, 10)
        );
      }

      res.json({
        status: 'success',
        data: {
          id: row.id,
          kode_unit: row.kode_unit,
          nama_aktivitas: row.nama_aktivitas,
          foto_bukti,
          foto_stik_solar: foto_bukti,
          foto_hm: foto_bukti,
          foto_unit: foto_bukti,
          has_foto_bukti: true,
          has_foto_solar: true,
          has_foto_hm: true
        }
      });
    } catch (err: unknown) {
      console.error('Error fetching photo detail:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PUT /api/rekapitulasi/:id & /api/aktivitas-unit/:id
  app.put(['/api/rekapitulasi/:id', '/api/aktivitas-unit/:id'], upload.single('foto_bukti') as unknown as express.RequestHandler, (req: Request, res: Response) => {
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
        jumlah_liter_solar: rawJumlahLiterSolar,
        stik_awal: rawStikAwal,
        stik_akhir: rawStikAkhir,
        kendala_list: rawKendalaList,
        is_hm_awal_corrected: rawIsHmAwalCorrected,
        alasan_koreksi_hm: rawAlasanKoreksiHm
      } = req.body;

      const numHmAwal = parseFloat(hm_awal) || 0;
      const numHmAkhir = parseFloat(hm_akhir) || 0;
      const calculatedHmBerjalan = hm_harian_berjalan !== undefined
        ? parseFloat(hm_harian_berjalan)
        : Math.round((numHmAkhir - numHmAwal) * 10) / 10;

      // Status Unit & Solar handling: Otomatis tentukan status dari master_aktivitas jika tidak disertakan
      let autoActStatus: string | null = null;
      if (kode_sap || nama_aktivitas) {
        const matchedAct = queryOne<AktivitasUnitRow>(
          `SELECT kategori_status, status_unit FROM master_aktivitas WHERE (kode_sap = ? AND kode_sap != '') OR LOWER(nama_aktivitas) = LOWER(?) LIMIT 1`,
          [kode_sap || '', nama_aktivitas || '']
        );
        if (matchedAct) {
          autoActStatus = matchedAct.kategori_status || matchedAct.status_unit || null;
        }
      }
      let existingRow = !isNaN(id) ? queryOne<HasilInputAktivitasRow>('SELECT * FROM hasil_input_aktivitas WHERE id = ?', [id]) : null;

      let resolvedWilayah = req.body.wilayah;
      if (!resolvedWilayah && nama_pengawas) {
        const userRow = queryOne<UserRow>('SELECT wilayah FROM users WHERE LOWER(nama_lengkap) = LOWER(?) OR LOWER(username) = LOWER(?)', [nama_pengawas, nama_pengawas]);
        if (userRow?.wilayah) {
          resolvedWilayah = userRow.wilayah;
        }
      }
      if (!resolvedWilayah && kode_unit) {
        const unitRow = queryOne<UnitRow>('SELECT wilayah FROM units WHERE kode_unit = ?', [kode_unit]);
        if (unitRow?.wilayah) {
          resolvedWilayah = unitRow.wilayah;
        }
      }
      if (!resolvedWilayah) resolvedWilayah = 'PG1';

      if (!existingRow) {
        const rawId = req.params.id;
        const plan = queryOne<RencanaKerjaRow>('SELECT * FROM rencana_kerja WHERE id = ? OR CAST(id AS TEXT) = ?', [rawId, rawId]);
        if (plan) {
          execute(`
            UPDATE rencana_kerja SET
              nama_pengawas = ?, tanggal = ?, kode_unit = ?, nama_aktivitas = ?,
              kode_sap = ?, satuan = ?, operator = ?, shift_kerja = ?,
              keterangan_rencana = ?, nomor_spk = COALESCE(?, nomor_spk), wilayah = ?, updated_at = ?
            WHERE id = ?
          `, [
            nama_pengawas || plan.nama_pengawas,
            tanggal || plan.tanggal,
            kode_unit || plan.kode_unit,
            nama_aktivitas || plan.nama_aktivitas,
            kode_sap || plan.kode_sap,
            satuan || plan.satuan,
            operator || plan.operator,
            shift_kerja || plan.shift_kerja,
            keterangan || plan.keterangan_rencana,
            req.body.nomor_spk || null,
            resolvedWilayah,
            new Date().toISOString(),
            plan.id
          ]);
          saveDb();
          const updatedPlan = queryOne<RencanaKerjaRow>(`
            SELECT r.*, u.model_unit, l.wilayah
            FROM rencana_kerja r
            LEFT JOIN units u ON r.kode_unit = u.kode_unit
            LEFT JOIN lokasi l ON r.kode_lokasi = l.kode_lokasi
            WHERE r.id = ?
          `, [plan.id]);
          broadcast({
            event: 'UPDATE_RENCANA',
            data: updatedPlan,
            timestamp: new Date().toISOString()
          });
          broadcast({
            event: 'RENCANA_KERJA_UPDATED',
            data: updatedPlan,
            timestamp: new Date().toISOString()
          });
          return res.json({
            status: 'success',
            message: 'Rencana kerja berhasil diperbarui.',
            data: updatedPlan
          });
        }
      }

      const statusUnitStr = (rawStatusUnit || autoActStatus || existingRow?.status_unit || 'OPERASI').toUpperCase();
      const status_unit = ['OPERASI', 'STANDBY', 'BREAKDOWN'].includes(statusUnitStr) ? statusUnitStr : 'OPERASI';
      const is_isi_solar = (rawIsIsiSolar === true || rawIsIsiSolar === 1 || rawIsIsiSolar === '1' || rawIsIsiSolar === 'true') ? 1 : 0;
      const jumlah_liter_solar = is_isi_solar === 1 ? (parseFloat(rawJumlahLiterSolar) || 0) : 0;

      // Tangkap field solar & kendala dari request body sesuai spesifikasi
      const stikAwal = parseFloat(req.body.stik_solar_awal || req.body.stik_awal || rawStikAwal || 0);
      const stikAkhir = parseFloat(req.body.stik_solar_akhir || req.body.stik_akhir || rawStikAkhir || 0);
      let estimasiKonsumsi = parseFloat(req.body.estimasi_konsumsi_solar || req.body.konsumsi_solar || 0);
      if ((!estimasiKonsumsi || isNaN(estimasiKonsumsi)) && jumlah_liter_solar > 0 && (stikAkhir - stikAwal) > 0) {
        estimasiKonsumsi = Math.round((jumlah_liter_solar / (stikAkhir - stikAwal)) * 10) / 10;
      }

      // Tangkap seluruh kemungkinan key kendala dari Android:
      const rawKendala = 
        req.body.kendala_lapangan || 
        req.body.kendala_list || 
        req.body.kendala || 
        req.body.daftar_kendala || 
        rawKendalaList || 
        [];

      // Pastikan tersimpan sebagai format JSON String yang valid
      const kendalaJson = typeof rawKendala === 'string' 
        ? rawKendala 
        : JSON.stringify(Array.isArray(rawKendala) ? rawKendala : [rawKendala]);

      const jumlahKendala = Array.isArray(rawKendala) ? rawKendala.length : (rawKendala ? 1 : 0);

      // Parse array objek kendala untuk respons & broadcast real-time
      let parsedKendalaArr: any[] = [];
      try {
        const parsed = typeof rawKendala === 'string' ? JSON.parse(rawKendala || '[]') : (rawKendala || []);
        const arr = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
        parsedKendalaArr = arr.map((item: any, idx: number) => {
          if (typeof item === 'string') {
            const trimmed = item.trim();
            return {
              nama_kendala: trimmed,
              kendala: trimmed,
              nama: trimmed,
              kode_kendala: '-',
              kode: '-',
              jam_mulai: '-',
              jam_awal: '-',
              jam_selesai: '-',
              jam_akhir: '-',
              durasi_jam: 0,
              durasi: 0,
              hambatan: 0
            };
          }
          const nama = item.nama_kendala || item.kendala || item.nama || `Kendala #${idx + 1}`;
          const kode = item.kode_kendala || item.kode || item.id_kendala || '-';
          const jamMulai = item.jam_mulai || item.jam_awal || item.waktu_mulai || '-';
          const jamSelesai = item.jam_selesai || item.jam_akhir || item.waktu_selesai || '-';
          const durasi = item.durasi_jam !== undefined ? item.durasi_jam : (item.durasi !== undefined ? item.durasi : (item.hambatan !== undefined ? item.hambatan : (item.durasi_menit ? Math.round((item.durasi_menit / 60) * 10) / 10 : 0)));
          return {
            ...item,
            nama_kendala: nama,
            kendala: nama,
            nama: nama,
            kode_kendala: kode,
            kode: kode,
            jam_mulai: jamMulai,
            jam_awal: jamMulai,
            jam_selesai: jamSelesai,
            jam_akhir: jamSelesai,
            durasi_jam: durasi,
            durasi: durasi,
            hambatan: durasi
          };
        });
      } catch {
        if (typeof rawKendala === 'string' && rawKendala.trim() && rawKendala !== '[]') {
          parsedKendalaArr = [{
            nama_kendala: rawKendala.trim(),
            kendala: rawKendala.trim(),
            nama: rawKendala.trim(),
            kode_kendala: '-',
            kode: '-',
            jam_mulai: '-',
            jam_awal: '-',
            jam_selesai: '-',
            jam_akhir: '-',
            durasi_jam: 0,
            durasi: 0,
            hambatan: 0
          }];
        }
      }

      const kendalaListStr = kendalaJson;
      const adaKendala = (jumlahKendala > 0 || parsedKendalaArr.length > 0) ? 1 : 0;

      // HM Awal Correction Audit handling
      const is_hm_awal_corrected = rawIsHmAwalCorrected !== undefined
        ? ((rawIsHmAwalCorrected === true || rawIsHmAwalCorrected === 1 || rawIsHmAwalCorrected === '1' || rawIsHmAwalCorrected === 'true') ? 1 : 0)
        : 0;
      const alasan_koreksi_hm = is_hm_awal_corrected === 1
        ? (rawAlasanKoreksiHm !== undefined && rawAlasanKoreksiHm !== null && String(rawAlasanKoreksiHm).trim() !== '' ? String(rawAlasanKoreksiHm).trim() : null)
        : null;

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
            status_unit = ?, is_isi_solar = ?, jumlah_liter_solar = ?,
            stik_awal = ?, stik_akhir = ?, stik_solar_awal = ?, stik_solar_akhir = ?, estimasi_konsumsi_solar = ?, kendala_list = ?, ada_kendala = ?,
            is_hm_awal_corrected = ?, alasan_koreksi_hm = ?, wilayah = ?
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
          stikAwal,
          stikAkhir,
          stikAwal,
          stikAkhir,
          estimasiKonsumsi,
          kendalaListStr,
          adaKendala,
          is_hm_awal_corrected,
          alasan_koreksi_hm,
          resolvedWilayah,
          id
        ];
      } else {
        sql = `
          UPDATE hasil_input_aktivitas SET
            nama_pengawas = ?, tanggal = ?, kode_unit = ?, nama_aktivitas = ?,
            kode_sap = ?, satuan = ?, operator = ?, nik_operator = ?, lokasi = ?,
            shift_kerja = ?, jam_kerja = ?, hm_awal = ?, hm_akhir = ?, hm_harian_berjalan = ?,
            hasil_kerja = ?, keterangan = ?,
            status_unit = ?, is_isi_solar = ?, jumlah_liter_solar = ?,
            stik_awal = ?, stik_akhir = ?, stik_solar_awal = ?, stik_solar_akhir = ?, estimasi_konsumsi_solar = ?, kendala_list = ?, ada_kendala = ?,
            is_hm_awal_corrected = ?, alasan_koreksi_hm = ?, wilayah = ?
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
          stikAwal,
          stikAkhir,
          stikAwal,
          stikAkhir,
          estimasiKonsumsi,
          kendalaListStr,
          adaKendala,
          is_hm_awal_corrected,
          alasan_koreksi_hm,
          resolvedWilayah,
          id
        ];
      }

      execute(sql, params);
      saveDb();

      // Sinkronkan juga master aktivitas_unit jika cocok
      try {
        execute(
          'UPDATE aktivitas_unit SET stik_solar_awal = ?, stik_solar_akhir = ?, estimasi_konsumsi_solar = ?, kendala_list = ?, ada_kendala = ? WHERE nama_aktivitas = ? OR kode_sap = ?',
          [stikAwal, stikAkhir, estimasiKonsumsi, kendalaListStr, adaKendala, nama_aktivitas, kode_sap]
        );
      } catch (errSync) {
        console.warn('Sync aktivitas_unit notice:', errSync);
      }

      const updatedRow = queryOne<HasilInputAktivitasRow>(
        'SELECT * FROM hasil_input_aktivitas WHERE id = ?',
        [id]
      );

      const formattedUpdatedRow = updatedRow ? {
        ...updatedRow,
        stik_awal: stikAwal,
        stik_akhir: stikAkhir,
        stik_solar_awal: stikAwal,
        stik_solar_akhir: stikAkhir,
        estimasi_konsumsi_solar: estimasiKonsumsi,
        ada_kendala: adaKendala,
        kendala_list: parsedKendalaArr
      } : null;

      broadcast({
        event: 'UPDATE_ACTIVITY',
        data: formattedUpdatedRow,
        timestamp: new Date().toISOString()
      });

      broadcast({
        event: 'UPDATE_REALISASI',
        data: formattedUpdatedRow,
        timestamp: new Date().toISOString()
      });

      res.json({ status: 'success', data: formattedUpdatedRow });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/rekapitulasi/:id & /api/aktivitas-unit/:id (Detail Aktivitas)
  app.get(['/api/rekapitulasi/:id', '/api/aktivitas-unit/:id'], (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const row = queryOne<HasilInputAktivitasRow>(
        'SELECT * FROM hasil_input_aktivitas WHERE id = ?',
        [id]
      );
      if (!row) {
        return res.status(404).json({ error: 'Data aktivitas tidak ditemukan.' });
      }

      let parsedKendala: Array<{ nama_kendala: string; waktu_mulai?: string; waktu_selesai?: string; durasi_menit?: number }> = [];
      if (row.kendala_list) {
        try {
          const parsed = typeof row.kendala_list === 'string' ? JSON.parse(row.kendala_list) : row.kendala_list;
          parsedKendala = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          parsedKendala = [{ nama_kendala: String(row.kendala_list) }];
        }
      }

      const stikSolarAwal = row.stik_solar_awal !== null && row.stik_solar_awal !== undefined ? parseFloat(String(row.stik_solar_awal)) : (row.stik_awal !== null && row.stik_awal !== undefined ? parseFloat(String(row.stik_awal)) : 0);
      const stikSolarAkhir = row.stik_solar_akhir !== null && row.stik_solar_akhir !== undefined ? parseFloat(String(row.stik_solar_akhir)) : (row.stik_akhir !== null && row.stik_akhir !== undefined ? parseFloat(String(row.stik_akhir)) : 0);
      let estKonsumsi = row.estimasi_konsumsi_solar !== null && row.estimasi_konsumsi_solar !== undefined ? parseFloat(String(row.estimasi_konsumsi_solar)) : 0;
      if ((!estKonsumsi || estKonsumsi === 0) && row.jumlah_liter_solar && (stikSolarAkhir - stikSolarAwal) > 0) {
        estKonsumsi = Math.round((Number(row.jumlah_liter_solar) / (stikSolarAkhir - stikSolarAwal)) * 10) / 10;
      }
      const adaKendala = (row.ada_kendala === 1 || parsedKendala.length > 0) ? 1 : 0;

      res.json({
        status: 'success',
        data: {
          ...row,
          stik_awal: stikSolarAwal,
          stik_akhir: stikSolarAkhir,
          stik_solar_awal: stikSolarAwal,
          stik_solar_akhir: stikSolarAkhir,
          estimasi_konsumsi_solar: estKonsumsi,
          ada_kendala: adaKendala,
          kendala: parsedKendala,
          kendala_list: parsedKendala
        }
      });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // DELETE /api/rekapitulasi/:id & /api/aktivitas-unit/:id
  app.delete(['/api/rekapitulasi/:id', '/api/aktivitas-unit/:id'], (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      execute('DELETE FROM hasil_input_aktivitas WHERE id = ? OR uuid = ?', [id, id]);

      io.emit("AKTIVITAS_DELETED", { id });
      broadcast({
        event: 'DELETE_ACTIVITY',
        type: 'DELETE_ACTIVITY',
        id,
        timestamp: new Date().toISOString()
      });

      res.json({ success: true, status: 'success', message: 'Data aktivitas berhasil dihapus' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 4. KPI STATS ENDPOINT
  app.get('/api/stats', (req: Request, res: Response) => {
    try {
      const { wilayah } = req.query;
      let sql = 'SELECT h.* FROM hasil_input_aktivitas h LEFT JOIN units u ON h.kode_unit = u.kode_unit WHERE 1=1';
      const params: (string | number)[] = [];
      if (wilayah && typeof wilayah === 'string' && wilayah !== 'Semua' && wilayah !== 'Semua Wilayah') {
        sql += ' AND (h.wilayah = ? OR u.wilayah = ? OR h.nama_pengawas IN (SELECT nama_lengkap FROM users WHERE wilayah = ?))';
        params.push(wilayah, wilayah, wilayah);
      }
      const rows = queryAll<HasilInputAktivitasRow>(sql, params);
      
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
  app.get(['/api/analitik', '/api/analytics'], (req: Request, res: Response) => {
    try {
      const { startDate, endDate, pengawas, unit, shift, status, wilayah } = req.query;
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
      if (wilayah && typeof wilayah === 'string' && wilayah.toUpperCase() !== 'SEMUA' && wilayah !== 'Semua Wilayah') {
        whereClause += ' AND (h.wilayah = ? OR u.wilayah = ? OR h.nama_pengawas IN (SELECT nama_lengkap FROM users WHERE wilayah = ?))';
        params.push(wilayah, wilayah, wilayah);
      }
      if (pengawas && typeof pengawas === 'string' && pengawas !== 'Semua') {
        whereClause += ' AND h.nama_pengawas = ?';
        params.push(pengawas);
      }
      if (unit && typeof unit === 'string' && unit !== 'Semua') {
        whereClause += ' AND h.kode_unit = ?';
        params.push(unit);
      }
      if (shift && typeof shift === 'string' && shift !== 'Semua') {
        whereClause += ' AND UPPER(COALESCE(h.shift_kerja, "")) = ?';
        params.push(shift.toUpperCase());
      }
      if (status && typeof status === 'string' && status !== 'Semua') {
        whereClause += ' AND UPPER(COALESCE(h.kategori_status, h.status_unit, "OPERASI")) = ?';
        params.push(status.toUpperCase());
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
        LEFT JOIN units u ON h.kode_unit = u.kode_unit
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
        LEFT JOIN units u ON h.kode_unit = u.kode_unit
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
      const total_jam_operasi = Math.round(operasiHours * 10) / 10;
      const total_jam_standby = Math.round(standbyHours * 10) / 10;
      const total_jam_breakdown = Math.round(breakdownHours * 10) / 10;

      // PA (Physical Availability): (Jam Operasi + Jam Standby) / Total Jam * 100%
      const pa = totalHours > 0
        ? Math.round(((total_jam_operasi + total_jam_standby) / totalHours) * 1000) / 10
        : 100;

      // UA (Utilization of Availability): Jam Operasi / (Jam Operasi + Jam Standby) * 100%
      const availableHours = total_jam_operasi + total_jam_standby;
      const ua = availableHours > 0
        ? Math.round((total_jam_operasi / availableHours) * 1000) / 10
        : 100;

      const statusWaktu = {
        operasi_count: operasiCount,
        operasi_hours: total_jam_operasi,
        total_jam_operasi,
        operasi_percent: totalHours > 0 ? Math.round((operasiHours / totalHours) * 100) : 0,
        standby_count: standbyCount,
        standby_hours: total_jam_standby,
        total_jam_standby,
        standby_percent: totalHours > 0 ? Math.round((standbyHours / totalHours) * 100) : 0,
        breakdown_count: breakdownCount,
        breakdown_hours: total_jam_breakdown,
        total_jam_breakdown,
        breakdown_percent: totalHours > 0 ? Math.round((breakdownHours / totalHours) * 100) : 0,
        total_hours: totalHours,
        pa,
        ua
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
        total_jam_operasi,
        total_jam_standby,
        total_jam_breakdown,
        pa,
        ua,
        unitData,
        aktivitasData,
        statusWaktu
      });
    } catch (err: unknown) {
      console.error('Error fetching analytics:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 5. MASTER UNITS CRUD (Supports Soft Delete)
  app.get('/api/units', (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      let sql = 'SELECT id, kode_unit, jenis_unit, model_unit, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, \'PG1\') as wilayah, hm_unit_terakhir_diinputkan, hm_min_standar, hm_max_standar, status_aktif, updated_at FROM units WHERE 1=1';
      const params: (string | number)[] = [];

      if (status !== undefined && status !== 'Semua' && status !== '') {
        sql += ' AND status_aktif = ?';
        params.push(status === '1' || status === 'true' || status === 'aktif' ? 1 : 0);
      }

      sql += ' ORDER BY id DESC';
      const rows = queryAll<UnitRow>(sql, params);
      res.json(rows);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/units', (req: Request, res: Response) => {
    try {
      const { 
        kode_unit, 
        jenis_unit, 
        model_unit, 
        nama_pengawas, 
        kasie: rawKasie,
        wilayah: rawWilayah,
        hm_unit_terakhir_diinputkan,
        hm_min_standar,
        hm_max_standar,
        status_aktif
      } = req.body;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const minVal = (hm_min_standar !== undefined && hm_min_standar !== null && hm_min_standar !== '') ? parseFloat(hm_min_standar) : null;
      const maxVal = (hm_max_standar !== undefined && hm_max_standar !== null && hm_max_standar !== '') ? parseFloat(hm_max_standar) : null;
      const activeStatus = status_aktif === 0 || status_aktif === '0' || status_aktif === false ? 0 : 1;
      const kasie = rawKasie || nama_pengawas;
      let wilayah = (rawWilayah || '').toString().trim();
      if (!wilayah) {
        const uRow = queryOne<{ wilayah: string }>('SELECT wilayah FROM users WHERE nama_lengkap = ? OR username = ?', [nama_pengawas, nama_pengawas]);
        wilayah = uRow?.wilayah || 'PG1';
      }

      const resDb = execute(`
        INSERT INTO units (kode_unit, jenis_unit, model_unit, nama_pengawas, kasie, wilayah, hm_unit_terakhir_diinputkan, hm_min_standar, hm_max_standar, status_aktif, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [kode_unit, jenis_unit, model_unit, nama_pengawas, kasie, wilayah, parseFloat(hm_unit_terakhir_diinputkan) || 0, minVal, maxVal, activeStatus, now]);

      const inserted = queryOne<UnitRow>('SELECT id, kode_unit, jenis_unit, model_unit, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, \'PG1\') as wilayah, hm_unit_terakhir_diinputkan, hm_min_standar, hm_max_standar, status_aktif, updated_at FROM units WHERE id = ?', [resDb.lastInsertRowId]);
      res.status(201).json(inserted);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/units/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { 
        kode_unit, 
        jenis_unit, 
        model_unit, 
        nama_pengawas, 
        kasie: rawKasie,
        wilayah: rawWilayah,
        hm_unit_terakhir_diinputkan,
        hm_min_standar,
        hm_max_standar,
        status_aktif
      } = req.body;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const minVal = (hm_min_standar !== undefined && hm_min_standar !== null && hm_min_standar !== '') ? parseFloat(hm_min_standar) : null;
      const maxVal = (hm_max_standar !== undefined && hm_max_standar !== null && hm_max_standar !== '') ? parseFloat(hm_max_standar) : null;
      const existing = queryOne<UnitRow>('SELECT * FROM units WHERE id = ?', [id]);
      const activeStatus = status_aktif !== undefined
        ? (status_aktif === 0 || status_aktif === '0' || status_aktif === false ? 0 : 1)
        : (existing?.status_aktif ?? 1);
      const kasie = rawKasie || nama_pengawas;
      let wilayah = (rawWilayah || '').toString().trim();
      if (!wilayah) {
        const uRow = queryOne<{ wilayah: string }>('SELECT wilayah FROM users WHERE nama_lengkap = ? OR username = ?', [nama_pengawas, nama_pengawas]);
        wilayah = uRow?.wilayah || existing?.wilayah || 'PG1';
      }

      execute(`
        UPDATE units SET 
          kode_unit = ?, 
          jenis_unit = ?, 
          model_unit = ?, 
          nama_pengawas = ?, 
          kasie = ?,
          wilayah = ?,
          hm_unit_terakhir_diinputkan = ?, 
          hm_min_standar = ?,
          hm_max_standar = ?,
          status_aktif = ?,
          updated_at = ?
        WHERE id = ?
      `, [kode_unit, jenis_unit, model_unit, nama_pengawas, kasie, wilayah, parseFloat(hm_unit_terakhir_diinputkan) || 0, minVal, maxVal, activeStatus, now, id]);

      const updated = queryOne<UnitRow>('SELECT id, kode_unit, jenis_unit, model_unit, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, \'PG1\') as wilayah, hm_unit_terakhir_diinputkan, hm_min_standar, hm_max_standar, status_aktif, updated_at FROM units WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/units/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      execute('UPDATE units SET status_aktif = 0 WHERE id = ?', [id]);
      res.json({ message: 'Unit berhasil dinonaktifkan (soft delete)', status: 'success' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Toggle status endpoint for Master Unit
  app.patch(['/api/master-unit/:id/toggle-status', '/api/units/:id/toggle-status'], (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = queryOne<UnitRow>('SELECT * FROM units WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Unit tidak ditemukan' });
      }
      const newStatus = (existing.status_aktif ?? 1) === 1 ? 0 : 1;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      execute('UPDATE units SET status_aktif = ?, updated_at = ? WHERE id = ?', [newStatus, now, id]);
      const updated = queryOne<UnitRow>('SELECT * FROM units WHERE id = ?', [id]);
      res.json({
        status: 'success',
        message: `Status unit ${existing.kode_unit} berhasil diubah menjadi ${newStatus === 1 ? 'Aktif' : 'Nonaktif'}`,
        data: updated
      });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 6. MASTER AKTIVITAS CRUD (Supports Soft Delete & Kategori Status Otomatis)
  app.get(['/api/master-aktivitas', '/api/aktivitas'], (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      let sql = 'SELECT id, uuid, client_transaction_id, jenis_unit, nama_aktivitas, satuan, kode_sap, COALESCE(kategori_status, \'OPERASI\') as kategori_status, COALESCE(status_unit, kategori_status, \'OPERASI\') as status_unit, status_aktif, stik_solar_awal, stik_solar_akhir, estimasi_konsumsi_solar, kendala_list, ada_kendala FROM aktivitas_unit WHERE 1=1';
      const params: (string | number)[] = [];

      if (status !== undefined && status !== 'Semua' && status !== '') {
        sql += ' AND status_aktif = ?';
        params.push(status === '1' || status === 'true' || status === 'aktif' ? 1 : 0);
      }

      sql += ' ORDER BY id DESC';
      const rows = queryAll<AktivitasUnitRow>(sql, params);
      res.json(rows);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post(['/api/master-aktivitas', '/api/aktivitas'], (req: Request, res: Response) => {
    try {
      const { jenis_unit, nama_aktivitas, satuan, kode_sap, status_aktif, kategori_status: rawKategoriStatus } = req.body;
      const activeStatus = status_aktif === 0 || status_aktif === '0' || status_aktif === false ? 0 : 1;
      const validKategori = ['OPERASI', 'STANDBY', 'BREAKDOWN'];
      const kategori_status = rawKategoriStatus && validKategori.includes(String(rawKategoriStatus).toUpperCase())
        ? String(rawKategoriStatus).toUpperCase()
        : 'OPERASI';

      const resDb = execute(`
        INSERT INTO aktivitas_unit (jenis_unit, nama_aktivitas, satuan, kode_sap, status_aktif, kategori_status, status_unit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [jenis_unit, nama_aktivitas, satuan, kode_sap, activeStatus, kategori_status, kategori_status]);

      const inserted = queryOne<AktivitasUnitRow>('SELECT * FROM aktivitas_unit WHERE id = ?', [resDb.lastInsertRowId]);
      res.status(201).json(inserted);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put(['/api/master-aktivitas/:id', '/api/aktivitas/:id'], (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { jenis_unit, nama_aktivitas, satuan, kode_sap, status_aktif, kategori_status: rawKategoriStatus } = req.body;
      const existing = queryOne<AktivitasUnitRow>('SELECT * FROM aktivitas_unit WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Aktivitas tidak ditemukan' });
      }

      const activeStatus = status_aktif !== undefined
        ? (status_aktif === 0 || status_aktif === '0' || status_aktif === false ? 0 : 1)
        : (existing?.status_aktif ?? 1);

      const validKategori = ['OPERASI', 'STANDBY', 'BREAKDOWN'];
      const kategori_status = rawKategoriStatus && validKategori.includes(String(rawKategoriStatus).toUpperCase())
        ? String(rawKategoriStatus).toUpperCase()
        : (existing?.kategori_status || 'OPERASI');

      execute(`
        UPDATE aktivitas_unit SET 
          jenis_unit = ?, 
          nama_aktivitas = ?, 
          satuan = ?, 
          kode_sap = ?, 
          status_aktif = ?,
          kategori_status = ?,
          status_unit = ?
        WHERE id = ?
      `, [jenis_unit, nama_aktivitas, satuan, kode_sap, activeStatus, kategori_status, kategori_status, id]);

      const updated = queryOne<AktivitasUnitRow>('SELECT * FROM aktivitas_unit WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete(['/api/master-aktivitas/:id', '/api/aktivitas/:id'], (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      execute('UPDATE aktivitas_unit SET status_aktif = 0 WHERE id = ?', [id]);
      res.json({ message: 'Aktivitas berhasil dinonaktifkan (soft delete)', status: 'success' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Toggle status endpoint for Master Aktivitas
  app.patch(['/api/master-aktivitas/:id/toggle-status', '/api/aktivitas/:id/toggle-status'], (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = queryOne<AktivitasUnitRow>('SELECT * FROM aktivitas_unit WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Aktivitas tidak ditemukan' });
      }
      const newStatus = (existing.status_aktif ?? 1) === 1 ? 0 : 1;
      execute('UPDATE aktivitas_unit SET status_aktif = ? WHERE id = ?', [newStatus, id]);
      const updated = queryOne<AktivitasUnitRow>('SELECT * FROM aktivitas_unit WHERE id = ?', [id]);
      res.json({
        status: 'success',
        message: `Status aktivitas ${existing.nama_aktivitas} berhasil diubah menjadi ${newStatus === 1 ? 'Aktif' : 'Nonaktif'}`,
        data: updated
      });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 7. MASTER OPERATORS CRUD (Supports Soft Delete)
  app.get('/api/operators', (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      let sql = 'SELECT id, nama_operator, nik, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, \'PG1\') as wilayah, status_aktif FROM operators WHERE 1=1';
      const params: (string | number)[] = [];

      if (status !== undefined && status !== 'Semua' && status !== '') {
        sql += ' AND status_aktif = ?';
        params.push(status === '1' || status === 'true' || status === 'aktif' ? 1 : 0);
      }

      sql += ' ORDER BY id DESC';
      const rows = queryAll<OperatorRow>(sql, params);
      res.json(rows);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/operators', (req: Request, res: Response) => {
    try {
      const { nama_operator, nik, nama_pengawas, kasie: rawKasie, wilayah: rawWilayah, status_aktif } = req.body;
      const activeStatus = status_aktif === 0 || status_aktif === '0' || status_aktif === false ? 0 : 1;
      const kasie = rawKasie || nama_pengawas;
      let wilayah = (rawWilayah || '').toString().trim();
      if (!wilayah) {
        const uRow = queryOne<{ wilayah: string }>('SELECT wilayah FROM users WHERE nama_lengkap = ? OR username = ?', [nama_pengawas, nama_pengawas]);
        wilayah = uRow?.wilayah || 'PG1';
      }

      const resDb = execute(`
        INSERT INTO operators (nama_operator, nik, nama_pengawas, kasie, wilayah, status_aktif)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [nama_operator, nik, nama_pengawas, kasie, wilayah, activeStatus]);

      const inserted = queryOne<OperatorRow>('SELECT id, nama_operator, nik, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, \'PG1\') as wilayah, status_aktif FROM operators WHERE id = ?', [resDb.lastInsertRowId]);
      res.status(201).json(inserted);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/operators/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { nama_operator, nik, nama_pengawas, kasie: rawKasie, wilayah: rawWilayah, status_aktif } = req.body;
      const existing = queryOne<OperatorRow>('SELECT * FROM operators WHERE id = ?', [id]);
      const activeStatus = status_aktif !== undefined
        ? (status_aktif === 0 || status_aktif === '0' || status_aktif === false ? 0 : 1)
        : (existing?.status_aktif ?? 1);
      const kasie = rawKasie || nama_pengawas;
      let wilayah = (rawWilayah || '').toString().trim();
      if (!wilayah) {
        const uRow = queryOne<{ wilayah: string }>('SELECT wilayah FROM users WHERE nama_lengkap = ? OR username = ?', [nama_pengawas, nama_pengawas]);
        wilayah = uRow?.wilayah || existing?.wilayah || 'PG1';
      }

      execute(`
        UPDATE operators SET nama_operator = ?, nik = ?, nama_pengawas = ?, kasie = ?, wilayah = ?, status_aktif = ?
        WHERE id = ?
      `, [nama_operator, nik, nama_pengawas, kasie, wilayah, activeStatus, id]);

      const updated = queryOne<OperatorRow>('SELECT id, nama_operator, nik, nama_pengawas, COALESCE(kasie, nama_pengawas) as kasie, COALESCE(wilayah, \'PG1\') as wilayah, status_aktif FROM operators WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/operators/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      execute('UPDATE operators SET status_aktif = 0 WHERE id = ?', [id]);
      res.json({ message: 'Operator berhasil dinonaktifkan (soft delete)', status: 'success' });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Toggle status endpoint for Master Operator
  app.patch(['/api/master-operator/:id/toggle-status', '/api/operators/:id/toggle-status'], (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = queryOne<OperatorRow>('SELECT * FROM operators WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Operator tidak ditemukan' });
      }
      const newStatus = (existing.status_aktif ?? 1) === 1 ? 0 : 1;
      execute('UPDATE operators SET status_aktif = ? WHERE id = ?', [newStatus, id]);
      const updated = queryOne<OperatorRow>('SELECT * FROM operators WHERE id = ?', [id]);
      res.json({
        status: 'success',
        message: `Status operator ${existing.nama_operator} berhasil diubah menjadi ${newStatus === 1 ? 'Aktif' : 'Nonaktif'}`,
        data: updated
      });
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
        'SELECT id, nama_lengkap, username, password, hak_akses, role, wilayah, status_aktif FROM users WHERE LOWER(username) = LOWER(?)',
        [username.trim()]
      );

      if (!user) {
        return res.status(401).json({ error: 'Username atau kata sandi tidak sesuai.' });
      }

      if ((user.status_aktif ?? 1) === 0) {
        return res.status(403).json({ error: 'Akun Anda sedang dinonaktifkan oleh administrator.' });
      }

      if (user.password !== password) {
        return res.status(401).json({ error: 'Username atau kata sandi tidak sesuai.' });
      }

      const resolvedRole: UserRole = (
        user.role ||
        (user.username.toLowerCase() === 'admin' ? 'SUPER_ADMIN' :
         user.hak_akses?.toLowerCase() === 'manager' ? 'MANAGER' :
         (user.hak_akses?.toLowerCase() === 'admin' || user.hak_akses?.toLowerCase() === 'super admin') ? 'SUPER_ADMIN' :
         (user.hak_akses?.toLowerCase() === 'pengawas' || user.hak_akses?.toLowerCase() === 'kasie') ? 'SUPERVISOR' :
         'SUPERVISOR')
      );

      // KEBIJAKAN KEAMANAN: HANYA SUPER ADMIN DAN MANAGER YANG BISA LOGIN KE WEBSITE PORTAL
      const isAllowedToLoginWebsite = (
        resolvedRole === 'SUPER_ADMIN' ||
        resolvedRole === 'ADMIN' ||
        resolvedRole === 'MANAGER' ||
        user.hak_akses?.toLowerCase() === 'manager' ||
        user.hak_akses?.toLowerCase() === 'admin' ||
        user.hak_akses?.toLowerCase() === 'super admin' ||
        user.username.toLowerCase() === 'admin' ||
        user.username.toLowerCase() === 'manager'
      ) && (
        user.hak_akses?.toLowerCase() !== 'kasie' &&
        user.hak_akses?.toLowerCase() !== 'pengawas' &&
        resolvedRole !== 'SUPERVISOR'
      );

      if (!isAllowedToLoginWebsite) {
        return res.status(403).json({
          error: 'Akses ditolak: Hanya Super Admin dan Manager yang berhak login ke website portal ini. Akun Kasie/Pengawas lapangan hanya dapat digunakan pada aplikasi Android HeavyTrack Mobile.'
        });
      }

      res.json({
        status: 'success',
        message: 'Login berhasil.',
        role: resolvedRole,
        token: `rkce_token_${user.id}_${Date.now()}`,
        user: {
          id: user.id,
          nama_lengkap: user.nama_lengkap,
          username: user.username,
          hak_akses: resolvedRole === 'MANAGER' ? 'Manager' : (resolvedRole === 'SUPER_ADMIN' || resolvedRole === 'ADMIN' ? 'Super Admin' : user.hak_akses),
          role: resolvedRole,
          wilayah: user.wilayah || 'Semua Wilayah',
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
      const { status } = req.query;
      let sql = 'SELECT id, nama_lengkap, username, hak_akses, role, wilayah, status_aktif FROM users WHERE 1=1';
      const params: (string | number)[] = [];

      if (status !== undefined && status !== 'Semua' && status !== '') {
        sql += ' AND status_aktif = ?';
        params.push(status === '1' || status === 'true' || status === 'aktif' ? 1 : 0);
      }

      sql += ' ORDER BY id ASC';
      const rows = queryAll<UserRow>(sql, params);
      res.json(rows);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/users', (req: Request, res: Response) => {
    try {
      const { nama_lengkap, username, password, hak_akses, role, wilayah, status_aktif } = req.body;
      const activeStatus = status_aktif === 0 || status_aktif === '0' || status_aktif === false ? 0 : 1;
      const resolvedRole = role || (
        hak_akses?.toLowerCase() === 'manager' ? 'MANAGER' :
        (hak_akses?.toLowerCase() === 'pengawas' || hak_akses?.toLowerCase() === 'kasie') ? 'SUPERVISOR' :
        'SUPER_ADMIN'
      );
      const userWilayah = (wilayah && String(wilayah).trim()) || 'PG1';
      const userHakAkses = hak_akses || 'Kasie';

      const resDb = execute(`
        INSERT INTO users (nama_lengkap, username, password, hak_akses, role, wilayah, status_aktif)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [nama_lengkap, username, password, userHakAkses, resolvedRole, userWilayah, activeStatus]);

      const inserted = queryOne<UserRow>('SELECT id, nama_lengkap, username, hak_akses, role, wilayah, status_aktif FROM users WHERE id = ?', [resDb.lastInsertRowId]);
      res.status(201).json(inserted);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/users/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { nama_lengkap, username, password, hak_akses, role, wilayah, status_aktif } = req.body;
      const existing = queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }
      const activeStatus = status_aktif !== undefined
        ? (status_aktif === 0 || status_aktif === '0' || status_aktif === false ? 0 : 1)
        : (existing?.status_aktif ?? 1);
      const resolvedRole = role || (
        hak_akses ? (
          hak_akses.toLowerCase() === 'manager' ? 'MANAGER' :
          (hak_akses.toLowerCase() === 'pengawas' || hak_akses.toLowerCase() === 'kasie') ? 'SUPERVISOR' : 'SUPER_ADMIN'
        ) : (existing?.role || 'SUPER_ADMIN')
      );
      const userWilayah = wilayah !== undefined ? (String(wilayah).trim() || 'PG1') : (existing?.wilayah || 'PG1');
      const userHakAkses = hak_akses || existing?.hak_akses || 'Kasie';

      if (password) {
        execute('UPDATE users SET nama_lengkap = ?, username = ?, password = ?, hak_akses = ?, role = ?, wilayah = ?, status_aktif = ? WHERE id = ?',
          [nama_lengkap, username, password, userHakAkses, resolvedRole, userWilayah, activeStatus, id]);
      } else {
        execute('UPDATE users SET nama_lengkap = ?, username = ?, hak_akses = ?, role = ?, wilayah = ?, status_aktif = ? WHERE id = ?',
          [nama_lengkap, username, userHakAkses, resolvedRole, userWilayah, activeStatus, id]);
      }

      const updated = queryOne<UserRow>('SELECT id, nama_lengkap, username, hak_akses, role, wilayah, status_aktif FROM users WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Toggle status endpoint for Master User
  app.patch(['/api/master-user/:id/toggle-status', '/api/users/:id/toggle-status'], (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }
      if (existing.username === 'admin') {
        return res.status(400).json({ error: 'Akun Super Admin utama tidak boleh dinonaktifkan.' });
      }
      const newStatus = (existing.status_aktif ?? 1) === 1 ? 0 : 1;
      execute('UPDATE users SET status_aktif = ? WHERE id = ?', [newStatus, id]);
      const updated = queryOne<UserRow>('SELECT id, nama_lengkap, username, hak_akses, status_aktif FROM users WHERE id = ?', [id]);
      res.json({
        status: 'success',
        message: `Status akun @${existing.username} berhasil diubah menjadi ${newStatus === 1 ? 'Aktif' : 'Nonaktif'}`,
        data: updated
      });
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

  // 10. APP SETTINGS / SYSTEM CONFIG (HM STANDAR CONFIG)
  app.get('/api/settings/hm-standar', (req: Request, res: Response) => {
    try {
      const minRow = queryOne<AppSettingRow>("SELECT value FROM app_settings WHERE key = 'hm_min_standar'");
      const maxRow = queryOne<AppSettingRow>("SELECT value FROM app_settings WHERE key = 'hm_max_standar'");
      const hm_min = minRow ? parseFloat(minRow.value) || 6.0 : 6.0;
      const hm_max = maxRow ? parseFloat(maxRow.value) || 10.0 : 10.0;
      res.json({
        hm_min_standar: hm_min,
        hm_max_standar: hm_max,
        hm_min,
        hm_max
      });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/settings/hm-standar', (req: Request, res: Response) => {
    try {
      const { hm_min_standar, hm_max_standar } = req.body;
      const minVal = parseFloat(hm_min_standar);
      const maxVal = parseFloat(hm_max_standar);

      if (isNaN(minVal) || isNaN(maxVal)) {
        return res.status(400).json({ error: 'Nilai standar minimal dan maksimal HM harus berupa angka valid.' });
      }
      if (minVal < 0 || maxVal < 0) {
        return res.status(400).json({ error: 'Nilai standar HM tidak boleh bernilai negatif.' });
      }
      if (minVal > maxVal) {
        return res.status(400).json({ error: 'Standar minimal HM tidak boleh lebih besar dari standar maksimal HM.' });
      }

      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

      // Upsert into app_settings
      execute(`
        INSERT INTO app_settings (key, value, keterangan, updated_at)
        VALUES ('hm_min_standar', ?, 'Batas minimal HM normal per shift', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `, [minVal.toFixed(1), now]);

      execute(`
        INSERT INTO app_settings (key, value, keterangan, updated_at)
        VALUES ('hm_max_standar', ?, 'Batas maksimal wajar HM per shift', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `, [maxVal.toFixed(1), now]);

      // Broadcast WebSocket notification to all active clients (Android & Web)
      broadcast({
        event: 'HM_STANDAR_UPDATED',
        type: 'HM_STANDAR_UPDATED',
        hm_standar: { min: minVal, max: maxVal },
        hm_min_standar: minVal,
        hm_max_standar: maxVal,
        timestamp: new Date().toISOString()
      });

      console.log(`⚙️ [SETTINGS_UPDATED] Batas standar HM diubah ke: ${minVal} - ${maxVal} HM & dibroadcast via WebSocket`);

      res.json({
        status: 'success',
        message: 'Pengaturan standar operasional HM berhasil disimpan!',
        hm_standar: { min: minVal, max: maxVal },
        hm_min_standar: minVal,
        hm_max_standar: maxVal
      });
    } catch (err: unknown) {
      console.error('Error updating HM standard settings:', err);
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
    console.log(`Server running on port ${PORT}`);
    console.log(`🚀 RKCE (Rencana Kerja Unit Civil Engineering) Server running at http://0.0.0.0:${PORT}`);
    console.log(`🔌 WebSocket server listening on ws://0.0.0.0:${PORT}/ws`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
