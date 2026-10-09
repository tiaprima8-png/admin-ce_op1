import React, { useState } from 'react';
import { X, Smartphone, Copy, Check, Terminal, Play, CheckCircle2 } from 'lucide-react';

interface AndroidIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendSimulation: () => void;
  isSimulating: boolean;
}

export const AndroidIntegrationModal: React.FC<AndroidIntegrationModalProps> = ({
  isOpen,
  onClose,
  onSendSimulation,
  isSimulating
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testPengawas, setTestPengawas] = useState('Budi Santoso');
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [isLoadingSync, setIsLoadingSync] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestMasterSync = async () => {
    setIsLoadingSync(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/master-data?pengawas=${encodeURIComponent(testPengawas)}`);
      const data = await res.json();
      setSyncResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setSyncResult(JSON.stringify({ error: (e as Error).message }, null, 2));
    } finally {
      setIsLoadingSync(false);
    }
  };

  const retrofitCode = `// HeavyTrack Mobile - Android Retrofit Interface (Supports JSON Base64 & Multipart)
interface HeavyTrackApiService {
    @GET("api/master-data")
    suspend fun getMasterData(
        @Query("pengawas") namaPengawas: String
    ): Response<MasterDataResponse>

    // 1. Kirim Laporan dengan Foto Base64
    @POST("api/aktivitas-unit")
    suspend fun submitAktivitas(
        @Body request: AktivitasRequest // Berisi field foto_bukti: "data:image/jpeg;base64,..."
    ): Response<AktivitasResponse>

    // 2. Alternatif Kirim Laporan via Multipart / Form-Data File Asli
    @Multipart
    @POST("api/aktivitas-unit")
    suspend fun submitAktivitasMultipart(
        @PartMap params: Map<String, RequestBody>,
        @Part fotoBukti: MultipartBody.Part?
    ): Response<AktivitasResponse>
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Integrasi REST API Aplikasi "HeavyTrack Mobile"
              </h3>
              <p className="text-xs text-slate-500">
                Spesifikasi endpoint komunikasi Android di lapangan (Offline-first sync & push report)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Action Simulation Card */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-emerald-700" />
                Uji Coba Pengiriman Data Lapangan (Simulator Real-Time)
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Kirim 1 laporan transaksi Android secara acak. Anda akan mendengar notifikasi Web Audio dan melihat highlight hijau zamrud di tabel.
              </p>
            </div>
            <button
              onClick={onSendSimulation}
              disabled={isSimulating}
              className="shrink-0 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              {isSimulating ? 'Mengirim Data...' : 'Kirim Sekarang 🚀'}
            </button>
          </div>

          {/* Section 1: GET /api/master-data */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-mono text-[11px] rounded font-bold">GET</span>
                <span className="font-mono text-xs text-slate-800">/api/master-data?pengawas=:nama</span>
              </h4>
              <button
                onClick={() => copyToClipboard('GET /api/master-data?pengawas=Budi Santoso', 'get_endpoint')}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'get_endpoint' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>Salin URL</span>
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-2">
              Digunakan aplikasi Android saat supervisor login atau menekan "Sync Master Data" untuk mengambil unit, operator, dan kode SAP aktivitas.
            </p>

            <div className="flex gap-2 mb-2">
              <select
                value={testPengawas}
                onChange={e => setTestPengawas(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
              >
                <option value="Budi Santoso">Budi Santoso</option>
                <option value="Agus Wijaya">Agus Wijaya</option>
                <option value="Rudi Hermawan">Rudi Hermawan</option>
                <option value="Semua">Semua Pengawas</option>
              </select>
              <button
                onClick={handleTestMasterSync}
                disabled={isLoadingSync}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300"
              >
                {isLoadingSync ? 'Menguji...' : 'Uji Response API'}
              </button>
            </div>

            {syncResult && (
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48">
                {syncResult}
              </pre>
            )}
          </div>

          {/* Section 2: POST /api/aktivitas-unit */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-mono text-[11px] rounded font-bold">POST</span>
                <span className="font-mono text-xs text-slate-800">/api/aktivitas-unit</span>
              </h4>
            </div>
            <p className="text-xs text-slate-600 mb-2">
              Mengirim laporan aktivitas kerja harian unit. Server mengeksekusi transaksi atomik (simpan laporan, update HM unit terakhir, broadcast WebSocket).
            </p>

            <div className="bg-slate-900 rounded-lg p-3 text-slate-100 font-mono text-[11px] overflow-x-auto">
              <pre>{`{
  "nama_pengawas": "Budi Santoso",
  "tanggal": "2026-10-08",
  "kode_unit": "HEH1",
  "nama_aktivitas": "Loading Overburden (OB)",
  "kode_sap": "ACT-SAP-102",
  "satuan": "BCM",
  "operator": "Hendri Kurniawan",
  "nik_operator": "NIK-94822",
  "lokasi": "Pit Utara Blok C",
  "shift_kerja": "Siang",
  "status_unit": "OPERASI",
  "is_isi_solar": 1,
  "jumlah_liter_solar": 185.0,
  "jam_kerja": 10.5,
  "hm_awal": 8910.0,
  "hm_akhir": 8920.4,
  "hm_harian_berjalan": 10.4,
  "hasil_kerja": 1450,
  "keterangan": "Operasi lancar, material mudstone",
  "foto_bukti": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}`}</pre>
            </div>
          </div>

          {/* Section 3: Android Retrofit Code */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2">
              <Terminal className="w-4 h-4 text-slate-500" />
              Kode Snippet Android Kotlin (Retrofit)
            </h4>
            <pre className="p-3 bg-slate-800 text-emerald-400 rounded-lg text-[11px] font-mono overflow-x-auto">
              {retrofitCode}
            </pre>
          </div>

        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            Selesai
          </button>
        </div>

      </div>
    </div>
  );
};
