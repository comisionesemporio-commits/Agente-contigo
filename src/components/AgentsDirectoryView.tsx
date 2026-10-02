import React, { useState } from 'react';
import { Agent } from '../types';
import {
  IdCard, UserPlus, Search, Building, ShieldCheck,
  FileCheck, Edit, Trash2
} from 'lucide-react';

interface AgentsDirectoryViewProps {
  agents: Agent[];
  onOpenCreateAgentModal: () => void;
  onEditAgent: (agent: Agent) => void;
  onDeleteAgent: (agentId: string) => void;
}

export const AgentsDirectoryView: React.FC<AgentsDirectoryViewProps> = ({
  agents,
  onOpenCreateAgentModal,
  onEditAgent,
  onDeleteAgent
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAgents = agents.filter(a => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (a.nombre || '').toLowerCase().includes(q) ||
      (a.apellido || '').toLowerCase().includes(q) ||
      (a.npn || '').toLowerCase().includes(q) ||
      (a.licencias || '').toLowerCase().includes(q) ||
      (a.compania || '').toLowerCase().includes(q) ||
      (a.notas || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-indigo-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[10px] font-black uppercase tracking-wider inline-block mb-2">
            Fichas Técnicas Administrativas de Agentes
          </span>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            Directorio de Agentes & Licencias Oficiales
          </h2>
          <p className="text-xs text-indigo-200/80 mt-1">
            Consulte y registre Agentes, NPN, Licencias estatales y Compañías autorizadas.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateAgentModal}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Registrar Nuevo Agente</span>
        </button>
      </div>

      {/* Search and Count */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar Agente por nombre, NPN, Licencia..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
          />
        </div>
        <span className="px-3 py-1 bg-indigo-50 text-indigo-800 text-xs font-bold rounded-lg border border-indigo-200">
          {filteredAgents.length} Agentes Registrados
        </span>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAgents.length === 0 ? (
          <div className="col-span-3 p-12 text-center text-slate-400">
            No se encontraron agentes que coincidan con la búsqueda.
          </div>
        ) : (
          filteredAgents.map(a => (
            <div
              key={a.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                    {a.nombre.charAt(0)}{a.apellido ? a.apellido.charAt(0) : ''}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {a.nombre} {a.apellido || ''}
                    </h3>
                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full inline-block mt-0.5">
                      NPN: {a.npn || 'Sin NPN'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => onEditAgent(a)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    title="Editar agente"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteAgent(a.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Eliminar agente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-bold uppercase text-[10px] text-slate-400 block">Compañía Contratada:</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                    <Building className="w-3.5 h-3.5 text-emerald-600" />
                    {a.compania || 'General'}
                  </span>
                </div>

                <div>
                  <span className="font-bold uppercase text-[10px] text-slate-400 block">Licencias Autorizadas:</span>
                  <span className="text-slate-700 font-semibold flex items-center gap-1 mt-0.5">
                    <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                    {a.licencias || 'Sin especificar'}
                  </span>
                </div>

                {a.notas && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="font-bold uppercase text-[10px] text-slate-400 block">Notas:</span>
                    <p className="text-[11px] text-slate-600 mt-0.5">{a.notas}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
