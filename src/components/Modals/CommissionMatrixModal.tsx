import React, { useState, useEffect } from 'react';
import { ClientPolicy, CommissionItem } from '../../types';
import { X, CalendarCheck, Save, PenSquare } from 'lucide-react';
import { MONTHS_LIST } from '../../services/storage';
import { getClientCommission } from '../CommissionsView';

interface CommissionMatrixModalProps {
  isOpen: boolean;
  client: ClientPolicy | null;
  selectedYear: string;
  onClose: () => void;
  onSave: (clientId: string, updatedCommissions: Record<string, CommissionItem>) => void;
}

export const CommissionMatrixModal: React.FC<CommissionMatrixModalProps> = ({
  isOpen,
  client,
  selectedYear,
  onClose,
  onSave
}) => {
  const [matrixState, setMatrixState] = useState<Record<string, CommissionItem>>({});

  useEffect(() => {
    if (client) {
      const initialMap: Record<string, CommissionItem> = {};
      MONTHS_LIST.forEach(m => {
        initialMap[m] = { ...getClientCommission(client, selectedYear, m) };
      });
      setMatrixState(initialMap);
    }
  }, [client, selectedYear, isOpen]);

  if (!isOpen || !client) return null;

  const handleTogglePaid = (month: string, checked: boolean) => {
    setMatrixState(prev => ({
      ...prev,
      [month]: { ...prev[month], paid: checked }
    }));
  };

  const handleAmountChange = (month: string, val: string) => {
    const amt = parseFloat(val) || 0;
    setMatrixState(prev => ({
      ...prev,
      [month]: { ...prev[month], amount: amt }
    }));
  };

  const handleDateChange = (month: string, val: string) => {
    setMatrixState(prev => ({
      ...prev,
      [month]: { ...prev[month], paidDate: val }
    }));
  };

  const handleNotesChange = (month: string, val: string) => {
    setMatrixState(prev => ({
      ...prev,
      [month]: { ...prev[month], notes: val }
    }));
  };

  const yearSum = Object.values(matrixState).reduce(
    (sum, item) => (item.paid ? sum + (item.amount || 0) : sum),
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(client.id, matrixState);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden my-6 border border-slate-200">
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 uppercase">
              Gestión Multianual de Comisiones
            </span>
            <h3 className="text-sm font-extrabold flex items-center text-emerald-400 mt-0.5 gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-400" />
              <span>Comisiones de Cliente: {client.nombre}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">
                Aseguradora & Agente Titular
              </span>
              <div className="font-bold text-slate-800 text-xs mt-0.5">
                Agente: <span className="text-amber-800">{client.vendedor || 'General'}</span> | Aseguradora: <span className="text-emerald-700">{client.carrier || 'Oscar'}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Año Seleccionado</span>
              <span className="font-extrabold text-slate-900">{selectedYear}</span>
            </div>
          </div>

          <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl flex justify-between items-center text-xs">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <PenSquare className="w-4 h-4 text-amber-600" />
              Ajusta montos, estatus de cobro y fechas de pago:
            </span>
            <span className="font-extrabold text-emerald-800 text-sm tabular-nums">
              Total Cobrado {selectedYear}: ${yearSum.toFixed(2)}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900 text-slate-200 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="p-2.5">Mes</th>
                  <th className="p-2.5 text-center">¿Cobrada?</th>
                  <th className="p-2.5">Monto Editable ($)</th>
                  <th className="p-2.5">Fecha de Pago</th>
                  <th className="p-2.5">Notas del Mes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-medium">
                {MONTHS_LIST.map(m => {
                  const comm = matrixState[m] || { paid: false, amount: 30, paidDate: '', notes: '' };
                  return (
                    <tr key={m} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-800">{m}</td>
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={comm.paid}
                          onChange={e => handleTogglePaid(m, e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="number"
                          step="0.01"
                          value={comm.amount || ''}
                          onChange={e => handleAmountChange(m, e.target.value)}
                          className="w-28 border border-emerald-300 rounded px-2.5 py-1 font-extrabold text-emerald-950 bg-white"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={comm.paidDate || ''}
                          onChange={e => handleDateChange(m, e.target.value)}
                          placeholder="MM/DD/AAAA"
                          className="border rounded px-2 py-1 w-32 bg-white"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={comm.notes || ''}
                          onChange={e => handleNotesChange(m, e.target.value)}
                          placeholder="Nota..."
                          className="w-full border rounded px-2 py-1 bg-white"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Comisiones</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
