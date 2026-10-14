import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ClientPolicy, Agent } from '../types';
import {
  Users, CheckCircle2, XCircle, ShieldAlert, DollarSign,
  Search, RotateCcw, Filter, ChevronDown, Edit, Lock, Unlock,
  CreditCard, Calendar, Phone, MapPin, Building, Gift, ShieldCheck,
  FileSpreadsheet, Upload, Download, FileText, Check,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight
} from 'lucide-react';
import { MONTHS_LIST } from '../services/storage';
import { exportToExcelFile, downloadExcelTemplate, parseExcelOrCSVBuffer } from '../services/excelService';

export function formatShortName(rawName?: string): string {
  if (!rawName) return 'Sin Nombre';
  const name = rawName.trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  if (parts.length === 3) {
    return `${parts[0]} ${parts[2]}`;
  }
  return `${parts[0]} ${parts[2] || parts[1]}`;
}

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
  agents?: Agent[];
  selectedYear: string;
  customSellers: string[];
  customCarriers: string[];
  customStatuses: string[];
  isCommissionUnlocked: boolean;
  onOpenPinModal: (target?: string) => void;
  onEditClient: (client: ClientPolicy) => void;
  onRefreshData: () => void;
  onImportClients?: (newClients: ClientPolicy[]) => void;
  onShowToast?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  clients,
  agents,
  selectedYear,
  customSellers,
  customCarriers,
  customStatuses,
  isCommissionUnlocked,
  onOpenPinModal,
  onEditClient,
  onRefreshData,
  onImportClients,
  onShowToast
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterSeller, setFilterSeller] = useState<string[]>([]);
  const [filterAgent, setFilterAgent] = useState<string[]>([]);
  const [filterState, setFilterState] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterBirthMonth, setFilterBirthMonth] = useState('');
  const [showSellerMenu, setShowSellerMenu] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);

  // Pagination state (default 20 as requested)
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filter clients by active year
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
        (c.agente || '').toLowerCase().includes(q) ||
        (c.numPoliza || '').toLowerCase().includes(q) ||
        (c.telefono || '').includes(q) ||
        (c.bancoNombre || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filterSeller.length > 0 && !filterSeller.includes((c.vendedor || 'General').trim())) {
      return false;
    }

    if (filterAgent.length > 0) {
      const clientAgent = (c.agente || c.vendedor || 'General').trim();
      const match = filterAgent.some(ag =>
        ag.toLowerCase() === clientAgent.toLowerCase() ||
        clientAgent.toLowerCase().includes(ag.toLowerCase()) ||
        ag.toLowerCase().includes(clientAgent.toLowerCase())
      );
      if (!match) return false;
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

  // Reset to first page when any search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterPayment, filterSeller, filterAgent, filterState, filterStatus, filterCarrier, filterMonth, filterBirthMonth, selectedYear]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedClients = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, safeCurrentPage, pageSize]);

  const resetFilters = () => {
    setSearchTerm('');
    setFilterPayment('');
    setFilterSeller([]);
    setFilterAgent([]);
    setFilterState('');
    setFilterStatus('');
    setFilterCarrier('');
    setFilterMonth('');
    setFilterBirthMonth('');
    setCurrentPage(1);
  };

  const toggleSellerSelect = (sellerName: string) => {
    if (filterSeller.includes(sellerName)) {
      setFilterSeller(filterSeller.filter(s => s !== sellerName));
    } else {
      setFilterSeller([...filterSeller, sellerName]);
    }
  };

  const toggleAgentSelect = (agentName: string) => {
    if (filterAgent.includes(agentName)) {
      setFilterAgent(filterAgent.filter(a => a !== agentName));
    } else {
      setFilterAgent([...filterAgent, agentName]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const { clients: importedClients, detectedHeaders } = parseExcelOrCSVBuffer(buffer, selectedYear);
        if (importedClients.length === 0) {
          onShowToast?.('Archivo sin datos', 'No se pudieron extraer registros de pólizas válidos. Revisa el formato o usa la Plantilla Excel.', 'error');
          return;
        }
        if (onImportClients) {
          onImportClients(importedClients);
        }
        onShowToast?.(
          '¡Importación Exitosa!',
          `Se cargaron ${importedClients.length} clientes con formato de columnas separadas.`,
          'success'
        );
      } catch (err: any) {
        console.error('Error al importar:', err);
        onShowToast?.('Error al leer archivo', err.message || 'Verifica que el archivo sea un Excel (.xlsx, .xls) o CSV válido.', 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-lg transition text-xs border border-slate-300 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Restablecer todos los filtros de búsqueda"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Limpiar Filtros</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 text-xs">
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
              onClick={() => { setShowSellerMenu(!showSellerMenu); setShowAgentMenu(false); }}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white flex items-center justify-between focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <span className="truncate">
                {filterSeller.length === 0
                  ? '👤 Vendedores: Todos'
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

          {/* Agent Multi-select Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowAgentMenu(!showAgentMenu); setShowSellerMenu(false); }}
              className="w-full py-2 px-3 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-950 bg-indigo-50/60 hover:bg-indigo-50 flex items-center justify-between focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <span className="truncate">
                {filterAgent.length === 0
                  ? '🎖️ Agentes: Todos'
                  : filterAgent.length === 1
                  ? `🎖️ ${filterAgent[0]}`
                  : `👥 ${filterAgent.length} Agentes`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-500 ml-1 shrink-0" />
            </button>

            {showAgentMenu && (
              <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 space-y-1 max-h-56 overflow-y-auto text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1 px-1">
                  <span className="font-extrabold text-[10px] text-indigo-600 uppercase">Agentes con Licencia</span>
                  <button
                    type="button"
                    onClick={() => { setFilterAgent([]); setShowAgentMenu(false); }}
                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                  >
                    Limpiar
                  </button>
                </div>
                {availableAgents.map(ag => (
                  <label key={ag} className="flex items-center space-x-2 px-1 py-1 hover:bg-indigo-50/60 rounded cursor-pointer text-slate-800 font-semibold">
                    <input
                      type="checkbox"
                      checked={filterAgent.includes(ag)}
                      onChange={() => toggleAgentSelect(ag)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded"
                    />
                    <span>🎖️ {ag}</span>
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
            <thead className="bg-slate-900 text-slate-200 uppercase font-bold tracking-wider text-[10px] sticky top-0 whitespace-nowrap">
              <tr>
                <th className="px-2.5 py-2">Estatus</th>
                <th className="px-2.5 py-2">Nombre y apellido</th>
                <th className="px-2.5 py-2">Personas Activas / Miembros</th>
                <th className="px-2.5 py-2">Fecha de nacimiento</th>
                <th className="px-2.5 py-2">Seguro Social</th>
                <th className="px-2.5 py-2">Compañías de seguros</th>
                <th className="px-2.5 py-2">Plan</th>
                <th className="px-2.5 py-2">Dirección</th>
                <th className="px-2.5 py-2">Vendedor</th>
                <th className="px-2.5 py-2">Prima ($)</th>
                <th className="px-2.5 py-2">Edad</th>
                <th className="px-2.5 py-2">Teléfono</th>
                <th className="px-2.5 py-2">Pago</th>
                <th className="px-2.5 py-2 text-right">Comisión</th>
                <th className="px-2.5 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={15} className="p-10 text-center text-slate-400 font-semibold">
                    No se encontraron pólizas coincidentes para el año {selectedYear}
                  </td>
                </tr>
              ) : (
                paginatedClients.map(c => {
                  const isPaid = String(c.pagoRealizado).toUpperCase() === 'TRUE';
                  const rawStatus = String(c.estatus || 'Activo').trim();
                  const lowerEst = rawStatus.toLowerCase();

                  // Limpieza: si tiene estatus migratorio (ciudadanos, residentes, etc.), tratarlo como Activo
                  const isMigratory = (
                    lowerEst.includes('ciudadan') ||
                    lowerEst.includes('resident') ||
                    lowerEst.includes('permiso') ||
                    lowerEst.includes('parole') ||
                    lowerEst.includes('daca') ||
                    lowerEst.includes('visa') ||
                    lowerEst.includes('asilo') ||
                    lowerEst.includes('tps') ||
                    lowerEst.includes('indocument') ||
                    lowerEst.includes('green card') ||
                    lowerEst.includes('work permit')
                  );

                  const isCancel = !isMigratory && (lowerEst.includes('cancel') || rawStatus === 'Cancelado');
                  const isRobado = !isMigratory && (lowerEst.includes('rob') || rawStatus === 'Robado');
                  const isActivo = isMigratory || lowerEst === 'activo' || lowerEst === 'activos' || (!isCancel && !isRobado);

                  let rowBorder = 'border-l-4 border-l-emerald-500';
                  let rowBg = 'hover:bg-slate-50/80';
                  if (isCancel) {
                    rowBorder = 'border-l-4 border-l-rose-500';
                    rowBg = 'bg-rose-50/40 hover:bg-rose-50/70';
                  } else if (isRobado) {
                    rowBorder = 'border-l-4 border-l-purple-500';
                    rowBg = 'bg-purple-50/40 hover:bg-purple-50/70';
                  }

                  const commDisplay = isCommissionUnlocked
                    ? `$30.00 (${isPaid ? 'Cobrado' : 'Pendiente'})`
                    : '🔒 $***';

                  const numDeps = typeof c.numDependientes === 'number' && !isNaN(c.numDependientes) ? c.numDependientes : 0;
                  const totalMiembros = Math.max(1, numDeps + 1);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onEditClient(c)}
                      className={`${rowBorder} ${rowBg} transition cursor-pointer text-xs`}
                      title={`Clic para ver o editar la información completa de ${c.nombre || 'este cliente'}`}
                    >
                      {/* 1. Estatus (Activo / Cancelado - Sin estatus migratorio) */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        {isActivo ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shadow-2xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Activo
                          </span>
                        ) : isCancel ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shadow-2xs bg-rose-100 text-rose-800 border border-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Cancelado
                          </span>
                        ) : isRobado ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shadow-2xs bg-purple-100 text-purple-800 border border-purple-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                            Robado
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shadow-2xs bg-blue-100 text-blue-800 border border-blue-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            {rawStatus}
                          </span>
                        )}
                      </td>

                      {/* 2. Nombre y apellido (Recortado a nombre y apellido; completo al abrir o en hover) */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-xs" title={`Nombre completo: ${c.nombre || ''}`}>
                        <span className="truncate max-w-[130px] sm:max-w-[160px] inline-block align-middle font-bold text-slate-900">
                          {formatShortName(c.nombre)}
                        </span>
                      </td>

                      {/* 3 & 4. Cuántas personas activas son / Miembros en póliza */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className="bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs" title={`Póliza con ${totalMiembros} miembros (1 titular + ${numDeps} dependientes)`}>
                          <Users className="w-3 h-3 text-purple-600" />
                          <span>{totalMiembros} {totalMiembros === 1 ? 'persona activa' : 'personas activas'}</span>
                        </span>
                      </td>

                      {/* 5. Fecha de nacimiento */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap font-medium text-slate-700 text-xs">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <span>🎂 {c.dbo || '-'}</span>
                          {getClientBirthMonth(c.dbo) === (new Date().getMonth() + 1) && (
                            <span className="bg-pink-100 text-pink-700 px-1 py-0.2 rounded-full text-[9px] font-black border border-pink-300 animate-pulse inline-flex items-center gap-0.5" title="¡Cumpleaños este mes!">
                              <Gift className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Seguro Social (SSN) */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap font-mono font-bold text-slate-800 text-xs">
                        <span className="bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                          🔒 {c.ssn || '-'}
                        </span>
                      </td>

                      {/* 7. Compañías de seguros */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-900 border border-slate-300 px-2 py-0.5 rounded font-extrabold text-[10px] inline-flex items-center gap-1">
                          🛡️ {c.carrier || 'General'}
                        </span>
                      </td>

                      {/* 8. Plan */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1 max-w-[130px] truncate" title={c.nombrePlan}>
                          📑 {c.nombrePlan || '-'}
                        </span>
                      </td>

                      {/* 9. Dirección */}
                      <td className="px-2.5 py-1.5 min-w-[120px] text-slate-700 text-xs">
                        <div className="truncate max-w-[150px]" title={c.direccion}>
                          📍 {c.direccion || '-'}
                        </div>
                      </td>

                      {/* 10. Vendedor */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-xs">
                        <span className="font-extrabold text-amber-900 truncate max-w-[110px] inline-block align-middle" title={c.vendedor}>
                          👤 {formatShortName(c.vendedor || 'General')}
                        </span>
                      </td>

                      {/* 11. Prima ($) */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap font-mono font-bold text-teal-700 tabular-nums text-xs">
                        ${(c.primaMonto || 0).toFixed(2)}
                      </td>

                      {/* 12. Edad */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap font-bold text-slate-800 text-xs">
                        {c.edad || 0}a
                      </td>

                      {/* 13. Teléfono */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap font-medium text-slate-800 text-xs">
                        📞 {c.telefono || '-'}
                      </td>

                      {/* 14. Pago */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                          isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {isPaid ? '🟢 SÍ' : '🔴 NO'}
                        </span>
                      </td>

                      {/* 15. Comisión */}
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onOpenPinModal('polizas-cell')}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer bg-slate-100 text-slate-800 shadow-2xs hover:bg-slate-200 transition"
                        >
                          {commDisplay}
                        </button>
                      </td>

                      {/* 16. Acción (Editar) */}
                      <td className="px-2.5 py-1.5 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onEditClient(c)}
                          className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-md transition border border-emerald-300 flex items-center gap-1 mx-auto cursor-pointer shadow-2xs text-[10px]"
                          title="Editar todos los datos de esta póliza"
                        >
                          <Edit className="w-3 h-3 text-emerald-600" />
                          <span>Editar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar - Matching user screenshot */}
        <div className="bg-white border-t border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Rows per page */}
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <span className="text-slate-600 font-semibold">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-slate-300 rounded-md px-2.5 py-1 bg-white text-xs font-bold text-slate-700 shadow-2xs hover:border-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-400 text-[11px] ml-2 hidden sm:inline">
              ({filteredClients.length} pólizas en total)
            </span>
          </div>

          {/* Right: Controls << < Page X of Y > >> */}
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
              title="Primera página"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 text-xs font-semibold text-slate-800 whitespace-nowrap">
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
              title="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
              title="Última página"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
