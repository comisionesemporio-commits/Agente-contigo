import {
  AcusaLevel,
  AfiLevel,
  AhwPlanLevel,
  BmiPhcsLevel,
  EnrollFamilyTier,
  HospitalWiseLevel,
  HpgPlanLevel,
  MedAccessAgeBracket,
  MedAccessLevel,
  MedMaxAgeBracket,
  MedMaxDeductibleTier,
  MedMaxScope,
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

export const detectMedAccessAgeBracket = (agesText: string): MedAccessAgeBracket => {
  const ages = extractAgesArray(agesText);
  const adultAges = ages.filter(a => a >= 18);
  const refAge = adultAges.length > 0 ? Math.max(...adultAges) : ages[0] || 30;
  return refAge >= 46 ? '46-64' : '18-45';
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
// 3. AHW 1 AL 6 (GUÍA COMPARATIVA ENROLL PRIME • RED FIRST HEALTH)
// ============================================================

export interface AhwSpec {
  level: AhwPlanLevel;
  shortLabel: string;
  title: string;
  tierLabel: string;
  rates: Record<EnrollFamilyTier, number>;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  bullets: string[];
}

const AHW_PREVENTIVE_BULLET =
  'Cuidado Preventivo ($0 en proveedores no hospitalarios First Health) y Extras: Examen físico anual (1/año), Mamografía 2D (mujeres 50+, c/2 años), Papanicolaou (mujeres 21-65, c/3 años), Presión/Diabetes (adultos en riesgo, 1/año), Cáncer colorrectal (adultos 50-75, kit c/5 años) y Control Niño Sano (1/año). Incluye Telemedicina 24/7 RelyMD $0 y Bill Negotiator.';

export const AHW_SPECS: Record<AhwPlanLevel, AhwSpec> = {
  ahw1: {
    level: 'ahw1',
    shortLabel: 'AHW 1',
    title: 'Plan de Salud AHW 1 Básico (Red First Health)',
    tierLabel: 'AHW 1 Básico • Red First Health PPO ($0 Deducible)',
    rates: { empleado: 139.99, pareja: 169.99, hijos: 164.99, familiar: 209.99 },
    moopLabel: 'Tope Hospital $5,000/año',
    pcpLabel: '3 al año ($25)',
    specialistLabel: '1 al año ($50)',
    rxLabel: '$0 Genérico Preventivo (30 días)',
    urgenciesLabel: 'Urgencias 1/año ($50) • ER/Amb. no incl.',
    bullets: [
      'Atención Ambulatoria y Estudios: Visita Primaria 3 al año ($25 copago), Especialista / Urgent Care 1 al año ($50). Laboratorio y diagnósticos no incluidos.',
      'Beneficios Hospitalarios: Hospitalización $1,000/día (máximo hospitalario $5,000 al año). Cirugía y Emergencia/Ambulancia no incluidas en este nivel.',
      'Farmacia (hasta 30 días): Genérico preventivo $0 (Genérico preferido y Marca no cubiertos).',
      AHW_PREVENTIVE_BULLET
    ]
  },
  ahw2: {
    level: 'ahw2',
    shortLabel: 'AHW 2',
    title: 'Plan de Salud AHW 2 Plus (Red First Health)',
    tierLabel: 'AHW 2 Plus • Red First Health PPO ($0 Deducible)',
    rates: { empleado: 159.99, pareja: 199.99, hijos: 195.99, familiar: 239.99 },
    moopLabel: 'Tope Hospital $10,000/año',
    pcpLabel: '4 al año ($25)',
    specialistLabel: '2 al año ($50)',
    rxLabel: '$0 Prev. / $5 Preferido (30 días)',
    urgenciesLabel: 'Urgencias 2/año ($50) • ER/Amb. no incl.',
    bullets: [
      'Atención Ambulatoria y Estudios: Visita Primaria 4 al año ($25 copago), Especialista / Urgent Care 2 al año ($50). Laboratorio y diagnósticos no incluidos.',
      'Beneficios Hospitalarios: Hospitalización $1,000/día (máximo hospitalario $10,000 al año). Cirugía y Emergencia/Ambulancia no incluidas en este nivel.',
      'Farmacia (hasta 30 días): Genérico preventivo $0 y Genérico preferido $5 (Marca no cubierta).',
      AHW_PREVENTIVE_BULLET
    ]
  },
  ahw3: {
    level: 'ahw3',
    shortLabel: 'AHW 3',
    title: 'Plan de Salud AHW 3 Balance (Red First Health)',
    tierLabel: 'AHW 3 Balance • Red First Health PPO ($0 Deducible)',
    rates: { empleado: 179.99, pareja: 249.99, hijos: 235.99, familiar: 289.99 },
    moopLabel: 'Tope Hospital $15,000/año',
    pcpLabel: '4 al año ($25)',
    specialistLabel: '4 al año ($50)',
    rxLabel: '$0 Prev. / $5 Pref. / $40 Marca (30 días)',
    urgenciesLabel: 'Urgencias 4/año ($50) • ER/Amb. no incl.',
    bullets: [
      'Atención Ambulatoria y Estudios: Visita Primaria 4 al año ($25 copago), Especialista / Urgent Care 4 al año ($50). Laboratorio y diagnósticos no incluidos.',
      'Beneficios Hospitalarios: Hospitalización $1,000/día (máximo hospitalario $15,000 al año). Cirugía y Emergencia/Ambulancia no incluidas en este nivel.',
      'Farmacia (hasta 30 días): Genérico preventivo $0, Genérico preferido $5 y Marca (con autorización previa) $40.',
      AHW_PREVENTIVE_BULLET
    ]
  },
  ahw4: {
    level: 'ahw4',
    shortLabel: 'AHW 4',
    title: 'Plan de Salud AHW 4 Hospitalario (Red First Health)',
    tierLabel: 'AHW 4 Hospitalario • Red First Health PPO ($0 Deducible)',
    rates: { empleado: 199.99, pareja: 279.99, hijos: 269.99, familiar: 324.99 },
    moopLabel: 'Tope Hospital $10,000/año • Tope Cirugía $2,000/año',
    pcpLabel: '4 al año ($50) + Preventivo $0',
    specialistLabel: '4 al año ($75)',
    rxLabel: '$0 Prev. / $5 Pref. / $40 Marca (30 días)',
    urgenciesLabel: 'UC 4/año ($75) • ER $1,000 / Amb. $500',
    bullets: [
      'Atención Ambulatoria: Visita Primaria 4 al año ($50 copago), Especialista / Urgent Care 4 al año ($75 copago). Laboratorio y diagnósticos no incluidos.',
      'Beneficios Hospitalarios: Hospitalización $1,000/día (máximo hospitalario $10,000 al año). Cirugía hospitalaria o ambulatoria $1,000 (máximo $2,000 al año). Emergencia $1,000 y Ambulancia $500.',
      'Farmacia (hasta 30 días): Genérico preventivo $0, Genérico preferido $5 y Marca (con autorización previa) $40.',
      AHW_PREVENTIVE_BULLET
    ]
  },
  ahw5: {
    level: 'ahw5',
    shortLabel: 'AHW 5',
    title: 'Plan de Salud AHW 5 Premium (Red First Health)',
    tierLabel: 'AHW 5 Premium • Red First Health PPO ($0 Deducible)',
    rates: { empleado: 219.99, pareja: 319.99, hijos: 309.99, familiar: 374.99 },
    moopLabel: 'Tope Hospital $15,000/año • Tope Cirugía $4,500/año',
    pcpLabel: '5 al año ($50) + Preventivo $0',
    specialistLabel: '5 al año ($75)',
    rxLabel: '$0 Prev. / $5 Pref. / $40 Marca (30 días)',
    urgenciesLabel: 'UC 5/año ($75) • ER $1,000 / Amb. $500',
    bullets: [
      'Atención Ambulatoria: Visita Primaria 5 al año ($50 copago), Especialista / Urgent Care 5 al año ($75 copago). Laboratorio y diagnósticos no incluidos.',
      'Beneficios Hospitalarios: Hospitalización $1,500/día (máximo hospitalario $15,000 al año). Cirugía hospitalaria o ambulatoria $1,500 (máximo $4,500 al año). Emergencia $1,000 y Ambulancia $500.',
      'Farmacia (hasta 30 días): Genérico preventivo $0, Genérico preferido $5 y Marca (con autorización previa) $40.',
      AHW_PREVENTIVE_BULLET
    ]
  },
  ahw6: {
    level: 'ahw6',
    shortLabel: 'AHW 6',
    title: 'Plan de Salud AHW 6 Ambulatorio (Red First Health)',
    tierLabel: 'AHW 6 Ambulatorio • Red First Health PPO ($0 Deducible)',
    rates: { empleado: 199.99, pareja: 279.99, hijos: 279.99, familiar: 399.99 },
    moopLabel: 'Plan Ambulatorio (sin beneficio hospitalario)',
    pcpLabel: 'Copago $35 + Preventivo $0',
    specialistLabel: '$75 Especialista / $85 Urgent Care',
    rxLabel: '$0 Prev. / $5 Preferido (30 días)',
    urgenciesLabel: '$85 Urgent Care (ER/Amb. no incl.)',
    bullets: [
      'Atención Ambulatoria y Estudios: Visita Primaria copago $35, Especialista $75, Urgent Care $85. Laboratorio $50 y MRI $500.',
      'Beneficios Hospitalarios: Hospitalización, cirugía y emergencia/ambulancia no incluidos en este nivel ambulatorio.',
      'Farmacia (hasta 30 días): Genérico preventivo $0 y Genérico preferido $5 (Marca no cubierta).',
      AHW_PREVENTIVE_BULLET
    ]
  }
};

export const AHW4_OFFICIAL_BULLETS = AHW_SPECS.ahw4.bullets;

// ============================================================
// 4. MEDACCESS MVP (BASIC & PRO • RED FIRST HEALTH • POR EDAD)
// ============================================================

export interface MedAccessSpec {
  level: MedAccessLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  moopLabel: string;
  rates: Record<MedAccessAgeBracket, Record<EnrollFamilyTier, number>>;
  pcpLabel: string;
  specialistLabel: string;
  rxLabel: string;
  urgenciesLabel: string;
  bullets: string[];
}

export const MEDACCESS_SPECS: Record<MedAccessLevel, MedAccessSpec> = {
  basic: {
    level: 'basic',
    title: 'MedAccess MVP Basic (Red First Health)',
    shortLabel: 'MVP Basic',
    tierLabel: 'MVP Basic • Red First Health PPO ($0 Deducible)',
    moopLabel: '$7,350 Individual ($0 Deducible)',
    rates: {
      '18-45': { empleado: 432.84, pareja: 776.12, hijos: 670.15, familiar: 997.01 },
      '46-64': { empleado: 550.0, pareja: 878.57, hijos: 777.14, familiar: 1090.0 }
    },
    pcpLabel: '6 consultas ($25 copago)',
    specialistLabel: '$50 copago (6 al año, no hosp.)',
    rxLabel: 'Genérica no prev. $10 copago',
    urgenciesLabel: 'UC $50 (2/año) / Amb. $250 (1/año)',
    bullets: [
      'Consultas y Ambulatorio ($0 Deducible): Visitas primarias 6 consultas con $25 copago. Especialista (no hospitalario) $50 copago (6 al año). Urgent Care $50 (2/año) y Ambulancia $250 (1/año). Incluye Telemedicina RelyMD $0 y Bill Negotiator.',
      'Estudios, Terapias y Farmacia: Laboratorio / Rayos X $50 copago (3 al año). CT / MRI / PET Scan $350 copago (1 al año). Rehabilitación física/terapias $50 copago (6 al año). Home Health Care $25 copago (5 al año). Farmacia genérica no preventiva $10 copago.',
      'Hospitalización, Cirugía y Maternidad: Hospitalización hasta 3 días cubiertos por año ($350 copago). Cirugía ambulatoria: 1 procedimiento por año ($350). Maternidad: No cubierta en MVP Basic. Nota: El Out-of-Pocket ($7,350 Ind.) no elimina los topes de días.'
    ]
  },
  pro: {
    level: 'pro',
    title: 'MedAccess MVP Pro (Red First Health)',
    shortLabel: 'MVP Pro',
    tierLabel: 'MVP Pro • Red First Health PPO ($0 Deducible)',
    moopLabel: '$5,000 Individual ($0 Deducible)',
    rates: {
      '18-45': { empleado: 567.16, pareja: 1097.01, hijos: 886.57, familiar: 1455.22 },
      '46-64': { empleado: 714.29, pareja: 1221.43, hijos: 1020.0, familiar: 1564.29 }
    },
    pcpLabel: '12 consultas ($15 copago)',
    specialistLabel: '$25 copago (12 al año, no hosp.)',
    rxLabel: 'Genérica no prev. 20% copago',
    urgenciesLabel: 'UC $35 (3/año) / Amb. $250 (2/año)',
    bullets: [
      'Consultas y Ambulatorio ($0 Deducible): Visitas primarias 12 consultas con $15 copago. Especialista (no hospitalario) $25 copago (12 al año). Urgent Care $35 (3/año) y Ambulancia $250 (2/año). Incluye Telemedicina RelyMD $0 y Bill Negotiator.',
      'Estudios, Terapias y Farmacia: Laboratorio / Rayos X $50 copago (4 al año). CT / MRI / PET Scan $350 copago (3 al año). Rehabilitación física/terapias $50 copago (12 al año). Home Health Care $25 copago (20 al año). Farmacia genérica no preventiva 20% copago.',
      'Hospitalización, Cirugía y Maternidad: Hospitalización hasta 10 días cubiertos por año ($350 copago). Cirugías ambulatorias: 2 procedimientos por año ($350). Maternidad: Cubierta ($350 tras espera de 12 meses). Máximo de Bolsillo: $5,000 Individual.'
    ]
  }
};

// ============================================================
// 5. BMI-PHCS (BASIC / VALUE / ADVANTAGE • RED PHCS)
// ============================================================

export interface BmiPhcsSpec {
  level: BmiPhcsLevel;
  title: string;
  shortLabel: string;
  tierLabel: string;
  moopLabel: string;
  pcpLabel: string;
  specialistLabel: string;
  urgenciesLabel: string;
  bullets: string[];
}

export const BMI_PHCS_SPECS: Record<BmiPhcsLevel, BmiPhcsSpec> = {
  basic: {
    level: 'basic',
    title: 'BMI-PHCS Basic (Red PHCS)',
    shortLabel: 'Basic',
    tierLabel: 'BMI-PHCS Basic • Beneficio Limitado por Día ($0 Deducible)',
    moopLabel: '$8,700 Individual / $17,400 Familiar',
    pcpLabel: '$25 copago (8 visitas/año)',
    specialistLabel: '$50 copago (8 visitas/año, incl. salud mental)',
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
    moopLabel: '$5,000 Individual / $10,000 Familiar',
    pcpLabel: '$15 copago (10 visitas/año)',
    specialistLabel: '$25 copago (10 visitas/año, incl. salud mental)',
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
    moopLabel: '$5,000 Individual / $10,000 Familiar',
    pcpLabel: '$15 copago (12 visitas/año)',
    specialistLabel: '$25 copago (12 visitas/año, incl. salud mental)',
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

export const detectAhwLevelFromText = (text: string): AhwPlanLevel => {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('ahw 1') || lower.includes('ahw1') || lower.includes('básico') || lower.includes('basico')) return 'ahw1';
  if (lower.includes('ahw 2') || lower.includes('ahw2') || lower.includes('plus')) return 'ahw2';
  if (lower.includes('ahw 3') || lower.includes('ahw3') || lower.includes('balance')) return 'ahw3';
  if (lower.includes('ahw 5') || lower.includes('ahw5') || lower.includes('premium')) return 'ahw5';
  if (lower.includes('ahw 6') || lower.includes('ahw6') || lower.includes('ambulatorio')) return 'ahw6';
  return 'ahw4';
};

export const isMedMaxPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'medmax') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('medmax');
};

export const isHpgPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'hpg4000') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('protectorguard') || /\bhpg\b/.test(text);
};

