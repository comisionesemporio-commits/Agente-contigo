import React, { useState, useEffect, useRef } from 'react';
import { QuotePlan, QuotePlanCategory, SavedQuote } from '../types';
import {
  Sparkles, Upload, Copy, Printer, Save, Trash2, Globe, FileText,
  Key, RefreshCw, Eye, X, Send, Plus, Mail, AlertTriangle,
  ShieldCheck, CheckCircle2, Layers, MapPin, Users
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import {
  getGeminiApiKey, setGeminiApiKey, loadQuotes, saveQuotes
} from '../services/storage';
import { initSupabase } from '../services/supabase';

// Modelos oficiales activos de Google Gemini Flash compatibles con generateContent en v1beta
const SUPPORTED_GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite'
];

const sleepMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableGeminiError = (err: any): boolean => {
  const msg = String(err?.message || err || '').toLowerCase();
  if (msg.includes('api_key_invalid') || msg.includes('api key not valid')) {
    return false;
  }
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('500') ||
    msg.includes('internal') ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('not supported for generatecontent') ||
    msg.includes('fetch') ||
    msg.includes('network')
  );
};

const formatFriendlyGeminiError = (err: any): string => {
  const raw = String(err?.message || err || 'Error desconocido');
  const lower = raw.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
    return 'Tu API Key de Gemini no es válida. Verifica la clave en "IA Conectada".';
  }
  if (lower.includes('503') || lower.includes('high demand') || lower.includes('unavailable')) {
    return 'Los servidores de Google Gemini están saturados temporalmente (alta demanda). Intenta nuevamente en unos segundos.';
  }
  if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
    return 'Se alcanzó el límite temporal de solicitudes de tu clave Gemini. Espera un minuto e intenta de nuevo.';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'No se encontró un modelo compatible disponible para esta clave de Gemini.';
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) return parsed.error.message;
  } catch (_) {}
  return raw;
};

const MEDMAX_DEFAULT_WARNING =
  'IMPORTANTE: Todos los copagos y beneficios detallados aplican ÚNICAMENTE DESPUÉS de cumplir el deducible anual seleccionado (excepto cuidado preventivo y telemedicina 24/7 RelyMD a $0 copago).';

const SANITAS_FEE_AMOUNT = 40;

const FAMILY_GROUP_PRESETS = [
  'Individual (Solo Adulto)',
  'Pareja (2 Adultos)',
  'Titular + 1 Niño',
  'Familia (2 Adultos + 1 Niño)',
  'Familia (2 Adultos + 2 Niños)',
  'Solo Niño'
];

const parseMoney = (val?: string | number): number => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val || '').replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const formatMoney = (val: number): string => {
  return (Number.isFinite(val) ? val : 0).toFixed(2);
};

const isMedMaxPlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'medmax') return true;
  const text = `${plan.company} ${plan.planName} ${plan.tier}`.toLowerCase();
  return text.includes('medmax');
};

const isSanitasPlan = (plan: QuotePlan): boolean => {
  if (plan.hasSanitasFee) return true;
  if (plan.planCategory === 'sanitas' || plan.planCategory === 'sanitas_bundle') return true;
  const text = `${plan.company} ${plan.planName}`.toLowerCase();
  return text.includes('sanitas');
};

const isHospitalWisePlan = (plan: QuotePlan): boolean => {
  if (plan.planCategory === 'hospitalwise') return true;
  const text = `${plan.company} ${plan.planName}`.toLowerCase();
  return text.includes('hospitalwise') && !text.includes('sanitas');
};

const getPlanSanitasFee = (plan: QuotePlan): number => {
  if (plan.hasSanitasFee === true) {
    return parseMoney(plan.enrollmentFee || SANITAS_FEE_AMOUNT) || SANITAS_FEE_AMOUNT;
  }
  if (plan.hasSanitasFee === false) return 0;
  if (isSanitasPlan(plan)) return SANITAS_FEE_AMOUNT;
  return 0;
};

const getPlanFirstMonth = (plan: QuotePlan): number => {
  return parseMoney(plan.premium) + getPlanSanitasFee(plan);
};

const getPlanHighlights = (plan: QuotePlan): string[] => {
  if (Array.isArray(plan.highlights) && plan.highlights.length > 0) {
    return plan.highlights.filter(h => h && h.trim().length > 0);
  }

  const items: string[] = [];
  if (plan.planCategory === 'aca') {
    items.push(
      `Deducible y Máximo de Bolsillo: Deducible anual de ${plan.deductible || '$0'} y gasto máximo anual de bolsillo (Out-of-Pocket Max) de ${plan.moop || 'consultar'}.`
    );
    items.push(
      `Copagos desde el Día 1: Médico primario ${plan.primaryCare || '$0'}, especialista ${plan.specialist || '$0'}, medicamentos genéricos ${plan.genericRx || '$0'} y sala de urgencias ${plan.urgencies || '$0'}.`
    );
    if (plan.subsidyAmount) {
      items.push(`Crédito Fiscal / Subsidio ACA Aplicado: ${plan.subsidyAmount} aplicado directamente para reducir su prima mensual.`);
    }
  } else {
    if (plan.clientSummary) items.push(plan.clientSummary);
    if (plan.extraBenefit) items.push(plan.extraBenefit);
  }
  return items;
};

