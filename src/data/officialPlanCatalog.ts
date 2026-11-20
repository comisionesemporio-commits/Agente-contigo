import {
  AcusaLevel,
  AffordableChoiceLevel,
  AfiLevel,
  BmiPhcsLevel,
  EnrollFamilyTier,
  GuardPlanLevel,
  HospitalWiseLevel,
  HpgPlanLevel,
  MedMaxAgeBracket,
  MedMaxDeductibleTier,
  MedMaxScope,
  PremierMaxLevel,
  PremierMmLevel,
  PresidioLevel,
  QuotePlan
} from '../types';

export const MEDMAX_DEFAULT_WARNING =
  'Todos los copagos detallados aplican DESPUÉS de cumplir el deducible anual seleccionado (Individual o Familiar) hasta alcanzar el Máximo Fuera de Bolsillo ($9,200 Ind. / $18,400 Fam.), excepto cuidado preventivo y telemedicina 24/7 RelyMD a $0 inmediato.';

export const SANITAS_FEE_AMOUNT = 40;
export const ENROLL_APP_FEE_AMOUNT = 75;

export const FAMILY_GROUP_PRESETS = [
  'Individual (Solo Adulto)',
  'Pareja (2 Adultos)',
  'Titular + 1 Niño',
  'Familiar (1 Adulto + 2 Niños)',
  'Familia (2 Adultos + 1 Niño)',
  'Familia (2 Adultos + 2 Niños)',
  'Solo Niño'
];

export const parseMoney = (val?: string | number): number => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val || '').replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

export const formatMoney = (val: number): string => {
  return (Number.isFinite(val) ? val : 0).toFixed(2);
};

// ============================================================
// DETECTORES DE EDAD Y GRUPO FAMILIAR (ENROLL PRIME / AOSIS)
// ============================================================

export const extractAgesArray = (agesText: string): number[] => {
  return (String(agesText || '').match(/\d+/g) || [])
    .map(n => parseInt(n, 10))
    .filter(n => n >= 0 && n <= 110);
};

export const detectEnrollFamilyTier = (membersText: string, agesText: string): EnrollFamilyTier => {
  const m = String(membersText || '').toLowerCase();
  if (
    m.includes('pareja') ||
    m.includes('cónyuge') ||
    m.includes('conyuge') ||
    m.includes('esposo') ||
    m.includes('2 adultos')
  ) {
    if (m.includes('niño') || m.includes('nino') || m.includes('hijo') || m.includes('familiar') || m.includes('familia')) {
      if (!m.includes('pareja (2 adultos)')) return 'familiar';
    }
    return 'pareja';
  }
  if (
    m.includes('titular + 1') ||
    m.includes('titular + niño') ||
    m.includes('titular + nino') ||
    m.includes('titular e hijo') ||
    m.includes('padre o madre + hijo') ||
    m.includes('empleado + hijo') ||
    m.includes('1 adulto +')
  ) {
    return 'hijos';
  }
  if (m.includes('familiar') || m.includes('familia') || m.includes('3 personas') || m.includes('4 personas')) {
    return 'familiar';
  }
  if (m.includes('individual') || m.includes('solo adulto') || m.includes('empleado') || m.includes('solo niño') || m.includes('1 persona')) {
    return 'empleado';
  }

  const ages = extractAgesArray(agesText);
  if (ages.length > 0) {
    const adults = ages.filter(a => a >= 18).length;
    const kids = ages.filter(a => a < 18).length;
    if (adults <= 1 && kids === 0) return 'empleado';
    if (adults >= 2 && kids === 0) return 'pareja';
    if (adults === 1 && kids >= 1) return 'hijos';
    return 'familiar';
  }

  return 'empleado';
};

export const detectMedMaxAgeBracket = (agesText: string): MedMaxAgeBracket => {
  const ages = extractAgesArray(agesText);
  const adultAges = ages.filter(a => a >= 18);
  const refAge = adultAges.length > 0 ? Math.max(...adultAges) : ages[0] || 30;
  if (refAge < 30) return '18-29';
  if (refAge <= 44) return '30-44';
  if (refAge <= 54) return '45-54';
  return '55-64';
};

// ============================================================
// 1. MEDMAX (PLAN ERISA • RED FIRST HEALTH • GUÍA OFICIAL)
// ============================================================

export const MEDMAX_DEDUCTIBLE_OPTIONS: Array<{
  tier: MedMaxDeductibleTier;
  indAmount: number;
  famAmount: number;
  indLabel: string;
  famLabel: string;
}> = [
  { tier: 250, indAmount: 250, famAmount: 500, indLabel: '$250', famLabel: '$500' },
  { tier: 500, indAmount: 500, famAmount: 1000, indLabel: '$500', famLabel: '$1,000' },
  { tier: 750, indAmount: 750, famAmount: 1500, indLabel: '$750', famLabel: '$1,500' },
  { tier: 1000, indAmount: 1000, famAmount: 2000, indLabel: '$1,000', famLabel: '$2,000' },
  { tier: 1500, indAmount: 1500, famAmount: 3000, indLabel: '$1,500', famLabel: '$3,000' }
];

// Tabla Oficial de Tarifas Mensuales MedMax (Edad / Categoría / Deducible)
export const MEDMAX_RATE_TABLE: Record<
  MedMaxAgeBracket,
  Record<EnrollFamilyTier, Record<MedMaxDeductibleTier, number>>
> = {
  '18-29': {
    empleado: { 250: 369, 500: 349, 750: 329, 1000: 309, 1500: 289 },
    pareja: { 250: 689, 500: 669, 750: 649, 1000: 629, 1500: 609 },
    hijos: { 250: 709, 500: 659, 750: 639, 1000: 619, 1500: 599 },
    familiar: { 250: 959, 500: 909, 750: 889, 1000: 869, 1500: 849 }
  },
  '30-44': {
    empleado: { 250: 439, 500: 409, 750: 389, 1000: 369, 1500: 339 },
    pareja: { 250: 759, 500: 709, 750: 679, 1000: 659, 1500: 639 },
    hijos: { 250: 739, 500: 699, 750: 669, 1000: 649, 1500: 623 },
    familiar: { 250: 999, 500: 969, 750: 939, 1000: 909, 1500: 889 }
  },
  '45-54': {
    empleado: { 250: 469, 500: 439, 750: 419, 1000: 399, 1500: 379 },
    pareja: { 250: 769, 500: 749, 750: 719, 1000: 699, 1500: 689 },
    hijos: { 250: 759, 500: 739, 750: 709, 1000: 689, 1500: 669 },
    familiar: { 250: 1049, 500: 1019, 750: 999, 1000: 979, 1500: 959 }
  },
  '55-64': {
    empleado: { 250: 519, 500: 489, 750: 469, 1000: 449, 1500: 429 },
    pareja: { 250: 789, 500: 769, 750: 749, 1000: 729, 1500: 719 },
    hijos: { 250: 769, 500: 749, 750: 729, 1000: 719, 1500: 679 },
    familiar: { 250: 1079, 500: 1059, 750: 1019, 1000: 999, 1500: 979 }
  }
};

export const getMedMaxDeductibleDisplay = (
  tier: MedMaxDeductibleTier,
  scope: MedMaxScope
): string => {
  const opt = MEDMAX_DEDUCTIBLE_OPTIONS.find(o => o.tier === tier) || MEDMAX_DEDUCTIBLE_OPTIONS[2];
  return scope === 'individual'
    ? `${opt.indLabel} Individual (${opt.famLabel} Fam.)`
    : `${opt.famLabel} Familiar (${opt.indLabel} Ind.)`;
};

export const getMedMaxMoopDisplay = (scope: MedMaxScope): string => {
  return scope === 'individual'
    ? '$9,200 Individual ($18,400 Familiar)'
    : '$18,400 Familiar ($9,200 Individual)';
};

export const getMedMaxQuotePricing = (
  ageBracket: MedMaxAgeBracket,
  familyTier: EnrollFamilyTier,
  deductibleTier: MedMaxDeductibleTier
): { monthlyPrice: string; scope: MedMaxScope; deductibleLabel: string; moopLabel: string } => {
  const scope: MedMaxScope = familyTier === 'empleado' ? 'individual' : 'familiar';
  const amount = MEDMAX_RATE_TABLE[ageBracket][familyTier][deductibleTier];
  return {
    monthlyPrice: amount.toFixed(2),
    scope,
    deductibleLabel: getMedMaxDeductibleDisplay(deductibleTier, scope),
    moopLabel: getMedMaxMoopDisplay(scope)
  };
};

// Validador anti-deducibles erróneos en MedMax
export const validateMedMaxDeductible = (
  deductibleStr: string,
  scope: MedMaxScope
): { isValid: boolean; reason: string; closestTier: MedMaxDeductibleTier } => {
  const nums = (String(deductibleStr || '').match(/\d[\d,]*/g) || []).map(s =>
    parseInt(s.replace(/,/g, ''), 10)
  );
  const firstNum = nums[0] || 0;
  const validInd = [250, 500, 750, 1000, 1500];
  const validFam = [500, 1000, 1500, 2000, 3000];
  const allowed = scope === 'individual' ? validInd : validFam;
  const isValid = allowed.includes(firstNum);

  let closestTier: MedMaxDeductibleTier = 750;
  if (scope === 'individual') {
    if (firstNum <= 350) closestTier = 250;
    else if (firstNum <= 600) closestTier = 500;
    else if (firstNum <= 850) closestTier = 750;
    else if (firstNum <= 1250) closestTier = 1000;
    else closestTier = 1500;
  } else {
    if (firstNum <= 700) closestTier = 250;
    else if (firstNum <= 1200) closestTier = 500;
    else if (firstNum <= 1700) closestTier = 750;
    else if (firstNum <= 2400) closestTier = 1000;
    else closestTier = 1500;
  }

  return {
    isValid,
    closestTier,
    reason: isValid
      ? ''
      : scope === 'individual'
        ? 'Deducible fuera de tabla oficial MedMax Individual (solo $250, $500, $750, $1,000 o $1,500).'
        : 'Deducible fuera de tabla oficial MedMax Familiar (solo $500, $1,000, $1,500, $2,000 o $3,000).'
  };
};

export const MEDMAX_OFFICIAL_BULLETS: string[] = [
  '1. Servicios NO Sujetos a Deducible ($0 Inmediato): Cuidado preventivo y Telemedicina 24/7 (RelyMD: consultas virtuales primarias, urgencias virtuales y salud mental) a $0 copago, más medicamentos genéricos preventivos a $0 (genéricos estándar tras deducible). Incluye Red Nacional First Health PPO y Med Defender Pro (Bill Negotiator + Patient Assistance Program).',
  '2. Servicios Ambulatorios y Diagnóstico (Tras Cumplir Deducible): Médico primario, especialista y urgencias a $50/$50/$50 (máx. 10 visitas combinadas/año; quiropráctico hasta 12 visitas/año). Laboratorio simple a $25 y radiología simple a $50 en centros no hospitalarios (límite 3/año). Imágenes avanzadas (MRI, CT, PET) a $200 copago (requiere autorización médica previa).',
  '3. Emergencias, Hospitalización, Cirugías y Otros Servicios (Tras Cumplir Deducible): Sala de Emergencias (ER) / ambulancia a $250 copago (2 admisiones por enfermedad, 2 por accidente y 2 transportes/año). Cirugía en consultorio y ambulatoria a $250 copago (hasta 3/año; incluye cirujano, anestesia y gastos de sala; no electivas). Hospitalización y cirugía internado a $1,000 copago (hasta 2 admisiones/año, máx. 10 días por internación; 2 cirugías con internación cubiertas). Maternidad: parto vaginal $250 / cesárea $500 (espera 12 meses; prenatal/postnatal y labs 100% cubiertos). Infusiones/Quimio/Radioterapia $100 (10 visitas comb.), Terapias (física, ocupacional, habla, cardíaca) $50 (16 visitas comb.), Cuidado en casa/Enfermería especializada $50 (10 días c/u), DME $50 (5 artículos/año), Salud mental ambulatorio $50 / internado $250 (15 días/año).'
];

// ============================================================
// 2. HEALTH PROTECTORGUARD (HPG) - UNITEDHEALTHCARE / GOLDEN RULE
// ============================================================

export interface HpgSpec {
  level: HpgPlanLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  bullets: string[];
}

export const HPG_SPECS: Record<HpgPlanLevel, HpgSpec> = {
  select2000: {
    level: 'select2000',
    title: 'Health ProtectorGuard® Select 2000',
    shortLabel: 'Select 2000',
    tierLabel: 'Select 2000 • Indemnización en Efectivo ($0 Deducible)',
    moopLabel: 'Máx. Anual $2,000,000 / Vitalicio $5,000,000 por persona',
    pcpLabel: '$80/visita (4 Año 1 / 6 Año 2+)',
    specialistLabel: '$100/visita (SP/UC)',
    rxLabel: '$10 Genérico / $40 Marca (12 Año 1 / 17 Año 2+)',
    urgenciesLabel: '$300/día ER • $100/visita UC',
    bullets: [
      'Condiciones Generales: Plan de indemnización fija en efectivo sin deducible, sin coseguro y sin copagos (red UnitedHealthcare Choice Plus con ~58% de ahorro promedio). Máximo anual de $2,000,000 y vitalicio de $5,000,000 por persona. Sin período de espera (sujeto a 12 meses para preexistencias). Incluye Telemedicina ilimitada a $0 (Healthiest You) y descuentos Optum Perks.',
      'Hospitalización: Año 1: $2,000/día | Año 2+ (lesión): $4,000/día (días ilimitados). UCI/CCU: $2,000/día (máx. 60 días). Bono 1.er día de admisión: $2,000. Médico hospitalario: $100/día.',
      'Emergencias y Ambulancia: Sala de Emergencias (ER) $300/día (máx. 3 días/año). Ambulancia terrestre/acuática $1,000 | aérea $5,000 (1 traslado/año).',
      'Cirugía y Diagnósticos: Cirugía (7 niveles) de $250 a $25,000/día (+ 20% cirujano asistente y 30% anestesiólogo). Centro ambulatorio $1,000/día (máx. 10 días). Lab $30/test, Rayos X $50/test (máx. 10 combinados), MRI/PET/CAT $400/test. Quimio oral $1,000/mes (máx. 3 meses), no oral $1,000/día (máx. 40 días).',
      'Consultas, Terapias y Rx: Consultas (4 visitas Año 1 / 6 Año 2+): PCP $80, Especialista/Urgencias $100, cirugía menor en consultorio $200. Terapias (quiropráctica, física, ocupacional, habla): $35/visita (máx. 10). Recetas (12 Año 1 / 17 Año 2+): Genérico $10, Marca $40.',
      'Preventivo: Examen físico $100, Labs preventivos $100 (máx. 2), Rayos X $100, Vacuna gripe adultos $25 (1/año), Vacunas niños $25 (máx. 4), Alergias niños $10 (máx. 10), Mamografía $150 (Año 1) / $225 (Año 2+), Pap/PSA $100 (Año 1) / $150 (Año 2+), Colonoscopia $500.'
    ]
  },
  preferred4000: {
    level: 'preferred4000',
    title: 'Health ProtectorGuard® Preferred 4000',
    shortLabel: 'Preferred 4000',
    tierLabel: 'Preferred 4000 • Indemnización en Efectivo ($0 Deducible)',
    moopLabel: 'Máx. Anual $2,000,000 / Vitalicio $5,000,000 por persona',
    pcpLabel: '$100/visita (6 Año 1 / 8 Año 2+)',
    specialistLabel: '$125/visita (SP/UC)',
    rxLabel: '$20 Genérico / $60 Marca (12 Año 1 / 17 Año 2+)',
    urgenciesLabel: '$500/día ER • $125/visita UC',
    bullets: [
      'Condiciones Generales: Plan de indemnización fija en efectivo sin deducible, sin coseguro y sin copagos (red UnitedHealthcare Choice Plus con ~58% de ahorro promedio). Máximo anual de $2,000,000 y vitalicio de $5,000,000 por persona. Sin período de espera (sujeto a 12 meses para preexistencias). Incluye Telemedicina ilimitada a $0 (Healthiest You) y descuentos Optum Perks.',
      'Hospitalización: Año 1: $4,000/día | Año 2+ (lesión): $8,000/día (días ilimitados). UCI/CCU: $4,000/día (máx. 60 días). Bono 1.er día de admisión: $3,000. Médico hospitalario: $100/día.',
      'Emergencias y Ambulancia: Sala de Emergencias (ER) $500/día (máx. 3 días/año). Ambulancia terrestre/acuática $1,000 | aérea $5,000 (1 traslado/año).',
      'Cirugía y Diagnósticos: Cirugía (7 niveles) de $375 a $37,500/día (+ 20% cirujano asistente y 30% anestesiólogo). Centro ambulatorio $2,000/día (máx. 10 días). Lab $50/test, Rayos X $75/test (máx. 10 combinados), MRI/PET/CAT $400/test. Quimio oral $1,000/mes (máx. 3 meses), no oral $2,000/día (máx. 40 días).',
      'Consultas, Terapias y Rx: Consultas (6 visitas Año 1 / 8 Año 2+): PCP $100, Especialista/Urgencias $125, cirugía menor en consultorio $225. Terapias: $45/visita (máx. 10). Recetas (12 Año 1 / 17 Año 2+): Genérico $20, Marca $60.',
      'Preventivo: Examen físico $125, Labs preventivos $100 (máx. 2), Rayos X $100, Vacuna gripe adultos $25 (1/año), Vacunas niños $25 (máx. 4), Alergias niños $10 (máx. 10), Mamografía $200 (Año 1) / $300 (Año 2+), Pap/PSA $100 (Año 1) / $150 (Año 2+), Colonoscopia $750.'
    ]
  },
  premier5000: {
    level: 'premier5000',
    title: 'Health ProtectorGuard® Premier 5000',
    shortLabel: 'Premier 5000',
    tierLabel: 'Premier 5000 • Indemnización en Efectivo ($0 Deducible)',
    moopLabel: 'Máx. Anual $2,000,000 / Vitalicio $5,000,000 por persona',
    pcpLabel: '$150/visita (10 Año 1 / 12 Año 2+)',
    specialistLabel: '$150/visita ($200 UC)',
    rxLabel: '$20 Genérico / $60 Marca (20 Año 1 / 25 Año 2+)',
    urgenciesLabel: '$1,000/día ER • $200/visita UC',
    bullets: [
      'Condiciones Generales: Plan de indemnización fija en efectivo sin deducible, sin coseguro y sin copagos (red UnitedHealthcare Choice Plus con ~58% de ahorro promedio). Máximo anual de $2,000,000 y vitalicio de $5,000,000 por persona. Sin período de espera (sujeto a 12 meses para preexistencias). Incluye Telemedicina ilimitada a $0 (Healthiest You) y descuentos Optum Perks.',
      'Hospitalización: Año 1: $5,000/día | Año 2+ (lesión): $10,000/día (días ilimitados). UCI/CCU: $5,000/día (máx. 60 días). Bono 1.er día de admisión: $3,000. Médico hospitalario: $100/día.',
      'Emergencias y Ambulancia: Sala de Emergencias (ER) $1,000/día (máx. 3 días/año). Ambulancia terrestre/acuática $1,000 | aérea $5,000 (1 traslado/año).',
      'Cirugía y Diagnósticos: Cirugía (7 niveles) de $500 a $50,000/día (+ 20% cirujano asistente y 30% anestesiólogo). Centro ambulatorio $4,000/día (máx. 10 días). Lab $50/test, Rayos X $75/test (máx. 10 combinados), MRI/PET/CAT $1,000/test. Quimio oral $2,000/mes (máx. 6 meses), no oral $2,500/día (máx. 60 días).',
      'Consultas, Terapias y Rx: Consultas (10 visitas Año 1 / 12 Año 2+): PCP $150, Especialista $150, Urgencias $200, cirugía menor en consultorio $250. Terapias: $75/visita (máx. 10). Recetas (20 Año 1 / 25 Año 2+): Genérico $20, Marca $60.',
      'Preventivo: Examen físico $150, Labs preventivos $100 (máx. 2), Rayos X $100, Vacuna gripe adultos $25 (1/año), Vacunas niños $25 (máx. 4), Alergias niños $10 (máx. 10), Mamografía $200 (Año 1) / $300 (Año 2+), Pap/PSA $100 (Año 1) / $150 (Año 2+), Colonoscopia $750.'
    ]
  }
};

