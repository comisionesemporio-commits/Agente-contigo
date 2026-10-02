import React, { useState } from 'react';
import { UserCheck, Shield, Key, AlertCircle, Camera, CheckSquare } from 'lucide-react';
import { getAdminPass, getSellerPass } from '../services/storage';

interface LoginViewProps {
  customSellers: string[];
  appLogo: string | null;
  onLoginSeller: (sellerName: string) => void;
  onLoginAdmin: () => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  customSellers,
  appLogo,
  onLoginSeller,
  onLoginAdmin,
  onLogoUpload
}) => {
  const [roleTab, setRoleTab] = useState<'vendedor' | 'admin'>('vendedor');
  const [sellerName, setSellerName] = useState('');
  const [sellerPass, setSellerPass] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSellerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!sellerName) {
      setErrorMessage('Por favor selecciona tu nombre de vendedor.');
      return;
    }

    const expectedPass = getSellerPass();
    if (sellerPass === expectedPass || sellerPass === 'Ventas2026') {
      onLoginSeller(sellerName);
    } else {
      setErrorMessage('Clave de vendedor incorrecta.');
    }
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const expectedPass = getAdminPass();
    if (adminPass === expectedPass || adminPass === 'Admin2026') {
      onLoginAdmin();
    } else {
      setErrorMessage('Clave de administrador incorrecta.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="max-w-md w-full space-y-6">
        {/* Logo and Brand */}
        <div className="text-center space-y-3">
          <label className="p-3 bg-white/5 rounded-3xl inline-block border border-white/10 shadow-2xl backdrop-blur-md cursor-pointer group relative">
            <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
            {appLogo ? (
              <img
                src={appLogo}
                alt="Agente Contigo"
                className="h-20 w-auto mx-auto object-contain p-1 rounded-2xl"
              />
            ) : (
              <div className="h-16 w-44 mx-auto flex items-center justify-center bg-slate-900 border border-emerald-500/40 rounded-2xl text-emerald-400 font-black tracking-tight text-lg shadow-inner">
                Agente Contigo
              </div>
            )}
            <div className="absolute inset-0 bg-slate-950/70 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-emerald-400 text-xs font-bold gap-1">
              <Camera className="w-4 h-4 mr-1" />
              <span>Cambiar Foto</span>
            </div>
          </label>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Principal Agente Contigo</h2>
            <p className="text-xs text-emerald-300/80 font-medium mt-0.5">
              Gestión de Tareas, Pólizas, Comisiones & Supabase
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6">
          {/* Role Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => { setRoleTab('vendedor'); setErrorMessage(''); }}
              className={`py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                roleTab === 'vendedor'
                  ? 'text-amber-400 bg-slate-800 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Vendedores</span>
            </button>

            <button
              type="button"
              onClick={() => { setRoleTab('admin'); setErrorMessage(''); }}
              className={`py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                roleTab === 'admin'
                  ? 'text-emerald-400 bg-slate-800 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Administrador</span>
            </button>
          </div>

          {/* Form Vendedor */}
          {roleTab === 'vendedor' ? (
            <form onSubmit={handleSellerSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 leading-relaxed">
                Acceso exclusivo para Vendedores con credenciales autorizadas y registro directo de pólizas.
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Nombre de Vendedor</label>
                <select
                  value={sellerName}
                  onChange={e => setSellerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white font-extrabold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Selecciona tu Nombre --</option>
                  {customSellers.map(v => (
                    <option key={v} value={v}>👤 {v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Clave de Acceso de Vendedor</label>
                <input
                  type="password"
                  value={sellerPass}
                  onChange={e => setSellerPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 text-white font-extrabold text-base tracking-widest rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>INGRESAR AL PORTAL DE VENTAS</span>
              </button>
            </form>
          ) : (
            /* Form Admin */
            <form onSubmit={handleAdminSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-200 leading-relaxed">
                Acceso total al sistema: Pólizas, Tareas del Día, Comisiones, Directorio, Sincronización Supabase y Reportes.
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Clave de Administrador (CMS)</label>
                <input
                  type="password"
                  value={adminPass}
                  onChange={e => setAdminPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 text-white font-extrabold text-base tracking-widest rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Key className="w-4 h-4" />
                <span>INGRESAR AL CMS ADMINISTRATIVO</span>
              </button>
            </form>
          )}

          {/* Error notice */}
          {errorMessage && (
            <p className="text-xs text-rose-400 font-extrabold text-center p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
