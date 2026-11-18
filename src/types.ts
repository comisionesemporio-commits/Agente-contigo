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

export interface DependentItem {
  id: string;
  nombre: string;
  dbo: string; // Fecha de nacimiento MM/DD/YYYY
  ssn: string; // Social Security Number
  aplica: boolean; // true = Aplica (Activo), false = No Aplica
  parentesco?: string;
  estatusMigratorio?: string; // Ciudadano, Residente, Permiso de Trabajo, etc.
}

export interface ClientPolicy {
  id: string;
  vendedor: string;
  agente?: string;
  numPoliza: string;
  nombre: string;
  estatus: string;
  tipoPoliza?: 'obama' | 'suplementario'; // 'obama' (Obamacare / ACA) | 'suplementario' (Suplementario / Indemnidad / Dental / Visión)
  companiaSuplementaria?: string; // Compañía asociada para pólizas suplementarias
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
  dependientesList?: DependentItem[];
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
  clave?: string; // Contraseña única de acceso al portal de ventas
  email?: string;
  telefono?: string;
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

export type QuotePlanCategory =
  | 'medmax'
  | 'hpg4000'
  | 'guard'
  | 'affordable_choice'
  | 'presidio'
  | 'ahw4'
  | 'sanitas'
  | 'hospitalwise'
  | 'sanitas_bundle'
  | 'medaccess'
  | 'bmi_phcs'
  | 'afi'
  | 'acusa'
  | 'aca'
  | 'custom';

export type HpgPlanLevel = 'select2000' | 'preferred4000' | 'premier5000';
export type GuardPlanLevel = 'guard4000' | 'guard5000' | 'guard6000';
export type AffordableChoiceLevel = 'classic' | 'classic_plus' | 'elite' | 'elite_plus';
export type PresidioLevel = 'elite2500' | 'secure5000' | 'value7500' | 'essential10000';
export type HospitalWiseLevel = 'basic' | 'bundle1' | 'bundle2';
export type AhwPlanLevel = 'ahw1' | 'ahw2' | 'ahw3' | 'ahw4' | 'ahw5' | 'ahw6';
export type MedMaxDeductibleTier = 250 | 500 | 750 | 1000 | 1500;
export type MedMaxAgeBracket = '18-29' | '30-44' | '45-54' | '55-64';
export type MedMaxScope = 'individual' | 'familiar';
export type EnrollFamilyTier = 'empleado' | 'pareja' | 'hijos' | 'familiar';
export type MedAccessLevel = 'basic' | 'pro';
export type MedAccessAgeBracket = '18-45' | '46-64';
export type BmiPhcsLevel = 'basic' | 'value' | 'advantage';
export type AfiLevel = 'hsa3500' | 'copay3500';
export type AcusaLevel = 'bronze2' | 'silver2';

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
  // Campos opcionales retrocompatibles para catálogo oficial Agente Contigo
  planCategory?: QuotePlanCategory;
  hpgLevel?: HpgPlanLevel;
  guardLevel?: GuardPlanLevel;
  affordableChoiceLevel?: AffordableChoiceLevel;
  affordableChoiceAge?: number;
  presidioLevel?: PresidioLevel;
  hospitalwiseLevel?: HospitalWiseLevel;
  ahwLevel?: AhwPlanLevel;
  medmaxDeductibleTier?: MedMaxDeductibleTier;
  medmaxScope?: MedMaxScope;
  medmaxAgeBracket?: MedMaxAgeBracket;
  medmaxFamilyTier?: EnrollFamilyTier;
  medaccessLevel?: MedAccessLevel;
  medaccessAgeBracket?: MedAccessAgeBracket;
  bmiLevel?: BmiPhcsLevel;
  afiLevel?: AfiLevel;
  acusaLevel?: AcusaLevel;
  subtitleTag?: string;
  enrollmentFee?: string;
  enrollmentFeeLabel?: string;
  hasSanitasFee?: boolean;
  hasEnrollmentFee?: boolean;
  subsidyAmount?: string;
  planIdCode?: string;
  referralRequired?: string;
  acaLabsImaging?: string;
  acaErHospital?: string;
  acaRxTiers?: string;
  deductibleWarning?: string;
  highlights?: string[];
  includeInCombinedTotal?: boolean;
}

export interface SavedQuote {
  id: string;
  clientName: string;
  location: string;
  members: string;
  ages?: string;
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

export interface CarrierConfig {
  id: string;
  name: string;
  colorKey: string;
}

export interface CarrierColorPreset {
  key: string;
  name: string;
  dotColor: string;
  dotBg: string;
  badgeClass: string;
  bg: string;
  text: string;
  border: string;
}
