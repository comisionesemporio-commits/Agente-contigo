import React, { useState } from 'react';
import { ClientPolicy } from '../types';
import {
  FileText, Users, Calculator, Building, UserCheck,
  AlertTriangle, XCircle, RotateCcw, ChevronDown, CheckCircle2
} from 'lucide-react';
import { MONTHS_LIST } from '../services/storage';

interface MonthlyReportsViewProps {
  clients: ClientPolicy[];
  selectedYear: string;
  customSellers: string[];
}

export const MonthlyReportsView: React.FC<MonthlyReportsViewProps> = ({
  clients,
  selectedYear,
  customSellers
}) => {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [showMonthMenu, setShowMonthMenu] = useState(false);
  const [showSellerMenu, setShowSellerMenu] = useState(false);

  const yearClients = clients.filter(c => String(c.createdYear || "2026") === String(selectedYear));

  // Build full list of unique sellers in this year + customSellers + "General"
  const allKnownSellers = Array.from(
    new Set([
      "General",
      ...customSellers,
      ...yearClients.map(c => (c.vendedor || 'General').trim())
    ])
  ).sort();

  // Filter clients by both selected months AND selected sellers
  const filteredClients = yearClients.filter(c => {
    const matchMonth = selectedMonths.length === 0 || selectedMonths.includes(c.mesIngreso);
    const sellerName = (c.vendedor || 'General').trim();
    const matchSeller = selectedSellers.length === 0 || selectedSellers.includes(sellerName);
    return matchMonth && matchSeller;
  });

  // BLOCK 1: Activas
  const activeClients = filteredClients.filter(c => c.estatus !== 'Cancelado' && c.estatus !== 'Robado');
  const totalActiveApps = activeClients.length;
  let totalActivePeople = 0;
  const activeCarrierMap: Record<string, { apps: number; people: number }> = {};
  const activeSellerMap: Record<string, { apps: number; people: number }> = {};

  activeClients.forEach(c => {
    const persons = 1 + (parseInt(String(c.numDependientes)) || 0);
    totalActivePeople += persons;

    const carrier = c.carrier || 'General';
    if (!activeCarrierMap[carrier]) activeCarrierMap[carrier] = { apps: 0, people: 0 };
    activeCarrierMap[carrier].apps++;
    activeCarrierMap[carrier].people += persons;

    const seller = (c.vendedor || 'General').trim();
    if (!activeSellerMap[seller]) activeSellerMap[seller] = { apps: 0, people: 0 };
    activeSellerMap[seller].apps++;
    activeSellerMap[seller].people += persons;
  });

  const avgPeoplePerApp = totalActiveApps > 0 ? (totalActivePeople / totalActiveApps).toFixed(1) : "0.0";

  // BLOCK 2: Canceladas y Robadas
  const inactiveClients = filteredClients.filter(c => c.estatus === 'Cancelado' || c.estatus === 'Robado');
  const totalInactiveApps = inactiveClients.length;
  let totalInactivePeople = 0;
  let onlyCancelledCount = 0;
  let onlyStolenCount = 0;
  const inactiveBreakdownMap: Record<string, { cancelled: number; stolen: number; total: number; people: number }> = {};

  inactiveClients.forEach(c => {
    const persons = 1 + (parseInt(String(c.numDependientes)) || 0);
    totalInactivePeople += persons;

    if (c.estatus === 'Cancelado') onlyCancelledCount++;
    if (c.estatus === 'Robado') onlyStolenCount++;

    const key = `${c.carrier || 'General'} / 👤 ${c.vendedor || 'General'}`;
    if (!inactiveBreakdownMap[key]) {
      inactiveBreakdownMap[key] = { cancelled: 0, stolen: 0, total: 0, people: 0 };
    }
    if (c.estatus === 'Cancelado') inactiveBreakdownMap[key].cancelled++;
    if (c.estatus === 'Robado') inactiveBreakdownMap[key].stolen++;
    inactiveBreakdownMap[key].total++;
    inactiveBreakdownMap[key].people += persons;
  });

  const toggleMonth = (m: string) => {
    if (selectedMonths.includes(m)) {
      setSelectedMonths(selectedMonths.filter(x => x !== m));
    } else {
      setSelectedMonths([...selectedMonths, m]);
    }
  };

  const toggleSeller = (s: string) => {
    if (selectedSellers.includes(s)) {
      setSelectedSellers(selectedSellers.filter(x => x !== s));
    } else {
      setSelectedSellers([...selectedSellers, s]);
    }
  };

  const resetFilters = () => {
    setSelectedMonths([]);
    setSelectedSellers([]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-emerald-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider inline-block mb-2">
            Centro de Conteo Mensual
          </span>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Reporte Visual de Aplicaciones y Aplicantes en <span className="text-amber-400">{selectedYear}</span>
          </h2>
          <p className="text-xs text-emerald-200/80 mt-1">
            Métricas precisas: Pólizas Activas separadas de Canceladas y Robadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          {/* Seller Filter */}
          <div className="relative min-w-[200px]">
            <button
              type="button"
              onClick={() => setShowSellerMenu(!showSellerMenu)}
              className="w-full py-2 px-3 border border-slate-700 rounded-xl text-xs font-bold text-white bg-slate-950/80 flex items-center justify-between focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <span className="truncate text-amber-300">
                👤 {selectedSellers.length === 0
                  ? 'Vendedor: Todos'
                  : selectedSellers.length === 1
                  ? selectedSellers[0]
                  : `${selectedSellers.length} Vendedores`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-amber-400 ml-1 shrink-0" />
            </button>

            {showSellerMenu && (
              <div className="absolute z-40 right-0 left-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 space-y-1 max-h-60 overflow-y-auto text-xs text-white">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1 px-1">
                  <span className="font-extrabold text-[10px] text-amber-400 uppercase">Vendedores</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedSellers([]); setShowSellerMenu(false); }}
                    className="text-[10px] text-slate-400 hover:text-white font-bold"
                  >
                    Limpiar
                  </button>
                </div>
                {allKnownSellers.map(v => (
                  <label key={v} className="flex items-center space-x-2 px-1.5 py-1 hover:bg-slate-800 rounded cursor-pointer text-slate-200 font-semibold text-xs">
                    <input
                      type="checkbox"
                      checked={selectedSellers.includes(v)}
                      onChange={() => toggleSeller(v)}
                      className="w-3.5 h-3.5 text-amber-500 rounded focus:ring-amber-500"
                    />
                    <span>👤 {v}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Month Filter */}
          <div className="relative min-w-[200px]">
            <button
              type="button"
              onClick={() => setShowMonthMenu(!showMonthMenu)}
              className="w-full py-2 px-3 border border-slate-700 rounded-xl text-xs font-bold text-white bg-slate-950/80 flex items-center justify-between focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <span className="truncate text-emerald-300">
                📅 {selectedMonths.length === 0
                  ? 'Meses: Todos'
                  : selectedMonths.length === 1
                  ? selectedMonths[0]
                  : `${selectedMonths.length} Meses`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-400 ml-1 shrink-0" />
            </button>

            {showMonthMenu && (
              <div className="absolute z-40 right-0 left-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 space-y-1 max-h-60 overflow-y-auto text-xs text-white">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1 px-1">
                  <span className="font-extrabold text-[10px] text-emerald-400 uppercase">Seleccionar Meses</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedMonths([]); setShowMonthMenu(false); }}
                    className="text-[10px] text-slate-400 hover:text-white font-bold"
                  >
                    Limpiar
                  </button>
                </div>
                {MONTHS_LIST.map(m => (
                  <label key={m} className="flex items-center space-x-2 px-1.5 py-1 hover:bg-slate-800 rounded cursor-pointer text-slate-200 font-semibold text-xs">
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(m)}
                      onChange={() => toggleMonth(m)}
                      className="w-3.5 h-3.5 text-emerald-500 rounded focus:ring-emerald-500"
                    />
                    <span>📅 {m}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition border border-slate-700 flex items-center gap-1.5"
            title="Restablecer filtros"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {/* BLOQUE 1: PÓLIZAS ACTIVAS */}
      <div className="bg-emerald-50/40 border-2 border-emerald-500/30 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
          <div>
            <h3 className="text-sm font-black text-emerald-950 uppercase tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              SECCIÓN ACTIVAS (Aplicaciones & Aplicantes)
            </h3>
            <p className="text-xs text-emerald-800 font-medium">
              Pólizas vigentes con desglose de beneficiarios y miembros.
            </p>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full border border-emerald-300">
            🟢 Bloque Exclusivo Activas
          </span>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                Aplicaciones Activas
              </span>
              <h4 className="text-3xl font-black text-emerald-900 tabular-nums">
                {totalActiveApps} Apps
              </h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center text-xl font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-teal-800 uppercase tracking-wider block">
                Aplicantes Activos Totales
              </span>
              <h4 className="text-3xl font-black text-teal-900 tabular-nums">
                {totalActivePeople} Personas
              </h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center space-x-4 sm:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-xl font-bold">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-cyan-800 uppercase tracking-wider block">
                Promedio Aplicantes / App
              </span>
              <h4 className="text-3xl font-black text-cyan-900 tabular-nums">
                {avgPeoplePerApp}
              </h4>
            </div>
          </div>
        </div>

        {/* Breakdown Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Carriers Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
              <Building className="w-4 h-4 text-emerald-600" />
              Compañías (Aplicaciones Activas)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-emerald-900 text-white uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Compañía</th>
                    <th className="p-2 text-center">Apps Activas</th>
                    <th className="p-2 text-right">Aplicantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.keys(activeCarrierMap).length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center text-slate-400">Sin datos</td></tr>
                  ) : (
                    Object.entries(activeCarrierMap).map(([car, d]) => (
                      <tr key={car} className="hover:bg-emerald-50/50">
                        <td className="p-2 font-bold text-slate-900">{car}</td>
                        <td className="p-2 text-center font-mono font-black text-emerald-900">{d.apps}</td>
                        <td className="p-2 text-right font-mono font-black text-teal-800">{d.people} Pers.</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sellers Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-teal-600" />
              Agentes / Vendedores (Aplicaciones Activas)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-teal-900 text-white uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Agente / Vendedor</th>
                    <th className="p-2 text-center">Apps Activas</th>
                    <th className="p-2 text-right">Aplicantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.keys(activeSellerMap).length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center text-slate-400">Sin datos</td></tr>
                  ) : (
                    Object.entries(activeSellerMap).map(([sel, d]) => (
                      <tr key={sel} className="hover:bg-teal-50/50">
                        <td className="p-2 font-bold text-slate-900">👤 {sel}</td>
                        <td className="p-2 text-center font-mono font-black text-teal-900">{d.apps}</td>
                        <td className="p-2 text-right font-mono font-black text-emerald-800">{d.people} Pers.</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 2: CANCELADAS / ROBADAS */}
      <div className="bg-rose-50/40 border-2 border-rose-500/30 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-rose-200/60 pb-3">
          <div>
            <h3 className="text-sm font-black text-rose-950 uppercase tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              SECCIÓN CANCELADAS O ROBADAS (Independiente)
            </h3>
            <p className="text-xs text-rose-800 font-medium">
              Contabiliza pólizas dadas de baja o transferidas por otros brokers.
            </p>
          </div>
          <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-extrabold rounded-full border border-rose-300">
            🔴 Canceladas / Robadas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg font-bold">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-rose-800 uppercase block">Total Inactivas</span>
              <h4 className="text-2xl font-black text-rose-900 tabular-nums">{totalInactiveApps} Apps</h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-purple-800 uppercase block">Aplicantes Afectados</span>
              <h4 className="text-2xl font-black text-purple-900 tabular-nums">{totalInactivePeople} Personas</h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center text-lg font-bold">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Solo Canceladas</span>
              <h4 className="text-2xl font-black text-rose-700 tabular-nums">{onlyCancelledCount}</h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center text-lg font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Solo Robadas</span>
              <h4 className="text-2xl font-black text-purple-700 tabular-nums">{onlyStolenCount}</h4>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h4 className="text-xs font-black text-rose-900 uppercase flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Detalle por Compañía y Agente
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Compañía / Origen</th>
                  <th className="p-2.5 text-center">🔴 Canceladas</th>
                  <th className="p-2.5 text-center">🟣 Robadas</th>
                  <th className="p-2.5 text-center">Total Inactivas</th>
                  <th className="p-2.5 text-right">Aplicantes Perdidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.keys(inactiveBreakdownMap).length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin canceladas o robadas para la selección</td></tr>
                ) : (
                  Object.entries(inactiveBreakdownMap).map(([k, d]) => (
                    <tr key={k} className="hover:bg-rose-50/50">
                      <td className="p-2.5 font-bold text-slate-800">{k}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-rose-600">{d.cancelled}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-purple-600">{d.stolen}</td>
                      <td className="p-2.5 text-center font-mono font-black text-slate-900">{d.total}</td>
                      <td className="p-2.5 text-right font-mono font-black text-rose-800">{d.people} Pers.</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
