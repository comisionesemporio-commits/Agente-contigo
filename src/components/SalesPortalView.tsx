import React, { useState } from 'react';
import { ClientPolicy, HealthQuestions } from '../types';
import {
  Send, Copy, CheckCircle2, MessageSquare, Plus,
  FileCheck, Shield, HeartPulse, User, Phone, MapPin, Building
} from 'lucide-react';
import { MONTHS_LIST, formatToUSDate, formatToISODate, calculateAgeFromDBO, formatDateToHumanSpanish } from '../services/storage';

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
  const [nombre, setNombre] = useState('');
  const [numPoliza, setNumPoliza] = useState('');
  const [regYear, setRegYear] = useState(selectedYear);
  const [ssn, setSsn] = useState('');
  const [estatusMigratorio, setEstatusMigratorio] = useState('Ciudadano');
  const [dbo, setDbo] = useState('');
  const [edad, setEdad] = useState<number>(0);
  const [carrier, setCarrier] = useState('');
  const [mesIngreso, setMesIngreso] = useState('Enero');
  const [nombrePlan, setNombrePlan] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [ingresoMonto, setIngresoMonto] = useState('');
  const [primaMonto, setPrimaMonto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [estadoUSA, setEstadoUSA] = useState('GA');
  const [direccion, setDireccion] = useState('');

  // Bank
  const [bancoNombre, setBancoNombre] = useState('');
  const [bancoTipoCuenta, setBancoTipoCuenta] = useState('Corriente (Checking)');
  const [bancoTitular, setBancoTitular] = useState('');
  const [bancoRouting, setBancoRouting] = useState('');
  const [bancoCuenta, setBancoCuenta] = useState('');

  // Payment
  const [metodoPago, setMetodoPago] = useState('Tarjeta de Crédito');
  const [pagoRealizado, setPagoRealizado] = useState('TRUE');

  // Dependents
  const [numDependientes, setNumDependientes] = useState('0');
  const [datosDependientes, setDatosDependientes] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear());
    const dateUS = `${month}/${day}/${year}`;

    const usDbo = formatToUSDate(dbo);
    const finalAge = edad || calculateAgeFromDBO(usDbo);

    onSaveNewPolicy({
      vendedor: currentSeller || 'Vendedor General',
      numPoliza: numPoliza.trim(),
      nombre: nombre.trim(),
      estatus: 'Nuevo',
      carrier: carrier.trim() || 'Oscar',
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
      ingresoFecha: dateUS,
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
      numDependientes: parseInt(numDependientes) || 0,
      datosDependientes: datosDependientes.trim(),
      pagoRealizado,
      notas: notas.trim(),
      createdDate: dateUS,
      createdYear: regYear || selectedYear,
      commissions: {}
    });

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
    setNumDependientes('0');
    setDatosDependientes('');
    setNotas('');
  };

  // Filter seller's own policies
  const myPolicies = clients.filter(
    c => (c.vendedor || '').trim().toLowerCase() === (currentSeller || '').trim().toLowerCase()
  );

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
            Llena los datos del cliente vendido. La información se guardará automáticamente en el año {selectedYear} y en Supabase.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onCopyLink}
            className="px-3.5 py-2 bg-white text-amber-800 hover:bg-amber-50 rounded-xl text-xs font-extrabold shadow transition flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5 text-amber-600" />
            <span>Copiar Enlace</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 bg-amber-950/80 hover:bg-amber-950 text-white rounded-xl text-xs font-extrabold border border-amber-800 transition"
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
            Se debe pasar la imagen del documento por WhatsApp al equipo de emisión.
          </p>
        </div>
      </div>

      {/* Registration Form */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-lg max-w-4xl mx-auto">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4 flex items-center pb-2 border-b border-slate-100 gap-2">
          <Plus className="w-4 h-4 text-amber-600" />
          Formulario de Registro de Póliza
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Header Row */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-black text-amber-900 uppercase mb-1">Vendedor / Agente</label>
              <input
                type="text"
                readOnly
                value={currentSeller}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-xs font-black bg-amber-100 text-amber-950 cursor-not-allowed"
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

          {/* Client Name */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block font-black text-slate-800 uppercase mb-1">Nombre y Apellido *</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Roberto Carlos Pérez"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-black text-slate-900"
            />
          </div>

          {/* SSN & Migratory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Social</label>
              <input
                type="text"
                value={ssn}
                onChange={e => setSsn(e.target.value)}
                placeholder="XXX-XX-XXXX"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Estatus Migratorio</label>
              <select
                value={estatusMigratorio}
                onChange={e => setEstatusMigratorio(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold bg-white"
              >
                <option value="Ciudadano">Ciudadano</option>
                <option value="Residente">Residente</option>
                <option value="Permiso de Trabajo">Permiso de Trabajo</option>
                <option value="En Proceso">En Proceso</option>
                <option value="DACA / Otro">DACA / Otro</option>
              </select>
            </div>
          </div>

          {/* DBO & Automatic Age Calculation */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Carrier & Month & Plan */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Compañía</label>
                <input
                  type="text"
                  list="portal-carriers"
                  value={carrier}
                  onChange={e => setCarrier(e.target.value)}
                  placeholder="Selecciona o escribe..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
                />
                <datalist id="portal-carriers">
                  {customCarriers.map(car => (
                    <option key={car} value={car} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Mes Activo (Activo desde)</label>
                <select
                  value={mesIngreso}
                  onChange={e => setMesIngreso(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold bg-white"
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

          {/* Weight & Height */}
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

          {/* Ingreso & Prima */}
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
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Estado (EE.UU.)</label>
                <input
                  type="text"
                  value={estadoUSA}
                  onChange={e => setEstadoUSA(e.target.value)}
                  placeholder="GA, FL, NJ, TX..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase font-bold"
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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

          {/* Dependents */}
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
            <h4 className="font-bold text-purple-900 uppercase text-[11px] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-600" />
              Información de Miembros (Dependientes)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-purple-900 uppercase mb-1">Miembros</label>
                <input
                  type="number"
                  min="0"
                  value={numDependientes}
                  onChange={e => setNumDependientes(e.target.value)}
                  className="w-full border border-purple-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none font-bold bg-white"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-bold text-purple-900 uppercase mb-1">Detalles de Miembros</label>
                <input
                  type="text"
                  value={datosDependientes}
                  onChange={e => setDatosDependientes(e.target.value)}
                  placeholder="Ej. Esposa: María Pérez Social XXX-XX-XXXX, Hijo: Carlos D.B.O 01/02/2018"
                  className="w-full border border-purple-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* Health Questionnaire (8 questions) */}
          <div className="p-4 bg-rose-50/70 border-2 border-rose-300/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-rose-200 pb-2">
              <h4 className="font-black text-rose-950 uppercase text-xs flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-rose-600" />
                Cuestionario de Salud <span className="text-rose-500">*</span>
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
              placeholder="Ingresa notas o detalles adicionales..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>GUARDAR Y ENVIAR REGISTRO</span>
            </button>
          </div>
        </form>
      </div>

      {/* Seller's policies list */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-amber-600" />
            Mis Pólizas Registradas
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
            {myPolicies.length} pólizas a mi nombre
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-200 uppercase font-semibold text-[11px]">
              <tr>
                <th className="p-3">Estatus</th>
                <th className="p-3">Nombres y Apellidos</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Físico</th>
                <th className="p-3">Edad / DBO</th>
                <th className="p-3">Miembros</th>
                <th className="p-3">Social</th>
                <th className="p-3">Método / Banco</th>
                <th className="p-3">Teléfono</th>
                <th className="p-3">Activo desde</th>
                <th className="p-3">Ingreso ($)</th>
                <th className="p-3">Prima ($)</th>
                <th className="p-3">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {myPolicies.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-6 text-center text-slate-400 font-semibold">
                    Aún no tienes pólizas registradas.
                  </td>
                </tr>
              ) : (
                myPolicies.map(c => {
                  const isPaid = String(c.pagoRealizado).toUpperCase() === 'TRUE';
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 whitespace-nowrap">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {c.estatus}
                        </span>
                      </td>
                      <td className="p-3 font-extrabold text-slate-900">{c.nombre}</td>
                      <td className="p-3 font-bold text-indigo-800">{c.nombrePlan || '-'}</td>
                      <td className="p-3 text-[10px] font-bold text-slate-600">
                        ⚖️ {c.peso || '-'} / 📏 {c.altura || '-'}
                      </td>
                      <td className="p-3 whitespace-nowrap font-bold text-slate-800">
                        {c.edad || 0}a ({c.dbo || '-'})
                      </td>
                      <td className="p-3 font-bold text-purple-700">{c.numDependientes || 0}</td>
                      <td className="p-3 whitespace-nowrap font-mono text-[10px]">{c.ssn || '-'}</td>
                      <td className="p-3 text-[10px] font-bold text-sky-800">
                        🏦 {c.bancoNombre || c.metodoPago || '-'}
                      </td>
                      <td className="p-3">{c.telefono || '-'}</td>
                      <td className="p-3 font-bold text-emerald-700">{c.mesIngreso || 'Enero'}</td>
                      <td className="p-3 font-mono font-bold text-emerald-700">${(c.ingresoMonto || 0).toFixed(2)}</td>
                      <td className="p-3 font-mono font-bold text-teal-700">${(c.primaMonto || 0).toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
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
