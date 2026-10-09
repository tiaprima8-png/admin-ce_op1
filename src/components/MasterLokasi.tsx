import React, { useState, useRef } from 'react';
import { 
  MapPin, 
  Search, 
  Filter, 
  RotateCcw, 
  Plus, 
  Edit2, 
  Trash2, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  X,
  FileCheck,
  HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Lokasi } from '../types';

interface MasterLokasiProps {
  lokasiList: Lokasi[];
  onRefresh: () => void;
  onSaveLokasi: (lokasi: Lokasi) => Promise<void>;
  onDeleteLokasi: (kodeLokasi: string) => Promise<void>;
  onBulkImport: (data: Lokasi[]) => Promise<number>;
}

export const MasterLokasi: React.FC<MasterLokasiProps> = ({
  lokasiList,
  onRefresh,
  onSaveLokasi,
  onDeleteLokasi,
  onBulkImport
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWilayah, setFilterWilayah] = useState('Semua');

  // Single CRUD modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKode, setEditingKode] = useState<string | null>(null);
  const [formKodeLokasi, setFormKodeLokasi] = useState('');
  const [formWilayah, setFormWilayah] = useState('');
  const [formLuasBruto, setFormLuasBruto] = useState<string>('0');
  const [formLuasNetto, setFormLuasNetto] = useState<string>('0');
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Lokasi | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Excel Import Preview Modal State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewData, setPreviewData] = useState<Lokasi[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Notification
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Unique Wilayah list for filter dropdown
  const wilayahOptions = Array.from(new Set(lokasiList.map(l => l.wilayah).filter(Boolean)));

  // Filtered List
  const filteredList = lokasiList.filter(item => {
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const match = 
        item.kode_lokasi.toLowerCase().includes(q) ||
        item.wilayah.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterWilayah !== 'Semua' && item.wilayah !== filterWilayah) {
      return false;
    }
    return true;
  });

  const resetFilters = () => {
    setSearchTerm('');
    setFilterWilayah('Semua');
  };

  // Open Create/Edit modal
  const handleOpenModal = (item?: Lokasi) => {
    if (item) {
      setEditingKode(item.kode_lokasi);
      setFormKodeLokasi(item.kode_lokasi);
      setFormWilayah(item.wilayah);
      setFormLuasBruto(item.luas_bruto.toString());
      setFormLuasNetto(item.luas_netto.toString());
    } else {
      setEditingKode(null);
      setFormKodeLokasi('');
      setFormWilayah('PG1');
      setFormLuasBruto('10.0');
      setFormLuasNetto('8.5');
    }
    setIsModalOpen(true);
  };

  // Submit Single Form
  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKodeLokasi.trim() || !formWilayah.trim()) {
      alert('Kode Lokasi dan Wilayah wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveLokasi({
        kode_lokasi: formKodeLokasi.trim().toUpperCase(),
        wilayah: formWilayah.trim().toUpperCase(),
        luas_bruto: parseFloat(formLuasBruto) || 0,
        luas_netto: parseFloat(formLuasNetto) || 0
      });
      setIsModalOpen(false);
      setFeedbackNotice(`Data lokasi ${formKodeLokasi.trim().toUpperCase()} berhasil disimpan.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal menyimpan data lokasi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete submit
  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDeleteLokasi(deleteTarget.kode_lokasi);
      setFeedbackNotice(`Lokasi ${deleteTarget.kode_lokasi} berhasil dihapus.`);
      setDeleteTarget(null);
      setTimeout(() => setFeedbackNotice(null), 3500);
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal menghapus lokasi.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Download Excel Template
  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        'lokasi': '001A',
        'wilayah': 'PG1',
        'luas bruto': 12.50,
        'luas netto': 10.80
      },
      {
        'lokasi': '002B',
        'wilayah': 'PG1',
        'luas bruto': 15.00,
        'luas netto': 13.20
      },
      {
        'lokasi': '003A',
        'wilayah': 'PG2',
        'luas bruto': 8.40,
        'luas netto': 7.50
      },
      {
        'lokasi': '100A',
        'wilayah': 'PG3',
        'luas bruto': 30.50,
        'luas netto': 27.00
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    worksheet['!cols'] = [
      { wch: 15 }, // lokasi
      { wch: 15 }, // wilayah
      { wch: 16 }, // luas bruto
      { wch: 16 }  // luas netto
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Lokasi Template');
    XLSX.writeFile(workbook, 'template_master_lokasi.xlsx');
  };

  // Handle Excel File Upload & Client Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonRows.length === 0) {
          setParseError('File Excel tidak memiliki baris data.');
          return;
        }

        // Standardize column names
        const parsedLokasiList: Lokasi[] = [];
        for (const row of jsonRows) {
          // Find kode lokasi
          const kode = (
            row['lokasi'] || 
            row['Lokasi'] || 
            row['kode_lokasi'] || 
            row['Kode Lokasi'] || 
            row['kode'] || 
            row['Kode'] || ''
          ).toString().trim().toUpperCase();

          // Find wilayah
          const wilayah = (
            row['wilayah'] || 
            row['Wilayah'] || 
            row['wilayah_kerja'] || 
            row['PG'] || 'PG1'
          ).toString().trim().toUpperCase();

          // Find luas bruto
          const bruto = parseFloat(
            String(row['luas bruto'] || row['Luas Bruto'] || row['luas_bruto'] || row['bruto'] || 0)
          ) || 0;

          // Find luas netto
          const netto = parseFloat(
            String(row['luas netto'] || row['Luas Netto'] || row['luas_netto'] || row['netto'] || 0)
          ) || 0;

          if (kode) {
            parsedLokasiList.push({
              kode_lokasi: kode,
              wilayah: wilayah || 'PG1',
              luas_bruto: bruto,
              luas_netto: netto
            });
          }
        }

        if (parsedLokasiList.length === 0) {
          setParseError('Tidak ditemukan kolom "lokasi" atau "kode_lokasi" yang valid di dalam file.');
          return;
        }

        setPreviewData(parsedLokasiList);
        setIsPreviewOpen(true);
      } catch (err: unknown) {
        setParseError(`Gagal membaca file Excel: ${(err as Error).message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Confirm Bulk Save
  const handleConfirmImport = async () => {
    if (previewData.length === 0) return;
    setIsImporting(true);
    try {
      const importedCount = await onBulkImport(previewData);
      setIsPreviewOpen(false);
      setPreviewData([]);
      setFeedbackNotice(`Berhasil mengimpor & memperbarui ${importedCount} lokasi ke database.`);
      setTimeout(() => setFeedbackNotice(null), 4000);
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal menyimpan bulk import ke server.');
    } finally {
      setIsImporting(false);
    }
  };

  // Summary Metrics
  const totalLokasi = lokasiList.length;
  const totalLuasBruto = Math.round(lokasiList.reduce((acc, l) => acc + (l.luas_bruto || 0), 0) * 10) / 10;
  const totalLuasNetto = Math.round(lokasiList.reduce((acc, l) => acc + (l.luas_netto || 0), 0) * 10) / 10;

  return (
    <div className="space-y-6">

      {/* Toast Notice */}
      {feedbackNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackNotice}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* Parse Error Notice */}
      {parseError && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{parseError}</span>
          </div>
          <button onClick={() => setParseError(null)} className="text-rose-700 hover:text-rose-900 text-xs cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* Mini KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Titik Lokasi</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">{totalLokasi} Titik</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Akumulasi Luas Bruto</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">{totalLuasBruto} Ha</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
            <span className="font-bold text-xs font-mono">GROSS</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Akumulasi Luas Netto</div>
            <div className="text-xl font-extrabold text-emerald-800 mt-0.5">{totalLuasNetto} Ha</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
            <span className="font-bold text-xs font-mono">NET</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR CONTROLS */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Header Title with Icon */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Data Master Lokasi Operasional
              </h2>
              <p className="text-xs text-slate-500">
                Manajemen data titik lokasi kerja tambang & import massal via Excel (.xlsx / .csv)
              </p>
            </div>
          </div>

          {/* Action Buttons: Import, Template, Add */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Download Template Excel */}
            <button
              onClick={handleDownloadTemplate}
              title="Unduh format file Excel (.xlsx) untuk acuan pengisian data lokasi"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download Template Excel</span>
            </button>

            {/* Hidden Input for File Pick */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />

            {/* Import Excel Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload file Excel (.xlsx) dengan kolom: lokasi, wilayah, luas bruto, luas netto"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Excel (.xlsx)</span>
            </button>

            {/* Add Single Manual */}
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Lokasi</span>
            </button>

          </div>

        </div>

        {/* Filter Controls Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-xs">
          
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari kode lokasi atau wilayah..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
            />
          </div>

          <select
            value={filterWilayah}
            onChange={(e) => setFilterWilayah(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
          >
            <option value="Semua">Wilayah: Semua</option>
            {wilayahOptions.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          {(searchTerm || filterWilayah !== 'Semua') && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:underline px-2 py-1 rounded cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filter
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500 font-medium">
            Menampilkan <span className="font-bold text-slate-800">{filteredList.length}</span> dari {lokasiList.length} master lokasi
          </div>

        </div>
      </div>

      {/* TABLE MASTER LOKASI */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3.5">No</th>
                <th className="py-3 px-4 font-mono">Kode Lokasi</th>
                <th className="py-3 px-4">Wilayah Operasional</th>
                <th className="py-3 px-4 text-right">Luas Bruto (Ha)</th>
                <th className="py-3 px-4 text-right">Luas Netto (Ha)</th>
                <th className="py-3 px-4 text-center sticky right-0 bg-slate-50/95 shadow-xs">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">Tidak ada data master lokasi yang ditemukan.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Gunakan tombol "Import Excel (.xlsx)" atau "+ Tambah Lokasi" di atas.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((row, idx) => (
                  <tr key={row.kode_lokasi} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5 text-slate-400 font-medium">{idx + 1}</td>
                    
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded text-xs border border-slate-200">
                        {row.kode_lokasi}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px]">
                        {row.wilayah}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-700 whitespace-nowrap">
                      {row.luas_bruto.toFixed(2)} Ha
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                      {row.luas_netto.toFixed(2)} Ha
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-white/95 group-hover:bg-slate-50/95">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenModal(row)}
                          title="Edit lokasi"
                          className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row)}
                          title="Hapus lokasi"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL KONFIRMASI PRATINJAU IMPORT EXCEL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Konfirmasi Pratinjau Data Import Excel
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Periksa pratinjau data lokasi sebelum disimpan secara massal ke database
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-slate-500">Total Baris Terdeteksi: </span>
                <span className="font-bold text-slate-900">{previewData.length} Baris Lokasi</span>
              </div>
              <div>
                <span className="text-slate-500">Total Luas Bruto: </span>
                <span className="font-bold text-slate-900">
                  {Math.round(previewData.reduce((acc, p) => acc + p.luas_bruto, 0) * 10) / 10} Ha
                </span>
              </div>
              <div>
                <span className="text-slate-500">Total Luas Netto: </span>
                <span className="font-bold text-emerald-800">
                  {Math.round(previewData.reduce((acc, p) => acc + p.luas_netto, 0) * 10) / 10} Ha
                </span>
              </div>
            </div>

            {/* Table Preview (Max 8 rows visible with scroll) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Kode Lokasi</th>
                    <th className="py-2.5 px-3">Wilayah</th>
                    <th className="py-2.5 px-3 text-right">Luas Bruto (Ha)</th>
                    <th className="py-2.5 px-3 text-right">Luas Netto (Ha)</th>
                    <th className="py-2.5 px-3 text-center">Status Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {previewData.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{row.kode_lokasi}</td>
                      <td className="py-2 px-3 font-semibold text-blue-700">{row.wilayah}</td>
                      <td className="py-2 px-3 text-right font-mono">{row.luas_bruto.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">{row.luas_netto.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Siap Import
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 50 && (
                <div className="p-2 text-center text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
                  ... dan {previewData.length - 50} baris data lainnya
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Data akan disimpan dengan mekanisme Bulk UPSERT (menimpa kode yang sudah ada).
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isImporting ? 'Menyimpan ke DB...' : `Simpan ${previewData.length} Lokasi ke Database`}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT LOKASI MANUAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingKode ? 'Edit Data Lokasi' : 'Tambah Lokasi Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Definisi titik lokasi operasional armada tambang
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSingle} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kode Lokasi (ID)
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingKode}
                  placeholder="Contoh: 001A, 100A"
                  value={formKodeLokasi}
                  onChange={(e) => setFormKodeLokasi(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold uppercase focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Wilayah Kerja
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PG1, PG2, PG3"
                  value={formWilayah}
                  onChange={(e) => setFormWilayah(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs uppercase font-semibold focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Luas Bruto (Ha)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formLuasBruto}
                    onChange={(e) => setFormLuasBruto(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Luas Netto (Ha)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formLuasNetto}
                    onChange={(e) => setFormLuasNetto(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Lokasi'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL HAPUS LOKASI */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Konfirmasi Hapus</h3>
            </div>
            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus data master lokasi <span className="font-bold text-slate-900">{deleteTarget.kode_lokasi}</span> ({deleteTarget.wilayah})?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
