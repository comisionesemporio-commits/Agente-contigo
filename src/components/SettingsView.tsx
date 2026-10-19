import React, { useState } from 'react';
import {
  Sliders, Database, Upload, RefreshCw, Key,
  UserCheck, Building, Tag, Trash2, Plus, Save,
  FileCode, Check, Copy, ExternalLink, ShieldCheck,
  Building2, Palette, Edit2, X, Sparkles, CheckCircle2,
  AlertCircle, Info, ChevronDown
} from 'lucide-react';
import {
  getAdminPass, getSellerPass, getMasterPin, CARRIER_COLOR_PRESETS,
  getCarrierColorPreset, getCarrierColorStyle, setSellerCustomPass, removeSellerCustomPass
} from '../services/storage';
import { getSupabaseSetupSQL } from '../services/supabase';
import { CarrierConfig, CarrierColorPreset } from '../types';

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
  carrierConfigs?: CarrierConfig[];
  clientsCountByCarrier?: Record<string, number>;
  onAddSeller: (seller: string) => void;
  onAddSellerWithPass?: (seller: string, pass: string) => void;
  onUpdateSeller?: (oldName: string, newName: string, pass?: string) => void;
  onRemoveSeller: (seller: string) => void;
  onAddCarrier: (carrier: string) => void;
  onAddCarrierWithColor?: (name: string, colorKey: string) => void;
  onUpdateCarrierName?: (oldName: string, newName: string) => void;
  onUpdateCarrierColor?: (carrierName: string, newColorKey: string) => void;
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
  carrierConfigs = [],
  clientsCountByCarrier = {},
  onAddSeller,
  onAddSellerWithPass,
  onUpdateSeller,
  onRemoveSeller,
  onAddCarrier,
  onAddCarrierWithColor,
  onUpdateCarrierName,
  onUpdateCarrierColor,
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
  const [newSellerPassInput, setNewSellerPassInput] = useState('Venta2026');
  const [editingSellerName, setEditingSellerName] = useState<string | null>(null);
  const [editSellerNameInput, setEditSellerNameInput] = useState('');
  const [editSellerPassInput, setEditSellerPassInput] = useState('');
  const [showSellerPasswords, setShowSellerPasswords] = useState<Record<string, boolean>>({});

  const [newCarrierInput, setNewCarrierInput] = useState('');
  const [selectedColorKey, setSelectedColorKey] = useState('orange');
  const [newStatusInput, setNewStatusInput] = useState('');

  // Editing carrier state
  const [editingCarrierId, setEditingCarrierId] = useState<string | null>(null);
  const [editingCarrierName, setEditingCarrierName] = useState('');
  const [openColorPickerId, setOpenColorPickerId] = useState<string | null>(null);

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

      {/* 4. GESTIÓN AVANZADA DE COMPAÑÍAS DE SEGUROS Y COLORES */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Compañías de Seguros & Colores de Etiquetas</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Personaliza el nombre y color distintivo de cada aseguradora en las tablas y expedientes.
            </p>
          </div>
          <span className="text-[11px] bg-emerald-50 text-emerald-800 font-extrabold px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
            {carrierConfigs.length > 0 ? carrierConfigs.length : customCarriers.length} Aseguradoras Registradas
          </span>
        </div>

        {/* Info Banner sobre Auto-Registro */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-emerald-950 leading-relaxed">
            <strong className="font-black">Auto-registro inteligente:</strong> Si ingresas una nueva aseguradora al llenar la planilla de un cliente (por ejemplo, <em>"Imperial"</em>) o al subir un archivo Excel/CSV, <strong>se registrará automáticamente aquí</strong> con un color asignado para que puedas cambiarle el nombre o tono cuando desees.
          </div>
        </div>

        {/* Formulario para Agregar Nueva Aseguradora */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
          <span className="font-extrabold text-slate-800 uppercase tracking-wider block text-[10px]">
            + Registrar Nueva Compañía de Seguros
          </span>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Input Nombre */}
            <div className="md:col-span-5">
              <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
                Nombre de la Aseguradora
              </label>
              <input
                type="text"
                value={newCarrierInput}
                onChange={e => setNewCarrierInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newCarrierInput.trim()) {
                      if (onAddCarrierWithColor) {
                        onAddCarrierWithColor(newCarrierInput.trim(), selectedColorKey);
                      } else {
                        onAddCarrier(newCarrierInput.trim());
                      }
                      setNewCarrierInput('');
                    }
                  }
                }}
                placeholder="Ej: Imperial Insurance, CareSource, Bright Health..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Selector de Color */}
            <div className="md:col-span-4">
              <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px] flex items-center gap-1">
                <Palette className="w-3 h-3 text-indigo-600" />
                Color de Etiqueta
              </label>
              <select
                value={selectedColorKey}
                onChange={e => setSelectedColorKey(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold bg-white text-slate-900 cursor-pointer focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {CARRIER_COLOR_PRESETS.map(preset => (
                  <option key={preset.key} value={preset.key}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón Agregar */}
            <div className="md:col-span-3">
              <button
                type="button"
                onClick={() => {
                  if (!newCarrierInput.trim()) {
                    onShowToast("Nombre Requerido", "Por favor ingresa el nombre de la compañía aseguradora.", "info");
                    return;
                  }
                  if (onAddCarrierWithColor) {
                    onAddCarrierWithColor(newCarrierInput.trim(), selectedColorKey);
                  } else {
                    onAddCarrier(newCarrierInput.trim());
                  }
                  setNewCarrierInput('');
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Compañía</span>
              </button>
            </div>
          </div>

          {/* Vista previa en vivo */}
          {newCarrierInput.trim() && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-500 font-semibold">Vista previa en tablas:</span>
              {(() => {
                const preset = getCarrierColorPreset(selectedColorKey);
                return (
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-black inline-flex items-center gap-1.5 border shadow-2xs ${preset.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${preset.dotColor}`}></span>
                    <span>🛡️ {newCarrierInput.trim()}</span>
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        {/* Listado y Edición de Compañías Existentes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">
              Aseguradoras en el Sistema (Haz clic en el color o en el nombre para modificar)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {(carrierConfigs.length > 0 ? carrierConfigs : customCarriers.map(c => ({ id: c, name: c, colorKey: 'orange' }))).map(item => {
              const currentPreset = getCarrierColorPreset(item.colorKey);
              const isEditing = editingCarrierId === item.id;
              const count = clientsCountByCarrier[item.name.toLowerCase()] || 0;
              const isPickerOpen = openColorPickerId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition shadow-2xs flex flex-col justify-between space-y-2 relative"
                >
                  {/* Top: Nombre de Compañía con Edición */}
                  <div className="flex items-center justify-between gap-1.5">
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={editingCarrierName}
                          autoFocus
                          onChange={e => setEditingCarrierName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              if (editingCarrierName.trim()) {
                                if (onUpdateCarrierName) {
                                  onUpdateCarrierName(item.name, editingCarrierName.trim());
                                }
                                setEditingCarrierId(null);
                              }
                            } else if (e.key === 'Escape') {
                              setEditingCarrierId(null);
                            }
                          }}
                          className="w-full border border-emerald-400 rounded px-2 py-1 text-xs font-black bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingCarrierName.trim()) {
                              if (onUpdateCarrierName) {
                                onUpdateCarrierName(item.name, editingCarrierName.trim());
                              }
                              setEditingCarrierId(null);
                            }
                          }}
                          className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                          title="Guardar nuevo nombre"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCarrierId(null)}
                          className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 truncate">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-black inline-flex items-center gap-1.5 border shadow-2xs truncate ${currentPreset.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${currentPreset.dotColor}`}></span>
                          <span className="truncate">{item.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCarrierId(item.id);
                            setEditingCarrierName(item.name);
                          }}
                          className="text-slate-400 hover:text-slate-700 p-1 transition cursor-pointer"
                          title="Cambiar nombre de esta compañía"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Botón Borrar */}
                    <button
                      type="button"
                      onClick={() => onRemoveCarrier(item.name)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer shrink-0"
                      title="Eliminar compañía"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Bottom: Selector de Color y Conteo */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    {/* Botón para cambiar color */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenColorPickerId(isPickerOpen ? null : item.id)}
                        className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 px-2 py-1 rounded-md shadow-2xs cursor-pointer transition"
                        title="Haz clic para cambiar el color de esta aseguradora"
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentPreset.dotBg }}></span>
                        <span>{currentPreset.name.split('/')[0]}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </button>

                      {/* Menú Flotante de Selección de Color */}
                      {isPickerOpen && (
                        <div className="absolute left-0 bottom-8 z-30 bg-white border border-slate-300 rounded-xl shadow-xl p-2.5 w-52 space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="text-[10px] font-black uppercase text-slate-800">
                              Elegir color para {item.name}:
                            </span>
                            <button
                              type="button"
                              onClick={() => setOpenColorPickerId(null)}
                              className="text-slate-400 hover:text-slate-700"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto p-0.5">
                            {CARRIER_COLOR_PRESETS.map(preset => (
                              <button
                                key={preset.key}
                                type="button"
                                onClick={() => {
                                  if (onUpdateCarrierColor) {
                                    onUpdateCarrierColor(item.name, preset.key);
                                  }
                                  setOpenColorPickerId(null);
                                }}
                                className={`p-1 rounded-lg border flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition cursor-pointer ${
                                  preset.key === item.colorKey
                                    ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-500'
                                    : 'border-slate-200 hover:bg-slate-50'
                                }`}
                                title={preset.name}
                              >
                                <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.dotBg }}></span>
                                <span className="truncate max-w-[42px]">{preset.name.split(' ')[0]}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-500 font-semibold">
                      {count > 0 ? `${count} ${count === 1 ? 'póliza' : 'pólizas'}` : '0 pólizas'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. OTROS CATÁLOGOS: VENDEDORES Y ESTATUS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* Sellers & Passwords Management */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-600" />
              Vendedores & Claves Individuales
            </h3>
            <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
              {customSellers.length} Vendedores
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Asigna una clave única a cada vendedor. Por defecto inician con <strong>Venta2026</strong>.
          </p>

          {/* Formulario para Registrar Nuevo Vendedor con Clave */}
          <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2">
            <span className="font-extrabold text-slate-700 uppercase tracking-wider block text-[10px]">
              + Nuevo Vendedor
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={newSellerInput}
                  onChange={e => setNewSellerInput(e.target.value)}
                  placeholder="Nombre (ej. Virginia)"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="sm:col-span-4">
                <input
                  type="text"
                  value={newSellerPassInput}
                  onChange={e => setNewSellerPassInput(e.target.value)}
                  placeholder="Clave (Venta2026)"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    const cleanName = newSellerInput.trim();
                    if (!cleanName) {
                      onShowToast('Nombre Requerido', 'Ingresa el nombre del vendedor.', 'info');
                      return;
                    }
                    const pass = newSellerPassInput.trim() || 'Venta2026';
                    if (onAddSellerWithPass) {
                      onAddSellerWithPass(cleanName, pass);
                    } else {
                      onAddSeller(cleanName);
                      setSellerCustomPass(cleanName, pass);
                    }
                    setNewSellerInput('');
                    setNewSellerPassInput('Venta2026');
                  }}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  + Agregar
                </button>
              </div>
            </div>
          </div>

          {/* Listado de Vendedores con Edición de Nombre y Clave */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pt-1">
            {customSellers.map(v => {
              const isEditing = editingSellerName === v;
              const sellerPassword = getSellerPass(v);
              const isPassVisible = !!showSellerPasswords[v];

              return (
                <div
                  key={v}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition"
                >
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-1.5">
                      <input
                        type="text"
                        value={editSellerNameInput}
                        onChange={e => setEditSellerNameInput(e.target.value)}
                        placeholder="Nombre vendedor"
                        className="w-1/2 border border-emerald-500 rounded px-2 py-1 text-xs font-bold bg-white"
                      />
                      <input
                        type="text"
                        value={editSellerPassInput}
                        onChange={e => setEditSellerPassInput(e.target.value)}
                        placeholder="Nueva clave"
                        className="w-1/2 border border-emerald-500 rounded px-2 py-1 text-xs font-mono font-bold bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cleanNewName = editSellerNameInput.trim();
                          if (!cleanNewName) return;
                          const finalPass = editSellerPassInput.trim() || 'Venta2026';
                          if (onUpdateSeller) {
                            onUpdateSeller(v, cleanNewName, finalPass);
                          } else {
                            setSellerCustomPass(cleanNewName, finalPass);
                            onShowToast('Clave Actualizada', `Clave de "${cleanNewName}" guardada.`, 'success');
                          }
                          setEditingSellerName(null);
                        }}
                        className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                        title="Guardar vendedor y clave"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSellerName(null)}
                        className="p-1 bg-slate-200 text-slate-700 rounded cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-slate-800 text-xs truncate">👤 {v}</span>
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                          🔑 {isPassVisible ? sellerPassword : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSellerPasswords(prev => ({ ...prev, [v]: !prev[v] }))}
                          className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer shrink-0"
                        >
                          {isPassVisible ? 'Ocultar' : 'Ver'}
                        </button>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSellerName(v);
                            setEditSellerNameInput(v);
                            setEditSellerPassInput(sellerPassword);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          title="Editar nombre y clave"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveSeller(v)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Eliminar vendedor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Statuses */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4 text-cyan-600" />
            Estatus de Pólizas
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
