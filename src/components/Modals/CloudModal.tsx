import React, { useState } from 'react';
import { X, Database, CheckCircle, CloudUpload, Save, FileCode, Check, Copy } from 'lucide-react';
import { getSupabaseSetupSQL } from '../../services/supabase';

interface CloudModalProps {
  isOpen: boolean;
  initialUrl: string;
  initialKey: string;
  onClose: () => void;
  onSave: (url: string, key: string) => void;
  onPushAll: () => void;
}

export const CloudModal: React.FC<CloudModalProps> = ({
  isOpen,
  initialUrl,
  initialKey,
  onClose,
  onSave,
  onPushAll
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [key, setKey] = useState(initialKey);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(url, key);
    onClose();
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(getSupabaseSetupSQL());
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4 text-xs">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Conexión Supabase (Tabla: clientes, cotizaciones, tareas)</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Sincronización Directa a Supabase Cloud
            </span>
            <button
              type="button"
              onClick={() => setShowSql(!showSql)}
              className="text-[10px] text-emerald-700 underline font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <FileCode className="w-3 h-3" />
              <span>{showSql ? 'Ocultar SQL' : 'Ver Script SQL'}</span>
            </button>
          </div>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            Tus datos se sincronizan directamente con las tablas <code className="bg-emerald-100 text-emerald-900 font-bold px-1 rounded">clientes</code>, <code className="bg-emerald-100 text-emerald-900 font-bold px-1 rounded">cotizaciones</code> y <code className="bg-emerald-100 text-emerald-900 font-bold px-1 rounded">tareas</code>.
          </p>
        </div>

        {showSql && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-slate-500">Ejecuta esto en SQL Editor de Supabase:</span>
              <button
                type="button"
                onClick={handleCopySql}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-[10px] rounded-xl max-h-40 overflow-y-auto leading-relaxed border border-slate-800">
              {getSupabaseSetupSQL()}
            </pre>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Project URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://kyyddkrqmlohviakcxsg.supabase.co"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono bg-white"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Anon / Public API Key</label>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsIn..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono bg-white"
            />
          </div>

          <div className="flex flex-wrap justify-between items-center pt-3 border-t border-slate-200 gap-2">
            <button
              type="button"
              onClick={onPushAll}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>Subir datos a Supabase</span>
            </button>

            <div className="flex space-x-2">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition cursor-pointer"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
