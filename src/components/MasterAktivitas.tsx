import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Search, AlertCircle, CheckCircle, Power, RotateCcw, Activity } from 'lucide-react';
import { AktivitasUnit } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface MasterAktivitasProps {
  aktivitasList: AktivitasUnit[];
  onRefresh: () => void;
  userRole?: string;
}

export const MasterAktivitas: React.FC<MasterAktivitasProps> = ({ aktivitasList, onRefresh, userRole }) => {
  const isManager = userRole === 'MANAGER';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'Semua' | '1' | '0'>('Semua');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAktivitas, setEditingAktivitas] = useState<AktivitasUnit | null>(null);

  // Form State
  const [jenisUnit, setJenisUnit] = useState('EXCAVATOR');
  const [namaAktivitas, setNamaAktivitas] = useState('');
  const [satuan, setSatuan] = useState('m3');
  const [kodeSap, setKodeSap] = useState('');
  const [kategoriStatus, setKategoriStatus] = useState<'OPERASI' | 'STANDBY' | 'BREAKDOWN'>('OPERASI');
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
    setKategoriStatus('OPERASI');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: AktivitasUnit) => {
    setEditingAktivitas(item);
    setJenisUnit(item.jenis_unit);
    setNamaAktivitas(item.nama_aktivitas);
    setSatuan(item.satuan);
    setKodeSap(item.kode_sap);
    setKategoriStatus(item.kategori_status || item.status_unit || 'OPERASI');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const url = editingAktivitas ? `/api/master-aktivitas/${editingAktivitas.id}` : '/api/master-aktivitas';
      const method = editingAktivitas ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis_unit: jenisUnit,
          nama_aktivitas: namaAktivitas,
          satuan,
          kode_sap: kodeSap,
          kategori_status: kategoriStatus
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

  const handleToggleStatus = async (item: AktivitasUnit) => {
    const nextStatus = (item.status_aktif ?? 1) === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/master-aktivitas/${item.id}/toggle-status`, {
        method: 'PATCH'
      });

      if (!res.ok) {
        await fetch(`/api/aktivitas/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...item,
            status_aktif: nextStatus
          })
        });
      }

      setFeedbackNotice(`Aktivitas "${item.nama_aktivitas}" berhasil di${nextStatus === 1 ? 'aktifkan kembali' : 'nonaktifkan'}!`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/aktivitas/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menonaktifkan aktivitas');
      }

      const deletedName = deleteTarget.nama_aktivitas;
      setDeleteTarget(null);
      setFeedbackNotice(`Aktivitas ${deletedName} berhasil dinonaktifkan (soft delete). Data riwayat laporan tetap tersimpan.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = aktivitasList.filter(a => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      a.nama_aktivitas.toLowerCase().includes(q) ||
      a.kode_sap.toLowerCase().includes(q) ||
      a.jenis_unit.toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (selectedStatus !== 'Semua') {
      const isAktif = (a.status_aktif ?? 1) === 1 ? '1' : '0';
      if (isAktif !== selectedStatus) return false;
    }

    return true;
  });

  const totalAktivitasCount = aktivitasList.length;
  const activeAktivitasCount = aktivitasList.filter(a => (a.status_aktif ?? 1) === 1).length;
  const inactiveAktivitasCount = totalAktivitasCount - activeAktivitasCount;

  return (
    <div className="space-y-4">

      {/* Success Notification */}
      {feedbackNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackNotice}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer font-bold">
            Tutup
          </button>
        </div>
      )}

      {/* Top Stats Cards: TOTAL, AKTIF, NONAKTIF */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Aktivitas</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{totalAktivitasCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Aktivitas Aktif</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{activeAktivitasCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Aktivitas Nonaktif</p>
            <p className="text-xl font-bold text-slate-500 mt-0.5">{inactiveAktivitasCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200">
            <Power className="w-5 h-5" />
          </div>
        </div>
      </div>
      
      {/* Action Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari aktivitas, kode SAP, atau jenis alat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'Semua' | '1' | '0')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 font-medium cursor-pointer"
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
              Reset Filter
            </button>
          )}
        </div>

        {!isManager ? (
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Aktivitas & SAP</span>
          </button>
        ) : (
          <div 
            title="Akun Manager memiliki hak akses Monitoring & Executive View (Read-Only)"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg shadow-2xs select-none"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Master Data (Read-Only)</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Jenis Unit</th>
                <th className="py-3 px-4">Nama Aktivitas Lapangan</th>
                <th className="py-3 px-4 text-center">Kategori Status</th>
                <th className="py-3 px-4">Satuan Ukur</th>
                <th className="py-3 px-4">Kode SAP Akuntansi</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">{isManager ? 'Audit' : 'Aksi'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Tidak ada data aktivitas yang sesuai.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isAktif = (item.status_aktif ?? 1) === 1;
                  const itemKategori = item.kategori_status || item.status_unit || 'OPERASI';
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${!isAktif ? 'bg-slate-50/50 opacity-65' : ''}`}>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-[11px] border border-slate-200">
                          {item.jenis_unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {item.nama_aktivitas}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {itemKategori === 'OPERASI' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            OPERASI
                          </span>
                        )}
                        {itemKategori === 'STANDBY' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            STANDBY
                          </span>
                        )}
                        {itemKategori === 'BREAKDOWN' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            BREAKDOWN
                          </span>
                        )}
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
                        {isAktif ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {!isManager ? (
                          <div className="flex items-center justify-center gap-1">
                            {/* Toggle Aktif / Nonaktif (Ikon Power) */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item)}
                              title={isAktif ? 'Nonaktifkan aktivitas ini' : 'Aktifkan kembali aktivitas ini'}
                              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                                isAktif
                                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200'
                                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit (Pensil) */}
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title="Edit aktivitas"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-slate-200 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Hapus (Tempat Sampah) */}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              title="Hapus aktivitas dari database"
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span 
                            className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 bg-slate-100" 
                            title="Akun Manager: Akses Monitoring Read-Only"
                          >
                            Read-Only
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
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex justify-between items-center">
          <span>Total: <strong className="text-slate-800">{filtered.length}</strong> jenis aktivitas ditampilkan</span>
          <span className="text-[10px] text-slate-400">Soft Delete Aktif (Riwayat Laporan Terjaga)</span>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kategori Status Operasional <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setKategoriStatus('OPERASI')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      kategoriStatus === 'OPERASI'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${kategoriStatus === 'OPERASI' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                    <span>OPERASI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKategoriStatus('STANDBY')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      kategoriStatus === 'STANDBY'
                        ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${kategoriStatus === 'STANDBY' ? 'bg-white' : 'bg-amber-500'}`}></span>
                    <span>STANDBY</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKategoriStatus('BREAKDOWN')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      kategoriStatus === 'BREAKDOWN'
                        ? 'bg-rose-600 border-rose-600 text-white shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${kategoriStatus === 'BREAKDOWN' ? 'bg-white' : 'bg-rose-500'}`}></span>
                    <span>BREAKDOWN</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Status unit pada Beranda & Analitik akan otomatis disetel mengikuti kategori ini.
                </p>
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
