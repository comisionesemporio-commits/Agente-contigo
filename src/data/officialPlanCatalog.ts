import { HpgPlanLevel, QuotePlan, QuotePlanCategory } from '../types';

export const MEDMAX_DEFAULT_WARNING =
  'Todos los copagos detallados aplican DESPUÉS de cumplir el deducible anual seleccionado hasta alcanzar el máximo de bolsillo (excepto cuidado preventivo y telemedicina a $0 inmediato).';

export const SANITAS_FEE_AMOUNT = 40;

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
// FICHAS CERRADAS OFICIALES POR PLAN (CERO MEZCLAS / CERO INVENTOS)
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

export const SANITAS_OFFICIAL_BULLETS: string[] = [
  'Atención Primaria y Centros: Visitas presenciales y virtuales ilimitadas con médico primario (PCP) en más de 50 centros médicos Sanitas en Florida, sin deducibles ni copagos en los servicios incluidos.',
  'Laboratorios y Urgencias: Análisis de sangre a $0 cada 6 meses y 2 visitas de atención urgente al año a $0 en centros Sanitas del sur de Florida.',
  'Farmacia y Dental: Medicamentos genéricos desde $5 (suministro de 30 días); evaluación y limpiezas dentales a $0 más descuentos en tratamientos (solo en consultorios dentales Sanitas del sur de Florida).',
  'Especialistas, Bienestar y Hospitales: Tarifas preferenciales en especialistas (cardiología, ortopedia, oncología, neurología, gastroenterología, etc., con 10% a 40% de descuento), evaluación nutricional, bienestar emocional, evaluación de movilidad anual, orientación de atención y ayuda para negociar facturas hospitalarias.'
];

export const MEDMAX_OFFICIAL_BULLETS: string[] = [
  'Sin Deducible ($0 Inmediato): Cuidado preventivo y telemedicina 24/7 (consultas virtuales primarias, urgencias virtuales y salud mental por RelyMD) a $0 copago, más medicamentos genéricos preventivos a $0.',
  'Ambulatorio y Diagnóstico (Tras Cumplir Deducible): Médico primario, especialista y urgencias a $50/visita (máx. 10 visitas combinadas/año; quiropráctico hasta 12 visitas/año). Laboratorio simple a $25 y radiología simple a $50 en centros no hospitalarios (límite 3/año). Imágenes avanzadas (MRI, CT, PET) a $200 copago (requiere autorización médica previa).',
  'Emergencias, Hospitalización y Cirugías (Tras Cumplir Deducible): Sala de Emergencias (ER) / ambulancia a $250 copago (2 admisiones por enfermedad, 2 por accidente y 2 transportes/año). Cirugía en consultorio y ambulatoria a $250 copago (hasta 3/año; incluye cirujano, anestesia y gastos de sala; no electivas). Hospitalización y cirugía internado a $1,000 copago (hasta 2 admisiones/año, máx. 10 días por internación; 2 cirugías con internación cubiertas). Maternidad: parto vaginal $250 / cesárea $500 (espera 12 meses; prenatal/postnatal y labs 100% cubiertos). Quimioterapia $100 (10 visitas), Terapias físicas/ocupacionales $50 (16 visitas), Salud mental $50 (15 días).'
];

export const AHW4_OFFICIAL_BULLETS: string[] = [
  'Beneficios Hospitalarios: Hospitalización $1,000/día (máximo hospitalario $10,000 al año). Cirugía hospitalaria o ambulatoria $1,000 (máximo $2,000 al año). Emergencia $1,000 y Ambulancia $500.',
  'Farmacia (hasta 30 días): Genérico preventivo $0, Genérico preferido $5 y Marca (con autorización previa) $40.',
  'Cuidado Preventivo (en centros no hospitalarios de la red First Health): Examen físico anual (1/año), Mamografía 2D (mujeres 50+, c/2 años), Papanicolaou (mujeres 21-65, c/3 años), Presión/Diabetes (adultos en riesgo, 1/año), Cáncer colorrectal (adultos 50-75, kit en casa c/5 años) y Control Niño Sano (1/año, + si <3 años).'
];

