import React from 'react';
import { Gauge, Clock, Truck, FileSpreadsheet, Activity, Fuel } from 'lucide-react';
import { KpiStats } from '../types';

interface KpiCardsProps {
  stats: KpiStats;
  totalMasterUnits: number;
  filteredSolar?: number;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ stats, totalMasterUnits, filteredSolar }) => {
  const solarValue = filteredSolar !== undefined ? filteredSolar : (stats.totalSolarTerpakai || 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
      
      {/* Card 1: Total HM Berjalan */}
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
            {stats.totalHmBerjalan.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span className="text-[11px] font-medium text-slate-500">HM</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Akumulasi jam operasi armada</span>
        </div>
      </div>

      {/* Card 2: Total Jam Kerja */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Jam Kerja
          </span>
          <div className="h-9 w-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Clock className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {stats.totalJamKerja.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span className="text-[11px] font-medium text-slate-500">Jam Shift</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="text-amber-700 font-medium bg-amber-50 px-1 py-0.2 rounded border border-amber-200 text-[10px]">
            Siang: {stats.shiftSiangCount}
          </span>
          <span className="text-indigo-700 font-medium bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200 text-[10px]">
            Malam: {stats.shiftMalamCount}
          </span>
        </div>
      </div>

      {/* Card 3: Total Solar Terpakai (NEW KPI CARD) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow ring-1 ring-emerald-500/10">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Solar Terpakai
          </span>
          <div className="h-9 w-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <Fuel className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-emerald-900 tracking-tight">
            {solarValue.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span className="text-[11px] font-bold text-emerald-700">Liter</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Akumulasi konsumsi BBM solar</span>
        </div>
      </div>

      {/* Card 4: Unit Beroperasi */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Unit Beroperasi
          </span>
          <div className="h-9 w-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Truck className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {stats.unitBeroperasi}
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            / {totalMasterUnits} Unit
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="text-emerald-700 font-medium">
            {totalMasterUnits > 0 ? Math.round((stats.unitBeroperasi / totalMasterUnits) * 100) : 0}% Utilitas Armada
          </span>
        </div>
      </div>

      {/* Card 5: Total Laporan Masuk */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Laporan Masuk
          </span>
          <div className="h-9 w-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <FileSpreadsheet className="w-4.5 h-4.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {stats.totalLaporanMasuk}
          </span>
          <span className="text-[11px] font-medium text-slate-500">Transaksi</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
          <Activity className="w-3.5 h-3.5" />
          <span>Real-time Android Sync</span>
        </div>
      </div>

    </div>
  );
};
