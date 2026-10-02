import React, { useState } from 'react';
import { ClientPolicy } from '../types';
import {
  Users, CheckCircle2, XCircle, ShieldAlert, DollarSign,
  Search, RotateCcw, Filter, ChevronDown, Edit, Lock, Unlock,
  CreditCard, Calendar, Phone, MapPin, Building, Gift
} from 'lucide-react';
import { MONTHS_LIST } from '../services/storage';

export function getClientBirthMonth(dbo?: string): number | null {
  if (!dbo) return null;
  const str = dbo.trim();
  if (!str) return null;

  // Case 1: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const month = parseInt(isoMatch[2], 10);
    if (month >= 1 && month <= 12) return month;
  }

  // Case 2: MM/DD/YYYY or MM-DD-YYYY
  const usMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (usMatch) {
    const month = parseInt(usMatch[1], 10);
    if (month >= 1 && month <= 12) return month;
  }

  // Case 3: Spanish month name in text
  const lower = str.toLowerCase();
  const spanishMonths = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  for (let i = 0; i < spanishMonths.length; i++) {
    if (lower.includes(spanishMonths[i])) return i + 1;
  }

  // Case 4: English abbreviations
  const englishMonths = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];
  for (let i = 0; i < englishMonths.length; i++) {
    if (lower.includes(englishMonths[i])) return i + 1;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.getMonth() + 1;
  }

  return null;
}