// ============================================================
// 2B. GUARD PLANS (4000 / 5000 / 6000) - UNITEDHEALTHCARE / GOLDEN RULE
// ============================================================

export interface GuardPlanSpec {
  level: GuardPlanLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  extraBenefitLabel: string;
  bullets: string[];
}

export const GUARD_AVAILABLE_STATES = [
  'AK', 'AL', 'AR', 'AZ', 'DE', 'FL', 'GA', 'HI', 'IA', 'IL', 'IN',
  'KY', 'LA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'NC', 'NE', 'NV',
  'OH', 'OK', 'RI', 'SC', 'TN', 'TX', 'UT', 'VA', 'WI', 'WV', 'WY'
];

export const GUARD_SPECS: Record<GuardPlanLevel, GuardPlanSpec> = {
  guard4000: {
    level: 'guard4000',
    title: 'Guard 4000',
    shortLabel: 'Guard 4000',
    tierLabel: 'Guard 4000 • Indemnización Fija en Efectivo ($0 Deducible)',
    moopLabel: 'Pagos fijos en efectivo por persona/año ($0 deducible; cirugía hasta $12,500/día)',
    pcpLabel: '$80/visita (4 Año 1 / 6 Año 2+)',
    specialistLabel: '$100/visita (SP/UC)',
    rxLabel: 'No cubierto (Optum Perks 30%-80%)',
    urgenciesLabel: '$300/día ER (máx. 3 días) • $100/visita UC',
    extraBenefitLabel:
      'Red UHC Choice Plus (~58% ahorro promedio) + Telemedicina $0 (HealthiestYou) + Tarjeta Optum Perks (30%-80%).',
    bullets: [
      'Condiciones Generales y Red UHC Choice Plus: Plan de indemnización fija en efectivo sin deducible, sin coseguro y sin copagos (Golden Rule / UnitedHealthcare, Form HPG3-CSTM-GRI). Red UHC Choice Plus (+1.8M proveedores, 7,000+ hospitales, ~58% ahorro promedio) o cualquier médico. Edades 18-64 (preexistentes 12 meses; renovable hasta los 65). Incluye Telemedicina ilimitada $0 (HealthiestYou by Teladoc Health) y tarjeta Optum Perks.',
      'Hospitalización, Emergencias y Ambulancia: 1.er día de admisión hospitalaria (incluye observación 24h+) $4,000/día (máx. 1 día/año). Confinamiento hospitalario $100/día Año 1 | $200/día Año 2+ solo por lesión (máx. 31 días/año). Visita médica en hospital $100/día (máx. 1/día). Sala de Emergencias (ER) $300/día (máx. 3 días/año). Ambulancia (máx. 1 viaje/año): terrestre/acuática $500 | aérea $3,000.',
      'Cirugía y Centro Ambulatorio: Procedimiento quirúrgico (7 niveles) de $125 a $12,500/día (máx. 2 días/año; +20% cirujano asistente y +30% anestesiólogo, máx. 2 días). Centro ambulatorio $1,000/día (máx. 2 días/año). Exámenes ambulatorios (Rayos X, Diagnóstico Tier 1 y MRI/PET/CAT): No cubiertos en Guard 4000.',
      'Consultas, Terapias y Farmacia: Consultas médicas (4 Año 1 / 6 Año 2+): Médico $80/visita, Especialista/Urgencias $100/visita, cirugía menor en consultorio $200/visita. Terapias (quiropráctica, física, ocupacional, habla): $25/visita (máx. 10 visitas/año). Recetas médicas (Rx): No cubiertas en Guard 4000 (solo tarjeta descuento Optum Perks 30%-80%).'
    ]
  },
  guard5000: {
    level: 'guard5000',
    title: 'Guard 5000',
    shortLabel: 'Guard 5000',
    tierLabel: 'Guard 5000 • Indemnización Fija en Efectivo ($0 Deducible)',
    moopLabel: 'Pagos fijos en efectivo por persona/año ($0 deducible; cirugía hasta $12,500/día)',
    pcpLabel: '$100/visita (4 Año 1 / 6 Año 2+)',
    specialistLabel: '$120 SP / $150 UC',
    rxLabel: '$10 Genérico / $40 Marca (10 Año 1 / 15 Año 2+)',
    urgenciesLabel: '$500/día ER (máx. 3 días) • $150/visita UC',
    extraBenefitLabel:
      'Red UHC Choice Plus (~58% ahorro promedio) + Telemedicina $0 (HealthiestYou) + Recetas Rx ($10/$40) + Optum Perks.',
    bullets: [
      'Condiciones Generales y Red UHC Choice Plus: Plan de indemnización fija en efectivo sin deducible, sin coseguro y sin copagos (Golden Rule / UnitedHealthcare, Form HPG3-CSTM-GRI). Red UHC Choice Plus (+1.8M proveedores, 7,000+ hospitales, ~58% ahorro promedio) o cualquier médico. Edades 18-64 (preexistentes 12 meses; renovable hasta los 65). Incluye Telemedicina ilimitada $0 (HealthiestYou by Teladoc Health) y descuentos Optum Perks.',
      'Hospitalización, Emergencias y Ambulancia: 1.er día de admisión hospitalaria (incluye observación 24h+) $5,000/día (máx. 1 día/año). Confinamiento hospitalario $100/día Año 1 | $200/día Año 2+ solo por lesión (máx. 31 días/año). Visita médica en hospital $100/día (máx. 1/día). Sala de Emergencias (ER) $500/día (máx. 3 días/año). Ambulancia (máx. 1 viaje/año): terrestre/acuática $600 | aérea $3,000.',
      'Cirugía y Diagnósticos Ambulatorios: Procedimiento quirúrgico (7 niveles) de $125 a $12,500/día (máx. 2 días/año; +20% cirujano asistente y +30% anestesiólogo, máx. 2 días). Centro ambulatorio $1,500/día (máx. 2 días/año). Exámenes ambulatorios (máx. 4 combinados/año): Rayos X $50/test, Tier 1 (Ultrasonido/EKG/EEG/Angiograma) $250/test, Tier 2 (MRI/PET/CAT) $500/test.',
      'Consultas, Terapias y Farmacia (Rx): Consultas médicas (4 Año 1 / 6 Año 2+): Médico $100/visita, Especialista $120/visita, Urgencias (UC) $150/visita, cirugía menor en consultorio $225/visita. Terapias (quiropráctica, física, ocupacional, habla): $35/visita (máx. 10 visitas/año). Recetas Rx (10 surtidos Año 1 / 15 Año 2+): Genérico $10 | Marca $40 (+ Optum Perks).'
    ]
  },
  guard6000: {
    level: 'guard6000',
    title: 'Guard 6000',
    shortLabel: 'Guard 6000',
    tierLabel: 'Guard 6000 • Indemnización Fija Superior en Efectivo ($0 Deducible)',
    moopLabel: 'Pagos fijos en efectivo por persona/año ($0 deducible; cirugía hasta $25,000/día)',
    pcpLabel: '$120/visita (4 Año 1 / 6 Año 2+)',
    specialistLabel: '$140 SP / $200 UC',
    rxLabel: '$10 Genérico / $40 Marca (10 Año 1 / 15 Año 2+)',
    urgenciesLabel: '$600/día ER (máx. 3 días) • $200/visita UC',
    extraBenefitLabel:
      'Red UHC Choice Plus (~58% ahorro promedio) + Telemedicina $0 (HealthiestYou) + Recetas Rx ($10/$40) + Optum Perks.',
    bullets: [
      'Condiciones Generales y Red UHC Choice Plus: Plan de indemnización fija en efectivo sin deducible, sin coseguro y sin copagos (Golden Rule / UnitedHealthcare, Form HPG3-CSTM-GRI). Red UHC Choice Plus (+1.8M proveedores, 7,000+ hospitales, ~58% ahorro promedio) o cualquier médico. Edades 18-64 (preexistentes 12 meses; renovable hasta los 65). Incluye Telemedicina ilimitada $0 (HealthiestYou by Teladoc Health) y descuentos Optum Perks.',
      'Hospitalización, Emergencias y Ambulancia: 1.er día de admisión hospitalaria (incluye observación 24h+) $6,000/día (máx. 1 día/año). Confinamiento hospitalario $100/día Año 1 | $200/día Año 2+ solo por lesión (máx. 31 días/año). Visita médica en hospital $100/día (máx. 1/día). Sala de Emergencias (ER) $600/día (máx. 3 días/año). Ambulancia (máx. 1 viaje/año): terrestre/acuática $600 | aérea $3,000.',
      'Cirugía y Diagnósticos Ambulatorios: Procedimiento quirúrgico (7 niveles) de $250 a $25,000/día (máx. 2 días/año; +20% cirujano asistente y +30% anestesiólogo, máx. 2 días). Centro ambulatorio $2,000/día (máx. 2 días/año). Exámenes ambulatorios (máx. 4 combinados/año): Rayos X $100/test, Tier 1 (Ultrasonido/EKG/EEG/Angiograma) $500/test, Tier 2 (MRI/PET/CAT) $500/test.',
      'Consultas, Terapias y Farmacia (Rx): Consultas médicas (4 Año 1 / 6 Año 2+): Médico $120/visita, Especialista $140/visita, Urgencias (UC) $200/visita, cirugía menor en consultorio $250/visita. Terapias (quiropráctica, física, ocupacional, habla): $50/visita (máx. 10 visitas/año). Recetas Rx (10 surtidos Año 1 / 15 Año 2+): Genérico $10 | Marca $40 (+ Optum Perks).'
    ]
  }
};

// ============================================================
// 2C. MANHATTANLIFE • AFFORDABLE CHOICE MEJORADOS (CLASSIC -> ELITE PLUS)
// ============================================================

export const AFFORDABLE_CHOICE_AGES = [20, 25, 30, 35, 40, 45, 50, 55, 60, 64] as const;
export type AffordableChoiceAge = (typeof AFFORDABLE_CHOICE_AGES)[number];
export type AffordableChoiceGroupKey = 'empleado' | 'pareja' | 'hijos' | 'familiar' | 'solo_ninos';

export interface AffordableChoiceSpec {
  level: AffordableChoiceLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  extraBenefitLabel: string;
  ratesByAge: Record<AffordableChoiceAge, Record<AffordableChoiceGroupKey, number>>;
  bullets: string[];
}

