import { ClientPolicy, Agent, DailyTask, CalendarEvent } from '../types';

export const MONTHS_LIST = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const DEFAULT_SELLERS = [
  "Virginia", "Junior", "Dani", "Carlos Mendoza", "Oscar", "María Rivas"
];

export const DEFAULT_CARRIERS = [
  "Oscar", "Ambetter", "Aetna", "Florida Blue", "Cigna", "UnitedHealthcare", "Molina"
];

export const DEFAULT_STATUSES = [
  "Nuevo", "Subido / Listo", "Pendiente", "Activo", "Cancelado", "Robado"
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

export const INITIAL_AGENTS: Agent[] = [
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
  },
  {
    id: 'ag-3',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    npn: '18273645',
    licencias: 'GA, NC, SC - Salud',
    compania: 'Cigna / Oscar',
    notas: 'Agente Autorizado'
  },
  {
    id: 'ag-4',
    nombre: 'Dani',
    apellido: 'Rodríguez',
    npn: '21029384',
    licencias: 'GA, FL - Marketplace',
    compania: 'UnitedHealthcare',
    notas: 'Agente Asesor Salud'
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
    vendedor: "Carlos Mendoza",
    agente: "Carlos Mendoza",
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
    asignadoA: 'Carlos Mendoza',
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
    asignadoA: 'Carlos Mendoza',
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

// Local Storage Helpers
export function loadClients(): ClientPolicy[] {
  try {
    const raw = localStorage.getItem('polizas_backup_2026');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error loading clients from localStorage:", e);
  }
  return INITIAL_CLIENTS;
}

export function saveClients(clients: ClientPolicy[]) {
  try {
    localStorage.setItem('polizas_backup_2026', JSON.stringify(clients));
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
    asignadoA: 'Carlos Mendoza',
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
    asignadoA: 'Carlos Mendoza',
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

export function getSellerPass(): string {
  return localStorage.getItem('app_seller_pass') || "Ventas2026";
}

export function getMasterPin(): string {
  return localStorage.getItem('app_master_pin') || "Agente2026";
}
