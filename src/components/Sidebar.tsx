import React from 'react';
import { 
  Home, 
  FileCheck2, 
  MapPin, 
  Truck, 
  ListChecks, 
  UserCheck, 
  Users, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight,
  ShieldAlert,
  Clock,
  AlertTriangle,
  Sliders
} from 'lucide-react';

export type ActiveTab = 
  | 'rekapitulasi' 
  | 'rencana' 
  | 'lokasi' 
  | 'units' 
  | 'aktivitas' 
  | 'kendala'
  | 'operators' 
  | 'users' 
  | 'analytics';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  counts: {
    rekapitulasi: number;
    rencana: number;
    pendingSpk: number;
    lokasi: number;
    units: number;
    aktivitas: number;
    kendala: number;
    operators: number;
    users: number;
  };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSettings?: () => void;
  hmStandar?: { min: number; max: number };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  counts,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onOpenSettings,
  hmStandar
}) => {
  // Ordered navigation items according to specifications:
  // 1. BERANDA
  // 2. RENCANA KERJA & SPK
  // 3. MASTER LOKASI
  // 4. MASTER UNIT
  // 5. MASTER AKTIVITAS
  // 6. MASTER OPERATOR
  // 7. MASTER USER
  // 8. RANGKUMAN & ANALITIK
  const menuItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    pendingBadge?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'rekapitulasi',
      label: 'BERANDA',
      icon: Home,
      count: counts.rekapitulasi
    },
    {
      id: 'rencana',
      label: 'RENCANA KERJA & SPK',
      icon: FileCheck2,
      count: counts.rencana,
      pendingBadge: counts.pendingSpk
    },
    {
      id: 'lokasi',
      label: 'MASTER LOKASI',
      icon: MapPin,
      count: counts.lokasi
    },
    {
      id: 'units',
      label: 'MASTER UNIT',
      icon: Truck,
      count: counts.units
    },
    {
      id: 'aktivitas',
      label: 'MASTER AKTIVITAS',
      icon: ListChecks,
      count: counts.aktivitas
    },
    {
      id: 'kendala',
      label: 'MASTER KENDALA',
      icon: AlertTriangle,
      count: counts.kendala
    },
    {
      id: 'operators',
      label: 'MASTER OPERATOR',
      icon: UserCheck,
      count: counts.operators
    },
    {
      id: 'users',
      label: 'MASTER USER',
      icon: Users,
      count: counts.users
    },
    {
      id: 'analytics',
      label: 'RANGKUMAN & ANALITIK',
      icon: BarChart3
    }
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-2xs transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col shadow-xs ${
          isCollapsed ? 'w-20' : 'w-[270px]'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        
        {/* Top Header & Branding */}
        <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* RKCE Emerald Logo */}
            <div 
              className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex flex-col items-center justify-center text-white shadow-sm ring-2 ring-emerald-100 select-none"
              title="RKCE (Rencana Kerja Unit Civil Engineering)"
            >
              <span className="font-extrabold text-[13px] tracking-tight leading-none text-white font-sans drop-shadow-xs">
                RKCE
              </span>
              <span className="text-[7px] font-bold text-emerald-200 tracking-tighter leading-none mt-0.5">
                CIVIL
              </span>
            </div>

            {!isCollapsed && (
              <div className="min-w-0 transition-opacity duration-200">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg tracking-tight text-emerald-600">
                    RKCE
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    Portal
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  Civil Engineering Portal
                </p>
              </div>
            )}
          </div>

          {/* Collapse/Expand Toggle Button (Desktop) */}
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? "Perluas Sidebar" : "Perkecil Sidebar"}
            className="hidden lg:flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin">
          {!isCollapsed && (
            <div className="px-3 mb-2">
              <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                Menu Utama Navigasi
              </span>
            </div>
          )}

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full group flex items-center transition-all cursor-pointer rounded-lg text-left ${
                  isCollapsed ? 'justify-center p-3' : 'px-3.5 py-2.5 gap-3'
                } ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-600 font-bold border-l-4 border-emerald-600 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium border-l-4 border-transparent'
                }`}
              >
                <Icon 
                  className={`shrink-0 transition-colors ${
                    isCollapsed ? 'w-5 h-5' : 'w-4 h-4'
                  } ${
                    isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-700'
                  }`} 
                />

                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="text-xs truncate tracking-wide">
                      {item.label}
                    </span>

                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      {/* Pending SPK Warning Pill */}
                      {item.pendingBadge !== undefined && item.pendingBadge > 0 && (
                        <span 
                          title={`${item.pendingBadge} Rencana Menunggu Penerbitan SPK`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{item.pendingBadge} Pending</span>
                        </span>
                      )}

                      {/* Regular Data Counter Badge */}
                      {item.count !== undefined && (
                        <span 
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums transition-colors ${
                            isActive
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200/80 text-slate-700 group-hover:bg-slate-300'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* System Settings Quick Access */}
        {onOpenSettings && (
          <div className="px-3 py-2 border-t border-slate-200 bg-white shrink-0">
            {!isCollapsed ? (
              <button
                onClick={() => {
                  onOpenSettings();
                  onCloseMobile();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-emerald-800 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 hover:border-emerald-200 transition-all cursor-pointer shadow-2xs group"
                title="Buka Pengaturan Standar Minimal & Maksimal HM Sistem"
              >
                <div className="p-1.5 rounded-lg bg-emerald-100/70 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-xs font-bold leading-tight truncate text-slate-800">
                    Pengaturan Sistem
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono leading-tight truncate">
                    HM: {hmStandar ? `${hmStandar.min.toFixed(1)} - ${hmStandar.max.toFixed(1)}` : '6.0 - 10.0'}
                  </div>
                </div>
              </button>
            ) : (
              <button
                onClick={() => {
                  onOpenSettings();
                  onCloseMobile();
                }}
                className="w-full flex items-center justify-center p-2.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title="Pengaturan Sistem (Standar HM)"
              >
                <Sliders className="w-4 h-4 text-emerald-600" />
              </button>
            )}
          </div>
        )}

        {/* Sidebar Footer Info */}
        {!isCollapsed && (
          <div className="p-3 border-t border-slate-200 bg-slate-50/50 shrink-0">
            <div className="px-3 py-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
                <span className="text-[11px] font-bold text-emerald-900">
                  RKCE Mobile Connected
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Sinkronisasi real-time armada lapangan
              </p>
            </div>
          </div>
        )}

      </aside>
    </>
  );
};