export const AFFORDABLE_CHOICE_SPECS: Record<AffordableChoiceLevel, AffordableChoiceSpec> = {
  classic: {
    level: 'classic',
    title: 'Affordable Choice Classic',
    shortLabel: 'Classic',
    tierLabel: 'Indemnización Fija • Hospital $2,000/día ($0 Deducible)',
    moopLabel: 'Máx. Anual Hosp. $1,000,000 • Máx. Vitalicio $5,000,000 ($0 deducible)',
    pcpLabel: '$75/día consultorio (máx. 6 días/año; transf. hasta 5)',
    specialistLabel: '$75/día consultorio • Cirugía 1x Medicare (máx. $50k/año)',
    rxLabel: '$25/día Rx (máx. $750/año) + EasyCare2go',
    urgenciesLabel: '$250/día ER (1/año) • $250/día UC (2/año)',
    extraBenefitLabel:
      'Sin períodos de espera ni restricción de red (ahorros First Health +1.5M centros), Telemedicina EasyCare2go, Green Imaging, DirectLabs y CareGuide.',
    ratesByAge: {
      20: { empleado: 70.09, pareja: 128.52, hijos: 116.9, familiar: 183.93, solo_ninos: 74.42 },
      25: { empleado: 79.33, pareja: 144.76, hijos: 131.38, familiar: 207.19, solo_ninos: 74.42 },
      30: { empleado: 89.32, pareja: 166.67, hijos: 147.0, familiar: 232.21, solo_ninos: 74.42 },
      35: { empleado: 99.14, pareja: 184.93, hijos: 162.32, familiar: 256.72, solo_ninos: 74.42 },
      40: { empleado: 108.3, pareja: 201.76, hijos: 176.47, familiar: 279.22, solo_ninos: 74.42 },
      45: { empleado: 119.29, pareja: 221.84, hijos: 193.37, familiar: 306.02, solo_ninos: 74.42 },
      50: { empleado: 137.63, pareja: 254.91, hijos: 221.31, familiar: 349.99, solo_ninos: 74.42 },
      55: { empleado: 155.97, pareja: 287.99, hijos: 249.24, familiar: 393.97, solo_ninos: 74.42 },
      60: { empleado: 174.94, pareja: 322.15, hijos: 278.11, familiar: 439.37, solo_ninos: 74.42 },
      64: { empleado: 192.06, pareja: 352.8, hijos: 304.03, familiar: 480.01, solo_ninos: 74.42 }
    },
    bullets: [
      'Hospitalización y Emergencias (Pago Fijo desde Día 1): Admisión hospitalaria 1.er día $1,000 + Internación $2,000/día (por lesión sube +25%/año: Año 2 $2,500, Año 3 $3,000, Año 4 $3,500, Año 5 $4,000/día; límite $1,000,000/año y $5,000,000 vitalicio). Observación hospitalaria $1,000/día (24-47h) y $1,500/día (48h+). Sala de Emergencias (ER) $250/día (1/año) | Urgencias (UC) $250/día (2/año). Ambulancia: terrestre $150 / aérea $1,500 (máx. 2/año).',
      'Cirugías y Cáncer: Cirugías (hosp. y amb.) pagan 1 vez el arancel Medicare (máx. $50,000/año) + Cirugía ambulatoria $1,000 + 20% cirujano asistente + 25% anestesiólogo. Beneficio por cáncer (radio/quimio/inmuno): $1,000/día (máx. 40 días/año).',
      'Consultas, Ambulatorios y Rx (máx. ambulatorio $4,000/año): Consultorio médico $75/día (máx. 6 días/año; transferencia de hasta 5 visitas). Preventivo: Colonoscopía $500, Pap $250, PSA $250. Lab patología $200 / otros $50; Terapia (física/ocupacional/habla) $50/día; Radiología MRI/PET/CT/Mamografía/otras $300/$300/$250/$200. Medicamentos recetados (Rx) $25/día (máx. $750/año).',
      'Libertad de Red y Extras ManhattanLife: Sin períodos de espera ni restricción de red (descuentos First Health Network +1.5M centros), Telemedicina y Rx con descuento EasyCare2go, Green Imaging, DirectLabs y CareGuide (anexo opcional enfermedades críticas $250k/$500k disponible).'
    ]
  },
  classic_plus: {
    level: 'classic_plus',
    title: 'Affordable Choice Classic Plus',
    shortLabel: 'Classic Plus',
    tierLabel: 'Indemnización Fija • Hospital $3,000/día ($0 Deducible)',
    moopLabel: 'Máx. Anual Hosp. $1,000,000 • Máx. Vitalicio $5,000,000 ($0 deducible)',
    pcpLabel: '$125/día consultorio (máx. 8 días/año; transf. hasta 5)',
    specialistLabel: '$125/día consultorio • Cirugía 2x Medicare (máx. $50k/año)',
    rxLabel: '$50/día Rx (máx. $750/año) + EasyCare2go',
    urgenciesLabel: '$250/día ER (1/año) • $250/día UC (2/año)',
    extraBenefitLabel:
      'Sin períodos de espera ni restricción de red (ahorros First Health +1.5M centros), Telemedicina EasyCare2go, Green Imaging, DirectLabs y CareGuide.',
    ratesByAge: {
      20: { empleado: 98.09, pareja: 184.48, hijos: 169.21, familiar: 267.53, solo_ninos: 109.2 },
      25: { empleado: 110.34, pareja: 206.76, hijos: 188.91, familiar: 299.34, solo_ninos: 109.2 },
      30: { empleado: 123.57, pareja: 235.14, hijos: 210.12, familiar: 333.51, solo_ninos: 109.2 },
      35: { empleado: 136.56, pareja: 259.73, hijos: 230.91, familiar: 366.96, solo_ninos: 109.2 },
      40: { empleado: 148.59, pareja: 282.31, hijos: 250.02, familiar: 397.59, solo_ninos: 109.2 },
      45: { empleado: 162.99, pareja: 309.2, hijos: 272.81, familiar: 434.02, solo_ninos: 109.2 },
      50: { empleado: 186.85, pareja: 353.32, hijos: 310.29, familiar: 493.6, solo_ninos: 109.2 },
      55: { empleado: 210.71, pareja: 397.44, hijos: 347.77, familiar: 553.19, solo_ninos: 109.2 },
      60: { empleado: 235.38, pareja: 442.99, hijos: 386.46, familiar: 614.68, solo_ninos: 109.2 },
      64: { empleado: 257.57, pareja: 483.76, hijos: 421.15, familiar: 669.65, solo_ninos: 109.2 }
    },
    bullets: [
      'Hospitalización y Emergencias (Pago Fijo desde Día 1): Admisión hospitalaria 1.er día $1,000 + Internación $3,000/día (por lesión sube +25%/año: Año 2 $3,750, Año 3 $4,500, Año 4 $5,250, Año 5 $6,000/día; límite $1,000,000/año y $5,000,000 vitalicio). Observación hospitalaria $1,500/día (24-47h) y $2,250/día (48h+). ER $250/día (1/año) | Urgencias (UC) $250/día (2/año). Ambulancia: terrestre $150 / aérea $1,500 (máx. 2/año).',
      'Cirugías y Cáncer: Cirugías (hosp. y amb.) pagan 2 veces el arancel Medicare (máx. $50,000/año) + Cirugía ambulatoria $2,000 + 20% cirujano asistente + 25% anestesiólogo. Beneficio por cáncer (radio/quimio/inmuno): $1,000/día (máx. 40 días/año).',
      'Consultas, Ambulatorios y Rx (máx. ambulatorio $4,000/año): Consultorio médico $125/día (máx. 8 días/año; transferencia de hasta 5 visitas). Preventivo: Colonoscopía $500, Pap $250, PSA $250. Lab patología $200 / otros $50; Terapia (física/ocupacional/habla) $50/día; Radiología MRI/PET/CT/Mamografía/otras $500/$500/$250/$200. Medicamentos recetados (Rx) $50/día (máx. $750/año).',
      'Libertad de Red y Extras ManhattanLife: Sin períodos de espera ni restricción de red (descuentos First Health Network +1.5M centros), Telemedicina y Rx con descuento EasyCare2go, Green Imaging, DirectLabs y CareGuide (anexo opcional enfermedades críticas $250k/$500k disponible).'
    ]
  },
  elite: {
    level: 'elite',
    title: 'Affordable Choice Elite',
    shortLabel: 'Elite',
    tierLabel: 'Indemnización Fija • Hospital $4,000/día ($0 Deducible)',
    moopLabel: 'Máx. Anual Hosp. $1,000,000 • Máx. Vitalicio $5,000,000 ($0 deducible)',
    pcpLabel: '$175/día consultorio (máx. 10 días/año; transf. hasta 5)',
    specialistLabel: '$175/día consultorio • Cirugía 2.5x Medicare (máx. $50k/año)',
    rxLabel: '$50/día Rx (máx. $750/año) + EasyCare2go',
    urgenciesLabel: '$300/día ER (2/año) • $300/día UC (4/año)',
    extraBenefitLabel:
      'Sin períodos de espera ni restricción de red (ahorros First Health +1.5M centros), Telemedicina EasyCare2go, Green Imaging, DirectLabs y CareGuide.',
    ratesByAge: {
      20: { empleado: 128.73, pareja: 240.91, hijos: 225.09, familiar: 355.07, solo_ninos: 147.48 },
      25: { empleado: 145.22, pareja: 269.32, hijos: 251.4, familiar: 396.88, solo_ninos: 147.48 },
      30: { empleado: 163.09, pareja: 309.21, hijos: 279.79, familiar: 441.85, solo_ninos: 147.48 },
      35: { empleado: 180.67, pareja: 341.6, hijos: 307.65, familiar: 485.93, solo_ninos: 147.48 },
      40: { empleado: 197.09, pareja: 371.49, hijos: 333.42, familiar: 526.44, solo_ninos: 147.48 },
      45: { empleado: 216.85, pareja: 407.19, hijos: 364.24, familiar: 574.71, solo_ninos: 147.48 },
      50: { empleado: 249.92, pareja: 466.12, hijos: 415.26, familiar: 654.04, solo_ninos: 147.48 },
      55: { empleado: 282.99, pareja: 525.05, hijos: 466.28, familiar: 733.36, solo_ninos: 147.48 },
      60: { empleado: 317.22, pareja: 585.93, hijos: 519.01, familiar: 815.26, solo_ninos: 147.48 },
      64: { empleado: 348.14, pareja: 640.59, hijos: 566.41, familiar: 888.63, solo_ninos: 147.48 }
    },
    bullets: [
      'Hospitalización y Emergencias (Pago Fijo desde Día 1): Admisión hospitalaria 1.er día $2,000 + Internación $4,000/día (por lesión sube +25%/año: Año 2 $5,000, Año 3 $6,000, Año 4 $7,000, Año 5 $8,000/día; límite $1,000,000/año y $5,000,000 vitalicio). Observación hospitalaria $2,000/día (24-47h) y $3,000/día (48h+). ER $300/día (2/año) | Urgencias (UC) $300/día (4/año). Ambulancia: terrestre $150 / aérea $1,500 (máx. 2/año).',
      'Cirugías y Cáncer: Cirugías (hosp. y amb.) pagan 2.5 veces el arancel Medicare (máx. $50,000/año) + Cirugía ambulatoria $2,500 + 20% cirujano asistente + 25% anestesiólogo. Beneficio por cáncer (radio/quimio/inmuno): $2,000/día (máx. 40 días/año).',
      'Consultas, Ambulatorios y Rx (máx. ambulatorio $6,000/año): Consultorio médico $175/día (máx. 10 días/año; transferencia de hasta 5 visitas). Preventivo: Colonoscopía $600, Pap $300, PSA $300. Lab patología $300 / otros $50; Terapia (física/ocupacional/habla) $75/día; Radiología MRI/PET/CT/Mamografía/otras $600/$600/$300/$250. Medicamentos recetados (Rx) $50/día (máx. $750/año).',
      'Libertad de Red y Extras ManhattanLife: Sin períodos de espera ni restricción de red (descuentos First Health Network +1.5M centros), Telemedicina y Rx con descuento EasyCare2go, Green Imaging, DirectLabs y CareGuide (anexo opcional enfermedades críticas $250k/$500k disponible).'
    ]
  },
  elite_plus: {
    level: 'elite_plus',
    title: 'Affordable Choice Elite Plus',
    shortLabel: 'Elite Plus',
    tierLabel: 'Indemnización Fija Superior • Hospital $6,000/día ($0 Deducible)',
    moopLabel: 'Máx. Anual Hosp. $1,000,000 • Máx. Vitalicio $5,000,000 ($0 deducible)',
    pcpLabel: '$200/día consultorio (máx. 10 días/año; transf. hasta 5)',
    specialistLabel: '$200/día consultorio • Cirugía 3x Medicare (máx. $50k/año)',
    rxLabel: '$75/día Rx (máx. $750/año) + EasyCare2go',
    urgenciesLabel: '$300/día ER (2/año) • $300/día UC (4/año)',
    extraBenefitLabel:
      'Sin períodos de espera ni restricción de red (ahorros First Health +1.5M centros), Telemedicina EasyCare2go, Green Imaging, DirectLabs y CareGuide.',
    ratesByAge: {
      20: { empleado: 160.48, pareja: 304.39, hijos: 283.81, familiar: 449.21, solo_ninos: 194.49 },
      25: { empleado: 181.84, pareja: 342.54, hijos: 318.9, familiar: 505.19, solo_ninos: 194.49 },
      30: { empleado: 204.92, pareja: 392.85, hijos: 356.67, familiar: 565.33, solo_ninos: 194.49 },
      35: { empleado: 227.59, pareja: 435.43, hijos: 393.71, familiar: 624.24, solo_ninos: 194.49 },
      40: { empleado: 248.65, pareja: 474.58, hijos: 427.82, familiar: 678.23, solo_ninos: 194.49 },
      45: { empleado: 273.89, pareja: 521.25, hijos: 468.52, familiar: 742.46, solo_ninos: 194.49 },
      50: { empleado: 315.85, pareja: 597.96, hijos: 535.56, familiar: 847.67, solo_ninos: 194.49 },
      55: { empleado: 357.81, pareja: 674.67, hijos: 602.6, familiar: 952.88, solo_ninos: 194.49 },
      60: { empleado: 401.2, pareja: 753.89, hijos: 671.84, familiar: 1061.46, solo_ninos: 194.49 },
      64: { empleado: 440.29, pareja: 824.86, hijos: 733.94, familiar: 1158.58, solo_ninos: 194.49 }
    },
    bullets: [
      'Hospitalización y Emergencias (Pago Fijo desde Día 1): Admisión hospitalaria 1.er día $3,000 + Internación $6,000/día (por lesión sube +25%/año: Año 2 $7,500, Año 3 $9,000, Año 4 $10,500, Año 5 $12,000/día; límite $1,000,000/año y $5,000,000 vitalicio). Observación hospitalaria $3,000/día (24-47h) y $4,500/día (48h+). ER $300/día (2/año) | Urgencias (UC) $300/día (4/año). Ambulancia: terrestre $150 / aérea $1,500 (máx. 2/año).',
      'Cirugías y Cáncer: Cirugías (hosp. y amb.) pagan 3 veces el arancel Medicare (máx. $50,000/año) + Cirugía ambulatoria $3,000 + 20% cirujano asistente + 25% anestesiólogo. Beneficio por cáncer (radio/quimio/inmuno): $2,000/día (máx. 40 días/año).',
      'Consultas, Ambulatorios y Rx (máx. ambulatorio $8,000/año): Consultorio médico $200/día (máx. 10 días/año; transferencia de hasta 5 visitas). Preventivo: Colonoscopía $600, Pap $300, PSA $300. Lab patología $300 / otros $50; Terapia (física/ocupacional/habla) $75/día; Radiología MRI/PET/CT/Mamografía/otras $700/$700/$300/$250. Medicamentos recetados (Rx) $75/día (máx. $750/año).',
      'Libertad de Red y Extras ManhattanLife: Sin períodos de espera ni restricción de red (descuentos First Health Network +1.5M centros), Telemedicina y Rx con descuento EasyCare2go, Green Imaging, DirectLabs y CareGuide (anexo opcional enfermedades críticas $250k/$500k disponible).'
    ]
  }
};

export const detectClosestAffordableChoiceAge = (agesText: string): AffordableChoiceAge => {
  const ages = extractAgesArray(agesText);
  const adultAges = ages.filter(a => a >= 18);
  const ref = adultAges.length > 0 ? Math.max(...adultAges) : ages[0] || 30;
  let closest: AffordableChoiceAge = 30;
  let bestDiff = Infinity;
  for (const ageOpt of AFFORDABLE_CHOICE_AGES) {
    const diff = Math.abs(ageOpt - ref);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = ageOpt;
    }
  }
  return closest;
};

export const detectAffordableChoiceGroupKey = (
  membersText: string,
  agesText: string
): AffordableChoiceGroupKey => {
  const m = String(membersText || '').toLowerCase();
  if (m.includes('solo niño') || m.includes('solo nino') || m.includes('hijos solamente')) {
    return 'solo_ninos';
  }
  const famTier = detectEnrollFamilyTier(membersText, agesText);
  return famTier;
};

// ============================================================
// 2D. PRESIDIO HEALTHCARE • FORTRESS PLAN (SOLO EN TEXAS - TX)
// ============================================================

export const PRESIDIO_AVAILABLE_STATES = ['TX'];

export interface PresidioSpec {
  level: PresidioLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  deductibleLabel: string;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  sampleRateHint: string;
  extraBenefitLabel: string;
  bullets: string[];
}

