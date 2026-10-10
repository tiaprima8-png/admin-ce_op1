import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  RefreshCw,
  HardHat,
  RotateCcw
} from 'lucide-react';
import { 
  HasilInputAktivitas, 
  Unit, 
  AktivitasUnit, 
  Operator, 
  User, 
  KpiStats, 
  RencanaKerja, 
  Lokasi,
  MasterKendala as MasterKendalaType,
  HmStandarConfig
} from './types';
import { soundService } from './utils/sound';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { KpiCards } from './components/KpiCards';
import { RencanaKerjaView } from './components/RencanaKerjaView';
import { ActivityMonitor } from './components/ActivityMonitor';
import { MasterLokasi } from './components/MasterLokasi';
import { AnalyticsView } from './components/AnalyticsView';
import { MasterUnits } from './components/MasterUnits';
import { MasterAktivitas } from './components/MasterAktivitas';
import { MasterKendala } from './components/MasterKendala';
import { MasterOperators } from './components/MasterOperators';
import { MasterUsers } from './components/MasterUsers';
import { ManualActivityModal } from './components/ManualActivityModal';
import { EditActivityModal } from './components/EditActivityModal';
import { PhotoLightboxModal } from './components/PhotoLightboxModal';
import { SettingsModal } from './components/SettingsModal';

interface AuthUser {
  id: number;
  nama_lengkap: string;
  username: string;
  hak_akses: string;
  email?: string;
  token?: string;
}

const getStoredSession = (): AuthUser | null => {
  try {
    const raw = sessionStorage.getItem('rkce_auth');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Gagal membaca auth session:', e);
  }
  return null;
};

