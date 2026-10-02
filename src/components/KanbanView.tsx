import React from 'react';
import { ClientPolicy } from '../types';
import { Columns, ArrowRight, ArrowLeft, Building, User } from 'lucide-react';

interface KanbanViewProps {
  clients: ClientPolicy[];
  selectedYear: string;
  onEditClient: (client: ClientPolicy) => void;
  onUpdateStatus: (clientId: string, newStatus: string) => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  clients,
  selectedYear,
  onEditClient,
  onUpdateStatus
}) => {
  const yearClients = clients.filter(c => String(c.createdYear || "2026") === String(selectedYear));

  const listNuevo = yearClients.filter(
    c => c.estatus === 'Nuevo' || c.estatus === 'Subido / Listo' || c.estatus === 'Pendiente'
  );
  const listActivo = yearClients.filter(c => c.estatus === 'Activo');
  const listCancelado = yearClients.filter(c => c.estatus === 'Cancelado' || c.estatus === 'Robado');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Columns className="w-4 h-4 text-blue-600" />
            Tablero Visual Kanban ({selectedYear})
          </h3>
          <p className="text-xs text-slate-500">Visualiza y avanza el flujo de clientes por estatus de procesamiento.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-x-auto pb-4">
        {/* Column 1: Nuevos por Procesar */}
        <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex flex-col min-w-[280px]">
          <div className="flex items-center justify-between font-bold text-xs text-blue-800 mb-3 pb-2 border-b border-blue-200">
            <span>🔵 NUEVO POR PROCESAR</span>
            <span className="bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full text-[10px] font-black">
              {listNuevo.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 min-h-[350px]">
            {listNuevo.length === 0 ? (
              <div className="text-center p-6 text-slate-400 text-xs">Sin registros pendientes</div>
            ) : (
              listNuevo.map(c => (
                <div
                  key={c.id}
                  onClick={() => onEditClient(c)}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition cursor-pointer space-y-2"
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="font-extrabold text-xs text-slate-900">{c.nombre}</span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                      {c.carrier || 'General'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>👤 {c.vendedor || 'General'}</span>
                    <span className="font-semibold text-indigo-700 truncate max-w-[120px]">{c.nombrePlan || 'Plan'}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(c.id, 'Activo')}
                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg transition border border-emerald-200 flex items-center gap-1"
                      title="Mover a Activo"
                    >
                      <span>Aprobar a Activo</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Activos */}
        <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex flex-col min-w-[280px]">
          <div className="flex items-center justify-between font-bold text-xs text-emerald-800 mb-3 pb-2 border-b border-emerald-200">
            <span>🟢 ACTIVOS</span>
            <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-black">
              {listActivo.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 min-h-[350px]">
            {listActivo.length === 0 ? (
              <div className="text-center p-6 text-slate-400 text-xs">Sin clientes activos</div>
            ) : (
              listActivo.map(c => (
                <div
                  key={c.id}
                  onClick={() => onEditClient(c)}
                  className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm hover:shadow transition cursor-pointer space-y-2"
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="font-extrabold text-xs text-slate-900">{c.nombre}</span>
                    <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                      {c.carrier || 'General'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>👤 {c.vendedor || 'General'}</span>
                    <span className="font-mono text-emerald-700 font-bold">${(c.primaMonto || 0).toFixed(2)}/mes</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(c.id, 'Nuevo')}
                      className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[10px] font-semibold rounded flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Revertir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateStatus(c.id, 'Cancelado')}
                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg transition border border-rose-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Cancelados / Robados */}
        <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex flex-col min-w-[280px]">
          <div className="flex items-center justify-between font-bold text-xs text-rose-800 mb-3 pb-2 border-b border-rose-200">
            <span>🔴 CANCELADOS / 🟣 ROBADOS</span>
            <span className="bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full text-[10px] font-black">
              {listCancelado.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 min-h-[350px]">
            {listCancelado.length === 0 ? (
              <div className="text-center p-6 text-slate-400 text-xs">Sin pólizas inactivas</div>
            ) : (
              listCancelado.map(c => (
                <div
                  key={c.id}
                  onClick={() => onEditClient(c)}
                  className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm hover:shadow transition cursor-pointer space-y-2"
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="font-extrabold text-xs text-slate-900">{c.nombre}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                      c.estatus === 'Robado' ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {c.estatus}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    <span>👤 {c.vendedor || 'General'}</span> · <span>{c.carrier || 'General'}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(c.id, 'Activo')}
                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg transition border border-emerald-200 flex items-center gap-1"
                    >
                      <span>Reactivar</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
