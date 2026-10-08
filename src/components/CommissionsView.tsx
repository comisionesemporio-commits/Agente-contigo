import React, { useState, useMemo } from 'react';
import { ClientPolicy, CommissionItem, Agent } from '../types';
import {
  Lock, Unlock, Calendar, Search, Filter, ChevronDown,
  DollarSign, CheckCircle2, Clock, TrendingUp, PieChart, Edit
} from 'lucide-react';
import { MONTHS_LIST } from '../services/storage';

interface CommissionsViewProps {
  clients: ClientPolicy[];
  agents?: Agent[];
  selectedYear: string;
  customCarriers: string[];
  customSellers: string[];
  isUnlocked: boolean;
  onLock: () => void;
  onOpenPinModal: () => void;
  onOpenMatrixModal: (client: ClientPolicy) => void;
}

export function getClientCommission(client: ClientPolicy, year: string, month: string): CommissionItem {
  if (client.commissions && client.commissions[year] && client.commissions[year][month]) {
    return client.commissions[year][month];
  }
  if (year === String(client.createdYear || "2026") && month === (client.mesIngreso || "Enero")) {
    return {
      paid: String(client.pagoRealizado).toUpperCase() === 'TRUE',
      amount: 30.00,
      paidDate: client.ingresoFecha || "",
      notes: ""
    };
  }
  return { paid: false, amount: 30.00, paidDate: "", notes: "" };
}

