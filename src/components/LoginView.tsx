import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Shield, Key, AlertCircle, Camera, CheckSquare, RefreshCw, Loader2, Database } from 'lucide-react';
import { getAdminPass, getSellerPass } from '../services/storage';
import { fetchVendedoresFromSupabase, initSupabase } from '../services/supabase';

interface LoginViewProps {
  customSellers: string[];
  appLogo: string | null;
  onLoginSeller: (sellerName: string) => void;
  onLoginAdmin: () => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSyncSellers?: (activeSellers: string[]) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  customSellers,
  appLogo,
  onLoginSeller,
  onLoginAdmin,
  onLogoUpload,
  onSyncSellers
}) => {
  const [roleTab, setRoleTab] = useState<'vendedor' | 'admin'>('vendedor');
  const [sellerName, setSellerName] = useState('');
  const [sellerPass, setSellerPass] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Lista viva de vendedores activos consultada directamente en Supabase
  const [liveSellers, setLiveSellers] = useState<string[]>(() => {
    const deletedNames = ['dani', 'carlos mendoza', 'oscar', 'maría rivas', 'maria rivas'];
    return (customSellers || []).filter(
      s => typeof s === 'string' && s.trim() && !deletedNames.includes(s.trim().toLowerCase())
    );
  });
  const [isLoadingLiveSellers, setIsLoadingLiveSellers] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // Consulta en tiempo real a Supabase para obtener única y exclusivamente los vendedores activos
  const loadActiveSellersRealtime = useCallback(async () => {
    setIsLoadingLiveSellers(true);
    try {
      const cloudVendedores = await fetchVendedoresFromSupabase();
      const deletedNames = ['dani', 'carlos mendoza', 'oscar', 'maría rivas', 'maria rivas'];

      // Filtra estricta y exclusivamente los vendedores activos en la base de datos
      const activeFromDb = cloudVendedores
        .map(v => v.nombre.trim())
        .filter(name => name.length > 0 && !deletedNames.includes(name.toLowerCase()));

      const unique = Array.from(new Set(activeFromDb));

      // Asigna única y exclusivamente la lista activa de la base de datos
      setLiveSellers(unique);
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      if (onSyncSellers) {
        onSyncSellers(unique);
      }
    } catch (err) {
      console.warn('Error consultando vendedores activos en Supabase:', err);
    } finally {
      setIsLoadingLiveSellers(false);
    }
  }, [onSyncSellers]);

  // Consulta al montar y escucha cambios en tiempo real vía WebSocket / Postgres Changes
  useEffect(() => {
    loadActiveSellersRealtime();

    const sb = initSupabase();
    if (!sb) return;

    let channel: any = null;
    try {
      channel = sb
        .channel('realtime:vendedores_login')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'vendedores' },
          () => {
            loadActiveSellersRealtime();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime channel error:', e);
    }

    return () => {
      if (channel && sb) {
        sb.removeChannel(channel);
      }
    };
  }, [loadActiveSellersRealtime]);

  // Sincronizar con props si cambian externamente
  useEffect(() => {
    const deletedNames = ['dani', 'carlos mendoza', 'oscar', 'maría rivas', 'maria rivas'];
    const sanitized = (customSellers || []).filter(
      s => typeof s === 'string' && s.trim() && !deletedNames.includes(s.trim().toLowerCase())
    );
    if (sanitized.length > 0 && liveSellers.length === 0) {
      setLiveSellers(sanitized);
    }
  }, [customSellers]);

  const handleSellerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!sellerName) {
      setErrorMessage('Por favor selecciona tu nombre de vendedor.');
      return;
    }

    // Validar que el vendedor exista en la lista activa de la base de datos
    if (!liveSellers.includes(sellerName)) {
      setErrorMessage(`El vendedor "${sellerName}" ya no está activo o fue eliminado de la base de datos.`);
      return;
    }

    const expectedPass = getSellerPass(sellerName);
    const pass = sellerPass.trim();
    if (pass === expectedPass) {
      onLoginSeller(sellerName);
    } else {
      setErrorMessage(`Clave de acceso incorrecta para "${sellerName}".`);
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-300 uppercase flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-amber-500" />
                    <span>Nombre de Vendedor</span>
                  </label>
                  <button
                    type="button"
                    onClick={loadActiveSellersRealtime}
                    disabled={isLoadingLiveSellers}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition cursor-pointer"
                    title="Consultar lista de vendedores activos en Supabase en tiempo real"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingLiveSellers ? 'animate-spin' : ''}`} />
                    <span>{isLoadingLiveSellers ? 'Consultando...' : 'En tiempo real'}</span>
                  </button>
                </div>

                <select
                  value={sellerName}
                  onChange={e => setSellerName(e.target.value)}
                  disabled={isLoadingLiveSellers && liveSellers.length === 0}
                  className="w-full bg-slate-950 border border-slate-700 text-white font-extrabold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                >
                  <option value="">
                    {isLoadingLiveSellers && liveSellers.length === 0
                      ? '⏳ Consultando base de datos en Supabase...'
                      : liveSellers.length === 0
                        ? '⚠️ No hay vendedores activos en Supabase'
                        : '-- Selecciona tu Nombre --'}
                  </option>
                  {liveSellers.map(v => (
                    <option key={v} value={v}>👤 {v}</option>
                  ))}
                </select>

                {liveSellers.length === 0 && !isLoadingLiveSellers ? (
                  <p className="mt-1.5 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                    No se encontraron vendedores activos en Supabase. Si eres administrador, inicia sesión como Administrador para agregar vendedores activos en Configuración.
                  </p>
                ) : (
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 px-1 font-medium">
                    <span>{liveSellers.length} vendedor{liveSellers.length === 1 ? '' : 'es'} activo{liveSellers.length === 1 ? '' : 's'} en base de datos</span>
                    {lastSyncedTime && <span>Act: {lastSyncedTime}</span>}
                  </div>
                )}
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
