import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { Unit } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface MasterUnitsProps {
  units: Unit[];
  supervisors: string[];
  onRefresh: () => void;
}

export const MasterUnits: React.FC<MasterUnitsProps> = ({ units, supervisors, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Form State
  const [kodeUnit, setKodeUnit] = useState('');
  const [jenisUnit, setJenisUnit] = useState('DUMP TRUCK');
  const [modelUnit, setModelUnit] = useState('');
  const [namaPengawas, setNamaPengawas] = useState(supervisors[0] || 'Budi Santoso');
  const [hmTerakhir, setHmTerakhir] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingUnit(null);
    setKodeUnit('');
    setJenisUnit('DUMP TRUCK');
    setModelUnit('');
    setNamaPengawas(supervisors[0] || 'Budi Santoso');
    setHmTerakhir(0);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (unit: Unit) => {
    setEditingUnit(unit);
    setKodeUnit(unit.kode_unit);
    setJenisUnit(unit.jenis_unit);
    setModelUnit(unit.model_unit);
    setNamaPengawas(unit.nama_pengawas);
    setHmTerakhir(unit.hm_unit_terakhir_diinputkan);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const url = editingUnit ? `/api/units/${editingUnit.id}` : '/api/units';
      const method = editingUnit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kode_unit: kodeUnit,
          jenis_unit: jenisUnit,
          model_unit: modelUnit,
          nama_pengawas: namaPengawas,
          hm_unit_terakhir_diinputkan: hmTerakhir
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan unit');
      }

      setIsModalOpen(false);
      setFeedbackNotice(editingUnit ? 'Data unit berhasil diperbarui!' : 'Unit baru berhasil didaftarkan!');
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
      const res = await fetch(`/api/units/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus unit');
      }

      const deletedCode = deleteTarget.kode_unit;
      setDeleteTarget(null);
      setFeedbackNotice(`Unit ${deletedCode} berhasil dihapus dari sistem!`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUnits = units.filter(u => 
    u.kode_unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.model_unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.jenis_unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.nama_pengawas.toLowerCase().includes(searchTerm.toLowerCase())
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
            placeholder="Cari kode unit, model, atau pengawas..."
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
          <span>+ Tambah Unit Baru</span>
        </button>
      </div>

      {/* Units Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Kode Unit</th>
                <th className="py-3 px-4">Jenis Unit</th>
                <th className="py-3 px-4">Model / Tipe</th>
                <th className="py-3 px-4">Pengawas Penanggung Jawab</th>
                <th className="py-3 px-4 text-right">HM Unit Terakhir</th>
                <th className="py-3 px-4 text-center">Terakhir Update</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Tidak ada data unit yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-[11px] font-mono border border-slate-200">
                        {unit.kode_unit}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[10px]">
                        {unit.jenis_unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {unit.model_unit}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {unit.nama_pengawas}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      {unit.hm_unit_terakhir_diinputkan.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500 text-[11px]">
                      {unit.updated_at ? unit.updated_at.slice(0, 16) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(unit)}
                          title="Edit data unit"
                          className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(unit)}
                          title="Hapus unit"
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
          Total: <span className="font-bold text-slate-800">{filteredUnits.length}</span> armada alat berat aktif
        </div>
      </div>

      {/* Modal Add / Edit Unit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingUnit ? 'Edit Data Unit Alat Berat' : 'Tambah Unit Alat Berat Baru'}
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
                  Kode Unit <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: DT-101, EX-201"
                  value={kodeUnit}
                  onChange={(e) => setKodeUnit(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono font-bold bg-white"
                />
              </div>

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
                  <option value="DUMP TRUCK">DUMP TRUCK</option>
                  <option value="EXCAVATOR">EXCAVATOR</option>
                  <option value="BULLDOZER">BULLDOZER</option>
                  <option value="MOTOR GRADER">MOTOR GRADER</option>
                  <option value="WATER TRUCK">WATER TRUCK</option>
                  <option value="COMPACTOR">COMPACTOR</option>
                  <option value="WHEEL LOADER">WHEEL LOADER</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Model / Spesifikasi Pabrikan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Komatsu PC200-8, Scania P360"
                  value={modelUnit}
                  onChange={(e) => setModelUnit(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hour Meter (HM) Terakhir
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={hmTerakhir}
                  onChange={(e) => setHmTerakhir(parseFloat(e.target.value) || 0)}
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
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Unit'}
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
        title="Konfirmasi Hapus Unit Alat Berat"
        message="Apakah Anda yakin ingin menghapus unit alat berat ini dari database master?"
        itemName={deleteTarget ? `${deleteTarget.kode_unit} - ${deleteTarget.jenis_unit} (${deleteTarget.model_unit})` : undefined}
        isDeleting={isDeleting}
      />

    </div>
  );
};
