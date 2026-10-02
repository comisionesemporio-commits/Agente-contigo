import React, { useState, useEffect } from 'react';
import { Agent } from '../../types';
import { X, UserCheck, Save, Trash2 } from 'lucide-react';

interface AgentModalProps {
  isOpen: boolean;
  agent: Agent | null;
  onClose: () => void;
  onSave: (agent: Agent) => void;
  onDelete: (agentId: string) => void;
}

export const AgentModal: React.FC<AgentModalProps> = ({
  isOpen,
  agent,
  onClose,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState<Partial<Agent>>({});

  useEffect(() => {
    if (agent) {
      setFormData({ ...agent });
    } else {
      setFormData({
        id: '',
        nombre: '',
        apellido: '',
        npn: '',
        licencias: '',
        compania: '',
        notas: ''
      });
    }
  }, [agent, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre?.trim()) return;

    onSave({
      id: formData.id || ('ag-' + Date.now()),
      nombre: formData.nombre.trim(),
      apellido: formData.apellido?.trim() || '',
      npn: formData.npn?.trim() || '',
      licencias: formData.licencias?.trim() || '',
      compania: formData.compania?.trim() || 'General',
      notas: formData.notas?.trim() || ''
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        <div className="bg-indigo-950 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-400" />
            <span>{agent ? `Ficha del Agente: ${agent.nombre}` : 'Registrar Nuevo Agente'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Nombre *</label>
              <input
                type="text"
                required
                value={formData.nombre || ''}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej. Junior"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Apellido</label>
              <input
                type="text"
                value={formData.apellido || ''}
                onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                placeholder="Ej. Pérez"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">NPN</label>
              <input
                type="text"
                value={formData.npn || ''}
                onChange={e => setFormData({ ...formData, npn: e.target.value })}
                placeholder="Ej. 20194827"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-indigo-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Compañía Contratada</label>
              <input
                type="text"
                value={formData.compania || ''}
                onChange={e => setFormData({ ...formData, compania: e.target.value })}
                placeholder="Ej. Florida Blue / Aetna"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Licencias Autorizadas</label>
            <input
              type="text"
              value={formData.licencias || ''}
              onChange={e => setFormData({ ...formData, licencias: e.target.value })}
              placeholder="Ej. GA, FL, TX"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Notas / Observaciones</label>
            <textarea
              rows={2}
              value={formData.notas || ''}
              onChange={e => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Agrega notas especiales..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-200">
            {agent && (
              <button
                type="button"
                onClick={() => onDelete(agent.id)}
                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Agente</span>
              </button>
            )}

            <div className="flex space-x-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Ficha</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
