import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Activity, 
  Truck, 
  ListChecks, 
  UserCheck, 
  Users, 
  RefreshCw,
  HardHat,
  Smartphone,
  ChevronRight,
  Database,
  BarChart3,
  FileCheck2,
  MapPin
} from 'lucide-react';
import { 
  HasilInputAktivitas, 
  Unit, 
  AktivitasUnit, 
  Operator, 
  User, 
  KpiStats,
  RencanaKerja,
  Lokasi
} from './types';
import { soundService } from './utils/sound';
import { Header } from './components/Header';
import { KpiCards } from './components/KpiCards';
import { RencanaKerjaView } from './components/RencanaKerjaView';
import { ActivityMonitor } from './components/ActivityMonitor';
import { MasterLokasi } from './components/MasterLokasi';
import { AnalyticsView } from './components/AnalyticsView';
import { MasterUnits } from './components/MasterUnits';
import { MasterAktivitas } from './components/MasterAktivitas';
import { MasterOperators } from './components/MasterOperators';
import { MasterUsers } from './components/MasterUsers';
import { ManualActivityModal } from './components/ManualActivityModal';
import { EditActivityModal } from './components/EditActivityModal';
import { BackupModal } from './components/BackupModal';
import { AndroidIntegrationModal } from './components/AndroidIntegrationModal';
import { PhotoLightboxModal } from './components/PhotoLightboxModal';

