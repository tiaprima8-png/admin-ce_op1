import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  RotateCcw, 
  Edit2, 
  Trash2, 
  AlertCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  CameraOff,
  Camera,
  Eye,
  CheckCircle,
  Fuel,
  Clock,
  Sparkles,
  Pencil,
  Calendar
} from 'lucide-react';
import { HasilInputAktivitas, Unit, AktivitasUnit, Operator, User, DAFTAR_WILAYAH, DAFTAR_JENIS_UNIT_AKTIF, getWilayahBadgeClass } from '../types';
import { exportToExcel } from '../utils/export';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { KpiCards } from './KpiCards';
import { socket } from '../utils/socket';
import { soundService } from '../utils/sound';

const getWibToday = (): string => {
  const now = new Date();
  const wibMs = now.getTime() + (7 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000);
  return new Date(wibMs).toISOString().slice(0, 10);
};

const getWibDaysAgo = (daysAgo: number): string => {
  const now = new Date();
  const wibMs = now.getTime() + (7 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000) - (daysAgo * 24 * 60 * 60 * 1000);
  return new Date(wibMs).toISOString().slice(0, 10);
};

function formatKendalaDuration(menit: number): string {
  if (!menit || menit <= 0) return '0 m';
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam > 0 && sisa > 0) return `${jam} jam ${sisa} mnt`;
  if (jam > 0) return `${jam} jam`;
  return `${sisa} menit`;
}

export interface ParsedKendalaItem {
  nama_kendala: string;
  kendala?: string;
  nama?: string;
  kode_kendala?: string;
  kode?: string;
  jam_mulai?: string;
  jam_awal?: string;
  jam_selesai?: string;
  jam_akhir?: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  durasi_jam?: number | string;
  durasi?: number | string;
  hambatan?: number | string;
  durasi_menit?: number;
  keterangan?: string;
}

function parseKendalaList(kendala: unknown): ParsedKendalaItem[] {
  if (!kendala) return [];
  
  const normalize = (item: any): ParsedKendalaItem | null => {
    if (!item) return null;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      return trimmed ? {
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
      } : null;
    }
    if (typeof item === 'object') {
      const nama = item.nama_kendala || item.kendala || item.nama || item.keterangan || 'Kendala Operasional';
      const kode = item.kode_kendala || item.kode || item.id_kendala || '-';
      const start = item.jam_mulai || item.jam_awal || item.waktu_mulai || '-';
      const end = item.jam_selesai || item.jam_akhir || item.waktu_selesai || '-';
      const durasi = item.durasi_jam !== undefined ? item.durasi_jam : (item.durasi !== undefined ? item.durasi : (item.hambatan !== undefined ? item.hambatan : (item.durasi_menit ? Math.round((item.durasi_menit / 60) * 10) / 10 : 0)));
      const durasiMnt = item.durasi_menit !== undefined ? item.durasi_menit : (parseFloat(String(durasi)) ? parseFloat(String(durasi)) * 60 : undefined);

      return {
        nama_kendala: String(nama),
        kendala: String(nama),
        nama: String(nama),
        kode_kendala: String(kode),
        kode: String(kode),
        jam_mulai: String(start),
        jam_awal: String(start),
        jam_selesai: String(end),
        jam_akhir: String(end),
        waktu_mulai: String(start),
        waktu_selesai: String(end),
        durasi_jam: durasi,
        durasi: durasi,
        hambatan: durasi,
        durasi_menit: durasiMnt,
        keterangan: item.keterangan ? String(item.keterangan) : undefined
      };
    }
    return null;
  };

  if (Array.isArray(kendala)) {
    return kendala.map(normalize).filter((k): k is ParsedKendalaItem => k !== null);
  }

  if (typeof kendala === 'object' && kendala !== null) {
    const single = normalize(kendala);
    return single ? [single] : [];
  }

  if (typeof kendala === 'string') {
    const trimmed = kendala.trim();
    if (!trimmed || trimmed === '[]') return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(normalize).filter((k): k is ParsedKendalaItem => k !== null);
      }
      const single = normalize(parsed);
      return single ? [single] : [];
    } catch {
      return [{ nama_kendala: trimmed }];
    }
  }

  return [];
}

interface ActivityMonitorProps {
  activities: HasilInputAktivitas[];
  units: Unit[];
  aktivitasList: AktivitasUnit[];
  operators: Operator[];
  supervisors: string[];
  users?: User[];
  newActivityIds: Set<number | string>;
  onOpenManualModal: () => void;
  onEditActivity: (activity: HasilInputAktivitas) => void;
  onDeleteActivity: (target: HasilInputAktivitas | number | string) => Promise<void> | void;
  onRefresh: () => void;
  onViewPhoto: (activity: HasilInputAktivitas) => void;
  userRole?: string;
}

