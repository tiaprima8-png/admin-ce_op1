import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { AktivitasUnit } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface MasterAktivitasProps {
  aktivitasList: AktivitasUnit[];
  onRefresh: () => void;
}

export const MasterAktivitas: React.FC<MasterAktivitasProps> = ({ aktivitasList, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAktivitas, setEditingAktivitas] = useState<AktivitasUnit | null>(null);

  // Form State (Hanya: Jenis Unit, Nama Aktivitas Lapangan, Satuan Ukur, dan Kode SAP Akuntansi - TANPA Kategori)
  const [jenisUnit, setJenisUnit] = useState('EXCAVATOR');
  const [namaAktivitas, setNamaAktivitas] = useState('');
  const [satuan, setSatuan] = useState('m3');
  const [kodeSap, setKodeSap] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<AktivitasUnit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingAktivitas(null);
    setJenisUnit('EXCAVATOR');
    setNamaAktivitas('');
    setSatuan('m3');
    setKodeSap(`ACT-SAP-${100 + aktivitasList.length + 1}`);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: AktivitasUnit) => {
    setEditingAktivitas(item);
    setJenisUnit(item.jenis_unit);
    setNamaAktivitas(item.nama_aktivitas);
    setSatuan(item.satuan);
    setKodeSap(item.kode_sap);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const url = editingAktivitas ? `/api/aktivitas/${editingAktivitas.id}` : '/api/aktivitas';
      const method = editingAktivitas ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis_unit: jenisUnit,
          nama_aktivitas: namaAktivitas,
          satuan,
          kode_sap: kodeSap
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan data aktivitas');
      }

      setIsModalOpen(false);
      setFeedbackNotice(editingAktivitas ? 'Data aktivitas berhasil diperbarui!' : 'Aktivitas baru berhasil didaftarkan!');
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
      const res = await fetch(`/api/aktivitas/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus aktivitas');
      }

      const deletedName = deleteTarget.nama_aktivitas;
      setDeleteTarget(null);
      setFeedbackNotice(`Aktivitas ${deletedName} berhasil dihapus dari master data!`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = aktivitasList.filter(a =>
    a.nama_aktivitas.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.kode_sap.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.jenis_unit.toLowerCase().includes(searchTerm.toLowerCase())
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
            placeholder="Cari aktivitas, kode SAP, atau jenis alat..."
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
          <span>+ Tambah Aktivitas & SAP</span>
        </button>
      </div>

      {/* Table (Fokus: Jenis Unit, Nama Aktivitas Lapangan, Satuan Ukur, Kode SAP Akuntansi - TANPA Kategori) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Jenis Unit</th>
                <th className="py-3 px-4">Nama Aktivitas Lapangan</th>
                <th className="py-3 px-4">Satuan Ukur</th>
                <th className="py-3 px-4">Kode SAP Akuntansi</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Tidak ada data aktivitas yang sesuai.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-[11px] border border-slate-200">
                        {item.jenis_unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {item.nama_aktivitas}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-mono">
                      {item.satuan}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {item.kode_sap}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          title="Edit aktivitas"
                          className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          title="Hapus aktivitas"
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
          Total: <span className="font-bold text-slate-800">{filtered.length}</span> jenis aktivitas operasional
        </div>
      </div>

      {/* Modal Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAktivitas ? 'Edit Data Aktivitas' : 'Tambah Aktivitas Baru'}
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
                  Jenis Unit Alat Berat <span className="text-rose-500">*</span>
                </label>
                <select
                  value={jenisUnit}
                  onChange={(e) => setJenisUnit(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer"
                  required
                >
                  <option value="EXCAVATOR">EXCAVATOR</option>
                  <option value="BULLDOZER">BULLDOZER</option>
                  <option value="DUMP TRUCK">DUMP TRUCK</option>
                  <option value="MOTOR GRADER">MOTOR GRADER</option>
                  <option value="WATER TRUCK">WATER TRUCK</option>
                  <option value="COMPACTOR">COMPACTOR</option>
                  <option value="WHEEL LOADER">WHEEL LOADER</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Aktivitas Lapangan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Loading Overburden (OB)"
                  value={namaAktivitas}
                  onChange={(e) => setNamaAktivitas(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Satuan Ukur Volume <span className="text-rose-500">*</span>
                </label>
                <select
                  value={satuan}
                  onChange={(e) => setSatuan(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer"
                  required
                >
                  <option value="m3">m3 (Meter Kubik)</option>
                  <option value="BCM">BCM (Bank Cubic Meter)</option>
                  <option value="m2">m2 (Meter Persegi)</option>
                  <option value="m">m (Meter Panjang)</option>
                  <option value="rit">rit (Ritase Dump Truck)</option>
                  <option value="ton">ton (Metrik Ton)</option>
                  <option value="km">km (Kilometer Grading)</option>
                  <option value="tangki">tangki (Water Truck)</option>
                  <option value="jam">jam (Hour Support)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode SAP Akuntansi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: ACT-SAP-101"
                  value={kodeSap}
                  onChange={(e) => setKodeSap(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                />
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
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Aktivitas'}
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
        title="Konfirmasi Hapus Aktivitas"
        message="Apakah Anda yakin ingin menghapus master aktivitas ini dari sistem?"
        itemName={deleteTarget ? `${deleteTarget.nama_aktivitas} [${deleteTarget.kode_sap}] - Satuan: ${deleteTarget.satuan}` : undefined}
        isDeleting={isDeleting}
      />

    </div>
  );
};