export const PRESIDIO_SPECS: Record<PresidioLevel, PresidioSpec> = {
  elite2500: {
    level: 'elite2500',
    title: 'Presidio Fortress • Elite 2.5K (Solo TX)',
    shortLabel: 'Elite 2.5K',
    tierLabel: 'Elite 2.5K • Deducible $0 • 50% Coaseguro (Solo Texas)',
    deductibleLabel: '$0 Ind. / $0 Fam. ($5,000 si embarazo activo al contratar)',
    moopLabel: '$2,500 Ind. / $5,000 Fam. (MOOP separado Enfermedad y Accidente • 100% ilimitado post-MOOP)',
    pcpLabel: '50% Coaseguro en red First Health • Telemedicina 24/7 $0',
    specialistLabel: '50% Coaseguro sin referidos (hasta llegar a MOOP $2,500/$5,000)',
    rxLabel: 'Rx Valet 50% Día 1 (integrado al MOOP)',
    urgenciesLabel: '50% Coaseguro en red hasta alcanzar MOOP ($2,500 Ind. / $5,000 Fam.)',
    sampleRateHint: 'Ej. TX: $216/mes (30a), $446/mes (45a), $853/mes (Fam. 4)',
    extraBenefitLabel:
      'Disponible SOLO en Texas (TDI). $0 deducible + 50% coaseguro hasta MOOP + 100% ilimitado post-MOOP + 50% Rollover anual + Telemedicina $0 + Rx Valet.',
    bullets: [
      'Mecánica Financiera (Solo Texas • TDI): Deducible $0 (cubre desde el primer dólar), 50% coaseguro en red hasta alcanzar el MOOP de $2,500 Ind. / $5,000 Fam. (máximos separados para Enfermedad y Accidente; tope aprox. ~$5,000 facturas) y 100% ilimitado sin topes de días ni montos tras alcanzar el MOOP.',
      '50% Rollover Anual y Red First Health PPO: El 50% del MOOP no utilizado se transfiere como crédito para reducir el MOOP del año siguiente (hasta a la mitad si no se usa). Red First Health PPO (+993,000 médicos, +5,700 hospitales, sin referidos), Telemedicina 24/7 a $0 y Farmacia Rx Valet integrada al MOOP (50% Día 1 en genéricos, marca y especialidad).',
      'Arquitectura Bundle y Wellness Opcional: Combina póliza formal de Enfermedad + Accidente (regulado por TDI de Texas; no es Cost-Sharing ni ACA). Opción de agregar Rider de Wellness (+$19 a $75/mes aprox.: chequeo anual $200, mamografía $350, colonoscopía $1,100, pediatría hasta 7x $200, vacunas hasta 10x $70, lab hasta 3x $50).',
      'Reglas de Suscripción y Disponibilidad TX: Disponible exclusivamente en Texas (TX). Preexistencias no excluidas: espera de 12 meses en hospitalizaciones/eventos mayores (Rx al 50% desde el Día 1; embarazo activo al contratar tiene deducible de parto de $5,000 en 1.er año). No elegible con cáncer, infarto, diabetes 1/2, VIH, lupus, hepatitis B/C, insuficiencia renal/cardíaca o fumador >4 veces/mes.'
    ]
  },
  secure5000: {
    level: 'secure5000',
    title: 'Presidio Fortress • Secure 5K (Solo TX)',
    shortLabel: 'Secure 5K',
    tierLabel: 'Secure 5K • Deducible $0 • 50% Coaseguro (Solo Texas)',
    deductibleLabel: '$0 Ind. / $0 Fam. ($5,000 si embarazo activo al contratar)',
    moopLabel: '$5,000 Ind. / $10,000 Fam. (MOOP separado Enfermedad y Accidente • 100% ilimitado post-MOOP)',
    pcpLabel: '50% Coaseguro en red First Health • Telemedicina 24/7 $0',
    specialistLabel: '50% Coaseguro sin referidos (hasta llegar a MOOP $5,000/$10,000)',
    rxLabel: 'Rx Valet 50% Día 1 (integrado al MOOP)',
    urgenciesLabel: '50% Coaseguro en red hasta alcanzar MOOP ($5,000 Ind. / $10,000 Fam.)',
    sampleRateHint: 'Ej. TX: $189/mes (30a), $390/mes (45a), $746/mes (Fam. 4)',
    extraBenefitLabel:
      'Disponible SOLO en Texas (TDI). $0 deducible + 50% coaseguro hasta MOOP + 100% ilimitado post-MOOP + 50% Rollover anual + Telemedicina $0 + Rx Valet.',
    bullets: [
      'Mecánica Financiera (Solo Texas • TDI): Deducible $0 (cubre desde el primer dólar), 50% coaseguro en red hasta alcanzar el MOOP de $5,000 Ind. / $10,000 Fam. (máximos separados para Enfermedad y Accidente; tope aprox. ~$10,000 facturas) y 100% ilimitado sin topes de días ni montos tras alcanzar el MOOP.',
      '50% Rollover Anual y Red First Health PPO: El 50% del MOOP no utilizado se transfiere como crédito para reducir el MOOP del año siguiente (hasta a la mitad si no se usa). Red First Health PPO (+993,000 médicos, +5,700 hospitales, sin referidos), Telemedicina 24/7 a $0 y Farmacia Rx Valet integrada al MOOP (50% Día 1 en genéricos, marca y especialidad).',
      'Arquitectura Bundle y Wellness Opcional: Combina póliza formal de Enfermedad + Accidente (regulado por TDI de Texas; no es Cost-Sharing ni ACA). Opción de agregar Rider de Wellness (+$19 a $75/mes aprox.: chequeo anual $200, mamografía $350, colonoscopía $1,100, pediatría hasta 7x $200, vacunas hasta 10x $70, lab hasta 3x $50).',
      'Reglas de Suscripción y Disponibilidad TX: Disponible exclusivamente en Texas (TX). Preexistencias no excluidas: espera de 12 meses en hospitalizaciones/eventos mayores (Rx al 50% desde el Día 1; embarazo activo al contratar tiene deducible de parto de $5,000 en 1.er año). No elegible con cáncer, infarto, diabetes 1/2, VIH, lupus, hepatitis B/C, insuficiencia renal/cardíaca o fumador >4 veces/mes.'
    ]
  },
  value7500: {
    level: 'value7500',
    title: 'Presidio Fortress • Value 7.5K (Solo TX)',
    shortLabel: 'Value 7.5K',
    tierLabel: 'Value 7.5K • Deducible $0 • 50% Coaseguro (Solo Texas)',
    deductibleLabel: '$0 Ind. / $0 Fam. ($5,000 si embarazo activo al contratar)',
    moopLabel: '$7,500 Ind. / $15,000 Fam. (MOOP separado Enfermedad y Accidente • 100% ilimitado post-MOOP)',
    pcpLabel: '50% Coaseguro en red First Health • Telemedicina 24/7 $0',
    specialistLabel: '50% Coaseguro sin referidos (hasta llegar a MOOP $7,500/$15,000)',
    rxLabel: 'Rx Valet 50% Día 1 (integrado al MOOP)',
    urgenciesLabel: '50% Coaseguro en red hasta alcanzar MOOP ($7,500 Ind. / $15,000 Fam.)',
    sampleRateHint: 'Ej. TX: $171/mes (30a), $352/mes (45a), $674/mes (Fam. 4)',
    extraBenefitLabel:
      'Disponible SOLO en Texas (TDI). $0 deducible + 50% coaseguro hasta MOOP + 100% ilimitado post-MOOP + 50% Rollover anual + Telemedicina $0 + Rx Valet.',
    bullets: [
      'Mecánica Financiera (Solo Texas • TDI): Deducible $0 (cubre desde el primer dólar), 50% coaseguro en red hasta alcanzar el MOOP de $7,500 Ind. / $15,000 Fam. (máximos separados para Enfermedad y Accidente; tope aprox. ~$15,000 facturas) y 100% ilimitado sin topes de días ni montos tras alcanzar el MOOP.',
      '50% Rollover Anual y Red First Health PPO: El 50% del MOOP no utilizado se transfiere como crédito para reducir el MOOP del año siguiente (hasta a la mitad si no se usa). Red First Health PPO (+993,000 médicos, +5,700 hospitales, sin referidos), Telemedicina 24/7 a $0 y Farmacia Rx Valet integrada al MOOP (50% Día 1 en genéricos, marca y especialidad).',
      'Arquitectura Bundle y Wellness Opcional: Combina póliza formal de Enfermedad + Accidente (regulado por TDI de Texas; no es Cost-Sharing ni ACA). Opción de agregar Rider de Wellness (+$19 a $75/mes aprox.: chequeo anual $200, mamografía $350, colonoscopía $1,100, pediatría hasta 7x $200, vacunas hasta 10x $70, lab hasta 3x $50).',
      'Reglas de Suscripción y Disponibilidad TX: Disponible exclusivamente en Texas (TX). Preexistencias no excluidas: espera de 12 meses en hospitalizaciones/eventos mayores (Rx al 50% desde el Día 1; embarazo activo al contratar tiene deducible de parto de $5,000 en 1.er año). No elegible con cáncer, infarto, diabetes 1/2, VIH, lupus, hepatitis B/C, insuficiencia renal/cardíaca o fumador >4 veces/mes.'
    ]
  },
  essential10000: {
    level: 'essential10000',
    title: 'Presidio Fortress • Essential 10K (Solo TX)',
    shortLabel: 'Essential 10K',
    tierLabel: 'Essential 10K • Deducible $0 • 50% Coaseguro (Solo Texas)',
    deductibleLabel: '$0 Ind. / $0 Fam. ($5,000 si embarazo activo al contratar)',
    moopLabel: '$10,000 Ind. / $20,000 Fam. (MOOP separado Enfermedad y Accidente • 100% ilimitado post-MOOP)',
    pcpLabel: '50% Coaseguro en red First Health • Telemedicina 24/7 $0',
    specialistLabel: '50% Coaseguro sin referidos (hasta llegar a MOOP $10,000/$20,000)',
    rxLabel: 'Rx Valet 50% Día 1 (integrado al MOOP)',
    urgenciesLabel: '50% Coaseguro en red hasta alcanzar MOOP ($10,000 Ind. / $20,000 Fam.)',
    sampleRateHint: 'Ej. TX: $156/mes (30a), $323/mes (45a), $617/mes (Fam. 4)',
    extraBenefitLabel:
      'Disponible SOLO en Texas (TDI). $0 deducible + 50% coaseguro hasta MOOP + 100% ilimitado post-MOOP + 50% Rollover anual + Telemedicina $0 + Rx Valet.',
    bullets: [
      'Mecánica Financiera (Solo Texas • TDI): Deducible $0 (cubre desde el primer dólar), 50% coaseguro en red hasta alcanzar el MOOP de $10,000 Ind. / $20,000 Fam. (máximos separados para Enfermedad y Accidente; tope aprox. ~$20,000 facturas) y 100% ilimitado sin topes de días ni montos tras alcanzar el MOOP.',
      '50% Rollover Anual y Red First Health PPO: El 50% del MOOP no utilizado se transfiere como crédito para reducir el MOOP del año siguiente (hasta a la mitad si no se usa). Red First Health PPO (+993,000 médicos, +5,700 hospitales, sin referidos), Telemedicina 24/7 a $0 y Farmacia Rx Valet integrada al MOOP (50% Día 1 en genéricos, marca y especialidad).',
      'Arquitectura Bundle y Wellness Opcional: Combina póliza formal de Enfermedad + Accidente (regulado por TDI de Texas; no es Cost-Sharing ni ACA). Opción de agregar Rider de Wellness (+$19 a $75/mes aprox.: chequeo anual $200, mamografía $350, colonoscopía $1,100, pediatría hasta 7x $200, vacunas hasta 10x $70, lab hasta 3x $50).',
      'Reglas de Suscripción y Disponibilidad TX: Disponible exclusivamente en Texas (TX). Preexistencias no excluidas: espera de 12 meses en hospitalizaciones/eventos mayores (Rx al 50% desde el Día 1; embarazo activo al contratar tiene deducible de parto de $5,000 en 1.er año). No elegible con cáncer, infarto, diabetes 1/2, VIH, lupus, hepatitis B/C, insuficiencia renal/cardíaca o fumador >4 veces/mes.'
    ]
  }
};

// ============================================================
// BMI-PHCS (BASIC / VALUE / ADVANTAGE • RED PHCS)
// ============================================================

export interface BmiPhcsSpec {
  level: BmiPhcsLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  rates: Record<EnrollFamilyTier, number>;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  bullets: string[];
}

export const BMI_PHCS_SPECS: Record<BmiPhcsLevel, BmiPhcsSpec> = {
  classic: {
    level: 'classic',
    title: 'BMI-PHCS Classic (MEC · Red PHCS)',
    shortLabel: 'Classic',
    tierLabel: 'BMI-PHCS Classic (MEC Option) • Red PHCS ($0 Deducible)',
    rates: { empleado: 125, pareja: 178.33, hijos: 178.33, familiar: 231.67 },
    moopLabel: 'N/A (MEC Básico)',
    pcpLabel: 'No cubierto (Preventivo & Telemedicina $0 ilimitada)',
    specialistLabel: 'No cubierto',
    rxLabel: 'Preventivo genérico $0 (No preventivo no cubierto)',
    urgenciesLabel: 'Telemedicina $0 ilimitada • Urgent Care no cubierto',
    bullets: [
      'Aviso Oficial del Plan (MEC Options): Plan bajo Red PHCS administrado por MBA Employee Benefits (no es seguro médico mayor tradicional). Deducible $0 Ind. / $0 Fam. Máximo Fuera de Bolsillo: N/A.',
      'Preventivo y Telemedicina: Cuidado Preventivo y Bienestar (no hospitalario) Incluido ($0). Telemedicina $0 copago ilimitada. Médico Primario (PCP), Especialista (incl. salud mental), Urgent Care, Laboratorio/Radiología y CT/MRI/MRA/PET Scan: No cubiertos.',
      'Hospital, Cirugía y Farmacia: Servicios ambulatorios en hospital o centro quirúrgico, anestesia y segunda opinión quirúrgica: No cubiertos. Farmacia (sujeto a formulario): Genéricos preventivos $0 copago (medicamentos no preventivos no cubiertos).'
    ]
  },
  choice: {
    level: 'choice',
    title: 'BMI-PHCS Choice (MEC · Red PHCS)',
    shortLabel: 'Choice',
    tierLabel: 'BMI-PHCS Choice (MEC Option) • Red PHCS ($0 Deducible)',
    rates: { empleado: 205, pareja: 285, hijos: 285, familiar: 391.67 },
    moopLabel: '$8,700 Individual / $17,400 Familiar',
    pcpLabel: '$35 copago (no hosp.) + Preventivo incluido',
    specialistLabel: '$75 copago (no hosp., incl. salud mental)',
    rxLabel: 'Preventivo $0 / Genérico no prev. $5 copago',
    urgenciesLabel: 'Urgent Care $85 copago • Telemedicina $0 ilimitada',
    bullets: [
      'Aviso Oficial del Plan (MEC Options): Plan bajo Red PHCS administrado por MBA Employee Benefits (no es seguro médico mayor tradicional). Deducible $0 Ind. / $0 Fam. Máximo Fuera de Bolsillo: $8,700 Ind. / $17,400 Fam.',
      'Preventivo, Consultas y Diagnóstico: Preventivo y Bienestar (no hosp.) Incluido. Médico Primario (PCP) $35 copago. Especialista (incl. salud mental) $75 copago. Urgent Care $85 copago. Telemedicina $0 copago ilimitada. Laboratorio y Radiología (no hosp.) $50 copago. CT/MRI/MRA/PET Scan (no hosp., preautorización) $500 copago (3/año).',
      'Hospital, Cirugía y Farmacia: Servicios ambulatorios en hospital o centro quirúrgico, anestesia y segunda opinión quirúrgica: No cubiertos. Farmacia (sujeto a formulario): Genéricos preventivos $0 copago y Genéricos no preventivos (retail) $5 copago.'
    ]
  },
  basic: {
    level: 'basic',
    title: 'BMI-PHCS Basic (Red PHCS)',
    shortLabel: 'Basic',
    tierLabel: 'BMI-PHCS Basic • Beneficio Limitado por Día ($0 Deducible)',
    rates: { empleado: 583.51, pareja: 925.24, hijos: 818.8, familiar: 1160.54 },
    moopLabel: '$8,700 Individual / $17,400 Familiar',
    pcpLabel: '$25 copago (8 visitas/año)',
    specialistLabel: '$50 copago (8 visitas/año, incl. salud mental)',
    rxLabel: 'Preventivo $0 / Genérico no prev. $5 (Marca no cubierta)',
    urgenciesLabel: 'UC $50 (2/año) • Telemedicina $0 • ER $350 (1/año)',
    bullets: [
      'Aviso Oficial del Plan: Plan de beneficio limitado por día bajo Red PHCS (no es seguro médico mayor tradicional). Deducible $0 Ind. / $0 Fam. Máximo de Bolsillo: $8,700 Ind. / $17,400 Fam. (el máximo de bolsillo no elimina los topes de días ni habilita beneficios no cubiertos).',
      'Ambulatorio y Diagnóstico: Médico Primario (PCP) $25 copago (8 visitas/año). Especialista (incl. salud mental) $50 copago (8 visitas/año). Urgent Care $50 (2 v/año) / Telemedicina $0 ilimitada. Laboratorio y Radiología $50 copago (3 visitas/año). CT/MRI/MRA/PET (no hosp.) $350 copago (1 al año).',
      'Hospitalización, Cirugía y Emergencias: Hospitalización por admisión $350 copago (máx. 5 días/año). Cirugía internado incluida (2/año) / Ambulatoria $350 (1/año). Sala de Emergencias $350 (1 v/año) / Ambulancia $250 (1 v/año). Segunda Opinión Quirúrgica $0 copago. Maternidad y rehabilitación: No cubiertas.'
    ]
  },
  value: {
    level: 'value',
    title: 'BMI-PHCS Value (Red PHCS)',
    shortLabel: 'Value',
    tierLabel: 'BMI-PHCS Value • Beneficio Limitado por Día ($0 Deducible)',
    rates: { empleado: 644.12, pareja: 1058.6, hijos: 927.93, familiar: 1342.39 },
    moopLabel: '$5,000 Individual / $10,000 Familiar',
    pcpLabel: '$15 copago (10 visitas/año)',
    specialistLabel: '$25 copago (10 visitas/año, incl. salud mental)',
    rxLabel: 'Preventivo $0 / Genérico no prev. $5 (Marca no cubierta)',
    urgenciesLabel: 'UC $35 (3/año) • Telemedicina $0 • ER $350 (1/año)',
    bullets: [
      'Aviso Oficial del Plan: Plan de beneficio limitado por día bajo Red PHCS (no es seguro médico mayor tradicional). Deducible $0 Ind. / $0 Fam. Máximo de Bolsillo: $5,000 Ind. / $10,000 Fam. (el máximo de bolsillo no elimina los topes de días).',
      'Ambulatorio y Diagnóstico: Médico Primario (PCP) $15 copago (10 visitas/año). Especialista (incl. salud mental) $25 copago (10 visitas/año). Urgent Care $35 (3 v/año) / Telemedicina $0 ilimitada. Laboratorio y Radiología $50 copago (3 visitas/año). CT/MRI/MRA/PET (no hosp.) $350 copago (2 al año).',
      'Hospitalización, Cirugía y Maternidad: Hospitalización por admisión $350 copago (máx. 7 días/año). Cirugía internado incluida (3/año) / Ambulatoria $350 (2/año). Sala de Emergencias $350 (1 v/año) / Ambulancia $250 (1 v/año). Segunda Opinión Quirúrgica $0 copago. Maternidad: $350 (espera 12 meses). Rehabilitación no incluida.'
    ]
  },
  advantage: {
    level: 'advantage',
    title: 'BMI-PHCS Advantage (Red PHCS)',
    shortLabel: 'Advantage',
    tierLabel: 'BMI-PHCS Advantage • Beneficio Limitado por Día ($0 Deducible)',
    rates: { empleado: 691.45, pareja: 1138.1, hijos: 989.21, familiar: 1435.86 },
    moopLabel: '$5,000 Individual / $10,000 Familiar',
    pcpLabel: '$15 copago (12 visitas/año)',
    specialistLabel: '$25 copago (12 visitas/año, incl. salud mental)',
    rxLabel: 'Preventivo $0 / Genérico no prev. $5 (Marca no cubierta)',
    urgenciesLabel: 'UC $35 (3/año) • Telemedicina $0 • ER $350 (2/año)',
    bullets: [
      'Aviso Oficial del Plan: Plan de beneficio limitado por día bajo Red PHCS (no es seguro médico mayor tradicional). Deducible $0 Ind. / $0 Fam. Máximo de Bolsillo: $5,000 Ind. / $10,000 Fam.',
      'Ambulatorio y Diagnóstico: Médico Primario (PCP) $15 copago (12 visitas/año). Especialista (incl. salud mental) $25 copago (12 visitas/año). Urgent Care $35 (3 v/año) / Telemedicina $0 ilimitada. Laboratorio y Radiología $50 copago (4 visitas/año). CT/MRI/MRA/PET (no hosp.) $350 copago (3 al año).',
      'Hospitalización, Cirugía y Rehabilitación: Hospitalización por admisión $350 copago (máx. 10 días/año). Cirugía internado incluida (4/año) / Ambulatoria $350 (2/año). Sala de Emergencias $350 (2 v/año) / Ambulancia $250 (2 v/año). Segunda Opinión Quirúrgica $0 copago. Rehabilitación incluida ($50/día, 12 visitas).'
    ]
  }
};