export const ActivityMonitor: React.FC<ActivityMonitorProps> = ({
  activities,
  units,
  aktivitasList,
  operators,
  supervisors,
  users,
  newActivityIds,
  onOpenManualModal,
  onEditActivity,
  onDeleteActivity,
  onRefresh,
  onViewPhoto,
  userRole
}) => {
  const isManager = userRole === 'MANAGER';

  // 1. Data list state initialized with props, immediately prependable by WebSocket
  const [dataList, setDataList] = useState<HasilInputAktivitas[]>(activities);

  // Local glowing row highlight tracker (2-3 detik)
  const [highlightIds, setHighlightIds] = useState<Set<number | string>>(new Set());

  // Synchronize with prop changes when parent updates (deduplicated by id)
  useEffect(() => {
    const seen = new Set<string | number>();
    const unique = activities.filter(item => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    setDataList(unique);
  }, [activities]);

  // WebSocket Listener: NEW_REALISASI_SUBMITTED & NEW_RENCANA_KERJA
  useEffect(() => {
    const handleNewRealisasi = (payload: any) => {
      console.log('⚡ [BERANDA/Rekapitulasi] Menerima event WebSocket NEW_REALISASI_SUBMITTED:', payload);
      const raw = payload?.aktivitas || payload?.data || payload;
      if (!raw) return;

      const id = raw.id || Date.now();
      const numHmAwal = parseFloat(raw.hm_awal) || 0;
      const numHmAkhir = parseFloat(raw.hm_akhir) || 0;
      const calculatedHm = raw.hm_harian_berjalan !== undefined 
        ? parseFloat(raw.hm_harian_berjalan) 
        : (raw.durasi_hm !== undefined ? parseFloat(raw.durasi_hm) : Math.round((numHmAkhir - numHmAwal) * 10) / 10);
      const numSolar = raw.jumlah_liter_solar !== undefined 
        ? parseFloat(raw.jumlah_liter_solar) 
        : (raw.solar !== undefined ? parseFloat(raw.solar) : 0);

      const targetPlanId = raw.rencana_id || raw.id_rencana_kerja || null;

      const newData: HasilInputAktivitas = {
        id,
        rencana_id: targetPlanId,
        id_rencana_kerja: targetPlanId,
        nama_pengawas: raw.nama_pengawas || raw.pengawas || 'Pengawas Lapangan',
        tanggal: raw.tanggal || getWibToday(),
        tanggal_kerja: raw.tanggal_kerja || raw.tanggal || getWibToday(),
        kode_unit: raw.kode_unit || raw.unit || 'UNIT',
        nama_aktivitas: raw.aktivitas_aktual || raw.nama_aktivitas || raw.aktivitas || '-',
        aktivitas: raw.aktivitas_aktual || raw.nama_aktivitas || raw.aktivitas || '-',
        aktivitas_aktual: raw.aktivitas_aktual || null,
        kode_sap: raw.kode_sap || 'ACT-SAP-101',
        satuan: raw.satuan || 'm3',
        operator: raw.operator || 'Operator Default',
        nik_operator: raw.nik_operator || 'NIK-00000',
        kode_lokasi: raw.kode_lokasi || raw.lokasi || '001A',
        lokasi: raw.lokasi || raw.kode_lokasi || 'Pit Operasional',
        nomor_spk: raw.nomor_spk || null,
        status_spk: raw.status_spk || 'TEREALISASI',
        status_realisasi: 'TEREALISASI',
        shift_kerja: (raw.shift_kerja || raw.shift || 'Siang').toLowerCase() === 'malam' ? 'Malam' : 'Siang',
        jam_kerja: parseFloat(raw.jam_kerja) || 0,
        hm_awal: numHmAwal,
        hm_akhir: numHmAkhir,
        hm_harian_berjalan: calculatedHm,
        hasil_kerja: parseFloat(raw.hasil_kerja) || 0,
        keterangan: raw.keterangan || '',
        foto_bukti: raw.foto_bukti || null,
        has_foto_bukti: Boolean(raw.foto_bukti || raw.has_foto_bukti),
        status_unit: (raw.status_unit || raw.kategori_status || 'OPERASI').toUpperCase(),
        kategori_status: (raw.kategori_status || raw.status_unit || 'OPERASI').toUpperCase(),
        is_isi_solar: raw.is_isi_solar ?? (numSolar > 0 ? 1 : 0),
        jumlah_liter_solar: numSolar,
        stik_awal: raw.stik_awal ?? null,
        stik_akhir: raw.stik_akhir ?? null,
        kendala: raw.kendala || raw.kendala_list || null,
        kendala_list: raw.kendala || raw.kendala_list || null,
        ada_kendala: raw.ada_kendala ?? ((raw.kendala && raw.kendala.length > 0) ? 1 : 0),
        is_hm_awal_corrected: raw.is_hm_awal_corrected ?? 0,
        alasan_koreksi_hm: raw.alasan_koreksi_hm ?? null,
        created_at: raw.created_at || new Date().toISOString(),
        model_unit: raw.model_unit,
        wilayah: raw.wilayah
      };

      // 1. Sisipkan data baru ke posisi paling atas daftar tabel secara instan (gantikan baris rencana kerja terkait jika sebelumnya berstatus menunggu)
      setDataList((prevList) => {
        const filtered = prevList.filter(item => 
          item.id !== id && 
          item.id !== targetPlanId && 
          !(targetPlanId && item.rencana_id === targetPlanId) &&
          !(item.status_realisasi === 'BELUM_INPUT' && item.kode_unit === newData.kode_unit && (item.tanggal === newData.tanggal || item.tanggal_kerja === newData.tanggal_kerja))
        );
        return [newData, ...filtered];
      });

      // Langsung arahkan ke halaman 1 agar baris baru segera terlihat
      setCurrentPage(1);

      // 2. Tambahkan efek animasi highlight warna hijau lembut pada baris baru selama 2-3 detik
      setHighlightIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setHighlightIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 3000);

      // Play soft chime audio
      soundService.playSuccess();
    };

    const handleNewRencana = (payload: any) => {
      console.log('⚡ [BERANDA] Menerima event WebSocket NEW_RENCANA_KERJA:', payload);
      const raw = payload?.data || payload;
      if (!raw) return;

      const id = raw.id || `RK-${Date.now()}`;
      const planDate = raw.tanggal || getWibToday();

      const newRencanaItem: HasilInputAktivitas = {
        id,
        rencana_id: raw.id || raw.id_rencana_kerja || raw.rencana_id || null,
        id_rencana_kerja: raw.id || raw.id_rencana_kerja || null,
        nama_pengawas: raw.nama_pengawas || raw.pengawas || 'Pengawas Lapangan',
        tanggal: planDate,
        tanggal_kerja: raw.tanggal_kerja || planDate,
        kode_unit: raw.kode_unit || raw.unit || 'UNIT',
        nama_aktivitas: raw.aktivitas_aktual || raw.nama_aktivitas || raw.aktivitas || raw.keterangan_rencana || '-',
        aktivitas: raw.aktivitas_aktual || raw.nama_aktivitas || raw.aktivitas || raw.keterangan_rencana || '-',
        aktivitas_aktual: raw.aktivitas_aktual || null,
        kode_sap: raw.kode_sap || 'ACT-SAP-101',
        satuan: raw.satuan || 'm3',
        operator: raw.operator || 'Operator Default',
        nik_operator: raw.nik_operator || '-',
        kode_lokasi: raw.kode_lokasi || raw.lokasi || '001A',
        lokasi: raw.lokasi || raw.wilayah || raw.kode_lokasi || 'Pit Operasional',
        nomor_spk: raw.nomor_spk || null,
        status_spk: raw.status_spk || (raw.nomor_spk ? 'SPK_TERBIT' : 'MENUNGGU'),
        status_realisasi: 'BELUM_INPUT',
        shift_kerja: (raw.shift_kerja || raw.shift || 'Siang').toLowerCase() === 'malam' ? 'Malam' : 'Siang',
        jam_kerja: null,
        hm_awal: null,
        hm_akhir: null,
        hm_harian_berjalan: null,
        durasi_hm: null,
        hasil_kerja: null,
        keterangan: raw.keterangan_rencana || raw.keterangan || '',
        foto_bukti: null,
        has_foto_bukti: false,
        has_foto: false,
        has_foto_solar: false,
        status_unit: (raw.status_unit || raw.kategori_status || 'OPERASI').toUpperCase(),
        kategori_status: (raw.kategori_status || raw.status_unit || 'OPERASI').toUpperCase(),
        is_isi_solar: 0,
        jumlah_liter_solar: null,
        stik_awal: null,
        stik_akhir: null,
        kendala_list: null,
        is_hm_awal_corrected: 0,
        alasan_koreksi_hm: null,
        created_at: raw.created_at || new Date().toISOString(),
        model_unit: raw.model_unit,
        wilayah: raw.wilayah
      };

      // 1. Sisipkan rencana kerja baru ke baris paling atas tabel Beranda secara instan
      setDataList((prevList) => {
        const filtered = prevList.filter(item => 
          item.id !== id && 
          !(newRencanaItem.rencana_id && item.rencana_id === newRencanaItem.rencana_id)
        );
        return [newRencanaItem, ...filtered];
      });

      // Langsung arahkan ke halaman 1 agar baris baru segera terlihat
      setCurrentPage(1);

      // 2. Beri efek animasi highlight visual warna hijau lembut pada baris baru selama 2-3 detik
      setHighlightIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setHighlightIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 3000);

      // Play soft chime audio
      soundService.playSuccess();
    };

    const handleRencanaDeleted = (payload: any) => {
      const planId = payload?.id || payload?.id_rencana_kerja || payload;
      if (planId) {
        setDataList(prev => prev.filter(item => item.id !== planId && item.id_rencana_kerja !== planId && item.rencana_id !== planId));
      }
    };

    const handleAktivitasDeleted = (payload: any) => {
      const actId = payload?.id || payload;
      if (actId) {
        setDataList(prev => prev.filter(item => String(item.id) !== String(actId) && String(item.id_aktivitas) !== String(actId)));
      }
    };

    socket.on("NEW_REALISASI_SUBMITTED", handleNewRealisasi);
    socket.on("NEW_RENCANA_KERJA", handleNewRencana);
    socket.on("RENCANA_KERJA_DELETED", handleRencanaDeleted);
    socket.on("DELETE_RENCANA", handleRencanaDeleted);
    socket.on("AKTIVITAS_DELETED", handleAktivitasDeleted);
    socket.on("DELETE_ACTIVITY", handleAktivitasDeleted);

    return () => {
      socket.off("NEW_REALISASI_SUBMITTED", handleNewRealisasi);
      socket.off("NEW_RENCANA_KERJA", handleNewRencana);
      socket.off("RENCANA_KERJA_DELETED", handleRencanaDeleted);
      socket.off("DELETE_RENCANA", handleRencanaDeleted);
      socket.off("AKTIVITAS_DELETED", handleAktivitasDeleted);
      socket.off("DELETE_ACTIVITY", handleAktivitasDeleted);
    };
  }, []);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWilayah, setSelectedWilayah] = useState('Semua');
  const [selectedJenisUnit, setSelectedJenisUnit] = useState('Semua');
  const [selectedUnit, setSelectedUnit] = useState('Semua');
  const [selectedShift, setSelectedShift] = useState('Semua');
  const [selectedStatus, setSelectedStatus] = useState('Semua');

  // User & Unit Wilayah lookup
  const userWilayahMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set('agung', 'GEODESI PG1');
    map.set('zainudin', 'GEODESI PG2');
    map.set('jaidi', 'GEODESI PG3');
    map.set('hisar', 'RC PG1');
    map.set('yono', 'RC PG2');
    map.set('nyoman', 'RC PG3');
    map.set('saipul', 'LEBUNG PG12');
    map.set('galung', 'LEBUNG PG3');
    if (users) {
      for (const u of users) {
        if (u.nama_lengkap && u.wilayah) {
          map.set(u.nama_lengkap.toLowerCase().trim(), u.wilayah.trim().toUpperCase());
        }
        if (u.username && u.wilayah) {
          map.set(u.username.toLowerCase().trim(), u.wilayah.trim().toUpperCase());
        }
      }
    }
    return map;
  }, [users]);

  const unitSupervisorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of units) {
      if (u.kode_unit && u.nama_pengawas) {
        map.set(u.kode_unit.toLowerCase().trim(), u.nama_pengawas.toLowerCase().trim());
      }
    }
    return map;
  }, [units]);

  const unitWilayahMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of units) {
      if (u.kode_unit && u.wilayah) {
        map.set(u.kode_unit.toLowerCase().trim(), u.wilayah.trim().toUpperCase());
      }
    }
    return map;
  }, [units]);

  // Date Range State (Default: 7 Hari Terakhir WIB)
  const [startDate, setStartDate] = useState<string>(() => getWibDaysAgo(6));
  const [endDate, setEndDate] = useState<string>(() => getWibToday());
  const [activePreset, setActivePreset] = useState<'hariIni' | 'kemarin' | '7hari' | '30hari' | 'bulanIni' | 'semua' | 'custom'>('7hari');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<HasilInputAktivitas | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const applyPreset = (preset: 'hariIni' | 'kemarin' | '7hari' | '30hari' | 'bulanIni' | 'semua') => {
    const today = getWibToday();
    const yesterday = getWibDaysAgo(1);
    setActivePreset(preset);
    setCurrentPage(1);

    if (preset === 'hariIni') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'kemarin') {
      setStartDate(yesterday);
      setEndDate(yesterday);
    } else if (preset === '7hari') {
      setStartDate(getWibDaysAgo(6));
      setEndDate(today);
    } else if (preset === '30hari') {
      setStartDate(getWibDaysAgo(29));
      setEndDate(today);
    } else if (preset === 'bulanIni') {
      const firstOfMonth = today.slice(0, 8) + '01';
      setStartDate(firstOfMonth);
      setEndDate(today);
    } else if (preset === 'semua') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filter logic: Disaring dari dataList reaktif (deduplikasi ID)
  const filteredActivities = useMemo(() => {
    const seenIds = new Set<string | number>();
    return dataList.filter((item) => {
      if (!item.id || seenIds.has(item.id)) return false;
      seenIds.add(item.id);

      // Search term matching
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchTerm = 
          (item.nama_pengawas || '').toLowerCase().includes(term) ||
          (item.kode_unit || '').toLowerCase().includes(term) ||
          (item.kode_sap || '').toLowerCase().includes(term) ||
          (item.operator || '').toLowerCase().includes(term) ||
          (item.nama_aktivitas || '').toLowerCase().includes(term) ||
          (item.lokasi || '').toLowerCase().includes(term) ||
          (item.kode_lokasi || '').toLowerCase().includes(term) ||
          (item.nomor_spk || '').toLowerCase().includes(term);
        if (!matchTerm) return false;
      }

      // Filter Wilayah Operasional (Kasie & Unit)
      if (selectedWilayah !== 'Semua') {
        const itemWilayah = (item.wilayah || '').trim().toUpperCase();
        const kasieName = (item.nama_pengawas || '').toLowerCase().trim();
        const kasieWilayah = userWilayahMap.get(kasieName);
        const unitKasie = unitSupervisorMap.get((item.kode_unit || '').toLowerCase().trim());
        const unitWilayah = unitKasie ? userWilayahMap.get(unitKasie) : undefined;
        const directUnitWilayah = unitWilayahMap.get((item.kode_unit || '').toLowerCase().trim());
        const targetW = selectedWilayah.toUpperCase();

        const matchWilayah = 
          itemWilayah === targetW || 
          kasieWilayah === targetW || 
          unitWilayah === targetW ||
          directUnitWilayah === targetW ||
          (item.lokasi && item.lokasi.toUpperCase().includes(targetW)) ||
          (item.kode_lokasi && item.kode_lokasi.toUpperCase().includes(targetW));

        if (!matchWilayah) {
          return false;
        }
      }

      // Filter Jenis Unit (Hanya 5 jenis unit aktif)
      if (selectedJenisUnit !== 'Semua') {
        const itemJenis = (item.jenis_unit || '').trim().toLowerCase();
        const fJenis = selectedJenisUnit.trim().toLowerCase();
        const unitObj = units.find(u => u.kode_unit.toLowerCase() === (item.kode_unit || '').toLowerCase());
        const unitJenis = (unitObj?.jenis_unit || '').trim().toLowerCase();
        const matches = 
          itemJenis === fJenis || 
          unitJenis === fJenis ||
          (itemJenis && (fJenis.includes(itemJenis) || itemJenis.includes(fJenis))) ||
          (unitJenis && (fJenis.includes(unitJenis) || unitJenis.includes(fJenis)));
        if (!matches) return false;
      }

      if (selectedUnit !== 'Semua' && item.kode_unit !== selectedUnit) {
        return false;
      }

      if (selectedShift !== 'Semua') {
        const itemShift = (item.shift_kerja || '').trim().toUpperCase();
        if (itemShift !== selectedShift.toUpperCase()) {
          return false;
        }
      }

      if (selectedStatus !== 'Semua') {
        const itemStatus = (item.kategori_status || item.status_unit || 'OPERASI').trim().toUpperCase();
        if (itemStatus !== selectedStatus.toUpperCase()) {
          return false;
        }
      }

      // Pastikan baris baru real-time selalu lolos filter tanggal agar langsung terlihat di baris paling atas
      const isRealtimeNew = highlightIds.has(item.id) || newActivityIds.has(item.id) || highlightIds.has(Number(item.id)) || newActivityIds.has(Number(item.id));
      if (!isRealtimeNew) {
        // WIB Business Date Filtering (tanggal_kerja or fallback tanggal)
        const itemDate = item.tanggal_kerja || item.tanggal;
        if (startDate && itemDate < startDate) {
          return false;
        }
        if (endDate && itemDate > endDate) {
          return false;
        }
      }

      return true;
    });
  }, [dataList, searchTerm, selectedWilayah, selectedJenisUnit, selectedUnit, selectedShift, selectedStatus, highlightIds, newActivityIds, startDate, endDate, userWilayahMap, unitSupervisorMap, unitWilayahMap, units]);

  const totalPages = Math.ceil(filteredActivities.length / pageSize) || 1;
  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedWilayah('Semua');
    setSelectedJenisUnit('Semua');
    setSelectedUnit('Semua');
    setSelectedShift('Semua');
    setSelectedStatus('Semua');
    setStartDate(getWibDaysAgo(6));
    setEndDate(getWibToday());
    setActivePreset('7hari');
    setCurrentPage(1);
  };

  const isFilterActive = 
    searchTerm.trim() !== '' ||
    selectedWilayah !== 'Semua' ||
    selectedJenisUnit !== 'Semua' ||
    selectedUnit !== 'Semua' ||
    selectedShift !== 'Semua' ||
    selectedStatus !== 'Semua' ||
    activePreset !== '7hari';

  const handleExportExcel = () => {
    if (filteredActivities.length === 0) {
      setFeedbackNotice('Peringatan: Tidak ada data dalam tabel aktif untuk diekspor.');
      setTimeout(() => setFeedbackNotice(null), 3000);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    exportToExcel(filteredActivities, `rekapitulasi_rkce_${today}.xlsx`);
    setFeedbackNotice(`File Excel (.xlsx) berhasil diunduh (${filteredActivities.length} baris data)!`);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    const row = deleteTarget;
    // Cek apakah ini data realisasi murni atau rencana kerja yang menunggu realisasi
    const isRencanaPending = row.status_realisasi === 'BELUM_INPUT' || !row.id_aktivitas;
    const targetPlanId = row.id_rencana_kerja || row.rencana_id || row.id;
    const targetActId = row.id_aktivitas || row.id;
    const endpoint = isRencanaPending 
      ? `/api/rencana-kerja/${targetPlanId}`
      : `/api/aktivitas-unit/${targetActId}`;

    const targetUnit = row.unit || row.kode_unit;

    try {
      // Panggil onDeleteActivity jika disediakan oleh parent
      if (onDeleteActivity) {
        await onDeleteActivity(row);
      } else {
        const res = await fetch(endpoint, { method: 'DELETE' });
        if (!res.ok) {
          throw new Error('Gagal menghapus data dari server');
        }
      }

      // Hapus baris dari state tabel secara instan
      setDataList((prev) => prev.filter((item) => {
        if (item.id === row.id) return false;
        if (isRencanaPending && (item.id === targetPlanId || item.id_rencana_kerja === targetPlanId || item.rencana_id === targetPlanId)) return false;
        if (!isRencanaPending && row.id_aktivitas && item.id_aktivitas === row.id_aktivitas) return false;
        return true;
      }));

      // Broadcast socket agar list di menu Rencana Kerja & Android juga ikut terhapus
      if (isRencanaPending) {
        socket.emit("RENCANA_KERJA_DELETED", { id: targetPlanId });
      } else {
        socket.emit("AKTIVITAS_DELETED", { id: targetActId });
      }

      setDeleteTarget(null);
      setFeedbackNotice(`${isRencanaPending ? 'Rencana kerja' : 'Laporan realisasi'} unit ${targetUnit} berhasil dihapus dari database!`);
      setTimeout(() => setFeedbackNotice(null), 3500);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Toast Notice */}
      {feedbackNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackNotice}</span>
          </div>
          <button 
            onClick={() => setFeedbackNotice(null)} 
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Dynamic KPI Metric Cards (Adapts to Active Date/Shift/Status/Unit Filter) */}
      <KpiCards
        filteredActivities={filteredActivities}
        filterLabel={
          activePreset === 'hariIni'
            ? 'Data Operasional Hari Ini'
            : activePreset === 'kemarin'
            ? 'Data Operasional Kemarin'
            : startDate && endDate
            ? `Periode ${startDate} s/d ${endDate}`
            : 'Akumulasi seluruh filter aktif'
        }
      />

      {/* FILTER & ACTION TOOLBAR (RESPONSIF MOBILE & DESKTOP) */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
        {/* BARIS 1: PENCARIAN UTAMA, PERIODE CEPAT, & TOMBOL AKSI */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Kiri: Universal Search Bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari Kasie, Wilayah, Unit, Kode SAP, Lokasi, SPK..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 text-sm pl-9 pr-3 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white placeholder-slate-400 text-slate-800"
            />
          </div>

          {/* Kanan: Dropdown Periode Cepat, Export Excel, Tambah Data Manual */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0">
            {/* a. Dropdown Periode ringkas */}
            <div className="relative w-full sm:w-auto">
              <select
                value={activePreset}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    applyPreset(e.target.value as any);
                  }
                }}
                className="w-full sm:w-auto h-10 pl-3 pr-8 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden shadow-2xs cursor-pointer appearance-none"
              >
                <option value="hariIni">Periode: Hari Ini</option>
                <option value="kemarin">Periode: Kemarin</option>
                <option value="7hari">Periode: 7 Hari Terakhir</option>
                <option value="30hari">Periode: 30 Hari Terakhir</option>
                <option value="bulanIni">Periode: Bulan Ini</option>
                <option value="semua">Periode: Semua Data</option>
                {activePreset === 'custom' && (
                  <option value="custom">Periode: Kustom</option>
                )}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>

            {/* b. Tombol Export Excel (.xlsx) */}
            <button
              type="button"
              onClick={handleExportExcel}
              title="Unduh data tabel aktif ke file spreadsheet Excel (.xlsx)"
              className="w-full sm:w-auto h-10 inline-flex items-center justify-center gap-1.5 px-3.5 text-sm font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-300 hover:border-emerald-400 rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Excel (.xlsx)</span>
            </button>

            {/* c. Tombol + Tambah Data Manual */}
            {!isManager ? (
              <button
                type="button"
                onClick={onOpenManualModal}
                className="w-full sm:w-auto h-10 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Data Manual</span>
              </button>
            ) : (
              <div 
                title="Akun Manager memiliki hak akses Monitoring & Executive View (Read-Only)"
                className="w-full sm:w-auto h-10 inline-flex items-center justify-center gap-1.5 px-3.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg shadow-2xs select-none"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Executive Monitoring View</span>
              </div>
            )}
          </div>
        </div>

        {/* BARIS 2: FILTER PARAMETER OPERASIONAL & KONTROL HALAMAN */}
        <div className="bg-slate-50 p-2.5 sm:p-3 rounded-lg border border-slate-200 space-y-2.5">
          {/* Header Baris 2: Label Filter dan Kontrol Data per Hal */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs sm:text-sm">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>Filter Operasional:</span>
            </div>

            {/* Kontrol Data per Halaman */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <span className="hidden sm:inline">Per Hal:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 px-2 rounded-md border border-slate-300 bg-white text-slate-800 font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden cursor-pointer shadow-2xs"
              >
                <option value={15}>15 Data</option>
                <option value={25}>25 Data</option>
                <option value={50}>50 Data</option>
                <option value={100}>100 Data</option>
              </select>
            </div>
          </div>

          {/* Grid Filter: grid 1 kolom di HP (<640px), 2 kolom di tablet (640-1024px), flex wrap di layar besar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2 text-sm">
            {/* Dropdown Wilayah Kerja */}
            <select
              value={selectedWilayah}
              onChange={(e) => {
                setSelectedWilayah(e.target.value);
                setCurrentPage(1);
              }}
              title="Filter Wilayah Operasional"
              className="w-full lg:w-auto h-9.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-hidden cursor-pointer font-medium"
            >
              <option value="Semua">Semua Wilayah</option>
              {DAFTAR_WILAYAH.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>

            {/* Dropdown Jenis Unit (Hanya 5 unit aktif: Long Arm, Mini, Standar, Grader, Compactor) */}
            <select
              value={selectedJenisUnit}
              onChange={(e) => {
                setSelectedJenisUnit(e.target.value);
                setCurrentPage(1);
              }}
              title="Filter Jenis Unit Alat Berat"
              className="w-full lg:w-auto h-9.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-hidden cursor-pointer font-medium"
            >
              <option value="Semua">Semua Jenis Unit</option>
              {DAFTAR_JENIS_UNIT_AKTIF.map((ju) => (
                <option key={ju} value={ju}>{ju}</option>
              ))}
            </select>

            {/* Dropdown Unit */}
            <select
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full lg:w-auto h-9.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="Semua">Semua Unit</option>
              {units
                .filter((u) => {
                  if (selectedJenisUnit === 'Semua') return true;
                  const uj = (u.jenis_unit || '').trim().toLowerCase();
                  const fj = selectedJenisUnit.trim().toLowerCase();
                  return uj === fj || uj.includes(fj) || fj.includes(uj);
                })
                .map((u) => (
                  <option key={u.id} value={u.kode_unit}>{u.kode_unit} ({u.jenis_unit})</option>
                ))}
            </select>

            {/* Dropdown Shift */}
            <select
              value={selectedShift}
              onChange={(e) => {
                setSelectedShift(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full lg:w-auto h-9.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="Semua">Semua Shift</option>
              <option value="Siang">Shift: Siang</option>
              <option value="Malam">Shift: Malam</option>
            </select>

            {/* Dropdown Status */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full lg:w-auto h-9.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-hidden cursor-pointer font-medium"
            >
              <option value="Semua">Semua Status</option>
              <option value="OPERASI">Status: OPERASI</option>
              <option value="STANDBY">Status: STANDBY</option>
              <option value="BREAKDOWN">Status: BREAKDOWN</option>
            </select>

            {/* Date Picker Rentang Tanggal ringkas (WIB) */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-auto flex items-center justify-between gap-1.5 h-9.5 bg-white px-2.5 rounded-lg border border-slate-300 w-full lg:w-auto">
              <div className="flex items-center gap-1 text-xs text-slate-500 font-medium shrink-0">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>WIB:</span>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                  setCurrentPage(1);
                }}
                title="Tanggal Awal Operasional (WIB)"
                className="text-xs font-mono text-slate-800 bg-transparent border-0 p-0 focus:outline-hidden flex-1 min-w-0"
              />
              <span className="text-slate-400 text-xs px-1">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                  setCurrentPage(1);
                }}
                title="Tanggal Akhir Operasional (WIB)"
                className="text-xs font-mono text-slate-800 bg-transparent border-0 p-0 focus:outline-hidden flex-1 min-w-0"
              />
            </div>

            {/* Tombol "Reset Filter" */}
            {isFilterActive && (
              <button
                type="button"
                onClick={resetFilters}
                title="Reset seluruh filter pencarian dan tanggal"
                className="col-span-1 sm:col-span-2 lg:col-span-auto w-full lg:w-auto h-9.5 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-white text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors shadow-2xs cursor-pointer animate-in fade-in"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CONTAINER DATA REKAPITULASI (DESKTOP TABEL + MOBILE CARD VIEW) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* =========================================================================
            1. TAMPILAN MOBILE CARD (< 768px): Card Vertikal Bersih, Ringkas, Touch-Friendly
           ========================================================================= */}
        <div className="block md:hidden p-3 space-y-3 bg-slate-50/60">
          {paginatedActivities.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 shadow-2xs">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-700 text-sm">Tidak ada data aktivitas yang sesuai kriteria.</p>
              <p className="text-xs text-slate-400 mt-1">
                {isManager ? 'Menunggu sinkronisasi data aktivitas dari aplikasi Android armada lapangan.' : 'Gunakan tombol "+ Tambah Data Manual" atau tunggu pengiriman dari aplikasi Android.'}
              </p>
            </div>
          ) : (
            paginatedActivities.map((row, idx) => {
              const isGlowing = highlightIds.has(row.id) || 
                highlightIds.has(Number(row.id)) || 
                newActivityIds.has(typeof row.id === 'number' ? row.id : parseInt(String(row.id), 10));
              const kendalaItems = (Array.isArray(row.kendala) && row.kendala.length > 0)
                ? row.kendala
                : parseKendalaList(row.kendala || row.kendala_list || row.kendala_data);
              const isMalam = (row.shift_kerja || '').toUpperCase() === 'MALAM';
              const kasieWilayah = row.wilayah || userWilayahMap.get((row.nama_pengawas || '').toLowerCase().trim());
              const st = (row.kategori_status || row.status_unit || 'OPERASI').toUpperCase();

              const sAwal = row.stik_solar_awal !== null && row.stik_solar_awal !== undefined ? row.stik_solar_awal : row.stik_awal;
              const sAkhir = row.stik_solar_akhir !== null && row.stik_solar_akhir !== undefined ? row.stik_solar_akhir : row.stik_akhir;
              const hasStik = (sAwal !== null && sAwal !== undefined && Number(sAwal) > 0) || (sAkhir !== null && sAkhir !== undefined && Number(sAkhir) > 0);
              
              let est = row.estimasi_konsumsi_solar;
              if ((!est || Number(est) === 0) && row.jumlah_liter_solar && hasStik && sAwal !== null && sAkhir !== null && (Number(sAkhir) - Number(sAwal)) > 0) {
                est = Math.round((Number(row.jumlah_liter_solar) / (Number(sAkhir) - Number(sAwal))) * 10) / 10;
              }

              return (
                <div 
                  key={`card-${row.id || 'act'}-${idx}`}
                  className={`bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs transition-all ${
                    isGlowing ? 'bg-emerald-50/80 ring-2 ring-emerald-400' : ''
                  }`}
                >
                  {/* HEADER CARD: Nomor SPK / ID, Badge Status (Hijau/Kuning/Merah), & Shift */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {row.nomor_spk ? (
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
                          SPK: {row.nomor_spk}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          {row.status_spk || 'Tanpa SPK'}
                        </span>
                      )}
                      {isGlowing && (
                        <span className="flex h-2 w-2 relative shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Shift */}
                      {isMalam ? (
                        <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-wider">
                          MALAM
                        </span>
                      ) : (
                        <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 tracking-wider">
                          SIANG
                        </span>
                      )}

                      {/* Badge Status (Operasi / Standby / Breakdown) */}
                      {st === 'STANDBY' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                          STANDBY
                        </span>
                      ) : st === 'BREAKDOWN' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                          BREAKDOWN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          OPERASI
                        </span>
                      )}
                    </div>
                  </div>

                  {/* BARIS 1: Informasi Kasie / Wilayah dan Kode Unit Alat Berat */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {row.nama_pengawas}
                        </span>
                        {kasieWilayah && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shadow-2xs ${getWilayahBadgeClass(kasieWilayah)}`}>
                            {kasieWilayah}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5">
                        <span className="font-semibold text-slate-700">{row.tanggal_kerja || row.tanggal}</span>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">WIB</span>
                        {row.kode_lokasi && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 font-sans text-xs">Lokasi: <strong className="text-slate-800">{row.kode_lokasi}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Kode Unit Alat Berat Prominent */}
                    <div className="text-right shrink-0">
                      <div className="font-mono font-extrabold text-sm text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs inline-block">
                        {row.kode_unit}
                      </div>
                      {row.model_unit && (
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium truncate max-w-[120px]">
                          {row.model_unit}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BARIS 2: Nama Aktivitas Aktual & Kendala Lapangan (jika ada) */}
                  <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-200/80 mb-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="font-semibold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                        <span>{row.aktivitas_aktual || row.nama_aktivitas || row.aktivitas || "Aktivitas Belum Dipilih"}</span>
                        {row.kode_sap && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                            {row.kode_sap}
                          </span>
                        )}
                      </div>
                      {row.hasil_kerja !== null && row.hasil_kerja !== undefined && row.status_realisasi !== 'BELUM_INPUT' ? (
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {(row.hasil_kerja || 0).toLocaleString('id-ID')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium ml-1">
                            {row.satuan}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Menunggu Realisasi Lapangan */}
                    {row.status_realisasi === 'BELUM_INPUT' && (
                      <div className="pt-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                          Menunggu Realisasi Lapangan
                        </span>
                      </div>
                    )}

                    {/* Kendala Lapangan (Stack Badge Peringatan ⚠️) */}
                    {kendalaItems && kendalaItems.length > 0 && (
                      <div className="flex flex-col gap-1 pt-1">
                        {kendalaItems.map((k: any, kIdx: number) => (
                          <div key={kIdx} className="p-1.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-rose-800 flex items-center gap-1">
                                <span>⚠️ #{kIdx + 1}</span>
                                <span>{k.nama_kendala || k.kendala || k.nama}</span>
                                {k.kode_kendala && k.kode_kendala !== '-' && (
                                  <span className="text-[10px] bg-rose-100 px-1 rounded text-rose-900 font-mono">[{k.kode_kendala || k.kode}]</span>
                                )}
                              </span>
                              <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded shrink-0">
                                {k.durasi_jam || k.durasi || k.hambatan || 0} Jam
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600">
                              Waktu: {k.jam_mulai || k.jam_awal || '-'} s/d {k.jam_selesai || k.jam_akhir || '-'}
                              {k.keterangan && ` • ${k.keterangan}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Catatan Pengawas */}
                    {row.keterangan && row.keterangan.trim() !== '' && (
                      <div className="text-[11px] italic text-slate-600 bg-white p-1.5 rounded border border-slate-200/60">
                        Catatan: "{row.keterangan}"
                      </div>
                    )}
                  </div>

                  {/* BARIS 3: Detail Operator dan Rincian Operasional */}
                  <div className="space-y-2 mb-3 text-xs">
                    {/* Operator */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500 text-[11px]">Operator:</span>
                      <div className="text-right">
                        <span className="font-semibold text-slate-900">{row.operator || 'Operator Default'}</span>
                        {row.nik_operator && row.nik_operator !== '-' && (
                          <span className="text-[10px] text-slate-400 font-mono ml-1.5">({row.nik_operator})</span>
                        )}
                      </div>
                    </div>

                    {/* Rincian Operasional: HM Awal ➔ Akhir, Stik Solar, Est. Konsumsi */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-semibold">HM & Jam Kerja</span>
                        {row.status_realisasi === 'BELUM_INPUT' || row.hm_awal === null || row.hm_awal === undefined ? (
                          <span className="text-slate-400 font-bold">-</span>
                        ) : (
                          <div>
                            <span className="font-extrabold text-emerald-800 font-mono text-sm">
                              {(row.hm_harian_berjalan || 0).toFixed(1)} HM
                            </span>
                            <span className="text-slate-500 font-mono text-xs ml-1 font-medium">
                              ({row.jam_kerja || 0} Jam)
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              <span>{row.hm_awal}</span>
                              {row.is_hm_awal_corrected === 1 && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded mx-0.5">Koreksi</span>
                              )}
                              <span> → {row.hm_akhir}</span>
                            </div>
                            {row.is_hm_awal_corrected === 1 && row.alasan_koreksi_hm && (
                              <div className="text-[9px] text-amber-800 italic mt-0.5 truncate" title={row.alasan_koreksi_hm}>
                                Alasan: {row.alasan_koreksi_hm}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-semibold">BBM & Stik Solar</span>
                        {row.jumlah_liter_solar && row.jumlah_liter_solar > 0 ? (
                          <div className="font-bold text-amber-800 font-mono text-xs flex items-center gap-1">
                            <Fuel className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{row.jumlah_liter_solar.toLocaleString('id-ID')} Liter</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs font-mono">-</span>
                        )}
                        {hasStik && (
                          <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                            <span>Stik: <strong>{sAwal ?? 0} / {sAkhir ?? 0} cm</strong></span>
                            {est !== null && est !== undefined && Number(est) > 0 && (
                              <div className="text-[9px] text-amber-800 font-bold bg-amber-50 px-1 rounded border border-amber-200 inline-block mt-0.5">
                                Est: {est} L/cm
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* FOOTER CARD: Tombol aksi Touch-Friendly (Lihat Foto / Edit / Hapus) */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    {/* Lihat Foto */}
                    {Boolean(row.has_foto_bukti || row.has_foto || row.foto_bukti) ? (
                      <button
                        type="button"
                        onClick={() => onViewPhoto(row)}
                        className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer active:scale-98"
                      >
                        <Camera className="w-4 h-4 text-emerald-600" />
                        <span>Lihat Foto</span>
                      </button>
                    ) : row.status_realisasi === 'BELUM_INPUT' ? (
                      <div className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Menunggu Lapangan</span>
                      </div>
                    ) : (
                      <div className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
                        <CameraOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tanpa Foto</span>
                      </div>
                    )}

                    {/* Edit */}
                    {!isManager && (
                      <button
                        type="button"
                        onClick={() => onEditActivity(row)}
                        className="min-h-[38px] px-3.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer active:scale-98"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                        <span>Edit</span>
                      </button>
                    )}

                    {/* Hapus */}
                    {!isManager && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="min-h-[38px] px-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer active:scale-98"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Hapus</span>
                      </button>
                    )}

                    {isManager && (
                      <span className="px-3 py-1.5 text-xs font-bold text-slate-400 bg-slate-100 rounded-lg">
                        Mode Audit
                      </span>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* =========================================================================
            2. TAMPILAN DESKTOP TABLE (>= 768px): Tabel 9 Kolom Kompak Presisi
           ========================================================================= */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full table-fixed text-left border-collapse">
            
            {/* Table Header: Exactly 9 Compact Columns with specified widths */}
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                {/* Kolom 1 [FOTO & SPK] - ~8% */}
                <th className="w-[8%] py-2.5 px-2 text-center">
                  Foto & SPK
                </th>

                {/* Kolom 2 [KASIE & TANGGAL] - ~15% */}
                <th className="w-[15%] py-2.5 px-2.5">
                  Kasie & Shift
                </th>

                {/* Kolom 3 [UNIT & STATUS] - ~10% */}
                <th className="w-[10%] py-2.5 px-2 text-center">
                  Unit & Status
                </th>

                {/* Kolom 4 [AKTIVITAS & KENDALA] - ~25% */}
                <th className="w-[25%] py-2.5 px-2.5">
                  Aktivitas & Kendala Lapangan
                </th>

                {/* Kolom 5 [OPERATOR] - ~11% */}
                <th className="w-[11%] py-2.5 px-2">
                  Operator
                </th>

                {/* Kolom 6 [LOKASI] - ~9% */}
                <th className="w-[9%] py-2.5 px-2">
                  Lokasi
                </th>

                {/* Kolom 7 [OPERASIONAL HM & SOLAR] - ~13% */}
                <th className="w-[13%] py-2.5 px-2 text-right">
                  Operasional HM & Solar
                </th>

                {/* Kolom 8 [HASIL KERJA] - ~5% */}
                <th className="w-[5%] py-2.5 px-2 text-right">
                  Hasil
                </th>

                {/* Kolom 9 [AKSI] - ~4% */}
                <th className="w-[4%] py-2.5 px-1 text-center">
                  {isManager ? 'Audit' : 'Aksi'}
                </th>
              </tr>
            </thead>

            {/* Table Body: 2-3 line cell stacking per column */}
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {paginatedActivities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">Tidak ada data aktivitas yang sesuai kriteria.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isManager ? 'Menunggu sinkronisasi data aktivitas dari aplikasi Android armada lapangan.' : 'Gunakan tombol "+ Tambah Data Manual" atau tunggu pengiriman dari aplikasi Android.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedActivities.map((row, idx) => {
                  const isGlowing = highlightIds.has(row.id) || 
                    highlightIds.has(Number(row.id)) || 
                    newActivityIds.has(typeof row.id === 'number' ? row.id : parseInt(String(row.id), 10));
                  const kendalaItems = (Array.isArray(row.kendala) && row.kendala.length > 0)
                    ? row.kendala
                    : parseKendalaList(row.kendala || row.kendala_list || row.kendala_data);
                  if (!row.kendala || !Array.isArray(row.kendala) || row.kendala.length === 0) {
                    if (kendalaItems && kendalaItems.length > 0) {
                      row.kendala = kendalaItems;
                    }
                  }
                  const isMalam = (row.shift_kerja || '').toUpperCase() === 'MALAM';
                  const kasieWilayah = row.wilayah || userWilayahMap.get((row.nama_pengawas || '').toLowerCase().trim());

                  return (
                    <tr
                      key={`${row.id || 'act'}-${idx}`}
                      className={`transition-colors duration-300 hover:bg-slate-50/80 ${
                        isGlowing ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''
                      }`}
                    >
                      
                      {/* Kolom 1 [FOTO & SPK]: Thumbnail compact 36x36px + Nomor SPK */}
                      <td className="py-2.5 px-2 text-center align-top">
                        <div className="flex flex-col items-center gap-1">
                          {row.status_realisasi === 'BELUM_INPUT' ? (
                            <div 
                              title="Menunggu input laporan realisasi dari Android"
                              className="h-7 px-2 shrink-0 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 text-[10px] font-semibold gap-1"
                            >
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Menunggu</span>
                            </div>
                          ) : Boolean(row.has_foto_bukti || row.has_foto || row.foto_bukti) ? (
                            <button
                              type="button"
                              onClick={() => onViewPhoto(row)}
                              title="Klik untuk membuka & memuat foto bukti lapangan"
                              className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Lihat Foto</span>
                            </button>
                          ) : (
                            <div 
                              title="Tidak ada foto bukti"
                              className="h-7 px-2 shrink-0 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-[10px] gap-1"
                            >
                              <CameraOff className="w-3 h-3 text-slate-400" />
                              <span>Tanpa Foto</span>
                            </div>
                          )}

                          {row.nomor_spk ? (
                            <span 
                              title={`Nomor SPK: ${row.nomor_spk}`}
                              className="font-mono text-[9px] font-bold px-1 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-300 max-w-[80px] truncate"
                            >
                              {row.nomor_spk}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">
                              {row.status_spk || 'Tanpa SPK'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Kolom 2 [KASIE & TANGGAL & SHIFT] */}
                      <td className="py-2.5 px-2.5 align-top">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isGlowing && (
                              <span className="flex h-1.5 w-1.5 relative shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
                              </span>
                            )}
                            <span className="font-bold text-slate-900 text-xs truncate" title={row.nama_pengawas}>
                              {row.nama_pengawas}
                            </span>
                            {kasieWilayah && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shadow-2xs ${getWilayahBadgeClass(kasieWilayah)}`}>
                                {kasieWilayah}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-mono flex-wrap">
                            <span className="font-semibold text-slate-700">{row.tanggal_kerja || row.tanggal}</span>
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">WIB</span>
                            <span className="text-slate-300">•</span>
                            {isMalam ? (
                              <span 
                                title="Shift Kerja: MALAM"
                                className="font-bold text-[9px] px-1.5 py-0.2 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-wider inline-flex items-center gap-0.5"
                              >
                                MALAM
                              </span>
                            ) : (
                              <span 
                                title="Shift Kerja: SIANG"
                                className="font-bold text-[9px] px-1.5 py-0.2 rounded-sm bg-amber-50 text-amber-800 border border-amber-300 tracking-wider inline-flex items-center gap-0.5"
                              >
                                SIANG
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kolom 3 [UNIT & STATUS] */}
                      <td className="py-2.5 px-2 text-center align-top">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-bold text-slate-900 text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {row.kode_unit}
                          </span>

                          {(() => {
                            const st = (row.kategori_status || row.status_unit || 'OPERASI').toUpperCase();
                            if (st === 'STANDBY') {
                              return (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                                  <span className="w-1 h-1 rounded-full bg-amber-600"></span>
                                  STANDBY
                                </span>
                              );
                            }
                            if (st === 'BREAKDOWN') {
                              return (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="w-1 h-1 rounded-full bg-rose-600"></span>
                                  BREAKDOWN
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
                                OPERASI
                              </span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Kolom 4 [AKTIVITAS & KENDALA & KETERANGAN] */}
                      <td className="py-2.5 px-2.5 align-top">
                        <div className="min-w-0 space-y-1">
                          {/* Baris 1: Aktivitas & SAP */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="font-medium text-slate-800 text-xs">
                              {row.aktivitas_aktual || row.nama_aktivitas || row.aktivitas || "Aktivitas Belum Dipilih"}
                            </div>
                            {row.kode_sap && (
                              <span className="badge-sap text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5 inline-block shrink-0">
                                {row.kode_sap}
                              </span>
                            )}
                            {row.satuan && (
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                ({row.satuan})
                              </span>
                            )}
                          </div>

                          {/* Status Menunggu Realisasi jika belum diinput dari HP Android */}
                          {row.status_realisasi === 'BELUM_INPUT' && (
                            <div className="pt-0.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                Menunggu Realisasi Lapangan
                              </span>
                            </div>
                          )}

                          {/* Baris 2: Badge Peringatan Kendala Lapangan */}
                          {row.kendala && row.kendala.length > 0 && (
                            <div className="mt-1.5 flex flex-col gap-1">
                              {row.kendala.map((k: any, idx: number) => (
                                <div key={idx} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                                  <span className="text-rose-500 font-bold">⚠️ #{idx + 1} {k.nama_kendala || k.kendala || k.nama} [{k.kode_kendala || k.kode || '-'}]</span>
                                  <span className="text-slate-500 text-[11px]">({k.jam_mulai || k.jam_awal} - {k.jam_selesai || k.jam_akhir} • Hambatan: {k.durasi_jam || k.durasi || k.hambatan} Jam)</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Baris 3: Keterangan / Catatan Lapangan Pengawas */}
                          {row.keterangan && row.keterangan.trim() !== '' && (
                            <div 
                              className="text-[11px] italic text-slate-600 truncate max-w-[340px] pt-0.5 cursor-help"
                              title={`Catatan Pengawas: "${row.keterangan}"`}
                            >
                              "{row.keterangan}"
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Kolom 5 [OPERATOR] */}
                      <td className="py-2.5 px-2 align-top">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 text-xs truncate" title={row.operator}>
                            {row.operator}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5" title={row.nik_operator}>
                            {row.nik_operator}
                          </div>
                        </div>
                      </td>

                      {/* Kolom 6 [LOKASI] */}
                      <td className="py-2.5 px-2 align-top">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs truncate">
                            {row.kode_lokasi || row.lokasi}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5" title={row.lokasi}>
                            {row.lokasi || row.kode_lokasi}
                          </div>
                        </div>
                      </td>

                      {/* Kolom 7 [OPERASIONAL HM & SOLAR] */}
                      <td className="py-2.5 px-2 text-right align-top">
                        {row.status_realisasi === 'BELUM_INPUT' || row.hm_awal === null || row.hm_awal === undefined ? (
                          <div className="text-right">
                            <div className="text-xs font-bold text-slate-400 font-mono">
                              -
                            </div>
                            <div className="text-[10px] text-amber-700 font-semibold mt-0.5 inline-flex items-center gap-1 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              <Clock className="w-2.5 h-2.5 text-amber-600" />
                              <span>Menunggu Realisasi</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              HM: - → - | Solar: -
                            </div>
                          </div>
                        ) : (
                          <div className="text-right">
                            <div className="text-xs">
                              <span className="font-bold text-emerald-800 font-mono">
                                {(row.hm_harian_berjalan || 0).toFixed(1)} HM
                              </span>
                              <span className="text-slate-300 mx-1">|</span>
                              <span className="text-slate-600 font-medium font-mono">
                                {row.jam_kerja || 0} Jam
                              </span>
                            </div>

                            <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 font-mono mt-0.5 flex-wrap">
                              <span className="text-slate-400">HM:</span>
                              <span className="font-semibold text-slate-700">
                                {(row.hm_awal || 0).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                              </span>
                              {(row.is_hm_awal_corrected === 1 || row.is_hm_awal_corrected === true) && (
                                <span 
                                  title={row.alasan_koreksi_hm ? `Alasan Koreksi: ${row.alasan_koreksi_hm}` : 'HM Awal telah dikoreksi oleh pengawas'}
                                  className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold font-sans cursor-help shrink-0 shadow-2xs"
                                >
                                  <Pencil className="w-2.5 h-2.5 text-amber-700" />
                                  <span>Koreksi</span>
                                </span>
                              )}
                              <span className="text-slate-400">→</span>
                              <span className="font-semibold text-slate-700">
                                {(row.hm_akhir || 0).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                              </span>
                            </div>

                            {(row.is_hm_awal_corrected === 1 || row.is_hm_awal_corrected === true) && (
                              <div 
                                className="text-[9px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 max-w-[210px] ml-auto truncate cursor-help text-left flex items-center gap-1 font-sans font-medium"
                                title={`Alasan Koreksi Pengawas: "${row.alasan_koreksi_hm || 'Perbaikan koreksi HM awal lapangan'}"`}
                              >
                                <Pencil className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                <span className="truncate italic">
                                  Koreksi: {row.alasan_koreksi_hm || 'Audit koreksi pengawas'}
                                </span>
                              </div>
                            )}

                            <div className="mt-1 flex flex-col items-end gap-0.5">
                              {row.jumlah_liter_solar && row.jumlah_liter_solar > 0 ? (
                                <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300 text-[10px] font-mono shadow-2xs">
                                  <Fuel className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>{row.jumlah_liter_solar.toLocaleString('id-ID')} L</span>
                                </span>
                              ) : null}

                              {(() => {
                                const sAwal = row.stik_solar_awal !== null && row.stik_solar_awal !== undefined ? row.stik_solar_awal : row.stik_awal;
                                const sAkhir = row.stik_solar_akhir !== null && row.stik_solar_akhir !== undefined ? row.stik_solar_akhir : row.stik_akhir;
                                const hasStik = (sAwal !== null && sAwal !== undefined && Number(sAwal) > 0) || (sAkhir !== null && sAkhir !== undefined && Number(sAkhir) > 0);
                                
                                let est = row.estimasi_konsumsi_solar;
                                if ((!est || Number(est) === 0) && row.jumlah_liter_solar && hasStik && sAwal !== null && sAkhir !== null && (Number(sAkhir) - Number(sAwal)) > 0) {
                                  est = Math.round((Number(row.jumlah_liter_solar) / (Number(sAkhir) - Number(sAwal))) * 10) / 10;
                                }

                                if (!hasStik && (!row.jumlah_liter_solar || row.jumlah_liter_solar <= 0)) {
                                  return <span className="text-slate-300 font-medium text-[10px]">-</span>;
                                }

                                if (!hasStik) return null;

                                return (
                                  <div className="text-[10px] text-slate-600 font-mono flex items-center justify-end gap-1 flex-wrap mt-0.5">
                                    <span>Stik: <strong className="text-slate-800">{sAwal ?? 0} / {sAkhir ?? 0} cm</strong></span>
                                    {est !== null && est !== undefined && Number(est) > 0 && (
                                      <span className="text-amber-800 font-bold bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                        Est: {est} L/cm
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Kolom 8 [HASIL KERJA] */}
                      <td className="py-2.5 px-2 text-right align-top">
                        <div className="text-right">
                          {row.status_realisasi === 'BELUM_INPUT' || row.hasil_kerja === null || row.hasil_kerja === undefined ? (
                            <span className="font-bold text-slate-400 font-mono text-xs block">
                              -
                            </span>
                          ) : (
                            <>
                              <span className="font-bold text-slate-900 font-mono text-xs block">
                                {(row.hasil_kerja || 0).toLocaleString('id-ID')}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium block">
                                {row.satuan}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Kolom 9 [AKSI] */}
                      <td className="py-2.5 px-1 text-center align-top">
                        {!isManager ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditActivity(row)}
                              title="Edit laporan"
                              className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(row)}
                              title="Hapus laporan"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span 
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400 bg-slate-100" 
                            title="Mode Audit Eksekutif (Read-Only)"
                          >
                            Tinjau
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 font-medium">
            {filteredActivities.length > 0 ? (
              <span>
                Menampilkan <strong className="text-slate-900 font-bold">{Math.min((currentPage - 1) * pageSize + 1, filteredActivities.length)}</strong> - <strong className="text-slate-900 font-bold">{Math.min(currentPage * pageSize, filteredActivities.length)}</strong> dari <strong className="text-slate-900 font-bold">{filteredActivities.length}</strong> laporan ({activities.length} total tersimpan)
              </span>
            ) : (
              <span>0 laporan ditemukan</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              title="Halaman Pertama"
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-bold text-xs"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              title="Halaman Sebelumnya"
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-xs shadow-2xs">
              Hal {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              title="Halaman Berikutnya"
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              title="Halaman Terakhir"
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-bold text-xs"
            >
              Last
            </button>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={deleteTarget ? ((deleteTarget.status_realisasi === 'BELUM_INPUT' || !deleteTarget.id_aktivitas) ? "Konfirmasi Hapus Rencana Kerja" : "Konfirmasi Hapus Laporan Realisasi") : "Konfirmasi Hapus Data"}
        message={deleteTarget ? ((deleteTarget.status_realisasi === 'BELUM_INPUT' || !deleteTarget.id_aktivitas) 
          ? `Apakah Anda yakin ingin menghapus rencana kerja unit ${deleteTarget.unit || deleteTarget.kode_unit} yang masih berstatus menunggu realisasi lapangan?`
          : `Apakah Anda yakin ingin menghapus data laporan realisasi aktivitas unit ${deleteTarget.unit || deleteTarget.kode_unit}?`) : ""}
        itemName={deleteTarget ? `Unit: ${deleteTarget.unit || deleteTarget.kode_unit} | Aktivitas: ${deleteTarget.nama_aktivitas || deleteTarget.aktivitas} (${deleteTarget.tanggal})` : undefined}
        isDeleting={isDeleting}
      />

    </div>
  );
};