export default function App() {
  // Authentication State & Guard
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredSession);

  // Active Menu / Tab State (Default: BERANDA -> 'rekapitulasi')
  const [activeTab, setActiveTab] = useState<ActiveTab>('rekapitulasi');

  // Sidebar Layout States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Main Data States
  const [rencanaList, setRencanaList] = useState<RencanaKerja[]>([]);
  const [activities, setActivities] = useState<HasilInputAktivitas[]>([]);
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [aktivitasList, setAktivitasList] = useState<AktivitasUnit[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [kendalaList, setKendalaList] = useState<MasterKendalaType[]>([]);
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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [hmStandar, setHmStandar] = useState<HmStandarConfig>({ min: 6.0, max: 10.0 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extract unique supervisors
  const supervisors = Array.from(new Set(
    users.filter(u => u.hak_akses === 'Pengawas').map(u => u.nama_lengkap)
      .concat(units.map(u => u.nama_pengawas))
      .concat(['Budi Santoso', 'Agus Wijaya', 'Rudi Hermawan'])
  ));

  // --- Auth Handlers ---
  const handleLoginSuccess = (user: AuthUser) => {
    sessionStorage.setItem('rkce_auth', JSON.stringify(user));
    setCurrentUser(user);
    setActiveTab('rekapitulasi');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('rkce_auth');
    setCurrentUser(null);
  };

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

  const fetchKendalaList = useCallback(async () => {
    try {
      const res = await fetch('/api/master-kendala');
      const data = await res.json();
      if (Array.isArray(data)) {
        setKendalaList(data);
      }
    } catch (e) {
      console.error('Failed fetching master kendala:', e);
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

  const fetchHmStandar = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/hm-standar');
      const data = await res.json();
      if (data.hm_min_standar !== undefined && data.hm_max_standar !== undefined) {
        setHmStandar({
          min: parseFloat(data.hm_min_standar) || 6.0,
          max: parseFloat(data.hm_max_standar) || 10.0
        });
      }
    } catch (e) {
      console.error('Failed fetching HM standard settings:', e);
    }
  }, []);

  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchRencanaList(),
      fetchActivities(),
      fetchLokasiList(),
      fetchUnits(),
      fetchAktivitasList(),
      fetchKendalaList(),
      fetchOperators(),
      fetchUsers(),
      fetchStats(),
      fetchHmStandar()
    ]);
    setTimeout(() => setIsRefreshing(false), 400);
  }, [fetchRencanaList, fetchActivities, fetchLokasiList, fetchUnits, fetchAktivitasList, fetchKendalaList, fetchOperators, fetchUsers, fetchStats, fetchHmStandar]);

  useEffect(() => {
    if (currentUser) {
      refreshAllData();
    }
  }, [currentUser, refreshAllData]);

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
      throw new Error(err.error || 'Gagal menghapus lokasi.');
    }
    setLokasiList(prev => prev.filter(l => l.kode_lokasi !== kodeLokasi));
  };

  const handleBulkImportLokasi = async (lokasiItems: Lokasi[]) => {
    const res = await fetch('/api/master/lokasi/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lokasiItems)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal mengimpor file Excel master lokasi.');
    }
    const json = await res.json();
    if (json.data) {
      setLokasiList(json.data);
    }
    return json;
  };

  // --- WebSocket Real-Time Listener Setup ---
  useEffect(() => {
    let isMounted = true;

    function connectWs() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      console.log(`🔌 Menghubungkan WebSocket ke ${wsUrl}...`);
      setWsStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setWsStatus('connected');
        console.log('✅ Terhubung ke WebSocket RKCE.');
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          console.log('📩 WebSocket packet diterima:', packet.event);

          if (packet.event === 'NEW_ACTIVITY' || packet.event === 'NEW_REALIZATION') {
            const newAct: HasilInputAktivitas = packet.data;
            if (newAct) {
              setActivities(prev => [newAct, ...prev.filter(a => a.id !== newAct.id)]);
              const idNum = typeof newAct.id === 'number' ? newAct.id : parseInt(String(newAct.id), 10);
              if (!isNaN(idNum)) {
                setNewActivityIds(prev => new Set(prev).add(idNum));
                setTimeout(() => {
                  setNewActivityIds(prev => {
                    const next = new Set(prev);
                    next.delete(idNum);
                    return next;
                  });
                }, 4000);
              }
              soundService.playSuccess();
              fetchStats();
              fetchUnits();
              fetchRencanaList();
            }
          } else if (packet.event === 'UPDATE_ACTIVITY') {
            const updated: HasilInputAktivitas = packet.data;
            if (updated) {
              setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
              fetchStats();
            }
          } else if (packet.event === 'DELETE_ACTIVITY') {
            const deletedId = packet.id;
            if (deletedId) {
              setActivities(prev => prev.filter(a => String(a.id) !== String(deletedId)));
              fetchStats();
            }
          } else if (packet.event === 'NEW_RENCANA' && packet.data) {
            setRencanaList(prev => [packet.data, ...prev.filter(r => r.id !== packet.data.id)]);
            soundService.playSuccess();
          } else if (packet.event === 'SPK_PUBLISHED' || packet.event === 'SPK_TERBIT' || packet.event === 'UPDATE_RENCANA') {
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
          } else if (packet.event === 'HM_STANDAR_UPDATED' || packet.type === 'HM_STANDAR_UPDATED') {
            const incomingStd = packet.hm_standar || {
              min: packet.hm_min_standar !== undefined ? packet.hm_min_standar : 6.0,
              max: packet.hm_max_standar !== undefined ? packet.hm_max_standar : 10.0
            };
            if (incomingStd && incomingStd.min !== undefined && incomingStd.max !== undefined) {
              setHmStandar({
                min: parseFloat(incomingStd.min) || 6.0,
                max: parseFloat(incomingStd.max) || 10.0
              });
              soundService.playSuccess();
              console.log('⚡ Standar HM diperbarui via real-time WebSocket:', incomingStd);
            }
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
        console.warn('WebSocket error:', err);
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

  // If user is not authenticated, render Login Page (Auth Guard)
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Count pending SPK
  const pendingSpkCount = rencanaList.filter(r => r.status_spk === 'MENUNGGU_SPK').length;

  const sidebarCounts = {
    rekapitulasi: activities.length,
    rencana: rencanaList.length,
    pendingSpk: pendingSpkCount,
    lokasi: lokasiList.length,
    units: units.length,
    aktivitas: aktivitasList.length,
    kendala: kendalaList.length,
    operators: operators.length,
    users: users.length
  };

  // Helper title based on active tab
  const getTabHeader = () => {
    switch (activeTab) {
      case 'rekapitulasi':
        return {
          title: 'Beranda & Rekapitulasi Real-Time',
          subtitle: 'Monitoring aktivitas unit dan penerimaan laporan langsung dari aplikasi RKCE Mobile'
        };
      case 'rencana':
        return {
          title: 'Rencana Kerja & Penerbitan SPK',
          subtitle: 'Daftar penugasan pengawas harian dan penerbitan nomor Surat Perintah Kerja (SPK)'
        };
      case 'lokasi':
        return {
          title: 'Data Master Lokasi',
          subtitle: 'Katalog pit/wilayah operasional dan fasilitas import massal file Excel (.xlsx)'
        };
      case 'units':
        return {
          title: 'Data Master Unit Alat Berat',
          subtitle: 'Pengelolaan armada fleet, model unit, dan pencatatan HM unit terkini'
        };
      case 'aktivitas':
        return {
          title: 'Data Master Aktivitas',
          subtitle: 'Katalog jenis pekerjaan civil engineering, satuan ukur, dan kode SAP operasional'
        };
      case 'kendala':
        return {
          title: 'Data Master Kendala Operasional',
          subtitle: 'Katalog 15 kendala standar operasional civil engineering untuk sinkronisasi ke aplikasi mobile pengawas'
        };
      case 'operators':
        return {
          title: 'Data Master Operator',
          subtitle: 'Database operator alat berat lapangan dan pemetaan pengawas penanggung jawab'
        };
      case 'users':
        return {
          title: 'Data Master Pengguna',
          subtitle: 'Manajemen akun login portal admin dan akun pengawas aplikasi mobile'
        };
      case 'analytics':
        return {
          title: 'Rangkuman & Analitik Operasional',
          subtitle: 'Visualisasi jam kerja efektif, rasio konsumsi solar per HM, dan status kesiapan unit'
        };
      default:
        return { title: 'Dashboard', subtitle: 'Civil Engineering Fleet Portal' };
    }
  };

  const currentTabHeader = getTabHeader();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans antialiased">
      
      {/* 1. FIXED VERTICAL SIDEBAR */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        counts={sidebarCounts}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        hmStandar={hmStandar}
      />

      {/* 2. MAIN CONTENT AREA (Flexibly offset by sidebar width) */}
      <div 
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[270px]'
        }`}
      >
        
        {/* Topbar Header */}
        <Header
          wsStatus={wsStatus}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          hmStandar={hmStandar}
        />

        {/* Content Body */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 w-full max-w-full">
          
          {/* Top Page Title & Global Refresh Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {currentTabHeader.title}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentTabHeader.subtitle}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshAllData}
                disabled={isRefreshing}
                title="Muat ulang seluruh data langsung dari database"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Memuat...' : 'Muat Ulang'}</span>
              </button>
            </div>
          </div>

          {/* TAB 1: BERANDA -> Rekapitulasi Real-Time */}
          {activeTab === 'rekapitulasi' && (
            <div className="space-y-6">
              {/* Top KPI Stat Cards */}
              <KpiCards stats={stats} totalMasterUnits={units.length} />

              {/* Optimized 9-Column Table (Fit to Screen, No Horizontal Scroll) */}
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

          {/* TAB 2: Rencana Kerja & SPK */}
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

          {/* TAB 3: Master Lokasi & Import Excel */}
          {activeTab === 'lokasi' && (
            <MasterLokasi
              lokasiList={lokasiList}
              onRefresh={fetchLokasiList}
              onSaveLokasi={handleSaveLokasi}
              onDeleteLokasi={handleDeleteLokasi}
              onBulkImport={handleBulkImportLokasi}
            />
          )}

          {/* TAB 4: Master Unit */}
          {activeTab === 'units' && (
            <MasterUnits
              units={units}
              supervisors={supervisors}
              globalHmStandar={hmStandar}
              onRefresh={() => {
                fetchUnits();
                fetchStats();
              }}
            />
          )}

          {/* TAB 5: Master Aktivitas */}
          {activeTab === 'aktivitas' && (
            <MasterAktivitas
              aktivitasList={aktivitasList}
              onRefresh={fetchAktivitasList}
            />
          )}

          {/* TAB 5B: Master Kendala */}
          {activeTab === 'kendala' && (
            <MasterKendala
              kendalaList={kendalaList}
              onRefresh={fetchKendalaList}
            />
          )}

          {/* TAB 6: Master Operator */}
          {activeTab === 'operators' && (
            <MasterOperators
              operators={operators}
              supervisors={supervisors}
              onRefresh={fetchOperators}
            />
          )}

          {/* TAB 7: Master User */}
          {activeTab === 'users' && (
            <MasterUsers
              users={users}
              onRefresh={fetchUsers}
            />
          )}

          {/* TAB 8: Rangkuman & Analitik Operasional Fleet */}
          {activeTab === 'analytics' && (
            <AnalyticsView
              units={units}
              supervisors={supervisors}
            />
          )}

        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-3.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">RKCE</span>
              <span className="text-slate-300">•</span>
              <span>Portal Dashboard Administrator Fleet Civil Engineering</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Database SQLite Aktif • Port 3000 • WebSocket Live Connected
            </div>
          </div>
        </footer>

      </div>

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

      {/* 3. Modal Lightbox Foto Bukti Lapangan */}
      <PhotoLightboxModal
        activity={viewingPhotoActivity}
        onClose={() => setViewingPhotoActivity(null)}
      />

      {/* 4. Modal Pengaturan Sistem (Standar Minimal & Maksimal HM) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentHmStandar={hmStandar}
        onSaved={(newStandar) => {
          setHmStandar(newStandar);
          fetchUnits();
        }}
      />

    </div>
  );
}
