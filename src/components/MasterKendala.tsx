import React, { useState } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Search, 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle, 
  Power,
  Clock,
  RotateCcw
} from 'lucide-react';
import { MasterKendala as MasterKendalaType } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface MasterKendalaProps {
  kendalaList: MasterKendalaType[];
  onRefresh: () => void;
}

export const MasterKendala: React.FC<MasterKendalaProps> = ({ kendalaList, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'Semua' | '1' | '0'>('Semua');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKendala, setEditingKendala] = useState<MasterKendalaType | null>(null);

  // Form State
  const [namaKendala, setNamaKendala] = useState('');
  const [statusAktif, setStatusAktif] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<MasterKendalaType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Filtered list
  const filteredList = kendalaList.filter((item) => {
    if (searchTerm.trim() !== '') {
      const match = item.nama_kendala.toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;
    }
    if (selectedStatus !== 'Semua') {
      const statusNum = parseInt(selectedStatus, 10);
      if (item.status_aktif !== statusNum) return false;
    }
    return true;
  });

  const activeCount = kendalaList.filter(k => k.status_aktif === 1).length;
  const inactiveCount = kendalaList.length - activeCount;

  const openAddModal = () => {
    setEditingKendala(null);
    setNamaKendala('');
    setStatusAktif(1);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: MasterKendalaType) => {
    setEditingKendala(item);
    setNamaKendala(item.nama_kendala);
    setStatusAktif(item.status_aktif);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaKendala.trim()) {
      setErrorMessage('Nama kendala operasional wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const url = editingKendala ? `/api/master-kendala/${editingKendala.id}` : '/api/master-kendala';
      const method = editingKendala ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_kendala: namaKendala.trim(),
          status_aktif: statusAktif
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan data kendala');
      }

      setIsModalOpen(false);
      setFeedbackNotice(editingKendala ? 'Data kendala berhasil diperbarui!' : 'Kendala baru berhasil ditambahkan!');
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: MasterKendalaType) => {
    const nextStatus = item.status_aktif === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/master-kendala/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_kendala: item.nama_kendala,
          status_aktif: nextStatus
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memperbarui status kendala');
      }

      setFeedbackNotice(`Kendala "${item.nama_kendala}" berhasil di${nextStatus === 1 ? 'aktifkan' : 'nonaktifkan'}!`);
      setTimeout(() => setFeedbackNotice(null), 3000);
      onRefresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/master-kendala/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus kendala');
      }

      const deletedName = deleteTarget.nama_kendala;
      setDeleteTarget(null);
      setFeedbackNotice(`Kendala "${deletedName}" berhasil dihapus dari master data!`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Toast Notification */}
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

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Kendala</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{kendalaList.length}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Kendala Aktif</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{activeCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Kendala Nonaktif</p>
            <p className="text-xl font-bold text-slate-500 mt-0.5">{inactiveCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200">
            <Power className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filter, & Add Button */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama kendala operasional..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'Semua' | '1' | '0')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 font-medium"
          >
            <option value="Semua">Semua Status</option>
            <option value="1">Hanya Aktif</option>
            <option value="0">Hanya Nonaktif</option>
          </select>

          {(searchTerm || selectedStatus !== 'Semua') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedStatus('Semua');
              }}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:underline px-2 py-1 rounded cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>

        {/* Action Button: Add Kendala */}
        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-all cursor-pointer hover:shadow-xs active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 text-white" />
          <span>Tambah Kendala Baru</span>
        </button>
      </div>

      {/* Main Table: 15 Kendala Standar Operasional Civil Engineering */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              <th className="py-3 px-3 text-center w-12">No</th>
              <th className="py-3 px-3">Nama Kendala Standar Operasional</th>
              <th className="py-3 px-3 text-center w-32">Status</th>
              <th className="py-3 px-3 text-center w-40">Tanggal Dibuat</th>
              <th className="py-3 px-3 text-center w-36">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-medium text-slate-600">Tidak ada kendala yang sesuai kriteria.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Gunakan tombol "+ Tambah Kendala Baru" di atas.</p>
                </td>
              </tr>
            ) : (
              filteredList.map((item, idx) => (
                <tr 
                  key={item.id} 
                  className={`hover:bg-slate-50 transition-colors ${
                    item.status_aktif === 0 ? 'opacity-60 bg-slate-50/50' : ''
                  }`}
                >
                  {/* Nomor Urut */}
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-medium">
                    {idx + 1}
                  </td>

                  {/* Nama Kendala */}
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                      <span>{item.nama_kendala}</span>
                    </div>
                  </td>

                  {/* Status Aktif / Nonaktif */}
                  <td className="py-2.5 px-3 text-center">
                    {item.status_aktif === 1 ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        Nonaktif
                      </span>
                    )}
                  </td>

                  {/* Tanggal Dibuat */}
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                    {item.created_at || '-'}
                  </td>

                  {/* Aksi */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* Toggle Aktif / Nonaktif */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        title={item.status_aktif === 1 ? 'Nonaktifkan kendala ini' : 'Aktifkan kendala ini'}
                        className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                          item.status_aktif === 1
                            ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200'
                            : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        title="Edit nama kendala"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-slate-200 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Hapus */}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        title="Hapus kendala dari database"
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingKendala ? 'Edit Kendala Operasional' : 'Tambah Kendala Operasional Baru'}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Nama Kendala */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Nama Kendala Operasional <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Tunggu Solar, Perbaikan Unit, dll."
                  value={namaKendala}
                  onChange={(e) => setNamaKendala(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400">
                  Nama kendala standar yang akan muncul pada dropdown aplikasi mobile pengawas.
                </p>
              </div>

              {/* Status Aktif */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Status Ketersediaan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusAktif(1)}
                    className={`px-3 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      statusAktif === 1
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Aktif (Sinkron)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusAktif(0)}
                    className={`px-3 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      statusAktif === 0
                        ? 'bg-slate-100 border-slate-400 text-slate-800 ring-1 ring-slate-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5 text-slate-500" />
                    <span>Nonaktif</span>
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Menyimpan...' : (editingKendala ? 'Simpan Perubahan' : 'Tambah Kendala')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        title="Hapus Master Kendala Operasional"
        message={`Apakah Anda yakin ingin menghapus kendala "${deleteTarget?.nama_kendala}" dari master data? Pilihan kendala ini tidak akan lagi tersedia untuk pengawas di lapangan.`}
        isDeleting={isDeleting}
        onConfirm={executeDelete}
        onClose={() => setDeleteTarget(null)}
      />

    </div>
  );
};