type ActiveTab = 'rencana' | 'rekapitulasi' | 'lokasi' | 'analytics' | 'units' | 'aktivitas' | 'operators' | 'users';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('rencana');

  // Main Data States
  const [rencanaList, setRencanaList] = useState<RencanaKerja[]>([]);
  const [activities, setActivities] = useState<HasilInputAktivitas[]>([]);
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [aktivitasList, setAktivitasList] = useState<AktivitasUnit[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<KpiStats>({
    totalHmBerjalan: 0,
    totalJamKerja: 0,
    unitBeroperasi: 0,
    totalLaporanMasuk: 0,
    shiftSiangCount: 0,
    shiftMalamCount: 0,
    totalSolarTerpakai: 0
  });

  // Glowing row highlight tracker (4-second duration)
  const [newActivityIds, setNewActivityIds] = useState<Set<number>>(new Set());

  // WebSocket connection state
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<HasilInputAktivitas | null>(null);
  const [viewingPhotoActivity, setViewingPhotoActivity] = useState<HasilInputAktivitas | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Extract unique supervisors
  const supervisors = Array.from(new Set(
    users.filter(u => u.hak_akses === 'Pengawas').map(u => u.nama_lengkap)
      .concat(units.map(u => u.nama_pengawas))
      .concat(['Budi Santoso', 'Agus Wijaya', 'Rudi Hermawan'])
  ));

  // --- Fetch Data Functions ---
  const fetchRencanaList = useCallback(async () => {
    try {
      const res = await fetch('/api/rencana-kerja');
      const json = await res.json();
      if (json.data) {
        setRencanaList(json.data);
      }
    } catch (e) {
      console.error('Failed fetching rencana-kerja:', e);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/rekapitulasi');
      const json = await res.json();
      if (json.data) {
        setActivities(json.data);
      }
    } catch (e) {
      console.error('Failed fetching activities:', e);
    }
  }, []);

  const fetchLokasiList = useCallback(async () => {
    try {
      const res = await fetch('/api/master/lokasi');
      const data = await res.json();
      setLokasiList(data);
    } catch (e) {
      console.error('Failed fetching master lokasi:', e);
    }
  }, []);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch('/api/units');
      const data = await res.json();
      setUnits(data);
    } catch (e) {
      console.error('Failed fetching units:', e);
    }
  }, []);

  const fetchAktivitasList = useCallback(async () => {
    try {
      const res = await fetch('/api/aktivitas');
      const data = await res.json();
      setAktivitasList(data);
    } catch (e) {
      console.error('Failed fetching master aktivitas:', e);
    }
  }, []);

  const fetchOperators = useCallback(async () => {
    try {
      const res = await fetch('/api/operators');
      const data = await res.json();
      setOperators(data);
    } catch (e) {
      console.error('Failed fetching operators:', e);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error('Failed fetching users:', e);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Failed fetching stats:', e);
    }
  }, []);

  const refreshAllData = useCallback(() => {
    fetchRencanaList();
    fetchActivities();
    fetchLokasiList();
    fetchUnits();
    fetchAktivitasList();
    fetchOperators();
    fetchUsers();
    fetchStats();
  }, [fetchRencanaList, fetchActivities, fetchLokasiList, fetchUnits, fetchAktivitasList, fetchOperators, fetchUsers, fetchStats]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // --- Handlers for Rencana Kerja & SPK ---
  const handleTerbitkanSpk = async (id: string, nomorSpk: string) => {
    const res = await fetch(`/api/rencana-kerja/${id}/terbitkan-spk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomor_spk: nomorSpk })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menerbitkan nomor SPK.');
    }
    const json = await res.json();
    setRencanaList(prev => prev.map(r => r.id === id ? json.data : r));
  };

  const handleCreateRencana = async (data: Partial<RencanaKerja>) => {
    const res = await fetch('/api/rencana-kerja', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal membuat rencana kerja.');
    }
    const json = await res.json();
    setRencanaList(prev => [json.data, ...prev]);
  };

  const handleDeleteRencana = async (id: string) => {
    const res = await fetch(`/api/rencana-kerja/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menghapus rencana kerja.');
    }
    setRencanaList(prev => prev.filter(r => r.id !== id));
  };

  // --- Handlers for Master Lokasi ---
  const handleSaveLokasi = async (lokasi: Lokasi) => {
    const res = await fetch('/api/master/lokasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lokasi)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menyimpan master lokasi.');
    }
    const saved = await res.json();
    setLokasiList(prev => {
      const exists = prev.some(l => l.kode_lokasi === saved.kode_lokasi);
      if (exists) {
        return prev.map(l => l.kode_lokasi === saved.kode_lokasi ? saved : l);
      }
      return [...prev, saved].sort((a, b) => a.kode_lokasi.localeCompare(b.kode_lokasi));
    });
  };

  const handleDeleteLokasi = async (kodeLokasi: string) => {
    const res = await fetch(`/api/master/lokasi/${encodeURIComponent(kodeLokasi)}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menghapus master lokasi.');
    }
    setLokasiList(prev => prev.filter(l => l.kode_lokasi !== kodeLokasi));
  };

  const handleBulkImportLokasi = async (items: Lokasi[]): Promise<number> => {
    const res = await fetch('/api/master/lokasi/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: items })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal import lokasi.');
    }
    const json = await res.json();
    if (json.data) {
      setLokasiList(json.data);
    }
    return json.importedCount || items.length;
  };

  // --- Real-Time WebSocket Listener Setup ---
  useEffect(() => {
    let isMounted = true;

    function connectWs() {
      if (!isMounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      setWsStatus('connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setWsStatus('connected');
        console.log('📡 Connected to HeavyTrack WebSocket server');
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const packet = JSON.parse(event.data);

          // 1. Realisasi Baru Masuk
          if ((packet.event === 'NEW_ACTIVITY' || packet.event === 'NEW_REALIZATION') && packet.data) {
            const newRow: HasilInputAktivitas = packet.data;

            // Prepend directly to top of activities
            setActivities(prev => {
              if (prev.some(item => String(item.id) === String(newRow.id))) return prev;
              return [newRow, ...prev];
            });

            // Play acoustic chime
            soundService.playNewActivityChime();

            // Trigger 4-second emerald highlight (#A7F3D0)
            const numId = typeof newRow.id === 'number' ? newRow.id : parseInt(String(newRow.id), 10);
            if (!isNaN(numId)) {
              setNewActivityIds(prev => new Set(prev).add(numId));
              setTimeout(() => {
                if (isMounted) {
                  setNewActivityIds(prev => {
                    const next = new Set(prev);
                    next.delete(numId);
                    return next;
                  });
                }
              }, 4000);
            }

            // Update KPI Stats and Units HM in background
            fetchStats();
            fetchUnits();
            fetchRencanaList();
          } else if (packet.event === 'UPDATE_ACTIVITY' && packet.data) {
            const updatedRow: HasilInputAktivitas = packet.data;
            setActivities(prev => prev.map(item => String(item.id) === String(updatedRow.id) ? updatedRow : item));
            fetchStats();
          } else if (packet.event === 'DELETE_ACTIVITY' && packet.id) {
            setActivities(prev => prev.filter(item => String(item.id) !== String(packet.id)));
            fetchStats();
          } else if (packet.event === 'NEW_RENCANA' && packet.data) {
            const newPlan: RencanaKerja = packet.data;
            setRencanaList(prev => {
              if (prev.some(r => r.id === newPlan.id)) return prev;
              return [newPlan, ...prev];
            });
            soundService.playNewActivityChime();
          } else if (
            (packet.event === 'SPK_PUBLISHED' || packet.event === 'SPK_TERBIT' || packet.event === 'UPDATE_RENCANA')
          ) {
            const planId = packet.id || (packet.payload && packet.payload.id) || (packet.data && packet.data.id);
            const targetSpk = packet.nomor_spk || (packet.payload && packet.payload.nomor_spk) || (packet.data && packet.data.nomor_spk);
            const targetStatus = packet.status_spk || (packet.payload && packet.payload.status_spk) || (packet.data && packet.data.status_spk) || 'SPK_TERBIT';
            const updatedPlan: RencanaKerja | undefined = packet.data;

            if (planId) {
              setRencanaList(prev => prev.map(r => {
                if (r.id === planId) {
                  return {
                    ...r,
                    ...(updatedPlan || {}),
                    nomor_spk: targetSpk || r.nomor_spk,
                    status_spk: targetStatus || r.status_spk
                  };
                }
                return r;
              }));
            }
          } else if (packet.event === 'DELETE_RENCANA' && packet.id) {
            setRencanaList(prev => prev.filter(r => r.id !== packet.id));
          }
        } catch (err) {
          console.warn('Error parsing incoming WS message:', err);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsStatus('disconnected');
        console.log('🔌 WebSocket disconnected. Retrying in 3s...');
        reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket encountered error:', err);
        ws.close();
      };
    }

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchStats, fetchUnits, fetchRencanaList]);

  // --- Quick Android Simulation Trigger ---
  const handleSimulateAndroidReport = async () => {
    setIsSimulating(true);
    try {
      const supervisorPool = ['Budi Santoso', 'Agus Wijaya', 'Rudi Hermawan'];
      const chosenPengawas = supervisorPool[Math.floor(Math.random() * supervisorPool.length)];
      
      const availableUnits = units.length > 0 ? units : [
        { kode_unit: 'DT-101', model_unit: 'Hino FM 260 Ti', hm_unit_terakhir_diinputkan: 4280.5 } as Unit
      ];
      const randomUnit = availableUnits[Math.floor(Math.random() * availableUnits.length)];
      
      const availableActs = aktivitasList.length > 0 ? aktivitasList : [
        { nama_aktivitas: 'Loading Overburden (OB)', kode_sap: 'ACT-SAP-102', satuan: 'BCM' } as AktivitasUnit
      ];
      const randomAct = availableActs[Math.floor(Math.random() * availableActs.length)];

      const availableOps = operators.length > 0 ? operators : [
        { nama_operator: 'Hendri Kurniawan', nik: 'NIK-94822', nama_pengawas: 'Budi Santoso' } as Operator
      ];
      const randomOp = availableOps[Math.floor(Math.random() * availableOps.length)];

      const randomLokasi = lokasiList.length > 0 
        ? lokasiList[Math.floor(Math.random() * lokasiList.length)]
        : { kode_lokasi: '001A', wilayah: 'PG1' };

      const startHm = randomUnit.hm_unit_terakhir_diinputkan || 4280.0;
      const durationHours = Math.round((7 + Math.random() * 4) * 10) / 10;
      const endHm = Math.round((startHm + durationHours) * 10) / 10;
      const shifts: ('Siang' | 'Malam')[] = ['Siang', 'Malam'];
      const chosenShift = shifts[Math.floor(Math.random() * shifts.length)];

      const statuses: ('OPERASI' | 'STANDBY' | 'BREAKDOWN')[] = ['OPERASI', 'OPERASI', 'OPERASI', 'STANDBY', 'BREAKDOWN'];
      const chosenStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const isIsi = chosenStatus === 'OPERASI' && Math.random() > 0.35;
      const solarLiter = isIsi ? Math.round((90 + Math.random() * 110) * 10) / 10 : 0;
      const generatedSpk = `SPK-${new Date().getFullYear()}-X${Math.floor(100 + Math.random() * 900)}`;

      // Generate authentic photo proof data URI for simulation
      const svgProof = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
        <defs>
          <linearGradient id="sky-${randomUnit.kode_unit}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#bae6fd"/>
          </linearGradient>
          <linearGradient id="pit-${randomUnit.kode_unit}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#78350f"/>
            <stop offset="50%" stop-color="#b45309"/>
            <stop offset="100%" stop-color="#d97706"/>
          </linearGradient>
        </defs>
        <rect width="800" height="260" fill="url(#sky-${randomUnit.kode_unit})"/>
        <circle cx="680" cy="85" r="40" fill="#fef08a" opacity="0.9"/>
        <path d="M0,230 Q200,210 400,235 T800,220 L800,600 L0,600 Z" fill="url(#pit-${randomUnit.kode_unit})"/>
        <path d="M0,320 Q280,300 560,330 T800,310 L800,600 L0,600 Z" fill="#451a03" opacity="0.7"/>
        <path d="M0,450 Q300,430 800,470 L800,530 Q300,490 0,510 Z" fill="#78716c"/>
        <g transform="translate(260, 290)">
          <rect x="20" y="140" width="220" height="40" rx="12" fill="#1c1917"/>
          <rect x="40" y="60" width="160" height="85" rx="6" fill="#eab308"/>
          <rect x="130" y="30" width="65" height="55" rx="4" fill="#0284c7"/>
          <rect x="65" y="85" width="80" height="24" rx="4" fill="#0f172a"/>
          <text x="105" y="102" fill="#22c55e" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">${randomUnit.kode_unit}</text>
        </g>
        <rect x="20" y="20" width="760" height="560" fill="none" stroke="#22c55e" stroke-width="2" stroke-dasharray="16,8" opacity="0.6"/>
        <rect x="20" y="20" width="760" height="40" fill="rgba(15,23,42,0.85)"/>
        <text x="40" y="46" fill="#4ade80" font-family="monospace" font-size="13" font-weight="bold">HEAVYTRACK MOBILE CAM • ANDROID REALISASI SPK</text>
        <rect x="20" y="500" width="760" height="80" fill="rgba(15,23,42,0.9)"/>
        <text x="40" y="530" fill="#f8fafc" font-family="sans-serif" font-size="15" font-weight="bold">UNIT: ${randomUnit.kode_unit} | ${randomAct.nama_aktivitas}</text>
        <text x="40" y="555" fill="#94a3b8" font-family="sans-serif" font-size="12">SPK: ${generatedSpk} • LOKASI: ${randomLokasi.kode_lokasi} (${randomLokasi.wilayah}) • PENGAWAS: ${chosenPengawas}</text>
        <text x="40" y="572" fill="#38bdf8" font-family="monospace" font-size="11">${new Date().toISOString().slice(0, 10)} • FOTO OTENTIK</text>
      </svg>`;
      const simulatedPhoto = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgProof);

      const payload = {
        nama_pengawas: chosenPengawas,
        tanggal: new Date().toISOString().slice(0, 10),
        kode_unit: randomUnit.kode_unit,
        nama_aktivitas: randomAct.nama_aktivitas,
        kode_sap: randomAct.kode_sap,
        satuan: randomAct.satuan,
        operator: randomOp.nama_operator,
        nik_operator: randomOp.nik,
        kode_lokasi: randomLokasi.kode_lokasi,
        lokasi: `Pit Area ${randomLokasi.kode_lokasi}`,
        nomor_spk: generatedSpk,
        shift_kerja: chosenShift,
        jam_kerja: 10.0,
        hm_awal: startHm,
        hm_akhir: endHm,
        hm_harian_berjalan: durationHours,
        hasil_kerja: Math.floor(500 + Math.random() * 2000),
        keterangan: `Realisasi SPK ${generatedSpk} selesai dikerjakan (${randomUnit.model_unit})`,
        foto_bukti: simulatedPhoto,
        status_unit: chosenStatus,
        is_isi_solar: isIsi ? 1 : 0,
        jumlah_liter_solar: solarLiter
      };

      const res = await fetch('/api/aktivitas-unit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Gagal mengirim simulasi laporan');
    } catch (e) {
      console.error('Error simulating report:', e);
      alert('Simulasi gagal: ' + (e as Error).message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleDeleteActivity = async (id: number | string) => {
    try {
      const res = await fetch(`/api/rekapitulasi/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus laporan');
      setActivities(prev => prev.filter(a => String(a.id) !== String(id)));
      fetchActivities();
      fetchStats();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* 1. Header Portal & Admin Context */}
      <Header
        wsStatus={wsStatus}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onOpenAndroidSim={() => setIsAndroidModalOpen(true)}
        onQuickSimulate={handleSimulateAndroidReport}
        isSimulating={isSimulating}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Navigation Tabs Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-1.5 mb-6 shadow-2xs flex flex-wrap items-center gap-1">
          
          {/* TAB 1: Rencana Kerja & Penerbitan SPK (Modul Baru) */}
          <button
            onClick={() => setActiveTab('rencana')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rencana'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Rencana Kerja & SPK</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'rencana' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {rencanaList.length}
            </span>
          </button>

          {/* TAB 2: Rekapitulasi Aktivitas (Realisasi Kerja Real-Time) */}
          <button
            onClick={() => setActiveTab('rekapitulasi')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rekapitulasi'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Rekapitulasi Real-Time</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'rekapitulasi' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {activities.length}
            </span>
          </button>

          {/* TAB 3: Data Master Lokasi (Modul Baru Import Excel) */}
          <button
            onClick={() => setActiveTab('lokasi')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'lokasi'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Data Master Lokasi</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'lokasi' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {lokasiList.length}
            </span>
          </button>

          {/* TAB 4: Rangkuman & Analitik Operasional Fleet */}
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Rangkuman & Analitik</span>
          </button>

          {/* TAB MASTER: Data Master Unit */}
          <button
            onClick={() => setActiveTab('units')}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'units'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Master Unit</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'units' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {units.length}
            </span>
          </button>

          {/* TAB MASTER: Data Master Aktivitas */}
          <button
            onClick={() => setActiveTab('aktivitas')}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'aktivitas'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            <span>Master Aktivitas</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'aktivitas' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {aktivitasList.length}
            </span>
          </button>

          {/* TAB MASTER: Data Master Operator */}
          <button
            onClick={() => setActiveTab('operators')}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'operators'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Master Operator</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'operators' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {operators.length}
            </span>
          </button>

          {/* TAB MASTER: Data Master User */}
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Master User</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'users' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {users.length}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={refreshAllData}
            title="Muat ulang seluruh data dari SQLite database"
            className="ml-auto p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

        </div>

        {/* TAB 1: Rencana Kerja & Penerbitan SPK (Modul Baru) */}
        {activeTab === 'rencana' && (
          <RencanaKerjaView
            rencanaList={rencanaList}
            units={units}
            operators={operators}
            lokasiList={lokasiList}
            supervisors={supervisors}
            onRefresh={fetchRencanaList}
            onTerbitkanSpk={handleTerbitkanSpk}
            onCreateRencana={handleCreateRencana}
            onDeleteRencana={handleDeleteRencana}
          />
        )}

        {/* TAB 2: Rekapitulasi Real-Time */}
        {activeTab === 'rekapitulasi' && (
          <div>
            {/* Top KPI Stat Cards */}
            <KpiCards stats={stats} totalMasterUnits={units.length} />

            {/* Real-time interactive table */}
            <ActivityMonitor
              activities={activities}
              units={units}
              aktivitasList={aktivitasList}
              operators={operators}
              supervisors={supervisors}
              newActivityIds={newActivityIds}
              onOpenManualModal={() => setIsManualModalOpen(true)}
              onEditActivity={(item) => setEditingActivity(item)}
              onDeleteActivity={handleDeleteActivity}
              onRefresh={fetchActivities}
              onViewPhoto={(item) => setViewingPhotoActivity(item)}
            />
          </div>
        )}

        {/* TAB 3: Data Master Lokasi & Import Excel (Modul Baru) */}
        {activeTab === 'lokasi' && (
          <MasterLokasi
            lokasiList={lokasiList}
            onRefresh={fetchLokasiList}
            onSaveLokasi={handleSaveLokasi}
            onDeleteLokasi={handleDeleteLokasi}
            onBulkImport={handleBulkImportLokasi}
          />
        )}

        {/* TAB 4: Rangkuman & Analitik Operasional Fleet */}
        {activeTab === 'analytics' && (
          <AnalyticsView
            units={units}
            supervisors={supervisors}
          />
        )}

        {/* Tab 5: Data Master Unit */}
        {activeTab === 'units' && (
          <MasterUnits
            units={units}
            supervisors={supervisors}
            onRefresh={() => {
              fetchUnits();
              fetchStats();
            }}
          />
        )}

        {/* Tab 6: Data Master Aktivitas */}
        {activeTab === 'aktivitas' && (
          <MasterAktivitas
            aktivitasList={aktivitasList}
            onRefresh={fetchAktivitasList}
          />
        )}

        {/* Tab 7: Data Master Operator */}
        {activeTab === 'operators' && (
          <MasterOperators
            operators={operators}
            supervisors={supervisors}
            onRefresh={fetchOperators}
          />
        )}

        {/* Tab 8: Data Master User */}
        {activeTab === 'users' && (
          <MasterUsers
            users={users}
            onRefresh={fetchUsers}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">HeavyTrack Enterprise Portal</span>
            <span>—</span>
            <span>Penyedia Database Master & Monitoring Fleet Lapangan</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Terhubung ke SQLite Backend Engine • Port 3000 • WebSocket Sync Live
          </div>
        </div>
      </footer>

      {/* MODAL WINDOWS */}
      
      {/* 1. Modal Manual Input Activity */}
      <ManualActivityModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        units={units}
        aktivitasList={aktivitasList}
        operators={operators}
        supervisors={supervisors}
        onSubmitSuccess={() => {
          fetchActivities();
          fetchStats();
          fetchUnits();
        }}
      />

      {/* 2. Modal Edit Activity */}
      <EditActivityModal
        activity={editingActivity}
        onClose={() => setEditingActivity(null)}
        onSuccess={() => {
          fetchActivities();
          fetchStats();
        }}
        units={units}
        aktivitasList={aktivitasList}
        operators={operators}
        supervisors={supervisors}
      />

      {/* 3. Modal Database Backup */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />

      {/* 4. Modal Android Mobile Integration */}
      <AndroidIntegrationModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
        onSendSimulation={handleSimulateAndroidReport}
        isSimulating={isSimulating}
      />

      {/* 5. Modal Lightbox Foto Bukti Lapangan */}
      <PhotoLightboxModal
        activity={viewingPhotoActivity}
        onClose={() => setViewingPhotoActivity(null)}
      />

    </div>
  );
}
