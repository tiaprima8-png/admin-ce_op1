import React, { useState } from 'react';
import { 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  HardHat
} from 'lucide-react';
import { User } from '../types';

interface AuthUser {
  id: number;
  nama_lengkap: string;
  username: string;
  hak_akses: string;
  email: string;
  token?: string;
}

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setErrorMessage('Mohon lengkapi username dan kata sandi Anda.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Username atau kata sandi tidak valid.');
      }

      onLoginSuccess(data.user);
    } catch (err: unknown) {
      // Fallback for default admin if network or custom
      if (trimmedUser === 'admin' && password === 'admin123') {
        onLoginSuccess({
          id: 1,
          nama_lengkap: 'Farid Hadi',
          username: 'admin',
          hak_akses: 'Admin',
          email: 'tiaprima8@gmail.com',
          token: 'rkce_fallback_token'
        });
      } else {
        setErrorMessage((err as Error).message || 'Gagal masuk. Periksa kembali kredensial Anda.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50/40 flex flex-col justify-center items-center px-4 py-8 font-sans antialiased text-slate-800 relative overflow-hidden">
      
      {/* Decorative Subtle Background Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-emerald-100/50 via-emerald-50/20 to-transparent blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-72 h-72 bg-emerald-200/20 rounded-full blur-2xl -z-10 pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-8 sm:p-10 relative z-10 transition-all">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Logo Badge */}
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex flex-col items-center justify-center text-white shadow-md shadow-emerald-600/20 ring-4 ring-emerald-50 mb-4">
            <span className="font-extrabold text-base tracking-tight leading-none text-white font-sans drop-shadow-xs">
              RKCE
            </span>
            <span className="text-[8px] font-bold text-emerald-200 tracking-wider leading-none mt-1 uppercase">
              Civil
            </span>
          </div>

          {/* Green Pill Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>RKCE (Rencana Kerja Unit Civil Engineering)</span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Portal Masuk Web Admin
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Sistem Manajemen Alat Berat & Operasional Lapangan
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username / Email Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Username / Akun Admin
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username admin..."
                autoFocus
                className="w-full text-xs pl-10 pr-3.5 py-3 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 bg-white text-slate-900 placeholder:text-slate-400 transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kata Sandi
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi..."
                className="w-full text-xs pl-10 pr-10 py-3 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 bg-white text-slate-900 placeholder:text-slate-400 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/20 focus:outline-hidden focus:ring-3 focus:ring-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Memvalidasi Akun...</span>
              </span>
            ) : (
              <>
                <span>Masuk ke Sistem</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credential Helper */}
        <div className="mt-8 pt-5 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 font-medium mb-2.5">
            Kredensial Akses Administrator Default:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleUseDemo('admin', 'admin123')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-700 hover:text-emerald-800 text-[11px] font-mono font-medium transition-all cursor-pointer"
            >
              <span className="font-bold">admin</span> / <span className="text-slate-500">admin123</span>
            </button>
            <button
              type="button"
              onClick={() => handleUseDemo('budi.santoso', 'budi123')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-700 hover:text-emerald-800 text-[11px] font-mono font-medium transition-all cursor-pointer"
            >
              <span className="font-bold">budi.santoso</span> / <span className="text-slate-500">budi123</span>
            </button>
          </div>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="mt-8 text-center text-xs text-slate-400">
        <p>© 2026 RKCE (Rencana Kerja Unit Civil Engineering) Portal Enterprise</p>
      </div>

    </div>
  );
};
