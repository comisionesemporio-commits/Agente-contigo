import React, { useState, useEffect } from 'react';
import { ClientPolicy, HealthQuestions } from '../../types';
import {
  X, UserPen, RotateCw, Trash2, Save,
  Building, Phone, MapPin, HeartPulse, User
} from 'lucide-react';
import { MONTHS_LIST } from '../../services/storage';

interface ClientModalProps {
  isOpen: boolean;
  client: ClientPolicy | null;
  selectedYear: string;
  customCarriers: string[];
  customStatuses: string[];
  customSellers: string[];
  onClose: () => void;
  onSave: (clientData: ClientPolicy) => void;
  onDelete: (clientId: string) => void;
  onRenew: (clientData: ClientPolicy) => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  client,
  selectedYear,
  customCarriers,
  customStatuses,
  customSellers,
  onClose,
  onSave,
  onDelete,
  onRenew
}) => {
  const [formData, setFormData] = useState<Partial<ClientPolicy>>({});

  useEffect(() => {
    if (client) {
      setFormData({ ...client });
    } else {
      setFormData({
        id: '',
        nombre: '',
        numPoliza: '',
        vendedor: 'General',
        createdYear: selectedYear,
        estatus: 'Activo',
        carrier: 'Oscar',
        nombrePlan: '',
        peso: '',
        altura: '',
        bancoNombre: '',
        bancoTipoCuenta: 'Corriente (Checking)',
        bancoTitular: '',
        bancoRouting: '',
        bancoCuenta: '',
        cuestionarioSalud: {
          tabaco: 'no', otras: 'no', rechazos: 'no', embarazo: 'no',
          hosp: 'no', cancer: 'no', sintomas: 'no', cardio: 'no'
        },
        mesIngreso: 'Enero',
        docStatus: 'Documento Completos',
        estatusMigratorio: 'Ciudadano',
        ingresoFecha: '',
        ingresoMonto: 0,
        primaMonto: 0,
        metodoPago: 'Tarjeta de Crédito',
        estadoUSA: 'GA',
        telefono: '',
        email: '',
        ssn: '',
        dbo: '',
        edad: 0,
        direccion: '',
        numDependientes: 0,
        pagoRealizado: 'TRUE',
        notas: ''
      });
    }
  }, [client, selectedYear, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof ClientPolicy, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleHealthRadio = (field: string, val: string) => {
    setFormData(prev => ({
      ...prev,
      cuestionarioSalud: { ...(prev.cuestionarioSalud || {}), [field]: val }
    }));
  };

  const handleDboChange = (val: string) => {
    handleChange('dbo', val);
    if (!val) return;
    try {
      const birthDate = new Date(val);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        let calcAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) calcAge--;
        if (calcAge >= 0) handleChange('edad', calcAge);
      }
    } catch (e) {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre?.trim()) return;

    const finalClient: ClientPolicy = {
      ...(formData as ClientPolicy),
      id: formData.id || ('client-' + Date.now()),
      createdYear: formData.createdYear || selectedYear
    };
    onSave(finalClient);
  };

  const handleQuickRenewal = () => {
    if (!formData.nombre?.trim()) return;
    const finalClient: ClientPolicy = {
      ...(formData as ClientPolicy),
      id: formData.id || ('client-' + Date.now())
    };
    onRenew(finalClient);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden my-8 border border-slate-200">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <UserPen className="w-4 h-4 text-emerald-400" />
            <span>{client ? `Editar Expediente: ${client.nombre}` : 'Nuevo Registro de Póliza'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {/* Top Year & Renewal Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <label className="font-extrabold text-amber-900 uppercase">
                Año del Registro:
              </label>
              <select
                value={formData.createdYear || selectedYear}
                onChange={e => handleChange('createdYear', e.target.value)}
                className="bg-white border border-amber-300 font-extrabold text-slate-900 text-xs px-3 py-1.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
              </select>
            </div>

            {client && (
              <button
                type="button"
                onClick={handleQuickRenewal}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-extrabold rounded-xl shadow text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>Renovación Rápida Anual (Duplicar a Año Siguiente)</span>
              </button>
            )}
          </div>

          {/* Policy Data */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <h4 className="font-bold text-slate-800 uppercase text-[11px] flex items-center text-emerald-700">
              Datos Personales y Documentación
            </h4>

            <div>
              <label className="block font-black text-slate-800 uppercase mb-1">Nombre y Apellido *</label>
              <input
                type="text"
                required
                value={formData.nombre || ''}
                onChange={e => handleChange('nombre', e.target.value)}
                placeholder="Ej. Roberto Carlos Pérez"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-black text-slate-900 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Social</label>
                <input
                  type="text"
                  value={formData.ssn || ''}
                  onChange={e => handleChange('ssn', e.target.value)}
                  placeholder="XXX-XX-XXXX"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-900 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Estatus Migratorio</label>
                <select
                  value={formData.estatusMigratorio || 'Ciudadano'}
                  onChange={e => handleChange('estatusMigratorio', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
                >
                  <option value="Ciudadano">Ciudadano</option>
                  <option value="Residente">Residente</option>
                  <option value="Permiso de Trabajo">Permiso de Trabajo</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="DACA / Otro">DACA / Otro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Fecha de Nacimiento (D.B.O)</label>
                <input
                  type="date"
                  value={formData.dbo || ''}
                  onChange={e => handleDboChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Edad</label>
                <input
                  type="number"
                  readOnly
                  value={formData.edad || 0}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-black bg-emerald-50 text-emerald-900"
                />
              </div>
            </div>
          </div>

          {/* Carrier & Plan */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Compañía</label>
                <input
                  type="text"
                  list="client-modal-carriers"
                  value={formData.carrier || ''}
                  onChange={e => handleChange('carrier', e.target.value)}
                  placeholder="Escribe o selecciona..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
                />
                <datalist id="client-modal-carriers">
                  {customCarriers.map(car => (
                    <option key={car} value={car} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Mes Activo (Activo desde)</label>
                <select
                  value={formData.mesIngreso || 'Enero'}
                  onChange={e => handleChange('mesIngreso', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
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
                value={formData.nombrePlan || ''}
                onChange={e => handleChange('nombrePlan', e.target.value)}
                placeholder="Ej. Silver Standard, Gold Bronze Plus..."
                className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold bg-white text-indigo-950"
              />
            </div>
          </div>

          {/* Physical Attributes */}
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-teal-900 uppercase mb-1">Peso (Libras o Kg)</label>
              <input
                type="text"
                value={formData.peso || ''}
                onChange={e => handleChange('peso', e.target.value)}
                placeholder="Ej. 165 lbs / 75 kg"
                className="w-full border border-teal-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-bold bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-teal-900 uppercase mb-1">Altura / Estatura</label>
              <input
                type="text"
                value={formData.altura || ''}
                onChange={e => handleChange('altura', e.target.value)}
                placeholder="Ej. 5'8&quot; / 1.73 m"
                className="w-full border border-teal-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-bold bg-white"
              />
            </div>
          </div>

          {/* Income & Premium */}
          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-extrabold text-emerald-900 uppercase mb-1">Monto del Ingreso ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.ingresoMonto || ''}
                onChange={e => handleChange('ingresoMonto', parseFloat(e.target.value) || 0)}
                placeholder="Ej. 2500.00"
                className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-xs font-extrabold text-emerald-950 bg-white"
              />
            </div>
            <div>
              <label className="block font-extrabold text-teal-900 uppercase mb-1">Monto de la Prima ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.primaMonto || ''}
                onChange={e => handleChange('primaMonto', parseFloat(e.target.value) || 0)}
                placeholder="Ej. 150.00"
                className="w-full border border-teal-300 rounded-lg px-3 py-2 text-xs font-extrabold text-teal-950 bg-white"
              />
            </div>
          </div>

          {/* Banking Details */}
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
                  value={formData.bancoNombre || ''}
                  onChange={e => handleChange('bancoNombre', e.target.value)}
                  placeholder="Ej. Chase, Wells Fargo"
                  className="w-full border border-sky-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-sky-900 uppercase mb-1">Tipo de Cuenta</label>
                <select
                  value={formData.bancoTipoCuenta || 'Corriente (Checking)'}
                  onChange={e => handleChange('bancoTipoCuenta', e.target.value)}
                  className="w-full border border-sky-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
                >
                  <option value="Corriente (Checking)">Corriente (Checking)</option>
                  <option value="Ahorros (Savings)">Ahorros (Savings)</option>
                  <option value="Comercial (Business)">Comercial (Business)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-sky-900 uppercase mb-1">Titular de Cuenta</label>
                <input
                  type="text"
                  value={formData.bancoTitular || ''}
                  onChange={e => handleChange('bancoTitular', e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full border border-sky-300 rounded-lg px-3 py-2 text-xs bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-sky-900 uppercase mb-1">Routing Number</label>
                <input
                  type="text"
                  maxLength={9}
                  value={formData.bancoRouting || ''}
                  onChange={e => handleChange('bancoRouting', e.target.value)}
                  placeholder="9 dígitos"
                  className="w-full border border-sky-300 rounded-lg px-3 py-2 text-xs font-mono font-bold bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-sky-900 uppercase mb-1">Número de Cuenta</label>
                <input
                  type="text"
                  value={formData.bancoCuenta || ''}
                  onChange={e => handleChange('bancoCuenta', e.target.value)}
                  placeholder="Número de cuenta"
                  className="w-full border border-sky-300 rounded-lg px-3 py-2 text-xs font-mono font-bold bg-white"
                />
              </div>
            </div>
          </div>

          {/* Contact & Address */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-bold text-slate-800 uppercase text-[11px]">Teléfono, Email, Estado y Dirección</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Teléfono</label>
                <input
                  type="text"
                  value={formData.telefono || ''}
                  onChange={e => handleChange('telefono', e.target.value)}
                  placeholder="(000) 000-0000"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={e => handleChange('email', e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 uppercase mb-1">Dirección Completa</label>
                <input
                  type="text"
                  value={formData.direccion || ''}
                  onChange={e => handleChange('direccion', e.target.value)}
                  placeholder="Ej. 263 Summit Ridge Dr, Lawrenceville, GA 30046"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Estado (EE.UU.)</label>
                <input
                  type="text"
                  value={formData.estadoUSA || ''}
                  onChange={e => handleChange('estadoUSA', e.target.value)}
                  placeholder="GA, NJ, FL..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs uppercase font-extrabold text-emerald-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Health Questions */}
          <div className="p-4 bg-rose-50/70 border-2 border-rose-300/80 rounded-2xl space-y-3">
            <h4 className="font-black text-rose-950 uppercase text-xs flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-rose-600" />
              Cuestionario de Salud Oficial (8 Preguntas)
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rose-200 text-rose-950 font-black">
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
                  ].map(q => {
                    const val = formData.cuestionarioSalud?.[q.key] || 'no';
                    return (
                      <tr key={q.key}>
                        <td className="py-2 px-1">{q.text}</td>
                        <td className="py-2 px-4 text-center">
                          <input
                            type="radio"
                            name={`edit_${q.key}`}
                            checked={val === 'si'}
                            onChange={() => handleHealthRadio(q.key, 'si')}
                            className="w-4 h-4 text-rose-600"
                          />
                        </td>
                        <td className="py-2 px-4 text-center">
                          <input
                            type="radio"
                            name={`edit_${q.key}`}
                            checked={val !== 'si'}
                            onChange={() => handleHealthRadio(q.key, 'no')}
                            className="w-4 h-4 text-rose-600"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status & Seller */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Estatus Póliza</label>
              <select
                value={formData.estatus || 'Activo'}
                onChange={e => handleChange('estatus', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white"
              >
                {customStatuses.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Vendedor / Agente</label>
              <input
                type="text"
                list="client-modal-sellers"
                value={formData.vendedor || 'General'}
                onChange={e => handleChange('vendedor', e.target.value)}
                placeholder="Ej. Carlos Mendoza"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
              />
              <datalist id="client-modal-sellers">
                {customSellers.map(v => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Documento / Num Póliza</label>
              <input
                type="text"
                value={formData.numPoliza || ''}
                onChange={e => handleChange('numPoliza', e.target.value)}
                placeholder="Ej. POL-992301"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono bg-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Nota / Observaciones</label>
            <textarea
              rows={2}
              value={formData.notas || ''}
              onChange={e => handleChange('notas', e.target.value)}
              placeholder="Escribe notas adicionales..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
            />
          </div>

          {/* Action Footer */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-200">
            {client && (
              <button
                type="button"
                onClick={() => onDelete(client.id)}
                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Expediente</span>
              </button>
            )}

            <div className="flex space-x-2 ml-auto">
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
                <span>Guardar Expediente</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