// ============================================================
// 6. AFI MAJOR MEDICAL (3500 HSA VS 3500 COPAY)
// ============================================================

export interface AfiSpec {
  level: AfiLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  rates: Record<EnrollFamilyTier, number>;
  deductibleLabel: string;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  bullets: string[];
}

export const AFI_SPECS: Record<AfiLevel, AfiSpec> = {
  hsa3500: {
    level: 'hsa3500',
    title: 'AFI Major Medical 3500 HSA',
    shortLabel: '3500 HSA',
    tierLabel: 'Major Medical Tradicional • Deducible $3,500/$7,000 • 30% Coaseguro',
    rates: { empleado: 685.81, pareja: 1307.57, hijos: 1189.78, familiar: 1805.5 },
    deductibleLabel: '$3,500 Ind. / $7,000 Fam.',
    moopLabel: '$8,500 Ind. / $17,000 Fam.',
    pcpLabel: 'Deducible + 30% coaseguro (Preventivo $0)',
    specialistLabel: 'Deducible + 30% coaseguro',
    rxLabel: 'Deducible + 30% coaseguro',
    urgenciesLabel: 'Deducible + 30% coaseguro (MYMDNOW $0)',
    bullets: [
      'Estructura Major Medical HSA (Dentro de Red): Deducible $3,500 Individual / $7,000 Familiar. Coaseguro tras deducible: Miembro 30% · Plan 70%. Máximo de Bolsillo: $8,500 Ind. / $17,000 Fam. Cargo único de solicitud: $75.00 al aplicar.',
      'Servicios Cubiertos: Cuidado Preventivo y Telemedicina (MYMDNOW) $0 / $0. Médico primario, Especialista, Urgent Care, Laboratorio, Imágenes avanzadas, Hospitalización, Cirugía, Emergencia/Ambulancia y Farmacia: aplican Deducible + 30% coaseguro en casi todas las categorías.',
      'Atención a Autorizaciones: Omitir preautorizaciones en cirugías o internaciones puede causar una reducción de hasta el 50% de los cargos permitidos o negación.'
    ]
  },
  copay3500: {
    level: 'copay3500',
    title: 'AFI Major Medical 3500 Copay',
    shortLabel: '3500 Copay',
    tierLabel: 'Major Medical Tradicional • Deducible $3,500/$7,000 • 20% Coaseguro',
    rates: { empleado: 815.44, pareja: 1460.45, hijos: 1427.43, familiar: 2096.72 },
    deductibleLabel: '$3,500 Ind. / $7,000 Fam.',
    moopLabel: '$10,600 Ind. / $21,200 Fam.',
    pcpLabel: '$40 Copago directo (Preventivo $0)',
    specialistLabel: '$75 Copago directo',
    rxLabel: 'Prev $0 / Mant $20 / Marca $65 / Esp $200',
    urgenciesLabel: '$90 UC • $1,000 ER / $250 Amb.',
    bullets: [
      'Estructura Major Medical Copay (Dentro de Red): Deducible $3,500 Individual / $7,000 Familiar. Coaseguro tras deducible: Miembro 20% · Plan 80%. Máximo de Bolsillo: $10,600 Ind. / $21,200 Fam. Cargo único de solicitud: $75.00 al aplicar.',
      'Consultas, Diagnóstico y Emergencias: Preventivo / Telemedicina (MYMDNOW) $0 / $0. Médico Primario $40 / Especialista $75 (copago directo). Urgent Care $90 / Laboratorio $25. Imágenes avanzadas $200 copago. Hospitalización y Cirugía: Deducible + 20% coaseguro. Emergencia / Ambulancia terrestre: $1,000 / $250.',
      'Farmacia, Maternidad y Preautorizaciones: Farmacia: Genéricos preventivos $0, mantenimiento $20, marca preferida $65, especialidad $200. Maternidad: Parto $1,500/admisión, consultas $75, laboratorio $25. Omitir preautorizaciones en cirugías/internaciones puede reducir hasta 50% los cargos permitidos o causar negación.'
    ]
  }
};

// ============================================================
// 7. ACUSA • VAULT HEALTH PLAN (BRONZE 2 VS SILVER 2 - GUARANTEED ISSUE)
// ============================================================

export interface AcusaSpec {
  level: AcusaLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  rates: Record<EnrollFamilyTier, number>;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  urgenciesLabel: string;
  bullets: string[];
}

export const ACUSA_SPECS: Record<AcusaLevel, AcusaSpec> = {
  bronze2: {
    level: 'bronze2',
    title: 'ACUSA Vault Health Plan — Bronze 2',
    shortLabel: 'Bronze 2',
    tierLabel: 'Guaranteed Issue (MEC & MVP) • $0 Deducible + 50% Coaseguro',
    rates: { empleado: 725.35, pareja: 999.24, hijos: 932.88, familiar: 1331.72 },
    moopLabel: '$10,500 Individual / $21,000 Familiar',
    pcpLabel: '$25 (8 visitas/año)',
    specialistLabel: '$50 (8 visitas/año)',
    urgenciesLabel: 'UC $50 (2 visitas) • Telemedicina $0 • ER 50% (1/año)',
    bullets: [
      'Emisión Garantizada (Vault Health Plan): Deducible $0 Ind. / $0 Fam. Máximo de Bolsillo: $10,500 Ind. / $21,000 Fam. Application Fee único: $75.00 al registrarse. Incluye Clever Health (Telehealth 24/7 + Virtual Vet) & Benefits Hero App.',
      'Consultas y Estudios: Médico Primario $25 (8 v/año) / Especialista $50 (8 v/año). Urgent Care $50 (2 visitas) / Telemedicina $0 Consult Fee. Laboratorio $50 (3 v/año) / Imágenes Avanzadas $350 CT/MRI (1/año).',
      'Hospitalización, Cirugía y Maternidad: Hospitalización & Cirugía Internado 50% Coaseguro (máx. 5 días, 2 cirugías). Cirugía Ambulatoria 50% Coas. (1/año) / Emergencia ER 50% (1/año). Maternidad y Parto: No cubierto en Bronze 2.'
    ]
  },
  silver2: {
    level: 'silver2',
    title: 'ACUSA Vault Health Plan — Silver 2',
    shortLabel: 'Silver 2',
    tierLabel: 'Guaranteed Issue (MEC & MVP) • $0 Deducible + 50% Coaseguro',
    rates: { empleado: 887.96, pareja: 1158.04, hijos: 1067.63, familiar: 1536.9 },
    moopLabel: '$10,500 Individual / $21,000 Familiar',
    pcpLabel: '$15 (10 visitas/año)',
    specialistLabel: '$25 (10 visitas/año)',
    urgenciesLabel: 'UC $35 (3 visitas) • Telemedicina $0 • ER 50% (1/año)',
    bullets: [
      'Emisión Garantizada (Vault Health Plan): Deducible $0 Ind. / $0 Fam. Máximo de Bolsillo: $10,500 Ind. / $21,000 Fam. Application Fee único: $75.00 al registrarse. Incluye Clever Health (Telehealth 24/7 + Virtual Vet) & Benefits Hero App.',
      'Consultas y Estudios: Médico Primario $15 (10 v/año) / Especialista $25 (10 v/año). Urgent Care $35 (3 visitas) / Telemedicina $0 Consult Fee. Laboratorio $50 (3 v/año) / Imágenes Avanzadas $350 CT/MRI (2/año).',
      'Hospitalización, Cirugía y Maternidad: Hospitalización & Cirugía Internado 50% Coaseguro (máx. 7 días, 3 cirugías). Cirugía Ambulatoria 50% Coas. (2/año) / Emergencia ER 50% (1/año). Maternidad y Parto: Cubierto al 50% Coaseguro (Facilidad & Parto).'
    ]
  }
};

// ============================================================
// 7B. PREMIER MAJOR MEDICAL (2500 / 5000 / 7500 • RED CIGNA PPO)
// ============================================================

export interface PremierMmSpec {
  level: PremierMmLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  inDeductibleLabel: string;
  oonDeductibleLabel: string;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  rates: Record<MedMaxAgeBracket, Record<EnrollFamilyTier, number>>;
  bullets: string[];
}

export const PREMIER_MM_SPECS: Record<PremierMmLevel, PremierMmSpec> = {
  mm2500: {
    level: 'mm2500',
    title: 'Premier Major Medical 2500',
    shortLabel: '2500',
    tierLabel: 'Major Medical (Red Cigna PPO) • Deducible $2,500/$5,000 • 20% Coaseguro',
    inDeductibleLabel: '$2,500 Ind. / $5,000 Fam.',
    oonDeductibleLabel: '$5,000 Ind. / $10,000 Fam.',
    moopLabel: '$10,600 Ind. / $21,200 Fam. (OON $21,200/$42,400)',
    pcpLabel: '$40 Copago (Preventivo $0)',
    specialistLabel: '$75 Copago',
    rxLabel: 'Prev Gen $0 / Mant $20 / Marca $65 / No-Pref $95 / Esp $200',
    urgenciesLabel: 'UC $90 • ER $1,000 • Amb. Terrestre $250',
    rates: {
      '18-29': { empleado: 689.99, pareja: 1199.99, hijos: 1199.99, familiar: 1699.99 },
      '30-44': { empleado: 699.99, pareja: 1274.99, hijos: 1199.99, familiar: 1749.99 },
      '45-54': { empleado: 749.99, pareja: 1299.99, hijos: 1249.99, familiar: 1799.99 },
      '55-64': { empleado: 849.99, pareja: 1499.99, hijos: 1374.99, familiar: 2099.99 }
    },
    bullets: [
      'Red Cigna PPO y Estructura Major Medical (2500): Deducible Dentro de Red $2,500 Ind. / $5,000 Fam. (Fuera de Red $5,000/$10,000). Coaseguro tras deducible: 20% IN / 50% OON. Máximo de Bolsillo: $10,600 Ind. / $21,200 Fam. (OON $21,200/$42,400). Vigencia 01/01/2027 - 12/31/2027.',
      'Consultas, Diagnóstico y Emergencias: Preventivo $0 (sin deducible). Médico Primario $40 / Especialista y Salud Mental amb. $75. Urgent Care $90 / Lab. independiente $25 / Rayos X centro ind. $50 / Imágenes avanzadas (CT/PET/MRI) $200 (preaut.). Emergencia ER $1,000 / Ambulancia terrestre $250.',
      'Hospitalización, Cirugía, Maternidad y Farmacia: Hospitalización deducible + 20% coaseguro (médico asociado $250/serv.); Cirugía ambulatoria ASC $2,500 facilidad + $250 cirujano (preaut.). Maternidad: consultas $75 / parto facilidad $1,500 tras deducible + prof. ded. y coas. Rx (30d red): Prev. Genérico $0 / Mant. Genérico $20 / Marca Pref. $65 / No-Pref. $95 / Especialidad $200.'
    ]
  },
  mm5000: {
    level: 'mm5000',
    title: 'Premier Major Medical 5000',
    shortLabel: '5000',
    tierLabel: 'Major Medical (Red Cigna PPO) • Deducible $5,000/$10,000 • 20% Coaseguro',
    inDeductibleLabel: '$5,000 Ind. / $10,000 Fam.',
    oonDeductibleLabel: '$10,000 Ind. / $20,000 Fam.',
    moopLabel: '$10,600 Ind. / $21,200 Fam. (OON $21,200/$42,400)',
    pcpLabel: '$40 Copago (Preventivo $0)',
    specialistLabel: '$75 Copago',
    rxLabel: 'Prev Gen $0 / Mant $20 / Marca $65 / No-Pref $95 / Esp $200',
    urgenciesLabel: 'UC $90 • ER $1,000 • Amb. Terrestre $250',
    rates: {
      '18-29': { empleado: 599.99, pareja: 1099.99, hijos: 999.99, familiar: 1499.99 },
      '30-44': { empleado: 624.99, pareja: 1124.99, hijos: 1024.99, familiar: 1549.99 },
      '45-54': { empleado: 649.99, pareja: 1199.99, hijos: 1049.99, familiar: 1599.99 },
      '55-64': { empleado: 699.99, pareja: 1249.99, hijos: 1149.99, familiar: 1699.99 }
    },
    bullets: [
      'Red Cigna PPO y Estructura Major Medical (5000): Deducible Dentro de Red $5,000 Ind. / $10,000 Fam. (Fuera de Red $10,000/$20,000). Coaseguro tras deducible: 20% IN / 50% OON. Máximo de Bolsillo: $10,600 Ind. / $21,200 Fam. (OON $21,200/$42,400). Vigencia 01/01/2027 - 12/31/2027.',
      'Consultas, Diagnóstico y Emergencias: Preventivo $0 (sin deducible). Médico Primario $40 / Especialista y Salud Mental amb. $75. Urgent Care $90 / Lab. independiente $25 / Rayos X centro ind. $50 / Imágenes avanzadas (CT/PET/MRI) $200 (preaut.). Emergencia ER $1,000 / Ambulancia terrestre $250.',
      'Hospitalización, Cirugía, Maternidad y Farmacia: Hospitalización deducible + 20% coaseguro (médico asociado $250/serv.); Cirugía ambulatoria ASC $2,500 facilidad + $250 cirujano (preaut.). Maternidad: consultas $75 / parto facilidad $1,500 tras deducible + prof. ded. y coas. Rx (30d red): Prev. Genérico $0 / Mant. Genérico $20 / Marca Pref. $65 / No-Pref. $95 / Especialidad $200.'
    ]
  },
  mm7500: {
    level: 'mm7500',
    title: 'Premier Major Medical 7500',
    shortLabel: '7500',
    tierLabel: 'Major Medical (Red Cigna PPO) • Deducible $7,500/$15,000 • 20% Coaseguro',
    inDeductibleLabel: '$7,500 Ind. / $15,000 Fam.',
    oonDeductibleLabel: '$15,000 Ind. / $30,000 Fam.',
    moopLabel: '$10,600 Ind. / $21,200 Fam. (OON $21,200/$42,400)',
    pcpLabel: '$40 Copago (Preventivo $0)',
    specialistLabel: '$75 Copago',
    rxLabel: 'Prev Gen $0 / Mant $20 / Marca $65 / No-Pref $95 / Esp $200',
    urgenciesLabel: 'UC $90 • ER $1,000 • Amb. Terrestre $250',
    rates: {
      '18-29': { empleado: 499.99, pareja: 899.99, hijos: 829.99, familiar: 1199.99 },
      '30-44': { empleado: 524.99, pareja: 949.99, hijos: 849.99, familiar: 1249.99 },
      '45-54': { empleado: 549.99, pareja: 999.99, hijos: 899.99, familiar: 1299.99 },
      '55-64': { empleado: 599.99, pareja: 1049.99, hijos: 949.99, familiar: 1399.99 }
    },
    bullets: [
      'Red Cigna PPO y Estructura Major Medical (7500): Deducible Dentro de Red $7,500 Ind. / $15,000 Fam. (Fuera de Red $15,000/$30,000). Coaseguro tras deducible: 20% IN / 50% OON. Máximo de Bolsillo: $10,600 Ind. / $21,200 Fam. (OON $21,200/$42,400). Vigencia 01/01/2027 - 12/31/2027.',
      'Consultas, Diagnóstico y Emergencias: Preventivo $0 (sin deducible). Médico Primario $40 / Especialista y Salud Mental amb. $75. Urgent Care $90 / Lab. independiente $25 / Rayos X centro ind. $50 / Imágenes avanzadas (CT/PET/MRI) $200 (preaut.). Emergencia ER $1,000 / Ambulancia terrestre $250.',
      'Hospitalización, Cirugía, Maternidad y Farmacia: Hospitalización deducible + 20% coaseguro (médico asociado $250/serv.); Cirugía ambulatoria ASC $2,500 facilidad + $250 cirujano (preaut.). Maternidad: consultas $75 / parto facilidad $1,500 tras deducible + prof. ded. y coas. Rx (30d red): Prev. Genérico $0 / Mant. Genérico $20 / Marca Pref. $65 / No-Pref. $95 / Especialidad $200.'
    ]
  }
};

// ============================================================
// 7C. PREMIER MAX (1000 / 2000 / 3000 • PHCS OR FIRST HEALTH PPO)
// ============================================================

export interface PremierMaxSpec {
  level: PremierMaxLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  inDeductibleLabel: string;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  rates: Record<MedMaxAgeBracket, Record<EnrollFamilyTier, number>>;
  bullets: string[];
}

