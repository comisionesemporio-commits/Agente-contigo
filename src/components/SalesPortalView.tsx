import React, { useState } from 'react';
import { ClientPolicy, HealthQuestions, DependentItem } from '../types';
import {
  Send, Copy, CheckCircle2, MessageSquare, Plus,
  FileCheck, Shield, HeartPulse, User, Phone, MapPin, Building,
  Trash2, Check, AlertTriangle, Users, Tag, CreditCard, X
} from 'lucide-react';
import {
  MONTHS_LIST, formatToUSDate, formatToISODate, calculateAgeFromDBO,
  formatDateToHumanSpanish, getCarrierColorStyle, getPolicyStatusStyle,
  calculateActiveMembers, formatShortName, MIGRATORY_STATUS_OPTIONS,
  SUPPLEMENTAL_COMPANIES_RECOMMENDED, getCurrentFormattedDateAndYear
} from '../services/storage';

interface SalesPortalViewProps {
  currentSeller: string;
  selectedYear: string;
  clients: ClientPolicy[];
  customCarriers: string[];
  onSaveNewPolicy: (policy: Omit<ClientPolicy, 'id'>) => void;
  onLogout: () => void;
  onCopyLink: () => void;
}

export const SalesPortalView: React.FC<SalesPortalViewProps> = ({
  currentSeller,
  selectedYear,
  clients,
  customCarriers,
  onSaveNewPolicy,
  onLogout,
  onCopyLink
}) => {
  // Plan type
  const [tipoPoliza, setTipoPoliza] = useState<'obama' | 'suplementario'>('obama');
  const [companiaSuplementaria, setCompaniaSuplementaria] = useState('');

  // Policy & Seller identification
  const [numPoliza, setNumPoliza] = useState('');
  const [regYear, setRegYear] = useState(selectedYear);

  // Personal data
  const [nombre, setNombre] = useState('');
  const [ssn, setSsn] = useState('');
  const [estatusMigratorio, setEstatusMigratorio] = useState('Ciudadano');
  const [dbo, setDbo] = useState('');
  const [edad, setEdad] = useState<number>(0);

  // Insurance details
  const [carrier, setCarrier] = useState('Oscar');
  const [mesIngreso, setMesIngreso] = useState('Enero');
  const [nombrePlan, setNombrePlan] = useState('');

  // Physical attributes
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');

  // Financial details
  const [ingresoMonto, setIngresoMonto] = useState('');
  const [primaMonto, setPrimaMonto] = useState('');

  // Contact & Location
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [estadoUSA, setEstadoUSA] = useState('GA');
  const [direccion, setDireccion] = useState('');

  // Banking
  const [bancoNombre, setBancoNombre] = useState('');
  const [bancoTipoCuenta, setBancoTipoCuenta] = useState('Corriente (Checking)');
  const [bancoTitular, setBancoTitular] = useState('');
  const [bancoRouting, setBancoRouting] = useState('');
  const [bancoCuenta, setBancoCuenta] = useState('');

  // Payment
  const [metodoPago, setMetodoPago] = useState('Tarjeta de Crédito');
  const [pagoRealizado, setPagoRealizado] = useState('TRUE');

  // Dependents (Full interactive list matching ClientModal)
  const [dependientesList, setDependientesList] = useState<DependentItem[]>([]);

  // Health questions (8 questions)
  const [healthQuestions, setHealthQuestions] = useState<HealthQuestions>({
    tabaco: 'no',
    otras: 'no',
    rechazos: 'no',
    embarazo: 'no',
    hosp: 'no',
    cancer: 'no',
    sintomas: 'no',
    cardio: 'no'
  });

  const [notas, setNotas] = useState('');

  // Confirmation modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSavedSummary, setLastSavedSummary] = useState<{
    nombre: string;
    year: string;
    carrier: string;
    tipoPoliza: string;
    totalMiembros: number;
    vendedor: string;
    agente: string;
  } | null>(null);

  // Search filter for seller's own registered policies
  const [searchTableTerm, setSearchTableTerm] = useState('');

  // Calculate age automatically when DBO changes
  const handleDboChange = (val: string) => {
    setDbo(val);
    if (!val) {
      setEdad(0);
      return;
    }
    const calcAge = calculateAgeFromDBO(val);
    if (calcAge > 0) {
      setEdad(calcAge);
    }
  };

  const handleHealthRadio = (field: string, val: string) => {
    setHealthQuestions(prev => ({ ...prev, [field]: val }));
  };

  // Dependents handlers
  const addDependent = () => {
    const newDep: DependentItem = {
      id: `dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nombre: '',
      dbo: '',
      ssn: '',
      estatusMigratorio: estatusMigratorio || 'Ciudadano',
      aplica: true,
      parentesco: 'Dependiente'
    };
    setDependientesList(prev => [...prev, newDep]);
  };

  const updateDependent = (index: number, field: keyof DependentItem, value: any) => {
    setDependientesList(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeDependent = (index: number) => {
    setDependientesList(prev => prev.filter((_, i) => i !== index));
  };

  const activeDepsCount = dependientesList.filter(d => d.aplica !== false).length;
  const liveTotalMembers = 1 + activeDepsCount; // Titular is active for new registration

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const todayUS = getCurrentFormattedDateAndYear().dateUS;
    const usDbo = formatToUSDate(dbo);
    const finalAge = edad || calculateAgeFromDBO(usDbo);

    // Asegurar que cada dependiente tenga su estatus migratorio
    const cleanDeps = dependientesList.map(d => ({
      ...d,
      estatusMigratorio: d.estatusMigratorio || estatusMigratorio || 'Ciudadano'
    }));

    const finalCarrier = carrier.trim() || (tipoPoliza === 'suplementario' ? (companiaSuplementaria || 'ManhattanLife') : 'Oscar');

    onSaveNewPolicy({
      vendedor: currentSeller || 'Vendedor General',
      agente: 'Luis Fernando', // Automático y fijo para el portal del vendedor
      numPoliza: numPoliza.trim(),
      nombre: nombre.trim(),
      estatus: 'Nuevo', // Automáticamente asignado como "Nuevo"
      tipoPoliza,
      companiaSuplementaria: tipoPoliza === 'suplementario' ? (companiaSuplementaria || finalCarrier) : '',
      carrier: finalCarrier,
      nombrePlan: nombrePlan.trim(),
      peso: peso.trim(),
      altura: altura.trim(),
      bancoNombre: bancoNombre.trim(),
      bancoTipoCuenta,
      bancoTitular: bancoTitular.trim(),
      bancoRouting: bancoRouting.trim(),
      bancoCuenta: bancoCuenta.trim(),
      cuestionarioSalud: healthQuestions,
      mesIngreso,
      docStatus: 'Subir Documentos',
      estatusMigratorio,
      ingresoFecha: todayUS,
      ingresoMonto: parseFloat(ingresoMonto) || 0,
      primaMonto: parseFloat(primaMonto) || 0,
      metodoPago,
      estadoUSA: estadoUSA.trim().toUpperCase() || 'GA',
      telefono: telefono.trim(),
      email: email.trim(),
      ssn: ssn.trim(),
      dbo: usDbo,
      edad: finalAge,
      direccion: direccion.trim(),
      numDependientes: activeDepsCount,
      dependientesList: cleanDeps,
      datosDependientes: JSON.stringify(cleanDeps),
      pagoRealizado,
      notas: notas.trim(),
      createdDate: todayUS,
      createdYear: regYear || selectedYear,
      commissions: {}
    });

    setLastSavedSummary({
      nombre: nombre.trim(),
      year: regYear || selectedYear,
      carrier: finalCarrier,
      tipoPoliza: tipoPoliza === 'suplementario' ? 'Plan Suplementario' : 'Plan Obama (ACA)',
      totalMiembros: 1 + activeDepsCount,
      vendedor: currentSeller || 'Vendedor General',
      agente: 'Luis Fernando'
    });
    setShowSuccessModal(true);

    // Reset form
    setNombre('');
    setNumPoliza('');
    setSsn('');
    setDbo('');
    setEdad(0);
    setNombrePlan('');
    setPeso('');
    setAltura('');
    setIngresoMonto('');
    setPrimaMonto('');
    setTelefono('');
    setEmail('');
    setDireccion('');
    setBancoNombre('');
    setBancoTitular('');
    setBancoRouting('');
    setBancoCuenta('');
    setDependientesList([]);
    setNotas('');
    setTipoPoliza('obama');
    setCompaniaSuplementaria('');
  };

  // Filter seller's own policies
  const myPolicies = clients.filter(
    c => (c.vendedor || '').trim().toLowerCase() === (currentSeller || '').trim().toLowerCase()
  );

  const filteredMyPolicies = myPolicies.filter(c => {
    if (!searchTableTerm.trim()) return true;
    const term = searchTableTerm.toLowerCase();
    return (
      (c.nombre || '').toLowerCase().includes(term) ||
      (c.carrier || '').toLowerCase().includes(term) ||
      (c.numPoliza || '').toLowerCase().includes(term) ||
      (c.estatus || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 bg-white/20 text-white rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block mb-2">
            Portal Exclusivo de Carga de Ventas
          </span>
          <h2 className="text-xl font-black text-white">
            Ingreso de Nuevas Pólizas (Vendedor / Agente: <span className="underline decoration-amber-300">{currentSeller || 'Cargando...'}</span>)
          </h2>
          <p className="text-xs text-amber-100 mt-1">
            Llena todos los datos del cliente vendido. Se guardará automáticamente con estatus <strong>"Nuevo"</strong> en el año {selectedYear} para que administración procese la emisión.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onCopyLink}
            className="px-3.5 py-2 bg-white text-amber-800 hover:bg-amber-50 rounded-xl text-xs font-extrabold shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-amber-600" />
            <span>Copiar Enlace</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 bg-amber-950/80 hover:bg-amber-950 text-white rounded-xl text-xs font-extrabold border border-amber-800 transition cursor-pointer"
          >
            Salir Portal
          </button>
        </div>
      </div>

      {/* Mandatory WhatsApp Documentation Notice */}
      <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl flex items-center space-x-3 text-emerald-900 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">
            Nota de Documentación Obligatoria
          </h4>
          <p className="text-xs font-extrabold text-emerald-950">
            Se debe pasar la imagen o documento del cliente por WhatsApp al equipo de emisión una vez guardado.
          </p>
        </div>
      </div>

      {/* Registration Form */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-lg max-w-4xl mx-auto">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4 flex items-center pb-2 border-b border-slate-100 gap-2">
          <Plus className="w-4 h-4 text-amber-600" />
          <span>Formulario Completo de Registro de Póliza</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Header Row: Vendedor, Agente NPN Fijo, Año de Registro, Número Póliza */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-black text-amber-900 uppercase mb-1">Vendedor (Tú)</label>
              <input
                type="text"
                readOnly
                value={currentSeller}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-xs font-black bg-amber-100 text-amber-950 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block font-black text-indigo-900 uppercase mb-1 flex items-center justify-between">
                <span>Agente (NPN / Licencia)</span>
                <span className="text-[9px] text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded font-black border border-indigo-200">Oficial Fijo</span>
              </label>
              <input
                type="text"
                readOnly
                value="Luis Fernando"
                className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-xs font-black bg-indigo-50 text-indigo-950 cursor-not-allowed shadow-2xs"
                title="Agente con licencia asignado automáticamente para emisión de pólizas"
              />
            </div>
            <div>
              <label className="block font-black text-amber-900 uppercase mb-1">Año de Registro</label>
              <select
                value={regYear}
                onChange={e => setRegYear(e.target.value)}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-xs font-black bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
              </select>
            </div>
            <div>
              <label className="block font-black text-amber-900 uppercase mb-1">Número Póliza / Doc</label>
              <input
                type="text"
                value={numPoliza}
                onChange={e => setNumPoliza(e.target.value)}
                placeholder="Ej. POL-883921 / ID Marketplace"
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold bg-white font-mono"
              />
            </div>
          </div>

          {/* Selector Superior: Tipo de Póliza / Cobertura Médica (Plan Obama vs Plan Suplementario) */}
          <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/90 border-2 border-indigo-200 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-black text-indigo-950 uppercase text-xs flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span>Tipo de Póliza / Cobertura Médica</span>
              </label>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                tipoPoliza === 'suplementario'
                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                  : 'bg-blue-100 text-blue-900 border-blue-300'
              }`}>
                {tipoPoliza === 'suplementario' ? '➕ Plan Suplementario' : '🇺🇸 Plan Obama (ACA)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipoPoliza('obama')}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  tipoPoliza !== 'suplementario'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300'
                    : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-300'
                }`}
              >
                <span className="text-2xl shrink-0">🇺🇸</span>
                <div className="min-w-0">
                  <div className="font-black text-xs">Plan Obama (ACA)</div>
                  <div className={`text-[10px] ${tipoPoliza !== 'suplementario' ? 'text-blue-100' : 'text-slate-500'}`}>
                    Seguro de Salud Oficial con Subsidio del Mercado
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTipoPoliza('suplementario')}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  tipoPoliza === 'suplementario'
                    ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-300'
                    : 'bg-white hover:bg-purple-50 text-slate-700 border-slate-300'
                }`}
              >
                <span className="text-2xl shrink-0">➕</span>
                <div className="min-w-0">
                  <div className="font-black text-xs">Plan Suplementario</div>
                  <div className={`text-[10px] ${tipoPoliza === 'suplementario' ? 'text-purple-100' : 'text-slate-500'}`}>
                    Dental, Visión, Indemnización Hospitalaria, Vida
                  </div>
                </div>
              </button>
            </div>

            {/* Sugerencias de Compañías Suplementarias */}
            {tipoPoliza === 'suplementario' && (
              <div className="pt-2 border-t border-purple-200/80 space-y-1.5">
                <span className="font-black text-purple-950 text-[10px] block uppercase">
                  Compañías Recomendadas para Planes Suplementarios (clic para seleccionar):
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SUPPLEMENTAL_COMPANIES_RECOMMENDED.map(comp => (
                    <button
                      key={comp}
                      type="button"
                      onClick={() => {
                        setCarrier(comp);
                        setCompaniaSuplementaria(comp);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition cursor-pointer ${
                        carrier === comp
                          ? 'bg-purple-700 text-white border-purple-800 shadow-2xs'
                          : 'bg-white hover:bg-purple-100 text-purple-900 border-purple-300'
                      }`}
                    >
                      🛡️ {comp}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Datos Personales y Documentación */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <h4 className="font-bold text-slate-800 uppercase text-[11px] flex items-center text-emerald-700">
              Datos Personales y Documentación
            </h4>

            <div>
              <label className="block font-black text-slate-800 uppercase mb-1">Nombre y Apellido *</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Roberto Carlos Pérez"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-black text-slate-900 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Social (SSN)</label>
                <input
                  type="text"
                  value={ssn}
                  onChange={e => setSsn(e.target.value)}
                  placeholder="XXX-XX-XXXX"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-indigo-900 uppercase mb-1">Estatus Migratorio (Titular)</label>
                <select
                  value={estatusMigratorio}
                  onChange={e => setEstatusMigratorio(e.target.value)}
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold text-indigo-950 bg-indigo-50/50 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {MIGRATORY_STATUS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* DBO & Automatic Age Calculation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span>Fecha de Nacimiento (D.B.O)</span>
                  <span className="text-[10px] text-emerald-700 font-extrabold normal-case">Formato EE.UU: MM/DD/YYYY</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={dbo}
                    onChange={e => handleDboChange(e.target.value)}
                    onBlur={() => {
                      if (dbo.trim()) {
                        const normalized = formatToUSDate(dbo);
                        handleDboChange(normalized);
                      }
                    }}
                    placeholder="MM/DD/YYYY (ej. 05/14/1984)"
                    maxLength={10}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold bg-white text-slate-900"
                  />
                  <input
                    type="date"
                    tabIndex={-1}
                    value={formatToISODate(dbo)}
                    onChange={e => {
                      if (e.target.value) {
                        const us = formatToUSDate(e.target.value);
                        handleDboChange(us);
                      }
                    }}
                    className="absolute right-2 w-6 h-6 opacity-60 hover:opacity-100 cursor-pointer border-none bg-transparent"
                    title="Seleccionar en calendario"
                  />
                </div>
                {dbo && (
                  <div className="mt-1 text-[11px] text-emerald-900 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 truncate">
                    📅 {formatDateToHumanSpanish(dbo)}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Edad (Cálculo Automático)</label>
                <input
                  type="number"
                  readOnly
                  value={edad || ''}
                  placeholder="Calculado automáticamente..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-black bg-emerald-50 text-emerald-900"
                />
                <span className="block text-[10px] text-slate-500 mt-1 font-medium">
                  Cálculo automático según fecha de nacimiento.
                </span>
              </div>
            </div>
          </div>

          {/* Carrier & Plan */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 uppercase">Compañía de Seguros</label>
                  {carrier && (
                    <span className={`px-2 py-0.5 rounded text-[10px] ${getCarrierColorStyle(carrier).badgeClass} flex items-center gap-1`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getCarrierColorStyle(carrier).dotColor}`}></span>
                      {carrier}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  list="sales-portal-carriers"
                  value={carrier}
                  onChange={e => {
                    setCarrier(e.target.value);
                    if (tipoPoliza === 'suplementario') setCompaniaSuplementaria(e.target.value);
                  }}
                  placeholder="Escribe o selecciona..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <datalist id="sales-portal-carriers">
                  {customCarriers.map(car => (
                    <option key={car} value={car} />
                  ))}
                  {SUPPLEMENTAL_COMPANIES_RECOMMENDED.map(car => (
                    <option key={`supp-${car}`} value={car} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Mes Activo (Activo desde)</label>
                <select
                  value={mesIngreso}
                  onChange={e => setMesIngreso(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {MONTHS_LIST.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-black text-indigo-900 uppercase mb-1">Nombre del Plan</label>
              <input
                type="text"
                value={nombrePlan}
                onChange={e => setNombrePlan(e.target.value)}
                placeholder="Ej. Silver Standard, Gold Bronze Plus, Ambetter Essential Care..."
                className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold bg-white text-indigo-950"
              />
            </div>
          </div>

          {/* Sección de Dependientes de la Póliza (Completa e Interactiva) */}
          <div className="p-4 bg-purple-50/70 border-2 border-purple-200 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200 pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-700" />
                <h4 className="font-black text-purple-950 uppercase text-xs">
                  Dependientes de la Póliza (Miembros Familiares)
                </h4>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-200 text-purple-950 border border-purple-300 shadow-2xs">
                  👤 {liveTotalMembers} {liveTotalMembers === 1 ? 'miembro' : 'miembros'} en total
                </span>
              </div>
              <button
                type="button"
                onClick={addDependent}
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Dependiente</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-purple-900">
              <span>
                Titular: 🟢 Activo (Suma 1) • Dependientes que aplican: <strong>{activeDepsCount}</strong>
              </span>
              <span className="text-slate-500 text-[10px]">
                * Cada dependiente debe contar con su estatus migratorio asignado
              </span>
            </div>

            {dependientesList.length === 0 ? (
              <div className="p-4 bg-white/80 border border-dashed border-purple-300 rounded-xl text-center text-xs text-purple-800 font-medium">
                No hay dependientes agregados aún. Si el cliente incluye a su cónyuge o hijos, haz clic en <strong>"+ Agregar Dependiente"</strong> para registrarlos con su estatus migratorio obligatorio.
              </div>
            ) : (
              <div className="space-y-2.5">
                {dependientesList.map((dep, idx) => (
                  <div key={dep.id || idx} className="p-3 bg-white border border-purple-200 rounded-xl shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                      <span className="flex items-center gap-2 text-purple-950">
                        <span>👤 Dependiente #{idx + 1}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${dep.aplica ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                          {dep.aplica ? '✓ Aplica Cobertura' : '✗ No Aplica'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDependent(idx)}
                        className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                        title="Eliminar dependiente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Quitar</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
                      {/* Nombre */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Nombre y Apellido</label>
                        <input
                          type="text"
                          value={dep.nombre || ''}
                          onChange={e => updateDependent(idx, 'nombre', e.target.value)}
                          placeholder="Nombre y apellido"
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-purple-500"
                        />
                      </div>

                      {/* Fecha de nacimiento */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Fecha Nac. (MM/DD/YYYY)</label>
                        <input
                          type="text"
                          value={dep.dbo || ''}
                          onChange={e => updateDependent(idx, 'dbo', e.target.value)}
                          placeholder="MM/DD/YYYY"
                          maxLength={10}
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold focus:ring-1 focus:ring-purple-500"
                        />
                      </div>

                      {/* Social (SSN) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Seguro Social (SSN)</label>
                        <input
                          type="text"
                          value={dep.ssn || ''}
                          onChange={e => updateDependent(idx, 'ssn', e.target.value)}
                          placeholder="000-00-0000"
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold focus:ring-1 focus:ring-purple-500"
                        />
                      </div>

                      {/* Estatus Migratorio para Dependiente (OBLIGATORIO) */}
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-0.5">
                          Estatus Migratorio <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={dep.estatusMigratorio || estatusMigratorio || 'Ciudadano'}
                          onChange={e => updateDependent(idx, 'estatusMigratorio', e.target.value)}
                          className="w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-950 bg-indigo-50/50 cursor-pointer focus:ring-1 focus:ring-indigo-500"
                        >
                          {MIGRATORY_STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      {/* Aplica o No Aplica */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">¿Aplica Cobertura?</label>
                        <select
                          value={dep.aplica ? 'true' : 'false'}
                          onChange={e => updateDependent(idx, 'aplica', e.target.value === 'true')}
                          className={`w-full border rounded-lg px-2 py-1.5 text-xs font-black cursor-pointer ${dep.aplica ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'}`}
                        >
                          <option value="true">🟢 Sí Aplica (Activo)</option>
                          <option value="false">🔴 No Aplica (Inactivo)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Atributos Físicos */}
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-teal-900 uppercase mb-1">Peso (Libras o Kg)</label>
              <input
                type="text"
                value={peso}
                onChange={e => setPeso(e.target.value)}
                placeholder="Ej. 165 lbs / 75 kg"
                className="w-full border border-teal-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-bold bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-teal-900 uppercase mb-1">Altura / Estatura</label>
              <input
                type="text"
                value={altura}
                onChange={e => setAltura(e.target.value)}
                placeholder="Ej. 5'8&quot; / 1.73 m"
                className="w-full border border-teal-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-bold bg-white"
              />
            </div>
          </div>

          {/* Ingresos y Primas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
            <div>
              <label className="block font-extrabold text-emerald-900 uppercase mb-1">Monto de Ingreso ($)</label>
              <input
                type="number"
                step="0.01"
                value={ingresoMonto}
                onChange={e => setIngresoMonto(e.target.value)}
                placeholder="Ej. 2500.00"
                className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-extrabold bg-white text-emerald-950"
              />
            </div>
            <div>
              <label className="block font-extrabold text-teal-900 uppercase mb-1">Monto de Prima ($)</label>
              <input
                type="number"
                step="0.01"
                value={primaMonto}
                onChange={e => setPrimaMonto(e.target.value)}
                placeholder="Ej. 150.00"
                className="w-full border border-teal-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-extrabold bg-white text-teal-950"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-bold text-slate-800 uppercase text-[11px]">Teléfono, Email, Estado y Dirección</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Teléfono</label>
                <input
                  type="text"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  placeholder="(000) 000-0000"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Estado (EE.UU.)</label>
                <input
                  type="text"
                  value={estadoUSA}
                  onChange={e => setEstadoUSA(e.target.value)}
                  placeholder="GA, FL, NJ, TX..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase font-bold bg-white text-emerald-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Dirección Completa</label>
              <input
                type="text"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Ej. 123 Main St, Apt 4, Atlanta, GA 30301"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              />
            </div>
          </div>

          {/* Bank Details */}
          <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl space-y-3">
            <h4 className="font-black text-sky-950 uppercase text-[11px] flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-sky-600" />
              Datos Bancarios del Cliente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-sky-900 uppercase mb-1">Nombre del Banco</label>
                <input
                  type="text"
                  value={bancoNombre}
                  onChange={e => setBancoNombre(e.target.value)}
                  placeholder="Ej. Chase, Bank of America, Wells Fargo"
                  className="w-full border border-sky-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-sky-900 uppercase mb-1">Tipo de Cuenta</label>
                <select
                  value={bancoTipoCuenta}
                  onChange={e => setBancoTipoCuenta(e.target.value)}
                  className="w-full border border-sky-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-semibold"
                >
                  <option value="Corriente (Checking)">Corriente (Checking)</option>
                  <option value="Ahorros (Savings)">Ahorros (Savings)</option>
                  <option value="Comercial (Business)">Comercial (Business)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-sky-900 uppercase mb-1">Titular de la Cuenta</label>
                <input
                  type="text"
                  value={bancoTitular}
                  onChange={e => setBancoTitular(e.target.value)}
                  placeholder="Nombre completo del titular"
                  className="w-full border border-sky-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-sky-900 uppercase mb-1">Routing Number (Ruta)</label>
                <input
                  type="text"
                  maxLength={9}
                  value={bancoRouting}
                  onChange={e => setBancoRouting(e.target.value)}
                  placeholder="9 dígitos"
                  className="w-full border border-sky-300 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-sky-900 uppercase mb-1">Número de Cuenta</label>
                <input
                  type="text"
                  value={bancoCuenta}
                  onChange={e => setBancoCuenta(e.target.value)}
                  placeholder="Número de cuenta bancaria"
                  className="w-full border border-sky-300 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* Payment Method & Payment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/60 p-3 rounded-xl border border-indigo-200">
            <div>
              <label className="block font-extrabold text-indigo-900 uppercase mb-1">Método de Pago</label>
              <select
                value={metodoPago}
                onChange={e => setMetodoPago(e.target.value)}
                className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="Tarjeta de Crédito">💳 Tarjeta de Crédito</option>
                <option value="Tarjeta de Débito">💳 Tarjeta de Débito</option>
                <option value="Cuenta Bancaria (ACH)">🏦 Cuenta Bancaria (ACH)</option>
                <option value="Zelle / Efectivo">💵 Zelle / Efectivo</option>
                <option value="Cheque">📄 Cheque</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Pago Realizado (Estatus)</label>
              <select
                value={pagoRealizado}
                onChange={e => setPagoRealizado(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold bg-white cursor-pointer"
              >
                <option value="TRUE">🟢 SÍ (Al día / Prima Pagada)</option>
                <option value="FALSE">🔴 NO (Pendiente de Pago)</option>
              </select>
            </div>
          </div>

          {/* Health Questionnaire (8 questions) */}
          <div className="p-4 bg-rose-50/70 border-2 border-rose-300/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-rose-200 pb-2">
              <h4 className="font-black text-rose-950 uppercase text-xs flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-rose-600" />
                Cuestionario de Salud Oficial (8 Preguntas) <span className="text-rose-500">*</span>
              </h4>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                Obligatorio
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rose-200/80 text-rose-950 font-black">
                    <th className="py-2 px-1">Pregunta</th>
                    <th className="py-2 px-4 text-center w-16">Sí</th>
                    <th className="py-2 px-4 text-center w-16">No</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100 font-semibold text-slate-800">
                  {[
                    { key: 'tabaco', text: '¿Uso de productos de tabaco?' },
                    { key: 'otras', text: '¿Posee otras pólizas de seguro activas?' },
                    { key: 'rechazos', text: '¿Ha tenido rechazos de seguros previos?' },
                    { key: 'embarazo', text: '¿Embarazo o tratamientos de fertilidad?' },
                    { key: 'hosp', text: '¿Hospitalización en los últimos cinco años?' },
                    { key: 'cancer', text: '¿Diagnóstico de tumores o cáncer?' },
                    { key: 'sintomas', text: '¿Síntomas físicos inexplicables?' },
                    { key: 'cardio', text: '¿Condiciones cardiovasculares?' }
                  ].map(q => (
                    <tr key={q.key}>
                      <td className="py-2 px-1">{q.text}</td>
                      <td className="py-2 px-4 text-center">
                        <input
                          type="radio"
                          name={`sales_${q.key}`}
                          checked={healthQuestions[q.key] === 'si'}
                          onChange={() => handleHealthRadio(q.key, 'si')}
                          className="text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <input
                          type="radio"
                          name={`sales_${q.key}`}
                          checked={healthQuestions[q.key] !== 'si'}
                          onChange={() => handleHealthRadio(q.key, 'no')}
                          className="text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Nota / Observaciones</label>
            <textarea
              rows={2}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ingresa notas o detalles adicionales para administración..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-3 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-slate-200">
            <div className="text-slate-500 text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Se asignará automáticamente el estatus <strong>"Nuevo"</strong> al guardar.</span>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>GUARDAR Y ENVIAR REGISTRO</span>
            </button>
          </div>
        </form>
      </div>

      {/* Success Modal Popup */}
      {showSuccessModal && lastSavedSummary && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border-2 border-emerald-300 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
                  ¡Registro Exitoso!
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Póliza Guardada para Administración
                </h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  El expediente de <strong className="text-slate-900">{lastSavedSummary.nombre}</strong> ha sido guardado exitosamente con estatus <strong className="text-blue-700">"Nuevo"</strong> en el año <strong>{lastSavedSummary.year}</strong>.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Vendedor (Tú):</span>
                <span className="font-extrabold text-amber-900">{lastSavedSummary.vendedor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Agente con Licencia (NPN):</span>
                <span className="font-black text-indigo-900">🛡️ {lastSavedSummary.agente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Tipo de Póliza:</span>
                <span className="font-extrabold text-slate-800">{lastSavedSummary.tipoPoliza}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Compañía Aseguradora:</span>
                <span className="font-extrabold text-slate-800">{lastSavedSummary.carrier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Total de Miembros:</span>
                <span className="font-extrabold text-slate-800">👤 {lastSavedSummary.totalMiembros}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Estatus Asignado:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                  🟢 Nuevo (Pendiente por Administración)
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow transition cursor-pointer"
              >
                Entendido, Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seller's policies list */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-amber-600" />
              <span>Mis Pólizas Registradas</span>
            </h3>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Historial de clientes cargados por <strong>{currentSeller}</strong> (Agente Oficial NPN: <strong>Luis Fernando</strong>)
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={searchTableTerm}
              onChange={e => setSearchTableTerm(e.target.value)}
              placeholder="Buscar en mis pólizas..."
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white text-slate-900 w-full sm:w-48 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
              {myPolicies.length} pólizas
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-200 uppercase font-bold text-[10px] whitespace-nowrap">
              <tr>
                <th className="px-2.5 py-2">Estatus</th>
                <th className="px-2.5 py-2">Tipo Póliza</th>
                <th className="px-2.5 py-2">Nombre y apellido</th>
                <th className="px-2.5 py-2">Miembros</th>
                <th className="px-2.5 py-2">Agente NPN</th>
                <th className="px-2.5 py-2">Fecha nacimiento</th>
                <th className="px-2.5 py-2">Seguro Social</th>
                <th className="px-2.5 py-2">Compañía</th>
                <th className="px-2.5 py-2">Plan</th>
                <th className="px-2.5 py-2">Prima ($)</th>
                <th className="px-2.5 py-2">Teléfono</th>
                <th className="px-2.5 py-2">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
              {filteredMyPolicies.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-slate-400 font-semibold">
                    {searchTableTerm ? 'No se encontraron pólizas con esa búsqueda.' : 'Aún no tienes pólizas registradas.'}
                  </td>
                </tr>
              ) : (
                filteredMyPolicies.map(c => {
                  const isPaid = String(c.pagoRealizado).toUpperCase() === 'TRUE';
                  const statusStyle = getPolicyStatusStyle(c.estatus);
                  const carrierStyle = getCarrierColorStyle(c.carrier);
                  const activeMembers = calculateActiveMembers(c);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      {/* 1. Estatus */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shadow-2xs border ${statusStyle.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dotColor}`}></span>
                          {statusStyle.label}
                        </span>
                      </td>

                      {/* 2. Tipo Póliza */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                          c.tipoPoliza === 'suplementario'
                            ? 'bg-purple-100 text-purple-900 border-purple-300'
                            : 'bg-blue-100 text-blue-900 border-blue-300'
                        }`}>
                          {c.tipoPoliza === 'suplementario' ? '➕ Suplementario' : '🇺🇸 Obama'}
                        </span>
                      </td>

                      {/* 3. Nombre y apellido */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-xs" title={`Nombre completo: ${c.nombre || ''}`}>
                        <span className="truncate max-w-[130px] sm:max-w-[160px] inline-block align-middle font-bold text-slate-900">
                          {formatShortName(c.nombre)}
                        </span>
                      </td>

                      {/* 4. Miembros en póliza */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                          👤 {activeMembers} {activeMembers === 1 ? 'miembro' : 'miembros'}
                        </span>
                      </td>

                      {/* Agente NPN */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-xs">
                        <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded font-black text-[10px] inline-flex items-center gap-1 shadow-2xs">
                          🛡️ {c.agente || 'Luis Fernando'}
                        </span>
                      </td>

                      {/* 5. Fecha de nacimiento */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap font-bold text-slate-800 text-xs">
                        🎂 {c.dbo || '-'}
                      </td>

                      {/* 6. Seguro Social */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap font-mono text-xs font-bold text-slate-800">
                        <span className="bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                          🔒 {c.ssn || '-'}
                        </span>
                      </td>

                      {/* 7. Compañías de seguros */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold inline-flex items-center gap-1.5 border shadow-2xs ${carrierStyle.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${carrierStyle.dotColor}`}></span>
                          <span>🛡️ {c.carrier || 'General'}</span>
                        </span>
                      </td>

                      {/* 8. Plan */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1 max-w-[130px] truncate" title={c.nombrePlan}>
                          📑 {c.nombrePlan || '-'}
                        </span>
                      </td>

                      {/* 9. Prima ($) */}
                      <td className="px-2.5 py-1.5 font-mono font-bold text-teal-700 whitespace-nowrap text-xs">
                        ${(c.primaMonto || 0).toFixed(2)}
                      </td>

                      {/* 10. Teléfono */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-xs">📞 {c.telefono || '-'}</td>

                      {/* 11. Pago */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                          isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {isPaid ? '🟢 SÍ' : '🔴 NO'}
                        </span>
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
