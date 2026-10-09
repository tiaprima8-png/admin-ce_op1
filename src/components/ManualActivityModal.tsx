import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, AlertCircle, Upload, Trash2, Camera, Calculator, Eye, Fuel } from 'lucide-react';
import { Unit, AktivitasUnit, Operator, UnitStatus } from '../types';
import { SearchableSelect } from './SearchableSelect';

interface ManualActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  units: Unit[];
  aktivitasList: AktivitasUnit[];
  operators: Operator[];
  supervisors: string[];
  onSubmitSuccess: () => void;
}

export const ManualActivityModal: React.FC<ManualActivityModalProps> = ({
  isOpen,
  onClose,
  units,
  aktivitasList,
  operators,
  supervisors,
  onSubmitSuccess
}) => {
  const [namaPengawas, setNamaPengawas] = useState(supervisors[0] || 'Budi Santoso');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [kodeUnit, setKodeUnit] = useState(units[0]?.kode_unit || '');
  const [statusUnit, setStatusUnit] = useState<UnitStatus>('OPERASI');
  const [isIsiSolar, setIsIsiSolar] = useState<boolean>(false);
  const [jumlahLiterSolar, setJumlahLiterSolar] = useState<number>(0);
  const [namaAktivitas, setNamaAktivitas] = useState(aktivitasList[0]?.nama_aktivitas || '');
  const [kodeSap, setKodeSap] = useState(aktivitasList[0]?.kode_sap || 'ACT-SAP-101');
  const [satuan, setSatuan] = useState(aktivitasList[0]?.satuan || 'm3');
  const [operatorName, setOperatorName] = useState(operators[0]?.nama_operator || '');
  const [nikOperator, setNikOperator] = useState(operators[0]?.nik || '');
  const [nomorSpk, setNomorSpk] = useState('');
  const [lokasi, setLokasi] = useState('Pit Area Utama');
  const [shiftKerja, setShiftKerja] = useState<'Siang' | 'Malam'>('Siang');
  const [jamKerja, setJamKerja] = useState<number>(10);
  const [hmAwal, setHmAwal] = useState<number>(0);
  const [hmAkhir, setHmAkhir] = useState<number>(0);
  const [hasilKerja, setHasilKerja] = useState<number>(1000);
  const [keterangan, setKeterangan] = useState('');
  const [fotoBukti, setFotoBukti] = useState<string | null>(null);
  const [fotoFileName, setFotoFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or re-sync defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialUnit = units[0];
      if (initialUnit) {
        setKodeUnit(initialUnit.kode_unit);
        setHmAwal(initialUnit.hm_unit_terakhir_diinputkan);
        setHmAkhir(Math.round((initialUnit.hm_unit_terakhir_diinputkan + 9.5) * 10) / 10);
      }
      if (aktivitasList[0]) {
        setNamaAktivitas(aktivitasList[0].nama_aktivitas);
        setKodeSap(aktivitasList[0].kode_sap);
        setSatuan(aktivitasList[0].satuan);
      }
      if (operators[0]) {
        setOperatorName(operators[0].nama_operator);
        setNikOperator(operators[0].nik);
      }
      if (supervisors[0]) {
        setNamaPengawas(supervisors[0]);
      }
      setErrorMessage(null);
    }
  }, [isOpen, units, aktivitasList, operators, supervisors]);

  if (!isOpen) return null;

  // Auto-fill HM Awal when selected Unit changes
  const handleUnitSelect = (newKodeUnit: string, unitObj?: Unit) => {
    setKodeUnit(newKodeUnit);
    if (unitObj) {
      setHmAwal(unitObj.hm_unit_terakhir_diinputkan);
      setHmAkhir(Math.round((unitObj.hm_unit_terakhir_diinputkan + 9.5) * 10) / 10);
      if (unitObj.nama_pengawas) {
        setNamaPengawas(unitObj.nama_pengawas);
      }
    }
  };

  // Auto-fill Kode SAP & Satuan when Aktivitas changes
  const handleAktivitasSelect = (newNamaAktivitas: string, actObj?: AktivitasUnit) => {
    setNamaAktivitas(newNamaAktivitas);
    if (actObj) {
      setKodeSap(actObj.kode_sap);
      setSatuan(actObj.satuan);
    }
  };

  // Auto-fill NIK when Operator changes
  const handleOperatorSelect = (newOperatorName: string, opObj?: Operator) => {
    setOperatorName(newOperatorName);
    if (opObj) {
      setNikOperator(opObj.nik);
    }
  };

  const calculatedHmBerjalan = Math.max(0, Math.round((hmAkhir - hmAwal) * 10) / 10);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match('image/(jpeg|jpg|png|webp)')) {
      setErrorMessage('Format file tidak didukung. Mohon unggah file format .jpg, .jpeg, atau .png.');
      return;
    }

    setErrorMessage(null);
    setFotoFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setFotoBukti(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setFotoBukti(null);
    setFotoFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        nama_pengawas: namaPengawas,
        tanggal,
        kode_unit: kodeUnit,
        nama_aktivitas: namaAktivitas,
        kode_sap: kodeSap,
        satuan,
        operator: operatorName,
        nik_operator: nikOperator,
        lokasi,
        nomor_spk: nomorSpk.trim() || null,
        shift_kerja: shiftKerja,
        jam_kerja: jamKerja,
        hm_awal: hmAwal,
        hm_akhir: hmAkhir,
        hm_harian_berjalan: calculatedHmBerjalan,
        hasil_kerja: hasilKerja,
        keterangan,
        foto_bukti: fotoBukti,
        status_unit: statusUnit,
        is_isi_solar: isIsiSolar ? 1 : 0,
        jumlah_liter_solar: isIsiSolar ? jumlahLiterSolar : 0
      };

      const res = await fetch('/api/aktivitas-unit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menyimpan laporan aktivitas');
      }

      onSubmitSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Input Laporan Aktivitas Manual (Admin)
              </h3>
              <p className="text-xs text-slate-500">
                Formulir input manual terintegrasi dan live broadcast ke sistem
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Pengawas */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pengawas Penanggung Jawab <span className="text-rose-500">*</span>
              </label>
              <select
                value={namaPengawas}
                onChange={(e) => setNamaPengawas(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                required
              >
                {supervisors.map((spv) => (
                  <option key={spv} value={spv}>{spv}</option>
                ))}
              </select>
            </div>

            {/* Tanggal */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Operasi <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                required
              />
            </div>

            {/* Unit Alat Berat (Searchable Selector) */}
            <div className="sm:col-span-2">
              <SearchableSelect<Unit>
                label="Unit Alat Berat"
                placeholder="Cari berdasarkan kode unit atau jenis alat..."
                searchPlaceholder="Ketik kode (DT-101) atau jenis (EXCAVATOR, DUMP TRUCK)..."
                required
                value={kodeUnit}
                onChange={handleUnitSelect}
                options={units}
                getOptionValue={(u) => u.kode_unit}
                getOptionLabel={(u) => `${u.kode_unit} - ${u.jenis_unit} (${u.model_unit})`}
                filterOption={(u, q) =>
                  u.kode_unit.toLowerCase().includes(q) ||
                  u.jenis_unit.toLowerCase().includes(q) ||
                  u.model_unit.toLowerCase().includes(q)
                }
                renderOption={(u) => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono px-1.5 py-0.5 bg-slate-100 rounded text-[11px] border border-slate-200">
                        {u.kode_unit}
                      </span>
                      <span className="text-slate-700 font-medium">{u.model_unit}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        {u.jenis_unit}
                      </span>
                      <span className="text-slate-400 font-mono">HM: {u.hm_unit_terakhir_diinputkan.toFixed(1)}</span>
                    </div>
                  </div>
                )}
                renderSelected={(u) => u ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono px-1.5 py-0.5 bg-slate-100 rounded text-[11px] border border-slate-200 text-slate-900">
                      {u.kode_unit}
                    </span>
                    <span className="text-slate-800 font-semibold">{u.jenis_unit}</span>
                    <span className="text-slate-500 text-[11px]">({u.model_unit})</span>
                  </div>
                ) : null}
              />
            </div>

            {/* Status Operasional Unit (OPERASI / STANDBY / BREAKDOWN) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Status Operasional Unit <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStatusUnit('OPERASI')}
                  className={`py-2 px-3 text-xs rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    statusUnit === 'OPERASI'
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusUnit === 'OPERASI' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                  <span>OPERASI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusUnit('STANDBY')}
                  className={`py-2 px-3 text-xs rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    statusUnit === 'STANDBY'
                      ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusUnit === 'STANDBY' ? 'bg-white' : 'bg-amber-500'}`}></span>
                  <span>STANDBY</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusUnit('BREAKDOWN')}
                  className={`py-2 px-3 text-xs rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    statusUnit === 'BREAKDOWN'
                      ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusUnit === 'BREAKDOWN' ? 'bg-white' : 'bg-rose-500'}`}></span>
                  <span>BREAKDOWN</span>
                </button>
              </div>
            </div>

            {/* Pengisian BBM Solar (Hanya Jumlah Liter) */}
            <div className="sm:col-span-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div>
                    <label htmlFor="manual-isi-solar" className="text-xs font-bold text-slate-900 cursor-pointer">
                      Pengisian BBM Solar Lapangan
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Aktifkan jika unit melakukan pengisian solar pada shift ini
                    </p>
                  </div>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="manual-isi-solar"
                    type="checkbox"
                    checked={isIsiSolar}
                    onChange={(e) => {
                      setIsIsiSolar(e.target.checked);
                      if (!e.target.checked) setJumlahLiterSolar(0);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {isIsiSolar && (
                <div className="pt-2 border-t border-slate-200/80 animate-in fade-in">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Liter Solar <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={jumlahLiterSolar || ''}
                      onChange={(e) => setJumlahLiterSolar(parseFloat(e.target.value) || 0)}
                      placeholder="Masukkan jumlah liter (contoh: 150)"
                      className="w-full text-xs rounded-lg border border-slate-300 p-2.5 pr-14 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white font-mono font-bold text-slate-900"
                      required={isIsiSolar}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      Liter
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Catatan: Masukkan jumlah total liter solar yang diisikan ke tangki unit.
                  </p>
                </div>
              )}
            </div>

            {/* Aktivitas Unit Kerja (Searchable Selector) */}
            <div className="sm:col-span-2">
              <SearchableSelect<AktivitasUnit>
                label="Aktivitas Unit Kerja"
                placeholder="Cari aktivitas atau kode SAP..."
                searchPlaceholder="Ketik nama aktivitas atau kode SAP (ACT-SAP)..."
                required
                value={namaAktivitas}
                onChange={handleAktivitasSelect}
                options={aktivitasList}
                getOptionValue={(a) => a.nama_aktivitas}
                getOptionLabel={(a) => `${a.nama_aktivitas} [${a.kode_sap}]`}
                filterOption={(a, q) =>
                  a.nama_aktivitas.toLowerCase().includes(q) ||
                  a.kode_sap.toLowerCase().includes(q) ||
                  a.jenis_unit.toLowerCase().includes(q)
                }
                renderOption={(a) => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{a.nama_aktivitas}</span>
                      <span className="text-[10px] text-slate-400">({a.jenis_unit})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
                        {a.kode_sap}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">/ {a.satuan}</span>
                    </div>
                  </div>
                )}
                renderSelected={(a) => a ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 font-semibold">{a.nama_aktivitas}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                      {a.kode_sap}
                    </span>
                  </div>
                ) : null}
              />
            </div>

            {/* Kode SAP & Satuan (Auto-synced display) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kode SAP Akuntansi</label>
              <input
                type="text"
                value={kodeSap}
                readOnly
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 bg-slate-50 font-mono font-bold text-emerald-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan Ukur Volume</label>
              <input
                type="text"
                value={satuan}
                readOnly
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 bg-slate-50 font-mono font-bold text-slate-700"
              />
            </div>

            {/* Operator Pelaksana (Searchable Selector) */}
            <div className="sm:col-span-2">
              <SearchableSelect<Operator>
                label="Operator Pelaksana"
                placeholder="Cari berdasarkan nama operator atau NIK..."
                searchPlaceholder="Ketik nama operator atau NIK..."
                required
                value={operatorName}
                onChange={handleOperatorSelect}
                options={operators}
                getOptionValue={(op) => op.nama_operator}
                getOptionLabel={(op) => `${op.nama_operator} (${op.nik})`}
                filterOption={(op, q) =>
                  op.nama_operator.toLowerCase().includes(q) ||
                  op.nik.toLowerCase().includes(q)
                }
                renderOption={(op) => (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{op.nama_operator}</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {op.nik}
                      </span>
                      <span className="text-slate-400 text-[10px]">Penanggung Jawab: {op.nama_pengawas}</span>
                    </div>
                  </div>
                )}
                renderSelected={(op) => op ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 font-semibold">{op.nama_operator}</span>
                    <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
                      {op.nik}
                    </span>
                  </div>
                ) : null}
              />
            </div>

            {/* Nomor SPK (Opsional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor SPK (Opsional)
              </label>
              <input
                type="text"
                value={nomorSpk}
                onChange={(e) => setNomorSpk(e.target.value)}
                placeholder="Contoh: SPK-2026-X101"
                className="w-full text-xs font-mono font-bold uppercase rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
              />
            </div>

            {/* Lokasi Kerja */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lokasi Kerja <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={lokasi}
                onChange={(e) => setLokasi(e.target.value)}
                placeholder="Contoh: Pit Utara Blok C, Disposal Barat"
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                required
              />
            </div>

            {/* Shift Kerja */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shift Kerja <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShiftKerja('Siang')}
                  className={`py-2 px-3 text-xs rounded-lg font-semibold border transition-colors cursor-pointer ${
                    shiftKerja === 'Siang'
                      ? 'bg-amber-100 border-amber-300 text-amber-900 ring-2 ring-amber-400/30'
                      : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Shift Siang
                </button>
                <button
                  type="button"
                  onClick={() => setShiftKerja('Malam')}
                  className={`py-2 px-3 text-xs rounded-lg font-semibold border transition-colors cursor-pointer ${
                    shiftKerja === 'Malam'
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-900 ring-2 ring-indigo-400/30'
                      : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Shift Malam
                </button>
              </div>
            </div>

            {/* Jam Kerja */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Durasi Jam Shift (Jam)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={jamKerja}
                onChange={(e) => setJamKerja(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                required
              />
            </div>

            {/* Hasil Kerja */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hasil Kerja ({satuan})
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={hasilKerja}
                onChange={(e) => setHasilKerja(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white font-mono font-semibold"
                required
              />
            </div>

            {/* HM Awal */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hour Meter (HM) Awal <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={hmAwal}
                onChange={(e) => setHmAwal(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white font-mono"
                required
              />
            </div>

            {/* HM Akhir */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hour Meter (HM) Akhir <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={hmAkhir}
                onChange={(e) => setHmAkhir(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white font-mono"
                required
              />
            </div>

          </div>

          {/* HM Calculation Live Box */}
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-xs font-bold text-emerald-900">HM Harian Berjalan (Otomatis):</span>
                <p className="text-[11px] text-emerald-700">HM Akhir ({hmAkhir}) - HM Awal ({hmAwal})</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-extrabold text-emerald-800 font-mono">
                {calculatedHmBerjalan.toFixed(1)}
              </span>
              <span className="text-xs text-emerald-700 font-semibold ml-1">Jam</span>
            </div>
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan / Keterangan Operasional Lapangan
            </label>
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: Operasi lancar, penggantian blade jam 14:00, jalan kering"
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
            />
          </div>

          {/* Foto Bukti Lapangan Upload Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                Foto Bukti Lapangan (.jpg, .jpeg, .png)
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Opsional</span>
            </label>

            {fotoBukti ? (
              <div className="relative p-3 bg-slate-50 rounded-xl border border-emerald-300 flex items-center gap-4">
                <img
                  src={fotoBukti}
                  alt="Pratinjau Foto"
                  className="w-20 h-20 object-cover rounded-lg border border-slate-200 shadow-xs shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {fotoFileName || 'Foto Bukti Terunggah'}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    ✓ Foto siap disimpan bersama data laporan
                  </p>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus Foto
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/20"
              >
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-700">
                  Klik untuk unggah atau seret file foto ke sini
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Mendukung format JPG, JPEG, PNG (Maks 10MB)
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Laporan Aktivitas'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