export const PREMIER_MAX_SPECS: Record<PremierMaxLevel, PremierMaxSpec> = {
  max1000: {
    level: 'max1000',
    title: 'Premier Max 1000',
    shortLabel: '1000',
    tierLabel: 'PHCS o First Health PPO • Deducible $1,000/$2,000 • Límites de Visitas',
    inDeductibleLabel: '$1,000 Ind. / $2,000 Fam.',
    moopLabel: '$10,600 Ind. / $21,200 Fam. (Ilimitado fuera de límites)',
    pcpLabel: '$50 Copago (10 v/año comb. PCP/Esp./UC)',
    specialistLabel: '$50 Copago (en límite comb. 10 v/año)',
    rxLabel: 'Prev Gen $0 / Genérico $0 tras ded. (Marca/Esp. no cub.)',
    urgenciesLabel: 'UC $50 • ER $1,000 tras ded. (4/año) • Amb. $500 tras ded.',
    rates: {
      '18-29': { empleado: 319.99, pareja: 579.99, hijos: 569.99, familiar: 839.99 },
      '30-44': { empleado: 324.99, pareja: 639.99, hijos: 619.99, familiar: 899.99 },
      '45-54': { empleado: 374.99, pareja: 709.99, hijos: 689.99, familiar: 969.99 },
      '55-64': { empleado: 399.99, pareja: 759.99, hijos: 739.99, familiar: 999.99 }
    },
    bullets: [
      'Red PHCS o First Health PPO (Premier Max 1000): Deducible IN $1,000 Ind. / $2,000 Fam. Máximo de Bolsillo IN: $10,600 Ind. / $21,200 Fam. (ilimitado fuera de límites de visitas; OON no cubierto salvo emergencia real). Vigencia 01/01/2027 - 12/31/2027.',
      'Consultas, Diagnóstico y Emergencias: Preventivo $0 (sin ded.). Primario, Especialista y Urgent Care $50 (10 v/año comb.). Lab. ind. $25 (3/año) / Rayos X $50 tras ded. (3/año) / Imágenes CT-PET-MRI $200 tras ded. (3/año, preaut.). ER $1,000 tras ded. (2 acc. + 2 enf./año) / Ambulancia $500 tras ded. (2/año).',
      'Hospital, Cirugía, Maternidad y Farmacia: Hospitalización $2,500/admisión tras ded. (3 UCI + 2 no-UCI, máx. 10d; médico asoc. $250/serv., cirugía int. $2,500, preaut.). Cirugía amb. ASC $2,500 tras ded. + $250 cirujano (2/año). Maternidad: visitas 100% tras ded., parto $2,500 tras ded. Rx (30d): Genérico prev. $0 / genérico $0 tras ded. (Marca/Esp. no cub., disp. Patient Assistance).'
    ]
  },
  max2000: {
    level: 'max2000',
    title: 'Premier Max 2000',
    shortLabel: '2000',
    tierLabel: 'PHCS o First Health PPO • Deducible $2,000/$4,000 • Límites de Visitas',
    inDeductibleLabel: '$2,000 Ind. / $4,000 Fam.',
    moopLabel: '$10,600 Ind. / $21,200 Fam. (Ilimitado fuera de límites)',
    pcpLabel: '$50 Copago (10 v/año comb. PCP/Esp./UC)',
    specialistLabel: '$50 Copago (en límite comb. 10 v/año)',
    rxLabel: 'Prev Gen $0 / Genérico $0 tras ded. (Marca/Esp. no cub.)',
    urgenciesLabel: 'UC $50 • ER $1,000 tras ded. (4/año) • Amb. $500 tras ded.',
    rates: {
      '18-29': { empleado: 309.99, pareja: 559.99, hijos: 539.99, familiar: 819.99 },
      '30-44': { empleado: 319.99, pareja: 619.99, hijos: 599.99, familiar: 879.99 },
      '45-54': { empleado: 359.99, pareja: 689.99, hijos: 669.99, familiar: 949.99 },
      '55-64': { empleado: 379.99, pareja: 739.99, hijos: 719.99, familiar: 979.99 }
    },
    bullets: [
      'Red PHCS o First Health PPO (Premier Max 2000): Deducible IN $2,000 Ind. / $4,000 Fam. Máximo de Bolsillo IN: $10,600 Ind. / $21,200 Fam. (ilimitado fuera de límites de visitas; OON no cubierto salvo emergencia real). Vigencia 01/01/2027 - 12/31/2027.',
      'Consultas, Diagnóstico y Emergencias: Preventivo $0 (sin ded.). Primario, Especialista y Urgent Care $50 (10 v/año comb.). Lab. ind. $25 (3/año) / Rayos X $50 tras ded. (3/año) / Imágenes CT-PET-MRI $200 tras ded. (3/año, preaut.). ER $1,000 tras ded. (2 acc. + 2 enf./año) / Ambulancia $500 tras ded. (2/año).',
      'Hospital, Cirugía, Maternidad y Farmacia: Hospitalización $2,500/admisión tras ded. (3 UCI + 2 no-UCI, máx. 10d; médico asoc. $250/serv., cirugía int. $2,500, preaut.). Cirugía amb. ASC $2,500 tras ded. + $250 cirujano (2/año). Maternidad: visitas 100% tras ded., parto $2,500 tras ded. Rx (30d): Genérico prev. $0 / genérico $0 tras ded. (Marca/Esp. no cub., disp. Patient Assistance).'
    ]
  },
  max3000: {
    level: 'max3000',
    title: 'Premier Max 3000',
    shortLabel: '3000',
    tierLabel: 'PHCS o First Health PPO • Deducible $3,000/$6,000 • Límites de Visitas',
    inDeductibleLabel: '$3,000 Ind. / $6,000 Fam.',
    moopLabel: '$10,600 Ind. / $21,200 Fam. (Ilimitado fuera de límites)',
    pcpLabel: '$50 Copago (10 v/año comb. PCP/Esp./UC)',
    specialistLabel: '$50 Copago (en límite comb. 10 v/año)',
    rxLabel: 'Prev Gen $0 / Genérico $0 tras ded. (Marca/Esp. no cub.)',
    urgenciesLabel: 'UC $50 • ER $1,000 tras ded. (4/año) • Amb. $500 tras ded.',
    rates: {
      '18-29': { empleado: 299.99, pareja: 539.99, hijos: 519.99, familiar: 799.99 },
      '30-44': { empleado: 309.99, pareja: 599.99, hijos: 579.99, familiar: 859.99 },
      '45-54': { empleado: 349.99, pareja: 669.99, hijos: 649.99, familiar: 929.99 },
      '55-64': { empleado: 369.99, pareja: 719.99, hijos: 699.99, familiar: 959.99 }
    },
    bullets: [
      'Red PHCS o First Health PPO (Premier Max 3000): Deducible IN $3,000 Ind. / $6,000 Fam. Máximo de Bolsillo IN: $10,600 Ind. / $21,200 Fam. (ilimitado fuera de límites de visitas; OON no cubierto salvo emergencia real). Vigencia 01/01/2027 - 12/31/2027.',
      'Consultas, Diagnóstico y Emergencias: Preventivo $0 (sin ded.). Primario, Especialista y Urgent Care $50 (10 v/año comb.). Lab. ind. $25 (3/año) / Rayos X $50 tras ded. (3/año) / Imágenes CT-PET-MRI $200 tras ded. (3/año, preaut.). ER $1,000 tras ded. (2 acc. + 2 enf./año) / Ambulancia $500 tras ded. (2/año).',
      'Hospital, Cirugía, Maternidad y Farmacia: Hospitalización $2,500/admisión tras ded. (3 UCI + 2 no-UCI, máx. 10d; médico asoc. $250/serv., cirugía int. $2,500, preaut.). Cirugía amb. ASC $2,500 tras ded. + $250 cirujano (2/año). Maternidad: visitas 100% tras ded., parto $2,500 tras ded. Rx (30d): Genérico prev. $0 / genérico $0 tras ded. (Marca/Esp. no cub., disp. Patient Assistance).'
    ]
  }
};

// ============================================================
// 8. SANITAS CARE PLUS & HOSPITALWISE BUNDLE 1
// ============================================================

export const SANITAS_OFFICIAL_BULLETS: string[] = [
  'Atención Primaria y Centros: Visitas presenciales y virtuales ilimitadas con médico primario (PCP) en más de 50 centros médicos Sanitas en Florida, sin deducibles ni copagos en los servicios incluidos.',
  'Laboratorios y Urgencias: Análisis de sangre a $0 cada 6 meses y 2 visitas de atención urgente al año a $0 en centros Sanitas del sur de Florida.',
  'Farmacia y Dental: Medicamentos genéricos desde $5 (suministro de 30 días); evaluación y limpiezas dentales a $0 más descuentos en tratamientos (solo en consultorios dentales Sanitas del sur de Florida).',
  'Especialistas, Bienestar y Hospitales: Tarifas preferenciales en especialistas (cardiología, ortopedia, oncología, neurología, gastroenterología, etc., con 10% a 40% de descuento), evaluación nutricional, bienestar emocional, evaluación de movilidad anual, orientación de atención y ayuda para negociar facturas hospitalarias.'
];

export interface HospitalWiseSpec {
  level: HospitalWiseLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  extraBenefitLabel: string;
  bullets: string[];
}

export const HOSPITALWISE_AVAILABLE_STATES = [
  'AK', 'AL', 'AR', 'AZ', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI',
  'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MD', 'ME', 'MI',
  'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NV', 'OH', 'OK',
  'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'WI', 'WV', 'WY'
];

export const HOSPITALWISE_SPECS: Record<HospitalWiseLevel, HospitalWiseSpec> = {
  basic: {
    level: 'basic',
    title: 'HospitalWise® Basic',
    shortLabel: 'Basic',
    tierLabel: 'Indemnización Hospitalaria Básica en Efectivo',
    moopLabel: 'Hospital/UCI $1,000/día (máx. 10 días) • Observación $1,000/día (máx. 4 días/año)',
    pcpLabel: 'No cubierto en Basic',
    specialistLabel: 'No cubierto en Basic',
    rxLabel: 'Optum Perks (30%-80% desc. farmacia)',
    urgenciesLabel: 'Observación Hosp. $1,000/día (4 días/año)',
    extraBenefitLabel:
      'Solo hospitalización ($1,000/día), UCI adicional ($1,000/día) y observación 12-24h ($1,000/día) • Emisión Garantizada 18-64 + Optum Perks.',
    bullets: [
      'Hospitalización, Observación y UCI (Pago Directo en Efectivo): Confinamiento hospitalario $1,000/día (máx. 10 días por período de confinamiento; incluye observación >24h), Observación hospitalaria 12-24h $1,000/día (máx. 4 días/año calendario) y Unidad de Cuidados Intensivos (UCI) $1,000/día ADICIONAL (máx. 10 días por período de confinamiento).',
      'Cobertura Ambulatoria y Extras (Basic): Consultas ambulatorias (ER/UC/DO), cirugía ambulatoria, diagnóstico mayor, ambulancia y Wellness NO están cubiertos en Basic (disponibles en Bundle 1 y Bundle 2).',
      'Condiciones Oficiales (Golden Rule / UHC): Emisión Garantizada (sin preguntas médicas, edades 18-64; limitación de condiciones preexistentes de 6 meses). Sin período de espera en beneficios hospitalarios + UHC Member Hub + tarjeta de descuento Rx Optum Perks (30%-80%).'
    ]
  },
  bundle1: {
    level: 'bundle1',
    title: 'HospitalWise® Bundle 1',
    shortLabel: 'Bundle 1',
    tierLabel: 'Indemnización Hospitalaria + Respaldo Ambulatorio en Efectivo',
    moopLabel: 'Hospital/UCI $1,000/día (máx. 10 días) • Observación $1,000/día (máx. 4 días/año)',
    pcpLabel: '$100/día consultorio (DO, máx. 4 días comb./año)',
    specialistLabel: '$100/día consulta médica (DO)',
    rxLabel: 'Optum Perks (30%-80% desc. farmacia)',
    urgenciesLabel: 'ER $500/día • UC $250/día (máx. 4 días comb./año)',
    extraBenefitLabel:
      'Hospital/UCI $1,000/día + ER $500 / UC $250 / DO $100 + Cirugía $1,000/día + Diagnóstico $500/día + Ambulancia + Optum Perks.',
    bullets: [
      'Hospitalización, Observación y UCI (Pago Directo en Efectivo): Confinamiento hospitalario $1,000/día (máx. 10 días por período de confinamiento), Observación hospitalaria 12-24h $1,000/día (máx. 4 días/año calendario) y Unidad de Cuidados Intensivos (UCI) $1,000/día ADICIONAL (máx. 10 días por período de confinamiento).',
      'Atención Ambulatoria, Cirugía, Diagnóstico y Ambulancia: Emergencias (ER) $500/día, Urgencias (UC) $250/día y Consultorio (DO) $100/día (máximo combinado 4 días/año). Cirugía ambulatoria $1,000/día (máx. 2 días/año). Diagnóstico mayor (CT, MRI, PET, EKG, EEG, CTA) $500/día (máx. 2 días/año). Ambulancia terrestre $250/día o aérea $2,500/día (máx. combinado 4 días/año). Wellness: No cubierto.',
      'Condiciones Oficiales (Golden Rule / UHC): Emisión Garantizada (sin preguntas médicas, edades 18-64; limitación de preexistentes 6 meses). Sin espera en beneficios médicos + UHC Member Hub + tarjeta de descuento Rx Optum Perks (30%-80%).'
    ]
  },
  bundle2: {
    level: 'bundle2',
    title: 'HospitalWise® Bundle 2',
    shortLabel: 'Bundle 2',
    tierLabel: 'Indemnización Hospitalaria + Ambulatoria Superior + Wellness',
    moopLabel: 'Hospital/UCI $1,000/día (máx. 10 días) • Observación $1,000/día (máx. 4 días/año)',
    pcpLabel: '$150/día consultorio (DO, máx. 4 días comb./año)',
    specialistLabel: 'Wellness $75/día (1 día/año, espera 30d)',
    rxLabel: 'Optum Perks (30%-80% desc. farmacia)',
    urgenciesLabel: 'ER $750/día • UC $375/día (máx. 4 días comb./año)',
    extraBenefitLabel:
      'Hospital/UCI $1,000/día + ER $750 / UC $375 / DO $150 + Cirugía $2,000/día + Diagnóstico $1,000/día + Ambulancia hasta $5,000 + Wellness $75/día.',
    bullets: [
      'Hospitalización, Observación y UCI (Pago Directo en Efectivo): Confinamiento hospitalario $1,000/día (máx. 10 días por período de confinamiento), Observación hospitalaria 12-24h $1,000/día (máx. 4 días/año calendario) y Unidad de Cuidados Intensivos (UCI) $1,000/día ADICIONAL (máx. 10 días por período de confinamiento).',
      'Atención Ambulatoria Superior, Cirugía, Diagnóstico y Ambulancia: Emergencias (ER) $750/día, Urgencias (UC) $375/día y Consultorio (DO) $150/día (máx. combinado 4 días/año). Cirugía ambulatoria $2,000/día (máx. 2 días/año). Diagnóstico mayor (CT, MRI, PET, EKG, EEG, CTA) $1,000/día (máx. 2 días/año). Ambulancia terrestre $500/día o aérea $5,000/día (máx. combinado 4 días/año).',
      'Wellness y Condiciones Oficiales: Examen o procedimiento preventivo Wellness $75/día (1 día/año tras 30 días de espera; ej. físico anual, mamografía, colonoscopía, vacunas). Emisión Garantizada (edades 18-64, preexistentes 6 meses) + UHC Member Hub + Optum Perks.'
    ]
  }
};

export const HOSPITALWISE_OFFICIAL_BULLETS: string[] = HOSPITALWISE_SPECS.bundle1.bullets;

// ============================================================
// DETECTORES DETERMINÍSTICOS Y ENFORCEMENT POR PLAN
// ============================================================

export const detectHospitalWiseLevelFromText = (text: string): HospitalWiseLevel => {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('bundle 2') || lower.includes('bundle2') || lower.includes('wellness')) {
    return 'bundle2';
  }
  if (lower.includes('basic') || lower.includes('básico') || lower.includes('basico')) {
    return 'basic';
  }
  return 'bundle1';
};

export const detectHpgLevelFromText = (text: string): HpgPlanLevel => {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('2000') || lower.includes('select 2000') || lower.includes('select')) {
    return 'select2000';
  }
  if (lower.includes('5000') || lower.includes('premier 5000') || lower.includes('premier')) {
    return 'premier5000';
  }
  return 'preferred4000';
};

export const detectGuardLevelFromText = (text: string): GuardPlanLevel => {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('6000')) return 'guard6000';
  if (lower.includes('4000')) return 'guard4000';
  return 'guard5000';
};

export const detectAffordableChoiceLevelFromText = (text: string): AffordableChoiceLevel => {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('elite plus') || lower.includes('elite_plus')) return 'elite_plus';
  if (lower.includes('elite')) return 'elite';
  if (lower.includes('classic plus') || lower.includes('classic_plus')) return 'classic_plus';
  return 'classic';
};

export const detectPresidioLevelFromText = (text: string): PresidioLevel => {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('2.5') || lower.includes('2500') || lower.includes('elite')) return 'elite2500';
  if (lower.includes('7.5') || lower.includes('7500') || lower.includes('value')) return 'value7500';
  if (lower.includes('10k') || lower.includes('10,000') || lower.includes('10000') || lower.includes('essential')) {
    return 'essential10000';
  }
  return 'secure5000';
};

export const isMedMaxPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'medmax') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('medmax');
};

export const isGuardPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'guard') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  if (text.includes('protectorguard')) return false;
  return /\bguard\s*(4000|5000|6000|plans?)\b/.test(text) || text.includes('hpg3-cstm');
};

export const isAffordableChoicePlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'affordable_choice') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('affordable choice') || text.includes('manhattanlife') || text.includes('ak7010fl');
};

export const isPresidioPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'presidio') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('presidio') || text.includes('fortress');
};

export const isHpgPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'hpg4000') return true;
  if (isGuardPlan(plan)) return false;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('protectorguard') || /\bhpg\b/.test(text);
};

