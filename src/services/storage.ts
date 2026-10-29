import { ClientPolicy, Agent, DailyTask, CalendarEvent, CarrierConfig, CarrierColorPreset } from '../types';

export const MONTHS_LIST = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Catálogo dinámico de vendedores: se sincroniza exclusivamente con Supabase en tiempo real
export const DEFAULT_SELLERS: string[] = [];

export const DEFAULT_CARRIERS = [
  "Oscar", "Ambetter", "Aetna", "Florida Blue", "Cigna", "UnitedHealthcare", "Molina"
];

export const DEFAULT_STATUSES = [
  "Activo", "Autorizado", "Procesado", "Renovado", "Cotizado", "Nuevo", "Subido / Listo", "Duplicado", "Cancelado", "Robado"
];

export const MIGRATORY_STATUS_OPTIONS = [
  'Ciudadano',
  'Residente',
  'Permiso de Trabajo',
  'Parole Humanitario',
  'TPS',
  'Asilo / Refugio',
  'Visa',
  'En Trámite / Proceso',
  'DACA / Otro'
];

export const SUPPLEMENTAL_COMPANIES_RECOMMENDED = [
  'ManhattanLife',
  'SureBridge',
  'UHC Suplementario',
  'Aflac',
  'National General',
  'Ameritas',
  'Cigna Suplementario',
  'Colonial Life'
];

export const DEFAULT_SUPABASE_URL = "https://kyyddkrqmlohviakcxsg.supabase.co";
export const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eWRka3JxbWxvaHZpYWtjeHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI2ODgyMzUsImV4cCI6MjAzODI2NDIzNX0...";

// Tabla de Pobreza 2027 (FPL Oficial para 48 estados + DC)
export interface FPLRow {
  personas: number;
  fpl100: number;
  fpl138: number;
  fpl150: number;
  fpl200: number;
  fpl250: number;
  fpl300: number;
  fpl400: number;
}

export const FPL_TABLE_2027: FPLRow[] = [
  { personas: 1, fpl100: 15960, fpl138: 22025, fpl150: 23940, fpl200: 31920, fpl250: 39900, fpl300: 47880, fpl400: 63840 },
  { personas: 2, fpl100: 21640, fpl138: 29863, fpl150: 32460, fpl200: 43280, fpl250: 54100, fpl300: 64920, fpl400: 86560 },
  { personas: 3, fpl100: 27320, fpl138: 37702, fpl150: 40980, fpl200: 54640, fpl250: 68300, fpl300: 81960, fpl400: 109280 },
  { personas: 4, fpl100: 33000, fpl138: 45540, fpl150: 49500, fpl200: 66000, fpl250: 82500, fpl300: 99000, fpl400: 132000 },
  { personas: 5, fpl100: 38680, fpl138: 53378, fpl150: 58020, fpl200: 77360, fpl250: 96700, fpl300: 116040, fpl400: 154720 },
  { personas: 6, fpl100: 44360, fpl138: 61217, fpl150: 66540, fpl200: 88720, fpl250: 110900, fpl300: 133080, fpl400: 177440 },
  { personas: 7, fpl100: 50040, fpl138: 69055, fpl150: 75060, fpl200: 100080, fpl250: 125100, fpl300: 150120, fpl400: 200160 },
  { personas: 8, fpl100: 55720, fpl138: 76894, fpl150: 83580, fpl200: 111440, fpl250: 139300, fpl300: 167160, fpl400: 222880 },
];

export const NON_EXPANSION_STATES: Record<string, string> = {
  'AL': 'Alabama',
  'FL': 'Florida',
  'GA': 'Georgia',
  'KS': 'Kansas',
  'MS': 'Mississippi',
  'SC': 'Carolina del Sur (South Carolina)',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'WI': 'Wisconsin',
  'WY': 'Wyoming'
};

export const INITIAL_SAVED_QUOTES: any[] = [
  {
    id: 'quote-demo-1',
    clientName: 'Familia Ramírez',
    location: 'Florida (33166)',
    members: '3 Personas',
    year: '2027',
    agentName: 'Equipo Agente Contigo',
    plans: [
      {
        id: 'plan_demo_1',
        tag: 'OPCIÓN PRINCIPAL RECOMENDADA',
        company: 'UnitedHealthcare',
        planName: 'Silver Value Copay',
        tier: 'Plata CSR',
        premium: '0.00',
        deductible: '$0',
        moop: '$1,500',
        primaryCare: '$0',
        specialist: '$15',
        genericRx: '$3',
        urgencies: '$30',
        extraBenefit: 'Incluye chequeos anuales al 100% y beneficios de telemedicina gratuita',
        clientSummary: 'No pagas nada al mes ($0) y tus consultas médicas y preventivas son completamente gratis.',
        isRecommended: true
      },
      {
        id: 'plan_demo_2',
        tag: 'PLAN COMPLEMENTARIO DENTAL & VISIÓN',
        company: 'ManhattanLife',
        planName: 'Dental, Vision & Hearing',
        tier: 'Complementario',
        premium: '38.50',
        deductible: '$100',
        moop: '$1,000 / año',
        primaryCare: '100% Preventivo',
        specialist: '80% Básico',
        genericRx: 'N/A',
        urgencies: 'N/A',
        extraBenefit: 'Limpiezas gratis cada 6 meses y cobertura de monturas de lentes',
        clientSummary: 'Protege tu sonrisa y vista con cobertura de limpiezas y lentes incluidos.',
        isRecommended: false
      }
    ],
    totalMonthlyPremium: 38.50,
    createdAt: new Date().toLocaleDateString()
  }
];

export function loadQuotes(): any[] {
  try {
    const raw = localStorage.getItem('agente_quotes_saved');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error loading quotes from localStorage:", e);
  }
  return INITIAL_SAVED_QUOTES;
}

export function saveQuotes(quotes: any[]) {
  try {
    localStorage.setItem('agente_quotes_saved', JSON.stringify(quotes));
  } catch (e) {
    console.error("Error saving quotes:", e);
  }
}

export function getGeminiApiKey(): string {
  return localStorage.getItem('agente_contigo_api_key') || '';
}

export function setGeminiApiKey(key: string) {
  localStorage.setItem('agente_contigo_api_key', key);
}

export function getTodayDateString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function getCurrentFormattedDateAndYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = String(now.getFullYear());
  return { dateUS: `${month}/${day}/${year}`, year: year };
}