// Detección de Estado / ZIP Code y Edades
interface GeoAgeAnalysis {
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

const detectStateAndZip = (locationStr: string): { zipCode: string; stateCode: string; isSouthFlorida: boolean } => {
  const loc = String(locationStr || '').trim();
  const upper = loc.toUpperCase();
  const zipMatch = loc.match(/\b(\d{5})\b/);
  const zipCode = zipMatch ? zipMatch[1] : '';
  const zipNum = zipCode ? parseInt(zipCode, 10) : 0;

  // Map by ZIP prefix first, then text
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

const evaluateGeoAndAgeEligibility = (locationStr: string, agesStr: string): GeoAgeAnalysis => {
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
      ? `ZIP ${zipCode || 'Sur de FL'} validado: Sanitas Care Plus disponible (+50 centros médicos en Florida; incluye dental y urgencias $0 en centros del sur de FL).`
      : `Estado FL (${zipCode || 'Florida'}): Sanitas Care Plus disponible en zonas con centros médicos Sanitas (validar centro más cercano al ZIP).`;
  } else if (stateCode === 'TX' || stateCode === 'AZ') {
    sanitasAvailability = 'essential_az_tx';
    sanitasNote = `Estado ${stateCode} (${zipCode || stateCode}): Disponible Sanitas Care Essential (desde $60/mes) y Access según cobertura de centros en el ZIP.`;
  } else if (stateCode === 'NJ' || stateCode === 'CT' || stateCode === 'TN') {
    sanitasAvailability = 'regional_access';
    sanitasNote = `Estado ${stateCode}: Disponibilidad regional de Sanitas Access; confirmar centro médico Sanitas activo en el ZIP Code ${zipCode || ''}.`;
  }

  const restrictedStatesHPG = ['NY', 'CA', 'MA', 'WA', 'VT', 'NH', 'NJ', 'MN', 'OR', 'CT', 'DC', 'CO', 'NM', 'RI', 'HI'];
  const hpgRestrictedState = Boolean(stateCode && restrictedStatesHPG.includes(stateCode));
  const hpgNote = hpgRestrictedState
    ? `Variación estatal (${stateCode}): Verificar disponibilidad y reglas locales de HPG Preferred 4000 / HospitalWise (Golden Rule) antes de emitir.`
    : stateCode
      ? `Estado ${stateCode}: HPG Preferred 4000 / HospitalWise (Golden Rule) y AHW 4 habilitados según suscripción y rango de edad.`
      : 'Ingresa un Estado o ZIP Code de 5 dígitos para validar disponibilidad regional de Sanitas Care y HPG.';

  let ageNote = '';
  if (hasSenior65Plus) {
    ageNote =
      'Edad 65+ detectada: HPG Preferred 4000 / HospitalWise y planes ACA individuales aplican normalmente hasta los 64 años (evaluar Medicare para 65+).';
  } else if (ages.length > 0) {
    const adults = ages.filter(a => a >= 18).length;
    const kids = ages.filter(a => a < 18).length;
    ageNote = `Edades validadas (${ages.join(', ')} años): ${adults} adulto(s) y ${kids} menor(es) elegibles para cotización.`;
  } else {
    ageNote = 'Agrega las edades de los solicitantes para validar elegibilidad por edad (<65 años, niños, tarifa por edad).';
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

// Tarifas oficiales Sanitas Care según Grupo Familiar y Estado/ZIP
interface SanitasPricingResult {
  tierLabel: string;
  planEdition: 'Plus' | 'Essential';
  monthlyPrice: string;
  summaryText: string;
}

const getSanitasPricingForFamily = (
  membersText: string,
  locationText: string,
  agesText: string,
  forceEdition?: 'Plus' | 'Essential'
): SanitasPricingResult => {
  const { stateCode } = detectStateAndZip(locationText);
  const useEssential = forceEdition ? forceEdition === 'Essential' : stateCode === 'AZ' || stateCode === 'TX';
  const edition: 'Plus' | 'Essential' = useEssential ? 'Essential' : 'Plus';

  const m = String(membersText || '').toLowerCase();
  const ages = (String(agesText || '').match(/\d+/g) || [])
    .map(n => parseInt(n, 10))
    .filter(n => n >= 0 && n <= 110);

  // Detección explícita por texto de Grupo Familiar
  let groupKey:
    | 'solo_adulto'
    | 'solo_nino'
    | 'pareja'
    | 'titular_1_nino'
    | '1a_2n'
    | '1a_3n'
    | '2a_1n'
    | '2a_2n'
    | '2a_3n' = 'solo_adulto';

  if (m.includes('solo niño') || m.includes('solo nino') || (m.includes('1 niño') && !m.includes('adulto') && !m.includes('titular') && !m.includes('pareja'))) {
    groupKey = 'solo_nino';
  } else if (
    m.includes('2 adultos + 3') ||
    m.includes('pareja + 3') ||
    m.includes('5 personas') ||
    m.includes('6 personas')
  ) {
    groupKey = '2a_3n';
  } else if (m.includes('2 adultos + 2') || m.includes('pareja + 2') || m.includes('4 personas')) {
    groupKey = '2a_2n';
  } else if (m.includes('2 adultos + 1') || m.includes('pareja + 1') || m.includes('3 personas')) {
    groupKey = '2a_1n';
  } else if (m.includes('1 adulto + 3') || m.includes('titular + 3')) {
    groupKey = '1a_3n';
  } else if (m.includes('1 adulto + 2') || m.includes('titular + 2')) {
    groupKey = '1a_2n';
  } else if (
    m.includes('titular + 1') ||
    m.includes('titular + niño') ||
    m.includes('titular + nino') ||
    m.includes('1 adulto + 1') ||
    (m.includes('2 personas') && (m.includes('niño') || m.includes('nino') || m.includes('hijo')))
  ) {
    groupKey = 'titular_1_nino';
  } else if (
    m.includes('pareja') ||
    m.includes('2 adultos') ||
    m.includes('esposos') ||
    m.includes('2 personas')
  ) {
    groupKey = 'pareja';
  } else if (m.includes('familia')) {
    // Si escribió "Familia" genérico y puso edades, contar adultos/niños
    if (ages.length >= 4) groupKey = '2a_2n';
    else groupKey = '2a_1n';
  } else if (
    m.includes('individual') ||
    m.includes('solo adulto') ||
    m.includes('1 adulto') ||
    m.includes('1 persona')
  ) {
    groupKey = 'solo_adulto';
  } else if (ages.length > 0) {
    const adults = ages.filter(a => a >= 18).length;
    const kids = ages.filter(a => a < 18).length;
    if (adults === 0 && kids >= 1) groupKey = 'solo_nino';
    else if (adults === 1 && kids === 0) groupKey = 'solo_adulto';
    else if (adults === 1 && kids === 1) groupKey = 'titular_1_nino';
    else if (adults === 1 && kids === 2) groupKey = '1a_2n';
    else if (adults === 1 && kids >= 3) groupKey = '1a_3n';
    else if (adults >= 2 && kids === 0) groupKey = 'pareja';
    else if (adults >= 2 && kids === 1) groupKey = '2a_1n';
    else if (adults >= 2 && kids === 2) groupKey = '2a_2n';
    else groupKey = '2a_3n';
  }

  const plusPrices: Record<typeof groupKey, { label: string; price: string }> = {
    solo_adulto: { label: 'Individual (Solo Adulto)', price: '89.00' },
    solo_nino: { label: 'Solo Niño', price: '59.00' },
    pareja: { label: 'Pareja (2 Adultos)', price: '159.00' },
    titular_1_nino: { label: 'Titular + 1 Niño', price: '125.00' },
    '1a_2n': { label: '1 Adulto + 2 Niños', price: '170.00' },
    '1a_3n': { label: '1 Adulto + 3 Niños', price: '215.00' },
    '2a_1n': { label: 'Familia (2 Adultos + 1 Niño)', price: '195.00' },
    '2a_2n': { label: 'Familia (2 Adultos + 2 Niños)', price: '240.00' },
    '2a_3n': { label: 'Familia (2 Adultos + 3 Niños)', price: '285.00' }
  };

  const essentialPrices: Record<typeof groupKey, { label: string; price: string }> = {
    solo_adulto: { label: 'Individual (Solo Adulto • AZ/TX)', price: '60.00' },
    solo_nino: { label: 'Solo Niño (AZ/TX)', price: '40.00' },
    pareja: { label: 'Pareja (2 Adultos • AZ/TX)', price: '110.00' },
    titular_1_nino: { label: 'Titular + 1 Niño (AZ/TX)', price: '85.00' },
    '1a_2n': { label: '1 Adulto + 2 Niños (AZ/TX)', price: '115.00' },
    '1a_3n': { label: '1 Adulto + 3 Niños (AZ/TX)', price: '145.00' },
    '2a_1n': { label: 'Familia (2 Adultos + 1 Niño • AZ/TX)', price: '135.00' },
    '2a_2n': { label: 'Familia (2 Adultos + 2 Niños • AZ/TX)', price: '165.00' },
    '2a_3n': { label: 'Familia (2 Adultos + 3 Niños • AZ/TX)', price: '195.00' }
  };

  const picked = edition === 'Essential' ? essentialPrices[groupKey] : plusPrices[groupKey];

  return {
    tierLabel: picked.label,
    planEdition: edition,
    monthlyPrice: picked.price,
    summaryText: `Tarifa ${edition} para ${picked.label}: $${picked.price}/mes (+ $40.00 fee único de inscripción en el 1.er mes).`
  };
};

interface TemplateContext {
  members: string;
  location: string;
  ages: string;
}

interface PlanTemplateConfig {
  category: QuotePlanCategory;
  shortLabel: string;
  badgeText: string;
  accentColor: string;
  createPlan: (ctx: TemplateContext) => QuotePlan;
}

const PLAN_TEMPLATES: PlanTemplateConfig[] = [
  {
    category: 'medmax',
    shortLabel: 'MedMax',
    badgeText: 'Copagos tras Deducible',
    accentColor: 'border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 text-amber-950',
    createPlan: () => ({
      id: 'plan_medmax_' + Date.now(),
      tag: 'PLAN MÉDICO CON COPAGOS TRAS DEDUCIBLE',
      planCategory: 'medmax',
      company: 'MedMax',
      planName: 'MedMax – Plan de Salud (Copagos Tras Deducible)',
      tier: 'Deductible Value Plan',
      subtitleTag: 'DEDUCTIBLE VALUE PLAN • COPAGOS APLICAN TRAS DEDUCIBLE',
      premium: '',
      deductible: '$3,000',
      moop: '$7,500',
      primaryCare: '$50 (tras deducible)',
      specialist: '$50 (tras deducible)',
      genericRx: '$0 preventivos',
      urgencies: '$50 UC / $250 ER (tras deducible)',
      deductibleWarning: MEDMAX_DEFAULT_WARNING,
      highlights: [
        'Sin Deducible ($0 Inmediato): Consultas preventivas y telemedicina 24/7 (RelyMD) al 100% cubiertas ($0 copago), además de medicamentos preventivos genéricos a $0.',
        'Servicios Tras Cumplir Deducible: Todos los copagos detallados aplican DESPUÉS de cumplir el deducible anual: consultas médico primario, especialista y urgencias a $50 (máx. 10 visitas/año), laboratorios simples a $25 y radiología a $50 (límite 3/año), y estudios avanzados (MRI, CT, PET) a $200.',
        'Hospitalización, Cirugías y Emergencias (Después del deducible): Cirugías ambulatorias o en consultorio a $250 (hasta 3/año), hospitalización e internación a $1,000 (hasta 2 admisiones/año, máx. 10 días), y Sala de Emergencias (ER) / ambulancia a $250 (2 por año).'
      ],
      extraBenefit:
        'Incluye prevención y telemedicina 24/7 (RelyMD) a $0 sin deducible; todos los demás copagos aplican tras cumplir el deducible anual.',
      clientSummary:
        'Acceso inmediato a cuidado preventivo y telemedicina 24/7 a $0. Todos los demás copagos de consultas, estudios, emergencias y hospitalización aplican después de cumplir el deducible anual.',
      isRecommended: false
    })
  },
  {
    category: 'hpg4000',
    shortLabel: 'HPG Preferred 4000',
    badgeText: 'Efectivo Sin Deducible',
    accentColor: 'border-sky-300 bg-sky-50/70 hover:bg-sky-100/70 text-sky-950',
    createPlan: () => ({
      id: 'plan_hpg4000_' + Date.now(),
      tag: 'INDEMNIZACIÓN FIJA EN EFECTIVO SIN DEDUCIBLE',
      planCategory: 'hpg4000',
      company: 'Golden Rule Insurance Company (UnitedHealthcare)',
      planName: 'Health ProtectorGuard® Preferred 4000',
      tier: 'Indemnización en Efectivo • $0 Deducible',
      subtitleTag: 'GOLDEN RULE INSURANCE COMPANY • PAGOS FIJOS EN EFECTIVO SIN DEDUCIBLE',
      premium: '',
      deductible: '$0 (Sin deducible)',
      moop: 'Tope Anual $2,000,000 / Vitalicio $5,000,000',
      primaryCare: '$100/visita (paga el plan)',
      specialist: '$125/visita (SP/UC)',
      genericRx: '$20 Genérico / $60 Marca',
      urgencies: '$500/día ER • $125/visita UC',
      highlights: [
        'Hospitalización y Cuidados Críticos ($0 Deducible): Paga en efectivo $4,000/día de internación hospitalaria por persona en Año 1 y sube a $8,000/día desde el Año 2+ (sin límite de días), $4,000/día en Cuidados Intensivos (UCI, hasta 60 días/año) y bono de admisión de $3,000 el primer día de ingreso al año.',
        'Emergencias, Cirugías y Ambulancia: $500 por día en sala de emergencias (hasta 3 días/año), indemnización quirúrgica de $375 a $37,500 más $2,000/día por uso de quirófano ambulatorio (máx. 10 días/año), y ambulancia terrestre ($1,000) o aérea ($5,000).',
        'Consultas, Medicamentos y Prevención: Consultas médicas $100 PCP / $125 especialista o urgencias (Año 1: 6 visitas / Año 2+: 8 visitas), medicamentos recetados $20 genéricos / $60 de marca (Año 1: 12 recetas), examen físico anual ($125), labs ($50–$100), rayos X ($75–$100), telemedicina $0 (HealthiestYou) + Red UnitedHealthcare Choice Plus y Optum Perks.'
      ],
      extraBenefit:
        'Pagos fijos en efectivo sin deducible + Telemedicina $0 (HealthiestYou) + Red UnitedHealthcare Choice Plus y descuentos Optum Perks.',
      clientSummary:
        'Seguro de pagos fijos en efectivo sin deducible: $4,000/día hospital Año 1 ($8,000/día Año 2+), $4,000/día UCI, $500 emergencias, $100 PCP / $125 especialista y $20 genéricos / $60 marca.',
      isRecommended: false
    })
  },
  {
    category: 'ahw4',
    shortLabel: 'AHW 4 (First Health)',
    badgeText: 'Red First Health',
    accentColor: 'border-indigo-300 bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-950',
    createPlan: () => ({
      id: 'plan_ahw4_' + Date.now(),
      tag: 'HOSPITAL, CIRUGÍA, FARMACIA Y PREVENCIÓN',
      planCategory: 'ahw4',
      company: 'AHW 4 (Red First Health)',
      planName: 'Plan de Salud AHW 4 — Red First Health',
      tier: 'Red First Health • Beneficios Fijos + Farmacia',
      subtitleTag: 'RED FIRST HEALTH • HOSPITALIZACIÓN, FARMACIA Y PREVENCIÓN INCLUIDA',
      premium: '',
      deductible: '$0',
      moop: 'Tope Hospital $10,000/año • Cirugía $2,000/año',
      primaryCare: '4 visitas/año ($50)',
      specialist: '4 visitas/año ($75)',
      genericRx: '$0 Prev. / $5 Pref. / $40 Marca',
      urgencies: '$1,000 ER / $500 Ambulancia',
      highlights: [
        'Beneficios Hospitalarios y Cirugías: Hospitalización $1,000/día (máx. $10,000/año), cirugía hospitalaria o ambulatoria $1,000 (máx. $2,000/año) y Emergencia / Ambulancia $1,000 / $500.',
        'Farmacia (hasta 30 días): Genérico preventivo $0, genérico preferido $5 y medicamento de marca $40 (con autorización previa).',
        'Consultas y Prevención Incluida (Red First Health): 4 consultas médico primario ($50) y 4 especialista/UC ($75). Cuidado preventivo al $0 dentro de la red First Health (examen físico anual, mamografía 2D, papanicolaou, presión/diabetes, kit colorrectal, niño sano; nota: prevención no cubierta si se realiza en hospital) + telemedicina RelyMD $0 y negociación de facturas hospitalarias.'
      ],
      extraBenefit:
        'Red First Health + prevención incluida fuera de hospital + RelyMD $0 + Negociación de facturas hospitalarias.',
      clientSummary:
        'Incluye hospitalización $1,000/día (máx. $10,000/año), cirugía $1,000 (máx. $2,000), emergencia/ambulancia $1,000/$500, farmacia $0/$5/$40 y prevención en red First Health.',
      isRecommended: false
    })
  },
  {
    category: 'sanitas',
    shortLabel: 'Sanitas Care',
    badgeText: '+$40 Fee 1.er Mes Auto',
    accentColor: 'border-teal-300 bg-teal-50/80 hover:bg-teal-100/80 text-teal-950',
    createPlan: (ctx: TemplateContext) => {
      const pricing = getSanitasPricingForFamily(ctx.members, ctx.location, ctx.ages);
      return {
        id: 'plan_sanitas_' + Date.now(),
        tag: 'MEMBRESÍA MÉDICA SANITAS CARE',
        planCategory: 'sanitas',
        company: 'Sanitas Care',
        planName: `Sanitas Care ${pricing.planEdition} (${pricing.tierLabel})`,
        tier: `Membresía Sanitas ${pricing.planEdition} • $0 Deducible`,
        subtitleTag: `MEMBRESÍA ${pricing.tierLabel.toUpperCase()} • +$40.00 FEE ÚNICO SOLO 1.ER MES`,
        premium: pricing.monthlyPrice,
        hasSanitasFee: true,
        enrollmentFee: '40.00',
        deductible: '$0 (Sin deducibles ni copagos)',
        moop: '$0 Deducible / Sin copagos en servicios incluidos',
        primaryCare: '$0 Ilimitado (Presencial y Virtual)',
        specialist: '10%–40% Descuento en Centros/Red',
        genericRx: 'Desde $5 (suministro 30 días)',
        urgencies: '2 visitas/año $0 (Centros Sanitas Sur FL)',
        highlights: [
          `Membresía Sanitas Care (${pricing.tierLabel}): $${pricing.monthlyPrice}/mes (+ $40.00 fee único de inscripción sumado automáticamente solo en el 1.er mes).`,
          'Atención Primaria y Laboratorios a $0: Visitas presenciales y videoconsultas virtuales ilimitadas con médico primario (PCP), análisis de sangre 2 veces al año (cada 6 meses: sangre, glucosa, colesterol, perfil general, orina y EKG) y acceso a más de 50 centros médicos Sanitas en Florida.',
          'Urgencias, Dental y Bienestar: 2 visitas de atención urgente a $0 al año (centros Sanitas sur de FL), evaluación y limpiezas dentales a $0 (consultorios dentales Sanitas sur de FL), medicamentos genéricos desde $5 (30 días), evaluación nutricional, bienestar emocional, descuentos 10%–40% en especialistas y ayuda para negociar facturas hospitalarias.'
        ],
        extraBenefit:
          'Fee único de inscripción Sanitas de $40.00 sumado automáticamente al 1.er mes + ayuda para negociar facturas hospitalarias.',
        clientSummary:
          'Atención primaria y videoconsultas ilimitadas a $0, laboratorios 2 veces al año a $0, 2 urgencias al año, dental preventivo en sur de FL y descuentos en especialistas sin deducibles ni copagos.',
        isRecommended: false
      };
    }
  },
  {
    category: 'hospitalwise',
    shortLabel: 'HospitalWise Bundle 1',
    badgeText: 'Golden Rule • Efectivo Hospital',
    accentColor: 'border-cyan-300 bg-cyan-50/80 hover:bg-cyan-100/80 text-cyan-950',
    createPlan: () => ({
      id: 'plan_hospitalwise_' + Date.now(),
      tag: 'RESPALDO HOSPITALARIO EN EFECTIVO',
      planCategory: 'hospitalwise',
      company: 'Golden Rule Insurance Company (UnitedHealthcare)',
      planName: 'HospitalWise® Bundle 1',
      tier: 'Indemnización Hospitalaria en Efectivo',
      subtitleTag: 'GOLDEN RULE INSURANCE COMPANY • RESPALDO HOSPITALARIO EN EFECTIVO',
      premium: '',
      hasSanitasFee: false,
      deductible: '$0 (Pago directo por evento)',
      moop: 'Beneficio Hospitalario $1,000/día (máx. 10 días)',
      primaryCare: '$100/día consultorio (máx. 4 días/año)',
      specialist: '$100/día médico',
      genericRx: 'N/A (Descuentos Optum Perks)',
      urgencies: '$500/día ER • $250/día UC',
      highlights: [
        'Confinamiento Hospitalario, Observación y UCI: Paga $1,000/día por confinamiento hospitalario (máx. 10 días), $1,000/día por observación hospitalaria (máx. 4 días/año) y $1,000/día en Unidad de Cuidados Intensivos — UCI (máx. 10 días).',
        'Emergencias, Urgencias y Consultas: $500/día en Sala de Emergencias (ER), $250/día en Urgencias (Urgent Care) y $100/día en visita al consultorio médico (máx. 4 días/año).',
        'Cirugía Ambulatoria, Diagnóstico y Ambulancia: $1,000/día en cirugía ambulatoria, $500/día en estudios de diagnóstico y traslado en ambulancia terrestre ($250) o aérea ($2,500).'
      ],
      extraBenefit:
        'Respaldo hospitalario independiente en efectivo de Golden Rule Insurance Company (sin deducible y pagadero directamente por día de servicio).',
      clientSummary:
        'Respaldo hospitalario en efectivo: $1,000/día hospital (máx. 10 días), $1,000/día observación (máx. 4 días/año), $1,000/día UCI (máx. 10 días), $500 ER, $250 UC y $1,000 cirugía ambulatoria.',
      isRecommended: false
    })
  },
  {
    category: 'aca',
    shortLabel: 'Plan ACA (Obamacare)',
    badgeText: 'Con Subsidio + Día 1',
    accentColor: 'border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950',
    createPlan: () => ({
      id: 'plan_aca_' + Date.now(),
      tag: 'MERCADO DE SALUD ACA • OBAMACARE',
      planCategory: 'aca',
      company: 'Oscar / Ambetter / UnitedHealthcare (ACA)',
      planName: 'Plan ACA Silver CSR (Obamacare)',
      tier: 'Plata CSR • HMO / EPO',
      subtitleTag: 'COBERTURA MÉDICA MAYOR ACA • COPAGOS DESDE EL DÍA 1',
      premium: '',
      subsidyAmount: '$485.00/mes',
      deductible: '$0',
      moop: '$1,800',
      primaryCare: '$0 desde Día 1',
      specialist: '$15 desde Día 1',
      genericRx: '$3 desde Día 1',
      urgencies: '$25 UC / $150 ER desde Día 1',
      highlights: [
        'Deducible y Máximo de Bolsillo: Deducible médico anual de $0 y gasto máximo anual de bolsillo (Out-of-Pocket Max) de $1,800.',
        'Copagos desde el Día 1: Atención primaria $0/visita, especialista $15/visita, atención de urgencias $25/visita, medicamentos genéricos $3 y servicios preventivos al 100% cubiertos sin espera.',
        'Crédito Fiscal / Subsidio Federal ACA: Subsidio gubernamental aplicado directamente para reducir la prima mensual.'
      ],
      extraBenefit:
        'Cobertura esencial mínima bajo la Ley ACA: hospitalización, maternidad, salud mental, emergencias y prevención al 100% sin límites anuales.',
      clientSummary:
        'Plan oficial de Obamacare con subsidio federal aplicado, máximo de bolsillo protegido y copagos bajos desde el primer día de vigencia.',
      isRecommended: true
    })
  }
];

type EmailMode = 'privado' | 'aca';

interface SmartQuoterViewProps {
  currentSeller: string;
  selectedYear: string;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export const SmartQuoterView: React.FC<SmartQuoterViewProps> = ({
  currentSeller,
  selectedYear,
  onShowToast
}) => {
  // Prospect Form State
  const [clientName, setClientName] = useState('Familia Ramírez');
  const [clientLocation, setClientLocation] = useState('Florida (33166)');
  const [clientMembers, setClientMembers] = useState('Familia (2 Adultos + 1 Niño)');
  const [clientAges, setClientAges] = useState('38, 35 y 7 años');
  const [quoteYear, setQuoteYear] = useState(selectedYear || '2027');
  const [agentName, setAgentName] = useState(() => currentSeller || 'Equipo Agente Contigo');

  // Refs para auto-enfocar la prima mensual al agregar una plantilla manual
  const premiumInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [lastAddedPlanId, setLastAddedPlanId] = useState<string | null>(null);

  // AI & Upload State
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; dataUrl: string; base64: string; mimeType: string }>>([]);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiStatusText, setAiStatusText] = useState('Listo para procesar imágenes');

  // API Key State
  const [geminiApiKey, setLocalGeminiApiKey] = useState(getGeminiApiKey);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKeyInput, setTempApiKeyInput] = useState(getGeminiApiKey);

  // Plans List State
  const [plans, setPlans] = useState<QuotePlan[]>([
    {
      id: 'plan_demo_1',
      tag: 'OPCIÓN PRINCIPAL RECOMENDADA',
      planCategory: 'aca',
      company: 'UnitedHealthcare',
      planName: 'Silver Value Copay',
      tier: 'Plata CSR',
      subtitleTag: 'COBERTURA MÉDICA MAYOR ACA • COPAGOS DESDE EL DÍA 1',
      premium: '0.00',
      subsidyAmount: '$485.00/mes',
      deductible: '$0',
      moop: '$1,500',
      primaryCare: '$0',
      specialist: '$15',
      genericRx: '$3',
      urgencies: '$30',
      extraBenefit: 'Incluye chequeos anuales al 100% y beneficios de telemedicina gratuita',
      clientSummary: 'No pagas nada al mes ($0) y tus consultas médicas y preventivas son completamente gratis desde el día 1.',
      isRecommended: true
    }
  ]);

  // Saved Quotes
  const [savedQuotesList, setSavedQuotesList] = useState<SavedQuote[]>(loadQuotes);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Email Generator Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailMode>('privado');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Evaluación geográfica y de edades en tiempo real
  const geoAge = evaluateGeoAndAgeEligibility(clientLocation, clientAges);

  useEffect(() => {
    const onBeforePrint = () => {
      setIsPrinting(true);
      document.body.classList.add('is-printing-proposal');
    };
    const onAfterPrint = () => {
      setIsPrinting(false);
      document.body.classList.remove('is-printing-proposal');
    };
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);

  // Auto-focus en la prima de la tarjeta recién agregada en modo manual
  useEffect(() => {
    if (!lastAddedPlanId) return;
    const inputEl = premiumInputRefs.current[lastAddedPlanId];
    if (inputEl) {
      setTimeout(() => {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    }
    setLastAddedPlanId(null);
  }, [lastAddedPlanId, plans.length]);

  const handlePrintProposal = () => {
    setIsPrinting(true);
    document.body.classList.add('is-printing-proposal');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
        document.body.classList.remove('is-printing-proposal');
      }, 1000);
    }, 150);
  };

