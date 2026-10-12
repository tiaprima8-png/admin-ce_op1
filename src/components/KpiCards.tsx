import React from 'react';
import { Gauge, Fuel, Zap, AlertTriangle } from 'lucide-react';
import { HasilInputAktivitas } from '../types';

interface KpiCardsProps {
  filteredActivities: HasilInputAktivitas[];
  filterLabel?: string;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ filteredActivities, filterLabel }) => {
  // 1. Total HM Berjalan (Jam/HM)
  let totalHm = 0;
  // 2. Total Konsumsi Solar (Liter)
  let totalSolar = 0;
  // 4. Unit dengan Kendala (Set of unique unit codes with issues)
  const unitsWithKendala = new Set<string>();

  filteredActivities.forEach((act) => {
    totalHm += act.hm_harian_berjalan || 0;
    totalSolar += act.jumlah_liter_solar || 0;

    // Cek kendala: jika ada status BREAKDOWN atau kendala aktif
    let hasKendala = false;
    const actStatus = (act.kategori_status || act.status_unit || 'OPERASI').toUpperCase();
    if (actStatus === 'BREAKDOWN') {
      hasKendala = true;
    }
    if (act.ada_kendala && Number(act.ada_kendala) === 1) {
      hasKendala = true;
    }
    if (act.kendala_list) {
      if (Array.isArray(act.kendala_list) && act.kendala_list.length > 0) {
        hasKendala = true;
      } else if (typeof act.kendala_list === 'string' && act.kendala_list.trim() !== '' && act.kendala_list !== '[]') {
        hasKendala = true;
      }
    }

    if (hasKendala && act.kode_unit) {
      unitsWithKendala.add(act.kode_unit);
    }
  });

  // 3. Rata-rata Rasio (Liter / HM)
  const averageRatio = totalHm > 0 ? totalSolar / totalHm : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      
      {/* Kartu 1: Total HM Berjalan (Jam) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total HM Berjalan
          </span>
          <div className="h-9 w-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Gauge className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {totalHm.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span className="text-[11px] font-medium text-slate-500">HM / Jam</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>{filterLabel || 'Akumulasi jam operasi armada'}</span>
        </div>
      </div>

      {/* Kartu 2: Total Konsumsi Solar (Liter) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Konsumsi Solar
          </span>
          <div className="h-9 w-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Fuel className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {totalSolar.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span className="text-[11px] font-bold text-amber-700">Liter</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>Akumulasi pemakaian BBM</span>
        </div>
      </div>

      {/* Kartu 3: Rata-rata Rasio (Liter / HM) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Rata-rata Rasio
          </span>
          <div className="h-9 w-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Zap className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-blue-900 tracking-tight">
            {averageRatio.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] font-bold text-blue-700">L / HM</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-700">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          <span>Efisiensi konsumsi BBM solar</span>
        </div>
      </div>

      {/* Kartu 4: Unit dengan Kendala */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Unit dengan Kendala
          </span>
          <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
            unitsWithKendala.size > 0 
              ? 'bg-rose-50 border border-rose-200 text-rose-600' 
              : 'bg-slate-50 border border-slate-200 text-slate-500'
          }`}>
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className={`text-2xl font-extrabold tracking-tight ${
            unitsWithKendala.size > 0 ? 'text-rose-600' : 'text-slate-900'
          }`}>
            {unitsWithKendala.size}
          </span>
          <span className="text-[11px] font-medium text-slate-500">Unit</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px]">
          {unitsWithKendala.size > 0 ? (
            <span className="text-rose-600 font-semibold flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              {unitsWithKendala.size} unit terdampak kendala/breakdown
            </span>
          ) : (
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Seluruh armada beroperasi normal
            </span>
          )}
        </div>
      </div>

    </div>
  );
};