/**
 * Normaliza cualquier formato de fecha a formato estándar de EE.UU.: MM/DD/YYYY (Mes/Día/Año)
 * Maneja inteligentemente:
 * - Fechas escritas en formato Día/Mes/Año (ej: 25/08/1990 o 14/05/1985 -> 08/25/1990, 05/14/1985)
 * - Fechas ISO YYYY-MM-DD o YYYY/MM/DD (ej: 1985-05-14 -> 05/14/1985)
 * - Separadores variados: /, -, ., espacios
 * - Años de 2 dígitos (ej: 85 -> 1985)
 * - Nombres de meses en español o inglés ("14 de mayo 1985")
 */
export function formatToUSDate(dateStr?: string, preferDayFirst = false): string {
  if (!dateStr) return '';
  let str = String(dateStr).trim();
  if (!str) return '';

  // Quitar comillas si vienen de CSV o texto copiado
  str = str.replace(/^["']|["']$/g, '').trim();

  // Caso 1: ISO YYYY-MM-DD o YYYY/MM/DD o YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${m}/${d}/${y}`;
  }

  // Caso 2: Separado por / o - o . o espacio (ej: 25/08/1990 o 08/25/1990 o 14-05-1985 o 5/14/84)
  const sepMatch = str.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})$/);
  if (sepMatch) {
    const p1 = parseInt(sepMatch[1], 10);
    const p2 = parseInt(sepMatch[2], 10);
    const rawYear = parseInt(sepMatch[3], 10);

    // Año de 2 dígitos a 4 dígitos
    let y = String(rawYear);
    if (rawYear < 100) {
      const currentYearTwoDigits = new Date().getFullYear() % 100;
      y = String(rawYear <= (currentYearTwoDigits + 1) ? 2000 + rawYear : 1900 + rawYear);
    }

    let month = p1;
    let day = p2;

    // Inteligencia de formato:
    // Si la primera parte es > 12 y la segunda es <= 12: Es 100% Día/Mes/Año (ej: 25/08/1990 o 14/05/1985)
    if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2;
    }
    // Si la segunda parte es > 12 y la primera es <= 12: Es 100% Mes/Día/Año (ej: 08/25/1990)
    else if (p2 > 12 && p1 <= 12) {
      month = p1;
      day = p2;
    }
    // Si ambos son <= 12 (ej: 05/08/1990):
    else if (preferDayFirst) {
      day = p1;
      month = p2;
    } else {
      // Por defecto en CRM estadounidense: Mes/Día/Año
      month = p1;
      day = p2;
    }

    // Validar límites razonables
    if (month < 1) month = 1;
    if (month > 12) month = 12;
    if (day < 1) day = 1;
    if (day > 31) day = 31;

    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${mStr}/${dStr}/${y}`;
  }

  // Caso 3: Parse textual (ej. "14 mayo 1985", "14 de mayo de 1985", "May 14 1985")
  const spanishMonths: Record<string, string> = {
    enero: '01', ene: '01', jan: '01', january: '01',
    febrero: '02', feb: '02', february: '02',
    marzo: '03', mar: '03', march: '03',
    abril: '04', abr: '04', apr: '04', april: '04',
    mayo: '05', may: '05',
    junio: '06', jun: '06', june: '06',
    julio: '07', jul: '07', july: '07',
    agosto: '08', ago: '08', aug: '08', august: '08',
    septiembre: '09', sep: '09', set: '09', september: '09',
    octubre: '10', oct: '10', october: '10',
    noviembre: '11', nov: '11', november: '11',
    diciembre: '12', dic: '12', dec: '12', december: '12'
  };

  const textMatch = str.match(/(\d{1,2})\s*(?:de)?\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)\s*(?:de|,)?\s*(\d{2,4})/i);
  if (textMatch) {
    const dNum = parseInt(textMatch[1], 10);
    const mWord = textMatch[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const yNum = parseInt(textMatch[3], 10);
    const monthNum = spanishMonths[mWord];
    if (monthNum && dNum >= 1 && dNum <= 31) {
      const yStr = yNum < 100 ? String(1900 + yNum) : String(yNum);
      return `${monthNum}/${String(dNum).padStart(2, '0')}/${yStr}`;
    }
  }

  // Caso 4: Objeto Date nativo
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y >= 1900 && y <= 2100) {
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${m}/${d}/${y}`;
    }
  }

  return str;
}

/**
 * Convierte cualquier fecha a formato legible en español (ej: "14 de Mayo de 1985")
 */
export function formatDateToHumanSpanish(dateStr?: string): string {
  if (!dateStr) return '';
  const us = formatToUSDate(dateStr);
  const match = us.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return dateStr;
  const m = parseInt(match[1], 10);
  const d = parseInt(match[2], 10);
  const y = match[3];
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const mName = monthNames[m - 1] || '';
  return `${d} de ${mName} de ${y}`;
}

/**
 * Convierte cualquier fecha a formato ISO YYYY-MM-DD (para inputs tipo date de HTML5 o Supabase)
 */