export const detectBmiPhcsLevelFromText = (text: string): BmiPhcsLevel => {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('classic') || lower.includes('clásico') || lower.includes('clasico')) return 'classic';
  if (lower.includes('choice')) return 'choice';
  if (lower.includes('advantage')) return 'advantage';
  if (lower.includes('basic') || lower.includes('básico') || lower.includes('basico')) return 'basic';
  return 'value';
};

export const isBmiPhcsPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'bmi_phcs') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('bmi') && text.includes('phcs');
};

export const isAfiPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'afi') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return /\bafi\b/.test(text) || text.includes('3500 hsa') || text.includes('3500 copay');
};

export const isAcusaPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'acusa') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('acusa') || text.includes('vault health') || text.includes('bronze 2') || text.includes('silver 2');
};

export const detectPremierMmLevelFromText = (text: string): PremierMmLevel => {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('7500') || lower.includes('7,500') || lower.includes('7.5k')) return 'mm7500';
  if (lower.includes('2500') || lower.includes('2,500') || lower.includes('2.5k')) return 'mm2500';
  return 'mm5000';
};

export const isPremierMmPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'premier_mm') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return (
    text.includes('premier major medical') ||
    /\bpremier\s*mm\b/.test(text) ||
    /premier.*(2500|5000|7500)/.test(text)
  );
};

export const detectPremierMaxLevelFromText = (text: string): PremierMaxLevel => {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('3000') || lower.includes('3,000')) return 'max3000';
  if (lower.includes('1000') || lower.includes('1,000')) return 'max1000';
  return 'max2000';
};

export const isPremierMaxPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'premier_max') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('premier max') || /\bmax\s*(1000|2000|3000)\b/.test(text);
};

export const isHospitalWisePlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'hospitalwise') return true;
  const text = `${plan.company} ${plan.planName}`.toLowerCase();
  return text.includes('hospitalwise') && !text.includes('sanitas');
};

export const isSanitasPlan = (plan: QuotePlan): boolean => {
  if (plan.hasSanitasFee) return true;
  if (plan.planCategory === 'sanitas' || plan.planCategory === 'sanitas_bundle') return true;
  const text = `${plan.company} ${plan.planName}`.toLowerCase();
  return text.includes('sanitas');
};

export const getPlanSanitasFee = (plan: QuotePlan): number => {
  if (plan.hasSanitasFee === true) {
    return parseMoney(plan.enrollmentFee || SANITAS_FEE_AMOUNT) || SANITAS_FEE_AMOUNT;
  }
  if (plan.hasSanitasFee === false) return 0;
  if (isSanitasPlan(plan) && !isHospitalWisePlan(plan)) return SANITAS_FEE_AMOUNT;
  return 0;
};

export const getPlanEnrollmentFee = (plan: QuotePlan): { amount: number; label: string } => {
  const sanitasFee = getPlanSanitasFee(plan);
  if (sanitasFee > 0) {
    return { amount: sanitasFee, label: 'fee único de inscripción Sanitas' };
  }
  if (plan.hasEnrollmentFee && parseMoney(plan.enrollmentFee) > 0) {
    return {
      amount: parseMoney(plan.enrollmentFee),
      label: plan.enrollmentFeeLabel || 'cargo único de solicitud'
    };
  }
  return { amount: 0, label: '' };
};

export const getPlanFirstMonth = (plan: QuotePlan): number => {
  return parseMoney(plan.premium) + getPlanEnrollmentFee(plan).amount;
};

// Viñetas cerradas oficiales SIN mezclas ni repeticiones
export const getExactOfficialBulletsForPlan = (plan: QuotePlan): string[] => {
  if (isSanitasPlan(plan) && !isHospitalWisePlan(plan)) {
    return SANITAS_OFFICIAL_BULLETS;
  }
  if (isGuardPlan(plan)) {
    const level = plan.guardLevel || detectGuardLevelFromText(`${plan.planName} ${plan.tier}`);
    return GUARD_SPECS[level].bullets;
  }
  if (isAffordableChoicePlan(plan)) {
    const level =
      plan.affordableChoiceLevel || detectAffordableChoiceLevelFromText(`${plan.planName} ${plan.tier}`);
    return AFFORDABLE_CHOICE_SPECS[level].bullets;
  }
  if (isPresidioPlan(plan)) {
    const level = plan.presidioLevel || detectPresidioLevelFromText(`${plan.planName} ${plan.tier}`);
    return PRESIDIO_SPECS[level].bullets;
  }
  if (isHpgPlan(plan)) {
    const level = plan.hpgLevel || detectHpgLevelFromText(`${plan.planName} ${plan.tier}`);
    return HPG_SPECS[level].bullets;
  }
  if (isMedMaxPlan(plan)) {
    return MEDMAX_OFFICIAL_BULLETS;
  }
  if (isBmiPhcsPlan(plan)) {
    const level = plan.bmiLevel || detectBmiPhcsLevelFromText(`${plan.planName} ${plan.tier}`);
    return BMI_PHCS_SPECS[level].bullets;
  }
  if (isAfiPlan(plan)) {
    const lower = `${plan.planName} ${plan.tier}`.toLowerCase();
    const level: AfiLevel = plan.afiLevel || (lower.includes('copay') ? 'copay3500' : 'hsa3500');
    return AFI_SPECS[level].bullets;
  }
  if (isAcusaPlan(plan)) {
    const lower = `${plan.planName} ${plan.tier}`.toLowerCase();
    const level: AcusaLevel = plan.acusaLevel || (lower.includes('silver') ? 'silver2' : 'bronze2');
    return ACUSA_SPECS[level].bullets;
  }
  if (isPremierMmPlan(plan)) {
    const level = plan.premierMmLevel || detectPremierMmLevelFromText(`${plan.planName} ${plan.tier}`);
    return PREMIER_MM_SPECS[level].bullets;
  }
  if (isPremierMaxPlan(plan)) {
    const level = plan.premierMaxLevel || detectPremierMaxLevelFromText(`${plan.planName} ${plan.tier}`);
    return PREMIER_MAX_SPECS[level].bullets;
  }
  if (isHospitalWisePlan(plan)) {
    const level =
      plan.hospitalwiseLevel || detectHospitalWiseLevelFromText(`${plan.planName} ${plan.tier}`);
    return HOSPITALWISE_SPECS[level].bullets;
  }
  if (plan.planCategory === 'aca') {
    const bullets: string[] = [];
    if (plan.primaryCare || plan.specialist) {
      bullets.push(
        `Primario, Especialista y Telemedicina: Médico primario ${plan.primaryCare || 'Consultar'}, Especialista ${plan.specialist || 'Consultar'}${plan.referralRequired ? ` (${plan.referralRequired})` : ''}.`
      );
    }
    if (plan.acaLabsImaging) {
      bullets.push(`Laboratorios e Imágenes: ${plan.acaLabsImaging}`);
    }
    if (plan.acaErHospital || plan.urgencies) {
      bullets.push(
        `Urgencias, Emergencias y Hospitalización: ${plan.acaErHospital || plan.urgencies || 'Según cobertura del plan ACA'}`
      );
    }
    if (plan.acaRxTiers || plan.genericRx) {
      bullets.push(`Medicamentos por Niveles: ${plan.acaRxTiers || plan.genericRx}`);
    }
    if (bullets.length > 0) return bullets;
  }

  if (Array.isArray(plan.highlights) && plan.highlights.length > 0) {
    return plan.highlights.filter(h => h && h.trim().length > 0);
  }
  const custom: string[] = [];
  if (plan.primaryCare || plan.specialist || plan.genericRx || plan.urgencies) {
    custom.push(
      `Consultas y Copagos: Médico Primario ${plan.primaryCare || '$0'} | Especialista ${plan.specialist || '$0'} | Medicinas Genéricas ${plan.genericRx || '$0'} | Urgencias/ER ${plan.urgencies || '$0'}.`
    );
  }
  if (plan.clientSummary) custom.push(plan.clientSummary);
  if (plan.extraBenefit && plan.extraBenefit !== plan.clientSummary) custom.push(plan.extraBenefit);
  return custom;
};

// Normaliza y aplica ficha cerrada oficial (usado por extractor IA o cambios de categoría)
export const enforceOfficialCatalogOnPlan = (
  plan: QuotePlan,
  context?: { members?: string; ages?: string }
): QuotePlan => {
  const famTier = detectEnrollFamilyTier(context?.members || '', context?.ages || '');

  if (isMedMaxPlan(plan)) {
    const effectiveFamTier: EnrollFamilyTier = plan.medmaxFamilyTier || famTier;
    const scope: MedMaxScope = plan.medmaxScope || (effectiveFamTier === 'empleado' ? 'individual' : 'familiar');
    const ageBracket: MedMaxAgeBracket = plan.medmaxAgeBracket || detectMedMaxAgeBracket(context?.ages || '');
    const checkDed = validateMedMaxDeductible(plan.deductible || '', scope);
    const dedTier: MedMaxDeductibleTier = plan.medmaxDeductibleTier || checkDed.closestTier;
    const pricing = getMedMaxQuotePricing(ageBracket, effectiveFamTier, dedTier);

    return {
      ...plan,
      planCategory: 'medmax',
      medmaxDeductibleTier: dedTier,
      medmaxScope: scope,
      medmaxAgeBracket: ageBracket,
      medmaxFamilyTier: effectiveFamTier,
      company: 'MedMax (Plan ERISA)',
      planName: 'Plan MedMax',
      tier: `Deductible Value Plan • Edad ${ageBracket} años`,
      subtitleTag: `PLAN ERISA • RED FIRST HEALTH • DEDUCIBLE ${scope === 'individual' ? 'INDIVIDUAL' : 'FAMILIAR'}`,
      premium: parseMoney(plan.premium) > 0 ? plan.premium : pricing.monthlyPrice,
      deductible: getMedMaxDeductibleDisplay(dedTier, scope),
      moop: getMedMaxMoopDisplay(scope),
      primaryCare: '$50 (tras deducible) • RelyMD $0',
      specialist: '$50 (tras deducible)',
      genericRx: '$0 preventivos',
      urgencies: '$50 UC / $250 ER (tras deducible)',
      deductibleWarning: MEDMAX_DEFAULT_WARNING,
      highlights: MEDMAX_OFFICIAL_BULLETS,
      extraBenefit: 'Red First Health + Telemedicina RelyMD $0 + Bill Negotiator; copagos aplican tras cumplir deducible.',
      hasSanitasFee: false
    };
  }

  if (isGuardPlan(plan)) {
    const level = plan.guardLevel || detectGuardLevelFromText(`${plan.planName} ${plan.tier}`);
    const spec = GUARD_SPECS[level];
    return {
      ...plan,
      planCategory: 'guard',
      guardLevel: level,
      company: 'UnitedHealthcare / Golden Rule Insurance Company',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `UNITEDHEALTHCARE / GOLDEN RULE • ${spec.shortLabel.toUpperCase()} • SIN DEDUCIBLE`,
      deductible: '$0 (Sin deducible)',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: spec.extraBenefitLabel,
      hasSanitasFee: false
    };
  }

  if (isAffordableChoicePlan(plan)) {
    const level =
      plan.affordableChoiceLevel || detectAffordableChoiceLevelFromText(`${plan.planName} ${plan.tier}`);
    const spec = AFFORDABLE_CHOICE_SPECS[level];
    const refAge: AffordableChoiceAge =
      plan.affordableChoiceAge && AFFORDABLE_CHOICE_AGES.includes(plan.affordableChoiceAge as AffordableChoiceAge)
        ? (plan.affordableChoiceAge as AffordableChoiceAge)
        : detectClosestAffordableChoiceAge(context?.ages || '');
    const acGroup = detectAffordableChoiceGroupKey(context?.members || '', context?.ages || '');
    const autoRate = spec.ratesByAge[refAge][acGroup].toFixed(2);
    return {
      ...plan,
      planCategory: 'affordable_choice',
      affordableChoiceLevel: level,
      affordableChoiceAge: refAge,
      company: 'ManhattanLife Insurance and Annuity Company',
      planName: spec.title,
      tier: `${spec.tierLabel} • Edad ref. ${refAge}`,
      subtitleTag: `MANHATTANLIFE AFFORDABLE CHOICE • ${spec.shortLabel.toUpperCase()} • SIN PERÍODOS DE ESPERA`,
      premium: parseMoney(plan.premium) > 0 ? plan.premium : autoRate,
      deductible: '$0 (Sin deducible)',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: spec.extraBenefitLabel,
      hasSanitasFee: false
    };
  }

  if (isPresidioPlan(plan)) {
    const level = plan.presidioLevel || detectPresidioLevelFromText(`${plan.planName} ${plan.tier}`);
    const spec = PRESIDIO_SPECS[level];
    return {
      ...plan,
      planCategory: 'presidio',
      presidioLevel: level,
      company: 'Presidio Healthcare (TDI Texas)',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `PRESIDIO FORTRESS • ${spec.shortLabel.toUpperCase()} • SOLO DISPONIBLE EN TEXAS (TX)`,
      deductible: spec.deductibleLabel,
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: spec.extraBenefitLabel,
      hasSanitasFee: false
    };
  }

  if (isHpgPlan(plan)) {
    const level = plan.hpgLevel || detectHpgLevelFromText(`${plan.planName} ${plan.tier}`);
    const spec = HPG_SPECS[level];
    return {
      ...plan,
      planCategory: 'hpg4000',
      hpgLevel: level,
      company: 'UnitedHealthcare / Golden Rule Insurance Company',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `UNITEDHEALTHCARE / GOLDEN RULE • ${spec.shortLabel.toUpperCase()} • SIN DEDUCIBLE`,
      deductible: '$0 (Sin deducible)',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: 'Red UnitedHealthcare Choice Plus (~58% ahorro promedio) + Telemedicina $0 (Healthiest You) + Optum Perks.',
      hasSanitasFee: false
    };
  }

  if (isBmiPhcsPlan(plan)) {
    const level = plan.bmiLevel || detectBmiPhcsLevelFromText(`${plan.planName} ${plan.tier}`);
    const spec = BMI_PHCS_SPECS[level];
    return {
      ...plan,
      planCategory: 'bmi_phcs',
      bmiLevel: level,
      company: 'BMI-PHCS (Red PHCS)',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `RED PHCS • ${level === 'classic' || level === 'choice' ? 'MEC OPTION' : 'BENEFICIO LIMITADO POR DÍA'} • ${spec.shortLabel.toUpperCase()}`,
      premium: parseMoney(plan.premium) > 0 ? plan.premium : spec.rates[famTier].toFixed(2),
      deductible: '$0 Ind. / $0 Fam.',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      hasEnrollmentFee: plan.hasEnrollmentFee !== false,
      enrollmentFee: plan.enrollmentFee || '75.00',
      enrollmentFeeLabel: 'tarifa única de inscripción (BMI-PHCS)',
      extraBenefit:
        level === 'classic' || level === 'choice'
          ? 'Plan MEC bajo Red PHCS administrado por MBA Employee Benefits (no es seguro médico mayor tradicional).'
          : 'Plan de beneficio limitado por día bajo Red PHCS (no es seguro médico mayor tradicional).',
      hasSanitasFee: false
    };
  }

  if (isAfiPlan(plan)) {
    const lower = `${plan.planName} ${plan.tier}`.toLowerCase();
    const level: AfiLevel = plan.afiLevel || (lower.includes('copay') ? 'copay3500' : 'hsa3500');
    const spec = AFI_SPECS[level];
    return {
      ...plan,
      planCategory: 'afi',
      afiLevel: level,
      company: 'AFI Major Medical',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `AFI MAJOR MEDICAL • ${spec.shortLabel.toUpperCase()} • CARGO SOLICITUD $75`,
      premium: parseMoney(plan.premium) > 0 ? plan.premium : spec.rates[famTier].toFixed(2),
      deductible: spec.deductibleLabel,
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      hasEnrollmentFee: plan.hasEnrollmentFee !== false,
      enrollmentFee: plan.enrollmentFee || '75.00',
      enrollmentFeeLabel: 'cargo único de solicitud (AFI)',
      extraBenefit: 'Major Medical tradicional con Telemedicina MYMDNOW $0 (requiere preautorización en cirugías/internación).',
      hasSanitasFee: false
    };
  }

  if (isAcusaPlan(plan)) {
    const lower = `${plan.planName} ${plan.tier}`.toLowerCase();
    const level: AcusaLevel = plan.acusaLevel || (lower.includes('silver') ? 'silver2' : 'bronze2');
    const spec = ACUSA_SPECS[level];
    return {
      ...plan,
      planCategory: 'acusa',
      acusaLevel: level,
      company: 'ACUSA • Vault Health Plan',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `ACUSA VAULT • ${spec.shortLabel.toUpperCase()} • EMISIÓN GARANTIZADA`,
      premium: parseMoney(plan.premium) > 0 ? plan.premium : spec.rates[famTier].toFixed(2),
      deductible: '$0 Ind. / $0 Fam.',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: 'Telemedicina $0 (Clever Health)',
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      hasEnrollmentFee: plan.hasEnrollmentFee !== false,
      enrollmentFee: plan.enrollmentFee || '75.00',
      enrollmentFeeLabel: 'tarifa única de inscripción (ACUSA)',
      extraBenefit: 'Emisión Garantizada administrada por Vault Health Plan con Clever Health & Benefits Hero App.',
      hasSanitasFee: false
    };
  }

  if (isPremierMmPlan(plan)) {
    const level = plan.premierMmLevel || detectPremierMmLevelFromText(`${plan.planName} ${plan.tier}`);
    const ageBracket = plan.medmaxAgeBracket || detectMedMaxAgeBracket(context?.ages || '');
    const spec = PREMIER_MM_SPECS[level];
    return {
      ...plan,
      planCategory: 'premier_mm',
      premierMmLevel: level,
      medmaxAgeBracket: ageBracket,
      medmaxFamilyTier: famTier,
      company: 'Premier Major Medical (Cigna PPO)',
      planName: spec.title,
      tier: `${spec.tierLabel} • Edad ${ageBracket} años`,
      subtitleTag: `CIGNA PPO • PREMIER MAJOR MEDICAL ${spec.shortLabel} • COASEGURO 20%`,
      premium: parseMoney(plan.premium) > 0 ? plan.premium : spec.rates[ageBracket][famTier].toFixed(2),
      deductible: spec.inDeductibleLabel,
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit:
        'Red Cigna PPO (tarifas ACH; cargos adicionales pueden aplicar con tarjeta o fee de solicitud).',
      hasSanitasFee: false
    };
  }

  if (isPremierMaxPlan(plan)) {
    const level = plan.premierMaxLevel || detectPremierMaxLevelFromText(`${plan.planName} ${plan.tier}`);
    const ageBracket = plan.medmaxAgeBracket || detectMedMaxAgeBracket(context?.ages || '');
    const spec = PREMIER_MAX_SPECS[level];
    return {
      ...plan,
      planCategory: 'premier_max',
      premierMaxLevel: level,
      medmaxAgeBracket: ageBracket,
      medmaxFamilyTier: famTier,
      company: 'Premier Max (PHCS / First Health PPO)',
      planName: spec.title,
      tier: `${spec.tierLabel} • Edad ${ageBracket} años`,
      subtitleTag: `PHCS / FIRST HEALTH PPO • PREMIER MAX ${spec.shortLabel} • LÍMITES DE VISITAS`,
      premium: parseMoney(plan.premium) > 0 ? plan.premium : spec.rates[ageBracket][famTier].toFixed(2),
      deductible: spec.inDeductibleLabel,
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit:
        'Red PHCS o First Health PPO (tarifas ACH; plan con límites de visitas anuales).',
      hasSanitasFee: false
    };
  }

  if (isHospitalWisePlan(plan)) {
    const level =
      plan.hospitalwiseLevel || detectHospitalWiseLevelFromText(`${plan.planName} ${plan.tier}`);
    const spec = HOSPITALWISE_SPECS[level];
    return {
      ...plan,
      planCategory: 'hospitalwise',
      hospitalwiseLevel: level,
      company: 'Golden Rule Insurance Company (UnitedHealthcare)',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `GOLDEN RULE / UHC • ${spec.shortLabel.toUpperCase()} • EMISIÓN GARANTIZADA EN EFECTIVO`,
      deductible: '$0 (Sin deducible)',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: spec.extraBenefitLabel,
      hasSanitasFee: false
    };
  }

  if (isSanitasPlan(plan)) {
    return {
      ...plan,
      planCategory: 'sanitas',
      company: 'Sanitas Care Plus',
      planName: plan.planName?.toLowerCase().includes('sanitas') ? plan.planName : 'Sanitas Care Plus',
      tier: plan.tier || 'Membresía de Atención Primaria y Bienestar',
      subtitleTag: 'MEMBRESÍA SANITAS CARE PLUS • +$40.00 FEE ÚNICO SOLO 1.ER MES',
      hasSanitasFee: true,
      enrollmentFee: plan.enrollmentFee || '40.00',
      deductible: '$0 (Sin deducibles ni copagos)',
      moop: '$0 Deducible • Sin copagos en servicios incluidos',
      primaryCare: '$0 Ilimitado (Presencial y Virtual en +50 centros FL)',
      specialist: '10% a 40% de descuento en especialistas',
      genericRx: 'Desde $5 (suministro 30 días)',
      urgencies: '2 visitas/año $0 (centros Sanitas sur de FL)',
      highlights: SANITAS_OFFICIAL_BULLETS,
      extraBenefit: 'Incluye +$40.00 de fee único de inscripción solo en el 1.er mes y ayuda para negociar facturas hospitalarias.'
    };
  }

  return plan;
};

