import React, { useEffect } from 'react';
import { 
  X, 
  Download, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Truck, 
  HardHat, 
  FileCheck,
  Maximize2,
  ExternalLink
} from 'lucide-react';
import { HasilInputAktivitas } from '../types';

interface PhotoLightboxModalProps {
  activity: HasilInputAktivitas | null;
  onClose: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({ activity, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!activity || !activity.foto_bukti) return null;

  const handleDownload = () => {
    if (!activity.foto_bukti) return;
    const link = document.createElement('a');
    link.href = activity.foto_bukti;
    const ext = activity.foto_bukti.startsWith('data:image/svg') ? 'svg' : 'jpg';
    link.download = `bukti_lapangan_${activity.kode_unit}_${activity.tanggal}_${activity.id}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Container Box */}
      <div className="relative bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-700/60 overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Foto Bukti Lapangan: {activity.kode_unit}
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Terverifikasi Android Mobile
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {activity.nama_aktivitas} • [{activity.kode_sap}]
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              title="Unduh foto bukti lapangan ke perangkat"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/40 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Foto</span>
            </button>
            <button
              onClick={onClose}
              title="Tutup dialog (Esc)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Preview Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center bg-slate-950/50">
          <div className="relative max-w-full flex items-center justify-center rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900">
            <img
              src={activity.foto_bukti}
              alt={`Bukti lapangan ${activity.kode_unit} - ${activity.nama_aktivitas}`}
              className="max-h-[58vh] sm:max-h-[64vh] w-auto object-contain rounded-xl select-none"
            />
          </div>
        </div>

        {/* Metadata Information Banner */}
        <div className="p-4 bg-slate-900 border-t border-slate-800/80 text-xs text-slate-300">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            
            <div className="flex items-start gap-2">
              <Truck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unit & Aktivitas</span>
                <span className="font-semibold text-slate-100">{activity.kode_unit}</span>
                <span className="block text-[11px] text-slate-300 truncate">{activity.nama_aktivitas}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lokasi & Pengawas</span>
                <span className="font-semibold text-slate-100 truncate block">{activity.lokasi}</span>
                <span className="text-[11px] text-emerald-300 font-medium">{activity.nama_pengawas}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Operator Unit</span>
                <span className="font-semibold text-slate-100">{activity.operator}</span>
                <span className="block text-[11px] font-mono text-slate-400">{activity.nik_operator}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Shift & HM Berjalan</span>
                <span className="font-semibold text-slate-100">
                  {activity.shift_kerja} ({activity.jam_kerja} Jam)
                </span>
                <span className="block text-[11px] text-emerald-300 font-bold">
                  {activity.hm_harian_berjalan} HM (Awal: {activity.hm_awal} → Akhir: {activity.hm_akhir})
                </span>
              </div>
            </div>

          </div>

          {activity.keterangan && (
            <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="font-semibold text-slate-300">Catatan Pengawas:</span>
              <span>"{activity.keterangan}"</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
