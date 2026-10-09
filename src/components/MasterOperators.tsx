import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { Operator } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface MasterOperatorsProps {
  operators: Operator[];
  supervisors: string[];
  onRefresh: () => void;
}

export const MasterOperators: React.FC<MasterOperatorsProps> = ({ operators, supervisors, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);

  // Form State (Hanya: Nama Pengawas Penanggung Jawab, Nama Operator, dan NIK)
  const [namaOperator, setNamaOperator] = useState('');
  const [nik, setNik] = useState('');
  const [namaPengawas, setNamaPengawas] = useState(supervisors[0] || 'Budi Santoso');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Operator | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingOperator(null);
    setNamaOperator('');
    setNik(`NIK-${Math.floor(94800 + Math.random() * 200)}`);
    setNamaPengawas(supervisors[0] || 'Budi Santoso');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (op: Operator) => {
    setEditingOperator(op);
    setNamaOperator(op.nama_operator);
    setNik(op.nik);
    setNamaPengawas(op.nama_pengawas);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const url = editingOperator ? `/api/operators/${editingOperator.id}` : '/api/operators';
      const method = editingOperator ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_operator: namaOperator,
          nik,
          nama_pengawas: namaPengawas
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan data operator');
      }

      setIsModalOpen(false);
      setFeedbackNotice(editingOperator ? 'Data operator berhasil diperbarui!' : 'Operator baru berhasil ditambahkan!');
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/operators/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus data operator');
      }

      const deletedName = deleteTarget.nama_operator;
      setDeleteTarget(null);
      setFeedbackNotice(`Operator ${deletedName} berhasil dihapus dari sistem!`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = operators.filter(o =>
    o.nama_operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.nik.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.nama_pengawas.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">

      {/* Success Notification */}
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
      
      {/* Action Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama operator, NIK, atau pengawas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>

        <button
          onClick={openAddModal}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah Operator Baru</span>
        </button>
      </div>

      {/* Table (Hanya: Pengawas Penanggung Jawab, Nama Operator, NIK, dan Aksi) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Nama Operator</th>
                <th className="py-3 px-4">Nomor Induk Karyawan (NIK)</th>
                <th className="py-3 px-4">Pengawas Penanggung Jawab</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400">
                    Tidak ada data operator yang sesuai.
                  </td>
                </tr>
              ) : (
                filtered.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {op.nama_operator}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {op.nik}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {op.nama_pengawas}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(op)}
                          title="Edit operator"
                          className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(op)}
                          title="Hapus operator"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px]">
          Total: <span className="font-bold text-slate-800">{filtered.length}</span> operator terdaftar
        </div>
      </div>

      {/* Modal Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingOperator ? 'Edit Data Operator' : 'Tambah Operator Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              {errorMessage && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Operator <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Joko Susilo"
                  value={namaOperator}
                  onChange={(e) => setNamaOperator(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Induk Karyawan (NIK) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: NIK-94821"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pengawas Penanggung Jawab <span className="text-rose-500">*</span>
                </label>
                <select
                  value={namaPengawas}
                  onChange={(e) => setNamaPengawas(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer"
                  required
                >
                  {supervisors.map(spv => (
                    <option key={spv} value={spv}>{spv}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={executeDelete}
        title="Konfirmasi Hapus Operator"
        message="Apakah Anda yakin ingin menghapus data operator ini dari database master?"
        itemName={deleteTarget ? `${deleteTarget.nama_operator} (${deleteTarget.nik}) - Pengawas: ${deleteTarget.nama_pengawas}` : undefined}
        isDeleting={isDeleting}
      />

    </div>
  );
};
