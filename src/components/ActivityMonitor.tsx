import React, { useState } from 'react';
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
  Eye,
  CheckCircle,
  Fuel,
  Clock,
  Sparkles,
  Pencil
} from 'lucide-react';
import { HasilInputAktivitas, Unit, AktivitasUnit, Operator } from '../types';
import { exportToExcel } from '../utils/export';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

function formatKendalaDuration(menit: number): string {
  if (!menit || menit <= 0) return '0 m';
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam > 0 && sisa > 0) return `${jam} jam ${sisa} mnt`;
  if (jam > 0) return `${jam} jam`;
  return `${sisa} menit`;
}

function parseKendalaList(kendala: unknown): Array<{ nama_kendala: string; waktu_mulai?: string; waktu_selesai?: string; durasi_menit?: number }> {
  if (!kendala) return [];
  if (Array.isArray(kendala)) return kendala;
  if (typeof kendala === 'string') {
    try {
      const parsed = JSON.parse(kendala);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [{ nama_kendala: kendala }];
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
  newActivityIds: Set<number | string>;
  onOpenManualModal: () => void;
  onEditActivity: (activity: HasilInputAktivitas) => void;
  onDeleteActivity: (id: number | string) => Promise<void> | void;
  onRefresh: () => void;
  onViewPhoto: (activity: HasilInputAktivitas) => void;
}

export const ActivityMonitor: React.FC<ActivityMonitorProps> = ({
  activities,
  units,
  aktivitasList,
  operators,
  supervisors,
  newActivityIds,
  onOpenManualModal,
  onEditActivity,
  onDeleteActivity,
  onRefresh,
  onViewPhoto
}) => {
  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPengawas, setSelectedPengawas] = useState('Semua');
  const [selectedUnit, setSelectedUnit] = useState('Semua');
  const [selectedShift, setSelectedShift] = useState('Semua');
  const [selectedStatus, setSelectedStatus] = useState('Semua');
  const [selectedDate, setSelectedDate] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<HasilInputAktivitas | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filter logic
  const filteredActivities = activities.filter((item) => {
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

    if (selectedPengawas !== 'Semua' && item.nama_pengawas !== selectedPengawas) {
      return false;
    }

    if (selectedUnit !== 'Semua' && item.kode_unit !== selectedUnit) {
      return false;
    }

    if (selectedShift !== 'Semua' && item.shift_kerja !== selectedShift) {
      return false;
    }

    if (selectedStatus !== 'Semua' && item.status_unit !== selectedStatus) {
      return false;
    }

    if (selectedDate && item.tanggal !== selectedDate) {
      return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredActivities.length / pageSize) || 1;
  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedPengawas('Semua');
    setSelectedUnit('Semua');
    setSelectedShift('Semua');
    setSelectedStatus('Semua');
    setSelectedDate('');
    setCurrentPage(1);
  };

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

    try {
      await onDeleteActivity(deleteTarget.id);
      const targetUnit = deleteTarget.kode_unit;
      setDeleteTarget(null);
      setFeedbackNotice(`Laporan unit ${targetUnit} berhasil dihapus dari database!`);
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

      {/* FILTER & ACTION TOOLBAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Universal Search Bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Pengawas, Unit, Kode SAP, Operator, Lokasi, SPK..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white placeholder-slate-400"
            />
          </div>

          {/* Action Buttons: Export Excel & Tambah Data Manual */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              title="Unduh seluruh data tabel aktif ke file spreadsheet Excel (.xlsx)"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 rounded-lg shadow-2xs transition-all cursor-pointer hover:shadow-xs active:scale-95"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={onOpenManualModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-700" />
              <span>+ Tambah Data Manual</span>
            </button>
          </div>

        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          {/* Pengawas */}
          <select
            value={selectedPengawas}
            onChange={(e) => {
              setSelectedPengawas(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="Semua">Pengawas: Semua</option>
            {supervisors.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Unit */}
          <select
            value={selectedUnit}
            onChange={(e) => {
              setSelectedUnit(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="Semua">Unit: Semua</option>
            {units.map((u) => (
              <option key={u.id} value={u.kode_unit}>{u.kode_unit} ({u.jenis_unit})</option>
            ))}
          </select>

          {/* Shift */}
          <select
            value={selectedShift}
            onChange={(e) => {
              setSelectedShift(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="Semua">Shift: Semua</option>
            <option value="Siang">Shift Siang</option>
            <option value="Malam">Shift Malam</option>
          </select>

          {/* Status Unit Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
          >
            <option value="Semua">Status: Semua</option>
            <option value="OPERASI">Status: OPERASI</option>
            <option value="STANDBY">Status: STANDBY</option>
            <option value="BREAKDOWN">Status: BREAKDOWN</option>
          </select>

          {/* Tanggal */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500"
          />

          {(searchTerm || selectedPengawas !== 'Semua' || selectedUnit !== 'Semua' || selectedShift !== 'Semua' || selectedStatus !== 'Semua' || selectedDate) && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:underline px-2 py-1 rounded cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filter
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500 font-medium">
            Menampilkan <span className="font-bold text-slate-800">{filteredActivities.length}</span> dari {activities.length} total laporan
          </div>
        </div>
      </div>

      {/* OPTIMIZED REKAPITULASI TABLE (FIT TO SCREEN / NO HORIZONTAL SCROLL) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full table-fixed text-left border-collapse">
          
          {/* Table Header: Exactly 9 Compact Columns with specified widths */}
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              {/* Kolom 1 [FOTO & SPK] - ~8% */}
              <th className="w-[8%] py-2.5 px-2 text-center">
                Foto & SPK
              </th>

              {/* Kolom 2 [PENGAWAS & TANGGAL] - ~15% */}
              <th className="w-[15%] py-2.5 px-2.5">
                Pengawas & Shift
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
                Aksi
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
                  <p className="text-[11px] text-slate-400 mt-1">Gunakan tombol "+ Tambah Data Manual" atau tunggu pengiriman dari aplikasi Android.</p>
                </td>
              </tr>
            ) : (
              paginatedActivities.map((row) => {
                const isGlowing = newActivityIds.has(typeof row.id === 'number' ? row.id : parseInt(String(row.id), 10));
                const kendalaItems = parseKendalaList(row.kendala_list);
                const isMalam = (row.shift_kerja || '').toUpperCase() === 'MALAM';

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors duration-300 hover:bg-slate-50/80 ${
                      isGlowing ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''
                    }`}
                  >
                    
                    {/* Kolom 1 [FOTO & SPK]: Thumbnail compact 36x36px + Nomor SPK */}
                    <td className="py-2.5 px-2 text-center align-top">
                      <div className="flex flex-col items-center gap-1">
                        {row.foto_bukti ? (
                          <button
                            type="button"
                            onClick={() => onViewPhoto(row)}
                            title="Klik untuk memperbesar foto bukti"
                            className="group relative inline-flex h-9 w-9 shrink-0 rounded-lg border border-slate-200 hover:border-emerald-500 bg-slate-50 overflow-hidden shadow-2xs transition-all cursor-pointer"
                          >
                            <img
                              src={row.foto_bukti}
                              alt={`Bukti ${row.kode_unit}`}
                              className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-3.5 h-3.5 text-white drop-shadow-xs" />
                            </div>
                          </button>
                        ) : (
                          <div 
                            title="Tidak ada foto bukti"
                            className="h-9 w-9 shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400"
                          >
                            <CameraOff className="w-3.5 h-3.5" />
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
                            Tanpa SPK
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Kolom 2 [PENGAWAS & TANGGAL & SHIFT]: 
                        Baris 1: Nama Pengawas (teks tebal)
                        Baris 2: Tanggal laporan + Badge Shift kecil (SIANG amber / MALAM indigo) */}
                    <td className="py-2.5 px-2.5 align-top">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          {isGlowing && (
                            <span className="flex h-1.5 w-1.5 relative shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
                            </span>
                          )}
                          <span className="font-bold text-slate-900 text-xs truncate block" title={row.nama_pengawas}>
                            {row.nama_pengawas}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-mono flex-wrap">
                          <span>{row.tanggal}</span>
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

                    {/* Kolom 3 [UNIT & STATUS]: Baris 1: Kode Unit badge, Baris 2: Pill status */}
                    <td className="py-2.5 px-2 text-center align-top">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-mono font-bold text-slate-900 text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {row.kode_unit}
                        </span>

                        {(!row.status_unit || row.status_unit === 'OPERASI') && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
                            OPERASI
                          </span>
                        )}
                        {row.status_unit === 'STANDBY' && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                            <span className="w-1 h-1 rounded-full bg-amber-600"></span>
                            STANDBY
                          </span>
                        )}
                        {row.status_unit === 'BREAKDOWN' && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1 h-1 rounded-full bg-rose-600"></span>
                            BREAKDOWN
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Kolom 4 [AKTIVITAS & KENDALA & KETERANGAN]: 
                        Baris 1: Nama Aktivitas + Kode SAP (Satuan)
                        Baris 2: Stack Badge Peringatan Oranye Kendala: "⚠️ [Nama Kendala] (JJ:MM - JJ:MM | X jam Y menit)"
                        Baris 3: Catatan Pengawas (italic slate-600, truncate + tooltip) */}
                    <td className="py-2.5 px-2.5 align-top">
                      <div className="min-w-0 space-y-1">
                        {/* Baris 1: Aktivitas & SAP */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span 
                            className="font-bold text-slate-800 text-xs truncate max-w-[210px]"
                            title={row.nama_aktivitas}
                          >
                            {row.nama_aktivitas}
                          </span>
                          <span className="font-mono text-[9px] font-bold px-1 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                            {row.kode_sap}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            ({row.satuan})
                          </span>
                        </div>

                        {/* Baris 2: Stack Kendala jika ada */}
                        {kendalaItems && kendalaItems.length > 0 && (
                          <div className="space-y-1 pt-0.5">
                            {kendalaItems.map((k, kIdx) => {
                              const range = (k.waktu_mulai && k.waktu_selesai) ? `${k.waktu_mulai} - ${k.waktu_selesai}` : '';
                              const durasi = k.durasi_menit !== undefined ? formatKendalaDuration(k.durasi_menit) : '';
                              const detailTiming = [range, durasi].filter(Boolean).join(' | ');

                              return (
                                <div
                                  key={kIdx}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-50/90 border border-amber-300 rounded px-1.5 py-0.5 max-w-full leading-tight"
                                  title={`Kendala: ${k.nama_kendala}${detailTiming ? ` (${detailTiming})` : ''}`}
                                >
                                  <span className="text-[11px] shrink-0">⚠️</span>
                                  <span className="font-bold truncate">{k.nama_kendala}</span>
                                  {detailTiming && (
                                    <span className="text-amber-800 font-mono text-[9px] shrink-0 font-normal">
                                      ({detailTiming})
                                    </span>
                                  )}
                                </div>
                              );
                            })}
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

                    {/* Kolom 5 [OPERATOR]: Baris 1: Nama Operator, Baris 2: NIK */}
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

                    {/* Kolom 6 [LOKASI]: Baris 1: Kode Lokasi, Baris 2: Detail wilayah/blok */}
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

                    {/* Kolom 7 [OPERASIONAL HM & SOLAR]: 
                        Baris 1: Total HM Berjalan tebal | Jam (misal: "4.0 HM | 8.0 Jam")
                        Baris 2: Range HM Awal s/d Akhir (teks abu-abu ringkas, misal: "HM: 1,240.5 → 1,244.5")
                        Baris 3: Stik BBM / Liter Solar (misal: "Stik: 45→20 | 120 L") */}
                    <td className="py-2.5 px-2 text-right align-top">
                      <div className="text-right">
                        {/* Baris 1: Total HM Berjalan tebal */}
                        <div className="text-xs">
                          <span className="font-bold text-emerald-800 font-mono">
                            {row.hm_harian_berjalan.toFixed(1)} HM
                          </span>
                          <span className="text-slate-300 mx-1">|</span>
                          <span className="text-slate-600 font-medium font-mono">
                            {row.jam_kerja} Jam
                          </span>
                        </div>

                        {/* Baris 2: Range HM Awal s/d Akhir */}
                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 font-mono mt-0.5 flex-wrap">
                          <span className="text-slate-400">HM:</span>
                          <span className="font-semibold text-slate-700">
                            {row.hm_awal.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
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
                            {row.hm_akhir.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </span>
                        </div>

                        {/* Baris 2B: Alasan Koreksi HM Pengawas (jika is_hm_awal_corrected = 1) */}
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

                        {/* Baris 3: Stik BBM / Liter Solar */}
                        <div className="text-[10px] mt-0.5 font-mono">
                          {row.stik_awal !== undefined && row.stik_awal !== null && row.stik_akhir !== undefined && row.stik_akhir !== null ? (
                            <span className="text-slate-600 font-medium">
                              Stik: {row.stik_awal}→{row.stik_akhir}
                              {row.jumlah_liter_solar && row.jumlah_liter_solar > 0 ? (
                                <span className="text-amber-700 font-bold ml-1">
                                  | {row.jumlah_liter_solar.toLocaleString('id-ID')} L
                                </span>
                              ) : ''}
                            </span>
                          ) : row.jumlah_liter_solar && row.jumlah_liter_solar > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-amber-700 font-bold bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                              <Fuel className="w-2.5 h-2.5 inline text-amber-600" />
                              {row.jumlah_liter_solar.toLocaleString('id-ID')} L
                            </span>
                          ) : (
                            <span className="text-slate-300 font-medium">-</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Kolom 8 [HASIL KERJA]: Volume hasil kerja tebal + satuan */}
                    <td className="py-2.5 px-2 text-right align-top">
                      <div className="text-right">
                        <span className="font-bold text-slate-900 font-mono text-xs block">
                          {row.hasil_kerja.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          {row.satuan}
                        </span>
                      </div>
                    </td>

                    {/* Kolom 9 [AKSI]: Tombol compact Edit & Hapus */}
                    <td className="py-2.5 px-1 text-center align-top">
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
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>

        </table>

        {/* Table Pagination Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="text-slate-500">
            Halaman <span className="font-bold text-slate-800">{currentPage}</span> dari{' '}
            <span className="font-bold text-slate-800">{totalPages}</span> ({filteredActivities.length} data ditampilkan)
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-medium text-slate-700 text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Konfirmasi Hapus Laporan Aktivitas"
        message="Apakah Anda yakin ingin menghapus data laporan aktivitas lapangan ini?"
        itemName={deleteTarget ? `Unit: ${deleteTarget.kode_unit} | Aktivitas: ${deleteTarget.nama_aktivitas} (${deleteTarget.tanggal})` : undefined}
        isDeleting={isDeleting}
      />

    </div>
  );
};