export const isAhwPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'ahw4') return true;
  const text = `${plan.company} ${plan.planName}`.toLowerCase();
  return /\bahw\s*[1-6]\b/.test(text) || /\bahw[1-6]\b/.test(text);
};

export const isAhw4Plan = isAhwPlan;

export const isMedAccessPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'medaccess') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('medaccess') || text.includes('mvp basic') || text.includes('mvp pro');
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
  if (isHpgPlan(plan)) {
    const level = plan.hpgLevel || detectHpgLevelFromText(`${plan.planName} ${plan.tier}`);
    return HPG_SPECS[level].bullets;
  }
  if (isMedMaxPlan(plan)) {
    return MEDMAX_OFFICIAL_BULLETS;
  }
  if (isAhwPlan(plan)) {
    const level = plan.ahwLevel || detectAhwLevelFromText(`${plan.planName} ${plan.tier}`);
    return AHW_SPECS[level].bullets;
  }
  if (isMedAccessPlan(plan)) {
    const lower = `${plan.planName} ${plan.tier}`.toLowerCase();
    const level: MedAccessLevel = plan.medaccessLevel || (lower.includes('pro') ? 'pro' : 'basic');
    return MEDACCESS_SPECS[level].bullets;
  }
  if (isBmiPhcsPlan(plan)) {
    const lower = `${plan.planName} ${plan.tier}`.toLowerCase();
    const level: BmiPhcsLevel =
      plan.bmiLevel || (lower.includes('advantage') ? 'advantage' : lower.includes('value') ? 'value' : 'basic');
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

  if (isAhwPlan(plan)) {
    const level = plan.ahwLevel || detectAhwLevelFromText(`${plan.planName} ${plan.tier}`);
    const spec = AHW_SPECS[level];
    return {
      ...plan,
      planCategory: 'ahw4',
      ahwLevel: level,
      company: `${spec.shortLabel} (Red First Health)`,
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `RED FIRST HEALTH PPO • RELYMD $0 • ${spec.shortLabel.toUpperCase()}`,
      premium: parseMoney(plan.premium) > 0 ? plan.premium : spec.rates[famTier].toFixed(2),
      deductible: '$0',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: 'Incluye Red First Health, Telemedicina RelyMD $0 y Bill Negotiator.',
      hasSanitasFee: false
    };
  }

  if (isMedAccessPlan(plan)) {
    const lower = `${plan.planName} ${plan.tier}`.toLowerCase();
    const level: MedAccessLevel = plan.medaccessLevel || (lower.includes('pro') ? 'pro' : 'basic');
    const ageBracket: MedAccessAgeBracket = plan.medaccessAgeBracket || detectMedAccessAgeBracket(context?.ages || '');
    const spec = MEDACCESS_SPECS[level];
    return {
      ...plan,
      planCategory: 'medaccess',
      medaccessLevel: level,
      medaccessAgeBracket: ageBracket,
      company: 'MedAccess MVP (Red First Health)',
      planName: spec.title,
      tier: `${spec.shortLabel} • Edad ${ageBracket} años`,
      subtitleTag: `MEDACCESS ${spec.shortLabel.toUpperCase()} • RED FIRST HEALTH • $0 DEDUCIBLE`,
      premium: parseMoney(plan.premium) > 0 ? plan.premium : spec.rates[ageBracket][famTier].toFixed(2),
      deductible: '$0 (Sin deducible)',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: 'Red First Health PPO + Telemedicina RelyMD $0 + Bill Negotiator.',
      hasSanitasFee: false
    };
  }

  if (isBmiPhcsPlan(plan)) {
    const lower = `${plan.planName} ${plan.tier}`.toLowerCase();
    const level: BmiPhcsLevel =
      plan.bmiLevel || (lower.includes('advantage') ? 'advantage' : lower.includes('value') ? 'value' : 'basic');
    const spec = BMI_PHCS_SPECS[level];
    return {
      ...plan,
      planCategory: 'bmi_phcs',
      bmiLevel: level,
      company: 'BMI-PHCS (Red PHCS)',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `RED PHCS • PLAN DE BENEFICIO LIMITADO POR DÍA • ${spec.shortLabel.toUpperCase()}`,
      deductible: '$0 Ind. / $0 Fam.',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: 'Telemedicina $0 ilimitada',
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: 'Plan de beneficio limitado por día bajo Red PHCS (no es seguro médico mayor tradicional).',
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
  sanitasAvailability: 'plus_fl' | 'essential_az_tx' | 'regional_access' | 'verify_zip';
  sanitasNote: string;
  hpgRestrictedState: boolean;
  hpgNote: string;
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
    'Sanitas Care opera principalmente en FL, TX, AZ, NJ, CT y TN. Verifica cobertura exacta del centro Sanitas para este ZIP Code.';

  if (stateCode === 'FL') {
    sanitasAvailability = 'plus_fl';
    sanitasNote = isSouthFlorida
      ? `ZIP ${zipCode || 'Sur de FL'} validado: Sanitas Care Plus disponible (+50 centros médicos en Florida; dental y 2 urgencias/año $0 en centros del sur de FL).`
      : `Estado FL (${zipCode || 'Florida'}): Sanitas Care Plus disponible en zonas con centros médicos Sanitas (validar clínica cercana al ZIP).`;
  } else if (stateCode === 'TX' || stateCode === 'AZ') {
    sanitasAvailability = 'essential_az_tx';
    sanitasNote = `Estado ${stateCode} (${zipCode || stateCode}): Disponible Sanitas Care Essential / Access según cobertura de centros en el ZIP.`;
  } else if (stateCode === 'NJ' || stateCode === 'CT' || stateCode === 'TN') {
    sanitasAvailability = 'regional_access';
    sanitasNote = `Estado ${stateCode}: Disponibilidad regional de Sanitas Access; confirmar centro médico Sanitas activo en el ZIP Code ${zipCode || ''}.`;
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

  const hpgNote = hpgRestrictedState
    ? `Variación estatal (${stateCode}): Verificar reglas locales de HPG.${hwDetail}`
    : stateCode
      ? `Estado ${stateCode}: HPG, HospitalWise${hwAvailable ? ' (disponible)' : ' (no disponible)'}, MedMax, AHW 1-6, MedAccess MVP, BMI-PHCS, AFI y ACUSA habilitados según edad.${hwDetail}`
      : 'Ingresa un Estado o ZIP Code de 5 dígitos para validar disponibilidad regional.';

  let ageNote = '';
  if (hasSenior65Plus) {
    ageNote =
      'Edad 65+ detectada: HPG, MedMax (18-64), MedAccess (18-64) y planes ACA aplican normalmente hasta los 64 años (evaluar Medicare para 65+).';
  } else if (ages.length > 0) {
    const adults = ages.filter(a => a >= 18).length;
    const kids = ages.filter(a => a < 18).length;
    const medmaxRange = detectMedMaxAgeBracket(agesStr);
    const medaccessRange = detectMedAccessAgeBracket(agesStr);
    ageNote = `Edades validadas (${ages.join(', ')} años): ${adults} adulto(s) y ${kids} menor(es) • Rango MedMax: ${medmaxRange} | MedAccess: ${medaccessRange}.`;
  } else {
    ageNote = 'Agrega las edades de los solicitantes para calcular tarifas por edad en MedMax y MedAccess MVP.';
  }

  return {
    zipCode,
    detectedState: stateCode,
    isSouthFlorida,
    sanitasAvailability,
    sanitasNote,
    hpgRestrictedState,
    hpgNote,
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
