import React, { useState } from 'react';
import { X, Database, Download, FileJson, FileCode, CheckCircle2, ShieldCheck } from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = (format: 'json' | 'sql') => {
    setDownloadingFormat(format);
    setSuccessNotice(null);

    const link = document.createElement('a');
    link.href = `/api/backup/export?format=${format}`;
    link.download = `rkce_backup_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadingFormat(null);
      setSuccessNotice(`Database berhasil dicadangkan dalam format .${format.toUpperCase()}`);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Backup Database Master & Rekapitulasi
              </h3>
              <p className="text-xs text-slate-500">
                Penyimpanan cadangan terstruktur RKCE (Rencana Kerja Unit Civil Engineering)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {successNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Cakupan Data yang Dicadangkan:</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
              <li>Tabel <code className="text-emerald-700 font-mono">users</code> (Akun & Hak Akses Pengawas)</li>
              <li>Tabel <code className="text-emerald-700 font-mono">units</code> (Fleet Alat Berat & HM Terakhir)</li>
              <li>Tabel <code className="text-emerald-700 font-mono">aktivitas_unit</code> (Master Aktivitas & Kode SAP)</li>
              <li>Tabel <code className="text-emerald-700 font-mono">operators</code> (Nama & NIK Operator)</li>
              <li>Tabel <code className="text-emerald-700 font-mono">hasil_input_aktivitas</code> (Seluruh Rekapitulasi)</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Format JSON */}
            <div className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all bg-white text-center">
              <FileJson className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-slate-900">Format JSON</h4>
              <p className="text-[11px] text-slate-500 mb-3">
                Cocok untuk integrasi REST API, audit internal, atau migrasi Cloud.
              </p>
              <button
                onClick={() => handleDownload('json')}
                disabled={downloadingFormat !== null}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingFormat === 'json' ? 'Mengunduh...' : 'Unduh JSON'}</span>
              </button>
            </div>

            {/* Format SQL */}
            <div className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all bg-white text-center">
              <FileCode className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-slate-900">Format SQL Dump</h4>
              <p className="text-[11px] text-slate-500 mb-3">
                Skrip SQL DDL & INSERT siap import ke MySQL, PostgreSQL, atau SQLite.
              </p>
              <button
                onClick={() => handleDownload('sql')}
                disabled={downloadingFormat !== null}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingFormat === 'sql' ? 'Mengunduh...' : 'Unduh SQL'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
