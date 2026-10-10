import React, { useState, useEffect } from 'react';
import { X, Sliders, CheckCircle2, AlertCircle, Clock, ShieldCheck, Smartphone, Info } from 'lucide-react';
import { HmStandarConfig, HmStandarResponse } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHmStandar: HmStandarConfig;
  onSaved: (newStandar: HmStandarConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentHmStandar,
  onSaved
}) => {
  const [hmMin, setHmMin] = useState<string>(currentHmStandar.min.toString());
  const [hmMax, setHmMax] = useState<string>(currentHmStandar.max.toString());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Load latest settings from server whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessNotice(null);

      fetch('/api/settings/hm-standar')
        .then(res => res.json())
        .then((data: HmStandarResponse) => {
          if (data.hm_min_standar !== undefined && data.hm_max_standar !== undefined) {
            setHmMin(data.hm_min_standar.toString());
            setHmMax(data.hm_max_standar.toString());
          }
        })
        .catch(err => {
          console.warn('Gagal memuat setting HM terkini:', err);
          setHmMin(currentHmStandar.min.toString());
          setHmMax(currentHmStandar.max.toString());
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, currentHmStandar]);

  if (!isOpen) return null;

  const minNum = parseFloat(hmMin) || 0;
  const maxNum = parseFloat(hmMax) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const parsedMin = parseFloat(hmMin);
    const parsedMax = parseFloat(hmMax);

    if (isNaN(parsedMin) || isNaN(parsedMax)) {
      setErrorMessage('Harap masukkan angka numerik yang valid untuk standar minimal dan maksimal HM.');
      return;
    }

    if (parsedMin < 0 || parsedMax < 0) {
      setErrorMessage('Batas standar HM tidak boleh bernilai kurang dari 0.');
      return;
    }

    if (parsedMin > parsedMax) {
      setErrorMessage('Standar Minimal HM tidak boleh lebih besar dari Standar Maksimal HM.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/hm-standar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hm_min_standar: parsedMin,
          hm_max_standar: parsedMax
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pengaturan standar HM.');
      }

      const updatedConfig: HmStandarConfig = {
        min: parsedMin,
        max: parsedMax
      };

      setSuccessNotice('Pengaturan standar HM berhasil disimpan dan disinkronkan ke seluruh sistem!');
      onSaved(updatedConfig);

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shadow-2xs">
              <Sliders className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Pengaturan Sistem
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                  Global Policy
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Standar Minimal & Maksimal Hour Meter (HM) per Shift
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center gap-2 shadow-2xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successNotice}</span>
            </div>
          )}

          {/* Info Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Kebijakan Operasional Standar Perusahaan</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Nilai standar ini menjadi acuan operasional normal per shift. Perubahan nilai akan 
              langsung tersimpan di database dan dibroadcast via WebSocket ke aplikasi Android pengawas lapangan secara real-time.
            </p>
          </div>

          {/* Input Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            
            {/* Minimal HM */}
            <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Standar Minimal HM</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={hmMin}
                  onChange={(e) => setHmMin(e.target.value)}
                  placeholder="6.0"
                  disabled={isLoading || isSaving}
                  className="w-full text-base font-bold font-mono text-slate-900 px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 font-mono">
                  HM
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Batas minimal HM normal per shift (Default: 6.0)
              </p>
            </div>

            {/* Maksimal HM */}
            <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Standar Maksimal HM</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={hmMax}
                  onChange={(e) => setHmMax(e.target.value)}
                  placeholder="10.0"
                  disabled={isLoading || isSaving}
                  className="w-full text-base font-bold font-mono text-slate-900 px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 font-mono">
                  HM
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Batas maksimal wajar HM per shift (Default: 10.0)
              </p>
            </div>

          </div>

          {/* Live Mobile Badge Preview */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                Preview Badge Tampilan di Aplikasi Android:
              </span>
              <span className="text-[10px] font-mono text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                Auto Sync
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-emerald-200/70 flex items-center justify-between shadow-2xs">
              <div className="text-[11px] text-slate-600 font-medium">
                Label Form Realisasi Lapangan:
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 font-mono font-bold text-xs border border-emerald-300">
                <Clock className="w-3 h-3 text-emerald-700" />
                <span>Standar: {minNum.toFixed(1)} - {maxNum.toFixed(1)} HM</span>
              </div>
            </div>
          </div>

          {/* Override Note */}
          <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            💡 <strong>Override per Unit:</strong> Jika unit tertentu (misal Genset, Pompa, atau Bulldozer khusus) 
            memerlukan standar jam operasional yang berbeda, Anda dapat mengaturnya secara individual pada menu <strong>MASTER UNIT</strong>.
          </p>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-300 cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Pengaturan HM</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
