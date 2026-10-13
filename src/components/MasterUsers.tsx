import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Search, AlertCircle, Shield, CheckCircle, Power, RotateCcw, Users } from 'lucide-react';
import { User, DAFTAR_WILAYAH, getWilayahBadgeClass } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface MasterUsersProps {
  users: User[];
  onRefresh: () => void;
  userRole?: string;
}

export const MasterUsers: React.FC<MasterUsersProps> = ({ users, onRefresh, userRole }) => {
  const isManager = userRole === 'MANAGER';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'Semua' | '1' | '0'>('Semua');
  const [selectedWilayahFilter, setSelectedWilayahFilter] = useState<string>('Semua Wilayah');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form State
  const [namaLengkap, setNamaLengkap] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [wilayah, setWilayah] = useState('Geodesi PG1');
  const [hakAkses, setHakAkses] = useState<'Admin' | 'Kasie' | 'Manager'>('Kasie');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingUser(null);
    setNamaLengkap('');
    setUsername('');
    setPassword('');
    setWilayah('Geodesi PG1');
    setHakAkses('Kasie');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setNamaLengkap(u.nama_lengkap);
    setUsername(u.username);
    setPassword('');
    setWilayah(u.wilayah || (u.role === 'SUPER_ADMIN' || u.role === 'MANAGER' ? 'Semua Wilayah' : 'Geodesi PG1'));
    setHakAkses(
      u.role === 'MANAGER' || u.hak_akses?.toLowerCase() === 'manager' 
        ? 'Manager' 
        : (u.hak_akses === 'Admin' ? 'Admin' : 'Kasie')
    );
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const resolvedRole = hakAkses === 'Manager' ? 'MANAGER' : (hakAkses === 'Admin' ? 'SUPER_ADMIN' : 'SUPERVISOR');
      const payload: Record<string, string> = {
        nama_lengkap: namaLengkap,
        username,
        hak_akses: hakAkses,
        role: resolvedRole,
        wilayah: wilayah || (resolvedRole === 'SUPER_ADMIN' || resolvedRole === 'MANAGER' ? 'Semua Wilayah' : 'Geodesi PG1')
      };
      if (password) {
        payload.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan data pengguna');
      }

      setIsModalOpen(false);
      setFeedbackNotice(editingUser ? 'Data pengguna berhasil diperbarui!' : 'Pengguna baru berhasil ditambahkan!');
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (u: User) => {
    if (u.username === 'admin') {
      setFeedbackNotice('Perhatian: Akun Super Admin utama tidak boleh dinonaktifkan demi integritas sistem.');
      setTimeout(() => setFeedbackNotice(null), 3500);
      return;
    }

    const nextStatus = (u.status_aktif ?? 1) === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/master-user/${u.id}/toggle-status`, {
        method: 'PATCH'
      });

      if (!res.ok) {
        await fetch(`/api/users/${u.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...u,
            status_aktif: nextStatus
          })
        });
      }

      setFeedbackNotice(`Status akun @${u.username} (${u.nama_lengkap}) berhasil di${nextStatus === 1 ? 'aktifkan kembali' : 'nonaktifkan'}!`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleDeleteClick = (u: User) => {
    if (u.username === 'admin') {
      setFeedbackNotice('Perhatian: Akun Super Admin utama tidak dapat dihapus demi keamanan sistem.');
      setTimeout(() => setFeedbackNotice(null), 4000);
      return;
    }
    setDeleteTarget(u);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus pengguna');
      }

      const deletedName = deleteTarget.nama_lengkap;
      setDeleteTarget(null);
      setFeedbackNotice(`Akun ${deletedName} berhasil dihapus dari sistem!`);
      setTimeout(() => setFeedbackNotice(null), 3500);
      onRefresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = users.filter(u => {
    const q = searchTerm.toLowerCase();
    const match =
      u.nama_lengkap.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.wilayah && u.wilayah.toLowerCase().includes(q)) ||
      u.hak_akses.toLowerCase().includes(q);

    if (!match) return false;

    if (selectedStatus !== 'Semua') {
      const isAktif = (u.status_aktif ?? 1) === 1 ? '1' : '0';
      if (isAktif !== selectedStatus) return false;
    }

    if (selectedWilayahFilter !== 'Semua Wilayah') {
      const uWil = (u.wilayah || '').trim().toUpperCase();
      const targetWil = selectedWilayahFilter.trim().toUpperCase();
      if (uWil !== targetWil) return false;
    }

    return true;
  });

  const totalUsersCount = users.length;
  const activeUsersCount = users.filter(u => (u.status_aktif ?? 1) === 1).length;
  const inactiveUsersCount = totalUsersCount - activeUsersCount;

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

      {/* Top Stats Cards: TOTAL, AKTIF, NONAKTIF */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Pengguna</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{totalUsersCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pengguna Aktif</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{activeUsersCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pengguna Nonaktif</p>
            <p className="text-xl font-bold text-slate-500 mt-0.5">{inactiveUsersCount}</p>
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
              placeholder="Cari nama lengkap, username, wilayah, atau hak akses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          <select
            value={selectedWilayahFilter}
            onChange={(e) => setSelectedWilayahFilter(e.target.value)}
            title="Filter Berdasarkan Wilayah Kerja"
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 font-medium cursor-pointer"
          >
            <option value="Semua Wilayah">Semua Wilayah</option>
            {DAFTAR_WILAYAH.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'Semua' | '1' | '0')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 font-medium cursor-pointer"
          >
            <option value="Semua">Semua Status</option>
            <option value="1">Hanya Aktif</option>
            <option value="0">Hanya Nonaktif</option>
          </select>

          {(searchTerm || selectedStatus !== 'Semua' || selectedWilayahFilter !== 'Semua Wilayah') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedStatus('Semua');
                setSelectedWilayahFilter('Semua Wilayah');
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
            <span>+ Tambah Akun Pengguna</span>
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

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Nama Lengkap & Wilayah</th>
                <th className="py-3 px-4">Username Akun</th>
                <th className="py-3 px-4">Hak Akses Sistem</th>
                <th className="py-3 px-4 text-center">Wilayah Kerja</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Tidak ada data pengguna yang sesuai.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isAktif = (u.status_aktif ?? 1) === 1;
                  return (
                    <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${!isAktif ? 'bg-slate-50/50 opacity-65' : ''}`}>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{u.nama_lengkap}</span>
                          <span className="text-slate-400 font-bold">•</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border shadow-2xs ${getWilayahBadgeClass(u.wilayah)}`}>
                            {u.wilayah || 'Semua Wilayah'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          @{u.username}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.role === 'MANAGER' || u.hak_akses?.toLowerCase() === 'manager' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200" title="Akses Web: Monitoring Eksekutif">
                            <Shield className="w-3 h-3 text-blue-600" />
                            MANAGER (AKSES WEB)
                          </span>
                        ) : u.hak_akses === 'Admin' || u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200" title="Akses Web: Penuh & Master Data">
                            <Shield className="w-3 h-3 text-emerald-600" />
                            SUPER ADMIN (AKSES WEB)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200" title="Akun lapangan untuk aplikasi mobile Android (Tidak bisa login website)">
                            <Shield className="w-3 h-3 text-amber-600" />
                            KASIE (KHUSUS MOBILE)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border shadow-2xs ${getWilayahBadgeClass(u.wilayah)}`}>
                          {u.wilayah || 'Semua Wilayah'}
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
                              onClick={() => handleToggleStatus(u)}
                              disabled={u.username === 'admin'}
                              title={u.username === 'admin' ? 'Akun Super Admin utama tidak boleh dinonaktifkan' : isAktif ? 'Nonaktifkan akun ini' : 'Aktifkan kembali akun ini'}
                              className={`p-1.5 rounded-md border transition-colors ${
                                u.username === 'admin'
                                  ? 'text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                                  : isAktif
                                    ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 cursor-pointer'
                                    : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 cursor-pointer'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit (Pensil) */}
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              title="Edit akun"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-slate-200 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Hapus (Tempat Sampah) */}
                            {u.username !== 'admin' ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(u)}
                                title="Hapus akun"
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="w-7"></span>
                            )}
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
          <span>Total: <strong className="text-slate-800">{filtered.length}</strong> akun ditampilkan</span>
          <span className="text-[10px] text-slate-400">Proteksi Super Admin Aktif</span>
        </div>
      </div>

      {/* Modal Add / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
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
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Farid Hadi"
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: budi.santoso"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingUser ? 'Kata Sandi Baru (Kosongkan jika tidak diubah)' : 'Kata Sandi *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  placeholder={editingUser ? '••••••••' : 'Minimal 6 karakter'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Wilayah Kerja <span className="text-rose-500">*</span>
                </label>
                <select
                  value={wilayah}
                  onChange={(e) => setWilayah(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer font-medium"
                  required
                >
                  <option value="Semua Wilayah">Semua Wilayah (Super Admin / Manager / Lintas Wilayah)</option>
                  {DAFTAR_WILAYAH.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hak Akses <span className="text-rose-500">*</span>
                </label>
                <select
                  value={hakAkses}
                  onChange={(e) => setHakAkses(e.target.value as 'Admin' | 'Kasie' | 'Manager')}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer"
                  required
                >
                  <option value="Admin">Admin / Super Admin (Akses Penuh Web Portal & Master Data)</option>
                  <option value="Manager">Manager (Monitoring Eksekutif Web Portal - Read Only)</option>
                  <option value="Kasie">Kasie (Khusus Aplikasi Android HeavyTrack Mobile - Tidak Bisa Login Web)</option>
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
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pengguna'}
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
        title="Konfirmasi Hapus Akun Pengguna"
        message="Apakah Anda yakin ingin menghapus akun pengguna ini dari database portal?"
        itemName={deleteTarget ? `${deleteTarget.nama_lengkap} (@${deleteTarget.username}) - Hak Akses: ${deleteTarget.hak_akses}` : undefined}
        isDeleting={isDeleting}
      />

    </div>
  );
};
