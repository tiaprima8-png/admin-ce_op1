import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, RotateCw, Image as ImageIcon, Loader2 } from 'lucide-react';
import { HasilInputAktivitas } from '../types';

interface PhotoLightboxModalProps {
  activity: HasilInputAktivitas | null;
  onClose: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({ activity, onClose }) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!activity) {
      setPhotoUrl(null);
      setError(null);
      setZoom(1);
      setRotation(0);
      return;
    }

    setZoom(1);
    setRotation(0);
    setError(null);

    // If activity already has inline photo
    if (activity.foto_bukti && activity.foto_bukti.length > 50) {
      setPhotoUrl(activity.foto_bukti);
      setLoading(false);
      return;
    }

    // Otherwise lazy-fetch from backend endpoint
    let isMounted = true;
    setLoading(true);

    fetch(`/api/rekapitulasi/${activity.id}/foto`)
      .then((res) => {
        if (!res.ok) throw new Error('Gagal mengambil foto');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          if (data?.data?.foto_bukti) {
            setPhotoUrl(data.data.foto_bukti);
          } else {
            setError('Foto bukti tidak tersedia untuk aktivitas ini.');
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Gagal memuat foto');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activity]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (activity) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activity, onClose]);

  if (!activity) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col max-w-4xl w-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 text-white shrink-0">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-emerald-400" />
              <span>Foto Bukti Lapangan</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {activity.kode_unit}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {activity.nama_aktivitas || activity.aktivitas || 'Operasional'} • {activity.tanggal_kerja || activity.tanggal} • {activity.nama_pengawas}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {photoUrl && (
              <>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="Perkecil"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="Perbesar"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  title="Putar"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <a
                  href={photoUrl}
                  download={`bukti-${activity.kode_unit}-${activity.tanggal}.png`}
                  title="Unduh Foto"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </a>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Tutup"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="relative flex-1 flex items-center justify-center p-4 bg-slate-950 overflow-hidden min-h-[360px] max-h-[60vh]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-xs">Memuat foto bukti dari server...</p>
            </div>
          ) : error ? (
            <div className="text-center text-slate-400 px-4">
              <p className="text-sm font-semibold text-rose-400 mb-1">{error}</p>
              <p className="text-xs text-slate-500">Tidak ada file foto tersimpan untuk laporan ini.</p>
            </div>
          ) : photoUrl ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
              <img
                src={photoUrl}
                alt={`Bukti ${activity.kode_unit}`}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-in-out',
                }}
                className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500">Tidak ada foto bukti</p>
          )}
        </div>

        {/* Footer Details */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span><strong className="text-slate-400">Operator:</strong> {activity.operator || '-'}</span>
            <span><strong className="text-slate-400">Lokasi:</strong> {activity.lokasi || '-'}</span>
            <span><strong className="text-slate-400">Shift:</strong> {activity.shift_kerja || '-'}</span>
            {activity.hm_harian_berjalan != null && (
              <span><strong className="text-slate-400">HM Berjalan:</strong> {activity.hm_harian_berjalan} Jam</span>
            )}
            {activity.jumlah_liter_solar != null && Number(activity.jumlah_liter_solar) > 0 && (
              <span><strong className="text-slate-400">Solar:</strong> {activity.jumlah_liter_solar} L</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoLightboxModal;