export const CommissionsView: React.FC<CommissionsViewProps> = ({
  clients,
  agents,
  selectedYear,
  customCarriers,
  customSellers,
  isUnlocked,
  onLock,
  onOpenPinModal,
  onOpenMatrixModal
}) => {
  const [selectedMonth, setSelectedMonth] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [showSellerMenu, setShowSellerMenu] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [showAgentMenu, setShowAgentMenu] = useState(false);

  // If locked, render lock invitation screen
  if (!isUnlocked) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-10 text-center max-w-lg mx-auto my-8 space-y-4">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-2xl mx-auto border border-amber-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900 uppercase">
            Módulo de Comisiones Protegido
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Por seguridad y privacidad financiera, el acceso a las comisiones y liquidaciones multianuales requiere el PIN Maestro.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenPinModal}
          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2 mx-auto cursor-pointer"
        >
          <Unlock className="w-4 h-4" />
          <span>Ingresar PIN Maestro para Desbloquear</span>
        </button>
      </div>
    );
  }

  const yearClients = clients.filter(c => String(c.createdYear || "2026") === String(selectedYear));

  // Dynamic available agents list
  const availableAgents = useMemo(() => {
    const set = new Set<string>();
    if (agents) {
      agents.forEach(a => {
        const full = `${a.nombre} ${a.apellido || ''}`.trim();
        if (full) set.add(full);
      });
    }
    yearClients.forEach(c => {
      if (c.agente && c.agente.trim()) set.add(c.agente.trim());
    });
    if (set.size === 0) {
      set.add("Virginia García");
      set.add("Junior Pérez");
      set.add("Carlos Mendoza");
      set.add("Dani Rodríguez");
    }
    return Array.from(set).sort();
  }, [agents, yearClients]);

  const filteredClients = yearClients.filter(c => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match = (c.nombre || '').toLowerCase().includes(q) ||
        (c.ssn || '').includes(q) ||
        (c.vendedor || '').toLowerCase().includes(q) ||
        (c.agente || '').toLowerCase().includes(q) ||
        (c.numPoliza || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (carrierFilter && c.carrier !== carrierFilter) return false;

    // Filter by Vendedor
    if (selectedSellers.length > 0 && !selectedSellers.includes((c.vendedor || 'General').trim())) {
      return false;
    }

    // Filter by Agente
    if (selectedAgents.length > 0) {
      const clientAgent = (c.agente || c.vendedor || 'General').trim();
      const match = selectedAgents.some(ag =>
        ag.toLowerCase() === clientAgent.toLowerCase() ||
        clientAgent.toLowerCase().includes(ag.toLowerCase()) ||
        ag.toLowerCase().includes(clientAgent.toLowerCase())
      );
      if (!match) return false;
    }

    return true;
  });

  const displayMonths = selectedMonth === 'TODOS' ? MONTHS_LIST : [selectedMonth];

  let paidSumPeriod = 0;
  let pendingSumPeriod = 0;
  let annualTotalSum = 0;
  let paidCount = 0;
  let pendingCount = 0;
  const carrierBreakdown: Record<string, number> = {};

  filteredClients.forEach(c => {
    displayMonths.forEach(m => {
      const comm = getClientCommission(c, selectedYear, m);
      const amt = comm.amount || 30.00;
      if (comm.paid) {
        paidSumPeriod += amt;
        paidCount++;
        carrierBreakdown[c.carrier || 'General'] = (carrierBreakdown[c.carrier || 'General'] || 0) + amt;
      } else {
        pendingSumPeriod += amt;
        pendingCount++;
      }
    });

    MONTHS_LIST.forEach(m => {
      const comm = getClientCommission(c, selectedYear, m);
      if (comm.paid) annualTotalSum += (comm.amount || 30.00);
    });
  });

  const toggleSeller = (name: string) => {
    if (selectedSellers.includes(name)) {
      setSelectedSellers(selectedSellers.filter(s => s !== name));
    } else {
      setSelectedSellers([...selectedSellers, name]);
    }
  };

  const toggleAgent = (name: string) => {
    if (selectedAgents.includes(name)) {
      setSelectedAgents(selectedAgents.filter(a => a !== name));
    } else {
      setSelectedAgents([...selectedAgents, name]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border border-slate-800">
        <div>
          <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[10px] font-bold uppercase tracking-wider inline-block mb-1">
            <Lock className="w-3 h-3 inline mr-1" />
            Acceso Autorizado con PIN
          </span>
          <h2 className="text-lg font-bold flex items-center text-emerald-400">
            <DollarSign className="w-5 h-5 mr-1 text-emerald-400" />
            Matriz de Comisiones Mensuales e Histórico Multianual ({selectedYear})
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Desglose exacto de cobros y montos por cliente y compañía mes a mes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 flex-1 lg:flex-none">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-bold uppercase text-emerald-300">Mes:</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-slate-900 text-white text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="TODOS">📅 Vista Anual Completa (12 Meses)</option>
              {MONTHS_LIST.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onLock}
            className="bg-amber-600/90 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloquear</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        {/* Search Input */}
        <div className="sm:col-span-2 lg:col-span-2 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, Social, Póliza, Vendedor o Agente..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
          />
        </div>

        {/* Carrier Filter */}
        <div>
          <select
            value={carrierFilter}
            onChange={e => setCarrierFilter(e.target.value)}
            className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-800 bg-white"
          >
            <option value="">Todas las Aseguradoras</option>
            {customCarriers.map(car => (
              <option key={car} value={car}>{car}</option>
            ))}
          </select>
        </div>

        {/* Sellers Filter (Multi-select) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowSellerMenu(!showSellerMenu); setShowAgentMenu(false); }}
            className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs font-extrabold text-slate-800 bg-white flex items-center justify-between focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <span className="truncate">
              {selectedSellers.length === 0
                ? '👤 Vendedores: Todos'
                : selectedSellers.length === 1
                ? `👤 ${selectedSellers[0]}`
                : `👥 ${selectedSellers.length} Vendedores`}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
          </button>

          {showSellerMenu && (
            <div className="absolute z-40 right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 space-y-1 max-h-56 overflow-y-auto text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1 px-1">
                <span className="font-extrabold text-[10px] text-slate-400 uppercase">Vendedores</span>
                <button
                  type="button"
                  onClick={() => { setSelectedSellers([]); setShowSellerMenu(false); }}
                  className="text-[10px] text-emerald-600 font-bold hover:underline"
                >
                  Limpiar
                </button>
              </div>
              {customSellers.map(v => (
                <label key={v} className="flex items-center space-x-2 px-1 py-1 hover:bg-slate-50 rounded cursor-pointer text-slate-800 font-semibold text-xs">
                  <input
                    type="checkbox"
                    checked={selectedSellers.includes(v)}
                    onChange={() => toggleSeller(v)}
                    className="w-3.5 h-3.5 text-emerald-600 rounded"
                  />
                  <span>👤 {v}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Agents Filter (Multi-select) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowAgentMenu(!showAgentMenu); setShowSellerMenu(false); }}
            className="w-full py-2 px-3 border border-indigo-200 rounded-lg text-xs font-extrabold text-indigo-950 bg-indigo-50/60 hover:bg-indigo-50 flex items-center justify-between focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <span className="truncate">
              {selectedAgents.length === 0
                ? '🎖️ Agentes: Todos'
                : selectedAgents.length === 1
                ? `🎖️ ${selectedAgents[0]}`
                : `👥 ${selectedAgents.length} Agentes`}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-indigo-500 ml-1 shrink-0" />
          </button>

          {showAgentMenu && (
            <div className="absolute z-40 right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 space-y-1 max-h-56 overflow-y-auto text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1 px-1">
                <span className="font-extrabold text-[10px] text-indigo-600 uppercase">Agentes con Licencia</span>
                <button
                  type="button"
                  onClick={() => { setSelectedAgents([]); setShowAgentMenu(false); }}
                  className="text-[10px] text-indigo-600 font-bold hover:underline"
                >
                  Limpiar
                </button>
              </div>
              {availableAgents.map(ag => (
                <label key={ag} className="flex items-center space-x-2 px-1 py-1 hover:bg-indigo-50/60 rounded cursor-pointer text-slate-800 font-semibold text-xs">
                  <input
                    type="checkbox"
                    checked={selectedAgents.includes(ag)}
                    onChange={() => toggleAgent(ag)}
                    className="w-3.5 h-3.5 text-indigo-600 rounded"
                  />
                  <span>🎖️ {ag}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase block">Cobradas del Periodo</span>
            <h4 className="text-2xl font-black text-emerald-900 mt-1 tabular-nums">
              ${paidSumPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h4>
            <span className="text-[11px] text-emerald-700 font-semibold">{paidCount} comisiones pagadas</span>
          </div>
          <div className="w-10 h-10 bg-emerald-200 text-emerald-800 rounded-full flex items-center justify-center text-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-800 uppercase block">Por Cobrar del Periodo</span>
            <h4 className="text-2xl font-black text-amber-900 mt-1 tabular-nums">
              ${pendingSumPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h4>
            <span className="text-[11px] text-amber-700 font-semibold">{pendingCount} pendientes</span>
          </div>
          <div className="w-10 h-10 bg-amber-200 text-amber-800 rounded-full flex items-center justify-center text-lg">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-cyan-50 border border-cyan-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-cyan-800 uppercase block">Total Acumulado Anual</span>
            <h4 className="text-2xl font-black text-cyan-900 mt-1 tabular-nums">
              ${annualTotalSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h4>
            <span className="text-[11px] text-cyan-700 font-semibold">Año {selectedYear}</span>
          </div>
          <div className="w-10 h-10 bg-cyan-200 text-cyan-800 rounded-full flex items-center justify-center text-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm">
          <span className="text-xs font-bold text-slate-800 uppercase block mb-1.5 flex items-center gap-1">
            <PieChart className="w-3.5 h-3.5 text-emerald-600" />
            Desglose Aseguradora
          </span>
          <div className="space-y-1 text-xs max-h-20 overflow-y-auto">
            {Object.keys(carrierBreakdown).length === 0 ? (
              <span className="text-slate-400 text-[11px]">Sin cobros registrados aún</span>
            ) : (
              Object.entries(carrierBreakdown).map(([car, val]) => (
                <div key={car} className="flex justify-between items-center text-[11px]">
                  <span className="font-semibold text-slate-700 truncate">{car}:</span>
                  <span className="font-bold text-emerald-800 font-mono">${val.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Commission Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-200 uppercase font-semibold text-[11px] sticky top-0 whitespace-nowrap">
              <tr>
                <th className="p-3">Cliente Titular</th>
                <th className="p-3">Vendedor / Agente</th>
                <th className="p-3">Compañía</th>
                {displayMonths.map(m => (
                  <th key={m} className="p-2 text-center">{m.substring(0, 3)}</th>
                ))}
                <th className="p-3 text-right">Total Período</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={displayMonths.length + 5} className="p-10 text-center text-slate-400 font-semibold">
                    No se encontraron registros de comisiones para este filtro.
                  </td>
                </tr>
              ) : (
                filteredClients.map(c => {
                  let rowTotal = 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 border-b border-slate-100 text-xs">
                      <td className="p-3 font-extrabold text-slate-900 whitespace-nowrap">
                        {c.nombre}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-amber-800 flex items-center gap-1">
                          <span>👤</span>
                          <span>{c.vendedor || 'General'}</span>
                        </div>
                        {c.agente && (
                          <div className="text-[10px] font-semibold text-indigo-700 mt-0.5 flex items-center gap-1">
                            <span>🎖️</span>
                            <span>{c.agente}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                          {c.carrier || 'General'}
                        </span>
                      </td>

                      {displayMonths.map(m => {
                        const comm = getClientCommission(c, selectedYear, m);
                        const amt = comm.amount || 30.00;
                        if (comm.paid) rowTotal += amt;

                        return (
                          <td key={m} className="p-1 text-center font-mono text-[10px] whitespace-nowrap">
                            <span
                              className={`border px-1.5 py-0.5 rounded block ${
                                comm.paid
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {comm.paid ? '✓ ' : ''}${amt.toFixed(0)}
                            </span>
                          </td>
                        );
                      })}

                      <td className="p-3 text-right font-mono font-black text-emerald-950 whitespace-nowrap bg-emerald-50/40">
                        ${rowTotal.toFixed(2)}
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenMatrixModal(c)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[11px] transition border border-emerald-200 flex items-center gap-1 mx-auto"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Matriz</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
