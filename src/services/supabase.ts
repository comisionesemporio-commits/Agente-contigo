import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ClientPolicy, CalendarEvent } from '../types';
import {
  DEFAULT_SUPABASE_KEY, DEFAULT_SUPABASE_URL,
  formatToUSDate, formatToISODate, formatDateToHumanSpanish, calculateAgeFromDBO
} from './storage';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseConfig() {
  const env = (import.meta as any).env || {};

  // Check Netlify/Vite environment variables with both prefixes
  const envUrl = (
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    env.VITE_PUBLIC_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const envKey = (
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  // Check localStorage (user manually entered in Settings panel)
  const storedUrl = (localStorage.getItem('app_supabase_url') || '').trim();
  const storedKey = (localStorage.getItem('app_supabase_key') || '').trim();

  const isInvalidOrDemoKey = (k: string) => !k || k.includes('...') || k.length < 35;

  let url = storedUrl;
  let key = storedKey;

  // If localStorage has an invalid or demo key, or is empty, but environment has valid keys:
  if ((!url || !key || isInvalidOrDemoKey(key)) && envUrl && envKey && !isInvalidOrDemoKey(envKey)) {
    url = envUrl;
    key = envKey;
    try {
      localStorage.setItem('app_supabase_url', envUrl);
      localStorage.setItem('app_supabase_key', envKey);
    } catch (_) {}
  } else if (!url || !key) {
    url = url || envUrl || DEFAULT_SUPABASE_URL;
    key = key || envKey || DEFAULT_SUPABASE_KEY;
  }

  return { url, key };
}

export function initSupabase(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;

  // If the key is an obvious truncated placeholder with '...', do not attempt request
  if (key.includes('...') || key.length < 35) {
    console.warn("Supabase key is a placeholder or truncated. Please provide a valid Supabase anon key.");
    return null;
  }

  try {
    if (!supabaseInstance || (supabaseInstance as any)?.__url !== url || (supabaseInstance as any)?.__key !== key) {
      supabaseInstance = createClient(url, key, {
        auth: { persistSession: false }
      });
      (supabaseInstance as any).__url = url;
      (supabaseInstance as any).__key = key;
    }
    return supabaseInstance;
  } catch (err) {
    console.warn("Could not initialize Supabase:", err);
    supabaseInstance = null;
    return null;
  }
}

export function mapClientToSupabaseRow(client: ClientPolicy) {
  const fullName = (client.nombre || 'Sin Nombre').trim();
  const spaceIdx = fullName.indexOf(' ');
  let firstName = fullName;
  let lastName = '';
  if (spaceIdx > 0) {
    firstName = fullName.substring(0, spaceIdx);
    lastName = fullName.substring(spaceIdx + 1);
  }

  // Normalizar fechas a formato de Estados Unidos (Mes / Día / Año -> MM/DD/YYYY)
  const usDbo = formatToUSDate(client.dbo);
  const usIngresoFecha = formatToUSDate(client.ingresoFecha);
  const usCreatedDate = formatToUSDate(client.createdDate);
  const calculatedAge = client.edad || calculateAgeFromDBO(usDbo);

  const extraData = {
    dbo: usDbo,
    dbo_iso: formatToISODate(usDbo),
    dbo_human: formatDateToHumanSpanish(usDbo),
    edad: calculatedAge,
    email: client.email || '',
    ingresoFecha: usIngresoFecha,
    createdDate: usCreatedDate,
    carrier: client.carrier || 'Oscar',
    numPoliza: client.numPoliza || '',
    nombrePlan: client.nombrePlan || '',
    peso: client.peso || '',
    altura: client.altura || '',
    bancoNombre: client.bancoNombre || '',
    bancoTipoCuenta: client.bancoTipoCuenta || '',
    bancoTitular: client.bancoTitular || '',
    bancoRouting: client.bancoRouting || '',
    bancoCuenta: client.bancoCuenta || '',
    cuestionarioSalud: client.cuestionarioSalud || {},
    commissions: client.commissions || {},
    numDependientes: client.numDependientes || 0,
    datosDependientes: client.datosDependientes || '',
    mesIngreso: client.mesIngreso || 'Enero',
    ingresoMonto: client.ingresoMonto || 0,
    primaMonto: client.primaMonto || 0,
    pagoRealizado: client.pagoRealizado || 'TRUE',
    docStatus: client.docStatus || 'Documento Completos',
    estatusMigratorio: client.estatusMigratorio || 'Ciudadano',
    agente: client.agente || client.vendedor || 'General'
  };

  // El id siempre debe enviarse para que Supabase guarde o actualice la fila correctamente
  const recordId = String(client.id || ('client-' + Date.now())).trim();

  const row: Record<string, any> = {
    id: recordId,
    nombre: firstName,
    apellido: lastName,
    telefono: client.telefono || '',
    ssn: client.ssn || '',
    estado: (client.estadoUSA || 'GA').toUpperCase(),
    vendedor: client.vendedor || 'General',
    estatus: client.estatus || 'Activo',
    anio: parseInt(client.createdYear || "2026") || 2026,
    direccion: client.direccion || '',
    metodo_pago: client.metodoPago || 'Tarjeta de Crédito',
    enfermedades: JSON.stringify(extraData)
  };

  return row;
}

export function mapSupabaseRowToClient(row: any, defaultYear = "2026"): ClientPolicy {
  const fullName = [row.nombre, row.apellido].filter(Boolean).join(' ') || 'Sin Nombre';
  let extraData: any = {};
  try {
    if (row.enfermedades && (row.enfermedades.startsWith('{') || row.enfermedades.startsWith('['))) {
      extraData = JSON.parse(row.enfermedades);
    }
  } catch (e) {
    extraData = {};
  }

  const rawDbo = row.dbo || extraData.dbo || '';
  const usDbo = formatToUSDate(rawDbo);
  const calculatedAge = parseInt(row.edad || extraData.edad) || calculateAgeFromDBO(usDbo);

  return {
    id: row.id ? String(row.id) : ("client-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4)),
    nombre: fullName,
    numDependientes: parseInt(row.numDependientes || row.miembros || extraData.numDependientes) || 0,
    datosDependientes: extraData.datosDependientes || row.datosDependientes || '',
    estadoUSA: (row.estado || 'GA').toUpperCase(),
    mesIngreso: row.mesIngreso || row.activo_desde || extraData.mesIngreso || 'Enero',
    estatus: row.estatus || row.estado_poliza || 'Activo',
    ssn: row.ssn || '',
    docStatus: row.docStatus || row.documento || extraData.docStatus || 'Documento Completos',
    estatusMigratorio: row.estatusMigratorio || extraData.estatusMigratorio || 'Ciudadano',
    telefono: row.telefono || '',
    email: row.email || row.correo || extraData.email || '',
    direccion: row.direccion || '',
    dbo: usDbo,
    edad: calculatedAge,
    metodoPago: row.metodoPago || row.metodo_pago || 'Tarjeta de Crédito',
    pagoRealizado: String(row.pagoRealizado || row.pago_realizado || extraData.pagoRealizado || 'TRUE'),
    ingresoFecha: formatToUSDate(row.ingresoFecha || row.ingreso || extraData.ingresoFecha || row.created_at || ''),
    ingresoMonto: parseFloat(row.ingresoMonto || extraData.ingresoMonto) || 0,
    primaMonto: parseFloat(row.primaMonto || extraData.primaMonto) || 0,
    notas: row.notas || row.nota || '',
    vendedor: row.vendedor || 'General',
    agente: row.agente || extraData.agente || row.vendedor || 'General',
    carrier: row.carrier || row.aseguradora || extraData.carrier || 'Oscar',
    numPoliza: row.numPoliza || row.num_poliza || extraData.numPoliza || '',
    createdDate: formatToUSDate(row.createdDate || extraData.createdDate || row.created_at || ''),
    createdYear: String(row.anio || row.createdYear || defaultYear),
    nombrePlan: extraData.nombrePlan || row.nombrePlan || '',
    peso: extraData.peso || row.peso || '',
    altura: extraData.altura || row.altura || '',
    bancoNombre: extraData.bancoNombre || row.bancoNombre || '',
    bancoTipoCuenta: extraData.bancoTipoCuenta || row.bancoTipoCuenta || 'Corriente (Checking)',
    bancoTitular: extraData.bancoTitular || row.bancoTitular || '',
    bancoRouting: extraData.bancoRouting || row.bancoRouting || '',
    bancoCuenta: extraData.bancoCuenta || row.bancoCuenta || '',
    cuestionarioSalud: extraData.cuestionarioSalud || {},
    commissions: extraData.commissions || {}
  };
}

export function mapCalendarEventToSupabaseRow(event: CalendarEvent) {
  return {
    id: event.id,
    titulo: event.titulo || 'Cita de Asesoría',
    descripcion: event.descripcion || '',
    fecha: event.fecha || '',
    hora_inicio: event.horaInicio || '',
    hora_fin: event.horaFin || '',
    tipo: event.tipo || 'otro',
    cliente_relacionado: event.clienteRelacionado || '',
    link_reunion: event.linkReunion || '',
    asignado_a: event.asignadoA || 'Administrador',
    completada: !!event.completada,
    creada_en: event.creadaEn || new Date().toISOString().split('T')[0]
  };
}

export function mapSupabaseRowToCalendarEvent(row: any): CalendarEvent {
  return {
    id: String(row.id),
    titulo: row.titulo || 'Cita / Evento',
    descripcion: row.descripcion || '',
    fecha: row.fecha || '',
    horaInicio: row.hora_inicio || row.horaInicio || '',
    horaFin: row.hora_fin || row.horaFin || '',
    tipo: (row.tipo || 'otro') as any,
    clienteRelacionado: row.cliente_relacionado || row.clienteRelacionado || '',
    linkReunion: row.link_reunion || row.linkReunion || '',
    asignadoA: row.asignado_a || row.asignadoA || 'Administrador',
    completada: Boolean(row.completada),
    creadaEn: row.creada_en || row.creadaEn || new Date().toISOString().split('T')[0]
  };
}

export function getSupabaseSetupSQL(): string {
  return `-- ==============================================================
-- SCRIPT SQL OFICIAL PARA SUPERBASE (AGENTE CONTIGO)
-- Copia y pega este script en el 'SQL Editor' de tu panel de Supabase
-- y presiona 'RUN' para crear las tablas con permisos públicos.
-- ==============================================================

-- 1. TABLA: clientes (Pólizas y Expedientes)
CREATE TABLE IF NOT EXISTS public.clientes (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  apellido TEXT,
  telefono TEXT,
  ssn TEXT,
  estado TEXT,
  vendedor TEXT,
  estatus TEXT,
  anio INTEGER,
  direccion TEXT,
  metodo_pago TEXT,
  enfermedades TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: cotizaciones (Propuestas Médicas Generadas)
CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id TEXT PRIMARY KEY,
  cliente_nombre TEXT,
  ubicacion TEXT,
  miembros TEXT,
  anio TEXT,
  agente TEXT,
  planes JSONB,
  total_mensual NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: tareas (Agenda Diaria de Actividades)
CREATE TABLE IF NOT EXISTS public.tareas (
  id TEXT PRIMARY KEY,
  titulo TEXT,
  descripcion TEXT,
  fecha_vencimiento TEXT,
  prioridad TEXT,
  categoria TEXT,
  estado TEXT,
  cliente_relacionado TEXT,
  asignado_a TEXT,
  creada_en TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: eventos_calendario (Agenda y Citas del Calendario Compartido)
CREATE TABLE IF NOT EXISTS public.eventos_calendario (
  id TEXT PRIMARY KEY,
  titulo TEXT,
  descripcion TEXT,
  fecha TEXT,
  hora_inicio TEXT,
  hora_fin TEXT,
  tipo TEXT,
  cliente_relacionado TEXT,
  link_reunion TEXT,
  asignado_a TEXT,
  completada BOOLEAN DEFAULT FALSE,
  creada_en TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desactivar RLS o dar acceso público anónimo para sincronización directa
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_calendario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access clientes" ON public.clientes;
CREATE POLICY "Public access clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access cotizaciones" ON public.cotizaciones;
CREATE POLICY "Public access cotizaciones" ON public.cotizaciones FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access tareas" ON public.tareas;
CREATE POLICY "Public access tareas" ON public.tareas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access eventos_calendario" ON public.eventos_calendario;
CREATE POLICY "Public access eventos_calendario" ON public.eventos_calendario FOR ALL USING (true) WITH CHECK (true);
`;
}