export const HOSPITALWISE_OFFICIAL_BULLETS: string[] = [
  'Beneficios en Efectivo (Hospital, Observación y UCI): Confinamiento hospitalario $1,000/día (máx. 10 días por período de confinamiento), Observación hospitalaria $1,000/día (máx. 4 días/año) y Confinamiento en UCI $1,000/día (máx. 10 días por período de confinamiento).',
  'Respaldo Adicional: Emergencias (ER) $500/día, Urgencias (UC) $250/día, Consultorio $100/día (máx. 4 días/año), cirugía ambulatoria $1,000/día, diagnóstico $500/día y ambulancia terrestre ($250) / aérea ($2,500).'
];

// ============================================================
// DETECTORES DETERMINÍSTICOS Y REGLAS POR PLAN
// ============================================================

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

export const isAhw4Plan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'ahw4') return true;
  const text = `${plan.company} ${plan.planName}`.toLowerCase();
  return text.includes('ahw 4') || text.includes('ahw4');
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

export const getPlanFirstMonth = (plan: QuotePlan): number => {
  return parseMoney(plan.premium) + getPlanSanitasFee(plan);
};

// Construye viñetas limpias y ejecutivas SIN REPETIR párrafos ni mezclar planes
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
  if (isAhw4Plan(plan)) {
    return AHW4_OFFICIAL_BULLETS;
  }
  if (isHospitalWisePlan(plan)) {
    return HOSPITALWISE_OFFICIAL_BULLETS;
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

  // Fallback para planes personalizados sin categoría cerrada
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

// Aplica la ficha cerrada oficial sobre un plan extraído por IA (garantiza 0 inventos / 0 mezclas)
export const enforceOfficialCatalogOnPlan = (plan: QuotePlan): QuotePlan => {
  if (isMedMaxPlan(plan)) {
    return {
      ...plan,
      planCategory: 'medmax',
      company: 'MedMax',
      planName: plan.planName?.toLowerCase().includes('medmax') ? plan.planName : 'Plan MedMax',
      tier: plan.tier || 'Deductible Value Plan',
      subtitleTag: 'DEDUCTIBLE VALUE PLAN • COPAGOS APLICAN TRAS DEDUCIBLE',
      moop: plan.moop || '$7,500',
      primaryCare: '$50 (tras deducible)',
      specialist: '$50 (tras deducible)',
      genericRx: '$0 preventivos',
      urgencies: '$50 UC / $250 ER (tras deducible)',
      deductibleWarning: MEDMAX_DEFAULT_WARNING,
      highlights: MEDMAX_OFFICIAL_BULLETS,
      extraBenefit: 'Preventivo y telemedicina 24/7 (RelyMD) a $0 inmediato; copagos detallados aplican tras cumplir el deducible anual.',
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

  if (isAhw4Plan(plan)) {
    return {
      ...plan,
      planCategory: 'ahw4',
      company: 'AHW 4 (Red First Health)',
      planName: 'Plan de Salud AHW 4 (Red First Health)',
      tier: 'Red First Health • Beneficios Hospitalarios, Farmacia y Prevención',
      subtitleTag: 'RED FIRST HEALTH • HOSPITALIZACIÓN $1,000/DÍA • FARMACIA $0/$5/$40',
      deductible: '$0',
      moop: 'Tope Hospital $10,000/año • Tope Cirugía $2,000/año',
      primaryCare: 'Cuidado preventivo $0 (red First Health, no hospital)',
      specialist: 'Según red First Health',
      genericRx: '$0 Prev. / $5 Pref. / $40 Marca (30 días)',
      urgencies: 'Emergencia $1,000 / Ambulancia $500',
      highlights: AHW4_OFFICIAL_BULLETS,
      extraBenefit: 'Cuidado preventivo incluido en centros no hospitalarios de la red First Health.',
      hasSanitasFee: false
    };
  }

  if (isHospitalWisePlan(plan)) {
    return {
      ...plan,
      planCategory: 'hospitalwise',
      company: 'Golden Rule Insurance Company',
      planName: 'HospitalWise® Bundle 1',
      tier: 'Indemnización Hospitalaria en Efectivo',
      subtitleTag: 'GOLDEN RULE INSURANCE COMPANY • RESPALDO HOSPITALARIO EN EFECTIVO',
      deductible: '$0 (Sin deducible)',
      moop: 'Hospital/UCI $1,000/día (máx. 10 días) • Observación $1,000/día (máx. 4 días/año)',
      primaryCare: '$100/día consultorio (máx. 4 días/año)',
      specialist: '$100/día médico',
      genericRx: 'No aplica',
      urgencies: 'ER $500/día • UC $250/día',
      highlights: HOSPITALWISE_OFFICIAL_BULLETS,
      extraBenefit: 'Pagos fijos directos en efectivo por confinamiento, observación, UCI, ER, UC, cirugía y ambulancia.',
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
    if (upper.includes('FLORIDA') || /\bFL\b/.test(upper)) stateCode = 'FL';
    else if (upper.includes('TEXAS') || /\bTX\b/.test(upper)) stateCode = 'TX';
    else if (upper.includes('ARIZONA') || /\bAZ\b/.test(upper)) stateCode = 'AZ';
    else if (upper.includes('NEW JERSEY') || /\bNJ\b/.test(upper)) stateCode = 'NJ';
    else if (upper.includes('CONNECTICUT') || /\bCT\b/.test(upper)) stateCode = 'CT';
    else if (upper.includes('TENNESSEE') || /\bTN\b/.test(upper)) stateCode = 'TN';
    else if (upper.includes('GEORGIA') || /\bGA\b/.test(upper)) stateCode = 'GA';
    else if (upper.includes('NORTH CAROLINA') || /\bNC\b/.test(upper)) stateCode = 'NC';
    else if (upper.includes('SOUTH CAROLINA') || /\bSC\b/.test(upper)) stateCode = 'SC';
    else if (upper.includes('NEW YORK') || /\bNY\b/.test(upper)) stateCode = 'NY';
    else if (upper.includes('CALIFORNIA') || /\bCA\b/.test(upper)) stateCode = 'CA';
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
  const ages = (String(agesStr || '').match(/\d+/g) || [])
    .map(n => parseInt(n, 10))
    .filter(n => n >= 0 && n <= 110);

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
  const hpgNote = hpgRestrictedState
    ? `Variación estatal (${stateCode}): Verificar disponibilidad y reglas locales de HPG / HospitalWise (Golden Rule) antes de emitir.`
    : stateCode
      ? `Estado ${stateCode}: HPG (2000/4000/5000), HospitalWise y AHW 4 habilitados según suscripción y edad.`
      : 'Ingresa un Estado o ZIP Code de 5 dígitos para validar disponibilidad regional.';

  let ageNote = '';
  if (hasSenior65Plus) {
    ageNote =
      'Edad 65+ detectada: HPG y planes ACA individuales aplican normalmente hasta los 64 años (evaluar Medicare para 65+).';
  } else if (ages.length > 0) {
    const adults = ages.filter(a => a >= 18).length;
    const kids = ages.filter(a => a < 18).length;
    ageNote = `Edades validadas (${ages.join(', ')} años): ${adults} adulto(s) y ${kids} menor(es) elegibles.`;
  } else {
    ageNote = 'Agrega las edades de los solicitantes para validar elegibilidad (<65 años, niños).';
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
  const ages = (String(agesText || '').match(/\d+/g) || [])
    .map(n => parseInt(n, 10))
    .filter(n => n >= 0 && n <= 110);

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
