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
  Fuel
} from 'lucide-react';
import { HasilInputAktivitas, Unit, AktivitasUnit, Operator } from '../types';
import { exportToExcel } from '../utils/export';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

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

  // Filter logic (tanpa kategori)
  const filteredActivities = activities.filter((item) => {
    // Search term matching (Pengawas, Unit, SAP, Operator, Aktivitas, Lokasi, SPK)
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

    // Filter Pengawas
    if (selectedPengawas !== 'Semua' && item.nama_pengawas !== selectedPengawas) {
      return false;
    }

    // Filter Unit
    if (selectedUnit !== 'Semua' && item.kode_unit !== selectedUnit) {
      return false;
    }

    // Filter Shift
    if (selectedShift !== 'Semua' && item.shift_kerja !== selectedShift) {
      return false;
    }

    // Filter Status Unit
    if (selectedStatus !== 'Semua' && item.status_unit !== selectedStatus) {
      return false;
    }

    // Filter Date
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

  // Export to Excel (.xlsx) dengan seluruh kolom & filter aktif
  const handleExportExcel = () => {
    if (filteredActivities.length === 0) {
      setFeedbackNotice('Peringatan: Tidak ada data dalam tabel aktif untuk diekspor.');
      setTimeout(() => setFeedbackNotice(null), 3000);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    exportToExcel(filteredActivities, `rekapitulasi_heavytrack_${today}.xlsx`);
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
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{feedbackNotice}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* FILTER & ACTION TOOLBAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Universal Search Bar */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Pengawas, Unit, Kode SAP, Operator, Lokasi..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white placeholder-slate-400"
            />
          </div>

          {/* Action Buttons: Export Excel (.xlsx) & Tambah Data Manual */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Tombol Utama Export Excel (.xlsx) Emerald/Hijau */}
            <button
              onClick={handleExportExcel}
              title="Unduh seluruh data tabel aktif ke file spreadsheet Excel (.xlsx)"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 rounded-lg shadow-2xs transition-all cursor-pointer hover:shadow-xs active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Export Excel (.xlsx)</span>
            </button>

            {/* Tombol Tambah Data Manual */}
            <button
              onClick={onOpenManualModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>+ Tambah Data Manual</span>
            </button>

          </div>

        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-xs">
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
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500"
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

      {/* REALTIME TABLE CONTAINER (TANPA Kolom Kategori) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            
            {/* Table Header */}
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3 text-center min-w-[70px]">Foto Bukti</th>
                <th className="py-3 px-3 text-center min-w-[120px]">Nomor SPK</th>
                <th className="py-3 px-3.5">Pengawas</th>
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Kode Unit</th>
                <th className="py-3 px-3">Nama Aktivitas</th>
                <th className="py-3 px-3">Kode SAP</th>
                <th className="py-3 px-3">Satuan</th>
                <th className="py-3 px-3">Operator (NIK)</th>
                <th className="py-3 px-3">Lokasi</th>
                <th className="py-3 px-3 text-center">Shift</th>
                <th className="py-3 px-3 text-center">Status Unit</th>
                <th className="py-3 px-2 text-right">Jam</th>
                <th className="py-3 px-2 text-right">HM Awal</th>
                <th className="py-3 px-2 text-right">HM Akhir</th>
                <th className="py-3 px-2.5 text-right font-extrabold text-emerald-800">HM Jalan</th>
                <th className="py-3 px-2.5 text-right">Konsumsi Solar</th>
                <th className="py-3 px-2.5 text-right">Hasil</th>
                <th className="py-3 px-3 min-w-[140px]">Keterangan</th>
                <th className="py-3 px-3 text-center sticky right-0 bg-slate-50/95 shadow-xs">Aksi</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedActivities.length === 0 ? (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">Tidak ada data aktivitas yang sesuai dengan kriteria filter.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Gunakan tombol "+ Tambah Data Manual" atau tunggu pengiriman dari aplikasi Android.</p>
                  </td>
                </tr>
              ) : (
                paginatedActivities.map((row) => {
                  const isGlowing = newActivityIds.has(typeof row.id === 'number' ? row.id : parseInt(String(row.id), 10));

                  return (
                    <tr
                      key={row.id}
                      className={`transition-all duration-700 ease-out hover:bg-slate-50/80 ${
                        isGlowing
                          ? 'bg-emerald-100 ring-2 ring-emerald-400 font-medium'
                          : ''
                      }`}
                    >
                      {/* 1. Foto Bukti Column (Thumbnail popup preview) */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center">
                        {row.foto_bukti ? (
                          <button
                            type="button"
                            onClick={() => onViewPhoto(row)}
                            title="Klik untuk memperbesar & meninjau foto bukti lapangan"
                            className="group relative inline-flex p-0.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:ring-2 hover:ring-emerald-200 bg-white shadow-2xs transition-all cursor-pointer overflow-hidden"
                          >
                            <img
                              src={row.foto_bukti}
                              alt={`Bukti ${row.kode_unit}`}
                              className="w-10 h-10 object-cover rounded-md group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-md transition-opacity">
                              <Eye className="w-4 h-4 text-white drop-shadow-sm" />
                            </div>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100/90 px-2 py-1 rounded-md border border-slate-200">
                            <CameraOff className="w-3 h-3 text-slate-400" />
                            Tanpa Foto
                          </span>
                        )}
                      </td>

                      {/* 2. Nomor SPK Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {row.nomor_spk ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                            {row.nomor_spk}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium italic border border-dashed border-slate-200 px-2 py-0.5 rounded">
                            Tanpa SPK
                          </span>
                        )}
                      </td>

                      {/* 3. Pengawas */}
                      <td className="py-3 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isGlowing && (
                            <span className="flex h-2 w-2 relative" title="Baru saja masuk dari Android">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                            </span>
                          )}
                          <span>{row.nama_pengawas}</span>
                        </div>
                      </td>

                      {/* 4. Tanggal */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {row.tanggal}
                      </td>

                      {/* 5. Kode Unit */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200 font-mono">
                          {row.kode_unit}
                        </span>
                      </td>

                      {/* 6. Aktivitas */}
                      <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap max-w-[200px] truncate" title={row.nama_aktivitas}>
                        {row.nama_aktivitas}
                      </td>

                      {/* 7. Kode SAP Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {row.kode_sap}
                        </span>
                      </td>

                      {/* 8. Satuan */}
                      <td className="py-3 px-3 text-slate-600 font-mono whitespace-nowrap">
                        {row.satuan}
                      </td>

                      {/* 9. Operator (NIK) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{row.operator}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{row.nik_operator}</div>
                      </td>

                      {/* 10. Lokasi */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{row.kode_lokasi || row.lokasi}</span>
                        {row.kode_lokasi && row.lokasi && row.kode_lokasi !== row.lokasi && (
                          <span className="text-[10px] text-slate-400 block">{row.lokasi}</span>
                        )}
                      </td>

                      {/* 11. Shift Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {(row.shift_kerja || '').toUpperCase() === 'SIANG' ? (
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Siang
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Malam
                          </span>
                        )}
                      </td>

                      {/* 12. Status Unit Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {(!row.status_unit || row.status_unit === 'OPERASI') && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            OPERASI
                          </span>
                        )}
                        {row.status_unit === 'STANDBY' && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            STANDBY
                          </span>
                        )}
                        {row.status_unit === 'BREAKDOWN' && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            BREAKDOWN
                          </span>
                        )}
                      </td>

                      {/* 13. Jam Kerja */}
                      <td className="py-3 px-2 text-right font-medium text-slate-700 whitespace-nowrap">
                        {row.jam_kerja}h
                      </td>

                      {/* 14. HM Awal */}
                      <td className="py-3 px-2 text-right text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {row.hm_awal.toFixed(1)}
                      </td>

                      {/* 15. HM Akhir */}
                      <td className="py-3 px-2 text-right text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {row.hm_akhir.toFixed(1)}
                      </td>

                      {/* 16. HM Berjalan */}
                      <td className="py-3 px-2.5 text-right font-bold text-emerald-800 font-mono text-xs whitespace-nowrap">
                        {row.hm_harian_berjalan.toFixed(1)}
                      </td>

                      {/* 17. Konsumsi Solar */}
                      <td className="py-3 px-2.5 text-right whitespace-nowrap font-mono text-[11px]">
                        {row.jumlah_liter_solar && row.jumlah_liter_solar > 0 ? (
                          <span className="font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1">
                            <Fuel className="w-3 h-3 text-emerald-600 inline" />
                            {row.jumlah_liter_solar.toLocaleString('id-ID')} L
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold block text-center">-</span>
                        )}
                      </td>

                      {/* 18. Hasil Kerja */}
                      <td className="py-3 px-2.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {row.hasil_kerja.toLocaleString('id-ID')}
                      </td>

                      {/* 19. Keterangan */}
                      <td className="py-3 px-3 text-slate-500 text-[11px] max-w-[160px] truncate" title={row.keterangan}>
                        {row.keterangan || '-'}
                      </td>

                      {/* 20. Aksi (Edit, Hapus) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap sticky right-0 bg-white/95 group-hover:bg-slate-50/95">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onEditActivity(row)}
                            title="Edit baris laporan"
                            className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(row)}
                            title="Hapus baris laporan"
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
        </div>

        {/* Table Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
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
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
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
