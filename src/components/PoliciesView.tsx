import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ClientPolicy, Agent } from '../types';
import {
  Users, CheckCircle2, XCircle, ShieldAlert, DollarSign,
  Search, RotateCcw, Filter, ChevronDown, Edit, Edit2, Lock, Unlock,
  CreditCard, Calendar, Phone, MapPin, Building, Gift, ShieldCheck,
  FileSpreadsheet, Upload, Download, FileText, Check, RotateCw,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Tag
} from 'lucide-react';
import {
  MONTHS_LIST, getCarrierColorStyle, getPolicyStatusStyle,
  calculateActiveMembers, formatShortName, parseClientStatuses
} from '../services/storage';
import { exportToExcelFile, downloadExcelTemplate, parseExcelOrCSVBuffer } from '../services/excelService';

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
  onUpdateStatus?: (clientId: string, newStatus: string) => void;
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
  onUpdateStatus,
  onImportClients,
  onShowToast
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterPlanType, setFilterPlanType] = useState<'all' | 'obama' | 'suplementario'>('all');
  const [filterSeller, setFilterSeller] = useState<string[]>([]);
  const [filterAgent, setFilterAgent] = useState<string[]>([]);
  const [filterState, setFilterState] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterCarrier, setFilterCarrier] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterBirthMonth, setFilterBirthMonth] = useState('');
  const [showSellerMenu, setShowSellerMenu] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Pagination state (default 20 as requested)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [includeAllYears, setIncludeAllYears] = useState<boolean>(false);
  const [openStatusMenuClientId, setOpenStatusMenuClientId] = useState<string | null>(null);
  const [customStatusText, setCustomStatusText] = useState('');

  const handleToggleClientStatus = (clientId: string, currentStatusRaw: string, statusToToggle: string) => {
    if (!onUpdateStatus) return;
    const currentList = parseClientStatuses(currentStatusRaw);
    const exists = currentList.some(s => s.toLowerCase() === statusToToggle.toLowerCase());
    let nextList: string[];
    if (exists) {
      nextList = currentList.filter(s => s.toLowerCase() !== statusToToggle.toLowerCase());
      if (nextList.length === 0) nextList = ['Activo'];
    } else {
      nextList = [...currentList, statusToToggle];
    }
    onUpdateStatus(clientId, nextList.join(', '));
  };

  const handleAddCustomStatusToClient = (clientId: string, currentStatusRaw: string, customTag: string) => {
    if (!onUpdateStatus || !customTag.trim()) return;
    const clean = customTag.trim();
    const currentList = parseClientStatuses(currentStatusRaw);
    if (!currentList.some(s => s.toLowerCase() === clean.toLowerCase())) {
      const nextList = [...currentList, clean];
      onUpdateStatus(clientId, nextList.join(', '));
    }
    setCustomStatusText('');
  };

  // Helper para detectar con certeza total si un cliente está procesado (por estatus de póliza, migratorio o documental)
  const isClientProcesado = (c: ClientPolicy) => {
    const st = String(c.estatus || '').trim().toLowerCase();
    const mig = String(c.estatusMigratorio || '').trim().toLowerCase();
    const doc = String(c.docStatus || '').trim().toLowerCase();
    const notas = String(c.notas || '').trim().toLowerCase();
    return (
      st.includes('procesad') || st.includes('proceso') || st.includes('proces') || st === 'en_progreso' || st.includes('tramit') ||
      mig.includes('proceso') || mig.includes('proces') ||
      doc.includes('proceso') || doc.includes('proces') ||
      (notas.includes('estatus proceso') || notas.includes('procesado') || notas.includes('en proceso'))
    );
  };

  // Filter clients by active year (o todos los años si el usuario lo selecciona)
  const yearClients = useMemo(() => {
    if (includeAllYears) return clients;
    return clients.filter(c => String(c.createdYear || "2026") === String(selectedYear));
  }, [clients, selectedYear, includeAllYears]);

  // Conteo total de expedientes procesados en la lista activa
  const totalProcesadoCount = useMemo(() => {
    return yearClients.filter(isClientProcesado).length;
  }, [yearClients]);

  // Contadores exactos de Planes Obama y Planes Suplementarios
  const obamaCount = useMemo(() => {
    return yearClients.filter(c => c.tipoPoliza !== 'suplementario').length;
  }, [yearClients]);

  const suplementarioCount = useMemo(() => {
    return yearClients.filter(c => c.tipoPoliza === 'suplementario').length;
  }, [yearClients]);

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
      const q = searchTerm.toLowerCase().trim();
      const match = (c.nombre || '').toLowerCase().includes(q) ||
        (c.nombrePlan || '').toLowerCase().includes(q) ||
        (c.ssn || '').includes(q) ||
        (c.vendedor || '').toLowerCase().includes(q) ||
        (c.agente || '').toLowerCase().includes(q) ||
        (c.numPoliza || '').toLowerCase().includes(q) ||
        (c.telefono || '').includes(q) ||
        (c.bancoNombre || '').toLowerCase().includes(q) ||
        (c.estatus || '').toLowerCase().includes(q) ||
        (c.estatusMigratorio || '').toLowerCase().includes(q) ||
        (c.docStatus || '').toLowerCase().includes(q) ||
        (c.carrier || '').toLowerCase().includes(q) ||
        (c.direccion || '').toLowerCase().includes(q) ||
        (c.notas || '').toLowerCase().includes(q) ||
        (q === 'procesado' && isClientProcesado(c)) ||
        (q === 'proceso' && isClientProcesado(c)) ||
        (q === 'renovado' && String(c.estatus || '').toLowerCase().includes('renovad')) ||
        (q === 'duplicado' && String(c.estatus || '').toLowerCase().includes('duplicad'));
      if (!match) return false;
    }

    if (filterPlanType !== 'all') {
      const clientType = c.tipoPoliza === 'suplementario' ? 'suplementario' : 'obama';
      if (clientType !== filterPlanType) return false;
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

    if (filterStatus.length > 0) {
      const clientStatuses = parseClientStatuses(c.estatus).map(s => s.toLowerCase());
      const clientStatusStr = String(c.estatus || 'Activo').toLowerCase();

      const matchesAnySelected = filterStatus.some(selected => {
        const sel = selected.trim().toLowerCase();

        // 1. Coincidencia para "Procesado"
        if (sel.includes('proces')) {
          if (isClientProcesado(c)) return true;
          return clientStatuses.some(st => st.includes('proces'));
        }

        // 2. Coincidencia para "Renovado"
        if (sel.includes('renovad')) {
          return clientStatuses.some(st => st.includes('renovad')) || clientStatusStr.includes('renovad');
        }

        // 3. Coincidencia para "Activos" o "Activo"
        if (sel === 'activos' || sel === 'activo') {
          return clientStatuses.some(st => st === 'activo' || st === 'activos' || st === 'active');
        }

        // Coincidencia para "Autorizado"
        if (sel.includes('autoriz')) {
          return clientStatuses.some(st => st.includes('autoriz')) || clientStatusStr.includes('autoriz');
        }

        // 4. Coincidencia para "Nuevo" o "Nuevo por procesar"
        if (sel === 'nuevo por procesar' || sel === 'nuevo') {
          return clientStatuses.some(st => st === 'nuevo' || st.includes('subid')) || isClientProcesado(c);
        }

        // 5. Coincidencia para "Duplicado" (reemplaza Pendiente)
        if (sel.includes('duplicad') || sel.includes('pendient')) {
          return clientStatuses.some(st => st.includes('duplicad') || st.includes('pendient')) || clientStatusStr.includes('duplicad');
        }

        // 6. Coincidencia para "Cancelados"
        if (sel.includes('cancel')) {
          return clientStatuses.some(st => st.includes('cancel'));
        }

        // 7. Coincidencia para "Robados"
        if (sel.includes('rob')) {
          return clientStatuses.some(st => st.includes('rob'));
        }

        // 8. Coincidencia para "Cotizado"
        if (sel.includes('cotiz')) {
          return clientStatuses.some(st => st.includes('cotiz'));
        }

        // 9. Coincidencia para "Subido / Listo"
        if (sel.includes('subid') || sel.includes('listo')) {
          return clientStatuses.some(st => st.includes('subid') || st.includes('listo'));
        }

        // 10. Coincidencia general flexible
        return clientStatuses.some(st => st === sel || st.includes(sel) || sel.includes(st)) ||
               clientStatusStr.includes(sel);
      });

      if (!matchesAnySelected) return false;
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
  }, [searchTerm, filterPayment, filterPlanType, filterSeller, filterAgent, filterState, filterStatus, filterCarrier, filterMonth, filterBirthMonth, selectedYear]);

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
    setFilterPlanType('all');
    setFilterSeller([]);
    setFilterAgent([]);
    setFilterState('');
    setFilterStatus([]);
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

  const toggleStatusSelect = (statusLabel: string) => {
    if (filterStatus.includes(statusLabel)) {
      setFilterStatus(filterStatus.filter(s => s !== statusLabel));
    } else {
      setFilterStatus([...filterStatus, statusLabel]);
    }
  };

  const availableStatuses = useMemo(() => {
    const list: Array<{ label: string; dot: string }> = [
      { label: 'Activo', dot: 'bg-emerald-500' },
      { label: 'Autorizado', dot: 'bg-cyan-500' },
      { label: 'Procesado', dot: 'bg-indigo-500' },
      { label: 'Renovado', dot: 'bg-teal-500' },
      { label: 'Cotizado', dot: 'bg-amber-500' },
      { label: 'Nuevo', dot: 'bg-blue-500' },
      { label: 'Subido / Listo', dot: 'bg-sky-500' },
      { label: 'Duplicado', dot: 'bg-orange-500' },
      { label: 'Cancelado', dot: 'bg-rose-500' },
      { label: 'Robado', dot: 'bg-purple-500' }
    ];

    // Incluir cualquier estatus individual real que los clientes tengan en la base de datos
    clients.forEach(c => {
      const clientStList = parseClientStatuses(c.estatus);
      clientStList.forEach(st => {
        const cleanSt = st.trim();
        const lower = cleanSt.toLowerCase();
        // Ignorar variantes que caen dentro de Procesado o Duplicado
        if (lower === 'proceso' || lower === 'en proceso' || lower === 'pendiente' || lower.includes('tramite')) return;
        if (cleanSt && !list.some(item => item.label.toLowerCase() === lower)) {
          list.push({ label: cleanSt, dot: 'bg-cyan-500' });
        }
      });
    });

    if (customStatuses) {
      customStatuses.forEach(st => {
        const cleanSt = st.trim();
        const lower = cleanSt.toLowerCase();
        if (lower === 'proceso' || lower === 'en proceso' || lower === 'pendiente') return;
        if (!list.some(item => item.label.toLowerCase() === lower)) {
          list.push({ label: cleanSt, dot: 'bg-cyan-500' });
        }
      });
    }
    return list;
  }, [clients, customStatuses]);

  const getStatusCount = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('proces')) {
      return totalProcesadoCount;
    }
    if (lower.includes('renovad')) {
      return yearClients.filter(c => {
        const statuses = parseClientStatuses(c.estatus).map(s => s.toLowerCase());
        return statuses.some(st => st.includes('renovad')) || String(c.estatus || '').toLowerCase().includes('renovad');
      }).length;
    }
    if (lower.includes('duplicad') || lower.includes('pendient')) {
      return yearClients.filter(c => {
        const statuses = parseClientStatuses(c.estatus).map(s => s.toLowerCase());
        return statuses.some(st => st.includes('duplicad') || st.includes('pendient'));
      }).length;
    }
    return yearClients.filter(c => {
      const statuses = parseClientStatuses(c.estatus).map(s => s.toLowerCase());
      return statuses.some(st => {
        if (lower === 'activo') return st === 'activo' || st === 'activos' || st === 'active';
        if (lower.includes('autoriz')) return st.includes('autoriz');
        if (lower.includes('cancel')) return st.includes('cancel');
        if (lower.includes('rob')) return st.includes('rob');
        if (lower.includes('cotiz')) return st.includes('cotiz');
        if (lower === 'nuevo' || lower === 'nuevo por procesar') return st.includes('nuevo');
        if (lower.includes('subid') || lower.includes('listo')) return st.includes('subid') || st.includes('listo');
        return st === lower || st.includes(lower);
      });
    }).length;
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
          <div className="flex flex-wrap items-center gap-2">
            {/* Estado de Pago */}
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

            {/* Contador y Filtro: Planes Obama */}
            <button
              type="button"
              onClick={() => setFilterPlanType(prev => prev === 'obama' ? 'all' : 'obama')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-2 border cursor-pointer shadow-2xs ${
                filterPlanType === 'obama'
                  ? 'bg-blue-600 text-white border-blue-700 shadow ring-2 ring-blue-300'
                  : 'bg-blue-50/90 hover:bg-blue-100 text-blue-950 border-blue-200'
              }`}
              title="Filtrar por Planes Obama (ACA). Clic para activar/desactivar filtro."
            >
              <span className="flex items-center gap-1">
                <span>🇺🇸</span>
                <span className="uppercase text-[11px]">Planes Obama:</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black font-mono ${
                filterPlanType === 'obama' ? 'bg-white text-blue-900 shadow-2xs' : 'bg-blue-200 text-blue-950'
              }`}>
                {obamaCount}
              </span>
            </button>

            {/* Contador y Filtro: Planes Suplementarios */}
            <button
              type="button"
              onClick={() => setFilterPlanType(prev => prev === 'suplementario' ? 'all' : 'suplementario')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-2 border cursor-pointer shadow-2xs ${
                filterPlanType === 'suplementario'
                  ? 'bg-purple-600 text-white border-purple-700 shadow ring-2 ring-purple-300'
                  : 'bg-purple-50/90 hover:bg-purple-100 text-purple-950 border-purple-200'
              }`}
              title="Filtrar por Planes Suplementarios. Clic para activar/desactivar filtro."
            >
              <span className="flex items-center gap-1">
                <span>➕</span>
                <span className="uppercase text-[11px]">Planes Suplementarios:</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black font-mono ${
                filterPlanType === 'suplementario' ? 'bg-white text-purple-900 shadow-2xs' : 'bg-purple-200 text-purple-950'
              }`}>
                {suplementarioCount}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshData}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg transition text-xs border border-emerald-500 flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Sincronizar de inmediato y refrescar base de datos"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Sincronizar</span>
            </button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-2 text-xs">
          {/* Tipo de Cobertura Dropdown */}
          <div>
            <select
              value={filterPlanType}
              onChange={e => setFilterPlanType(e.target.value as any)}
              className="w-full py-2 px-3 border border-indigo-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-indigo-950 bg-indigo-50/50 cursor-pointer shadow-2xs"
            >
              <option value="all">🛡️ Todos los Planes</option>
              <option value="obama">🇺🇸 Planes Obama ({obamaCount})</option>
              <option value="suplementario">➕ Planes Suplementarios ({suplementarioCount})</option>
            </select>
          </div>
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar Cliente, Plan, Estatus (ej. Proceso)..."
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

          {/* Status Multi-select Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowStatusMenu(!showStatusMenu);
                setShowSellerMenu(false);
                setShowAgentMenu(false);
              }}
              className="w-full py-2 px-3 border border-emerald-300 rounded-lg text-xs font-bold text-slate-900 bg-white hover:bg-slate-50 flex items-center justify-between focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-2xs"
            >
              <span className="truncate">
                {filterStatus.length === 0
                  ? '⚡ Estatus: Todos'
                  : filterStatus.length === 1
                  ? `⚡ ${filterStatus[0]}`
                  : `⚡ ${filterStatus.length} Estatus seleccionados`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-1 shrink-0" />
            </button>

            {showStatusMenu && (
              <div className="absolute z-40 left-0 right-0 mt-1 min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-2xl p-2 space-y-1 max-h-64 overflow-y-auto text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1 px-1">
                  <span className="font-extrabold text-[10px] text-slate-500 uppercase">Seleccionar Estatus</span>
                  <button
                    type="button"
                    onClick={() => { setFilterStatus([]); setShowStatusMenu(false); }}
                    className="text-[10px] text-emerald-600 font-bold hover:underline"
                  >
                    Limpiar
                  </button>
                </div>

                {availableStatuses.map(st => (
                  <label key={st.label} className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-slate-800 font-semibold transition">
                    <div className="flex items-center space-x-2 truncate">
                      <input
                        type="checkbox"
                        checked={filterStatus.includes(st.label)}
                        onChange={() => toggleStatusSelect(st.label)}
                        className="w-3.5 h-3.5 text-emerald-600 rounded"
                      />
                      <span className="flex items-center gap-1.5 truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`}></span>
                        <span className="truncate">{st.label}</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 ml-2 shrink-0">
                      {getStatusCount(st.label)}
                    </span>
                  </label>
                ))}
              </div>
            )}
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
                <th className="px-2.5 py-2">Miembro</th>
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
                  <td colSpan={15} className="p-8 text-center text-slate-500 font-semibold space-y-3">
                    <p className="text-sm font-bold text-slate-600">
                      No se encontraron pólizas coincidentes {includeAllYears ? 'en ningún año' : `para el año ${selectedYear}`} con los filtros actuales.
                    </p>
                    {clients.some(isClientProcesado) && !includeAllYears && (
                      <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-950 px-4 py-2 rounded-xl text-xs">
                        <span>💡 Existen expedientes con estatus <strong>"Procesado"</strong> en otros años.</span>
                        <button
                          type="button"
                          onClick={() => setIncludeAllYears(true)}
                          className="font-black text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                        >
                          Ver Todos los Años
                        </button>
                      </div>
                    )}
                    <div>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-lg text-xs transition border border-slate-300 cursor-pointer shadow-2xs"
                      >
                        Restablecer Filtros
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedClients.map(c => {
                  const isPaid = String(c.pagoRealizado).toUpperCase() === 'TRUE';
                  const statusStyle = getPolicyStatusStyle(c.estatus);
                  const carrierStyle = getCarrierColorStyle(c.carrier);
                  const rowBorder = statusStyle.rowBorder;
                  const rowBg = statusStyle.rowBg;

                  const commDisplay = isCommissionUnlocked
                    ? `$30.00 (${isPaid ? 'Cobrado' : 'Pendiente'})`
                    : '🔒 $***';

                  const activeMembers = calculateActiveMembers(c);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onEditClient(c)}
                      className={`${rowBorder} ${rowBg} transition cursor-pointer text-xs`}
                      title={`Clic para ver o editar la información completa de ${c.nombre || 'este cliente'}`}
                    >
                      {/* 1. Estatus (Múltiples estatus con insignias independientes y selector rápido) */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap relative" onClick={e => e.stopPropagation()}>
                        {(() => {
                          const clientStatuses = parseClientStatuses(c.estatus);
                          const isMenuOpen = openStatusMenuClientId === c.id;

                          return (
                            <div className="relative">
                              <div className="flex flex-wrap items-center gap-1">
                                {clientStatuses.map((st, i) => {
                                  const stStyle = getPolicyStatusStyle(st);
                                  return (
                                    <span
                                      key={i}
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shadow-2xs border ${stStyle.badgeClass}`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${stStyle.dotColor}`}></span>
                                      <span>{st}</span>
                                    </span>
                                  );
                                })}

                                {onUpdateStatus && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenStatusMenuClientId(isMenuOpen ? null : c.id);
                                      setCustomStatusText('');
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition cursor-pointer border border-transparent hover:border-indigo-200"
                                    title="Modificar o añadir estatus (permite seleccionar 2 o más estatus)"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Popover flotante para seleccionar o desmarcar estatus */}
                              {isMenuOpen && (
                                <div
                                  className="absolute left-0 top-7 z-40 bg-white border border-slate-300 rounded-2xl shadow-2xl p-3 w-64 space-y-2 text-xs"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                    <span className="font-black text-slate-800 text-[11px] uppercase flex items-center gap-1">
                                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                                      Estatus de la Póliza
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setOpenStatusMenuClientId(null)}
                                      className="text-slate-400 hover:text-slate-700 text-xs font-bold p-0.5 cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  <p className="text-[10px] text-slate-500 leading-tight">
                                    Puedes seleccionar <strong>varios estatus</strong> (ej. <em>Activo</em> y <em>Renovado</em>):
                                  </p>

                                  <div className="max-h-48 overflow-y-auto space-y-1 p-0.5">
                                    {['Activo', 'Autorizado', 'Procesado', 'Renovado', 'Cotizado', 'Nuevo', 'Subido / Listo', 'Duplicado', 'Cancelado', 'Robado'].map(opt => {
                                      const isChecked = clientStatuses.some(s => s.toLowerCase() === opt.toLowerCase());
                                      const optStyle = getPolicyStatusStyle(opt);
                                      return (
                                        <label
                                          key={opt}
                                          className={`flex items-center justify-between px-2 py-1 rounded-lg cursor-pointer transition text-[11px] font-bold ${
                                            isChecked ? 'bg-indigo-50 text-indigo-950 font-black ring-1 ring-indigo-200' : 'hover:bg-slate-50 text-slate-700'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleToggleClientStatus(c.id, c.estatus, opt)}
                                              className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                                            />
                                            <span className={`w-2 h-2 rounded-full ${optStyle.dotColor}`}></span>
                                            <span>{opt}</span>
                                          </div>
                                          {isChecked && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                                        </label>
                                      );
                                    })}

                                    {/* Mostrar cualquier otro estatus personalizado que ya tenga este cliente */}
                                    {clientStatuses.filter(s => !['Activo', 'Autorizado', 'Procesado', 'Renovado', 'Cotizado', 'Nuevo', 'Subido / Listo', 'Duplicado', 'Cancelado', 'Robado'].some(opt => opt.toLowerCase() === s.toLowerCase())).map(customSt => (
                                      <label
                                        key={customSt}
                                        className="flex items-center justify-between px-2 py-1 rounded-lg cursor-pointer transition text-[11px] font-black bg-cyan-50 text-cyan-950 ring-1 ring-cyan-200"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="checkbox"
                                            checked={true}
                                            onChange={() => handleToggleClientStatus(c.id, c.estatus, customSt)}
                                            className="w-3.5 h-3.5 text-cyan-600 rounded cursor-pointer"
                                          />
                                          <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                                          <span>{customSt}</span>
                                        </div>
                                        <Check className="w-3.5 h-3.5 text-cyan-600" />
                                      </label>
                                    ))}
                                  </div>

                                  {/* Agregar estatus libre como "Cotizado 2027" */}
                                  <div className="pt-2 border-t border-slate-100 space-y-1">
                                    <span className="text-[10px] text-slate-500 font-semibold block">+ Agregar otro estatus (ej. Cotizado 2027):</span>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={customStatusText}
                                        onChange={e => setCustomStatusText(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddCustomStatusToClient(c.id, c.estatus, customStatusText);
                                          }
                                        }}
                                        placeholder="Ej: Cotizado 2027"
                                        className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddCustomStatusToClient(c.id, c.estatus, customStatusText)}
                                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] rounded-lg transition cursor-pointer"
                                      >
                                        Añadir
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* 2. Nombre y apellido (Recortado a nombre y apellido; completo al abrir o en hover) */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-xs" title={`Nombre completo: ${c.nombre || ''}`}>
                        <span className="truncate max-w-[130px] sm:max-w-[160px] inline-block align-middle font-bold text-slate-900">
                          {formatShortName(c.nombre)}
                        </span>
                      </td>

                      {/* 3 & 4. Miembro en póliza (👤 X miembro/miembros) */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className="bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs" title={`Póliza con ${activeMembers} miembro(s) activo(s)`}>
                          <Users className="w-3 h-3 text-purple-600" />
                          <span>{activeMembers} {activeMembers === 1 ? 'miembro' : 'miembros'}</span>
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

                      {/* 7. Compañías de seguros con color distintivo */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold inline-flex items-center gap-1.5 border shadow-2xs ${carrierStyle.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${carrierStyle.dotColor}`}></span>
                          <span>🛡️ {c.carrier || 'General'}</span>
                        </span>
                      </td>

                      {/* 8. Plan y Tipo de Cobertura */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div>
                            {c.tipoPoliza === 'suplementario' ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 text-purple-900 border border-purple-300 inline-flex items-center gap-0.5 shadow-2xs">
                                <span>➕</span>
                                <span>Suplementario</span>
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-100 text-blue-900 border border-blue-300 inline-flex items-center gap-0.5 shadow-2xs">
                                <span>🇺🇸</span>
                                <span>Obama ACA</span>
                              </span>
                            )}
                          </div>
                          <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1 max-w-[130px] truncate" title={c.nombrePlan || '-'}>
                            📑 {c.nombrePlan || '-'}
                          </span>
                        </div>
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
