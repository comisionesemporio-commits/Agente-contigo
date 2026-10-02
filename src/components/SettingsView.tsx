import React, { useState } from 'react';
import {
  Sliders, Database, Upload, RefreshCw, Key,
  UserCheck, Building, Tag, Trash2, Plus, Save,
  FileCode, Check, Copy, ExternalLink, ShieldCheck
} from 'lucide-react';
import { getAdminPass, getSellerPass, getMasterPin } from '../services/storage';
import { getSupabaseSetupSQL } from '../services/supabase';

interface SettingsViewProps {
  supabaseUrl: string;
  supabaseKey: string;
  onSaveSupabaseConfig: (url: string, key: string) => void;
  onSyncFromSupabase: () => void;
  onPushToSupabase: () => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetLogo: () => void;
  customSellers: string[];
  customCarriers: string[];
  customStatuses: string[];
  onAddSeller: (seller: string) => void;
  onRemoveSeller: (seller: string) => void;
  onAddCarrier: (carrier: string) => void;
  onRemoveCarrier: (carrier: string) => void;
  onAddStatus: (status: string) => void;
  onRemoveStatus: (status: string) => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  supabaseUrl,
  supabaseKey,
  onSaveSupabaseConfig,
  onSyncFromSupabase,
  onPushToSupabase,
  onLogoUpload,
  onResetLogo,
  customSellers,
  customCarriers,
  customStatuses,
  onAddSeller,
  onRemoveSeller,
  onAddCarrier,
  onRemoveCarrier,
  onAddStatus,
  onRemoveStatus,
  onShowToast
}) => {
  // Supabase state
  const [url, setUrl] = useState(supabaseUrl);
  const [key, setKey] = useState(supabaseKey);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Passwords state
  const [targetKey, setTargetKey] = useState<'admin' | 'vendedor' | 'pin'>('vendedor');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // Catalog inputs
  const [newSellerInput, setNewSellerInput] = useState('');
  const [newCarrierInput, setNewCarrierInput] = useState('');
  const [newStatusInput, setNewStatusInput] = useState('');

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !key.trim()) {
      onShowToast("Faltan Datos", "Por favor ingresa la URL y la Key de Supabase.", "info");
      return;
    }
    onSaveSupabaseConfig(url.trim(), key.trim());
  };

  const handleCopySql = () => {
    const sql = getSupabaseSetupSQL();
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    onShowToast("SQL Copiado", "Pega este script en el SQL Editor de tu panel de Supabase.", "success");
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPass || !newPass) {
      onShowToast("Campos Incompletos", "Por favor ingresa la clave actual y la nueva.", "info");
      return;
    }

    if (targetKey === 'admin') {
      if (oldPass !== getAdminPass()) {
        onShowToast("Error", "La clave actual de Administrador no coincide.", "error");
        return;
      }
      localStorage.setItem('app_admin_pass', newPass);
    } else if (targetKey === 'vendedor') {
      if (oldPass !== getSellerPass()) {
        onShowToast("Error", "La clave actual de Vendedores no coincide.", "error");
        return;
      }
      localStorage.setItem('app_seller_pass', newPass);
    } else if (targetKey === 'pin') {
      if (oldPass !== getMasterPin()) {
        onShowToast("Error", "El PIN Maestro actual no coincide.", "error");
        return;
      }
      localStorage.setItem('app_master_pin', newPass);
    }

    setOldPass('');
    setNewPass('');
    onShowToast("Clave Actualizada", `La clave de [${targetKey.toUpperCase()}] ha sido modificada con éxito.`, "success");
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-600" />
            Configuración del Sistema & Supabase Cloud
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de catálogos, credenciales y conexión de base de datos.
          </p>
        </div>
      </div>

      {/* 1. CONEXIÓN SUPABASE */}
      <form onSubmit={handleSaveSupabase} className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-black uppercase text-emerald-400">
              Conexión Supabase (Tablas: clientes, cotizaciones, tareas)
            </h3>
          </div>
          
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1 rounded-lg font-extrabold border border-emerald-500/40 transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Ver Script SQL</span>
            </button>

            <button
              type="button"
              onClick={handleCopySql}
              className="text-[11px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-3 py-1 rounded-lg font-extrabold border border-cyan-500/40 transition flex items-center gap-1.5 cursor-pointer"
              title="Copiar Script SQL"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? '¡Copiado!' : 'Copiar SQL'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">Supabase URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://kyyddkrqmlohviakcxsg.supabase.co"
              className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">Supabase Anon Key</label>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 text-xs">
          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar y Probar Conexión</span>
          </button>

          <button
            type="button"
            onClick={onSyncFromSupabase}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700 font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sincronizar con Supabase</span>
          </button>

          <button
            type="button"
            onClick={onPushToSupabase}
            className="px-4 py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Datos a Supabase</span>
          </button>
        </div>
      </form>

      {/* 2. GESTIÓN DE LOGOTIPO */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
        <h3 className="font-black text-slate-800 uppercase flex items-center gap-2">
          <Upload className="w-4 h-4 text-indigo-600" />
          Logotipo de la Aplicación
        </h3>
        <p className="text-slate-600">
          Sube un logo personalizado o haz clic directamente sobre la imagen en la barra lateral.
        </p>

        <div className="flex items-center gap-3">
          <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Nueva Imagen</span>
            <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
          </label>

          <button
            type="button"
            onClick={onResetLogo}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            Restaurar Original
          </button>
        </div>
      </div>

      {/* 3. CAMBIO DE CONTRASEÑAS */}
      <div className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-xs font-black uppercase text-amber-400 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              Gestión y Cambio de Claves de Acceso
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Modifica las claves del sistema si alguien deja el equipo o para mantener la seguridad.
            </p>
          </div>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-extrabold border border-amber-500/30">
            Control Administrativo
          </span>
        </div>

        <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">Tipo de Clave</label>
            <select
              value={targetKey}
              onChange={e => setTargetKey(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 text-white font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="vendedor">Vendedores (Portal de Ventas)</option>
              <option value="admin">Administrador (Panel CMS)</option>
              <option value="pin">PIN Maestro Comisiones (🔒)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">Clave Actual</label>
            <input
              type="password"
              value={oldPass}
              onChange={e => setOldPass(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-700 text-white font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">Nueva Clave</label>
            <input
              type="password"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-700 text-white font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Nueva Clave</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. CATÁLOGOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        {/* Sellers */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-600" />
            Lista de Vendedores
          </h3>
          <div className="flex space-x-2">
            <input
              type="text"
              value={newSellerInput}
              onChange={e => setNewSellerInput(e.target.value)}
              placeholder="Nombre vendedor..."
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (newSellerInput.trim()) {
                  onAddSeller(newSellerInput.trim());
                  setNewSellerInput('');
                }
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              + Agregar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {customSellers.map(v => (
              <span key={v} className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center shadow-sm">
                👤 {v}
                <button
                  type="button"
                  onClick={() => onRemoveSeller(v)}
                  className="ml-2 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Carriers */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-emerald-600" />
            Compañías
          </h3>
          <div className="flex space-x-2">
            <input
              type="text"
              value={newCarrierInput}
              onChange={e => setNewCarrierInput(e.target.value)}
              placeholder="Nueva compañía..."
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (newCarrierInput.trim()) {
                  onAddCarrier(newCarrierInput.trim());
                  setNewCarrierInput('');
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              + Agregar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {customCarriers.map(car => (
              <span key={car} className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center shadow-sm">
                {car}
                <button
                  type="button"
                  onClick={() => onRemoveCarrier(car)}
                  className="ml-2 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Statuses */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4 text-cyan-600" />
            Estatus
          </h3>
          <div className="flex space-x-2">
            <input
              type="text"
              value={newStatusInput}
              onChange={e => setNewStatusInput(e.target.value)}
              placeholder="Nuevo estatus..."
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (newStatusInput.trim()) {
                  onAddStatus(newStatusInput.trim());
                  setNewStatusInput('');
                }
              }}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              + Agregar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {customStatuses.map(st => (
              <span key={st} className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center shadow-sm">
                ⚡ {st}
                <button
                  type="button"
                  onClick={() => onRemoveStatus(st)}
                  className="ml-2 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* SQL Setup Drawer Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Script SQL para Crear Tablas en Supabase
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configuración garantizada para subir pólizas, cotizaciones y tareas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl space-y-1 text-slate-700">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                ¿Cómo usar este script en Supabase?
              </span>
              <p className="text-[11px] leading-relaxed">
                1. Entra a tu proyecto en <strong className="text-emerald-950">supabase.com</strong>.<br />
                2. En el menú lateral izquierdo, haz clic en el icono <strong>SQL Editor</strong> (Editor SQL).<br />
                3. Haz clic en <strong>"New query"</strong>, pega este código y presiona el botón verde <strong>RUN</strong>.
              </p>
            </div>

            <div className="relative">
              <pre className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-2xl max-h-60 overflow-y-auto leading-relaxed border border-slate-800">
                {getSupabaseSetupSQL()}
              </pre>
              <button
                type="button"
                onClick={handleCopySql}
                className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copiado' : 'Copiar Script'}</span>
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Todo el Script SQL</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
