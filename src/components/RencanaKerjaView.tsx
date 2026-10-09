import React, { useState } from 'react';
import { 
  FileCheck2, 
  Search, 
  Filter, 
  RotateCcw, 
  Plus, 
  FileEdit, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Sparkles,
  Send,
  Calendar,
  X,
  Building2,
  HardHat,
  Truck,
  UserCheck
} from 'lucide-react';
import { RencanaKerja, Unit, Operator, Lokasi } from '../types';

interface RencanaKerjaViewProps {
  rencanaList: RencanaKerja[];
  units: Unit[];
  operators: Operator[];
  lokasiList: Lokasi[];
  supervisors: string[];
  onRefresh: () => void;
  onTerbitkanSpk: (id: string, nomorSpk: string) => Promise<void>;
  onCreateRencana: (data: Partial<RencanaKerja>) => Promise<void>;
  onDeleteRencana: (id: string) => Promise<void>;
}

export const RencanaKerjaView: React.FC<RencanaKerjaViewProps> = ({
  rencanaList,
  units,
  operators,
  lokasiList,
  supervisors,
  onRefresh,
  onTerbitkanSpk,
  onCreateRencana,
  onDeleteRencana
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPengawas, setFilterPengawas] = useState('Semua');
  const [filterStatusSpk, setFilterStatusSpk] = useState('Semua');
  const [filterTanggal, setFilterTanggal] = useState('');

  // Modals state
  const [spkModalTarget, setSpkModalTarget] = useState<RencanaKerja | null>(null);
  const [spkInputValue, setSpkInputValue] = useState('');
  const [isSubmittingSpk, setIsSubmittingSpk] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RencanaKerja | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // New Rencana form state
  const [formPengawas, setFormPengawas] = useState('');
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [formKodeUnit, setFormKodeUnit] = useState('');
  const [formOperator, setFormOperator] = useState('');
  const [formKodeLokasi, setFormKodeLokasi] = useState('');
  const [formShift, setFormShift] = useState<'SIANG' | 'MALAM'>('SIANG');
  const [formStatusUnit, setFormStatusUnit] = useState<'OPERASI' | 'STANDBY' | 'BREAKDOWN'>('OPERASI');
  const [formNomorSpk, setFormNomorSpk] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');

  // Filtered rows
  const filteredList = rencanaList.filter(item => {
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const match = 
        (item.nama_pengawas || '').toLowerCase().includes(q) ||
        (item.kode_unit || '').toLowerCase().includes(q) ||
        (item.operator || '').toLowerCase().includes(q) ||
        (item.kode_lokasi || '').toLowerCase().includes(q) ||
        (item.wilayah || '').toLowerCase().includes(q) ||
        (item.nomor_spk || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filterPengawas !== 'Semua' && item.nama_pengawas !== filterPengawas) {
      return false;
    }

    if (filterStatusSpk !== 'Semua' && item.status_spk !== filterStatusSpk) {
      return false;
    }

    if (filterTanggal && item.tanggal !== filterTanggal) {
      return false;
    }

    return true;
  });

  const resetFilters = () => {
    setSearchTerm('');
    setFilterPengawas('Semua');
    setFilterStatusSpk('Semua');
    setFilterTanggal('');
  };

  // Open SPK issuance modal
  const handleOpenSpkModal = (rk: RencanaKerja) => {
    setSpkModalTarget(rk);
    setSpkInputValue(rk.nomor_spk || `SPK-${new Date().getFullYear()}-X${Math.floor(100 + Math.random() * 900)}`);
  };

  // Generate automated SPK format
  const handleAutoGenerateSpk = () => {
    const year = new Date().getFullYear();
    const randCode = Math.floor(1000 + Math.random() * 9000);
    setSpkInputValue(`SPK-${year}-CE${randCode}`);
  };

  // Submit SPK
  const handleSubmitSpk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spkModalTarget || !spkInputValue.trim()) return;

    setIsSubmittingSpk(true);
    try {
      await onTerbitkanSpk(spkModalTarget.id, spkInputValue.trim());
      setFeedbackNotice(`Nomor SPK ${spkInputValue.trim()} berhasil diterbitkan dan disinkronkan ke Android pengawas.`);
      setSpkModalTarget(null);
      setTimeout(() => setFeedbackNotice(null), 4000);
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal menerbitkan SPK.');
    } finally {
      setIsSubmittingSpk(false);
    }
  };

  // Create Rencana Kerja submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPengawas || !formKodeUnit || !formOperator || !formKodeLokasi) {
      alert('Lengkapi seluruh field wajib: Pengawas, Unit, Operator, dan Lokasi.');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateRencana({
        nama_pengawas: formPengawas,
        tanggal: formTanggal,
        kode_unit: formKodeUnit,
        operator: formOperator,
        kode_lokasi: formKodeLokasi,
        shift_kerja: formShift,
        status_unit: formStatusUnit,
        nomor_spk: formNomorSpk.trim() || undefined,
        keterangan_rencana: formKeterangan
      });
      setIsCreateModalOpen(false);
      setFeedbackNotice('Rencana kerja berhasil ditambahkan ke sistem.');
      setTimeout(() => setFeedbackNotice(null), 3500);

      // reset form
      setFormNomorSpk('');
      setFormKeterangan('');
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal menyimpan rencana kerja.');
    } finally {
      setIsCreating(false);
    }
  };

  // Delete submit
  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDeleteRencana(deleteTarget.id);
      setFeedbackNotice(`Rencana kerja #${deleteTarget.id} berhasil dihapus.`);
      setDeleteTarget(null);
      setTimeout(() => setFeedbackNotice(null), 3500);
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal menghapus rencana kerja.');
    } finally {
      setIsDeleting(false);
    }
  };

  // KPI Quick Stats for Rencana Kerja
  const totalRencana = rencanaList.length;
  const menungguSpkCount = rencanaList.filter(r => r.status_spk === 'MENUNGGU_SPK').length;
  const spkTerbitCount = rencanaList.filter(r => r.status_spk === 'SPK_TERBIT').length;
  const selesaiCount = rencanaList.filter(r => r.status_spk === 'REALISASI_SELESAI').length;

  return (
    <div className="space-y-6">
      
      {/* Toast Notice */}
      {feedbackNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackNotice}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* Mini KPI Bar for SPK Pipeline */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Rencana Masuk</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">{totalRencana}</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Menunggu SPK Admin</div>
            <div className="text-xl font-extrabold text-amber-900 mt-0.5">{menungguSpkCount}</div>
          </div>
          <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-800">SPK Terbit (Aktif Lapangan)</div>
            <div className="text-xl font-extrabold text-blue-900 mt-0.5">{spkTerbitCount}</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <Send className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Realisasi Selesai (Input OK)</div>
            <div className="text-xl font-extrabold text-emerald-900 mt-0.5">{selesaiCount}</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* TOOLBAR CONTROLS */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Header Title with Icon */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Rencana Kerja & Penerbitan Nomor SPK
              </h2>
              <p className="text-xs text-slate-500">
                Penerbitan Surat Perintah Kerja (SPK) untuk sinkronisasi otomatis ke aplikasi Android pengawas
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              title="Perbarui data rencana kerja"
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Buat Rencana Kerja</span>
            </button>
          </div>

        </div>

        {/* Filter Controls */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-xs">
          
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari pengawas, unit, operator, SPK, lokasi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Filter Pengawas */}
          <select
            value={filterPengawas}
            onChange={(e) => setFilterPengawas(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
          >
            <option value="Semua">Pengawas: Semua</option>
            {supervisors.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Filter Status SPK */}
          <select
            value={filterStatusSpk}
            onChange={(e) => setFilterStatusSpk(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
          >
            <option value="Semua">Status SPK: Semua</option>
            <option value="MENUNGGU_SPK">Menunggu SPK</option>
            <option value="SPK_TERBIT">SPK Terbit</option>
            <option value="REALISASI_SELESAI">Realisasi Selesai</option>
          </select>

          {/* Filter Tanggal */}
          <input
            type="date"
            value={filterTanggal}
            onChange={(e) => setFilterTanggal(e.target.value)}
            title="Filter Tanggal Rencana"
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500"
          />

          {(searchTerm || filterPengawas !== 'Semua' || filterStatusSpk !== 'Semua' || filterTanggal) && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:underline px-2 py-1 rounded cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filter
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500 font-medium">
            Menampilkan <span className="font-bold text-slate-800">{filteredList.length}</span> dari {rencanaList.length} rencana
          </div>

        </div>
      </div>

      {/* TABLE RENCANA KERJA */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3.5">Tanggal</th>
                <th className="py-3 px-3">Pengawas</th>
                <th className="py-3 px-3 text-center">Status Unit</th>
                <th className="py-3 px-3">Unit & Model</th>
                <th className="py-3 px-3">Operator</th>
                <th className="py-3 px-3">Lokasi & Wilayah</th>
                <th className="py-3 px-3 text-center">Shift</th>
                <th className="py-3 px-3 text-center">Nomor SPK</th>
                <th className="py-3 px-3 text-center">Status SPK</th>
                <th className="py-3 px-3 text-center sticky right-0 bg-slate-50/95 shadow-xs">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">Tidak ada rencana kerja yang ditemukan.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Gunakan tombol "+ Buat Rencana Kerja" atau tunggu sinkronisasi dari pengawas Android.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((row) => {
                  const isMenungguSpk = row.status_spk === 'MENUNGGU_SPK';
                  const isSpkTerbit = row.status_spk === 'SPK_TERBIT';
                  const isSelesai = row.status_spk === 'REALISASI_SELESAI';

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Tanggal */}
                      <td className="py-3 px-3.5 font-medium text-slate-800 whitespace-nowrap">
                        {row.tanggal}
                        {row.keterangan_rencana && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={row.keterangan_rencana}>
                            {row.keterangan_rencana}
                          </div>
                        )}
                      </td>

                      {/* Pengawas */}
                      <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {row.nama_pengawas}
                      </td>

                      {/* Status Unit Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {(!row.status_unit || row.status_unit === 'OPERASI') && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            OPERASI
                          </span>
                        )}
                        {row.status_unit === 'STANDBY' && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            STANDBY
                          </span>
                        )}
                        {row.status_unit === 'BREAKDOWN' && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            BREAKDOWN
                          </span>
                        )}
                      </td>

                      {/* Unit & Model */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 text-[11px]">{row.kode_unit}</div>
                        <div className="text-[10px] text-slate-500">{row.model_unit || '-'}</div>
                      </td>

                      {/* Operator */}
                      <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {row.operator}
                      </td>

                      {/* Lokasi & Wilayah */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{row.kode_lokasi}</span>
                        {row.wilayah && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {row.wilayah}
                          </span>
                        )}
                      </td>

                      {/* Shift */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {(row.shift_kerja || '').toUpperCase() === 'SIANG' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            SIANG
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                            MALAM
                          </span>
                        )}
                      </td>

                      {/* Nomor SPK */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {row.nomor_spk ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-300">
                            {row.nomor_spk}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-dashed border-amber-300 font-medium">
                            Belum Terbit
                          </span>
                        )}
                      </td>

                      {/* Status SPK Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isMenungguSpk && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-600" />
                            MENUNGGU SPK
                          </span>
                        )}
                        {isSpkTerbit && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                            <Send className="w-3 h-3 text-blue-600" />
                            SPK TERBIT
                          </span>
                        )}
                        {isSelesai && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            REALISASI SELESAI
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-3 text-center whitespace-nowrap sticky right-0 bg-white/95 group-hover:bg-slate-50/95">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Terbitkan / Edit Nomor SPK */}
                          <button
                            onClick={() => handleOpenSpkModal(row)}
                            title={row.nomor_spk ? 'Ubah / Edit Nomor SPK' : 'Terbitkan Nomor SPK untuk dikirim ke Android'}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                              isMenungguSpk
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <FileEdit className="w-3 h-3" />
                            <span>{row.nomor_spk ? 'Edit SPK' : 'Terbitkan SPK'}</span>
                          </button>

                          {/* Tombol Hapus */}
                          <button
                            onClick={() => setDeleteTarget(row)}
                            title="Hapus Rencana Kerja"
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
      </div>

      {/* MODAL TERBITKAN / EDIT NOMOR SPK */}
      {spkModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {spkModalTarget.nomor_spk ? 'Ubah Nomor SPK' : 'Penerbitan Nomor SPK'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Otomatis sinkron ke form realisasi kerja aplikasi Android pengawas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSpkModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info Box Target Rencana */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Pengawas:</span>
                <span className="font-bold text-slate-800">{spkModalTarget.nama_pengawas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unit & Model:</span>
                <span className="font-mono font-bold text-slate-800">{spkModalTarget.kode_unit} ({spkModalTarget.model_unit || '-'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Operator:</span>
                <span className="font-medium text-slate-800">{spkModalTarget.operator}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lokasi / Shift:</span>
                <span className="font-medium text-slate-800">{spkModalTarget.kode_lokasi} • {spkModalTarget.shift_kerja}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitSpk} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor SPK Resmi
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SPK-2026-X101"
                    value={spkInputValue}
                    onChange={(e) => setSpkInputValue(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAutoGenerateSpk}
                    className="px-2.5 py-2 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Buat kode acak SPK"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Auto</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Format disarankan: SPK-[TAHUN]-[KODE_UNIK]
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSpkModalTarget(null)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSpk || !spkInputValue.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingSpk ? 'Menyimpan & Broadcast...' : 'Terbitkan & Kirim ke Android'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL BUAT RENCANA KERJA MANUAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Tambah Rencana Kerja Fleet
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Jadwalkan unit, operator, dan lokasi operasional untuk pengawas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                {/* Tanggal */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Shift */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shift Kerja</label>
                  <select
                    value={formShift}
                    onChange={(e) => setFormShift(e.target.value as 'SIANG' | 'MALAM')}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="SIANG">Shift Siang</option>
                    <option value="MALAM">Shift Malam</option>
                  </select>
                </div>
              </div>

              {/* Pengawas */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Pengawas</label>
                <select
                  required
                  value={formPengawas}
                  onChange={(e) => setFormPengawas(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Pilih Pengawas --</option>
                  {supervisors.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Unit */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Unit</label>
                  <select
                    required
                    value={formKodeUnit}
                    onChange={(e) => setFormKodeUnit(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                  >
                    <option value="">-- Pilih Unit --</option>
                    {units.map(u => (
                      <option key={u.kode_unit} value={u.kode_unit}>{u.kode_unit} - {u.model_unit}</option>
                    ))}
                  </select>
                </div>

                {/* Status Unit */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Unit</label>
                  <select
                    value={formStatusUnit}
                    onChange={(e) => setFormStatusUnit(e.target.value as 'OPERASI' | 'STANDBY' | 'BREAKDOWN')}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-500 font-bold"
                  >
                    <option value="OPERASI">OPERASI</option>
                    <option value="STANDBY">STANDBY</option>
                    <option value="BREAKDOWN">BREAKDOWN</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Operator */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Operator</label>
                  <select
                    required
                    value={formOperator}
                    onChange={(e) => setFormOperator(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- Pilih Operator --</option>
                    {operators.map(o => (
                      <option key={o.nik} value={o.nama_operator}>{o.nama_operator} ({o.nik})</option>
                    ))}
                  </select>
                </div>

                {/* Lokasi */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Lokasi</label>
                  <select
                    required
                    value={formKodeLokasi}
                    onChange={(e) => setFormKodeLokasi(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- Pilih Lokasi --</option>
                    {lokasiList.map(l => (
                      <option key={l.kode_lokasi} value={l.kode_lokasi}>{l.kode_lokasi} ({l.wilayah})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nomor SPK (Opsional) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor SPK (Opsional - Bisa diterbitkan nanti)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: SPK-2026-X101"
                  value={formNomorSpk}
                  onChange={(e) => setFormNomorSpk(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs uppercase font-mono focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Keterangan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan Rencana</label>
                <textarea
                  rows={2}
                  placeholder="Catatan penugasan atau instruksi khusus..."
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreating ? 'Menyimpan...' : 'Simpan Rencana Kerja'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL HAPUS KONFIRMASI */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Konfirmasi Hapus</h3>
            </div>
            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus rencana kerja untuk unit <span className="font-bold text-slate-900">{deleteTarget.kode_unit}</span> ({deleteTarget.nama_pengawas})? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
