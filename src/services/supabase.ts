import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ClientPolicy } from '../types';
import { DEFAULT_SUPABASE_KEY, DEFAULT_SUPABASE_URL } from './storage';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseConfig() {
  const url = localStorage.getItem('app_supabase_url') || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem('app_supabase_key') || DEFAULT_SUPABASE_KEY;
  return { url, key };
}

export function initSupabase(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  try {
    supabaseInstance = createClient(url, key, {
      auth: { persistSession: false }
    });
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

  const extraData = {
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
    estatusMigratorio: client.estatusMigratorio || 'Ciudadano'
  };

  const row: Record<string, any> = {
    nombre: firstName,
    apellido: lastName,
    telefono: client.telefono || '',
    ssn: client.ssn || '',
    estado: client.estadoUSA || 'GA',
    vendedor: client.vendedor || 'General',
    estatus: client.estatus || 'Activo',
    anio: parseInt(client.createdYear || "2026") || 2026,
    direccion: client.direccion || '',
    metodo_pago: client.metodoPago || 'Tarjeta de Crédito',
    enfermedades: JSON.stringify(extraData)
  };

  if (client.id && !String(client.id).startsWith('client-')) {
    row.id = client.id;
  }

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
    email: row.email || row.correo || '',
    direccion: row.direccion || '',
    dbo: row.dbo || '',
    edad: parseInt(row.edad) || 0,
    metodoPago: row.metodoPago || row.metodo_pago || 'Tarjeta de Crédito',
    pagoRealizado: String(row.pagoRealizado || row.pago_realizado || extraData.pagoRealizado || 'TRUE'),
    ingresoFecha: row.ingresoFecha || row.ingreso || row.created_at || '',
    ingresoMonto: parseFloat(row.ingresoMonto || extraData.ingresoMonto) || 0,
    primaMonto: parseFloat(row.primaMonto || extraData.primaMonto) || 0,
    notas: row.notas || row.nota || '',
    vendedor: row.vendedor || 'General',
    carrier: row.carrier || row.aseguradora || 'Oscar',
    numPoliza: row.numPoliza || row.num_poliza || '',
    createdDate: row.createdDate || row.created_at || '',
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

-- Desactivar RLS o dar acceso público anónimo para sincronización directa
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access clientes" ON public.clientes;
CREATE POLICY "Public access clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access cotizaciones" ON public.cotizaciones;
CREATE POLICY "Public access cotizaciones" ON public.cotizaciones FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access tareas" ON public.tareas;
CREATE POLICY "Public access tareas" ON public.tareas FOR ALL USING (true) WITH CHECK (true);
`;
}
