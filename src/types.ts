export type Role = 'admin' | 'vendedor' | 'none';

export interface HealthQuestions {
  tabaco?: string;
  otras?: string;
  rechazos?: string;
  embarazo?: string;
  hosp?: string;
  cancer?: string;
  sintomas?: string;
  cardio?: string;
  [key: string]: string | undefined;
}

export interface CommissionItem {
  paid: boolean;
  amount: number;
  paidDate: string;
  notes: string;
}

export interface ClientPolicy {
  id: string;
  vendedor: string;
  numPoliza: string;
  nombre: string;
  estatus: string;
  carrier: string;
  nombrePlan: string;
  peso: string;
  altura: string;
  bancoNombre: string;
  bancoTipoCuenta: string;
  bancoTitular: string;
  bancoRouting: string;
  bancoCuenta: string;
  cuestionarioSalud: HealthQuestions;
  mesIngreso: string;
  docStatus: string;
  estatusMigratorio?: string;
  ingresoFecha: string;
  ingresoMonto: number;
  primaMonto: number;
  metodoPago: string;
  estadoUSA: string;
  telefono: string;
  email: string;
  ssn: string;
  dbo: string;
  edad: number;
  direccion: string;
  numDependientes: number;
  datosDependientes?: string;
  pagoRealizado: string; // 'TRUE' | 'FALSE'
  notas: string;
  createdDate: string;
  createdYear: string;
  commissions?: Record<string, Record<string, CommissionItem>>; // Year -> Month -> CommissionItem
}

export interface Agent {
  id: string;
  nombre: string;
  apellido: string;
  npn: string;
  licencias: string;
  compania: string;
  notas: string;
}

export type TaskPriority = 'alta' | 'media' | 'baja';
export type TaskCategory = 'llamada' | 'documentos' | 'renovacion' | 'pago' | 'general';
export type TaskStatus = 'pendiente' | 'en_progreso' | 'completada';

export type EventType = 'zoom' | 'llamada' | 'cita' | 'seguimiento' | 'pago' | 'otro';

export interface CalendarEvent {
  id: string;
  titulo: string;
  descripcion?: string;
  fecha: string; // YYYY-MM-DD
  horaInicio?: string; // HH:mm (ej: "10:00")
  horaFin?: string; // HH:mm (ej: "11:00")
  tipo: EventType;
  clienteRelacionado?: string;
  linkReunion?: string; // Link de Zoom, Google Meet o teléfono
  asignadoA: string;
  completada?: boolean;
  creadaEn: string;
}

export interface DailyTask {
  id: string;
  titulo: string;
  descripcion?: string;
  fechaVencimiento: string; // YYYY-MM-DD
  prioridad: TaskPriority;
  categoria: TaskCategory;
  estado: TaskStatus;
  clienteRelacionado?: string; // Nombre o ID del cliente
  asignadoA: string; // Vendedor o Administrador
  creadaEn: string;
}

export interface QuotePlan {
  id: string;
  tag?: string;
  company: string;
  planName: string;
  tier: string;
  premium: string;
  deductible: string;
  moop: string;
  primaryCare: string;
  specialist: string;
  genericRx: string;
  urgencies: string;
  extraBenefit: string;
  clientSummary: string;
  isRecommended: boolean;
}

export interface SavedQuote {
  id: string;
  clientName: string;
  location: string;
  members: string;
  year: string;
  agentName: string;
  plans: QuotePlan[];
  totalMonthlyPremium: number;
  createdAt: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