// ============================================================
// VALIDACIÓN GEOGRÁFICA POR ZIP CODE Y EDADES
// ============================================================

export interface GeoAgeAnalysis {
  zipCode: string;
  detectedState: string;
  isSouthFlorida: boolean;
  sanitasAvailability: 'plus_fl' | 'unavailable_non_fl' | 'verify_zip';
  sanitasNote: string;
  hpgRestrictedState: boolean;
  hpgNote: string;
  presidioAvailable: boolean;
  presidioNote: string;
  ages: number[];
  hasSenior65Plus: boolean;
  ageNote: string;
}

export const detectStateAndZip = (
  locationStr: string
): { zipCode: string; stateCode: string; isSouthFlorida: boolean } => {
  const loc = String(locationStr || '').trim();
  const upper = loc.toUpperCase();
  const zipMatch = loc.match(/\b(\d{5})\b/);
  const zipCode = zipMatch ? zipMatch[1] : '';
  const zipNum = zipCode ? parseInt(zipCode, 10) : 0;

  let stateCode = '';
  if (zipNum >= 32000 && zipNum <= 34999) stateCode = 'FL';
  else if ((zipNum >= 75000 && zipNum <= 79999) || (zipNum >= 73301 && zipNum <= 73344)) stateCode = 'TX';
  else if (zipNum >= 85000 && zipNum <= 86599) stateCode = 'AZ';
  else if (zipNum >= 7000 && zipNum <= 8999) stateCode = 'NJ';
  else if (zipNum >= 6000 && zipNum <= 6999) stateCode = 'CT';
  else if (zipNum >= 37000 && zipNum <= 38599) stateCode = 'TN';
  else if (zipNum >= 30000 && zipNum <= 31999) stateCode = 'GA';
  else if (zipNum >= 27000 && zipNum <= 28999) stateCode = 'NC';
  else if (zipNum >= 29000 && zipNum <= 29999) stateCode = 'SC';
  else if (zipNum >= 10000 && zipNum <= 14999) stateCode = 'NY';
  else if (zipNum >= 90000 && zipNum <= 96199) stateCode = 'CA';

  if (!stateCode) {
    const twoLetterMatch = upper.match(
      /\b(AK|AL|AR|AZ|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/
    );
    if (twoLetterMatch) {
      stateCode = twoLetterMatch[1];
    } else if (upper.includes('FLORIDA')) stateCode = 'FL';
    else if (upper.includes('TEXAS')) stateCode = 'TX';
    else if (upper.includes('ARIZONA')) stateCode = 'AZ';
    else if (upper.includes('NEW JERSEY')) stateCode = 'NJ';
    else if (upper.includes('CONNECTICUT')) stateCode = 'CT';
    else if (upper.includes('TENNESSEE')) stateCode = 'TN';
    else if (upper.includes('GEORGIA')) stateCode = 'GA';
    else if (upper.includes('NORTH CAROLINA')) stateCode = 'NC';
    else if (upper.includes('SOUTH CAROLINA')) stateCode = 'SC';
    else if (upper.includes('NEW YORK')) stateCode = 'NY';
    else if (upper.includes('CALIFORNIA')) stateCode = 'CA';
    else if (upper.includes('PENNSYLVANIA')) stateCode = 'PA';
    else if (upper.includes('ILLINOIS')) stateCode = 'IL';
    else if (upper.includes('VIRGINIA') && !upper.includes('WEST VIRGINIA')) stateCode = 'VA';
    else if (upper.includes('WEST VIRGINIA')) stateCode = 'WV';
  }

  const isSouthFlorida =
    (zipNum >= 33000 && zipNum <= 33499) ||
    upper.includes('MIAMI') ||
    upper.includes('HIALEAH') ||
    upper.includes('DORAL') ||
    upper.includes('HOMESTEAD') ||
    upper.includes('BROWARD') ||
    upper.includes('FORT LAUDERDALE') ||
    upper.includes('PEMBROKE') ||
    upper.includes('WEST PALM') ||
    upper.includes('BOCA RATON');

  return { zipCode, stateCode, isSouthFlorida };
};

export const evaluateGeoAndAgeEligibility = (
  locationStr: string,
  agesStr: string
): GeoAgeAnalysis => {
  const { zipCode, stateCode, isSouthFlorida } = detectStateAndZip(locationStr);
  const ages = extractAgesArray(agesStr);

  const hasSenior65Plus = ages.some(a => a >= 65);

  let sanitasAvailability: GeoAgeAnalysis['sanitasAvailability'] = 'verify_zip';
  let sanitasNote =
    'Sanitas Care aplica únicamente en Florida (FL) por ahora. Verifica disponibilidad del centro Sanitas para el ZIP Code de Florida.';

  if (stateCode === 'FL') {
    sanitasAvailability = 'plus_fl';
    sanitasNote = isSouthFlorida
      ? `ZIP ${zipCode || 'Sur de FL'} validado: Sanitas Care Plus disponible en Florida (+50 centros médicos; dental y 2 urgencias/año $0 en centros del sur de FL).`
      : `Estado FL (${zipCode || 'Florida'}): Sanitas Care Plus disponible solo en Florida (validar clínica Sanitas cercana al ZIP).`;
  } else if (stateCode) {
    sanitasAvailability = 'unavailable_non_fl';
    sanitasNote = `⚠️ Sanitas Care NO está disponible en ${stateCode}: por ahora aplica SOLO para Florida (FL).`;
  }

  const restrictedStatesHPG = ['NY', 'CA', 'MA', 'WA', 'VT', 'NH', 'NJ', 'MN', 'OR', 'CT', 'DC', 'CO', 'NM', 'RI', 'HI'];
  const hpgRestrictedState = Boolean(stateCode && restrictedStatesHPG.includes(stateCode));
  const hwAvailable = !stateCode || HOSPITALWISE_AVAILABLE_STATES.includes(stateCode);

  let hwDetail = '';
  if (stateCode) {
    if (!hwAvailable) {
      hwDetail = ` HospitalWise (Golden Rule) NO está disponible en ${stateCode}.`;
    } else if (stateCode === 'CT') {
      hwDetail = ' En CT HospitalWise no incluye Outpatient Care, Surgical ni Major Diagnostic.';
    } else if (stateCode === 'ID') {
      hwDetail = ' En ID HospitalWise solo cubre Hospital/UCI (sin Observación, Outpatient ni Wellness).';
    } else if (stateCode === 'KS') {
      hwDetail = ' En KS HospitalWise no incluye Outpatient Care, Major Diagnostic ni Wellness.';
    } else if (stateCode === 'IL' || stateCode === 'VA') {
      hwDetail = ` En ${stateCode} HospitalWise Bundle 2 no incluye el beneficio Wellness.`;
    } else if (stateCode === 'PA') {
      hwDetail = ' En PA HospitalWise extiende $50/día hasta 31 días tras los 10 días de hospitalización, sin Optum Perks.';
    } else if (stateCode === 'TX') {
      hwDetail = ' En TX HospitalWise extiende $50/día hasta 31 días tras los 10 días de hospitalización.';
    }
  }

  const guardAvailable = !stateCode || GUARD_AVAILABLE_STATES.includes(stateCode);
  let guardDetail = '';
  if (stateCode) {
    if (!guardAvailable) {
      guardDetail = ` Guard Plans (4000/5000/6000) NO disponible en ${stateCode}.`;
    } else if (stateCode === 'DE' || stateCode === 'MD') {
      guardDetail = ` En ${stateCode} Guard Plans tiene edad máxima de emisión de 60 años.`;
    }
  }

  const presidioAvailable = !stateCode || PRESIDIO_AVAILABLE_STATES.includes(stateCode);
  const presidioNote = !stateCode
    ? 'Presidio Fortress Plan aplica exclusivamente en Texas (TX). Ingresa un ZIP de Texas (750xx-799xx / 733xx) para validar.'
    : presidioAvailable
      ? 'Estado TX validado: Presidio Fortress Plan disponible con emisión formal bajo el TDI de Texas.'
      : `⚠️ Presidio Fortress Plan NO está disponible en ${stateCode}: habilitado SOLO en Texas (TX).`;

  const hpgNote = hpgRestrictedState
    ? `Variación estatal (${stateCode}): Verificar reglas locales de HPG.${hwDetail}${guardDetail}${!presidioAvailable ? ` Presidio Fortress: SOLO disponible en TX.` : ''}`
    : stateCode
      ? `Estado ${stateCode}: HPG, Guard${guardAvailable ? ' (disponible)' : ' (no disponible)'}, HospitalWise${hwAvailable ? ' (disponible)' : ' (no disponible)'}, Affordable Choice, Presidio${presidioAvailable ? ' (disponible TX)' : ' (SOLO en TX)'}, MedMax, Premier Major Medical, Premier Max, BMI-PHCS, AFI y ACUSA.${hwDetail}${guardDetail}`
      : 'Ingresa un Estado o ZIP Code de 5 dígitos para validar disponibilidad regional.';

  let ageNote = '';
  if (hasSenior65Plus) {
    ageNote =
      'Edad 65+ detectada: HPG, MedMax (18-64), Premier Major Medical (18-64), Premier Max (18-64) y planes ACA aplican normalmente hasta los 64 años (evaluar Medicare para 65+).';
  } else if (ages.length > 0) {
    const adults = ages.filter(a => a >= 18).length;
    const kids = ages.filter(a => a < 18).length;
    const medmaxRange = detectMedMaxAgeBracket(agesStr);
    ageNote = `Edades validadas (${ages.join(', ')} años): ${adults} adulto(s) y ${kids} menor(es) • Rango MedMax / Premier: ${medmaxRange}.`;
  } else {
    ageNote = 'Agrega las edades de los solicitantes para calcular tarifas por edad en MedMax, Premier Major Medical, Premier Max y Affordable Choice.';
  }

  return {
    zipCode,
    detectedState: stateCode,
    isSouthFlorida,
    sanitasAvailability,
    sanitasNote,
    hpgRestrictedState,
    hpgNote,
    presidioAvailable,
    presidioNote,
    ages,
    hasSenior65Plus,
    ageNote
  };
};

// Tarifas oficiales Sanitas Care Plus por Grupo Familiar
export interface SanitasPricingResult {
  tierLabel: string;
  monthlyPrice: string;
  firstMonthPrice: string;
}

export const getSanitasPricingForFamily = (
  membersText: string,
  agesText: string
): SanitasPricingResult => {
  const m = String(membersText || '').toLowerCase();
  const ages = extractAgesArray(agesText);

  let tierLabel = 'Individual (Solo Adulto)';
  let monthly = 89;

  if (m.includes('solo niño') || m.includes('solo nino')) {
    tierLabel = 'Solo Niño';
    monthly = 59;
  } else if (m.includes('2 adultos + 2') || m.includes('pareja + 2') || m.includes('4 personas')) {
    tierLabel = 'Familia (2 Adultos + 2 Niños)';
    monthly = 240;
  } else if (m.includes('2 adultos + 1') || m.includes('pareja + 1') || m.includes('3 personas')) {
    tierLabel = 'Familia (2 Adultos + 1 Niño)';
    monthly = 195;
  } else if (m.includes('familiar') || m.includes('familia') || m.includes('1 adulto + 2')) {
    tierLabel = 'Familiar';
    monthly = 170;
  } else if (
    m.includes('titular + 1') ||
    m.includes('titular + niño') ||
    m.includes('titular + nino') ||
    m.includes('1 adulto + 1') ||
    (m.includes('2 personas') && (m.includes('niño') || m.includes('nino') || m.includes('hijo')))
  ) {
    tierLabel = 'Titular + 1 Niño';
    monthly = 125;
  } else if (m.includes('pareja') || m.includes('2 adultos') || m.includes('esposos') || m.includes('2 personas')) {
    tierLabel = 'Pareja (2 Adultos)';
    monthly = 159;
  } else if (m.includes('individual') || m.includes('solo adulto') || m.includes('1 adulto') || m.includes('1 persona')) {
    tierLabel = 'Individual (Solo Adulto)';
    monthly = 89;
  } else if (ages.length > 0) {
    const adults = ages.filter(a => a >= 18).length;
    const kids = ages.filter(a => a < 18).length;
    if (adults === 0 && kids >= 1) {
      tierLabel = 'Solo Niño';
      monthly = 59;
    } else if (adults === 1 && kids === 0) {
      tierLabel = 'Individual (Solo Adulto)';
      monthly = 89;
    } else if (adults === 1 && kids === 1) {
      tierLabel = 'Titular + 1 Niño';
      monthly = 125;
    } else if (adults === 1 && kids >= 2) {
      tierLabel = 'Familiar';
      monthly = 170;
    } else if (adults >= 2 && kids === 0) {
      tierLabel = 'Pareja (2 Adultos)';
      monthly = 159;
    } else if (adults >= 2 && kids === 1) {
      tierLabel = 'Familia (2 Adultos + 1 Niño)';
      monthly = 195;
    } else {
      tierLabel = 'Familia (2 Adultos + 2 Niños)';
      monthly = 240;
    }
  }

  return {
    tierLabel,
    monthlyPrice: monthly.toFixed(2),
    firstMonthPrice: (monthly + SANITAS_FEE_AMOUNT).toFixed(2)
  };
};
