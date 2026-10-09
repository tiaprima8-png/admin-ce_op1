import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Filter, 
  RotateCcw, 
  FileSpreadsheet, 
  Fuel, 
  Gauge, 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  TrendingUp,
  Layers,
  Wrench,
  CheckCircle
} from 'lucide-react';
import { Unit, UnitAnalyticsRow, AktivitasAnalyticsRow, AnalyticsSummary } from '../types';
import { exportAnalyticsToExcel } from '../utils/export';

interface AnalyticsViewProps {
  units: Unit[];
  supervisors: string[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ units, supervisors }) => {
  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPengawas, setSelectedPengawas] = useState('Semua');
  const [selectedUnit, setSelectedUnit] = useState('Semua');

  // Data States
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Fetch Analytics from Backend API using fast SQL GROUP BY
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedPengawas !== 'Semua') params.append('pengawas', selectedPengawas);
      if (selectedUnit !== 'Semua') params.append('unit', selectedUnit);

      const res = await fetch(`/api/analytics?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Gagal mengambil data rangkuman & analitik');
      }
      const data: AnalyticsSummary = await res.json();
      setAnalyticsData(data);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedPengawas, selectedUnit]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Quick Preset Handlers
  const handlePresetAll = () => {
    setStartDate('');
    setEndDate('');
    setSelectedPengawas('Semua');
    setSelectedUnit('Semua');
  };

  const handlePreset30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  const handlePresetThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(firstDay.toISOString().slice(0, 10));
    setEndDate(now.toISOString().slice(0, 10));
  };

  // Export Excel Handler
  const handleExportExcel = () => {
    if (!analyticsData || analyticsData.unitData.length === 0) {
      setFeedbackNotice('Peringatan: Tidak ada data agregasi yang dapat diekspor.');
      setTimeout(() => setFeedbackNotice(null), 3000);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    exportAnalyticsToExcel(
      analyticsData.unitData,
      analyticsData.aktivitasData,
      analyticsData,
      `rangkuman_analitik_operasional_${today}.xlsx`
    );
    setFeedbackNotice('File Excel Rangkuman & Analitik (.xlsx) berhasil diunduh!');
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const unitData = analyticsData?.unitData || [];
  const aktivitasData = analyticsData?.aktivitasData || [];
  const statusWaktu = analyticsData?.statusWaktu || {
    operasi_count: 0,
    operasi_hours: 0,
    operasi_percent: 0,
    standby_count: 0,
    standby_hours: 0,
    standby_percent: 0,
    breakdown_count: 0,
    breakdown_hours: 0,
    breakdown_percent: 0,
    total_hours: 0
  };

  // Grand totals calculation for table footer
  const totalJamAllUnits = unitData.reduce((acc, u) => acc + u.total_jam_kerja, 0);
  const totalHmAllUnits = analyticsData?.totalHm || unitData.reduce((acc, u) => acc + u.total_hm, 0);
  const totalSolarAllUnits = analyticsData?.totalSolar || unitData.reduce((acc, u) => acc + u.total_solar, 0);
  const totalVolumeAllUnits = unitData.reduce((acc, u) => acc + u.total_volume, 0);
  const totalFreqBreakdownAllUnits = unitData.reduce((acc, u) => acc + u.freq_breakdown_standby, 0);
  const grandRatio = totalHmAllUnits > 0 ? Math.round((totalSolarAllUnits / totalHmAllUnits) * 100) / 100 : 0;

  return (
    <div className="space-y-6">

      {/* Toast Notice */}
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

      {/* TOOLBAR & FILTER PERIODE */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Header Title with Icon */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Rangkuman & Analitik Operasional Fleet
              </h2>
              <p className="text-xs text-slate-500">
                Agregasi konsumsi solar, jam operasi HM, efisiensi unit, dan alokasi aktivitas pekerjaan
              </p>
            </div>
          </div>

          {/* Action Buttons: Refresh & Export Excel Rangkuman */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchAnalytics}
              disabled={isLoading}
              title="Perbarui query data agregasi"
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {/* Tombol Utama Export Excel Rangkuman (.xlsx) Emerald/Hijau */}
            <button
              onClick={handleExportExcel}
              disabled={isLoading || unitData.length === 0}
              title="Unduh rekapitulasi data agregat per unit dan per aktivitas ke Excel (.xlsx)"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 rounded-lg shadow-2xs transition-all cursor-pointer hover:shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Export Excel Rangkuman (.xlsx)</span>
            </button>
          </div>

        </div>

        {/* Filter Controls Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
          
          {/* Rentang Tanggal: Start Date - End Date */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" />
              <span>Periode:</span>
            </div>
            
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Tanggal Awal (Start Date)"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-slate-400 font-bold">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Tanggal Akhir (End Date)"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              type="button"
              onClick={handlePresetThisMonth}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-medium transition-colors cursor-pointer"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={handlePreset30Days}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-medium transition-colors cursor-pointer"
            >
              30 Hari
            </button>
          </div>

          {/* Filter Pengawas */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <select
              value={selectedPengawas}
              onChange={(e) => setSelectedPengawas(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Semua">Pengawas: Semua</option>
              {supervisors.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Filter Unit Alat Berat */}
          <div className="flex items-center gap-1">
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Semua">Unit: Semua Armada</option>
              {units.map((u) => (
                <option key={u.id} value={u.kode_unit}>{u.kode_unit} - {u.jenis_unit}</option>
              ))}
            </select>
          </div>

          {/* Reset Filter Button */}
          {(startDate || endDate || selectedPengawas !== 'Semua' || selectedUnit !== 'Semua') && (
            <button
              type="button"
              onClick={handlePresetAll}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 hover:underline px-2 py-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filter</span>
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500 font-medium">
            Agregasi aktif: <span className="font-bold text-slate-800">{unitData.length}</span> Unit • <span className="font-bold text-slate-800">{aktivitasData.length}</span> Aktivitas
          </div>

        </div>
      </div>

      {/* ERROR NOTICE */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KARTU METRIK UTAMA PERIODE (3 METRIC CARDS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Metric 1: Total Penggunaan Seluruh Solar */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Penggunaan Seluruh Solar
            </span>
            <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Fuel className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalSolarAllUnits.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-sm font-bold text-emerald-700">Liter BBM</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-700">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Akumulasi total pengisian solar seluruh fleet periode terpilih</span>
          </div>
        </div>

        {/* Metric 2: Total Seluruh HM Berjalan */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Seluruh HM Berjalan
            </span>
            <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalHmAllUnits.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-sm font-bold text-slate-600">Hour Meter (HM)</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-700">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Akumulasi total jam operasional seluruh alat berat</span>
          </div>
        </div>

        {/* Metric 3: Rata-rata Rasio Konsumsi Solar (Liter / HM) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Rata-rata Rasio Konsumsi Solar
            </span>
            <div className="h-10 w-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {grandRatio.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-sm font-bold text-amber-700">Liter / HM</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Activity className="w-3.5 h-3.5 text-amber-600" />
            <span>Kalkulasi: Total Liter ({totalSolarAllUnits} L) ÷ Total HM ({totalHmAllUnits} HM)</span>
          </div>
        </div>

      </div>

      {/* PANEL RANGKUMAN STATUS WAKTU KERJA (PROGRESS BAR & BREAKDOWN) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Rangkuman Distribusi Waktu Kerja Operasional Fleet</span>
            </h3>
            <p className="text-xs text-slate-500">
              Perbandingan persentase waktu: Jam Kerja Efektif vs Standby vs Breakdown
            </p>
          </div>
          <div className="text-xs text-slate-600 font-medium">
            Total Jam Shift: <span className="font-bold text-slate-900">{statusWaktu.total_hours} Jam</span>
          </div>
        </div>

        {/* Visual Progress Bar (Multi-Segment) */}
        <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          {/* Segment 1: Operasi Efektif (Hijau Emerald) */}
          <div
            style={{ width: `${Math.max(statusWaktu.operasi_percent, 2)}%` }}
            className="bg-emerald-600 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
            title={`Operasi Efektif: ${statusWaktu.operasi_percent}% (${statusWaktu.operasi_hours}h)`}
          >
            {statusWaktu.operasi_percent > 8 && `${statusWaktu.operasi_percent}%`}
          </div>

          {/* Segment 2: Standby (Amber / Oranye) */}
          <div
            style={{ width: `${Math.max(statusWaktu.standby_percent, statusWaktu.standby_hours > 0 ? 2 : 0)}%` }}
            className="bg-amber-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
            title={`Standby: ${statusWaktu.standby_percent}% (${statusWaktu.standby_hours}h)`}
          >
            {statusWaktu.standby_percent > 8 && `${statusWaktu.standby_percent}%`}
          </div>

          {/* Segment 3: Breakdown (Merah / Rose) */}
          <div
            style={{ width: `${Math.max(statusWaktu.breakdown_percent, statusWaktu.breakdown_hours > 0 ? 2 : 0)}%` }}
            className="bg-rose-600 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
            title={`Breakdown: ${statusWaktu.breakdown_percent}% (${statusWaktu.breakdown_hours}h)`}
          >
            {statusWaktu.breakdown_percent > 8 && `${statusWaktu.breakdown_percent}%`}
          </div>
        </div>

        {/* Status Indicator Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          
          {/* Card Operasi */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
              <div>
                <span className="text-xs font-bold text-emerald-950 block">Jam Operasi Efektif</span>
                <span className="text-[11px] text-emerald-700">{statusWaktu.operasi_count} transaksi laporan</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-emerald-900 block font-mono">{statusWaktu.operasi_hours}h</span>
              <span className="text-[11px] font-bold text-emerald-700">{statusWaktu.operasi_percent}%</span>
            </div>
          </div>

          {/* Card Standby */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <div>
                <span className="text-xs font-bold text-amber-950 block">Jam Unit Standby</span>
                <span className="text-[11px] text-amber-700">{statusWaktu.standby_count} transaksi laporan</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-amber-900 block font-mono">{statusWaktu.standby_hours}h</span>
              <span className="text-[11px] font-bold text-amber-700">{statusWaktu.standby_percent}%</span>
            </div>
          </div>

          {/* Card Breakdown */}
          <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-rose-600"></span>
              <div>
                <span className="text-xs font-bold text-rose-950 block">Jam Unit Breakdown</span>
                <span className="text-[11px] text-rose-700">{statusWaktu.breakdown_count} transaksi laporan</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-rose-900 block font-mono">{statusWaktu.breakdown_hours}h</span>
              <span className="text-[11px] font-bold text-rose-700">{statusWaktu.breakdown_percent}%</span>
            </div>
          </div>

        </div>
      </div>

      {/* PANEL RANGKUMAN PER UNIT (TABEL AGREGASI UNIT) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Panel Rangkuman Per Unit (Agregasi Armada Lapangan)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Rekapitulasi jam kerja, akumulasi HM, konsumsi solar per unit, dan rasio efisiensi pemakaian bahan bakar
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200">
            Total Armada: {unitData.length} Unit
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3.5">Kode Unit & Model Alat</th>
                <th className="py-3 px-3">Pengawas Penanggung Jawab</th>
                <th className="py-3 px-3 text-right">Total Jam Kerja</th>
                <th className="py-3 px-3 text-right font-extrabold text-emerald-800">Total HM Berjalan</th>
                <th className="py-3 px-3 text-right font-extrabold text-slate-900">Pengisian Solar (Liter)</th>
                <th className="py-3 px-3 text-right">Rasio Efisiensi (Liter/HM)</th>
                <th className="py-3 px-3 text-center">Freq Breakdown / Standby</th>
                <th className="py-3 px-3 text-right">Total Volume Hasil Kerja</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Memuat query agregasi analitik per unit...</span>
                  </td>
                </tr>
              ) : unitData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">Tidak ada data unit yang ditemukan pada periode terpilih.</p>
                  </td>
                </tr>
              ) : (
                unitData.map((row, idx) => (
                  <tr key={`${row.kode_unit}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    {/* Kode Unit & Model */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono px-2 py-0.5 bg-slate-100 rounded text-[11px] border border-slate-200">
                          {row.kode_unit}
                        </span>
                        <span className="font-medium text-slate-700">{row.model_unit}</span>
                      </div>
                    </td>

                    {/* Pengawas */}
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800">
                      {row.nama_pengawas}
                    </td>

                    {/* Jam Kerja */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-mono text-slate-600">
                      {row.total_jam_kerja.toFixed(1)}h
                    </td>

                    {/* Total HM Berjalan */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-emerald-800 text-xs">
                      {row.total_hm.toFixed(1)} HM
                    </td>

                    {/* Jumlah Pengisian Solar */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                      {row.total_solar > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">
                          <Fuel className="w-3 h-3 text-emerald-600" />
                          {row.total_solar.toLocaleString('id-ID')} Liter
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">0 Liter</span>
                      )}
                    </td>

                    {/* Rasio Efisiensi (Liter / HM) */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-medium">
                      {row.rasio_efisiensi > 0 ? (
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {row.rasio_efisiensi.toFixed(2)} L/HM
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Frekuensi Breakdown / Standby */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {row.freq_breakdown_standby > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px]">
                          <Wrench className="w-3 h-3" />
                          {row.freq_breakdown_standby} Kali
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Lancar (0)
                        </span>
                      )}
                    </td>

                    {/* Total Volume */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-slate-900">
                      {row.total_volume.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* BARIS TOTAL RINGKASAN (FOOTER TABEL AGREGASI UNIT) */}
            {unitData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                  <td className="py-3 px-3.5 uppercase tracking-wider text-emerald-900" colSpan={2}>
                    TOTAL RINGKASAN ARMADA ({unitData.length} Unit Aktif)
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {totalJamAllUnits.toFixed(1)}h
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-800 text-sm">
                    {totalHmAllUnits.toFixed(1)} HM
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-900 text-sm">
                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded shadow-2xs">
                      {totalSolarAllUnits.toLocaleString('id-ID')} Liter
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-amber-900">
                    {grandRatio.toFixed(2)} L/HM
                  </td>
                  <td className="py-3 px-3 text-center text-rose-800 font-mono">
                    {totalFreqBreakdownAllUnits} Kali
                  </td>
                  <td className="py-3 px-3 text-right text-slate-900 text-sm">
                    {totalVolumeAllUnits.toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* PANEL RANGKUMAN PER AKTIVITAS (TABEL AGREGASI PEKERJAAN) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Panel Rangkuman Per Aktivitas (Agregasi Pekerjaan Lapangan)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Distribusi volume hasil kerja, alokasi total HM per aktivitas, dan jumlah unit yang terlibat
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200">
            Total Aktivitas: {aktivitasData.length} Jenis Pekerjaan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3.5">Nama Aktivitas Lapangan</th>
                <th className="py-3 px-3">Kode SAP</th>
                <th className="py-3 px-3">Satuan</th>
                <th className="py-3 px-3 text-right font-extrabold text-slate-900">Total Akumulasi Volume</th>
                <th className="py-3 px-3 text-right font-extrabold text-emerald-800">Total Alokasi HM</th>
                <th className="py-3 px-3 text-center">Jumlah Unit Terlibat</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Memuat ringkasan aktivitas...</span>
                  </td>
                </tr>
              ) : aktivitasData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <p className="font-medium text-slate-600">Tidak ada data aktivitas pada filter ini.</p>
                  </td>
                </tr>
              ) : (
                aktivitasData.map((act, idx) => (
                  <tr key={`${act.nama_aktivitas}-${act.kode_sap}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    {/* Nama Aktivitas */}
                    <td className="py-3 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                      {act.nama_aktivitas}
                    </td>

                    {/* Kode SAP */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {act.kode_sap}
                      </span>
                    </td>

                    {/* Satuan */}
                    <td className="py-3 px-3 text-slate-600 font-mono whitespace-nowrap">
                      {act.satuan}
                    </td>

                    {/* Total Volume */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-slate-900 font-mono text-xs">
                      {act.total_volume.toLocaleString('id-ID')} {act.satuan}
                    </td>

                    {/* Total Alokasi HM */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-emerald-800 font-mono text-xs">
                      {act.total_hm.toFixed(1)} HM
                    </td>

                    {/* Unit Terlibat */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-semibold text-[11px] border border-slate-200">
                        {act.unit_terlibat} Unit
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
