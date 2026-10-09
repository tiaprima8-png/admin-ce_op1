import React, { useState } from 'react';
import { 
  Radio, 
  Database, 
  LogOut, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle,
  HardHat,
  ChevronDown
} from 'lucide-react';

interface HeaderProps {
  wsStatus: 'connected' | 'connecting' | 'disconnected';
  onOpenBackup: () => void;
  onOpenAndroidSim: () => void;
  onQuickSimulate: () => void;
  isSimulating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  wsStatus,
  onOpenBackup,
  onOpenAndroidSim,
  onQuickSimulate,
  isSimulating
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            {/* Launcher Icon: RKCE */}
            <div 
              className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex flex-col items-center justify-center text-white shadow-sm ring-2 ring-emerald-100 select-none cursor-default"
              title="Launcher Icon: RKCE"
            >
              <span className="font-extrabold text-[13px] tracking-tight leading-none text-white font-sans drop-shadow-xs">
                RKCE
              </span>
              <span className="text-[7px] font-bold text-emerald-200 tracking-tighter leading-none mt-0.5">
                CIVIL
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">
                  RKCE
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Portal Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                RKCE (Rencana Kerja Unit Civil Engineering)
              </p>
            </div>
          </div>

          {/* Center: Live Sync Status Badge */}
          <div className="hidden md:flex items-center">
            {wsStatus === 'connected' ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 shadow-2xs">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                </span>
                <Radio className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-800">
                  Real-Time WebSocket Connected
                </span>
              </div>
            ) : wsStatus === 'connecting' ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-medium text-amber-800">
                  Menghubungkan WebSocket...
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span className="text-xs font-medium text-rose-700">
                  WebSocket Offline (Auto-reconnect aktif)
                </span>
              </div>
            )}
          </div>

          {/* Right Action & Admin Profile */}
          <div className="flex items-center gap-2.5">
            {/* Quick Trigger: Test Send from Android */}
            <button
              onClick={onQuickSimulate}
              disabled={isSimulating}
              title="Kirim 1 paket laporan dummy dari Android untuk uji coba real-time listener"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{isSimulating ? 'Mengirim...' : 'Simulasi Kirim Android'}</span>
            </button>

            {/* Android API & Docs Modal */}
            <button
              onClick={onOpenAndroidSim}
              title="Lihat endpoint sync & dokumentasi Retrofit Android"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">API Sync Android</span>
            </button>

            {/* Backup Database */}
            <button
              onClick={onOpenBackup}
              title="Cadangkan Database Master & Rekapitulasi (JSON/SQL)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden lg:inline">Backup Database</span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative ml-1">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white shadow-2xs transition-colors cursor-pointer"
              >
                <div className="h-7 w-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                  FH
                </div>
                <div className="text-left hidden xl:block">
                  <div className="text-xs font-bold text-slate-900 leading-tight">Farid Hadi</div>
                  <div className="text-[10px] text-emerald-700 font-semibold leading-tight">Super Admin</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showProfileMenu && (
                <div 
                  className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1"
                  onMouseLeave={() => setShowProfileMenu(false)}
                >
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-900">Farid Hadi</p>
                    <p className="text-[11px] text-slate-500">tiaprima8@gmail.com</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-800 rounded">
                      Role: Super Admin
                    </span>
                  </div>
                  
                  <div className="px-1 py-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onOpenBackup();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5 text-slate-400" />
                      Backup Database (JSON / SQL)
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onOpenAndroidSim();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                      Parameter Sync Mobile
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-1 px-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        alert('Anda sedang berada di sesi Super Admin aktif RKCE (Rencana Kerja Unit Civil Engineering).');
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      Keluar Portal
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
