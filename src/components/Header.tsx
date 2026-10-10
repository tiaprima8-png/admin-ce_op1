import React, { useState, useRef, useEffect } from 'react';
import { 
  Radio, 
  LogOut, 
  AlertCircle,
  ChevronDown,
  Menu,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';

interface AuthUser {
  id: number;
  nama_lengkap: string;
  username: string;
  hak_akses: string;
  email?: string;
}

interface HeaderProps {
  wsStatus: 'connected' | 'connecting' | 'disconnected';
  currentUser: AuthUser | null;
  onLogout: () => void;
  onOpenMobileSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  wsStatus,
  currentUser,
  onLogout,
  onOpenMobileSidebar,
  isSidebarCollapsed
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = currentUser?.nama_lengkap || 'Farid Hadi';
  const displayUsername = currentUser?.username || 'admin';
  const displayEmail = currentUser?.email || `${displayUsername}@rkce.co.id`;
  const displayRole = currentUser?.hak_akses === 'Admin' ? 'Super Admin' : (currentUser?.hak_akses || 'Super Admin');
  const userInitials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('') || 'AD';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-16 shadow-2xs">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between">
        
        {/* Left Side: Mobile Menu Button & Breadcrumb / Page Title */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger button */}
          <button
            onClick={onOpenMobileSidebar}
            title="Buka Menu Navigasi"
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-slate-900">
              Dashboard Operasional
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Fleet Civil Engineering
            </span>
          </div>
        </div>

        {/* Center / Right: WebSocket Indicator & User Profile */}
        <div className="flex items-center gap-4">
          
          {/* 1. Indikator Status Koneksi WebSocket Real-Time */}
          <div className="flex items-center">
            {wsStatus === 'connected' ? (
              <div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 shadow-2xs"
                title="Terkoneksi langsung ke server WebSocket real-time"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
                <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-semibold text-emerald-800 hidden md:inline">
                  Real-Time WebSocket Connected
                </span>
                <span className="text-xs font-semibold text-emerald-800 md:hidden">
                  Connected
                </span>
              </div>
            ) : wsStatus === 'connecting' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-xs font-medium text-amber-800 hidden sm:inline">
                  Menghubungkan WebSocket...
                </span>
                <span className="text-xs font-medium text-amber-800 sm:hidden">
                  Connecting...
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="text-xs font-medium text-rose-700 hidden sm:inline">
                  WebSocket Offline (Auto-reconnect aktif)
                </span>
                <span className="text-xs font-medium text-rose-700 sm:hidden">
                  Offline
                </span>
              </div>
            )}
          </div>

          {/* 2. Menu Profil User di Pojok Kanan Atas */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2.5 p-1.5 pl-2 sm:pl-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
              title="Profil Pengguna & Logout"
            >
              {/* Avatar Initials */}
              <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                {userInitials}
              </div>

              {/* User text */}
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {displayName}
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold leading-tight">
                  {displayRole}
                </div>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {displayName}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate font-mono">
                    {displayEmail}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Role: {displayRole}
                    </span>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="p-1.5">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2.5 transition-colors font-semibold cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Keluar Portal</span>
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