interface PoliciesViewProps {
  clients: ClientPolicy[];
  selectedYear: string;
  customSellers: string[];
  customCarriers: string[];
  customStatuses: string[];
  isCommissionUnlocked: boolean;
  onOpenPinModal: (target?: string) => void;
  onEditClient: (client: ClientPolicy) => void;
  onRefreshData: () => void;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  clients,
  selectedYear,
  customSellers,
  customCarriers,
  customStatuses,
  isCommissionUnlocked,
  onOpenPinModal,
  onEditClient,
  onRefreshData
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterSeller, setFilterSeller] = useState<string[]>([]);
  const [filterState, setFilterState] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterBirthMonth, setFilterBirthMonth] = useState('');
  const [showSellerMenu, setShowSellerMenu] = useState(false);

  // Filter clients by active year
  const yearClients = clients.filter(c => String(c.createdYear || "2026") === String(selectedYear));

  // Unique US states in current list
  const uniqueStates = Array.from(new Set(yearClients.map(c => (c.estadoUSA || 'GA').trim().toUpperCase()))).filter(Boolean).sort();
  if (uniqueStates.length === 0) uniqueStates.push("GA", "FL", "TX", "NJ", "NC");

  const filteredClients = yearClients.filter(c => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match = (c.nombre || '').toLowerCase().includes(q) ||
        (c.nombrePlan || '').toLowerCase().includes(q) ||
        (c.ssn || '').includes(q) ||
        (c.vendedor || '').toLowerCase().includes(q) ||
        (c.numPoliza || '').toLowerCase().includes(q) ||
        (c.telefono || '').includes(q) ||
        (c.bancoNombre || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filterSeller.length > 0 && !filterSeller.includes((c.vendedor || 'General').trim())) {
      return false;
    }

    if (filterState && (c.estadoUSA || '').toUpperCase() !== filterState.toUpperCase()) {
      return false;
    }

    if (filterStatus) {
      if (filterStatus === 'Nuevo por procesar') {
        if (c.estatus !== 'Nuevo' && c.estatus !== 'Subido / Listo' && c.estatus !== 'Pendiente') return false;
      } else if (filterStatus === 'Activos') {
        if (c.estatus !== 'Activo') return false;
      } else if (filterStatus === 'Cancelados y robados') {
        if (c.estatus !== 'Cancelado' && c.estatus !== 'Robado') return false;
      } else if (c.estatus !== filterStatus) {
        return false;
      }
    }

    if (filterPayment) {
      const isPaid = String(c.pagoRealizado).toUpperCase() === 'TRUE';
      if (filterPayment === 'TRUE' && !isPaid) return false;
      if (filterPayment === 'FALSE' && isPaid) return false;
    }

    if (filterCarrier && c.carrier !== filterCarrier) return false;
    if (filterMonth && c.mesIngreso !== filterMonth) return false;

    if (filterBirthMonth) {
      const birthMonth = getClientBirthMonth(c.dbo);
      if (filterBirthMonth === 'este_mes') {
        const currentMonthNumber = new Date().getMonth() + 1;
        if (birthMonth !== currentMonthNumber) return false;
      } else {
        const targetMonthNum = parseInt(filterBirthMonth, 10);
        if (birthMonth !== targetMonthNum) return false;
      }
    }

    return true;
  });

  const resetFilters = () => {
    setSearchTerm('');
    setFilterPayment('');
    setFilterSeller([]);
    setFilterState('');
    setFilterStatus('');
    setFilterCarrier('');
    setFilterMonth('');
    setFilterBirthMonth('');
  };

  const toggleSellerSelect = (sellerName: string) => {
    if (filterSeller.includes(sellerName)) {
      setFilterSeller(filterSeller.filter(s => s !== sellerName));
    } else {
      setFilterSeller([...filterSeller, sellerName]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
            <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-extrabold text-indigo-950 text-[11px] uppercase">
              Estado de Pago:
            </span>
            <select
              value={filterPayment}
              onChange={e => setFilterPayment(e.target.value)}
              className="bg-white border border-indigo-300 text-indigo-950 text-xs font-black rounded-lg px-2 py-0.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="">💳 Todos los Pagos</option>
              <option value="TRUE">🟢 Al día (Pago Realizado)</option>
              <option value="FALSE">🔴 Pendientes de pago</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onRefreshData}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition text-xs border border-emerald-300 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Sincronizar</span>
            </button>

            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-xs border border-slate-300 flex items-center gap-1"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Limpiar Filtros</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar Cliente, Plan..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
            />
          </div>

          {/* Seller Multi-select Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSellerMenu(!showSellerMenu)}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white flex items-center justify-between focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <span className="truncate">
                {filterSeller.length === 0
                  ? '👤 Todos los Vendedores'
                  : filterSeller.length === 1
                  ? `👤 ${filterSeller[0]}`
                  : `👥 ${filterSeller.length} Vendedores`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
            </button>

            {showSellerMenu && (
              <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 space-y-1 max-h-56 overflow-y-auto text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1 px-1">
                  <span className="font-extrabold text-[10px] text-slate-400 uppercase">Vendedores</span>
                  <button
                    type="button"
                    onClick={() => { setFilterSeller([]); setShowSellerMenu(false); }}
                    className="text-[10px] text-emerald-600 font-bold hover:underline"
                  >
                    Limpiar
                  </button>
                </div>
                {customSellers.map(v => (
                  <label key={v} className="flex items-center space-x-2 px-1 py-1 hover:bg-slate-50 rounded cursor-pointer text-slate-800 font-semibold">
                    <input
                      type="checkbox"
                      checked={filterSeller.includes(v)}
                      onChange={() => toggleSellerSelect(v)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>👤 {v}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* US State */}
          <div>
            <select
              value={filterState}
              onChange={e => setFilterState(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-slate-800 bg-white"
            >
              <option value="">📍 Todos los Estados (EE.UU.)</option>
              {uniqueStates.map(st => (
                <option key={st} value={st}>📍 {st}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-slate-900 bg-slate-50"
            >
              <option value="">⚡ Todos los Estatus</option>
              <option value="Nuevo por procesar">🔵 Nuevo por procesar</option>
              <option value="Activos">🟢 Activos</option>
              <option value="Cancelados y robados">🔴/🟣 Cancelados y robados</option>
              {customStatuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Carrier */}
          <div>
            <select
              value={filterCarrier}
              onChange={e => setFilterCarrier(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium bg-white"
            >
              <option value="">Todas las Compañías</option>
              {customCarriers.map(car => (
                <option key={car} value={car}>{car}</option>
              ))}
            </select>
          </div>

          {/* Mes de Ingreso */}
          <div>
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-extrabold text-emerald-900 bg-emerald-50 cursor-pointer"
            >
              <option value="">📅 Mes de Ingreso</option>
              {MONTHS_LIST.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Mes de Cumpleaños */}
          <div>
            <select
              value={filterBirthMonth}
              onChange={e => setFilterBirthMonth(e.target.value)}
              className="w-full py-2 px-3 border border-pink-300 rounded-lg text-xs focus:ring-2 focus:ring-pink-500 focus:outline-none font-extrabold text-pink-900 bg-pink-50 cursor-pointer shadow-sm"
              title="Filtrar por mes de cumpleaños del cliente"
            >
              <option value="">🎂 Mes Cumpleaños</option>
              <option value="este_mes">🎉 Cumpleaños Este Mes</option>
              {MONTHS_LIST.map((m, idx) => (
                <option key={m} value={String(idx + 1)}>
                  🎂 {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-200 uppercase font-semibold tracking-wider text-[11px] sticky top-0 whitespace-nowrap">
              <tr>
                <th className="p-3">Estatus</th>
                <th className="p-3">Nombres y Apellidos</th>
                <th className="p-3">Compañía & Plan</th>
                <th className="p-3">Físico (Peso/Alt)</th>
                <th className="p-3">Edad / D.B.O</th>
                <th className="p-3">Miembros</th>
                <th className="p-3">Social</th>
                <th className="p-3">Teléfono / Contacto</th>
                <th className="p-3">Vendedor</th>
                <th className="p-3">Método / Banco</th>
                <th className="p-3">Activo desde</th>
                <th className="p-3">Ingreso ($)</th>
                <th className="p-3">Prima ($)</th>
                <th className="p-3">Pago</th>
                <th className="p-3 text-right">Comisión</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={16} className="p-10 text-center text-slate-400 font-semibold">
                    No se encontraron pólizas coincidentes para el año {selectedYear}
                  </td>
                </tr>
              ) : (
                filteredClients.map(c => {
                  const isPaid = String(c.pagoRealizado).toUpperCase() === 'TRUE';
                  const isCancel = c.estatus === 'Cancelado';
                  const isRobado = c.estatus === 'Robado';
                  const isNew = c.estatus === 'Nuevo' || c.estatus === 'Subido / Listo' || c.estatus === 'Pendiente';

                  let rowBorder = 'border-l-4 border-l-emerald-500';
                  let rowBg = 'hover:bg-slate-50/80';
                  if (isCancel) {
                    rowBorder = 'border-l-4 border-l-rose-500';
                    rowBg = 'bg-rose-50/40 hover:bg-rose-50/70';
                  } else if (isRobado) {
                    rowBorder = 'border-l-4 border-l-purple-500';
                    rowBg = 'bg-purple-50/40 hover:bg-purple-50/70';
                  } else if (isNew) {
                    rowBorder = 'border-l-4 border-l-blue-500';
                    rowBg = 'bg-blue-50/30 hover:bg-blue-50/60';
                  }

                  const commDisplay = isCommissionUnlocked
                    ? `$30.00 (${isPaid ? 'Cobrado' : 'Pendiente'})`
                    : '🔒 $***';

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onEditClient(c)}
                      className={`${rowBorder} ${rowBg} transition cursor-pointer text-xs`}
                    >
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center ${
                          c.estatus === 'Activo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCancel
                            ? 'bg-rose-100 text-rose-800'
                            : isRobado
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1"></span>
                          {c.estatus || 'Activo'}
                        </span>
                      </td>

                      <td className="p-3 whitespace-nowrap font-black text-slate-900">
                        {c.nombre || 'Sin Nombre'}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded-md font-bold text-[10px]">
                          {c.carrier || 'General'}
                        </span>
                        <div className="text-[10px] font-extrabold text-indigo-700 mt-0.5 truncate max-w-[150px]">
                          {c.nombrePlan || '-'}
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap font-bold text-slate-700 text-[10px]">
                        <div>⚖️ {c.peso || '-'}</div>
                        <div>📏 {c.altura || '-'}</div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{c.edad || 0} años</div>
                        <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                          <span>🎂 {c.dbo || '-'}</span>
                          {getClientBirthMonth(c.dbo) === (new Date().getMonth() + 1) && (
                            <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full text-[9px] font-black border border-pink-300 animate-pulse inline-flex items-center gap-0.5" title="¡Cumpleaños este mes!">
                              <Gift className="w-2.5 h-2.5" />
                              <span>¡Este mes!</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap font-bold text-purple-700">
                        {c.numDependientes || 0}
                      </td>

                      <td className="p-3 whitespace-nowrap font-mono font-bold text-slate-800">
                        {c.ssn || '-'}
                      </td>

                      <td className="p-3 min-w-[170px]">
                        <div className="text-[10px] font-bold text-slate-800">📞 {c.telefono || '-'}</div>
                        <div className="text-[10px] text-slate-600 font-medium truncate max-w-[200px]">
                          {c.estadoUSA || 'GA'} - {c.direccion || '-'}
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap font-bold text-amber-800">
                        👤 {c.vendedor || 'General'}
                      </td>

                      <td className="p-3 whitespace-nowrap font-semibold text-slate-700 text-[10px]">
                        <div className="font-bold text-sky-800">🏦 {c.bancoNombre || c.metodoPago || '-'}</div>
                        <div className="font-mono text-slate-500">
                          {c.bancoCuenta ? '••••' + c.bancoCuenta.slice(-4) : ''}
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap font-bold text-emerald-700">
                        {c.mesIngreso || 'Enero'}
                      </td>

                      <td className="p-3 whitespace-nowrap font-mono font-bold text-emerald-700 tabular-nums">
                        ${(c.ingresoMonto || 0).toFixed(2)}
                      </td>

                      <td className="p-3 whitespace-nowrap font-mono font-bold text-teal-700 tabular-nums">
                        ${(c.primaMonto || 0).toFixed(2)}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {isPaid ? '🟢 SÍ' : '🔴 NO'}
                        </span>
                      </td>

                      <td className="p-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onOpenPinModal('polizas-cell')}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer bg-slate-100 text-slate-800 shadow-sm hover:bg-slate-200 transition"
                        >
                          {commDisplay}
                        </button>
                      </td>

                      <td className="p-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onEditClient(c)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition border border-emerald-200"
                          title="Editar expediente"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>Mostrando {filteredClients.length} de {yearClients.length} clientes del año {selectedYear}</span>
          <span className="text-slate-400 flex items-center gap-1">
            <Edit className="w-3 h-3" />
            Haz clic en una fila para modificar la póliza
          </span>
        </div>
      </div>
    </div>
  );
};