export function formatToISODate(dateStr?: string): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';

  // Ya es YYYY-MM-DD válido
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return str;

  // Normalizar primero a formato US y convertir
  const us = formatToUSDate(str);
  const match = us.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[1]}-${match[2]}`;
  }

  return '';
}

/**
 * Calcula la edad de una persona dada su fecha de nacimiento en cualquier formato
 */
export function calculateAgeFromDBO(dboStr?: string): number {
  if (!dboStr) return 0;
  const iso = formatToISODate(dboStr);
  if (!iso) return 0;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const birthDate = new Date(y, m - 1, d);
  if (isNaN(birthDate.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'ag-luis',
    nombre: 'Luis Fernando',
    apellido: '',
    npn: '20891432',
    licencias: 'Todas las aseguradoras - Agente Principal NPN',
    compania: 'Agente Contigo',
    notas: 'Agente Oficial asignado automáticamente a ventas de vendedores'
  },
  {
    id: 'ag-nairy',
    nombre: 'Nairy',
    apellido: 'Pérez',
    npn: '19827364',
    licencias: 'GA, FL, TX - Vida & Salud',
    compania: 'Agente General',
    notas: 'Agente General Administración'
  },
  {
    id: 'ag-1',
    nombre: 'Virginia',
    apellido: 'García',
    npn: '19827364',
    licencias: 'GA, FL - Vida & Salud (2-15)',
    compania: 'Oscar / Ambetter',
    notas: 'Agente Principal Call Center'
  },
  {
    id: 'ag-2',
    nombre: 'Junior',
    apellido: 'Pérez',
    npn: '20194827',
    licencias: 'GA, TX - Salud & Marketplace',
    compania: 'Florida Blue / Aetna',
    notas: 'Agente Senior Salud'
  }
];

export const INITIAL_CLIENTS: ClientPolicy[] = [
  {
    id: "client-1",
    vendedor: "Virginia",
    agente: "Virginia García",
    numPoliza: "POL-00129",
    nombre: "Verónica Pérez",
    estatus: "Activo",
    carrier: "Oscar",
    nombrePlan: "Silver Standard Care",
    peso: "145 lbs",
    altura: "5'6\"",
    bancoNombre: "Chase Bank",
    bancoTipoCuenta: "Corriente (Checking)",
    bancoTitular: "Verónica Pérez",
    bancoRouting: "021000021",
    bancoCuenta: "8492019382",
    cuestionarioSalud: {
      tabaco: "no", otras: "no", rechazos: "no", embarazo: "no",
      hosp: "no", cancer: "no", sintomas: "no", cardio: "no"
    },
    mesIngreso: "Enero",
    docStatus: "Subir Documentos",
    ingresoFecha: "01/15/2026",
    ingresoMonto: 2400.00,
    primaMonto: 120.00,
    estadoUSA: "GA",
    telefono: "(404) 940-0466",
    email: "veronica.perez@gmail.com",
    ssn: "672-05-1864",
    dbo: "05/14/1984",
    edad: 41,
    metodoPago: "Tarjeta de Crédito",
    direccion: "263 Summit Ridge Dr, Lawrenceville, GA 30046",
    numDependientes: 2,
    datosDependientes: "Hijo: Carlos Pérez DBO 04/10/2012, Esposo: Luis Pérez",
    pagoRealizado: "TRUE",
    notas: "Cliente preferencial, pago domiciliado automático.",
    createdDate: "01/10/2026",
    createdYear: "2026",
    commissions: {
      "2026": {
        "Enero": { paid: true, amount: 45.00, paidDate: "01/15/2026", notes: "Comisión inicial cobrada" },
        "Febrero": { paid: true, amount: 30.00, paidDate: "02/15/2026", notes: "Comisión mensual" },
        "Marzo": { paid: true, amount: 30.00, paidDate: "03/15/2026", notes: "Comisión mensual" }
      }
    }
  },
  {
    id: "client-2",
    vendedor: "Junior",
    agente: "Junior Pérez",
    numPoliza: "POL-00248",
    nombre: "Manuel Alejandro Gómez",
    estatus: "Activo",
    carrier: "Florida Blue",
    nombrePlan: "BlueCare Bronze 104",
    peso: "180 lbs",
    altura: "5'10\"",
    bancoNombre: "Bank of America",
    bancoTipoCuenta: "Corriente (Checking)",
    bancoTitular: "Manuel Gómez",
    bancoRouting: "063000047",
    bancoCuenta: "4820194821",
    cuestionarioSalud: {
      tabaco: "no", otras: "no", rechazos: "no", embarazo: "no",
      hosp: "no", cancer: "no", sintomas: "no", cardio: "no"
    },
    mesIngreso: "Febrero",
    docStatus: "Documento Completos",
    ingresoFecha: "02/02/2026",
    ingresoMonto: 3100.00,
    primaMonto: 165.00,
    estadoUSA: "FL",
    telefono: "(305) 882-9912",
    email: "manuel.gomez@yahoo.com",
    ssn: "542-88-2940",
    dbo: "11/20/1988",
    edad: 37,
    metodoPago: "Cuenta Bancaria (ACH)",
    direccion: "742 Evergreen Terr, Miami, FL 33101",
    numDependientes: 1,
    pagoRealizado: "TRUE",
    notas: "Excelente historial, renovado desde 2025.",
    createdDate: "02/01/2026",
    createdYear: "2026",
    commissions: {
      "2026": {
        "Febrero": { paid: true, amount: 40.00, paidDate: "02/10/2026", notes: "Primer cobro" }
      }
    }
  },
  {
    id: "client-3",
    vendedor: "Virginia",
    agente: "Luis Fernando",
    numPoliza: "POL-00391",
    nombre: "Adriana Lucía Morales",
    estatus: "Nuevo",
    carrier: "Ambetter",
    nombrePlan: "Ambetter Balanced Care 11",
    peso: "135 lbs",
    altura: "5'4\"",
    bancoNombre: "Wells Fargo",
    bancoTipoCuenta: "Ahorros (Savings)",
    bancoTitular: "Adriana Morales",
    bancoRouting: "121000248",
    bancoCuenta: "9382018471",
    cuestionarioSalud: {
      tabaco: "no", otras: "no", rechazos: "no", embarazo: "no",
      hosp: "no", cancer: "no", sintomas: "no", cardio: "no"
    },
    mesIngreso: "Marzo",
    docStatus: "Subir Documentos",
    ingresoFecha: "03/05/2026",
    ingresoMonto: 2600.00,
    primaMonto: 90.00,
    estadoUSA: "TX",
    telefono: "(713) 441-2098",
    email: "adriana.morales@hotmail.com",
    ssn: "468-12-9014",
    dbo: "08/12/1993",
    edad: 32,
    metodoPago: "Tarjeta de Débito",
    direccion: "1104 Cypress Creek, Houston, TX 77002",
    numDependientes: 0,
    pagoRealizado: "FALSE",
    notas: "Pendiente confirmación de pago por primera mensualidad.",
    createdDate: "03/05/2026",
    createdYear: "2026",
    commissions: {}
  }
];

export const INITIAL_TASKS: DailyTask[] = [
  {
    id: 'task-1',
    titulo: 'Solicitar comprobante de ingresos a Adriana Morales',
    descripcion: 'Llamar a la cliente para solicitar su W-2 o talón de cheque reciente para Marketplace.',
    fechaVencimiento: getTodayDateString(),
    prioridad: 'alta',
    categoria: 'documentos',
    estado: 'pendiente',
    clienteRelacionado: 'Adriana Lucía Morales',
    asignadoA: 'Virginia',
    creadaEn: getTodayDateString()
  },
  {
    id: 'task-2',
    titulo: 'Seguimiento de pago primera mensualidad - Ambetter',
    descripcion: 'Verificar si ya impactó el débito en la tarjeta de débito para activar vigencia.',
    fechaVencimiento: getTodayDateString(),
    prioridad: 'alta',
    categoria: 'pago',
    estado: 'en_progreso',
    clienteRelacionado: 'Adriana Lucía Morales',
    asignadoA: 'Virginia',
    creadaEn: getTodayDateString()
  },
  {
    id: 'task-3',
    titulo: 'Llamada de bienvenida a Verónica Pérez',
    descripcion: 'Confirmar recepción de tarjeta de asegurado Oscar y explicar cómo descargar la app de telemedicina.',
    fechaVencimiento: getTodayDateString(),
    prioridad: 'media',
    categoria: 'llamada',
    estado: 'completada',
    clienteRelacionado: 'Verónica Pérez',
    asignadoA: 'Virginia',
    creadaEn: getTodayDateString()
  },
  {
    id: 'task-4',
    titulo: 'Revisión mensual de comisiones y reporte de liquidación',
    descripcion: 'Cruzar el reporte de Oscar y Florida Blue con las pólizas activas en el sistema.',
    fechaVencimiento: getTodayDateString(),
    prioridad: 'alta',
    categoria: 'general',
    estado: 'pendiente',
    asignadoA: 'Administrador',
    creadaEn: getTodayDateString()
  }
];

// Formatea nombres largos para mostrar limpiamente Nombre y Apellido principal
export function formatShortName(rawName?: string): string {
  if (!rawName) return '';
  const name = rawName.trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;

  // Si tiene 3 nombres (ej: Juan Carlos Pérez) -> Juan Pérez
  if (parts.length === 3) {
    return `${parts[0]} ${parts[2]}`;
  }
  // Si tiene 4 nombres (ej: María Elena Gómez Fernández) -> María Gómez
  return `${parts[0]} ${parts[2] || parts[1]}`;
}

// Estilos y colores distintivos por Compañía de Seguros
export interface CarrierColorStyle {
  bg: string;
  text: string;
  border: string;
  badgeClass: string;
  dotColor: string;
}

export const CARRIER_COLOR_PRESETS: CarrierColorPreset[] = [
  { key: 'emerald', name: 'Verde Esmeralda', dotColor: 'bg-emerald-600', dotBg: '#059669', badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-400 shadow-2xs font-black', bg: 'bg-emerald-100', text: 'text-emerald-950', border: 'border-emerald-400' },
  { key: 'cyan', name: 'Cyan / Turquesa', dotColor: 'bg-cyan-600', dotBg: '#0891b2', badgeClass: 'bg-cyan-100 text-cyan-950 border-cyan-400 shadow-2xs font-black', bg: 'bg-cyan-100', text: 'text-cyan-950', border: 'border-cyan-400' },
  { key: 'blue', name: 'Azul Real', dotColor: 'bg-blue-600', dotBg: '#2563eb', badgeClass: 'bg-blue-100 text-blue-950 border-blue-400 shadow-2xs font-black', bg: 'bg-blue-100', text: 'text-blue-950', border: 'border-blue-400' },
  { key: 'purple', name: 'Púrpura / Morado', dotColor: 'bg-purple-600', dotBg: '#9333ea', badgeClass: 'bg-purple-100 text-purple-950 border-purple-400 shadow-2xs font-black', bg: 'bg-purple-100', text: 'text-purple-950', border: 'border-purple-400' },
  { key: 'rose', name: 'Rosa / Carmín', dotColor: 'bg-rose-600', dotBg: '#e11d48', badgeClass: 'bg-rose-100 text-rose-950 border-rose-400 shadow-2xs font-black', bg: 'bg-rose-100', text: 'text-rose-950', border: 'border-rose-400' },
  { key: 'amber', name: 'Ámbar / Dorado', dotColor: 'bg-amber-600', dotBg: '#d97706', badgeClass: 'bg-amber-100 text-amber-950 border-amber-400 shadow-2xs font-black', bg: 'bg-amber-100', text: 'text-amber-950', border: 'border-amber-400' },
  { key: 'indigo', name: 'Índigo / Violeta', dotColor: 'bg-indigo-600', dotBg: '#4f46e5', badgeClass: 'bg-indigo-100 text-indigo-950 border-indigo-400 shadow-2xs font-black', bg: 'bg-indigo-100', text: 'text-indigo-950', border: 'border-indigo-400' },
  { key: 'teal', name: 'Teal / Verde Marino', dotColor: 'bg-teal-600', dotBg: '#0d9488', badgeClass: 'bg-teal-100 text-teal-950 border-teal-400 shadow-2xs font-black', bg: 'bg-teal-100', text: 'text-teal-950', border: 'border-teal-400' },
  { key: 'lime', name: 'Verde Lima', dotColor: 'bg-lime-600', dotBg: '#65a30d', badgeClass: 'bg-lime-100 text-lime-950 border-lime-400 shadow-2xs font-black', bg: 'bg-lime-100', text: 'text-lime-950', border: 'border-lime-400' },
  { key: 'orange', name: 'Naranja Brillante', dotColor: 'bg-orange-600', dotBg: '#ea580c', badgeClass: 'bg-orange-100 text-orange-950 border-orange-400 shadow-2xs font-black', bg: 'bg-orange-100', text: 'text-orange-950', border: 'border-orange-400' },
  { key: 'fuchsia', name: 'Fucsia / Magenta', dotColor: 'bg-fuchsia-600', dotBg: '#c026d3', badgeClass: 'bg-fuchsia-100 text-fuchsia-950 border-fuchsia-400 shadow-2xs font-black', bg: 'bg-fuchsia-100', text: 'text-fuchsia-950', border: 'border-fuchsia-400' },
  { key: 'sky', name: 'Azul Cielo', dotColor: 'bg-sky-600', dotBg: '#0284c7', badgeClass: 'bg-sky-100 text-sky-950 border-sky-400 shadow-2xs font-black', bg: 'bg-sky-100', text: 'text-sky-950', border: 'border-sky-400' },
  { key: 'red', name: 'Rojo Carmesí', dotColor: 'bg-red-600', dotBg: '#dc2626', badgeClass: 'bg-red-100 text-red-950 border-red-400 shadow-2xs font-black', bg: 'bg-red-100', text: 'text-red-950', border: 'border-red-400' },
  { key: 'slate', name: 'Gris Pizarra / Neutro', dotColor: 'bg-slate-600', dotBg: '#475569', badgeClass: 'bg-slate-100 text-slate-900 border-slate-400 shadow-2xs font-black', bg: 'bg-slate-100', text: 'text-slate-900', border: 'border-slate-400' }
];

export const DEFAULT_CARRIER_CONFIGS: CarrierConfig[] = [
  { id: 'car-oscar', name: 'Oscar', colorKey: 'cyan' },
  { id: 'car-ambetter', name: 'Ambetter', colorKey: 'emerald' },
  { id: 'car-aetna', name: 'Aetna', colorKey: 'rose' },
  { id: 'car-flblue', name: 'Florida Blue', colorKey: 'blue' },
  { id: 'car-cigna', name: 'Cigna', colorKey: 'amber' },
  { id: 'car-uhc', name: 'UnitedHealthcare', colorKey: 'indigo' },
  { id: 'car-molina', name: 'Molina', colorKey: 'purple' },
  { id: 'car-kaiser', name: 'Kaiser', colorKey: 'teal' },
  { id: 'car-humana', name: 'Humana', colorKey: 'lime' }
];

export function getCarrierColorPreset(colorKey?: string): CarrierColorPreset {
  if (!colorKey) return CARRIER_COLOR_PRESETS[0];
  const found = CARRIER_COLOR_PRESETS.find(p => p.key === colorKey);
  return found || CARRIER_COLOR_PRESETS[0];
}

// Carga las compañías y sus colores configurados
export function loadCarrierConfigs(): CarrierConfig[] {
  try {
    const raw = localStorage.getItem('polizas_carrier_configs');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error loading carrier configs from localStorage:', e);
  }

  // Si existen custom carriers como strings en polizas_custom_carriers, migrarlos
  try {
    const oldRaw = localStorage.getItem('polizas_custom_carriers');
    if (oldRaw) {
      const oldList = JSON.parse(oldRaw);
      if (Array.isArray(oldList) && oldList.length > 0) {
        const migrated: CarrierConfig[] = oldList.map((name: string, idx: number) => {
          const lower = name.toLowerCase();
          let colorKey = CARRIER_COLOR_PRESETS[idx % CARRIER_COLOR_PRESETS.length].key;
          if (lower.includes('ambetter')) colorKey = 'emerald';
          else if (lower.includes('oscar')) colorKey = 'cyan';
          else if (lower.includes('blue') || lower.includes('bcbs')) colorKey = 'blue';
          else if (lower.includes('molina')) colorKey = 'purple';
          else if (lower.includes('aetna') || lower.includes('cvs')) colorKey = 'rose';
          else if (lower.includes('cigna')) colorKey = 'amber';
          else if (lower.includes('united') || lower.includes('uhc')) colorKey = 'indigo';
          else if (lower.includes('kaiser')) colorKey = 'teal';
          else if (lower.includes('humana')) colorKey = 'lime';
          else if (lower.includes('imperial') || lower.includes('care')) colorKey = 'orange';

          return {
            id: 'car-' + idx + '-' + name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            name,
            colorKey
          };
        });
        saveCarrierConfigs(migrated);
        return migrated;
      }
    }
  } catch (e) {}

  saveCarrierConfigs(DEFAULT_CARRIER_CONFIGS);
  return DEFAULT_CARRIER_CONFIGS;
}

// Guarda la lista de compañías y sus colores
export function saveCarrierConfigs(configs: CarrierConfig[]): void {
  try {
    localStorage.setItem('polizas_carrier_configs', JSON.stringify(configs));
    // Sincronizar también con la clave tradicional polizas_custom_carriers para compatibilidad
    localStorage.setItem('polizas_custom_carriers', JSON.stringify(configs.map(c => c.name)));
  } catch (e) {
    console.error('Error saving carrier configs:', e);
  }
}

// Determina el color clave sugerido para un nombre de aseguradora
function suggestColorKeyForCarrier(carrierName: string, usedKeys: Set<string>): string {
  const c = carrierName.toLowerCase().trim();
  if (c.includes('ambetter')) return 'emerald';
  if (c.includes('oscar')) return 'cyan';
  if (c.includes('florida blue') || c.includes('blue cross') || c.includes('bcbs') || c === 'blue') return 'blue';
  if (c.includes('molina')) return 'purple';
  if (c.includes('aetna') || c.includes('cvs')) return 'rose';
  if (c.includes('cigna')) return 'amber';
  if (c.includes('united') || c.includes('uhc') || c.includes('golden rule')) return 'indigo';
  if (c.includes('kaiser')) return 'teal';
  if (c.includes('humana')) return 'lime';
  if (c.includes('imperial') || c.includes('care')) return 'orange';
  if (c.includes('manhattan')) return 'fuchsia';
  if (c.includes('anthem')) return 'sky';
  if (c.includes('wellcare') || c.includes('centene')) return 'emerald';

  // Buscar un color que aún no esté saturado, o asignar determinísticamente
  for (const preset of CARRIER_COLOR_PRESETS) {
    if (!usedKeys.has(preset.key)) {
      return preset.key;
    }
  }
  let hash = 0;
  for (let i = 0; i < c.length; i++) {
    hash = (hash << 5) - hash + c.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CARRIER_COLOR_PRESETS.length;
  return CARRIER_COLOR_PRESETS[index].key;
}

// Auto-registra una compañía si no existe (ej. al escribirla en la planilla de cliente)
export function autoRegisterSingleCarrier(
  carrierName?: string,
  currentConfigs?: CarrierConfig[]
): { configs: CarrierConfig[]; newAdded: boolean; config: CarrierConfig | null } {
  if (!carrierName || !carrierName.trim()) {
    const list = currentConfigs || loadCarrierConfigs();
    return { configs: list, newAdded: false, config: null };
  }
  const cleanName = carrierName.trim();
  const list = [...(currentConfigs || loadCarrierConfigs())];
  const existing = list.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    return { configs: list, newAdded: false, config: existing };
  }

  const usedKeys = new Set(list.map(c => c.colorKey));
  const colorKey = suggestColorKeyForCarrier(cleanName, usedKeys);
  const newConfig: CarrierConfig = {
    id: 'car-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    name: cleanName,
    colorKey
  };
  const updated = [...list, newConfig];
  saveCarrierConfigs(updated);
  return { configs: updated, newAdded: true, config: newConfig };
}

// Auto-registra automáticamente todas las compañías presentes en las pólizas
export function autoRegisterCarriersFromClients(
  clientsList: Partial<ClientPolicy>[],
  currentConfigs?: CarrierConfig[]
): { configs: CarrierConfig[]; newAddedCount: number } {
  let list = [...(currentConfigs || loadCarrierConfigs())];
  let addedCount = 0;
  const usedKeys = new Set(list.map(c => c.colorKey));

  clientsList.forEach(c => {
    if (!c.carrier || !c.carrier.trim()) return;
    const cleanName = c.carrier.trim();
    const alreadyExists = list.some(item => item.name.toLowerCase() === cleanName.toLowerCase());
    if (!alreadyExists) {
      const colorKey = suggestColorKeyForCarrier(cleanName, usedKeys);
      usedKeys.add(colorKey);
      const newConfig: CarrierConfig = {
        id: 'car-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        colorKey
      };
      list.push(newConfig);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    saveCarrierConfigs(list);
  }
  return { configs: list, newAddedCount: addedCount };
}

// Devuelve el estilo y color de la compañía, respetando la configuración personalizada
export function getCarrierColorStyle(carrierName?: string, customConfigs?: CarrierConfig[]): CarrierColorStyle {
  if (!carrierName || !carrierName.trim()) {
    return {
      bg: 'bg-slate-100',
      text: 'text-slate-800',
      border: 'border-slate-300',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 shadow-2xs font-extrabold',
      dotColor: 'bg-slate-500'
    };
  }
  const cleanName = carrierName.trim();
  const c = cleanName.toLowerCase();

  // 1. Revisar si la compañía tiene color personalizado en la configuración
  const configs = customConfigs || loadCarrierConfigs();
  const custom = configs.find(cfg => cfg.name.toLowerCase() === c);
  if (custom && custom.colorKey) {
    const preset = getCarrierColorPreset(custom.colorKey);
    return {
      bg: preset.bg,
      text: preset.text,
      border: preset.border,
      badgeClass: preset.badgeClass,
      dotColor: preset.dotColor
    };
  }

  // 2. Si aún no está en configuración, aplicar reconocimiento por palabras clave
  if (c.includes('ambetter')) {
    const p = getCarrierColorPreset('emerald');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('oscar')) {
    const p = getCarrierColorPreset('cyan');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('florida blue') || c.includes('blue cross') || c.includes('bcbs') || c === 'blue') {
    const p = getCarrierColorPreset('blue');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('molina')) {
    const p = getCarrierColorPreset('purple');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('aetna') || c.includes('cvs')) {
    const p = getCarrierColorPreset('rose');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('cigna')) {
    const p = getCarrierColorPreset('amber');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('united') || c.includes('uhc') || c.includes('golden rule')) {
    const p = getCarrierColorPreset('indigo');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('kaiser')) {
    const p = getCarrierColorPreset('teal');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('humana')) {
    const p = getCarrierColorPreset('lime');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('imperial') || c.includes('care')) {
    const p = getCarrierColorPreset('orange');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('manhattan') || c.includes('manhattanlife')) {
    const p = getCarrierColorPreset('fuchsia');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }
  if (c.includes('anthem')) {
    const p = getCarrierColorPreset('sky');
    return { bg: p.bg, text: p.text, border: p.border, badgeClass: p.badgeClass, dotColor: p.dotColor };
  }

  // 3. Fallback determinístico
  let hash = 0;
  for (let i = 0; i < c.length; i++) {
    hash = (hash << 5) - hash + c.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CARRIER_COLOR_PRESETS.length;
  const chosen = CARRIER_COLOR_PRESETS[index];
  return {
    bg: chosen.bg,
    text: chosen.text,
    border: chosen.border,
    badgeClass: chosen.badgeClass,
    dotColor: chosen.dotColor
  };
}

// Estilos de Estatus de Póliza flexibles y visualmente inmediatos
export interface PolicyStatusStyle {
  label: string;
  badgeClass: string;
  dotColor: string;
  rowBorder: string;
  rowBg: string;
}

export function getPolicyStatusStyle(rawStatus?: string): PolicyStatusStyle {
  const statusStr = String(rawStatus || 'Activo').trim();
  const lower = statusStr.toLowerCase();

  // Si tiene estatus migratorio por error en Excel, se visualiza como Activo
  const isMigratory = (
    lower.includes('ciudadan') ||
    lower.includes('resident') ||
    lower.includes('permiso') ||
    lower.includes('parole') ||
    lower.includes('daca') ||
    lower.includes('visa') ||
    lower.includes('asilo') ||
    lower.includes('tps') ||
    lower.includes('indocument') ||
    lower.includes('green card') ||
    lower.includes('work permit')
  );

  if (isMigratory || lower === 'activo' || lower === 'activos' || lower === 'active') {
    return {
      label: 'Activo',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      dotColor: 'bg-emerald-500',
      rowBorder: 'border-l-3 border-l-emerald-500',
      rowBg: 'hover:bg-slate-50/80'
    };
  }

  if (lower.includes('autoriz')) {
    return {
      label: 'Autorizado',
      badgeClass: 'bg-cyan-100 text-cyan-950 border-cyan-400 font-black',
      dotColor: 'bg-cyan-600',
      rowBorder: 'border-l-3 border-l-cyan-600',
      rowBg: 'bg-cyan-50/20 hover:bg-cyan-50/50'
    };
  }

  if (lower.includes('cancel')) {
    return {
      label: 'Cancelado',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      dotColor: 'bg-rose-500',
      rowBorder: 'border-l-3 border-l-rose-500',
      rowBg: 'bg-rose-50/30 hover:bg-rose-50/60'
    };
  }

  if (lower.includes('rob')) {
    return {
      label: 'Robado',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
      dotColor: 'bg-purple-500',
      rowBorder: 'border-l-3 border-l-purple-500',
      rowBg: 'bg-purple-50/30 hover:bg-purple-50/60'
    };
  }

  if (lower.includes('cotiz')) {
    return {
      label: 'Cotizado',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      dotColor: 'bg-amber-500',
      rowBorder: 'border-l-3 border-l-amber-500',
      rowBg: 'bg-amber-50/30 hover:bg-amber-50/60'
    };
  }

  if (lower === 'nuevo' || lower.includes('nuevo')) {
    return {
      label: 'Nuevo',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      dotColor: 'bg-blue-500',
      rowBorder: 'border-l-3 border-l-blue-500',
      rowBg: 'bg-blue-50/20 hover:bg-blue-50/50'
    };
  }

  if (lower.includes('duplicad') || lower.includes('pendiente')) {
    return {
      label: 'Duplicado',
      badgeClass: 'bg-orange-100 text-orange-950 border-orange-400 font-black',
      dotColor: 'bg-orange-600',
      rowBorder: 'border-l-3 border-l-orange-500',
      rowBg: 'bg-orange-50/20 hover:bg-orange-50/50'
    };
  }

  if (lower.includes('renovad') || lower.includes('renovacion')) {
    return {
      label: 'Renovado',
      badgeClass: 'bg-teal-100 text-teal-950 border-teal-400 font-black',
      dotColor: 'bg-teal-600',
      rowBorder: 'border-l-3 border-l-teal-500',
      rowBg: 'bg-teal-50/20 hover:bg-teal-50/50'
    };
  }

  if (lower.includes('subido') || lower.includes('listo')) {
    return {
      label: 'Subido / Listo',
      badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold',
      dotColor: 'bg-emerald-600',
      rowBorder: 'border-l-3 border-l-emerald-500',
      rowBg: 'hover:bg-slate-50/80'
    };
  }

  if (lower.includes('procesad') || lower.includes('proceso') || lower.includes('tramite')) {
    return {
      label: 'Procesado',
      badgeClass: 'bg-indigo-100 text-indigo-950 border-indigo-400 font-black',
      dotColor: 'bg-indigo-600',
      rowBorder: 'border-l-3 border-l-indigo-500',
      rowBg: 'bg-indigo-50/20 hover:bg-indigo-50/50'
    };
  }

  return {
    label: statusStr,
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    dotColor: 'bg-slate-500',
    rowBorder: 'border-l-3 border-l-slate-400',
    rowBg: 'hover:bg-slate-50/80'
  };
}

// Cálculo automático de miembros activos (titular activo + dependientes que aplican)
export function calculateActiveMembers(client: Partial<ClientPolicy>): number {
  const statusStr = String(client.estatus || 'Activo').trim().toLowerCase();
  // El titular cuenta si el expediente está activo (no cancelado, robado, inactivo ni no vigente)
  const isTitularActive = !statusStr.includes('cancel') && !statusStr.includes('rob') && !statusStr.includes('inactiv') && !statusStr.includes('no vigent');
  const titularCount = isTitularActive ? 1 : 0;

  // 1. Si cuenta con lista estructurada de dependientes
  if (Array.isArray(client.dependientesList) && client.dependientesList.length > 0) {
    const activeDeps = client.dependientesList.filter(d => d.aplica !== false).length;
    return titularCount + activeDeps;
  }

  // 2. Si cuenta con JSON en datosDependientes
  if (client.datosDependientes && typeof client.datosDependientes === 'string') {
    try {
      const parsed = JSON.parse(client.datosDependientes);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const activeDeps = parsed.filter((d: any) => d.aplica !== false).length;
        return titularCount + activeDeps;
      }
    } catch (_) {}
  }

  // 3. Fallback con numDependientes
  const numDeps = typeof client.numDependientes === 'number' && !isNaN(client.numDependientes) ? client.numDependientes : 0;
  return isTitularActive ? Math.max(1, 1 + numDeps) : numDeps;
}

// Limpieza y normalización de estatus de clientes
// Remueve cualquier estatus migratorio (Ciudadanos, Residentes, Permisos, etc.)
// de la columna de estatus y los marca como 'Activo' sin tocar estatus legítimos como Cotizado, Cancelado, etc.
export function sanitizeClients(clients: ClientPolicy[]): ClientPolicy[] {
  if (!Array.isArray(clients)) return [];
  return clients.map(client => {
    let estatus = String(client.estatus || 'Activo').trim();
    let estatusMigratorio = client.estatusMigratorio || '';

    const lower = estatus.toLowerCase();
    const isMigratory = (
      lower.includes('ciudadan') ||
      lower.includes('resident') ||
      lower.includes('permiso') ||
      lower.includes('parole') ||
      lower.includes('daca') ||
      lower.includes('visa') ||
      lower.includes('asilo') ||
      lower.includes('tps') ||
      lower.includes('indocument') ||
      lower.includes('green card') ||
      lower.includes('work permit')
    );

    if (isMigratory) {
      if (!estatusMigratorio) {
        estatusMigratorio = estatus;
      }
      estatus = 'Activo';
    } else if (lower === 'activos' || lower === 'active') {
      estatus = 'Activo';
    } else if (lower === 'cancelada' || lower === 'canceladas' || lower === 'cancelados') {
      estatus = 'Cancelado';
    } else if (lower === 'robada' || lower === 'robadas' || lower === 'robados') {
      estatus = 'Robado';
    } else if (lower === 'cotizada' || lower === 'cotizadas' || lower === 'cotizados') {
      estatus = 'Cotizado';
    } else if (lower === 'en proceso' || lower === 'proceso' || lower.includes('en proceso')) {
      estatus = 'Procesado';
    } else if (lower === 'pendiente') {
      estatus = 'Duplicado';
    } else if (lower === 'renovada' || lower === 'renovadas' || lower === 'renovados') {
      estatus = 'Renovado';
    } else if (!estatus || estatus === 'undefined' || estatus === 'null') {
      estatus = 'Activo';
    }

    // Determinar tipo de póliza (obama vs suplementario)
    let tipoPoliza = client.tipoPoliza;
    if (!tipoPoliza) {
      const cLower = String(client.carrier || '').toLowerCase();
      const pLower = String(client.nombrePlan || '').toLowerCase();
      if (
        cLower.includes('manhattan') || cLower.includes('surebridge') ||
        cLower.includes('dental') || cLower.includes('vision') ||
        pLower.includes('suplement') || pLower.includes('dental') || pLower.includes('vision') || pLower.includes('indemn')
      ) {
        tipoPoliza = 'suplementario';
      } else {
        tipoPoliza = 'obama';
      }
    }

    // Poblar dependientesList si datosDependientes tiene JSON
    let dependientesList = client.dependientesList;
    if (!dependientesList && client.datosDependientes) {
      try {
        const parsed = JSON.parse(client.datosDependientes);
        if (Array.isArray(parsed)) {
          dependientesList = parsed;
        }
      } catch (_) {}
    }

    return {
      ...client,
      estatus,
      tipoPoliza,
      companiaSuplementaria: client.companiaSuplementaria || '',
      estatusMigratorio: estatusMigratorio || 'Ciudadano',
      dependientesList
    };
  });
}

// Local Storage Helpers
export function loadClients(): ClientPolicy[] {
  try {
    const raw = localStorage.getItem('polizas_backup_2026');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = sanitizeClients(parsed);
        // Persistir inmediatamente los datos saneados en localStorage
        try {
          localStorage.setItem('polizas_backup_2026', JSON.stringify(cleaned));
        } catch (_) {}
        return cleaned;
      }
    }
  } catch (e) {
    console.error("Error loading clients from localStorage:", e);
  }
  return sanitizeClients(INITIAL_CLIENTS);
}

export function saveClients(clients: ClientPolicy[]) {
  try {
    const cleaned = sanitizeClients(clients);
    localStorage.setItem('polizas_backup_2026', JSON.stringify(cleaned));
  } catch (e) {
    console.error("Error saving clients to localStorage:", e);
  }
}

export const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    titulo: 'Reunión de Zoom: Presentación ACA Familiar',
    descripcion: 'Presentación de cotización de plan Oscar Silver y subsidio con prima reducida.',
    fecha: getTodayDateString(),
    horaInicio: '10:00',
    horaFin: '10:45',
    tipo: 'zoom',
    clienteRelacionado: 'Adriana Lucía Morales',
    linkReunion: 'https://zoom.us/j/8492019382',
    asignadoA: 'Virginia',
    completada: false,
    creadaEn: getTodayDateString()
  },
  {
    id: 'evt-2',
    titulo: 'Llamada de Verificación W-2 y Documentos',
    descripcion: 'Llamar a la cliente para subir talón de cheques al Marketplace.',
    fecha: getTodayDateString(),
    horaInicio: '14:00',
    horaFin: '14:30',
    tipo: 'llamada',
    clienteRelacionado: 'Adriana Lucía Morales',
    linkReunion: 'tel:(713)441-2098',
    asignadoA: 'Virginia',
    completada: false,
    creadaEn: getTodayDateString()
  },
  {
    id: 'evt-3',
    titulo: 'Reunión de Zoom: Estrategia Semanal de Ventas',
    descripcion: 'Revisión de metas de producción, inscripciones abiertas y comisiones.',
    fecha: (() => {
      const d = new Date();
      const day = d.getDay();
      const diff = (5 - day + 7) % 7 || 7;
      const target = new Date(d);
      target.setDate(d.getDate() + diff);
      return target.toISOString().split('T')[0];
    })(),
    horaInicio: '16:00',
    horaFin: '17:00',
    tipo: 'zoom',
    linkReunion: 'https://zoom.us/j/9123847291',
    asignadoA: 'Todos los Vendedores',
    completada: false,
    creadaEn: getTodayDateString()
  },
  {
    id: 'evt-4',
    titulo: 'Cita Presencial: Firma y Entrega de Póliza',
    descripcion: 'Revisión de documentos de cobertura médica Florida Blue y confirmación de copagos.',
    fecha: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      return d.toISOString().split('T')[0];
    })(),
    horaInicio: '11:00',
    horaFin: '12:00',
    tipo: 'cita',
    clienteRelacionado: 'Manuel Alejandro Gómez',
    asignadoA: 'Junior',
    completada: false,
    creadaEn: getTodayDateString()
  }
];

export function loadCalendarEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem('agente_calendar_events');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error loading calendar events:", e);
  }
  return INITIAL_CALENDAR_EVENTS;
}

export function saveCalendarEvents(events: CalendarEvent[]) {
  try {
    localStorage.setItem('agente_calendar_events', JSON.stringify(events));
  } catch (e) {
    console.error("Error saving calendar events:", e);
  }
}

export function loadTasks(): DailyTask[] {
  try {
    const raw = localStorage.getItem('agente_tasks_daily');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Error loading tasks:", e);
  }
  return INITIAL_TASKS;
}

export function saveTasks(tasks: DailyTask[]) {
  try {
    localStorage.setItem('agente_tasks_daily', JSON.stringify(tasks));
  } catch (e) {
    console.error("Error saving tasks:", e);
  }
}

export function loadAgents(): Agent[] {
  try {
    const raw = localStorage.getItem('polizas_agents_list');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error loading agents:", e);
  }
  return INITIAL_AGENTS;
}

export function saveAgents(agents: Agent[]) {
  try {
    localStorage.setItem('polizas_agents_list', JSON.stringify(agents));
  } catch (e) {
    console.error("Error saving agents:", e);
  }
}

export function getAdminPass(): string {
  return localStorage.getItem('app_admin_pass') || "Admin2026";
}

export function getAllSellerPasswords(): Record<string, string> {
  try {
    const raw = localStorage.getItem('app_seller_passwords');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {};
}

export function getSellerPass(sellerName?: string): string {
  const globalPass = localStorage.getItem('app_seller_pass') || "Venta2026";
  if (!sellerName) return globalPass;
  const passwords = getAllSellerPasswords();
  const trimmed = sellerName.trim().toLowerCase();
  for (const [key, val] of Object.entries(passwords)) {
    if (key.trim().toLowerCase() === trimmed && val) {
      return val;
    }
  }
  return globalPass;
}

export function setSellerCustomPass(sellerName: string, newPass: string) {
  const cleanName = sellerName.trim();
  if (!cleanName) return;
  const passwords = getAllSellerPasswords();
  passwords[cleanName] = newPass.trim();
  localStorage.setItem('app_seller_passwords', JSON.stringify(passwords));
}

export function removeSellerCustomPass(sellerName: string) {
  const cleanName = sellerName.trim();
  const passwords = getAllSellerPasswords();
  delete passwords[cleanName];
  localStorage.setItem('app_seller_passwords', JSON.stringify(passwords));
}

export function getMasterPin(): string {
  return localStorage.getItem('app_master_pin') || "Agente2026";
}

/**
 * Parsea estatus múltiples que un cliente pueda tener (separados por coma, barra o punto y coma)
 * Ejemplo: "Activo, Cotizado" -> ["Activo", "Cotizado"]
 */
export function parseClientStatuses(statusStr?: string): string[] {
  if (!statusStr || typeof statusStr !== 'string') return ['Activo'];
  const parts = statusStr
    .split(/[,;/+]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : ['Activo'];
}