  // Listen for paste (Ctrl+V / Cmd+V) to easily paste screenshots
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        processIncomingFiles(imageFiles);
        onShowToast('¡Imagen pegada!', 'Screenshot cargado desde el portapapeles.', 'success');
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processIncomingFiles = (files: File[]) => {
    const validFiles = files.filter(
      f => f.type.startsWith('image/') || f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (validFiles.length === 0) {
      onShowToast('Formato Incorrecto', 'Por favor sube imágenes (PNG, JPG) o documentos PDF de cotización.', 'error');
      return;
    }

    Promise.all(
      validFiles.map(file => {
        return new Promise<{ name: string; dataUrl: string; base64: string; mimeType: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => {
            const dataUrl = ev.target?.result as string;
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
            const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
            resolve({ name: file.name, dataUrl, base64, mimeType });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      })
    )
      .then(newFiles => {
        setUploadedFiles(prev => [...prev, ...newFiles]);
        onShowToast('Archivos Cargados', `${newFiles.length} archivo(s) listo(s) para analizar con IA.`, 'success');
      })
      .catch(err => {
        console.error('Error procesando archivos:', err);
        onShowToast('Error', 'No se pudieron procesar algunos archivos.', 'error');
      });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  // Plan Management
  const addManualPlan = () => {
    const newId = 'plan_' + Date.now();
    const newPlan: QuotePlan = {
      id: newId,
      tag: 'OPCIÓN ADICIONAL',
      planCategory: 'custom',
      company: 'Nueva Aseguradora',
      planName: 'Plan de Cobertura Médica',
      tier: 'Estándar',
      premium: '',
      deductible: '$0',
      moop: '$1,500',
      primaryCare: '$0',
      specialist: '$20',
      genericRx: '$3',
      urgencies: '$35',
      extraBenefit: 'Incluye exámenes preventivos al 100%',
      clientSummary: 'Cobertura médica personalizada con asesoría gratuita de Agente Contigo.',
      isRecommended: plans.length === 0
    };
    setPlans(prev => [...prev, newPlan]);
    setLastAddedPlanId(newId);
    onShowToast('Plan Agregado', 'Escribe la prima mensual y ajusta los copagos o Máximo de Bolsillo.', 'info');
  };

  const addTemplatePlan = (template: PlanTemplateConfig) => {
    const created = template.createPlan({
      members: clientMembers,
      location: clientLocation,
      ages: clientAges
    });
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(created.id);

    if (created.planCategory === 'sanitas') {
      const zipAlert =
        geoAge.sanitasAvailability === 'verify_zip'
          ? ' ⚠️ Recuerda validar disponibilidad del centro Sanitas en este ZIP.'
          : '';
      onShowToast(
        'Sanitas Care Agregado',
        `Tarifa asignada para ${clientMembers}: $${created.premium}/mes (+ $40.00 fee único en el 1.er mes).${zipAlert}`,
        geoAge.sanitasAvailability === 'verify_zip' ? 'info' : 'success'
      );
    } else if (created.planCategory === 'hospitalwise') {
      onShowToast(
        'HospitalWise Bundle 1 Agregado',
        'Beneficios oficiales cargados. Ingresa la prima mensual (ej. 25.79 o 110.18).',
        'success'
      );
    } else if (created.planCategory === 'medmax') {
      onShowToast(
        'MedMax Agregado',
        'Ingresa la prima mensual y el deducible anual. Incluye alerta de copagos tras deducible.',
        'success'
      );
    } else {
      onShowToast(
        `Plantilla ${template.shortLabel} Agregada`,
        'Beneficios oficiales cargados. Escribe la prima mensual para actualizar PDF y correo.',
        'success'
      );
    }
  };

  const deletePlan = (id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const updatePlan = (id: string, field: keyof QuotePlan, value: any) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const next: QuotePlan = { ...p, [field]: value };
        if (field === 'hasSanitasFee' && value === true && !next.enrollmentFee) {
          next.enrollmentFee = '40.00';
        }
        if (field === 'planCategory' && value === 'medmax' && !next.deductibleWarning) {
          next.deductibleWarning = MEDMAX_DEFAULT_WARNING;
        }
        return next;
      })
    );
  };

  // AI OCR / Extraction (toma en cuenta Edad(es) y Estado/ZIP)
  const processImagesWithAI = async () => {
    if (uploadedFiles.length === 0) {
      onShowToast('Sin Imágenes', 'Por favor sube o pega al menos una captura de pantalla.', 'info');
      return;
    }

    const keyToUse = geminiApiKey.trim();
    if (!keyToUse) {
      setShowApiKeyModal(true);
      onShowToast('Conexión con IA', 'Introduce tu clave de Google Gemini para activar el análisis.', 'info');
      return;
    }

    setIsAnalyzingAI(true);
    setAiStatusText('Analizando documentos y capturas con Gemini Flash...');

    try {
      const generateWithActiveGemini = async (
        key: string,
        contentsPayload: any,
        options?: { responseMimeType?: string; tools?: any[]; onStatus?: (msg: string) => void }
      ): Promise<string> => {
        const cleanKey = key.trim().replace(/^['"]|['"]$/g, '');
        const ai = new GoogleGenAI({ apiKey: cleanKey });

        const runWithModel = async (modelName: string): Promise<string> => {
          const config: any = {};
          if (options?.responseMimeType) {
            config.responseMimeType = options.responseMimeType;
          }
          if (options?.tools) {
            config.tools = options.tools;
          }

          const response = await ai.models.generateContent({
            model: modelName,
            contents: contentsPayload,
            config: Object.keys(config).length > 0 ? config : undefined
          });

          const resText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!resText || !resText.trim()) {
            throw new Error(`No se recibió respuesta válida del modelo ${modelName}.`);
          }
          return resText;
        };

        const discoverAllModels = async (): Promise<string[]> => {
          try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
            if (!listRes.ok) return [];
            const listData = await listRes.json();
            return (listData.models || [])
              .filter(
                (m: any) =>
                  Array.isArray(m.supportedGenerationMethods) &&
                  m.supportedGenerationMethods.includes('generateContent') &&
                  typeof m.name === 'string' &&
                  m.name.includes('gemini') &&
                  !m.name.includes('tts') &&
                  !m.name.includes('image') &&
                  !m.name.includes('live') &&
                  !m.name.includes('transcribe') &&
                  !m.name.includes('embedding') &&
                  !m.name.includes('vision') &&
                  !m.name.includes('robotics')
              )
              .map((m: any) => m.name.replace(/^models\//, ''))
              .sort((a: string, b: string) => {
                const aFlash = a.includes('flash') ? 0 : 1;
                const bFlash = b.includes('flash') ? 0 : 1;
                if (aFlash !== bFlash) return aFlash - bFlash;
                return b.localeCompare(a);
              });
          } catch (_) {
            return [];
          }
        };

        const discovered = await discoverAllModels();
        const candidatePool = Array.from(new Set([...SUPPORTED_GEMINI_MODELS, ...discovered]));

        let lastError: any = null;
        for (let round = 0; round < 2; round++) {
          if (round === 1) {
            options?.onStatus?.('⏳ Servidores de Gemini con alta demanda, reintentando con modelos alternativos...');
            await sleepMs(1500);
          }

          for (let i = 0; i < candidatePool.length; i++) {
            const modelName = candidatePool[i];
            try {
              if (i > 0) {
                options?.onStatus?.(`🔄 Probando modelo alternativo (${modelName})...`);
              }
              return await runWithModel(modelName);
            } catch (err: any) {
              lastError = err;
              if (!isRetryableGeminiError(err)) {
                throw err;
              }
              const errMsg = String(err?.message || err || '');
              console.warn(`[Gemini] ${modelName} falló temporalmente (${errMsg.slice(0, 120)}), cambiando al siguiente...`);
              if (errMsg.includes('503') || errMsg.toLowerCase().includes('high demand')) {
                await sleepMs(450);
              }
            }
          }
        }

        throw lastError || new Error('No se encontró un modelo de Gemini disponible en este momento.');
      };

      const promptText = `Eres el asistente experto de 'Agente Contigo', una agencia de seguros de salud (Obamacare / ACA, MedMax, Health ProtectorGuard Preferred 4000, AHW 4 First Health, Sanitas Care, HospitalWise Bundle 1 de Golden Rule, UnitedHealthcare, Oscar, Ambetter, Florida Blue, Cigna).
Contexto del prospecto:
- Ubicación / Estado / ZIP Code: ${clientLocation}
- Grupo Familiar: ${clientMembers}
- Edad(es) de los solicitantes: ${clientAges || 'No especificadas'}

Analiza cuidadosamente las imágenes o documentos adjuntos, que son capturas de cotizaciones o guías de beneficios.
Valida también coherencia con la ubicación/ZIP y las edades indicadas en tus resúmenes.
Extrae cada plan de seguro que aparezca con sus valores exactos.
Responde ÚNICAMENTE un array JSON válido con la siguiente estructura (sin texto antes ni después):
[
  {
    "company": "Nombre de la aseguradora (ej: UnitedHealthcare, MedMax, Golden Rule / UHC, First Health AHW 4, Sanitas Care, Oscar, Ambetter)",
    "planName": "Nombre completo del plan",
    "tier": "Categoría o Metal (ej: Plata CSR, Bronce, Deductible Value Plan, Indemnización en Efectivo)",
    "planCategory": "Una de: medmax | hpg4000 | ahw4 | sanitas | hospitalwise | aca | custom",
    "premium": "Monto de la prima mensual en dólares (solo el número con decimales, ej: '0.00' o '45.20')",
    "subsidyAmount": "Si es plan ACA y aparece el subsidio o crédito fiscal, ej '$485.00/mes', si no ''",
    "deductible": "Deducible individual/familiar (ej: '$0' o '$3,000')",
    "moop": "Máximo de Bolsillo (Out-of-Pocket Max) (ej: '$1,500' o '$9,200')",
    "primaryCare": "Copago médico primario (ej: '$0' o '$50')",
    "specialist": "Copago especialista (ej: '$15' o '$125')",
    "genericRx": "Copago medicinas genéricas (ej: '$3' o '$20')",
    "urgencies": "Copago urgencias / sala de emergencias (ej: '$25 UC / $250 ER')",
    "extraBenefit": "Beneficios clave como telemedicina, prevención, dental, hospitalización",
    "clientSummary": "Explicación sencilla y amigable de 1 o 2 oraciones para el cliente considerando su ubicación y edades.",
    "isRecommended": true
  }
]`;

      const parts: any[] = [{ text: promptText }];
      uploadedFiles.forEach(f => {
        if (f.base64 && f.base64.length > 20) {
          parts.push({
            inlineData: {
              mimeType: f.mimeType || 'image/jpeg',
              data: f.base64.trim()
            }
          });
        }
      });

      const rawText = await generateWithActiveGemini(keyToUse, [{ parts }], {
        responseMimeType: 'application/json',
        onStatus: msg => setAiStatusText(msg)
      });

      let cleanJson = rawText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedPlans = JSON.parse(cleanJson);

      if (Array.isArray(parsedPlans) && parsedPlans.length > 0) {
        if (enableWebSearch) {
          setAiStatusText('🌐 Consultando internet para verificar beneficios oficiales y zona...');
          for (let i = 0; i < parsedPlans.length; i++) {
            const p = parsedPlans[i];
            try {
              const searchPrompt = `Busca en internet información oficial y resumida de la póliza de seguro '${p.company} ${p.planName}' disponible en '${clientLocation}'. Resume en 1 sola oración sus beneficios más atractivos.`;
              const benefit = await generateWithActiveGemini(
                keyToUse,
                [{ parts: [{ text: searchPrompt }] }],
                { tools: [{ googleSearch: {} }] }
              );
              if (benefit && benefit.length > 15) {
                p.extraBenefit = benefit.replace(/[\n\r]+/g, ' ').trim();
              }
            } catch (e) {
              console.warn('Google grounding notice:', e);
            }
          }
        }

        const mapped: QuotePlan[] = parsedPlans.map((p, idx) => {
          const combinedName = `${p.company || ''} ${p.planName || ''}`.toLowerCase();
          const detectedCategory: QuotePlanCategory =
            p.planCategory &&
            ['medmax', 'hpg4000', 'ahw4', 'sanitas', 'hospitalwise', 'aca', 'custom'].includes(p.planCategory)
              ? p.planCategory
              : combinedName.includes('medmax')
                ? 'medmax'
                : combinedName.includes('hospitalwise')
                  ? 'hospitalwise'
                  : combinedName.includes('protector') || combinedName.includes('4000')
                    ? 'hpg4000'
                    : combinedName.includes('ahw')
                      ? 'ahw4'
                      : combinedName.includes('sanitas')
                        ? 'sanitas'
                        : 'custom';

          const sanitasDetected =
            (detectedCategory === 'sanitas' || combinedName.includes('sanitas')) &&
            detectedCategory !== 'hospitalwise';
          const medmaxDetected = detectedCategory === 'medmax';

          return {
            id: 'plan_ai_' + Date.now() + '_' + idx,
            tag: idx === 0 ? 'OPCIÓN PRINCIPAL RECOMENDADA' : 'PLAN ADICIONAL / COMPLEMENTO',
            planCategory: detectedCategory,
            company: p.company || 'Aseguradora',
            planName: p.planName || 'Plan Médico',
            tier: p.tier || 'Estándar',
            premium: String(p.premium || '0.00').replace(/[^0-9.]/g, '') || '0.00',
            subsidyAmount: p.subsidyAmount || '',
            hasSanitasFee: sanitasDetected,
            enrollmentFee: sanitasDetected ? '40.00' : undefined,
            deductibleWarning: medmaxDetected ? MEDMAX_DEFAULT_WARNING : undefined,
            deductible: p.deductible || '$0',
            moop: p.moop || 'Consultar detalle',
            primaryCare: p.primaryCare || '$0',
            specialist: p.specialist || '$0',
            genericRx: p.genericRx || '$0',
            urgencies: p.urgencies || '$0',
            extraBenefit: p.extraBenefit || 'Cobertura integral según términos oficiales',
            clientSummary: p.clientSummary || 'Plan seleccionado para tu tranquilidad y cobertura médica.',
            isRecommended: idx === 0
          };
        });

        setPlans(mapped);
        onShowToast('¡Extracción Exitosa!', `Se identificaron ${mapped.length} planes médicos con IA.`, 'success');
      } else {
        onShowToast('Aviso', 'No se pudieron extraer planes claros de la imagen.', 'info');
      }
    } catch (err: any) {
      console.error(err);
      onShowToast('Error al Procesar', formatFriendlyGeminiError(err), 'error');
    } finally {
      setIsAnalyzingAI(false);
      setAiStatusText('✓ Procesamiento finalizado');
    }
  };

  // Helper compartido para llamadas rápidas de texto con GoogleGenAI y respaldo automático ante 404/503
  const callGeminiTextHelper = async (key: string, prompt: string, tools?: any[]): Promise<string> => {
    const cleanKey = key.trim().replace(/^['"]|['"]$/g, '');
    const ai = new GoogleGenAI({ apiKey: cleanKey });

    let discovered: string[] = [];
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        discovered = (listData.models || [])
          .filter(
            (m: any) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes('generateContent') &&
              typeof m.name === 'string' &&
              m.name.includes('gemini') &&
              !m.name.includes('tts') &&
              !m.name.includes('image') &&
              !m.name.includes('live') &&
              !m.name.includes('embedding')
          )
          .map((m: any) => m.name.replace(/^models\//, ''));
      }
    } catch (_) {}

    const pool = Array.from(new Set([...SUPPORTED_GEMINI_MODELS, ...discovered]));

    for (const modelName of pool) {
      try {
        const res = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: tools ? { tools } : undefined
        });
        const txt = res.text || res.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (txt.trim()) return txt;
      } catch (err: any) {
        if (!isRetryableGeminiError(err)) {
          throw err;
        }
        await sleepMs(400);
      }
    }
    return '';
  };

  // AI Summary Generator for a plan con GoogleGenAI
  const generatePlanSummaryWithAI = async (planId: string) => {
    const keyToUse = geminiApiKey.trim();
    if (!keyToUse) {
      setShowApiKeyModal(true);
      return;
    }

    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    onShowToast('Generando Explicación...', `Redactando beneficios claros para ${plan.company}...`, 'info');

    try {
      const prompt = `Actúa como un asesor estrella de seguros de 'Agente Contigo'. Escribe una explicación muy corta (máximo 1 o 2 oraciones, menos de 35 palabras) para ${clientName} (${clientMembers}, edades: ${clientAges || 'N/A'}, ubicación: ${clientLocation}) sobre el plan '${plan.company} - ${plan.planName}'.
Datos clave del plan: Prima: $${formatMoney(parseMoney(plan.premium))}/mes, Deducible: ${plan.deductible}, Máximo de Bolsillo: ${plan.moop}, Médico Primario: ${plan.primaryCare}, Extra: ${plan.extraBenefit}.
${isMedMaxPlan(plan) ? 'Recalca obligatoriamente que en MedMax los copagos aplican tras cumplir el deducible anual (excepto preventivo y telemedicina a $0).' : ''}
Haz que suene claro, tranquilizador y amigable.`;

      const text = await callGeminiTextHelper(keyToUse, prompt);

      if (text) {
        const clean = text.replace(/[\n\r]+/g, ' ').replace(/^["']|["']$/g, '').trim();
        updatePlan(planId, 'clientSummary', clean);
        onShowToast('¡Listo!', 'Explicación sencilla redactada con Gemini AI.', 'success');
      }
    } catch (e: any) {
      onShowToast('Error', 'No se pudo generar la explicación.', 'error');
    }
  };

  // Web search grounding para una póliza con GoogleGenAI
  const searchPlanBenefitsOnline = async (planId: string) => {
    const keyToUse = geminiApiKey.trim();
    if (!keyToUse) {
      setShowApiKeyModal(true);
      return;
    }

    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    onShowToast('Buscando en Google...', `Buscando folleto de ${plan.company} para ${clientLocation}...`, 'info');

    try {
      const searchPrompt = `Busca en internet los beneficios oficiales de la póliza '${plan.company} ${plan.planName}' en '${clientLocation}'. Extrae en una sola oración concisa qué cubre.`;
      const benefit = await callGeminiTextHelper(keyToUse, searchPrompt, [{ googleSearch: {} }]);

      if (benefit) {
        const clean = benefit.replace(/[\n\r]+/g, ' ').trim();
        updatePlan(planId, 'extraBenefit', clean);
        onShowToast('¡Folleto Encontrado!', 'Beneficios verificados con Google Search.', 'success');
      }
    } catch (e) {
      onShowToast('Aviso', 'No se pudo completar la búsqueda en este momento.', 'error');
    }
  };

  // Email Builder (Modos: Sin cambio de estatus / Privado vs Aplica a ACA Obamacare, adaptado a Edades y ZIP Code)
  const buildClientEmailDraft = (mode: EmailMode) => {
    const hasMedMax = plans.some(p => isMedMaxPlan(p));
    const hasSanitas = plans.some(p => getPlanSanitasFee(p) > 0);
    const hasHPGOrHW = plans.some(p => p.planCategory === 'hpg4000' || isHospitalWisePlan(p));
    const totalReg = plans.reduce((acc, p) => acc + parseMoney(p.premium), 0);
    const totalFirst = plans.reduce((acc, p) => acc + getPlanFirstMonth(p), 0);
    const agesSegment = clientAges ? ` • Edades: ${clientAges}` : '';

    const subject =
      mode === 'privado'
        ? `Cotización de Cobertura de Salud ${quoteYear} – Opciones Privadas y Suplementarias | Agente Contigo (${clientName})`
        : `Cotización Oficial ACA (Obamacare) ${quoteYear} con Subsidio Aplicado | Agente Contigo (${clientName})`;

    const lines: string[] = [];
    lines.push(`Hola ${clientName},`);
    lines.push('');

    if (mode === 'privado') {
      lines.push(
        `Espero que se encuentre muy bien. Con mucho gusto le comparto su propuesta personalizada de cobertura de salud para ${quoteYear} (${clientMembers}${agesSegment} • ${clientLocation}) de parte de Agente Contigo.`
      );
      lines.push('');
      lines.push(
        `Debido a que su estatus migratorio no ha tenido cambios recientemente, hemos preparado estas alternativas privadas y suplementarias disponibles para su zona (${clientLocation}) y edades, diseñadas para brindarle acceso médico, farmacia y protección financiera ante emergencias u hospitalizaciones.`
      );
      if (hasMedMax) {
        lines.push('');
        lines.push(
          `⚠️ ACLARACIÓN IMPORTANTE SOBRE MEDMAX: En el plan MedMax, todos los copagos y beneficios detallados (consultas médicas, laboratorios, urgencias, cirugías y hospitalización) aplican DESPUÉS de cumplir con el deducible anual seleccionado, con la excepción del cuidado preventivo y la telemedicina 24/7 (RelyMD), que cuentan con acceso inmediato a $0 copago.`
        );
      }
    } else {
      lines.push(
        `Espero que se encuentre muy bien. Me da mucho gusto compartirle su cotización oficial de cobertura médica a través del Mercado de Salud ACA (Obamacare) para el período ${quoteYear} (${clientMembers}${agesSegment} • ${clientLocation}) de parte de Agente Contigo.`
      );
      lines.push('');
      lines.push(
        `Estas opciones ya cuentan con su crédito fiscal (subsidio federal ACA) aplicado según su grupo familiar y código postal para reducir su prima mensual, e incluyen copagos directos desde el Día 1 para consultas primarias, especialistas, medicamentos y cuidado preventivo al 100% cubierto sin límites anuales.`
      );
    }

    // Notas contextuales por ZIP Code y Edad(es)
    const geoNotes: string[] = [];
    if (hasSanitas) {
      if (geoAge.sanitasAvailability === 'plus_fl') {
        geoNotes.push(
          `✓ Disponibilidad Sanitas Care en su zona (${clientLocation}): Cuenta con acceso a la red de centros médicos Sanitas en Florida${geoAge.isSouthFlorida ? ' (incluyendo dental preventivo y 2 visitas de urgencias a $0 en centros del sur de Florida)' : ''}.`
        );
      } else if (geoAge.sanitasAvailability === 'essential_az_tx') {
        geoNotes.push(
          `✓ Disponibilidad Sanitas Care en ${geoAge.detectedState}: Aplica cobertura regional Sanitas Essential / Access para el código postal ${geoAge.zipCode || clientLocation}.`
        );
      } else {
        geoNotes.push(
          `• Nota geográfica Sanitas Care (${clientLocation}): Confirmaremos la clínica o modalidad virtual Sanitas disponible en su código postal antes de procesar la inscripción.`
        );
      }
    }
    if (hasHPGOrHW && geoAge.hpgRestrictedState) {
      geoNotes.push(
        `• Nota estatal (${geoAge.detectedState}): Verificaremos la disponibilidad y condiciones específicas de suscripción para su estado antes de emitir la póliza.`
      );
    }
    if (geoAge.hasSenior65Plus) {
      geoNotes.push(
        `• Consideración por edad (65+ años): Al haber integrantes de 65 años o más, validaremos la elegibilidad específica frente a opciones de Medicare o membresías complementarias.`
      );
    }
    if (geoNotes.length > 0) {
      lines.push('');
      geoNotes.forEach(n => lines.push(n));
    }

    lines.push('');
    lines.push(`==================================================`);
    lines.push(`RESUMEN DE ALTERNATIVAS (${plans.length} ${plans.length === 1 ? 'OPCIÓN' : 'OPCIONES'})`);
    lines.push(`==================================================`);
    lines.push('');

    plans.forEach((p, idx) => {
      const reg = parseMoney(p.premium);
      const fee = getPlanSanitasFee(p);
      const firstM = getPlanFirstMonth(p);

      lines.push(`OPCIÓN ${idx + 1}: ${p.company} — ${p.planName}`);
      if (mode === 'aca') {
        lines.push(
          `• Prima Mensual con Subsidio: $${formatMoney(reg)}/mes${p.subsidyAmount ? ` (Crédito fiscal aplicado: ${p.subsidyAmount})` : ''}`
        );
      } else {
        lines.push(`• Mensualidad Regular: $${formatMoney(reg)}/mes`);
        if (fee > 0) {
          lines.push(`• Inversión 1.er Mes: $${formatMoney(firstM)} (incluye +$${formatMoney(fee)} fee único de inscripción de Sanitas Care)`);
        }
      }
      lines.push(`• Deducible Anual: ${p.deductible || '$0'}`);
      lines.push(`• Máximo de Bolsillo (Out-of-Pocket Max): ${p.moop || 'Consultar detalle'}`);
      lines.push(
        `• ${mode === 'aca' ? 'Copagos desde el Día 1' : 'Consultas y Copagos'}: Médico Primario ${p.primaryCare} | Especialista ${p.specialist} | Medicinas ${p.genericRx} | Urgencias/ER ${p.urgencies}`
      );
      if (isMedMaxPlan(p)) {
        lines.push(
          `• Nota MedMax: Los copagos aplican tras cumplir el deducible anual (cuidado preventivo y telemedicina RelyMD a $0 inmediato).`
        );
      }
      if (p.clientSummary) {
        lines.push(`• Beneficio clave: ${p.clientSummary}`);
      }
      lines.push('');
    });

    if (plans.length > 1 || hasSanitas) {
      lines.push(`--------------------------------------------------`);
      if (hasSanitas) {
        lines.push(`• Total 1.er Mes (incluye +$${formatMoney(totalFirst - totalReg)} fee único de inscripción Sanitas): $${formatMoney(totalFirst)}`);
      }
      lines.push(`• Mensualidad Regular${plans.length > 1 ? ' Combinada' : ''}: $${formatMoney(totalReg)}/mes`);
      lines.push(`--------------------------------------------------`);
      lines.push('');
    }

    lines.push(`Adjunto encontrará el documento PDF oficial de Agente Contigo con el desglose completo y el cuadro comparativo de inversión.`);
    lines.push('');
    lines.push(`Con nuestro acompañamiento gratuito verificamos sus médicos, centros y medicamentos antes de activar la póliza. ¿Cuál opción le gustaría revisar o dejar activa hoy?`);
    lines.push('');
    lines.push(`Atentamente,`);
    lines.push(`${agentName || 'Equipo Agente Contigo'}`);
    lines.push(`Agente Contigo • Cotización Personalizada de Salud`);

    return { subject, body: lines.join('\n') };
  };

  const openEmailGenerator = (initialMode?: EmailMode) => {
    const inferredMode: EmailMode =
      initialMode || (plans.some(p => p.planCategory === 'aca') ? 'aca' : 'privado');
    const draft = buildClientEmailDraft(inferredMode);
    setEmailMode(inferredMode);
    setEmailSubject(draft.subject);
    setEmailBody(draft.body);
    setShowEmailModal(true);
  };

  const handleSwitchEmailMode = (newMode: EmailMode) => {
    setEmailMode(newMode);
    const draft = buildClientEmailDraft(newMode);
    setEmailSubject(draft.subject);
    setEmailBody(draft.body);
  };

  const copyEmailToClipboard = () => {
    const full = `Asunto: ${emailSubject}\n\n${emailBody}`;
    navigator.clipboard.writeText(full);
    onShowToast('¡Correo Copiado!', 'Asunto y cuerpo del correo listos para pegar en Gmail/Outlook.', 'success');
  };

  // Mensaje de Texto / SMS Resumido para el cliente
  const copyShortTextMessage = () => {
    let msg = `Hola ${clientName}, te saluda ${agentName || 'tu asesor'} de Agente Contigo.\n`;
    msg += `Te preparé la propuesta de seguro médico ${quoteYear} para ${clientLocation}${clientAges ? ` (edades: ${clientAges})` : ''}:\n\n`;

    plans.forEach((plan, i) => {
      const fee = getPlanSanitasFee(plan);
      const firstM = getPlanFirstMonth(plan);
      msg += `📌 Opción ${i + 1}: ${plan.company} - ${plan.planName || plan.tier}\n`;
      msg += `• Mensualidad: $${formatMoney(parseMoney(plan.premium))}/mes`;
      if (fee > 0) {
        msg += ` (1.er mes: $${formatMoney(firstM)} con fee único Sanitas $${formatMoney(fee)})`;
      }
      msg += `\n`;
      msg += `• Deducible: ${plan.deductible} | Máx. Bolsillo: ${plan.moop || 'N/A'}\n`;
      msg += `• Médico: ${plan.primaryCare} | Especialista: ${plan.specialist} | Medicinas: ${plan.genericRx}\n`;
      if (isMedMaxPlan(plan)) {
        msg += `• Importante MedMax: Copagos aplican tras cumplir el deducible anual (preventivo y telemedicina $0).\n`;
      }
      if (plan.clientSummary) {
        msg += `• Resumen: ${plan.clientSummary}\n`;
      }
      msg += `\n`;
    });

    const total = plans.reduce((acc, p) => acc + parseMoney(p.premium), 0);
    const totalFirst = plans.reduce((acc, p) => acc + getPlanFirstMonth(p), 0);
    if (plans.length > 1 || totalFirst > total) {
      if (totalFirst > total) {
        msg += `💵 Total 1.er mes (con fee Sanitas): $${formatMoney(totalFirst)}\n`;
      }
      msg += `💵 Mensualidad regular estimada: $${formatMoney(total)}/mes\n\n`;
    }

    msg += `📄 Te adjunté también el PDF oficial de Agente Contigo con el cuadro comparativo completo. ¿Con cuál opción te gustaría que avancemos?`;

    navigator.clipboard.writeText(msg);
    onShowToast('¡SMS Resumido Copiado!', 'Mensaje de texto resumido listo para enviar al cliente.', 'success');
  };

  // WhatsApp Message Generator
  const copyWhatsAppMessage = () => {
    let msg = `🏥 *COTIZACIÓN OFICIAL DE COBERTURA DE SALUD ${quoteYear}*\n`;
    msg += `👋 ¡Hola ${clientName}! Un gusto saludarte de parte de *Agente Contigo*.\n\n`;
    msg += `Te comparto las alternativas seleccionadas para ${clientMembers}${clientAges ? ` (Edades: ${clientAges})` : ''} en ${clientLocation}:\n\n`;

    plans.forEach((plan, i) => {
      const fee = getPlanSanitasFee(plan);
      const firstM = getPlanFirstMonth(plan);
      msg += `📌 *OPCIÓN ${i + 1}: ${plan.company} - ${plan.planName}*\n`;
      msg += `   • 💰 *Mensualidad Regular:* $${formatMoney(parseMoney(plan.premium))}/mes\n`;
      if (fee > 0) {
        msg += `   • 🧾 *1.er Mes (con fee único Sanitas +$${formatMoney(fee)}):* $${formatMoney(firstM)}\n`;
      }
      if (plan.subsidyAmount) {
        msg += `   • 🏛️ *Crédito Fiscal ACA:* ${plan.subsidyAmount}\n`;
      }
      msg += `   • 🛡️ *Deducible:* ${plan.deductible} | *Máximo de Bolsillo:* ${plan.moop}\n`;
      msg += `   • 🩺 *Médico Primario:* ${plan.primaryCare}\n`;
      msg += `   • 👨‍⚕️ *Especialista:* ${plan.specialist}\n`;
      msg += `   • 💊 *Medicinas:* ${plan.genericRx}\n`;
      if (isMedMaxPlan(plan)) {
        msg += `   • ⚠️ *Regla MedMax:* Todos los copagos aplican DESPUÉS de cumplir el deducible anual (excepto preventivo y RelyMD 24/7 a $0).\n`;
      }
      if (plan.clientSummary) {
        msg += `   • 💡 *En palabras simples:* ${plan.clientSummary}\n`;
      }
      msg += `   • 🎁 *Beneficio extra:* ${plan.extraBenefit}\n\n`;
    });

    const total = plans.reduce((acc, p) => acc + parseMoney(p.premium), 0);
    const totalFirst = plans.reduce((acc, p) => acc + getPlanFirstMonth(p), 0);
    if (plans.length > 1 || totalFirst > total) {
      if (totalFirst > total) {
        msg += `🧾 *Total 1.er Mes (incluye fee Sanitas):* $${formatMoney(totalFirst)}\n`;
      }
      msg += `💵 *Total Mensual Regular:* $${formatMoney(total)}/mes\n\n`;
    }

    msg += `✨ *¿Por qué con Agente Contigo?*\n`;
    msg += `✔ Tu asesoría y trámite son 100% GRATUITOS.\n`;
    msg += `✔ Te verificamos tus médicos y medicinas en la red.\n`;
    msg += `✔ Asistencia continua durante todo el año.\n\n`;
    msg += `📲 ¿Cuál de estas opciones te gustaría revisar o dejar activa hoy mismo?`;

    navigator.clipboard.writeText(msg);
    onShowToast('¡Mensaje Copiado!', 'Texto completo listo para pegar en WhatsApp.', 'success');
  };

  // Save Quote to Supabase and Local (INTACTO: mismas columnas y nombres en Supabase)
  const handleSaveQuote = async () => {
    const total = plans.reduce((acc, p) => acc + (parseFloat(p.premium) || 0), 0);
    const newQuote: SavedQuote = {
      id: 'quote-' + Date.now(),
      clientName,
      location: clientLocation,
      members: clientMembers,
      ages: clientAges,
      year: quoteYear,
      agentName,
      plans,
      totalMonthlyPremium: total,
      createdAt: new Date().toLocaleDateString()
    };

    const updated = [newQuote, ...savedQuotesList];
    setSavedQuotesList(updated);
    saveQuotes(updated);

    const sb = initSupabase();
    if (sb) {
      try {
        await sb.from('cotizaciones').upsert([
          {
            id: newQuote.id,
            cliente_nombre: newQuote.clientName,
            ubicacion: newQuote.location,
            miembros: newQuote.members,
            anio: newQuote.year,
            agente: newQuote.agentName,
            planes: newQuote.plans,
            total_mensual: newQuote.totalMonthlyPremium
          }
        ]);
        onShowToast('¡Cotización Guardada!', 'Guardada localmente y sincronizada en Supabase.', 'success');
        return;
      } catch (e) {
        console.warn('Could not sync quote to Supabase:', e);
      }
    }

    onShowToast('Cotización Guardada', 'Guardada en tu historial de propuestas.', 'success');
  };

  const loadSavedQuote = (q: SavedQuote) => {
    setClientName(q.clientName);
    setClientLocation(q.location);
    setClientMembers(q.members);
    setClientAges(q.ages || '');
    setQuoteYear(q.year);
    setAgentName(q.agentName);
    setPlans(q.plans);
    onShowToast('Cotización Cargada', `Se cargó la propuesta de ${q.clientName}.`, 'info');
  };

  // Delete individual quote
  const handleDeleteQuote = async (quoteId: string, clientTitle: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (!window.confirm(`¿Estás seguro de que deseas eliminar la cotización de "${clientTitle}"?`)) {
      return;
    }

    const updated = savedQuotesList.filter(q => q.id !== quoteId);
    setSavedQuotesList(updated);
    saveQuotes(updated);

    const sb = initSupabase();
    if (sb) {
      try {
        await sb.from('cotizaciones').delete().eq('id', quoteId);
      } catch (err) {
        console.warn('Could not delete quote from Supabase:', err);
      }
    }

    onShowToast('Cotización Eliminada', `Se eliminó la propuesta de "${clientTitle}".`, 'info');
  };

  // Clear all saved quotes / test runs
  const handleClearAllQuotes = async () => {
    if (savedQuotesList.length === 0) return;

    if (
      !window.confirm(
        `¿Deseas eliminar las ${savedQuotesList.length} cotizaciones guardadas del historial? Esta acción borrará todas las pruebas.`
      )
    ) {
      return;
    }

    const ids = savedQuotesList.map(q => q.id);
    setSavedQuotesList([]);
    saveQuotes([]);

    const sb = initSupabase();
    if (sb && ids.length > 0) {
      try {
        await sb.from('cotizaciones').delete().in('id', ids);
      } catch (err) {
        console.warn('Could not delete quotes from Supabase:', err);
      }
    }

    onShowToast('Historial Vaciado', 'Se han borrado todas las cotizaciones de prueba.', 'info');
  };

  const totalMonthly = plans.reduce((acc, p) => acc + (parseFloat(p.premium) || 0), 0);
  const totalSanitasFee = plans.reduce((acc, p) => acc + getPlanSanitasFee(p), 0);
  const totalFirstMonth = totalMonthly + totalSanitasFee;

  // Documento Oficial Agente Contigo compartido entre #printableProposal y Vista Previa
  const renderOfficialAgenteContigoDocument = () => (
    <div className="bg-white text-slate-900">
      {/* Encabezado Oficial Agente Contigo */}
      <div className="px-6 sm:px-8 pt-6 pb-4 border-b-2 border-[#008be3]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <svg className="w-11 h-11 shrink-0" viewBox="0 0 100 100" fill="none">
              <circle cx="58" cy="27" r="13" fill="#008be3" />
              <circle cx="43" cy="33" r="10" fill="#00c9b7" />
              <path
                d="M42 42C29 44 24 55 24 67C24 81 37 90 53 90C67 90 77 82 77 69C77 56 69 49 61 47C56 52 50 56 42 42Z"
                fill="#00c9b7"
                fillOpacity="0.85"
              />
              <path
                d="M53 45C63 46 72 52 74 65C70 76 60 83 48 83C36 83 31 75 31 69C31 60 41 51 53 45Z"
                fill="#008be3"
              />
            </svg>
            <div className="leading-tight">
              <span className="text-2xl font-black tracking-tight text-[#00c9b7]">
                Agente<span className="text-[#008be3]">Contigo</span>
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Asesoría Oficial en Seguros de Salud
              </span>
            </div>
          </div>

          <div className="sm:text-right">
            <h1 className="text-lg sm:text-xl font-black text-[#005b9f] tracking-tight">
              Cotización de Cobertura de Salud
            </h1>
            <p className="text-xs font-bold text-[#00a396]">
              Propuesta de Protección Médica Familiar • Período {quoteYear}
            </p>
          </div>
        </div>

        {/* Barra Resumen Titular / Grupo Familiar / Edades / Asesoría */}
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-slate-500">Titular: </span>
            <strong className="text-slate-900 font-black">{clientName}</strong>
          </div>
          <div>
            <span className="font-bold text-slate-500">Grupo Familiar: </span>
            <strong className="text-slate-900 font-bold">
              {clientMembers} ({clientLocation})
            </strong>
          </div>
          {clientAges.trim() && (
            <div>
              <span className="font-bold text-slate-500">Edades: </span>
              <strong className="text-slate-900 font-bold">{clientAges}</strong>
            </div>
          )}
          <div>
            <span className="font-bold text-slate-500">Asesoría: </span>
            <strong className="text-[#008be3] font-black">
              Agente Contigo{agentName && agentName !== 'Equipo Agente Contigo' ? ` (${agentName})` : ''}
            </strong>
          </div>
        </div>
      </div>

      {/* Cuerpo de Opciones */}
      <div className="p-6 sm:p-8 space-y-5">
        {plans.map((plan, idx) => {
          const regularMonthly = parseMoney(plan.premium);
          const sanitasFee = getPlanSanitasFee(plan);
          const firstMonth = regularMonthly + sanitasFee;
          const isMedMax = isMedMaxPlan(plan);
          const highlights = getPlanHighlights(plan);

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-5 space-y-3 print-avoid-break ${
                plan.isRecommended
                  ? 'border-[#00a396] ring-1 ring-[#00c9b7]/40 bg-white shadow-sm'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {/* Encabezado de la Opción */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-black text-slate-900">
                      Opción {idx + 1}: {plan.planName}
                    </h2>
                    {plan.isRecommended && (
                      <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[10px] font-black uppercase tracking-wider">
                        ★ Opción Recomendada
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#008be3]">
                    {plan.subtitleTag || `${plan.company} • ${plan.tier}`}
                  </p>
                </div>

                <div className="sm:text-right shrink-0">
                  <div className="text-2xl font-black text-[#005b9f] tabular-nums leading-none">
                    ${formatMoney(regularMonthly)}{' '}
                    <span className="text-xs font-bold text-slate-500">/ mes</span>
                  </div>
                  {sanitasFee > 0 ? (
                    <span className="text-[11px] font-extrabold text-teal-700 block mt-1">
                      Mes regular (1.er mes: ${formatMoney(firstMonth)} con fee único Sanitas +${formatMoney(sanitasFee)})
                    </span>
                  ) : plan.planCategory === 'aca' && plan.subsidyAmount ? (
                    <span className="text-[11px] font-bold text-emerald-700 block mt-1">
                      Prima con subsidio (Crédito fiscal: {plan.subsidyAmount})
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-500 block mt-1">
                      Prima mensual estimada ({clientMembers})
                    </span>
                  )}
                </div>
              </div>

              {/* Barra Obligatoria: Deducible Anual + Máximo de Bolsillo (SIEMPRE visible) */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold text-slate-700">
                    Deducible Anual: <strong className="text-slate-900">{plan.deductible || '$0'}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-bold text-[#005b9f]">
                    Máximo de Bolsillo (Out-of-Pocket Max):{' '}
                    <strong className="text-slate-900">{plan.moop || 'Consultar detalle'}</strong>
                  </span>
                </div>
                <span className="font-extrabold text-slate-900 tabular-nums shrink-0">
                  ${formatMoney(regularMonthly)} / mes
                </span>
              </div>

              {/* Resumen Rápido de Copagos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-cyan-50/50 border border-cyan-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-slate-500 block font-semibold">Médico Primario (PCP)</span>
                  <strong className="text-slate-900 font-extrabold">{plan.primaryCare || '$0'}</strong>
                </div>
                <div className="bg-cyan-50/50 border border-cyan-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-slate-500 block font-semibold">Especialista</span>
                  <strong className="text-slate-900 font-extrabold">{plan.specialist || '$0'}</strong>
                </div>
                <div className="bg-cyan-50/50 border border-cyan-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-slate-500 block font-semibold">Medicinas Genéricas</span>
                  <strong className="text-slate-900 font-extrabold">{plan.genericRx || '$0'}</strong>
                </div>
                <div className="bg-cyan-50/50 border border-cyan-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-slate-500 block font-semibold">Urgencias / ER</span>
                  <strong className="text-slate-900 font-extrabold">{plan.urgencies || '$0'}</strong>
                </div>
              </div>

              {/* Alerta Obligatoria MedMax */}
              {(isMedMax || plan.deductibleWarning) && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl px-3.5 py-2.5 text-[11.5px] text-amber-950 font-semibold leading-snug">
                  <strong className="uppercase tracking-wide font-black text-amber-900">
                    ⚠️ Atención – Regla del Deducible MedMax:{' '}
                  </strong>
                  <span>{plan.deductibleWarning || MEDMAX_DEFAULT_WARNING}</span>
                </div>
              )}

              {/* Viñetas Detalladas de Cobertura */}
              {highlights.length > 0 && (
                <ul className="space-y-1.5 text-[11.5px] text-slate-700 leading-relaxed pl-4 list-disc">
                  {highlights.map((item, hIdx) => (
                    <li key={hIdx}>{item}</li>
                  ))}
                </ul>
              )}

              {plan.extraBenefit && !highlights.some(h => h.includes(plan.extraBenefit)) && (
                <div className="text-[11px] text-slate-600 bg-slate-50/80 border border-slate-100 rounded-lg px-3 py-1.5 flex items-start gap-1.5">
                  <span className="text-[#00a396] font-black">✓</span>
                  <span>{plan.extraBenefit}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* CUADRO COMPARATIVO RESUMEN OBLIGATORIO AL FINAL DE TODO PDF */}
        <div className="pt-2 print-avoid-break">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2.5">
            CUADRO COMPARATIVO DE INVERSIÓN ({clientMembers.toUpperCase()})
          </h3>
          <div className="overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800">
                  <th className="py-2.5 px-3 font-black">Alternativa de Cobertura</th>
                  <th className="py-2.5 px-3 font-black">Estructura y Máximo de Bolsillo</th>
                  <th className="py-2.5 px-3 font-black text-right">1.er Mes</th>
                  <th className="py-2.5 px-3 font-black text-right">Mensualidad Regular</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {plans.map((plan, idx) => {
                  const reg = parseMoney(plan.premium);
                  const fee = getPlanSanitasFee(plan);
                  const firstM = reg + fee;
                  return (
                    <tr key={plan.id} className={plan.isRecommended ? 'bg-teal-50/40' : 'bg-white'}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        Opción {idx + 1}: {plan.company} — {plan.planName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="font-semibold text-slate-800">{plan.tier}</span>
                        <span className="block text-[11px]">
                          Ded: {plan.deductible || '$0'} • Máx. Bolsillo: <strong>{plan.moop || 'Consultar'}</strong>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-[#005b9f] tabular-nums">
                        ${formatMoney(firstM)}
                        {fee > 0 && (
                          <span className="block text-[10px] font-bold text-teal-700">
                            (incl. +${formatMoney(fee)} Sanitas)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 tabular-nums">
                        ${formatMoney(reg)}
                      </td>
                    </tr>
                  );
                })}
                {(plans.length > 1 || totalSanitasFee > 0) && (
                  <tr className="bg-cyan-50/60 border-t-2 border-[#008be3]/40">
                    <td className="py-2.5 px-3 font-black text-[#005b9f]" colSpan={2}>
                      Total Combinado Estimado ({plans.length} {plans.length === 1 ? 'plan' : 'planes'})
                      {totalSanitasFee > 0 && (
                        <span className="text-[11px] font-bold text-teal-700 ml-2">
                          • Fee único inscripción Sanitas 1.er mes: +${formatMoney(totalSanitasFee)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-[#005b9f] tabular-nums">
                      ${formatMoney(totalFirstMonth)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 tabular-nums">
                      ${formatMoney(totalMonthly)}/mes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nota de Asesoría */}
        <div className="bg-slate-50 border-l-4 border-[#008be3] rounded-r-xl px-4 py-2.5 text-[11px] text-slate-600 print-avoid-break">
          <strong className="text-slate-800">Información de asesoría: </strong>
          Cotización elaborada específicamente para {clientName} ({clientMembers}
          {clientAges ? ` • Edades: ${clientAges}` : ''} • {clientLocation}). Las coberturas y tarifas se rigen según
          las condiciones de suscripción y disponibilidad geográfica de cada compañía aseguradora.
        </div>
      </div>

      {/* Footer Oficial Agente Contigo */}
      <div className="py-3 px-6 sm:px-8 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <span className="font-bold text-[#008be3]">
          Agente Contigo • Cotización Personalizada de Salud
        </span>
        <span className="font-semibold text-slate-400">
          Asesoría 100% Gratuita • Período {quoteYear}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Fast Actions */}
      {!isPrinting && (
        <>
          <div
            id="quoterTopBanner"
            className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-teal-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print quoter-edit-section"
          >
            <div>
              <span className="px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full text-[10px] font-black uppercase tracking-wider inline-block mb-2">
                Módulo Oficial de Cotización • Agente Contigo
              </span>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-400" />
                Cotizador Inteligente Multicompañía con IA
              </h2>
              <p className="text-xs text-teal-200/80 mt-1">
                Genera propuestas oficiales Agente Contigo en PDF, usa plantillas en modo manual o con IA y redacta correos al cliente.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowApiKeyModal(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700 flex items-center gap-2 shadow cursor-pointer"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    geminiApiKey ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                ></span>
                <span className="font-bold">{geminiApiKey ? 'IA Conectada' : 'Configurar IA'}</span>
              </button>

              <button
                type="button"
                onClick={() => openEmailGenerator()}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black transition flex items-center gap-1.5 shadow cursor-pointer"
                title="Generar y copiar correo profesional para el cliente (Privado / ACA)"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Generar Correo</span>
              </button>

              <button
                type="button"
                onClick={copyShortTextMessage}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
                title="Copiar mensaje de texto SMS resumido para enviar al cliente"
              >
                <Send className="w-3.5 h-3.5" />
                <span>SMS</span>
              </button>

              <button
                type="button"
                onClick={copyWhatsAppMessage}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
                title="Copiar formato completo para WhatsApp"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl font-bold transition flex items-center gap-1.5 border border-cyan-800 shadow cursor-pointer"
                title="Ver vista previa limpia de la cotización oficial Agente Contigo"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Vista Previa</span>
              </button>

              <button
                type="button"
                onClick={handlePrintProposal}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl font-extrabold transition flex items-center gap-1.5 shadow-lg cursor-pointer"
                title="Imprimir únicamente la cotización oficial Agente Contigo en PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir / PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSaveQuote}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar</span>
              </button>
            </div>
          </div>

          {/* Grid: Prospect Data & Image OCR */}
          <div
            id="quoterProspectAndUploadGrid"
            className="grid grid-cols-1 lg:grid-cols-12 gap-5 no-print quoter-edit-section"
          >
            {/* Panel 1: Datos del Prospecto + Edades + Validación ZIP */}
            <div
              id="quoterProspectPanel"
              className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 no-print quoter-edit-section"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-xl bg-cyan-100/70 text-[#00c9b7] flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Datos del Prospecto</h2>
                  <p className="text-[11px] text-slate-500">Aparecerán en la propuesta oficial y validan disponibilidad</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="Ej. Nelson Díaz / Familia Ramírez"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
                  />
                </div>

                {/* ESTADO / ZIP + EDAD(ES) DE LOS SOLICITANTES */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">Estado / Zip Code</label>
                    <input
                      type="text"
                      value={clientLocation}
                      onChange={e => setClientLocation(e.target.value)}
                      placeholder="Ej. Florida (33166)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">
                      Edad(es) de los Solicitantes
                    </label>
                    <input
                      type="text"
                      value={clientAges}
                      onChange={e => setClientAges(e.target.value)}
                      placeholder="Ej. 38, 35 y 7 años"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
                    />
                  </div>
                </div>

                {/* GRUPO FAMILIAR (con selector rápido para tarifa automática de Sanitas Care) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold uppercase text-slate-600">
                      Grupo Familiar (calcula Sanitas Care)
                    </label>
                    <span className="text-[10px] font-bold text-[#008be3] flex items-center gap-1">
                      <Users className="w-3 h-3" /> Auto-tarifa Sanitas
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={FAMILY_GROUP_PRESETS.includes(clientMembers) ? clientMembers : 'custom'}
                      onChange={e => {
                        if (e.target.value !== 'custom') {
                          setClientMembers(e.target.value);
                        }
                      }}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-bold text-slate-800 text-xs"
                    >
                      {FAMILY_GROUP_PRESETS.map(preset => (
                        <option key={preset} value={preset}>
                          {preset}
                        </option>
                      ))}
                      <option value="custom">Texto Personalizado...</option>
                    </select>
                    <input
                      type="text"
                      value={clientMembers}
                      onChange={e => setClientMembers(e.target.value)}
                      placeholder="Ej. Pareja / Titular + 1 Niño"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">Año de Cobertura</label>
                    <input
                      type="text"
                      value={quoteYear}
                      onChange={e => setQuoteYear(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">Agente Asignado</label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Validación Geográfica por ZIP Code y Edades */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between font-black text-slate-800 uppercase text-[10px]">
                  <span className="flex items-center gap-1 text-[#008be3]">
                    <MapPin className="w-3.5 h-3.5" /> Validación Geográfica (ZIP) y Edades
                  </span>
                  {geoAge.detectedState && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-[#005b9f]">
                      {geoAge.detectedState} {geoAge.zipCode ? `• ${geoAge.zipCode}` : ''}
                    </span>
                  )}
                </div>
                <p
                  className={`leading-snug font-medium ${
                    geoAge.sanitasAvailability === 'verify_zip' ? 'text-amber-800' : 'text-teal-800'
                  }`}
                >
                  • {geoAge.sanitasNote}
                </p>
                <p
                  className={`leading-snug font-medium ${
                    geoAge.hpgRestrictedState ? 'text-amber-800' : 'text-slate-600'
                  }`}
                >
                  • {geoAge.hpgNote}
                </p>
                <p
                  className={`leading-snug font-medium ${
                    geoAge.hasSenior65Plus ? 'text-rose-700 font-bold' : 'text-slate-600'
                  }`}
                >
                  • {geoAge.ageNote}
                </p>
              </div>
            </div>

            {/* Panel 2: Subida Inteligente & Visión IA */}
            <div
              id="quoterUploadOcrPanel"
              className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 no-print quoter-edit-section flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-blue-100/70 text-[#008be3] flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">Subir Capturas de los Cotizadores</h2>
                      <p className="text-[11px] text-slate-500">
                        Opcional: sube capturas / PDF o usa directamente el modo manual con los botones de abajo
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addManualPlan}
                    className="text-xs font-bold text-[#008be3] hover:text-[#00c9b7] flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar Plan Manual</span>
                  </button>
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-300 hover:border-[#00c9b7] bg-slate-50/60 hover:bg-cyan-50/20 rounded-2xl p-6 text-center transition-all cursor-pointer relative"
                >
                  <input
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    multiple
                    onChange={e => e.target.files && processIncomingFiles(Array.from(e.target.files))}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-cyan-100/80 flex items-center justify-center text-[#00c9b7]">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      Haz clic para subir o arrastra tus capturas o documentos PDF aquí
                    </p>
                    <p className="text-[11px] text-slate-400">
                      💡 Acepta capturas (PNG, JPG) o folletos/cotizaciones oficiales en PDF. También puedes pegar (
                      <kbd className="px-1 bg-slate-200 rounded font-bold">Ctrl + V</kbd>).
                    </p>
                  </div>
                </div>

                {/* Thumbnails */}
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {uploadedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 shrink-0"
                      >
                        {file.mimeType?.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 p-1 text-center">
                            <FileText className="w-7 h-7 text-rose-500 mb-0.5" />
                            <span className="text-[9px] font-black text-rose-800 line-clamp-1 break-all px-0.5">
                              {file.name.slice(0, 10)}
                            </span>
                          </div>
                        ) : (
                          <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs opacity-90 hover:opacity-100 shadow transition cursor-pointer"
                          title="Remover archivo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Google Search Toggle */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={enableWebSearch}
                      onChange={e => setEnableWebSearch(e.target.checked)}
                      className="w-4 h-4 rounded text-[#00c9b7] focus:ring-[#00c9b7]"
                    />
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-600" />
                      Conectar a Internet (Google Search en vivo)
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Verifica beneficios y disponibilidad para {clientLocation}.
                  </span>
                </div>
              </div>

              {/* AI Trigger */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <div className="font-semibold text-slate-500 flex items-center gap-2">
                  <span>{aiStatusText}</span>
                </div>

                <button
                  type="button"
                  disabled={uploadedFiles.length === 0 || isAnalyzingAI}
                  onClick={processImagesWithAI}
                  className="px-5 py-2.5 font-extrabold text-white bg-gradient-to-r from-[#00c9b7] to-[#008be3] hover:opacity-95 rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isAnalyzingAI ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analizando con IA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-white" />
                      <span>Extraer Datos con IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Barra de Selectores Rápidos: 6 Botones Independientes (Sanitas Care y HospitalWise SEPARADOS) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3 no-print quoter-edit-section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Selectores Rápidos de Planes Oficiales (Agente Contigo)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Modo manual completo: haz clic sin subir fotos para crear la tarjeta con beneficios oficiales e ingresar tu prima al instante.
                  </p>
                </div>
              </div>

              {plans.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPlans([])}
                  className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 transition cursor-pointer self-start sm:self-auto"
                >
                  Vaciar Lista Actual ({plans.length})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
              {PLAN_TEMPLATES.map(tpl => (
                <button
                  key={tpl.category}
                  type="button"
                  onClick={() => addTemplatePlan(tpl)}
                  className={`p-3 rounded-2xl border text-left transition shadow-xs cursor-pointer flex flex-col justify-between gap-1 ${tpl.accentColor}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-xs">+ {tpl.shortLabel}</span>
                    <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  </div>
                  <span className="text-[10px] font-bold opacity-85">{tpl.badgeText}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Panel 3: Planes a Presentar al Cliente Editor */}
          <div
            id="quoterPlanEditorPanel"
            className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 no-print quoter-edit-section"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00c9b7]"></span>
                Planes a Presentar al Cliente ({plans.length})
              </h3>
              <div className="flex items-center gap-3 text-xs">
                {totalSanitasFee > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-bold">
                    1.er Mes (+Fee Sanitas): ${formatMoney(totalFirstMonth)}
                  </span>
                )}
                <span className="text-slate-400 hidden sm:inline">Edición en vivo sincronizada con PDF y Correo</span>
              </div>
            </div>

            {plans.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No hay planes agregados aún. Selecciona una plantilla rápida arriba, sube una captura o haz clic en "+ Agregar Plan Manual".
              </div>
            ) : (
              <div className="space-y-4">
                {plans.map((plan, index) => {
                  const sanitasFee = getPlanSanitasFee(plan);
                  const firstMonthVal = getPlanFirstMonth(plan);
                  const isMedMax = isMedMaxPlan(plan);
                  const isSanitas = isSanitasPlan(plan) && !isHospitalWisePlan(plan);
                  const isHospitalWise = isHospitalWisePlan(plan);

                  return (
                    <div
                      key={plan.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                          <span className="w-6 h-6 rounded-lg bg-[#00c9b7] text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={plan.company}
                            onChange={e => updatePlan(plan.id, 'company', e.target.value)}
                            placeholder="Compañía (ej. UnitedHealthcare)"
                            className="font-black text-slate-900 text-xs sm:text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#008be3] outline-none w-full"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <select
                            value={plan.planCategory || 'custom'}
                            onChange={e => updatePlan(plan.id, 'planCategory', e.target.value as QuotePlanCategory)}
                            className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-200 rounded-lg text-slate-700 outline-none"
                            title="Tipo de plantilla del plan"
                          >
                            <option value="custom">Personalizado</option>
                            <option value="medmax">MedMax (Tras Deducible)</option>
                            <option value="hpg4000">HPG Preferred 4000</option>
                            <option value="ahw4">AHW 4 (First Health)</option>
                            <option value="sanitas">Sanitas Care</option>
                            <option value="hospitalwise">HospitalWise Bundle 1</option>
                            <option value="aca">Plan ACA (Obamacare)</option>
                          </select>

                          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={plan.isRecommended}
                              onChange={e => updatePlan(plan.id, 'isRecommended', e.target.checked)}
                              className="rounded text-[#00c9b7] focus:ring-[#00c9b7]"
                            />
                            <span className="font-bold text-[11px]">Recomendado</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => deletePlan(plan.id)}
                            className="text-slate-400 hover:text-red-500 p-1 text-xs transition cursor-pointer"
                            title="Eliminar este plan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500">Nombre del Plan</label>
                          <input
                            type="text"
                            value={plan.planName}
                            onChange={e => updatePlan(plan.id, 'planName', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#00c9b7] outline-none font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase text-[#005b9f]">
                            {plan.planCategory === 'aca'
                              ? 'Prima con Subsidio ($/mes) *'
                              : isHospitalWise
                                ? 'Prima Mensual HospitalWise ($/mes) *'
                                : 'Prima Mensual Regular ($/mes) *'}
                          </label>
                          <input
                            ref={el => {
                              premiumInputRefs.current[plan.id] = el;
                            }}
                            type="text"
                            value={plan.premium}
                            onChange={e => updatePlan(plan.id, 'premium', e.target.value)}
                            placeholder={
                              isHospitalWise
                                ? 'Ej. 25.79 o 110.18'
                                : isMedMax
                                  ? 'Ej. 889.00'
                                  : plan.planCategory === 'hpg4000'
                                    ? 'Ej. 435.09'
                                    : 'Ej. 0.00'
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white border-2 border-[#008be3]/50 rounded-lg focus:ring-2 focus:ring-[#00c9b7] focus:border-[#00c9b7] outline-none font-black text-[#005b9f]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500">Nivel / Categoría</label>
                          <input
                            type="text"
                            value={plan.tier}
                            onChange={e => updatePlan(plan.id, 'tier', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#00c9b7] outline-none font-medium"
                          />
                        </div>
                      </div>

                      {/* Fila de Costos y Copagos (incluye Máximo de Bolsillo obligatorio y Deducible destacado para MedMax) */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                        <div>
                          <label
                            className={`block text-[10px] font-bold ${
                              isMedMax ? 'text-amber-800 font-black' : 'text-slate-400'
                            }`}
                          >
                            {isMedMax ? 'Deducible Anual *' : 'Deducible'}
                          </label>
                          <input
                            type="text"
                            value={plan.deductible}
                            onChange={e => updatePlan(plan.id, 'deductible', e.target.value)}
                            placeholder="$3,000"
                            className={`w-full px-2 py-1 text-xs bg-white rounded-lg font-bold ${
                              isMedMax ? 'border-2 border-amber-400 text-amber-950' : 'border border-slate-200'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#005b9f]">Máximo de Bolsillo *</label>
                          <input
                            type="text"
                            value={plan.moop}
                            onChange={e => updatePlan(plan.id, 'moop', e.target.value)}
                            placeholder="$1,500"
                            className="w-full px-2 py-1 text-xs bg-white border border-sky-200 rounded-lg font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400">
                            {plan.planCategory === 'aca' ? 'Dr. Primario (Día 1)' : 'Dr. Primario'}
                          </label>
                          <input
                            type="text"
                            value={plan.primaryCare}
                            onChange={e => updatePlan(plan.id, 'primaryCare', e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400">
                            {plan.planCategory === 'aca' ? 'Especialista (Día 1)' : 'Especialista'}
                          </label>
                          <input
                            type="text"
                            value={plan.specialist}
                            onChange={e => updatePlan(plan.id, 'specialist', e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400">
                            {plan.planCategory === 'aca' ? 'Genéricos (Día 1)' : 'Med. Genérica'}
                          </label>
                          <input
                            type="text"
                            value={plan.genericRx}
                            onChange={e => updatePlan(plan.id, 'genericRx', e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400">Urgencias / ER</label>
                          <input
                            type="text"
                            value={plan.urgencies}
                            onChange={e => updatePlan(plan.id, 'urgencies', e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                          />
                        </div>
                      </div>

                      {/* Selector rápido de tarifa Sanitas Care dentro de la tarjeta */}
                      {isSanitas && (
                        <div className="bg-teal-50/70 p-2.5 rounded-xl border border-teal-200 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase text-teal-900">
                            Ajuste Rápido Tarifa Sanitas Care ({geoAge.detectedState === 'AZ' || geoAge.detectedState === 'TX' ? 'AZ/TX Essential o Plus' : 'Plus'}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: 'Individual $89', price: '89.00', group: 'Individual (Solo Adulto)' },
                              { label: 'Titular + 1 Niño $125', price: '125.00', group: 'Titular + 1 Niño' },
                              { label: 'Pareja $159', price: '159.00', group: 'Pareja (2 Adultos)' },
                              { label: 'Familia 3+ $195', price: '195.00', group: 'Familia (2 Adultos + 1 Niño)' },
                              { label: 'Familia 4+ $240', price: '240.00', group: 'Familia (2 Adultos + 2 Niños)' }
                            ].map(opt => (
                              <button
                                key={opt.label}
                                type="button"
                                onClick={() => {
                                  updatePlan(plan.id, 'premium', opt.price);
                                  updatePlan(plan.id, 'planName', `Sanitas Care Plus (${opt.group})`);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                  parseMoney(plan.premium) === parseMoney(opt.price)
                                    ? 'bg-teal-600 text-white border-teal-700'
                                    : 'bg-white text-teal-900 border-teal-200 hover:bg-teal-100'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Opciones Especiales según Plan (Sanitas Fee $40 / ACA Subsidio) */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-teal-800">
                            <input
                              type="checkbox"
                              checked={sanitasFee > 0}
                              onChange={e => updatePlan(plan.id, 'hasSanitasFee', e.target.checked)}
                              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                            />
                            <span>Sumar Fee Único de Inscripción Sanitas (+$40.00 en 1.er Mes)</span>
                          </label>

                          {sanitasFee > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 font-black text-[11px] tabular-nums">
                              Total 1.er Mes: ${formatMoney(firstMonthVal)}
                            </span>
                          )}
                        </div>

                        {plan.planCategory === 'aca' && (
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold uppercase text-emerald-700">
                              Crédito Fiscal ACA:
                            </label>
                            <input
                              type="text"
                              value={plan.subsidyAmount || ''}
                              onChange={e => updatePlan(plan.id, 'subsidyAmount', e.target.value)}
                              placeholder="Ej. $485.00/mes"
                              className="px-2 py-1 text-xs bg-emerald-50 border border-emerald-200 rounded-lg font-bold text-emerald-900 w-36 outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Alerta Explícita Editable para MedMax */}
                      {(isMedMax || plan.deductibleWarning) && (
                        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 space-y-1">
                          <label className="text-[10px] font-black uppercase text-amber-900 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Alerta Obligatoria MedMax (Copagos Tras Deducible):
                          </label>
                          <input
                            type="text"
                            value={plan.deductibleWarning || MEDMAX_DEFAULT_WARNING}
                            onChange={e => updatePlan(plan.id, 'deductibleWarning', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs bg-white border border-amber-300 rounded-lg font-semibold text-amber-950 outline-none"
                          />
                        </div>
                      )}

                      {/* Viñetas Detalladas (para PDF Oficial Agente Contigo) */}
                      {Array.isArray(plan.highlights) && plan.highlights.length > 0 && (
                        <div className="bg-slate-100/80 p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-600 block">
                            Desglose de Beneficios en PDF (1 línea por viñeta):
                          </label>
                          <textarea
                            rows={3}
                            value={plan.highlights.join('\n')}
                            onChange={e =>
                              updatePlan(
                                plan.id,
                                'highlights',
                                e.target.value.split('\n').filter(line => line.trim().length > 0)
                              )
                            }
                            className="w-full px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg font-medium text-slate-700 outline-none"
                          />
                        </div>
                      )}

                      {/* Explicación Sencilla con IA */}
                      <div className="bg-cyan-50/50 p-2.5 rounded-xl border border-cyan-100/70 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-[#008be3] uppercase flex items-center gap-1">
                            <span>💡</span> Explicación Sencilla para el Cliente (1-2 oraciones)
                          </label>
                          <button
                            type="button"
                            onClick={() => generatePlanSummaryWithAI(plan.id)}
                            className="text-[11px] font-bold text-[#008be3] hover:text-[#00c9b7] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Redactar con IA</span>
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={plan.clientSummary}
                          onChange={e => updatePlan(plan.id, 'clientSummary', e.target.value)}
                          placeholder="Ej. Con este plan tienes médico primario gratis y pagas $0 al mes..."
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-cyan-200/80 rounded-lg font-medium text-slate-700 outline-none focus:ring-1 focus:ring-[#00c9b7]"
                        />
                      </div>

                      {/* Beneficio Extra & Search online */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">
                            Beneficio Adicional o Coberturas Clave
                          </label>
                          <button
                            type="button"
                            onClick={() => searchPlanBenefitsOnline(plan.id)}
                            className="text-[11px] font-bold text-[#008be3] hover:text-[#00c9b7] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Buscar folleto oficial en Google</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={plan.extraBenefit}
                          onChange={e => updatePlan(plan.id, 'extraBenefit', e.target.value)}
                          className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Panel 4: PROPUESTA PERSONALIZADA IMPRIMIBLE OFICIAL AGENTE CONTIGO */}
      <div
        id="printableProposal"
        className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border-none"
      >
        {renderOfficialAgenteContigoDocument()}
      </div>

      {/* Barra de Acciones del Formato de Cotización */}
      {!isPrinting && (
        <>
          <div className="bg-gradient-to-r from-teal-50 via-white to-sky-50 p-4 sm:p-5 rounded-2xl border border-teal-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 no-print quoter-edit-section">
            <div className="flex items-center gap-3 text-xs">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-[#00c9b7] to-[#008be3] text-white flex items-center justify-center font-bold shadow-sm">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-slate-900 block text-sm font-black">
                  Formato Oficial Agente Contigo Listo para PDF y Correo
                </strong>
                <span className="text-slate-600 text-xs">
                  Documento oficial para <strong className="text-[#008be3]">{clientName}</strong> con Máximo de Bolsillo y
                  Cuadro Comparativo.
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => openEmailGenerator()}
                className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                title="Generar correo profesional (Modo Privado / Sin cambio de estatus o Modo ACA)"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Generar Correo</span>
              </button>
              <button
                type="button"
                onClick={copyShortTextMessage}
                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                title="Copiar mensaje de texto SMS resumido para enviar al cliente"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Copiar SMS</span>
              </button>
              <button
                type="button"
                onClick={copyWhatsAppMessage}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                title="Copiar formato para WhatsApp"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Eye className="w-4 h-4 text-slate-500" />
                <span>Vista Previa</span>
              </button>
              <button
                type="button"
                onClick={handlePrintProposal}
                className="px-5 py-2.5 bg-gradient-to-r from-[#00c9b7] to-[#008be3] hover:opacity-95 text-white rounded-xl font-black text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Guardar como PDF</span>
              </button>
            </div>
          </div>

          {/* Historial de Cotizaciones Guardadas */}
          {savedQuotesList.length > 0 && (
            <div
              id="quoterHistoryPanel"
              className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 no-print quoter-edit-section"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Historial de Cotizaciones Guardadas ({savedQuotesList.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Haz clic en una cotización para recargarla o en el icono de papelera para eliminarla.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClearAllQuotes}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-rose-200 self-start sm:self-auto"
                  title="Borrar todas las cotizaciones de prueba"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Borrar Todas las Pruebas</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {savedQuotesList.map(q => (
                  <div
                    key={q.id}
                    onClick={() => loadSavedQuote(q)}
                    className="p-3.5 rounded-2xl border border-slate-200 hover:border-teal-400 hover:bg-slate-50/70 transition cursor-pointer space-y-2 relative group shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-black text-slate-900 truncate block">{q.clientName}</span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono font-black text-emerald-700 text-xs">
                          ${q.totalMonthlyPremium.toFixed(2)}/mes
                        </span>
                        <button
                          type="button"
                          onClick={e => handleDeleteQuote(q.id, q.clientName, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100/70 rounded-lg transition cursor-pointer"
                          title={`Eliminar cotización de ${q.clientName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>
                        📍 {q.location} · 👥 {q.members}
                      </span>
                      <span className="font-semibold text-slate-600">{q.year}</span>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-1.5">
                      <span>
                        {q.plans.length} plan(es) · Asesor: {q.agentName}
                      </span>
                      <span className="text-teal-600 font-bold group-hover:underline">Cargar →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Generador de Correo Integrado */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">
                    Generador de Correo al Cliente • Agente Contigo
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Para: <strong className="text-teal-300">{clientName}</strong> • {clientLocation}
                    {clientAges ? ` • Edades: ${clientAges}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Modo de Correo */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => handleSwitchEmailMode('privado')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black border text-left transition cursor-pointer flex items-center gap-2 ${
                    emailMode === 'privado'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${emailMode === 'privado' ? 'text-amber-400' : 'text-slate-400'}`} />
                  <div>
                    <span className="block">Sin cambio de estatus / Privado</span>
                    <span className={`text-[10px] font-medium ${emailMode === 'privado' ? 'text-slate-300' : 'text-slate-400'}`}>
                      Alternativas privadas + regla MedMax + zona
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchEmailMode('aca')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black border text-left transition cursor-pointer flex items-center gap-2 ${
                    emailMode === 'aca'
                      ? 'bg-gradient-to-r from-[#00c9b7] to-[#008be3] text-white border-transparent shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${emailMode === 'aca' ? 'text-white' : 'text-slate-400'}`} />
                  <div>
                    <span className="block">Aplica a ACA (Obamacare)</span>
                    <span className={`text-[10px] font-medium ${emailMode === 'aca' ? 'text-cyan-50' : 'text-slate-400'}`}>
                      Destaca crédito fiscal y copagos Día 1
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Editor del Correo */}
            <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Asunto del Correo</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#00c9b7]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Cuerpo del Mensaje (puedes editarlo libremente antes de copiar)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSwitchEmailMode(emailMode)}
                    className="text-[11px] font-bold text-[#008be3] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerar desde planes</span>
                  </button>
                </div>
                <textarea
                  rows={14}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-[#00c9b7]"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <a
                href={`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Abrir en App de Correo</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(emailSubject);
                    onShowToast('Asunto Copiado', 'Asunto del correo copiado al portapapeles.', 'info');
                  }}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Solo Asunto
                </button>
                <button
                  type="button"
                  onClick={copyEmailToClipboard}
                  className="px-5 py-2 bg-gradient-to-r from-[#00c9b7] to-[#008be3] hover:opacity-95 text-white rounded-xl font-black text-xs transition flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Correo Completo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal API Key Gemini */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#00c9b7] to-[#008be3] text-white flex items-center justify-center font-black">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Conexión con Gemini e Internet</h3>
                  <p className="text-[11px] text-slate-500">Google Gemini API Key</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Para que el cotizador pueda <strong>analizar capturas de cotizaciones con IA y consultar folletos oficiales en Google</strong>, puedes conectar tu clave API gratuita.
            </p>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase text-slate-600">Tu Gemini API Key</label>
              <input
                type="password"
                value={tempApiKeyInput}
                onChange={e => setTempApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-mono"
              />
            </div>

            <div className="bg-cyan-50/70 p-3 rounded-2xl border border-cyan-100 text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-[#008be3]">¿Cómo obtenerla gratis en 1 minuto?</p>
              <p>
                1. Entra a{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#008be3] underline font-bold"
                >
                  Google AI Studio (haz clic aquí)
                </a>{' '}
                con tu cuenta de Google.
              </p>
              <p>2. Haz clic en <strong>"Create API Key"</strong> y pégala aquí arriba.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalGeminiApiKey(tempApiKeyInput.trim());
                  setGeminiApiKey(tempApiKeyInput.trim());
                  setShowApiKeyModal(false);
                  onShowToast('Conexión Guardada', 'Clave de Gemini configurada con éxito.', 'success');
                }}
                className="px-5 py-2 font-bold text-white bg-gradient-to-r from-[#00c9b7] to-[#008be3] rounded-xl shadow-md hover:opacity-95 transition cursor-pointer"
              >
                Guardar y Conectar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa Oficial Agente Contigo (Idéntico al PDF) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto flex items-center justify-center no-print">
          <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">
                    Vista Previa • Formato Oficial Agente Contigo
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cliente: <strong className="text-teal-300">{clientName}</strong> • {plans.length}{' '}
                    {plans.length === 1 ? 'opción' : 'opciones'} • Incluye Máximo de Bolsillo y Cuadro Comparativo
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintModal(false);
                    setTimeout(handlePrintProposal, 250);
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#00c9b7] to-[#008be3] hover:opacity-95 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-emerald-50 px-6 py-2.5 border-b border-emerald-200 text-xs text-emerald-900 flex items-center justify-between shrink-0 font-medium">
              <span>
                ✓ Documento listo para entregar o guardar en PDF con encabezado Agente Contigo y cuadro comparativo.
              </span>
              <span className="font-bold text-emerald-800">Año {quoteYear}</span>
            </div>

            <div className="p-4 sm:p-8 bg-slate-100 overflow-y-auto flex-1">
              <div className="rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-4xl mx-auto">
                {renderOfficialAgenteContigoDocument()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
