import React, { useState, useEffect, useRef } from 'react';
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
  QuotePlan,
  QuotePlanCategory,
  SavedQuote
} from '../types';
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
import {
  ACUSA_SPECS,
  AFFORDABLE_CHOICE_AGES,
  AFFORDABLE_CHOICE_SPECS,
  AFI_SPECS,
  AffordableChoiceAge,
  AffordableChoiceGroupKey,
  BMI_PHCS_SPECS,
  FAMILY_GROUP_PRESETS,
  GUARD_SPECS,
  HOSPITALWISE_OFFICIAL_BULLETS,
  HOSPITALWISE_SPECS,
  HPG_SPECS,
  MEDMAX_DEDUCTIBLE_OPTIONS,
  MEDMAX_DEFAULT_WARNING,
  MEDMAX_OFFICIAL_BULLETS,
  PREMIER_MAX_SPECS,
  PREMIER_MM_SPECS,
  PRESIDIO_SPECS,
  SANITAS_OFFICIAL_BULLETS,
  detectAffordableChoiceGroupKey,
  detectAffordableChoiceLevelFromText,
  detectBmiPhcsLevelFromText,
  detectClosestAffordableChoiceAge,
  detectEnrollFamilyTier,
  detectGuardLevelFromText,
  detectHospitalWiseLevelFromText,
  detectHpgLevelFromText,
  detectMedMaxAgeBracket,
  detectPremierMaxLevelFromText,
  detectPremierMmLevelFromText,
  detectPresidioLevelFromText,
  enforceOfficialCatalogOnPlan,
  evaluateGeoAndAgeEligibility,
  formatMoney,
  getExactOfficialBulletsForPlan,
  getMedMaxDeductibleDisplay,
  getMedMaxMoopDisplay,
  getMedMaxQuotePricing,
  getPlanEnrollmentFee,
  getPlanFirstMonth,
  getPlanSanitasFee,
  getSanitasPricingForFamily,
  isAcusaPlan,
  isAffordableChoicePlan,
  isAfiPlan,
  isBmiPhcsPlan,
  isGuardPlan,
  isHpgPlan,
  isHospitalWisePlan,
  isMedMaxPlan,
  isPremierMaxPlan,
  isPremierMmPlan,
  isPresidioPlan,
  isSanitasPlan,
  parseMoney,
  validateMedMaxDeductible
} from '../data/officialPlanCatalog';

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
  // Prospect Form State (formato limpio en blanco con marcas de agua / placeholders)
  const [clientName, setClientName] = useState('');
  const [clientLocation, setClientLocation] = useState('');
  const [clientMembers, setClientMembers] = useState('');
  const [clientAges, setClientAges] = useState('');
  const [quoteYear, setQuoteYear] = useState('');
  const [agentName, setAgentName] = useState(() =>
    currentSeller && currentSeller !== 'Equipo Agente Contigo' ? currentSeller : ''
  );

  // Refs para auto-enfocar la prima mensual al agregar una plantilla manual
  const premiumInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [lastAddedPlanId, setLastAddedPlanId] = useState<string | null>(null);

  // AI & Upload State
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; dataUrl: string; base64: string; mimeType: string }>
  >([]);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiStatusText, setAiStatusText] = useState('Listo para procesar imágenes');

  // API Key State
  const [geminiApiKey, setLocalGeminiApiKey] = useState(getGeminiApiKey);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKeyInput, setTempApiKeyInput] = useState(getGeminiApiKey);

  // Plans List State (inicia vacío para agregar solo los planes deseados)
  const [plans, setPlans] = useState<QuotePlan[]>([]);

  // Saved Quotes
  const [savedQuotesList, setSavedQuotesList] = useState<SavedQuote[]>(loadQuotes);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Email Generator Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailMode>('privado');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Evaluación geográfica (ZIP Code) y de edades en tiempo real
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

    const cleanup = () => {
      setIsPrinting(false);
      document.body.classList.remove('is-printing-proposal');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });

    setTimeout(() => {
      try {
        window.scrollTo(0, 0);
        const mainCol = document.getElementById('appMainColumn');
        if (mainCol) mainCol.scrollTop = 0;
      } catch (_) {}
      window.print();
      // Respaldo por si el navegador en iframe no dispara afterprint
      setTimeout(cleanup, 12000);
    }, 180);
  };

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

  // ============================================================
  // CONSTRUCTORES DE PLANTILLAS OFICIALES CERRADAS (MODO MANUAL)
  // ============================================================
  const addMedMaxPlan = () => {
    const newId = 'plan_medmax_' + Date.now();
    const ageBracket = detectMedMaxAgeBracket(clientAges);
    const familyTier = detectEnrollFamilyTier(clientMembers, clientAges);
    const dedTier: MedMaxDeductibleTier = 750;
    const pricing = getMedMaxQuotePricing(ageBracket, familyTier, dedTier);

    const created: QuotePlan = {
      id: newId,
      tag: 'PLAN MEDMAX (ERISA)',
      planCategory: 'medmax',
      medmaxDeductibleTier: dedTier,
      medmaxScope: pricing.scope,
      medmaxAgeBracket: ageBracket,
      medmaxFamilyTier: familyTier,
      company: 'MedMax (Plan ERISA)',
      planName: 'Plan MedMax',
      tier: `Deductible Value Plan • Edad ${ageBracket} años`,
      subtitleTag: `PLAN ERISA • RED FIRST HEALTH • DEDUCIBLE ${pricing.scope === 'individual' ? 'INDIVIDUAL' : 'FAMILIAR'}`,
      premium: pricing.monthlyPrice,
      deductible: pricing.deductibleLabel,
      moop: pricing.moopLabel,
      primaryCare: '$50 (tras deducible) • RelyMD $0',
      specialist: '$50 (tras deducible)',
      genericRx: '$0 preventivos',
      urgencies: '$50 UC / $250 ER (tras deducible)',
      deductibleWarning: MEDMAX_DEFAULT_WARNING,
      highlights: MEDMAX_OFFICIAL_BULLETS,
      extraBenefit: 'Red First Health + Telemedicina RelyMD $0 + Bill Negotiator; copagos aplican tras cumplir deducible.',
      clientSummary: 'Plan MedMax con copagos tras cumplir el deducible anual (preventivo y RelyMD $0 inmediato).',
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(
      'MedMax Agregado',
      `Tarifa por edad (${ageBracket}) y modalidad ${pricing.scope === 'individual' ? 'Individual' : 'Familiar'}: $${pricing.monthlyPrice}/mes (Ded. ${pricing.deductibleLabel}).`,
      'success'
    );
  };

  const addHpgPlan = (level: HpgPlanLevel = 'preferred4000') => {
    const newId = 'plan_hpg_' + Date.now();
    const spec = HPG_SPECS[level];
    const created: QuotePlan = {
      id: newId,
      tag: `HEALTH PROTECTORGUARD • ${spec.shortLabel.toUpperCase()}`,
      planCategory: 'hpg4000',
      hpgLevel: level,
      company: 'UnitedHealthcare / Golden Rule Insurance Company',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `UNITEDHEALTHCARE / GOLDEN RULE • ${spec.shortLabel.toUpperCase()} • SIN DEDUCIBLE`,
      premium: '',
      deductible: '$0 (Sin deducible)',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: 'Red UnitedHealthcare Choice Plus (~58% ahorro promedio) + Healthiest You $0 + Optum Perks.',
      clientSummary: `${spec.title}: indemnización fija en efectivo sin deducible.`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(`${spec.title} Agregado`, `Cargados los montos exactos de ${spec.shortLabel}. Ingresa la prima mensual.`, 'success');
  };

  const addGuardPlan = (level: GuardPlanLevel = 'guard5000') => {
    const newId = 'plan_guard_' + Date.now();
    const spec = GUARD_SPECS[level];
    const created: QuotePlan = {
      id: newId,
      tag: `GUARD PLANS • ${spec.shortLabel.toUpperCase()}`,
      planCategory: 'guard',
      guardLevel: level,
      company: 'UnitedHealthcare / Golden Rule Insurance Company',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `UNITEDHEALTHCARE / GOLDEN RULE • ${spec.shortLabel.toUpperCase()} • SIN DEDUCIBLE`,
      premium: '',
      deductible: '$0 (Sin deducible)',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: spec.extraBenefitLabel,
      clientSummary: `${spec.title}: indemnización fija en efectivo sin deducible (Red UHC Choice Plus).`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(`${spec.title} Agregado`, `Beneficios oficiales de ${spec.shortLabel} cargados. Ingresa la prima mensual.`, 'success');
  };

  const addAffordableChoicePlan = (level: AffordableChoiceLevel = 'elite') => {
    const newId = `plan_ac_${level}_` + Date.now();
    const spec = AFFORDABLE_CHOICE_SPECS[level];
    const refAge = detectClosestAffordableChoiceAge(clientAges);
    const acGroup = detectAffordableChoiceGroupKey(clientMembers, clientAges);
    const rate = spec.ratesByAge[refAge][acGroup].toFixed(2);
    const groupLabel =
      acGroup === 'solo_ninos'
        ? 'Solo Niños'
        : acGroup === 'pareja'
          ? 'Pareja'
          : acGroup === 'hijos'
            ? 'Padre + Hijos'
            : acGroup === 'familiar'
              ? 'Familia'
              : '1 Persona';

    const created: QuotePlan = {
      id: newId,
      tag: `MANHATTANLIFE • AFFORDABLE CHOICE ${spec.shortLabel.toUpperCase()}`,
      planCategory: 'affordable_choice',
      affordableChoiceLevel: level,
      affordableChoiceAge: refAge,
      medmaxFamilyTier: acGroup === 'solo_ninos' ? undefined : acGroup,
      company: 'ManhattanLife Insurance and Annuity Company',
      planName: spec.title,
      tier: `${spec.tierLabel} • Edad ref. ${refAge} • ${groupLabel}`,
      subtitleTag: `MANHATTANLIFE AFFORDABLE CHOICE • ${spec.shortLabel.toUpperCase()} • SIN PERÍODOS DE ESPERA`,
      premium: rate,
      deductible: '$0 (Sin deducible)',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: spec.extraBenefitLabel,
      clientSummary: `${spec.title}: indemnización fija desde el Día 1 sin restricción de red (tarifa ref. $${rate}/mes).`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(
      `${spec.title} Agregado`,
      `Tarifa de muestra oficial cargada ($${rate}/mes • Edad ref. ${refAge} • ${groupLabel}). Puedes ajustarla al cotizar.`,
      'success'
    );
  };

  const addPresidioPlan = (level: PresidioLevel = 'secure5000') => {
    const newId = `plan_presidio_${level}_` + Date.now();
    const spec = PRESIDIO_SPECS[level];
    const created: QuotePlan = {
      id: newId,
      tag: `PRESIDIO HEALTHCARE • ${spec.shortLabel.toUpperCase()} (SOLO TX)`,
      planCategory: 'presidio',
      presidioLevel: level,
      company: 'Presidio Healthcare (TDI Texas)',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `PRESIDIO FORTRESS • ${spec.shortLabel.toUpperCase()} • SOLO DISPONIBLE EN TEXAS (TX)`,
      premium: '',
      deductible: spec.deductibleLabel,
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: spec.extraBenefitLabel,
      clientSummary: `${spec.title}: $0 deducible, 50% coaseguro hasta MOOP, 100% ilimitado post-MOOP y 50% Rollover (Solo TX).`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    if (geoAge.detectedState && !geoAge.presidioAvailable) {
      onShowToast(
        '⚠️ Presidio aplica SOLO en Texas (TX)',
        `El estado actual (${geoAge.detectedState}) no es elegible para Presidio Fortress. Cambia el ZIP a Texas (TX) o selecciona otro plan.`,
        'info'
      );
    } else {
      onShowToast(
        `${spec.title} Agregado`,
        `Cargados beneficios exactos de ${spec.shortLabel} (Solo TX). Ingresa la prima mensual cotizada.`,
        'success'
      );
    }
  };

  const addBmiPhcsPlan = (level: BmiPhcsLevel = 'value') => {
    const newId = `plan_bmi_${level}_` + Date.now();
    const spec = BMI_PHCS_SPECS[level];
    const famTier = detectEnrollFamilyTier(clientMembers, clientAges);
    const rate = spec.rates[famTier].toFixed(2);
    const isMec = level === 'classic' || level === 'choice';
    const created: QuotePlan = {
      id: newId,
      tag: `BMI-PHCS ${spec.shortLabel.toUpperCase()}`,
      planCategory: 'bmi_phcs',
      bmiLevel: level,
      medmaxFamilyTier: famTier,
      company: 'BMI-PHCS (Red PHCS)',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `RED PHCS • ${isMec ? 'MEC OPTION' : 'BENEFICIO LIMITADO POR DÍA'} • ${spec.shortLabel.toUpperCase()} • +$75 FEE 1.ER MES`,
      premium: rate,
      hasEnrollmentFee: true,
      enrollmentFee: '75.00',
      enrollmentFeeLabel: 'tarifa única de inscripción (BMI-PHCS)',
      deductible: '$0 Ind. / $0 Fam.',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: isMec
        ? 'Plan MEC bajo Red PHCS administrado por MBA Employee Benefits (no es seguro médico mayor tradicional).'
        : 'Plan de beneficio limitado por día bajo Red PHCS (no es seguro médico mayor tradicional).',
      clientSummary: `${spec.title}: $${rate}/mes (+$75.00 fee único de inscripción solo en el 1.er mes).`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(
      `${spec.title} Agregado`,
      `Tarifa oficial $${rate}/mes (+$75.00 fee único solo 1.er mes → $${(parseFloat(rate) + 75).toFixed(2)}).`,
      'success'
    );
  };

  const addAfiPlan = (level: AfiLevel = 'copay3500') => {
    const newId = `plan_afi_${level}_` + Date.now();
    const spec = AFI_SPECS[level];
    const famTier = detectEnrollFamilyTier(clientMembers, clientAges);
    const rate = spec.rates[famTier].toFixed(2);
    const created: QuotePlan = {
      id: newId,
      tag: `AFI ${spec.shortLabel.toUpperCase()}`,
      planCategory: 'afi',
      afiLevel: level,
      medmaxFamilyTier: famTier,
      company: 'AFI Major Medical',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `AFI MAJOR MEDICAL • ${spec.shortLabel.toUpperCase()} • CARGO SOLICITUD $75`,
      premium: rate,
      hasEnrollmentFee: true,
      enrollmentFee: '75.00',
      enrollmentFeeLabel: 'cargo único de solicitud (AFI)',
      deductible: spec.deductibleLabel,
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: 'Major Medical tradicional con Telemedicina MYMDNOW $0 (preautorización requerida en cirugías/internación).',
      clientSummary: `${spec.title}: $${rate}/mes (+$75.00 cargo único de solicitud).`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(`${spec.title} Agregado`, `Tarifa oficial $${rate}/mes (+$75 cargo único de solicitud).`, 'success');
  };

  const addAcusaPlan = (level: AcusaLevel = 'silver2') => {
    const newId = `plan_acusa_${level}_` + Date.now();
    const spec = ACUSA_SPECS[level];
    const famTier = detectEnrollFamilyTier(clientMembers, clientAges);
    const rate = spec.rates[famTier].toFixed(2);
    const created: QuotePlan = {
      id: newId,
      tag: `ACUSA VAULT ${spec.shortLabel.toUpperCase()}`,
      planCategory: 'acusa',
      acusaLevel: level,
      medmaxFamilyTier: famTier,
      company: 'ACUSA • Vault Health Plan',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `ACUSA VAULT • ${spec.shortLabel.toUpperCase()} • EMISIÓN GARANTIZADA`,
      premium: rate,
      hasEnrollmentFee: true,
      enrollmentFee: '75.00',
      enrollmentFeeLabel: 'tarifa única de inscripción (ACUSA)',
      deductible: '$0 Ind. / $0 Fam.',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: 'Telemedicina $0 (Clever Health)',
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: 'Emisión Garantizada Vault Health Plan con Clever Health & Benefits Hero App.',
      clientSummary: `${spec.title}: $${rate}/mes (+$75.00 Application Fee único).`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(`${spec.title} Agregado`, `Tarifa oficial $${rate}/mes (+$75 Application Fee único).`, 'success');
  };

  const addPremierMmPlan = (level: PremierMmLevel = 'mm5000') => {
    const newId = 'plan_pmm_' + Date.now();
    const spec = PREMIER_MM_SPECS[level];
    const ageBracket = detectMedMaxAgeBracket(clientAges);
    const famTier = detectEnrollFamilyTier(clientMembers, clientAges);
    const rate = spec.rates[ageBracket][famTier].toFixed(2);
    const created: QuotePlan = {
      id: newId,
      tag: `PREMIER MAJOR MEDICAL ${spec.shortLabel}`,
      planCategory: 'premier_mm',
      premierMmLevel: level,
      medmaxAgeBracket: ageBracket,
      medmaxFamilyTier: famTier,
      company: 'Premier Major Medical (Cigna PPO)',
      planName: spec.title,
      tier: `${spec.tierLabel} • Edad ${ageBracket} años`,
      subtitleTag: `CIGNA PPO • PREMIER MAJOR MEDICAL ${spec.shortLabel} • COASEGURO 20%`,
      premium: rate,
      hasEnrollmentFee: false,
      deductible: spec.inDeductibleLabel,
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: 'Red Cigna PPO (tarifas ACH; cargos adicionales pueden aplicar con tarjeta o fee de solicitud).',
      clientSummary: `${spec.title} (${ageBracket} años): $${rate}/mes ACH • Deducible ${spec.inDeductibleLabel} • 20% Coaseguro.`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(`${spec.title} Agregado`, `Tarifa ACH oficial $${rate}/mes (Edad ${ageBracket}).`, 'success');
  };

  const addPremierMaxPlan = (level: PremierMaxLevel = 'max2000') => {
    const newId = 'plan_pmax_' + Date.now();
    const spec = PREMIER_MAX_SPECS[level];
    const ageBracket = detectMedMaxAgeBracket(clientAges);
    const famTier = detectEnrollFamilyTier(clientMembers, clientAges);
    const rate = spec.rates[ageBracket][famTier].toFixed(2);
    const created: QuotePlan = {
      id: newId,
      tag: `PREMIER MAX ${spec.shortLabel}`,
      planCategory: 'premier_max',
      premierMaxLevel: level,
      medmaxAgeBracket: ageBracket,
      medmaxFamilyTier: famTier,
      company: 'Premier Max (PHCS / First Health PPO)',
      planName: spec.title,
      tier: `${spec.tierLabel} • Edad ${ageBracket} años`,
      subtitleTag: `PHCS / FIRST HEALTH PPO • PREMIER MAX ${spec.shortLabel} • LÍMITES DE VISITAS`,
      premium: rate,
      hasEnrollmentFee: false,
      deductible: spec.inDeductibleLabel,
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: 'Red PHCS o First Health PPO (tarifas ACH; plan con límites de visitas anuales).',
      clientSummary: `${spec.title} (${ageBracket} años): $${rate}/mes ACH • Deducible ${spec.inDeductibleLabel}.`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(`${spec.title} Agregado`, `Tarifa ACH oficial $${rate}/mes (Edad ${ageBracket}).`, 'success');
  };

  const addSanitasCarePlan = () => {
    const newId = 'plan_sanitas_' + Date.now();
    const pricing = getSanitasPricingForFamily(clientMembers, clientAges);
    const created: QuotePlan = {
      id: newId,
      tag: 'SANITAS CARE PLUS',
      planCategory: 'sanitas',
      company: 'Sanitas Care Plus',
      planName: `Sanitas Care Plus (${pricing.tierLabel})`,
      tier: `Membresía de Atención Primaria y Bienestar`,
      subtitleTag: `SANITAS CARE PLUS (${pricing.tierLabel.toUpperCase()}) • +$40.00 FEE ÚNICO SOLO 1.ER MES`,
      premium: pricing.monthlyPrice,
      hasSanitasFee: true,
      enrollmentFee: '40.00',
      deductible: '$0 (Sin deducibles ni copagos)',
      moop: '$0 Deducible • Sin copagos en servicios incluidos',
      primaryCare: '$0 Ilimitado (Presencial y Virtual en +50 centros FL)',
      specialist: '10% a 40% de descuento en especialistas',
      genericRx: 'Desde $5 (suministro de 30 días)',
      urgencies: '2 visitas/año $0 (centros Sanitas sur de FL)',
      highlights: SANITAS_OFFICIAL_BULLETS,
      extraBenefit: 'Fee único de inscripción $40.00 sumado automáticamente al 1.er mes.',
      clientSummary: `Sanitas Care Plus (${pricing.tierLabel}): $${pricing.monthlyPrice}/mes (1.er mes $${pricing.firstMonthPrice} con fee único de $40.00).`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    if (geoAge.sanitasAvailability === 'unavailable_non_fl') {
      onShowToast(
        '⚠️ Sanitas aplica SOLO en Florida (FL)',
        `El estado actual (${geoAge.detectedState}) no es elegible por ahora. Cambia el ZIP a Florida (FL) o selecciona otro plan.`,
        'info'
      );
    } else {
      const zipWarn =
        geoAge.sanitasAvailability === 'verify_zip'
          ? ' • Aplica solo en Florida (FL).'
          : '';
      onShowToast(
        'Sanitas Care Plus Agregado',
        `${pricing.tierLabel}: $${pricing.monthlyPrice}/mes → 1.er mes $${pricing.firstMonthPrice} (con $40.00 de fee único).${zipWarn}`,
        geoAge.sanitasAvailability === 'verify_zip' ? 'info' : 'success'
      );
    }
  };

  const addHospitalWisePlan = (level: HospitalWiseLevel = 'bundle1') => {
    const spec = HOSPITALWISE_SPECS[level];
    const newId = 'plan_hospitalwise_' + Date.now();
    const created: QuotePlan = {
      id: newId,
      tag: spec.title.toUpperCase(),
      planCategory: 'hospitalwise',
      hospitalwiseLevel: level,
      company: 'Golden Rule Insurance Company (UnitedHealthcare)',
      planName: spec.title,
      tier: spec.tierLabel,
      subtitleTag: `GOLDEN RULE / UHC • ${spec.shortLabel.toUpperCase()} • EMISIÓN GARANTIZADA EN EFECTIVO`,
      premium: '',
      hasSanitasFee: false,
      deductible: '$0 (Sin deducible)',
      moop: spec.moopLabel,
      primaryCare: spec.pcpLabel,
      specialist: spec.specialistLabel,
      genericRx: spec.rxLabel,
      urgencies: spec.urgenciesLabel,
      highlights: spec.bullets,
      extraBenefit: spec.extraBenefitLabel,
      clientSummary: `${spec.title} de Golden Rule Insurance Company (UnitedHealthcare).`,
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(
      `${spec.title} Agregado`,
      'Beneficios oficiales cargados (Golden Rule / UHC). Ingresa la prima mensual (ej. 25.79 o 110.18).',
      'success'
    );
  };

  const addAcaPlan = () => {
    const newId = 'plan_aca_' + Date.now();
    const created: QuotePlan = {
      id: newId,
      tag: 'PLAN ACA (OBAMACARE)',
      planCategory: 'aca',
      company: 'Aseguradora ACA (Oscar / Ambetter / UHC)',
      planName: 'Plan ACA Silver CSR (Obamacare)',
      tier: 'Plata (Silver CSR)',
      planIdCode: '',
      referralRequired: 'No requiere referido',
      subtitleTag: 'MERCADO DE SALUD ACA (OBAMACARE) • COPAGOS DESDE EL DÍA 1',
      premium: '',
      subsidyAmount: '$485.00/mes',
      deductible: '$0',
      moop: '$1,800',
      primaryCare: '$0 PCP | Telemedicina $0',
      specialist: '$15 Especialista',
      acaLabsImaging: 'Laboratorios $0 / Rayos X $15 / Imágenes Avanzadas (MRI/CT) 20%',
      acaErHospital: 'Urgencias $25 / Emergencias (ER) $150 / Hospitalización $150 por día',
      acaRxTiers: 'Nivel 1 Genéricos $3 / Nivel 2 Preferidos $15 / Nivel 3 Marca $35',
      genericRx: '$3',
      urgencies: '$25 UC / $150 ER',
      extraBenefit: 'Crédito fiscal federal aplicado y cobertura esencial mínima ACA sin límites anuales.',
      clientSummary: 'Cobertura ACA con subsidio aplicado y copagos desde el día 1.',
      isRecommended: true
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast('Plan ACA (Obamacare) Agregado', 'Completa prima con crédito fiscal, ID del plan, deducible, MOOP y copagos.', 'success');
  };

  const addManualPlan = () => {
    const newId = 'plan_' + Date.now();
    const newPlan: QuotePlan = {
      id: newId,
      tag: 'OPCIÓN ADICIONAL',
      planCategory: 'custom',
      company: 'Nueva Aseguradora',
      planName: 'Plan Personalizado',
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
    onShowToast('Plan Manual Agregado', 'Escribe la prima mensual y ajusta los copagos o Máximo de Bolsillo.', 'info');
  };

  const deletePlan = (id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  // Combinar / Descombinar Sanitas Care + HospitalWise Bundle 1 en cualquier momento
  const combineSanitasAndHospitalWise = () => {
    const existingSanitas = plans.find(p => isSanitasPlan(p) && !isHospitalWisePlan(p));
    const existingHw = plans.find(p => isHospitalWisePlan(p));
    const bothCombinedNow =
      Boolean(existingSanitas?.includeInCombinedTotal) && Boolean(existingHw?.includeInCombinedTotal);

    if (existingSanitas && existingHw) {
      const targetState = !bothCombinedNow;
      setPlans(prev =>
        prev.map(p =>
          p.id === existingSanitas.id || p.id === existingHw.id
            ? { ...p, includeInCombinedTotal: targetState }
            : p
        )
      );
      onShowToast(
        targetState ? '¡Sanitas + HospitalWise Combinados!' : 'Combinación Desactivada',
        targetState
          ? 'Ahora se sumarán juntos como Paquete Combinado en el PDF, Correo y mensajes (los demás planes no se suman).'
          : 'Sanitas Care y HospitalWise se mostrarán como opciones independientes sin sumarse.',
        targetState ? 'success' : 'info'
      );
      return;
    }

    const pricing = getSanitasPricingForFamily(clientMembers, clientAges);
    const sanitasId = existingSanitas?.id || 'plan_sanitas_' + Date.now();
    const hwId = existingHw?.id || 'plan_hospitalwise_' + (Date.now() + 1);

    const newSanitas: QuotePlan = {
      id: sanitasId,
      tag: 'SANITAS CARE PLUS (PAQUETE COMBINADO)',
      planCategory: 'sanitas',
      company: 'Sanitas Care Plus',
      planName: `Sanitas Care Plus (${pricing.tierLabel})`,
      tier: 'Membresía de Atención Primaria y Bienestar',
      subtitleTag: `SANITAS CARE PLUS (${pricing.tierLabel.toUpperCase()}) • +$40.00 FEE ÚNICO SOLO 1.ER MES`,
      premium: pricing.monthlyPrice,
      hasSanitasFee: true,
      enrollmentFee: '40.00',
      deductible: '$0 (Sin deducibles ni copagos)',
      moop: '$0 Deducible • Sin copagos en servicios incluidos',
      primaryCare: '$0 Ilimitado (Presencial y Virtual en +50 centros FL)',
      specialist: '10% a 40% de descuento en especialistas',
      genericRx: 'Desde $5 (suministro 30 días)',
      urgencies: '2 visitas/año $0 (centros Sanitas sur de FL)',
      highlights: SANITAS_OFFICIAL_BULLETS,
      extraBenefit: 'Fee único de inscripción $40.00 sumado automáticamente al 1.er mes.',
      clientSummary: `Sanitas Care Plus (${pricing.tierLabel}): $${pricing.monthlyPrice}/mes (1.er mes $${pricing.firstMonthPrice} con fee único de $40.00).`,
      isRecommended: false,
      includeInCombinedTotal: true
    };

    const hwBundle1 = HOSPITALWISE_SPECS.bundle1;
    const newHw: QuotePlan = {
      id: hwId,
      tag: 'HOSPITALWISE BUNDLE 1 (PAQUETE COMBINADO)',
      planCategory: 'hospitalwise',
      hospitalwiseLevel: 'bundle1',
      company: 'Golden Rule Insurance Company (UnitedHealthcare)',
      planName: hwBundle1.title,
      tier: hwBundle1.tierLabel,
      subtitleTag: 'GOLDEN RULE / UHC • BUNDLE 1 • EMISIÓN GARANTIZADA EN EFECTIVO',
      premium: '',
      hasSanitasFee: false,
      deductible: '$0 (Sin deducible)',
      moop: hwBundle1.moopLabel,
      primaryCare: hwBundle1.pcpLabel,
      specialist: hwBundle1.specialistLabel,
      genericRx: hwBundle1.rxLabel,
      urgencies: hwBundle1.urgenciesLabel,
      highlights: HOSPITALWISE_OFFICIAL_BULLETS,
      extraBenefit: hwBundle1.extraBenefitLabel,
      clientSummary: 'HospitalWise Bundle 1 de Golden Rule Insurance Company (UnitedHealthcare).',
      isRecommended: false,
      includeInCombinedTotal: true
    };

    setPlans(prev => {
      const updated = prev.map(p =>
        p.id === existingSanitas?.id || p.id === existingHw?.id
          ? { ...p, includeInCombinedTotal: true }
          : p
      );
      if (!existingSanitas) updated.push(newSanitas);
      if (!existingHw) updated.push(newHw);
      return updated;
    });

    setLastAddedPlanId(!existingHw ? hwId : sanitasId);
    onShowToast(
      '¡Paquete Sanitas + HospitalWise Combinado!',
      !existingHw
        ? 'Se sumarán ambos en el Total Paquete Combinado. Ingresa la prima mensual de HospitalWise.'
        : 'Se agregó Sanitas Care y quedó combinado con HospitalWise.',
      'success'
    );
  };

  // Cambiar nivel exacto de HPG (Select 2000 / Preferred 4000 / Premier 5000) con ficha cerrada exacta
  const changeHpgLevel = (id: string, level: HpgPlanLevel) => {
    const spec = HPG_SPECS[level];
    setPlans(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
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
              highlights: spec.bullets
            }
          : p
      )
    );
  };

  // Cambiar nivel exacto de Guard Plans (Guard 4000 / Guard 5000 / Guard 6000)
  const changeGuardLevel = (id: string, level: GuardPlanLevel) => {
    const spec = GUARD_SPECS[level];
    setPlans(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
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
              extraBenefit: spec.extraBenefitLabel
            }
          : p
      )
    );
  };

  // Cambiar configuración de ManhattanLife Affordable Choice (nivel, edad de referencia, grupo)
  const updateAffordableChoiceConfig = (
    id: string,
    updates: Partial<{
      level: AffordableChoiceLevel;
      age: AffordableChoiceAge;
      groupKey: AffordableChoiceGroupKey;
    }>
  ) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const nextLevel =
          updates.level ||
          p.affordableChoiceLevel ||
          detectAffordableChoiceLevelFromText(`${p.planName} ${p.tier}`);
        const nextAge: AffordableChoiceAge =
          updates.age ||
          (p.affordableChoiceAge && AFFORDABLE_CHOICE_AGES.includes(p.affordableChoiceAge as AffordableChoiceAge)
            ? (p.affordableChoiceAge as AffordableChoiceAge)
            : detectClosestAffordableChoiceAge(clientAges));
        const currentGroup: AffordableChoiceGroupKey = (p.tier || '').toLowerCase().includes('solo niños')
          ? 'solo_ninos'
          : p.medmaxFamilyTier || detectAffordableChoiceGroupKey(clientMembers, clientAges);
        const nextGroup = updates.groupKey || currentGroup;
        const spec = AFFORDABLE_CHOICE_SPECS[nextLevel];
        const rate = spec.ratesByAge[nextAge][nextGroup].toFixed(2);
        const groupLabel =
          nextGroup === 'solo_ninos'
            ? 'Solo Niños'
            : nextGroup === 'pareja'
              ? 'Pareja'
              : nextGroup === 'hijos'
                ? 'Padre + Hijos'
                : nextGroup === 'familiar'
                  ? 'Familia'
                  : '1 Persona';
        return {
          ...p,
          planCategory: 'affordable_choice',
          affordableChoiceLevel: nextLevel,
          affordableChoiceAge: nextAge,
          medmaxFamilyTier: nextGroup === 'solo_ninos' ? undefined : nextGroup,
          company: 'ManhattanLife Insurance and Annuity Company',
          planName: spec.title,
          tier: `${spec.tierLabel} • Edad ref. ${nextAge} • ${groupLabel}`,
          subtitleTag: `MANHATTANLIFE AFFORDABLE CHOICE • ${spec.shortLabel.toUpperCase()} • SIN PERÍODOS DE ESPERA`,
          premium: rate,
          deductible: '$0 (Sin deducible)',
          moop: spec.moopLabel,
          primaryCare: spec.pcpLabel,
          specialist: spec.specialistLabel,
          genericRx: spec.rxLabel,
          urgencies: spec.urgenciesLabel,
          highlights: spec.bullets,
          extraBenefit: spec.extraBenefitLabel
        };
      })
    );
  };

  // Cambiar nivel de Presidio Fortress (Elite 2.5K / Secure 5K / Value 7.5K / Essential 10K - Solo TX)
  const changePresidioLevel = (id: string, level: PresidioLevel) => {
    const spec = PRESIDIO_SPECS[level];
    setPlans(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
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
              extraBenefit: spec.extraBenefitLabel
            }
          : p
      )
    );
  };

  // Cambiar nivel exacto de HospitalWise (Basic / Bundle 1 / Bundle 2) con ficha cerrada oficial
  const changeHospitalWiseLevel = (id: string, level: HospitalWiseLevel) => {
    const spec = HOSPITALWISE_SPECS[level];
    setPlans(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
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
              extraBenefit: spec.extraBenefitLabel
            }
          : p
      )
    );
  };

  // Actualizar MedMax por Edad, Modalidad (Ind/Fam), Categoría Familiar y Nivel de Deducible Oficial
  const updateMedMaxConfig = (
    id: string,
    updates: Partial<{
      ageBracket: MedMaxAgeBracket;
      scope: MedMaxScope;
      familyTier: EnrollFamilyTier;
      deductibleTier: MedMaxDeductibleTier;
    }>
  ) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const nextAge = updates.ageBracket || p.medmaxAgeBracket || detectMedMaxAgeBracket(clientAges);
        let nextFam = updates.familyTier || p.medmaxFamilyTier || detectEnrollFamilyTier(clientMembers, clientAges);
        let nextScope = updates.scope || p.medmaxScope || (nextFam === 'empleado' ? 'individual' : 'familiar');

        // Mantener sincronía lógica entre Individual/Familiar y Categoría Familiar
        if (updates.scope === 'individual' && !updates.familyTier) {
          nextFam = 'empleado';
        } else if (updates.scope === 'familiar' && !updates.familyTier && nextFam === 'empleado') {
          nextFam = 'familiar';
        } else if (updates.familyTier && !updates.scope) {
          nextScope = updates.familyTier === 'empleado' ? 'individual' : 'familiar';
        }

        const nextDedTier = updates.deductibleTier || p.medmaxDeductibleTier || 750;
        const pricing = getMedMaxQuotePricing(nextAge, nextFam, nextDedTier);
        const dedLabel = getMedMaxDeductibleDisplay(nextDedTier, nextScope);
        const moopLabel = getMedMaxMoopDisplay(nextScope);

        return {
          ...p,
          planCategory: 'medmax',
          medmaxAgeBracket: nextAge,
          medmaxFamilyTier: nextFam,
          medmaxScope: nextScope,
          medmaxDeductibleTier: nextDedTier,
          tier: `Deductible Value Plan • Edad ${nextAge} años`,
          subtitleTag: `PLAN ERISA • RED FIRST HEALTH • DEDUCIBLE ${nextScope === 'individual' ? 'INDIVIDUAL' : 'FAMILIAR'}`,
          premium: pricing.monthlyPrice,
          deductible: dedLabel,
          moop: moopLabel
        };
      })
    );
  };

  // Actualizar BMI-PHCS (Classic / Choice / Basic / Value / Advantage y grupo familiar)
  const updateBmiConfig = (
    id: string,
    updates: Partial<{ level: BmiPhcsLevel; familyTier: EnrollFamilyTier }>
  ) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const nextLevel =
          updates.level || p.bmiLevel || detectBmiPhcsLevelFromText(`${p.planName} ${p.tier}`);
        const nextFam =
          updates.familyTier || p.medmaxFamilyTier || detectEnrollFamilyTier(clientMembers, clientAges);
        const spec = BMI_PHCS_SPECS[nextLevel];
        const isMec = nextLevel === 'classic' || nextLevel === 'choice';
        return {
          ...p,
          planCategory: 'bmi_phcs',
          bmiLevel: nextLevel,
          medmaxFamilyTier: nextFam,
          company: 'BMI-PHCS (Red PHCS)',
          planName: spec.title,
          tier: spec.tierLabel,
          subtitleTag: `RED PHCS • ${isMec ? 'MEC OPTION' : 'BENEFICIO LIMITADO POR DÍA'} • ${spec.shortLabel.toUpperCase()} • +$75 FEE 1.ER MES`,
          premium: spec.rates[nextFam].toFixed(2),
          hasEnrollmentFee: p.hasEnrollmentFee !== false,
          enrollmentFee: p.enrollmentFee || '75.00',
          enrollmentFeeLabel: 'tarifa única de inscripción (BMI-PHCS)',
          deductible: '$0 Ind. / $0 Fam.',
          moop: spec.moopLabel,
          primaryCare: spec.pcpLabel,
          specialist: spec.specialistLabel,
          genericRx: spec.rxLabel,
          urgencies: spec.urgenciesLabel,
          highlights: spec.bullets,
          extraBenefit: isMec
            ? 'Plan MEC bajo Red PHCS administrado por MBA Employee Benefits (no es seguro médico mayor tradicional).'
            : 'Plan de beneficio limitado por día bajo Red PHCS (no es seguro médico mayor tradicional).'
        };
      })
    );
  };

  // Actualizar AFI Major Medical (3500 HSA vs 3500 Copay y grupo familiar)
  const updateAfiConfig = (
    id: string,
    updates: Partial<{ level: AfiLevel; familyTier: EnrollFamilyTier }>
  ) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const nextLevel = updates.level || p.afiLevel || 'copay3500';
        const nextFam = updates.familyTier || p.medmaxFamilyTier || detectEnrollFamilyTier(clientMembers, clientAges);
        const spec = AFI_SPECS[nextLevel];
        return {
          ...p,
          planCategory: 'afi',
          afiLevel: nextLevel,
          medmaxFamilyTier: nextFam,
          company: 'AFI Major Medical',
          planName: spec.title,
          tier: spec.tierLabel,
          subtitleTag: `AFI MAJOR MEDICAL • ${spec.shortLabel.toUpperCase()} • CARGO SOLICITUD $75`,
          premium: spec.rates[nextFam].toFixed(2),
          deductible: spec.deductibleLabel,
          moop: spec.moopLabel,
          primaryCare: spec.pcpLabel,
          specialist: spec.specialistLabel,
          genericRx: spec.rxLabel,
          urgencies: spec.urgenciesLabel,
          highlights: spec.bullets
        };
      })
    );
  };

  // Actualizar ACUSA Vault (Bronze 2 vs Silver 2 y grupo familiar)
  const updateAcusaConfig = (
    id: string,
    updates: Partial<{ level: AcusaLevel; familyTier: EnrollFamilyTier }>
  ) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const nextLevel = updates.level || p.acusaLevel || 'silver2';
        const nextFam = updates.familyTier || p.medmaxFamilyTier || detectEnrollFamilyTier(clientMembers, clientAges);
        const spec = ACUSA_SPECS[nextLevel];
        return {
          ...p,
          planCategory: 'acusa',
          acusaLevel: nextLevel,
          medmaxFamilyTier: nextFam,
          company: 'ACUSA • Vault Health Plan',
          planName: spec.title,
          tier: spec.tierLabel,
          subtitleTag: `ACUSA VAULT • ${spec.shortLabel.toUpperCase()} • EMISIÓN GARANTIZADA`,
          premium: spec.rates[nextFam].toFixed(2),
          deductible: '$0 Ind. / $0 Fam.',
          moop: spec.moopLabel,
          primaryCare: spec.pcpLabel,
          specialist: spec.specialistLabel,
          urgencies: spec.urgenciesLabel,
          highlights: spec.bullets
        };
      })
    );
  };

  // Actualizar Premier Major Medical (2500 / 5000 / 7500, rango de edad y grupo familiar)
  const updatePremierMmConfig = (
    id: string,
    updates: Partial<{ level: PremierMmLevel; ageBracket: MedMaxAgeBracket; familyTier: EnrollFamilyTier }>
  ) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const nextLevel = updates.level || p.premierMmLevel || 'mm5000';
        const nextAge = updates.ageBracket || p.medmaxAgeBracket || detectMedMaxAgeBracket(clientAges);
        const nextFam = updates.familyTier || p.medmaxFamilyTier || detectEnrollFamilyTier(clientMembers, clientAges);
        const spec = PREMIER_MM_SPECS[nextLevel];
        return {
          ...p,
          planCategory: 'premier_mm',
          premierMmLevel: nextLevel,
          medmaxAgeBracket: nextAge,
          medmaxFamilyTier: nextFam,
          company: 'Premier Major Medical (Cigna PPO)',
          planName: spec.title,
          tier: `${spec.tierLabel} • Edad ${nextAge} años`,
          subtitleTag: `CIGNA PPO • PREMIER MAJOR MEDICAL ${spec.shortLabel} • COASEGURO 20%`,
          premium: spec.rates[nextAge][nextFam].toFixed(2),
          deductible: spec.inDeductibleLabel,
          moop: spec.moopLabel,
          primaryCare: spec.pcpLabel,
          specialist: spec.specialistLabel,
          genericRx: spec.rxLabel,
          urgencies: spec.urgenciesLabel,
          highlights: spec.bullets,
          extraBenefit: 'Red Cigna PPO (tarifas ACH; cargos adicionales pueden aplicar con tarjeta o fee de solicitud).'
        };
      })
    );
  };

  // Actualizar Premier Max (1000 / 2000 / 3000, rango de edad y grupo familiar)
  const updatePremierMaxConfig = (
    id: string,
    updates: Partial<{ level: PremierMaxLevel; ageBracket: MedMaxAgeBracket; familyTier: EnrollFamilyTier }>
  ) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const nextLevel = updates.level || p.premierMaxLevel || 'max2000';
        const nextAge = updates.ageBracket || p.medmaxAgeBracket || detectMedMaxAgeBracket(clientAges);
        const nextFam = updates.familyTier || p.medmaxFamilyTier || detectEnrollFamilyTier(clientMembers, clientAges);
        const spec = PREMIER_MAX_SPECS[nextLevel];
        return {
          ...p,
          planCategory: 'premier_max',
          premierMaxLevel: nextLevel,
          medmaxAgeBracket: nextAge,
          medmaxFamilyTier: nextFam,
          company: 'Premier Max (PHCS / First Health PPO)',
          planName: spec.title,
          tier: `${spec.tierLabel} • Edad ${nextAge} años`,
          subtitleTag: `PHCS / FIRST HEALTH PPO • PREMIER MAX ${spec.shortLabel} • LÍMITES DE VISITAS`,
          premium: spec.rates[nextAge][nextFam].toFixed(2),
          deductible: spec.inDeductibleLabel,
          moop: spec.moopLabel,
          primaryCare: spec.pcpLabel,
          specialist: spec.specialistLabel,
          genericRx: spec.rxLabel,
          urgencies: spec.urgenciesLabel,
          highlights: spec.bullets,
          extraBenefit: 'Red PHCS o First Health PPO (tarifas ACH; plan con límites de visitas anuales).'
        };
      })
    );
  };

  const updatePlan = (id: string, field: keyof QuotePlan, value: any) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        let next: QuotePlan = { ...p, [field]: value };
        const ctx = { members: clientMembers, ages: clientAges };

        // Si cambia de categoría en el selector, aplicar ficha oficial exacta
        if (field === 'planCategory') {
          if (value === 'medmax') {
            next = enforceOfficialCatalogOnPlan({ ...next, planCategory: 'medmax', planName: 'Plan MedMax', premium: '' }, ctx);
          } else if (value === 'hpg4000') {
            next = enforceOfficialCatalogOnPlan(
              {
                ...next,
                planCategory: 'hpg4000',
                hpgLevel: next.hpgLevel || 'preferred4000',
                planName: HPG_SPECS[next.hpgLevel || 'preferred4000'].title
              },
              ctx
            );
          } else if (value === 'guard') {
            next = enforceOfficialCatalogOnPlan(
              {
                ...next,
                planCategory: 'guard',
                guardLevel: next.guardLevel || 'guard5000',
                planName: GUARD_SPECS[next.guardLevel || 'guard5000'].title
              },
              ctx
            );
          } else if (value === 'affordable_choice') {
            next = enforceOfficialCatalogOnPlan(
              {
                ...next,
                planCategory: 'affordable_choice',
                affordableChoiceLevel: next.affordableChoiceLevel || 'elite',
                planName: AFFORDABLE_CHOICE_SPECS[next.affordableChoiceLevel || 'elite'].title,
                premium: ''
              },
              ctx
            );
          } else if (value === 'presidio') {
            next = enforceOfficialCatalogOnPlan(
              {
                ...next,
                planCategory: 'presidio',
                presidioLevel: next.presidioLevel || 'secure5000',
                planName: PRESIDIO_SPECS[next.presidioLevel || 'secure5000'].title
              },
              ctx
            );
          } else if (value === 'bmi_phcs') {
            next = enforceOfficialCatalogOnPlan(
              {
                ...next,
                planCategory: 'bmi_phcs',
                bmiLevel: next.bmiLevel || 'choice',
                premium: '',
                hasEnrollmentFee: true,
                enrollmentFee: '75.00',
                enrollmentFeeLabel: 'tarifa única de inscripción (BMI-PHCS)'
              },
              ctx
            );
          } else if (value === 'afi') {
            next = enforceOfficialCatalogOnPlan(
              { ...next, planCategory: 'afi', afiLevel: next.afiLevel || 'copay3500', premium: '' },
              ctx
            );
          } else if (value === 'acusa') {
            next = enforceOfficialCatalogOnPlan(
              { ...next, planCategory: 'acusa', acusaLevel: next.acusaLevel || 'silver2', premium: '' },
              ctx
            );
          } else if (value === 'premier_mm') {
            next = enforceOfficialCatalogOnPlan(
              { ...next, planCategory: 'premier_mm', premierMmLevel: next.premierMmLevel || 'mm5000', premium: '' },
              ctx
            );
          } else if (value === 'premier_max') {
            next = enforceOfficialCatalogOnPlan(
              { ...next, planCategory: 'premier_max', premierMaxLevel: next.premierMaxLevel || 'max2000', premium: '' },
              ctx
            );
          } else if (value === 'sanitas') {
            next = enforceOfficialCatalogOnPlan({ ...next, planCategory: 'sanitas', hasSanitasFee: true, enrollmentFee: '40.00' }, ctx);
          } else if (value === 'hospitalwise') {
            next = enforceOfficialCatalogOnPlan(
              {
                ...next,
                planCategory: 'hospitalwise',
                hospitalwiseLevel: next.hospitalwiseLevel || 'bundle1',
                hasSanitasFee: false,
                planName: HOSPITALWISE_SPECS[next.hospitalwiseLevel || 'bundle1'].title
              },
              ctx
            );
          } else if (value === 'aca') {
            next = {
              ...next,
              planCategory: 'aca',
              hasSanitasFee: false,
              hasEnrollmentFee: false,
              subtitleTag: 'MERCADO DE SALUD ACA (OBAMACARE)'
            };
          }
        }

        // Si es Guard Plan y editan el nombre del plan escribiendo "4000", "5000" o "6000", sincronizar montos exactos
        if (field === 'planName' && isGuardPlan(next)) {
          const detectedGuard = detectGuardLevelFromText(String(value));
          if (detectedGuard !== next.guardLevel) {
            const spec = GUARD_SPECS[detectedGuard];
            next = {
              ...next,
              guardLevel: detectedGuard,
              tier: spec.tierLabel,
              subtitleTag: `UNITEDHEALTHCARE / GOLDEN RULE • ${spec.shortLabel.toUpperCase()} • SIN DEDUCIBLE`,
              deductible: '$0 (Sin deducible)',
              moop: spec.moopLabel,
              primaryCare: spec.pcpLabel,
              specialist: spec.specialistLabel,
              genericRx: spec.rxLabel,
              urgencies: spec.urgenciesLabel,
              highlights: spec.bullets,
              extraBenefit: spec.extraBenefitLabel
            };
          }
        }

        // Si es Affordable Choice y editan el nombre escribiendo Classic / Classic Plus / Elite / Elite Plus
        if (field === 'planName' && isAffordableChoicePlan(next)) {
          const detectedAc = detectAffordableChoiceLevelFromText(String(value));
          if (detectedAc !== next.affordableChoiceLevel) {
            const spec = AFFORDABLE_CHOICE_SPECS[detectedAc];
            const refAge: AffordableChoiceAge =
              (next.affordableChoiceAge && AFFORDABLE_CHOICE_AGES.includes(next.affordableChoiceAge as AffordableChoiceAge)
                ? (next.affordableChoiceAge as AffordableChoiceAge)
                : detectClosestAffordableChoiceAge(clientAges));
            next = {
              ...next,
              affordableChoiceLevel: detectedAc,
              affordableChoiceAge: refAge,
              tier: `${spec.tierLabel} • Edad ref. ${refAge}`,
              subtitleTag: `MANHATTANLIFE AFFORDABLE CHOICE • ${spec.shortLabel.toUpperCase()} • SIN PERÍODOS DE ESPERA`,
              deductible: '$0 (Sin deducible)',
              moop: spec.moopLabel,
              primaryCare: spec.pcpLabel,
              specialist: spec.specialistLabel,
              genericRx: spec.rxLabel,
              urgencies: spec.urgenciesLabel,
              highlights: spec.bullets,
              extraBenefit: spec.extraBenefitLabel
            };
          }
        }

        // Si es Presidio Fortress y editan el nombre escribiendo Elite 2.5K / Secure 5K / Value 7.5K / Essential 10K
        if (field === 'planName' && isPresidioPlan(next)) {
          const detectedPresidio = detectPresidioLevelFromText(String(value));
          if (detectedPresidio !== next.presidioLevel) {
            const spec = PRESIDIO_SPECS[detectedPresidio];
            next = {
              ...next,
              presidioLevel: detectedPresidio,
              tier: spec.tierLabel,
              subtitleTag: `PRESIDIO FORTRESS • ${spec.shortLabel.toUpperCase()} • SOLO DISPONIBLE EN TEXAS (TX)`,
              deductible: spec.deductibleLabel,
              moop: spec.moopLabel,
              primaryCare: spec.pcpLabel,
              specialist: spec.specialistLabel,
              genericRx: spec.rxLabel,
              urgencies: spec.urgenciesLabel,
              highlights: spec.bullets,
              extraBenefit: spec.extraBenefitLabel
            };
          }
        }

        // Si es HPG y editan el nombre del plan escribiendo "2000", "4000" o "5000", sincronizar automáticamente sus montos exactos
        if (field === 'planName' && isHpgPlan(next)) {
          const detected = detectHpgLevelFromText(String(value));
          if (detected !== next.hpgLevel) {
            const spec = HPG_SPECS[detected];
            next = {
              ...next,
              hpgLevel: detected,
              tier: spec.tierLabel,
              subtitleTag: `UNITEDHEALTHCARE / GOLDEN RULE • ${spec.shortLabel.toUpperCase()} • SIN DEDUCIBLE`,
              deductible: '$0 (Sin deducible)',
              moop: spec.moopLabel,
              primaryCare: spec.pcpLabel,
              specialist: spec.specialistLabel,
              genericRx: spec.rxLabel,
              urgencies: spec.urgenciesLabel,
              highlights: spec.bullets
            };
          }
        }

        if (field === 'hasSanitasFee' && value === true && !next.enrollmentFee) {
          next.enrollmentFee = '40.00';
        }
        if (field === 'hasEnrollmentFee' && value === true && !next.enrollmentFee) {
          next.enrollmentFee = '75.00';
        }
        // Si es HospitalWise y editan el nombre del plan escribiendo "Basic", "Bundle 1" o "Bundle 2", sincronizar sus montos
        if (field === 'planName' && isHospitalWisePlan(next)) {
          const detectedHw = detectHospitalWiseLevelFromText(String(value));
          if (detectedHw !== next.hospitalwiseLevel) {
            const spec = HOSPITALWISE_SPECS[detectedHw];
            next = {
              ...next,
              hospitalwiseLevel: detectedHw,
              tier: spec.tierLabel,
              subtitleTag: `GOLDEN RULE / UHC • ${spec.shortLabel.toUpperCase()} • EMISIÓN GARANTIZADA EN EFECTIVO`,
              deductible: '$0 (Sin deducible)',
              moop: spec.moopLabel,
              primaryCare: spec.pcpLabel,
              specialist: spec.specialistLabel,
              genericRx: spec.rxLabel,
              urgencies: spec.urgenciesLabel,
              highlights: spec.bullets,
              extraBenefit: spec.extraBenefitLabel
            };
          }
        }
        return next;
      })
    );
  };

  // AI OCR / Extraction con validación cerrada de catálogo oficial
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

      const promptText = `Eres el extractor oficial de 'Agente Contigo'. Analiza las capturas de pantalla o documentos PDF adjuntos con MÁXIMA PRECISIÓN y SIN INVENTAR DATOS.
Contexto del cliente:
- Ubicación / Estado / ZIP Code: ${clientLocation}
- Grupo Familiar: ${clientMembers}
- Edad(es) de los solicitantes: ${clientAges || 'No especificadas'}

Instrucciones estrictas:
1. Si identificas un plan del catálogo cerrado (Sanitas Care Plus, Health ProtectorGuard Select 2000/Preferred 4000/Premier 5000, Guard 4000/5000/6000, ManhattanLife Affordable Choice Classic/Classic Plus/Elite/Elite Plus, Presidio Fortress Elite 2.5K/Secure 5K/Value 7.5K/Essential 10K solo TX, MedMax, BMI-PHCS Classic/Choice/Basic/Value/Advantage, AFI 3500 HSA/Copay, ACUSA Bronze 2/Silver 2, Premier Major Medical 2500/5000/7500, Premier Max 1000/2000/3000 o HospitalWise Basic/Bundle 1/Bundle 2), indica exactamente su categoría en "planCategory", su nivel exacto en "hpgLevel" ("select2000", "preferred4000" o "premier5000") si es HPG, "guardLevel" ("guard4000", "guard5000" o "guard6000") si es Guard Plans, "affordableChoiceLevel" ("classic", "classic_plus", "elite" o "elite_plus") si es Affordable Choice, "presidioLevel" ("elite2500", "secure5000", "value7500" o "essential10000") si es Presidio Fortress, "premierMmLevel" ("mm2500", "mm5000" o "mm7500") si es Premier Major Medical, "premierMaxLevel" ("max1000", "max2000" o "max3000") si es Premier Max, o "hospitalwiseLevel" ("basic", "bundle1" o "bundle2") si es HospitalWise, junto con la prima mensual y el deducible mostrados.
2. Si es un plan ACA (Obamacare), extrae EXACTAMENTE de la captura/PDF: Aseguradora, Nombre exacto del plan, Nivel (Bronce/Plata/Oro), ID del plan ("planIdCode"), Prima con crédito fiscal ("premium"), Ahorro mensual o crédito fiscal ("subsidyAmount"), Deducible anual ("deductible"), Máximo de bolsillo ("moop"), Requisito de referido ("referralRequired"), y desglosa las 4 áreas médicas exactas ("primaryCare", "specialist", "acaLabsImaging", "acaErHospital", "acaRxTiers").

Responde ÚNICAMENTE un array JSON válido con esta estructura:
[
  {
    "company": "Aseguradora",
    "planName": "Nombre exacto del plan",
    "tier": "Nivel (Bronce / Plata / Oro / etc.)",
    "planCategory": "Una de: medmax | hpg4000 | guard | affordable_choice | presidio | bmi_phcs | afi | acusa | premier_mm | premier_max | sanitas | hospitalwise | aca | custom",
    "hpgLevel": "Solo si es HPG: select2000 | preferred4000 | premier5000",
    "guardLevel": "Solo si es Guard Plans: guard4000 | guard5000 | guard6000",
    "affordableChoiceLevel": "Solo si es Affordable Choice: classic | classic_plus | elite | elite_plus",
    "presidioLevel": "Solo si es Presidio Fortress: elite2500 | secure5000 | value7500 | essential10000",
    "premierMmLevel": "Solo si es Premier Major Medical: mm2500 | mm5000 | mm7500",
    "premierMaxLevel": "Solo si es Premier Max: max1000 | max2000 | max3000",
    "hospitalwiseLevel": "Solo si es HospitalWise: basic | bundle1 | bundle2",
    "planIdCode": "ID del plan ACA si aparece (ej: 21525FL0020035), si no ''",
    "premium": "Prima mensual en dólares (solo número con decimales, ej: '45.20')",
    "subsidyAmount": "Ahorro mensual o crédito fiscal aplicado en ACA (ej: '$485.00/mes'), si no ''",
    "deductible": "Deducible Anual exacto (ej: '$0' o '$1,500')",
    "moop": "Máximo de Bolsillo (Out-of-Pocket Max) exacto (ej: '$1,800')",
    "referralRequired": "Si requiere referido o no (ej: 'No requiere referido'), si no ''",
    "primaryCare": "Médico primario y telemedicina",
    "specialist": "Especialista",
    "acaLabsImaging": "Laboratorios e imágenes (rayos X, MRI, CT)",
    "acaErHospital": "Urgencias, sala de emergencias (ER) y hospitalización",
    "acaRxTiers": "Medicamentos por niveles (Genéricos, Preferidos, Marca, Especialidad)",
    "genericRx": "Medicamento genérico resumen (ej: '$3')",
    "urgencies": "Urgencias / ER resumen",
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
        const validCategories = ['medmax', 'hpg4000', 'guard', 'affordable_choice', 'presidio', 'bmi_phcs', 'afi', 'acusa', 'premier_mm', 'premier_max', 'sanitas', 'hospitalwise', 'aca', 'custom'];
        const mapped: QuotePlan[] = parsedPlans.map((p, idx) => {
          const combinedName = `${p.company || ''} ${p.planName || ''} ${p.tier || ''}`.toLowerCase();
          const isExplicitGuard =
            !combinedName.includes('protectorguard') &&
            (/\bguard\s*(4000|5000|6000|plans?)\b/.test(combinedName) || combinedName.includes('hpg3-cstm'));
          const detectedCategory: QuotePlanCategory =
            p.planCategory && validCategories.includes(p.planCategory)
              ? p.planCategory
              : combinedName.includes('medmax')
                ? 'medmax'
                : combinedName.includes('bmi') && combinedName.includes('phcs')
                  ? 'bmi_phcs'
                  : /\bafi\b/.test(combinedName) || combinedName.includes('3500 hsa') || combinedName.includes('3500 copay')
                    ? 'afi'
                    : combinedName.includes('acusa') || combinedName.includes('vault') || combinedName.includes('bronze 2') || combinedName.includes('silver 2')
                      ? 'acusa'
                      : combinedName.includes('premier max') || /\bmax\s*(1000|2000|3000)\b/.test(combinedName)
                        ? 'premier_max'
                        : combinedName.includes('premier major medical') || /\bpremier\s*mm\b/.test(combinedName)
                          ? 'premier_mm'
                      : combinedName.includes('affordable choice') || combinedName.includes('manhattanlife') || combinedName.includes('manhattan life')
                        ? 'affordable_choice'
                        : combinedName.includes('presidio') || combinedName.includes('fortress')
                          ? 'presidio'
                          : combinedName.includes('hospitalwise')
                            ? 'hospitalwise'
                            : isExplicitGuard
                              ? 'guard'
                              : combinedName.includes('protectorguard') || /\bhpg\b/.test(combinedName)
                                ? 'hpg4000'
                                : combinedName.includes('sanitas')
                                  ? 'sanitas'
                                  : p.planIdCode || p.subsidyAmount || p.acaRxTiers
                                    ? 'aca'
                                    : 'custom';

          const hpgLevelDetected: HpgPlanLevel | undefined =
            detectedCategory === 'hpg4000'
              ? p.hpgLevel && ['select2000', 'preferred4000', 'premier5000'].includes(p.hpgLevel)
                ? p.hpgLevel
                : detectHpgLevelFromText(combinedName)
              : undefined;

          const guardLevelDetected: GuardPlanLevel | undefined =
            detectedCategory === 'guard'
              ? p.guardLevel && ['guard4000', 'guard5000', 'guard6000'].includes(p.guardLevel)
                ? p.guardLevel
                : detectGuardLevelFromText(combinedName)
              : undefined;

          const affordableChoiceLevelDetected: AffordableChoiceLevel | undefined =
            detectedCategory === 'affordable_choice'
              ? p.affordableChoiceLevel && ['classic', 'classic_plus', 'elite', 'elite_plus'].includes(p.affordableChoiceLevel)
                ? p.affordableChoiceLevel
                : detectAffordableChoiceLevelFromText(combinedName)
              : undefined;

          const presidioLevelDetected: PresidioLevel | undefined =
            detectedCategory === 'presidio'
              ? p.presidioLevel && ['elite2500', 'secure5000', 'value7500', 'essential10000'].includes(p.presidioLevel)
                ? p.presidioLevel
                : detectPresidioLevelFromText(combinedName)
              : undefined;

          const premierMmLevelDetected: PremierMmLevel | undefined =
            detectedCategory === 'premier_mm'
              ? p.premierMmLevel && ['mm2500', 'mm5000', 'mm7500'].includes(p.premierMmLevel)
                ? p.premierMmLevel
                : detectPremierMmLevelFromText(combinedName)
              : undefined;

          const premierMaxLevelDetected: PremierMaxLevel | undefined =
            detectedCategory === 'premier_max'
              ? p.premierMaxLevel && ['max1000', 'max2000', 'max3000'].includes(p.premierMaxLevel)
                ? p.premierMaxLevel
                : detectPremierMaxLevelFromText(combinedName)
              : undefined;

          const hospitalwiseLevelDetected: HospitalWiseLevel | undefined =
            detectedCategory === 'hospitalwise'
              ? p.hospitalwiseLevel && ['basic', 'bundle1', 'bundle2'].includes(p.hospitalwiseLevel)
                ? p.hospitalwiseLevel
                : detectHospitalWiseLevelFromText(combinedName)
              : undefined;

          const bmiLevelDetected: BmiPhcsLevel | undefined =
            detectedCategory === 'bmi_phcs' ? detectBmiPhcsLevelFromText(combinedName) : undefined;

          const basePlan: QuotePlan = {
            id: 'plan_ai_' + Date.now() + '_' + idx,
            tag: idx === 0 ? 'OPCIÓN PRINCIPAL RECOMENDADA' : 'OPCIÓN DE COBERTURA',
            planCategory: detectedCategory,
            hpgLevel: hpgLevelDetected,
            guardLevel: guardLevelDetected,
            affordableChoiceLevel: affordableChoiceLevelDetected,
            presidioLevel: presidioLevelDetected,
            premierMmLevel: premierMmLevelDetected,
            premierMaxLevel: premierMaxLevelDetected,
            hospitalwiseLevel: hospitalwiseLevelDetected,
            bmiLevel: bmiLevelDetected,
            company: p.company || 'Aseguradora',
            planName: p.planName || 'Plan Médico',
            tier: p.tier || 'Estándar',
            planIdCode: p.planIdCode || '',
            referralRequired: p.referralRequired || '',
            subtitleTag:
              detectedCategory === 'aca'
                ? `MERCADO DE SALUD ACA (OBAMACARE) • ${p.tier || 'OFICIAL'}`
                : undefined,
            premium: String(p.premium || '0.00').replace(/[^0-9.]/g, '') || '0.00',
            subsidyAmount: p.subsidyAmount || '',
            deductible: p.deductible || '$0',
            moop: p.moop || 'Consultar detalle',
            primaryCare: p.primaryCare || '$0',
            specialist: p.specialist || '$0',
            acaLabsImaging: p.acaLabsImaging || '',
            acaErHospital: p.acaErHospital || '',
            acaRxTiers: p.acaRxTiers || '',
            genericRx: p.genericRx || '$0',
            urgencies: p.urgencies || '$0',
            extraBenefit: p.extraBenefit || 'Cobertura según ficha oficial del plan',
            clientSummary: '',
            isRecommended: idx === 0
          };

          return enforceOfficialCatalogOnPlan(basePlan, { members: clientMembers, ages: clientAges });
        });

        setPlans(mapped);
        onShowToast('¡Extracción Exitosa!', `Se procesaron ${mapped.length} planes con datos oficiales exactos.`, 'success');
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

  // Helper compartido para llamadas rápidas de texto con GoogleGenAI
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

  // AI Summary Generator (solo usado para planes personalizados si el agente lo solicita)
  const generatePlanSummaryWithAI = async (planId: string) => {
    const keyToUse = geminiApiKey.trim();
    if (!keyToUse) {
      setShowApiKeyModal(true);
      return;
    }

    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    onShowToast('Generando Explicación...', `Redactando resumen para ${plan.company}...`, 'info');

    try {
      const prompt = `Actúa como asesor de 'Agente Contigo'. Redacta una nota ejecutiva de 1 oración (máx. 30 palabras) para ${clientName} sobre '${plan.company} - ${plan.planName}' sin inventar beneficios fuera de estos datos: Prima $${formatMoney(parseMoney(plan.premium))}/mes, Deducible ${plan.deductible}, Máximo de Bolsillo ${plan.moop}.`;

      const text = await callGeminiTextHelper(keyToUse, prompt);

      if (text) {
        const clean = text.replace(/[\n\r]+/g, ' ').replace(/^["']|["']$/g, '').trim();
        updatePlan(planId, 'clientSummary', clean);
        onShowToast('¡Listo!', 'Resumen redactado con Gemini AI.', 'success');
      }
    } catch (e: any) {
      onShowToast('Error', 'No se pudo generar la explicación.', 'error');
    }
  };

  const searchPlanBenefitsOnline = async (planId: string) => {
    const keyToUse = geminiApiKey.trim();
    if (!keyToUse) {
      setShowApiKeyModal(true);
      return;
    }

    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    onShowToast('Buscando en Google...', `Verificando folleto de ${plan.company} para ${clientLocation}...`, 'info');

    try {
      const searchPrompt = `Busca información oficial verificada de la póliza '${plan.company} ${plan.planName}' en '${clientLocation}'. Resume en una oración concisa sus condiciones clave.`;
      const benefit = await callGeminiTextHelper(keyToUse, searchPrompt, [{ googleSearch: {} }]);

      if (benefit) {
        const clean = benefit.replace(/[\n\r]+/g, ' ').trim();
        updatePlan(planId, 'extraBenefit', clean);
        onShowToast('¡Folleto Encontrado!', 'Información verificada con Google Search.', 'success');
      }
    } catch (e) {
      onShowToast('Aviso', 'No se pudo completar la búsqueda en este momento.', 'error');
    }
  };

  // ============================================================
  // GENERADOR DE CORREO (CERO REPETICIONES Y FICHA EXACTA)
  // ============================================================
  const buildClientEmailDraft = (mode: EmailMode) => {
    const hasMedMax = plans.some(p => isMedMaxPlan(p));
    const hasSanitas = plans.some(p => getPlanSanitasFee(p) > 0);
    const hasHPGOrHW = plans.some(p => isHpgPlan(p) || isGuardPlan(p) || isHospitalWisePlan(p));
    const hasPresidio = plans.some(p => isPresidioPlan(p));
    const combinedList = plans.filter(p => Boolean(p.includeInCombinedTotal));
    const hasCombined = combinedList.length >= 2;
    const combinedReg = combinedList.reduce((acc, p) => acc + parseMoney(p.premium), 0);
    const combinedFee = combinedList.reduce((acc, p) => acc + getPlanEnrollmentFee(p).amount, 0);
    const combinedFirst = combinedReg + combinedFee;
    const displayClientName = clientName.trim() || 'Estimado(a)';
    const yearSuffix = quoteYear.trim() ? ` ${quoteYear.trim()}` : '';
    const detailParts = [
      clientMembers.trim(),
      clientAges.trim() ? `Edades: ${clientAges.trim()}` : '',
      clientLocation.trim()
    ].filter(Boolean);
    const detailSegment = detailParts.length > 0 ? ` (${detailParts.join(' • ')})` : '';

    const subject =
      mode === 'privado'
        ? `Cotización de Cobertura de Salud${yearSuffix} – Opciones Privadas y Suplementarias | Agente Contigo${clientName.trim() ? ` (${clientName.trim()})` : ''}`
        : `Cotización Oficial ACA (Obamacare)${yearSuffix} con Subsidio Aplicado | Agente Contigo${clientName.trim() ? ` (${clientName.trim()})` : ''}`;

    const lines: string[] = [];
    lines.push(`Hola ${displayClientName},`);
    lines.push('');

    if (mode === 'privado') {
      lines.push(
        `Espero que se encuentre muy bien. Con mucho gusto le comparto su cotización personalizada de salud${yearSuffix ? ` para ${quoteYear.trim()}` : ''}${detailSegment} de parte de Agente Contigo.`
      );
      lines.push('');
      lines.push(
        `Debido a que su estatus migratorio no ha tenido cambios recientemente, hemos preparado estas alternativas privadas y suplementarias disponibles para su código postal y edades, seleccionadas para brindarle respaldo médico inmediato.`
      );
      if (hasMedMax) {
        lines.push('');
        lines.push(
          `⚠️ ACLARACIÓN IMPORTANTE SOBRE MEDMAX: ${MEDMAX_DEFAULT_WARNING}`
        );
      }
    } else {
      lines.push(
        `Espero que se encuentre muy bien. Es un gusto compartirle su cotización oficial de cobertura médica a través del Mercado de Salud ACA (Obamacare)${yearSuffix ? ` para ${quoteYear.trim()}` : ''}${detailSegment} de parte de Agente Contigo.`
      );
      lines.push('');
      lines.push(
        `Estas alternativas aplican el crédito fiscal federal (subsidio ACA) correspondiente a su hogar para reducir su prima mensual, con copagos directos desde el Día 1 y cobertura esencial mínima sin límites anuales.`
      );
    }

    // Notas de validación geográfica por ZIP y edades (solo si aplican)
    const geoNotes: string[] = [];
    if (hasSanitas) {
      if (geoAge.sanitasAvailability === 'plus_fl') {
        geoNotes.push(
          `✓ Validación geográfica Sanitas Care Plus (${clientLocation}): Cobertura activa en Florida con acceso a más de 50 centros médicos Sanitas${geoAge.isSouthFlorida ? ' (incluye dental y 2 urgencias/año a $0 en centros del sur de Florida)' : ''}.`
        );
      } else if (geoAge.sanitasAvailability === 'unavailable_non_fl') {
        geoNotes.push(
          `⚠️ Nota geográfica Sanitas Care (${clientLocation}): Esta membresía aplica EXCLUSIVAMENTE en Florida (FL) por ahora.`
        );
      } else {
        geoNotes.push(
          `• Nota geográfica Sanitas Care${clientLocation ? ` (${clientLocation})` : ''}: Aplica únicamente en Florida (FL); validaremos el centro médico Sanitas activo en su código postal antes de procesar la membresía.`
        );
      }
    }
    if (hasHPGOrHW && geoAge.hpgRestrictedState) {
      geoNotes.push(
        `• Nota estatal (${geoAge.detectedState}): Validaremos disponibilidad y reglas estatales específicas de suscripción para su estado antes de emitir.`
      );
    }
    if (hasPresidio) {
      if (geoAge.detectedState && !geoAge.presidioAvailable) {
        geoNotes.push(
          `⚠️ Nota geográfica Presidio Fortress: Este plan está habilitado EXCLUSIVAMENTE en Texas (TX). La ubicación actual (${clientLocation}) está fuera de Texas y no es elegible para emisión.`
        );
      } else {
        geoNotes.push(
          `✓ Disponibilidad Presidio Fortress (Solo Texas • TDI): Póliza formal regulada por el Departamento de Seguros de Texas (TDI), válida exclusivamente para residentes de Texas.`
        );
      }
    }
    if (geoAge.hasSenior65Plus) {
      geoNotes.push(
        `• Nota por edad (65+ años): Validaremos elegibilidad frente a opciones de Medicare o membresías aplicables para integrantes mayores de 65 años.`
      );
    }
    if (geoNotes.length > 0) {
      lines.push('');
      geoNotes.forEach(n => lines.push(n));
    }

    lines.push('');
    lines.push(`==================================================`);
    lines.push(`DESGLOSE DE ALTERNATIVAS (${plans.length} ${plans.length === 1 ? 'OPCIÓN' : 'OPCIONES'})`);
    lines.push(`==================================================`);
    lines.push('');

    plans.forEach((p, idx) => {
      const reg = parseMoney(p.premium);
      const feeInfo = getPlanEnrollmentFee(p);
      const firstM = getPlanFirstMonth(p);
      const bullets = getExactOfficialBulletsForPlan(p);
      const isPartOfBundle = hasCombined && Boolean(p.includeInCombinedTotal);

      lines.push(`OPCIÓN ${idx + 1}: ${p.planName} (${p.company})${isPartOfBundle ? ' [PARTE DEL PAQUETE COMBINADO]' : ''}`);
      lines.push(`• Mensualidad Regular: $${formatMoney(reg)}/mes${p.planCategory === 'aca' && p.subsidyAmount ? ` (Crédito fiscal / ahorro mensual: ${p.subsidyAmount})` : ''}`);
      if (feeInfo.amount > 0) {
        lines.push(`• Inversión 1.er Mes: $${formatMoney(firstM)} (incluye +$${formatMoney(feeInfo.amount)} ${feeInfo.label})`);
      }
      if (p.planCategory === 'aca') {
        if (p.tier) lines.push(`• Nivel del Plan: ${p.tier}${p.planIdCode ? ` | ID del Plan: ${p.planIdCode}` : ''}`);
        if (p.referralRequired) lines.push(`• Requisito de Referido: ${p.referralRequired}`);
      }
      lines.push(`• Deducible Anual: ${p.deductible || '$0'}`);
      lines.push(`• Máximo de Bolsillo (Out-of-Pocket Max): ${p.moop || 'Consultar detalle'}`);
      bullets.forEach(b => {
        lines.push(`• ${b}`);
      });
      lines.push('');
    });

    if (hasCombined) {
      lines.push(`--------------------------------------------------`);
      lines.push(`TOTAL PAQUETE COMBINADO (${combinedList.map(p => p.planName).join(' + ')}):`);
      if (combinedFee > 0) {
        lines.push(`• Total 1.er Mes Combinado (incluye +$${formatMoney(combinedFee)} fee único de inscripción/solicitud): $${formatMoney(combinedFirst)}`);
      }
      lines.push(`• Total Mensual Regular Combinado: $${formatMoney(combinedReg)}/mes`);
      lines.push(`--------------------------------------------------`);
      lines.push('');
    }

    lines.push(`Adjunto encontrará el documento PDF oficial de Agente Contigo con el detalle ejecutivo y el cuadro comparativo de inversión.`);
    lines.push('');
    lines.push(`Con nuestra asesoría gratuita verificamos sus médicos, centros y medicamentos antes de activar cualquier cobertura. ¿Cuál opción le gustaría revisar o activar hoy?`);
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

  // Mensaje SMS Resumido
  const copyShortTextMessage = () => {
    const combinedList = plans.filter(p => Boolean(p.includeInCombinedTotal));
    const hasCombined = combinedList.length >= 2;
    const yearSuffix = quoteYear.trim() ? ` ${quoteYear.trim()}` : '';
    const locSuffix = clientLocation.trim() ? ` para ${clientLocation.trim()}` : '';
    let msg = `Hola ${clientName.trim() || 'estimado(a)'}, te saluda ${agentName.trim() || 'tu asesor'} de Agente Contigo.\n`;
    msg += `Cotización${yearSuffix}${locSuffix}${clientAges.trim() ? ` (Edades: ${clientAges.trim()})` : ''}:\n\n`;

    plans.forEach((plan, i) => {
      const feeInfo = getPlanEnrollmentFee(plan);
      const firstM = getPlanFirstMonth(plan);
      const isPartOfBundle = hasCombined && Boolean(plan.includeInCombinedTotal);
      msg += `Opción ${i + 1}: ${plan.planName}${isPartOfBundle ? ' (Combinado)' : ''}\n`;
      msg += `• Mensualidad: $${formatMoney(parseMoney(plan.premium))}/mes`;
      if (feeInfo.amount > 0) msg += ` (1.er mes: $${formatMoney(firstM)} incl. +$${formatMoney(feeInfo.amount)} inscripción)`;
      msg += `\n`;
      msg += `• Deducible: ${plan.deductible} | Máx. Bolsillo: ${plan.moop || 'N/A'}\n`;
      if (isMedMaxPlan(plan)) {
        msg += `• Importante: Copagos aplican tras cumplir el deducible anual (preventivo y telemedicina $0).\n`;
      }
      msg += `\n`;
    });

    if (hasCombined) {
      const combReg = combinedList.reduce((acc, p) => acc + parseMoney(p.premium), 0);
      const combFirst = combinedList.reduce((acc, p) => acc + getPlanFirstMonth(p), 0);
      msg += `Total Paquete Combinado (${combinedList.map(p => p.planName).join(' + ')}):\n`;
      if (combFirst > combReg) msg += `• 1.er mes: $${formatMoney(combFirst)}\n`;
      msg += `• Mensualidad regular: $${formatMoney(combReg)}/mes\n\n`;
    }

    msg += `Te envié el PDF oficial con todo el detalle y cuadro comparativo. ¿Cuál opción revisamos hoy?`;
    navigator.clipboard.writeText(msg);
    onShowToast('¡SMS Copiado!', 'Mensaje resumido listo para enviar.', 'success');
  };

  // WhatsApp Message Generator (sin repeticiones, datos exactos)
  const copyWhatsAppMessage = () => {
    const combinedList = plans.filter(p => Boolean(p.includeInCombinedTotal));
    const hasCombined = combinedList.length >= 2;
    const yearSuffix = quoteYear.trim() ? ` ${quoteYear.trim()}` : '';
    const contextParts = [
      clientMembers.trim(),
      clientAges.trim() ? `Edades: ${clientAges.trim()}` : '',
      clientLocation.trim() ? `en ${clientLocation.trim()}` : ''
    ].filter(Boolean);
    let msg = `🏥 *COTIZACIÓN OFICIAL DE SALUD${yearSuffix} — AGENTE CONTIGO*\n`;
    msg += `👋 ¡Hola ${clientName.trim() || 'estimado(a)'}! Te comparto tus opciones${contextParts.length > 0 ? ` (${contextParts.join(' • ')})` : ''}:\n\n`;

    plans.forEach((plan, i) => {
      const feeInfo = getPlanEnrollmentFee(plan);
      const firstM = getPlanFirstMonth(plan);
      const bullets = getExactOfficialBulletsForPlan(plan);
      const isPartOfBundle = hasCombined && Boolean(plan.includeInCombinedTotal);
      msg += `📌 *OPCIÓN ${i + 1}: ${plan.planName}*${isPartOfBundle ? ' _(Paquete Combinado)_' : ''}\n`;
      msg += `• 💰 *Mensualidad Regular:* $${formatMoney(parseMoney(plan.premium))}/mes\n`;
      if (feeInfo.amount > 0) {
        msg += `• 🧾 *1.er Mes (incluye +$${formatMoney(feeInfo.amount)} ${feeInfo.label}):* $${formatMoney(firstM)}\n`;
      }
      if (plan.planCategory === 'aca' && plan.subsidyAmount) {
        msg += `• 🏛️ *Crédito Fiscal ACA:* ${plan.subsidyAmount}\n`;
      }
      msg += `• 🛡️ *Deducible:* ${plan.deductible} | *Máximo de Bolsillo:* ${plan.moop}\n`;
      if (isMedMaxPlan(plan)) {
        msg += `• ⚠️ *Nota MedMax:* ${MEDMAX_DEFAULT_WARNING}\n`;
      }
      bullets.forEach(b => {
        msg += `• ${b}\n`;
      });
      msg += `\n`;
    });

    if (hasCombined) {
      const combReg = combinedList.reduce((acc, p) => acc + parseMoney(p.premium), 0);
      const combFirst = combinedList.reduce((acc, p) => acc + getPlanFirstMonth(p), 0);
      msg += `📦 *TOTAL PAQUETE COMBINADO (${combinedList.map(p => p.planName).join(' + ')}):*\n`;
      if (combFirst > combReg) msg += `🧾 *Total 1.er Mes Combinado:* $${formatMoney(combFirst)}\n`;
      msg += `💵 *Total Mensual Combinado:* $${formatMoney(combReg)}/mes\n\n`;
    }

    msg += `📲 ¿Cuál de estas opciones te gustaría revisar o activar hoy?`;
    navigator.clipboard.writeText(msg);
    onShowToast('¡WhatsApp Copiado!', 'Propuesta exacta lista para pegar en WhatsApp.', 'success');
  };

  // Save Quote to Supabase and Local (INTACTO: mismas columnas y variables Supabase)
  const handleSaveQuote = async () => {
    const combinedList = plans.filter(p => Boolean(p.includeInCombinedTotal));
    const total =
      combinedList.length >= 2
        ? combinedList.reduce((acc, p) => acc + parseMoney(p.premium), 0)
        : parseMoney((plans.find(p => p.isRecommended) || plans[0])?.premium || 0);
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

  const combinedPlans = plans.filter(p => Boolean(p.includeInCombinedTotal));
  const hasCombinedPackage = combinedPlans.length >= 2;
  const combinedMonthlyTotal = combinedPlans.reduce((acc, p) => acc + parseMoney(p.premium), 0);
  const combinedEnrollmentFee = combinedPlans.reduce((acc, p) => acc + getPlanEnrollmentFee(p).amount, 0);
  const combinedFirstMonthTotal = combinedMonthlyTotal + combinedEnrollmentFee;
  const hasSanitasInPlans = plans.some(p => isSanitasPlan(p) && !isHospitalWisePlan(p));
  const hasHospitalWiseInPlans = plans.some(p => isHospitalWisePlan(p));
  const areSanitasAndHospitalWiseCombined =
    hasSanitasInPlans &&
    hasHospitalWiseInPlans &&
    plans.some(p => isSanitasPlan(p) && !isHospitalWisePlan(p) && Boolean(p.includeInCombinedTotal)) &&
    plans.some(p => isHospitalWisePlan(p) && Boolean(p.includeInCombinedTotal));

  // ============================================================
  // DOCUMENTO OFICIAL PDF (LIMPIO, EJECUTIVO, CERO REPETICIONES)
  // ============================================================
  const renderBulletLine = (text: string, idx: number) => {
    const colonIndex = text.indexOf(':');
    if (colonIndex > 0 && colonIndex < 65) {
      const heading = text.slice(0, colonIndex + 1);
      const body = text.slice(colonIndex + 1);
      return (
        <li key={idx}>
          <strong className="text-slate-900 font-bold">{heading}</strong>
          <span>{body}</span>
        </li>
      );
    }
    return <li key={idx}>{text}</li>;
  };

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
              Propuesta de Protección Médica Familiar{quoteYear.trim() ? ` • Período ${quoteYear.trim()}` : ''}
            </p>
          </div>
        </div>

        {/* Barra Resumen Titular / Grupo Familiar / Edades / ZIP / Asesoría */}
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-slate-500">Titular: </span>
            <strong className="text-slate-900 font-black">
              {clientName.trim() || 'Por definir'}
            </strong>
          </div>
          <div>
            <span className="font-bold text-slate-500">Grupo Familiar: </span>
            <strong className="text-slate-900 font-bold">
              {clientMembers.trim() || 'Por definir'}
              {clientLocation.trim() ? ` (${clientLocation.trim()})` : ''}
            </strong>
          </div>
          {clientAges.trim() && (
            <div>
              <span className="font-bold text-slate-500">Edades: </span>
              <strong className="text-slate-900 font-bold">{clientAges.trim()}</strong>
            </div>
          )}
          <div>
            <span className="font-bold text-slate-500">Asesoría: </span>
            <strong className="text-[#008be3] font-black">
              Agente Contigo{agentName.trim() && agentName.trim() !== 'Equipo Agente Contigo' ? ` (${agentName.trim()})` : ''}
            </strong>
          </div>
        </div>
      </div>

      {/* Opciones Ejecutivas (SIN REPETICIONES) */}
      <div className="p-6 sm:p-8 print:p-4 space-y-5 print:space-y-3.5">
        {plans.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 text-center space-y-2">
            <p className="text-sm font-extrabold text-slate-700">
              Cotización en blanco lista para completar
            </p>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              Completa los datos del prospecto y selecciona arriba los planes oficiales (o sube capturas con IA) para generar aquí el desglose oficial y el cuadro comparativo de Agente Contigo.
            </p>
          </div>
        ) : (
          <>
            {plans.map((plan, idx) => {
              const regularMonthly = parseMoney(plan.premium);
              const feeInfo = getPlanEnrollmentFee(plan);
              const firstMonth = regularMonthly + feeInfo.amount;
              const isMedMax = isMedMaxPlan(plan);
              const bullets = getExactOfficialBulletsForPlan(plan);

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-5 print:p-4 space-y-3 print:space-y-2 print-avoid-break ${
                    plan.isRecommended
                      ? 'border-[#00a396] ring-1 ring-[#00c9b7]/40 bg-white shadow-sm print:shadow-none'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Encabezado Ejecutivo */}
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
                        {hasCombinedPackage && plan.includeInCombinedTotal && (
                          <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-[#005b9f] text-[10px] font-black uppercase tracking-wider">
                            Paquete Combinado
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
                      {feeInfo.amount > 0 ? (
                        <span className="text-[11px] font-extrabold text-teal-700 block mt-1">
                          1.er mes: ${formatMoney(firstMonth)} (incluye +${formatMoney(feeInfo.amount)} {feeInfo.label})
                        </span>
                      ) : plan.planCategory === 'aca' && plan.subsidyAmount ? (
                        <span className="text-[11px] font-bold text-emerald-700 block mt-1">
                          Prima con crédito fiscal (Ahorro: {plan.subsidyAmount})
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500 block mt-1">
                          Prima mensual{clientMembers.trim() ? ` (${clientMembers.trim()})` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barra Única de Métricas Clave: Prima, Deducible y Máximo de Bolsillo (+ ID y Referido en ACA) */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-x-5 gap-y-1.5 text-xs">
                    <div>
                      <span className="font-bold text-slate-500">Deducible Anual: </span>
                      <strong className="text-slate-900 font-black">{plan.deductible || '$0'}</strong>
                    </div>
                    <div>
                      <span className="font-bold text-[#005b9f]">Máximo de Bolsillo (Out-of-Pocket Max): </span>
                      <strong className="text-slate-900 font-black">{plan.moop || 'Consultar detalle'}</strong>
                    </div>
                    {plan.planCategory === 'aca' && (
                      <>
                        <div>
                          <span className="font-bold text-slate-500">Nivel: </span>
                          <strong className="text-slate-900 font-bold">{plan.tier}</strong>
                        </div>
                        {plan.planIdCode && (
                          <div>
                            <span className="font-bold text-slate-500">ID del Plan: </span>
                            <strong className="text-slate-900 font-mono">{plan.planIdCode}</strong>
                          </div>
                        )}
                        {plan.referralRequired && (
                          <div>
                            <span className="font-bold text-slate-500">Referido: </span>
                            <strong className="text-slate-900 font-bold">{plan.referralRequired}</strong>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Alerta Obligatoria MedMax */}
                  {isMedMax && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl px-3.5 py-2.5 text-[11.5px] text-amber-950 font-semibold leading-snug">
                      <strong className="uppercase tracking-wide font-black text-amber-900">
                        ⚠️ Atención – Regla del Deducible MedMax:{' '}
                      </strong>
                      <span>{plan.deductibleWarning || MEDMAX_DEFAULT_WARNING}</span>
                    </div>
                  )}

                  {/* Viñetas Claras y Únicas por Categoría Médica */}
                  {bullets.length > 0 && (
                    <ul className="space-y-1.5 text-[11.5px] text-slate-700 leading-relaxed pl-4 list-disc">
                      {bullets.map((item, bIdx) => renderBulletLine(item, bIdx))}
                    </ul>
                  )}
                </div>
              );
            })}

            {/* CUADRO COMPARATIVO RESUMEN OBLIGATORIO AL FINAL DE TODO PDF */}
            <div className="pt-2 print:pt-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2.5 print-keep-with-next">
                CUADRO COMPARATIVO DE INVERSIÓN{clientMembers.trim() ? ` (${clientMembers.trim().toUpperCase()})` : ''}
              </h3>
              <div className="overflow-hidden print-overflow-visible print:overflow-visible rounded-xl border border-slate-300">
                <table className="w-full text-left border-collapse text-xs print:text-[11px] print-comparison-table">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 print-avoid-break">
                      <th className="py-2.5 px-3 font-black">Alternativa de Cobertura</th>
                      <th className="py-2.5 px-3 font-black">Deducible y Máximo de Bolsillo</th>
                      <th className="py-2.5 px-3 font-black text-right">1.er Mes</th>
                      <th className="py-2.5 px-3 font-black text-right">Mensualidad Regular</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {plans.map((plan, idx) => {
                      const reg = parseMoney(plan.premium);
                      const feeInfo = getPlanEnrollmentFee(plan);
                      const firstM = reg + feeInfo.amount;
                      const isInCombined = hasCombinedPackage && Boolean(plan.includeInCombinedTotal);
                      return (
                        <tr
                          key={plan.id}
                          className={`print-avoid-break ${plan.isRecommended ? 'bg-teal-50/40' : isInCombined ? 'bg-cyan-50/30' : 'bg-white'}`}
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            Opción {idx + 1}: {plan.planName}
                            <span className="block text-[10px] font-semibold text-slate-500">{plan.company}</span>
                            {isInCombined && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-cyan-100 text-[#005b9f] text-[9px] font-black uppercase">
                                Incluido en Paquete Combinado
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="font-semibold text-slate-800">{plan.tier}</span>
                            <span className="block text-[11px]">
                              Ded: {plan.deductible || '$0'} • Máx. Bolsillo: <strong>{plan.moop || 'Consultar'}</strong>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-[#005b9f] tabular-nums">
                            ${formatMoney(firstM)}
                            {feeInfo.amount > 0 && (
                              <span className="block text-[10px] font-bold text-teal-700">
                                (incl. +${formatMoney(feeInfo.amount)} inscripción)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 tabular-nums">
                            ${formatMoney(reg)}
                          </td>
                        </tr>
                      );
                    })}
                    {hasCombinedPackage && (
                      <tr className="bg-cyan-50/70 border-t-2 border-[#008be3]/50 print-avoid-break">
                        <td className="py-2.5 px-3 font-black text-[#005b9f]" colSpan={2}>
                          Total Paquete Combinado ({combinedPlans.length} planes)
                          <span className="block text-[10px] font-bold text-slate-600 mt-0.5">
                            {combinedPlans.map(p => p.planName).join(' + ')}
                            {combinedEnrollmentFee > 0 && ` • Incluye +$${formatMoney(combinedEnrollmentFee)} fee único 1.er mes`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[#005b9f] tabular-nums">
                          ${formatMoney(combinedFirstMonthTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 tabular-nums">
                          ${formatMoney(combinedMonthlyTotal)}/mes
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
              Cotización elaborada para {clientName.trim() || 'el cliente'}
              {(() => {
                const info = [
                  clientMembers.trim(),
                  clientAges.trim() ? `Edades: ${clientAges.trim()}` : '',
                  clientLocation.trim()
                ].filter(Boolean);
                return info.length > 0 ? ` (${info.join(' • ')})` : '';
              })()}
              . Las coberturas y montos corresponden a la ficha oficial de cada plan y están sujetos a elegibilidad geográfica y condiciones de suscripción vigentes.
            </div>
          </>
        )}
      </div>

      {/* Footer Oficial */}
      <div className="py-3 px-6 sm:px-8 print:px-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2 print-avoid-break">
        <span className="font-bold text-[#008be3]">
          Agente Contigo • Cotización Personalizada de Salud
        </span>
        <span className="font-semibold text-slate-400">
          Asesoría 100% Gratuita{quoteYear.trim() ? ` • Período ${quoteYear.trim()}` : ''}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 quoter-root print:space-y-0">
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
                Base cerrada de beneficios oficiales por plan y nivel, sin mezclas ni repeticiones, lista para PDF y correo.
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
              >
                <Send className="w-3.5 h-3.5" />
                <span>SMS</span>
              </button>

              <button
                type="button"
                onClick={copyWhatsAppMessage}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl font-bold transition flex items-center gap-1.5 border border-cyan-800 shadow cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Vista Previa</span>
              </button>

              <button
                type="button"
                onClick={handlePrintProposal}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl font-extrabold transition flex items-center gap-1.5 shadow-lg cursor-pointer"
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
            {/* Panel 1: Datos del Prospecto + Edad(es) y ZIP Code */}
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
                  <p className="text-[11px] text-slate-500">Validación geográfica por ZIP Code, edades y grupo familiar</p>
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs placeholder:text-slate-400"
                  />
                </div>

                {/* EDAD(ES) Y ZIP CODE */}
                <div className="p-3 rounded-2xl bg-cyan-50/40 border border-cyan-100 space-y-2">
                  <span className="block text-[10px] font-black uppercase text-[#005b9f]">
                    Edad(es) y ZIP Code (Validación Geográfica)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Estado / ZIP Code
                      </label>
                      <input
                        type="text"
                        value={clientLocation}
                        onChange={e => setClientLocation(e.target.value)}
                        placeholder="Ej. Florida (33166)"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Edad(es) Solicitantes
                      </label>
                      <input
                        type="text"
                        value={clientAges}
                        onChange={e => setClientAges(e.target.value)}
                        placeholder="Ej. 38, 35 y 7 años"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* GRUPO FAMILIAR */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold uppercase text-slate-600">
                      Grupo Familiar (calcula Sanitas Care)
                    </label>
                    <span className="text-[10px] font-bold text-[#008be3] flex items-center gap-1">
                      <Users className="w-3 h-3" /> Auto-tarifa
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={
                        FAMILY_GROUP_PRESETS.includes(clientMembers)
                          ? clientMembers
                          : clientMembers.trim()
                            ? 'custom'
                            : ''
                      }
                      onChange={e => {
                        if (e.target.value !== 'custom') {
                          setClientMembers(e.target.value);
                        }
                      }}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-bold text-slate-800 text-xs"
                    >
                      <option value="">Seleccionar grupo familiar...</option>
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs placeholder:text-slate-400"
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
                      placeholder={selectedYear ? `Ej. ${selectedYear}` : 'Ej. 2026'}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">Agente Asignado</label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      placeholder="Ej. Equipo Agente Contigo"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Aviso Geográfico Exclusivo de Sanitas Care (Solo Florida) */}
              <div
                className={`p-3 rounded-2xl border text-[11px] space-y-1 ${
                  geoAge.sanitasAvailability === 'unavailable_non_fl'
                    ? 'bg-rose-50/70 border-rose-200'
                    : geoAge.sanitasAvailability === 'plus_fl'
                      ? 'bg-teal-50/70 border-teal-200'
                      : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between font-black text-slate-800 uppercase text-[10px]">
                  <span className="flex items-center gap-1 text-teal-700">
                    <MapPin className="w-3.5 h-3.5" /> Disponibilidad Sanitas Care (Solo Florida)
                  </span>
                  {geoAge.detectedState && (
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        geoAge.detectedState === 'FL'
                          ? 'bg-teal-100 text-teal-900'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {geoAge.detectedState} {geoAge.zipCode ? `• ${geoAge.zipCode}` : ''}
                    </span>
                  )}
                </div>
                <p
                  className={`leading-snug font-medium ${
                    geoAge.sanitasAvailability === 'unavailable_non_fl'
                      ? 'text-rose-700 font-bold'
                      : geoAge.sanitasAvailability === 'plus_fl'
                        ? 'text-teal-800'
                        : 'text-slate-600'
                  }`}
                >
                  • {geoAge.sanitasNote}
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
                        Opcional: sube capturas / PDF de ACA, HPG, MedMax, etc., o usa los selectores manuales abajo
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addManualPlan}
                    className="text-xs font-bold text-[#008be3] hover:text-[#00c9b7] flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Plan Personalizado</span>
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
                      Validación estricta con Catálogo Oficial Cerrado
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Para planes ACA extrae todo el desglose; para privados aplica la ficha oficial exacta sin mezclas.
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

          {/* Barra de Selectores Rápidos Oficiales */}
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
                    Ficha cerrada exacta por plan y nivel HPG (Select 2000 / Preferred 4000 / Premier 5000). Cero mezclas.
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {/* 1. + MedMax (ERISA • Edad + Deducible Ind/Fam) */}
              <button
                type="button"
                onClick={addMedMaxPlan}
                className="p-3 rounded-2xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 text-left transition shadow-xs cursor-pointer flex flex-col justify-between gap-1.5 h-full"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-xs">+ MedMax</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </div>
                <span className="text-[10px] font-bold opacity-85">Ded. Ind/Fam + Edad Auto</span>
              </button>

              {/* 2. + HPG (2000/4000/5000) con selector exacto de nivel */}
              <div className="p-2.5 rounded-2xl border border-sky-300 bg-sky-50/70 text-sky-950 flex flex-col justify-between gap-1.5 shadow-xs h-full">
                <button
                  type="button"
                  onClick={() => addHpgPlan('preferred4000')}
                  className="w-full text-left flex items-center justify-between gap-1 cursor-pointer hover:opacity-80"
                >
                  <span className="font-black text-xs">+ HPG (2000/4000/5000)</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => addHpgPlan('select2000')}
                    className="py-1 px-1 rounded-lg bg-white hover:bg-sky-600 hover:text-white border border-sky-200 text-[10px] font-black transition cursor-pointer text-center"
                    title="Agregar HPG Select 2000 con sus montos exactos"
                  >
                    2000
                  </button>
                  <button
                    type="button"
                    onClick={() => addHpgPlan('preferred4000')}
                    className="py-1 px-1 rounded-lg bg-white hover:bg-sky-600 hover:text-white border border-sky-200 text-[10px] font-black transition cursor-pointer text-center"
                    title="Agregar HPG Preferred 4000 con sus montos exactos"
                  >
                    4000
                  </button>
                  <button
                    type="button"
                    onClick={() => addHpgPlan('premier5000')}
                    className="py-1 px-1 rounded-lg bg-white hover:bg-sky-600 hover:text-white border border-sky-200 text-[10px] font-black transition cursor-pointer text-center"
                    title="Agregar HPG Premier 5000 con sus montos exactos"
                  >
                    5000
                  </button>
                </div>
              </div>

              {/* 2B. + Guard Plans (4000/5000/6000 • Golden Rule / UHC) */}
              <div className="p-2.5 rounded-2xl border border-blue-300 bg-blue-50/70 text-blue-950 flex flex-col justify-between gap-1.5 shadow-xs h-full">
                <button
                  type="button"
                  onClick={() => addGuardPlan('guard5000')}
                  className="w-full text-left flex items-center justify-between gap-1 cursor-pointer hover:opacity-80"
                >
                  <span className="font-black text-xs">+ Guard (4000/5000/6000)</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>
                <div className="grid grid-cols-3 gap-1">
                  {(['guard4000', 'guard5000', 'guard6000'] as GuardPlanLevel[]).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => addGuardPlan(lvl)}
                      className="py-1 px-1 rounded-lg bg-white hover:bg-blue-700 hover:text-white border border-blue-200 text-[10px] font-black transition cursor-pointer text-center"
                      title={`Agregar ${GUARD_SPECS[lvl].title} (Golden Rule / UHC) con beneficios exactos`}
                    >
                      {lvl.replace('guard', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2C. + Affordable Choice (ManhattanLife • Classic / Classic+ / Elite / Elite+) */}
              <div className="p-2.5 rounded-2xl border border-rose-300 bg-rose-50/60 text-rose-950 flex flex-col justify-between gap-1.5 shadow-xs h-full">
                <button
                  type="button"
                  onClick={() => addAffordableChoicePlan('elite')}
                  className="w-full text-left flex items-center justify-between gap-1 cursor-pointer hover:opacity-80"
                >
                  <span className="font-black text-xs">+ Affordable Choice</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>
                <div className="grid grid-cols-4 gap-1">
                  {(['classic', 'classic_plus', 'elite', 'elite_plus'] as AffordableChoiceLevel[]).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => addAffordableChoicePlan(lvl)}
                      className="py-1 px-0.5 rounded-lg bg-white hover:bg-rose-700 hover:text-white border border-rose-200 text-[9.5px] font-black transition cursor-pointer text-center truncate"
                      title={`Agregar ${AFFORDABLE_CHOICE_SPECS[lvl].title} (ManhattanLife) con tarifa oficial`}
                    >
                      {lvl === 'classic_plus' ? 'C. Plus' : lvl === 'elite_plus' ? 'E. Plus' : AFFORDABLE_CHOICE_SPECS[lvl].shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2D. + Presidio Fortress (SOLO EN TEXAS • TX) */}
              <div
                className={`p-2.5 rounded-2xl border flex flex-col justify-between gap-1.5 shadow-xs h-full ${
                  geoAge.detectedState && !geoAge.presidioAvailable
                    ? 'border-rose-300 bg-rose-50/70 text-rose-950'
                    : 'border-amber-400 bg-amber-50/80 text-amber-950'
                }`}
              >
                <button
                  type="button"
                  onClick={() => addPresidioPlan('secure5000')}
                  className="w-full text-left flex items-center justify-between gap-1 cursor-pointer hover:opacity-80"
                >
                  <span className="font-black text-xs flex items-center gap-1.5">
                    <span>+ Presidio Fortress</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                        geoAge.detectedState && !geoAge.presidioAvailable
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-900 text-white'
                      }`}
                    >
                      SOLO TX
                    </span>
                  </span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>
                <div className="grid grid-cols-4 gap-1">
                  {(['elite2500', 'secure5000', 'value7500', 'essential10000'] as PresidioLevel[]).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => addPresidioPlan(lvl)}
                      className="py-1 px-0.5 rounded-lg bg-white hover:bg-amber-700 hover:text-white border border-amber-300 text-[9.5px] font-black transition cursor-pointer text-center"
                      title={`Agregar ${PRESIDIO_SPECS[lvl].title} (Disponible SOLO en Texas)`}
                    >
                      {lvl === 'elite2500' ? '2.5K' : lvl === 'secure5000' ? '5K' : lvl === 'value7500' ? '7.5K' : '10K'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. + Sanitas Care (SOLO EN FLORIDA • FL) */}
              <button
                type="button"
                onClick={addSanitasCarePlan}
                className={`p-3 rounded-2xl border text-left transition shadow-xs cursor-pointer flex flex-col justify-between gap-1.5 h-full ${
                  geoAge.sanitasAvailability === 'unavailable_non_fl'
                    ? 'border-rose-300 bg-rose-50/70 hover:bg-rose-100/70 text-rose-950'
                    : 'border-teal-300 bg-teal-50/80 hover:bg-teal-100/80 text-teal-950'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-xs flex items-center gap-1.5">
                    <span>+ Sanitas Care</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                        geoAge.sanitasAvailability === 'unavailable_non_fl'
                          ? 'bg-rose-600 text-white'
                          : 'bg-teal-800 text-white'
                      }`}
                    >
                      SOLO FL
                    </span>
                  </span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </div>
                <span className="text-[10px] font-bold opacity-85">+$40 Fee 1.er Mes Auto • Solo Florida</span>
              </button>

              {/* 5. + HospitalWise (Basic / Bundle 1 / Bundle 2) */}
              <div className="p-2.5 rounded-2xl border border-cyan-300 bg-cyan-50/80 text-cyan-950 flex flex-col justify-between gap-1.5 shadow-xs h-full">
                <button
                  type="button"
                  onClick={() => addHospitalWisePlan('bundle1')}
                  className="w-full text-left flex items-center justify-between gap-1 cursor-pointer hover:opacity-80"
                >
                  <span className="font-black text-xs">+ HospitalWise</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>
                <div className="grid grid-cols-3 gap-1">
                  {(['basic', 'bundle1', 'bundle2'] as HospitalWiseLevel[]).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => addHospitalWisePlan(lvl)}
                      className="py-1 px-1 rounded-lg bg-white hover:bg-cyan-600 hover:text-white border border-cyan-200 text-[10px] font-black transition cursor-pointer text-center"
                      title={`Agregar ${HOSPITALWISE_SPECS[lvl].title} con beneficios oficiales`}
                    >
                      {HOSPITALWISE_SPECS[lvl].shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* 7. + BMI-PHCS (MEC Classic / Choice + MVP Basic / Value / Advantage) */}
              <div className="p-2.5 rounded-2xl border border-teal-300 bg-teal-50/50 text-teal-950 flex flex-col justify-between gap-1.5 shadow-xs h-full">
                <button
                  type="button"
                  onClick={() => addBmiPhcsPlan('choice')}
                  className="w-full text-left flex items-center justify-between gap-1 cursor-pointer hover:opacity-80"
                >
                  <span className="font-black text-xs">+ BMI-PHCS (Red PHCS)</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-1">
                    {(['classic', 'choice'] as BmiPhcsLevel[]).map(lvl => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => addBmiPhcsPlan(lvl)}
                        className="py-1 px-1 rounded-lg bg-white hover:bg-emerald-700 hover:text-white border border-emerald-300 text-[10px] font-black transition cursor-pointer text-center"
                        title={`Agregar ${BMI_PHCS_SPECS[lvl].title} ($${BMI_PHCS_SPECS[lvl].rates.empleado}/mes Ind.)`}
                      >
                        {BMI_PHCS_SPECS[lvl].shortLabel}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['basic', 'value', 'advantage'] as BmiPhcsLevel[]).map(lvl => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => addBmiPhcsPlan(lvl)}
                        className="py-1 px-1 rounded-lg bg-white hover:bg-teal-600 hover:text-white border border-teal-200 text-[10px] font-black transition cursor-pointer text-center"
                        title={`Agregar ${BMI_PHCS_SPECS[lvl].title}`}
                      >
                        {BMI_PHCS_SPECS[lvl].shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 8. + AFI Major Medical */}
              <div className="p-2.5 rounded-2xl border border-blue-300 bg-blue-50/60 text-blue-950 flex flex-col justify-between gap-1.5 shadow-xs h-full">
                <button
                  type="button"
                  onClick={() => addAfiPlan('copay3500')}
                  className="w-full text-left flex items-center justify-between gap-1 cursor-pointer hover:opacity-80"
                >
                  <span className="font-black text-xs">+ AFI Major Medical</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => addAfiPlan('hsa3500')}
                    className="py-1 px-1 rounded-lg bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-[10px] font-black transition cursor-pointer text-center"
                  >
                    3500 HSA
                  </button>
                  <button
                    type="button"
                    onClick={() => addAfiPlan('copay3500')}
                    className="py-1 px-1 rounded-lg bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-[10px] font-black transition cursor-pointer text-center"
                  >
                    3500 Copay
                  </button>
                </div>
              </div>

              {/* 9. + ACUSA Vault Health Plan */}
              <div className="p-2.5 rounded-2xl border border-orange-300 bg-orange-50/60 text-orange-950 flex flex-col justify-between gap-1.5 shadow-xs h-full">
                <button
                  type="button"
                  onClick={() => addAcusaPlan('silver2')}
                  className="w-full text-left flex items-center justify-between gap-1 cursor-pointer hover:opacity-80"
                >
                  <span className="font-black text-xs">+ ACUSA Vault (GI)</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => addAcusaPlan('bronze2')}
                    className="py-1 px-1 rounded-lg bg-white hover:bg-orange-600 hover:text-white border border-orange-200 text-[10px] font-black transition cursor-pointer text-center"
                  >
                    Bronze 2
                  </button>
                  <button
                    type="button"
                    onClick={() => addAcusaPlan('silver2')}
                    className="py-1 px-1 rounded-lg bg-white hover:bg-orange-600 hover:text-white border border-orange-200 text-[10px] font-black transition cursor-pointer text-center"
                  >
                    Silver 2
                  </button>
                </div>
              </div>

              {/* 10. + Premier Major Medical (Cigna PPO) */}
              <div className="p-2.5 rounded-2xl border border-violet-300 bg-violet-50/70 text-violet-950 flex flex-col justify-between gap-1.5 shadow-xs h-full">
                <button
                  type="button"
                  onClick={() => addPremierMmPlan('mm5000')}
                  className="w-full text-left flex items-center justify-between gap-1 cursor-pointer hover:opacity-80"
                >
                  <span className="font-black text-xs">+ Premier Major Medical</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>
                <div className="grid grid-cols-3 gap-1">
                  {(['mm2500', 'mm5000', 'mm7500'] as PremierMmLevel[]).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => addPremierMmPlan(lvl)}
                      className="py-1 px-1 rounded-lg bg-white hover:bg-violet-700 hover:text-white border border-violet-200 text-[10px] font-black transition cursor-pointer text-center"
                      title={`Agregar ${PREMIER_MM_SPECS[lvl].title} (Red Cigna PPO • 20% Coaseguro)`}
                    >
                      {PREMIER_MM_SPECS[lvl].shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* 11. + Premier Max (PHCS / First Health PPO) */}
              <div className="p-2.5 rounded-2xl border border-rose-300 bg-rose-50/70 text-rose-950 flex flex-col justify-between gap-1.5 shadow-xs h-full">
                <button
                  type="button"
                  onClick={() => addPremierMaxPlan('max2000')}
                  className="w-full text-left flex items-center justify-between gap-1 cursor-pointer hover:opacity-80"
                >
                  <span className="font-black text-xs">+ Premier Max</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>
                <div className="grid grid-cols-3 gap-1">
                  {(['max1000', 'max2000', 'max3000'] as PremierMaxLevel[]).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => addPremierMaxPlan(lvl)}
                      className="py-1 px-1 rounded-lg bg-white hover:bg-rose-700 hover:text-white border border-rose-200 text-[10px] font-black transition cursor-pointer text-center"
                      title={`Agregar ${PREMIER_MAX_SPECS[lvl].title} (PHCS / First Health PPO)`}
                    >
                      {PREMIER_MAX_SPECS[lvl].shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* 12. + Plan ACA (Obamacare) - Barra unificada completa al cierre */}
              <button
                type="button"
                onClick={addAcaPlan}
                className="col-span-full p-3 rounded-2xl border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950 text-left transition shadow-xs cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="font-black text-xs">+ Plan ACA (Obamacare)</span>
                  <span className="text-[10px] font-bold opacity-85">Mercado de Salud con Subsidio Federal + Copagos Día 1</span>
                </div>
                <Plus className="w-4 h-4 opacity-70 shrink-0" />
              </button>
            </div>

            {/* Acción Rápida de Paquete Combinado (Sanitas + HospitalWise) */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-[11px] text-slate-600">
                <strong className="text-slate-800">Combinación flexible (opcional):</strong>{' '}
                Los planes independientes <strong>no se suman</strong> entre sí. Usa este botón o marca{' '}
                <em>"Combinar / Sumar en Paquete"</em> dentro de las tarjetas cuando quieras sumar Sanitas Care + HospitalWise.
              </div>
              <button
                type="button"
                onClick={combineSanitasAndHospitalWise}
                className={`px-3.5 py-2 rounded-xl text-xs font-black border transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  areSanitasAndHospitalWiseCombined
                    ? 'bg-teal-600 text-white border-teal-700 shadow-sm hover:bg-teal-700'
                    : 'bg-gradient-to-r from-teal-50 to-cyan-50 text-[#005b9f] border-cyan-300 hover:border-[#008be3]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {areSanitasAndHospitalWiseCombined
                    ? '✓ Sanitas + HospitalWise Combinados (Clic para separar)'
                    : hasSanitasInPlans && hasHospitalWiseInPlans
                      ? 'Combinar Sanitas + HospitalWise en Total'
                      : '+ Combinar Sanitas + HospitalWise'}
                </span>
              </button>
            </div>
          </div>

          {/* Panel 3: Editor de Planes */}
          <div
            id="quoterPlanEditorPanel"
            className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 no-print quoter-edit-section"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00c9b7]"></span>
                Planes a Presentar al Cliente ({plans.length})
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {hasCombinedPackage ? (
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-[#005b9f] font-black">
                    Paquete Combinado ({combinedPlans.length}): ${formatMoney(combinedMonthlyTotal)}/mes
                    {combinedEnrollmentFee > 0 && ` • 1.er Mes $${formatMoney(combinedFirstMonthTotal)}`}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold text-[11px]">
                    Opciones independientes (sin suma automática)
                  </span>
                )}
                <span className="text-slate-400 hidden sm:inline">Sincronizado en vivo con PDF y Correo</span>
              </div>
            </div>

            {plans.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No hay planes agregados aún. Selecciona una plantilla oficial arriba o sube capturas para analizar con IA.
              </div>
            ) : (
              <div className="space-y-4">
                {plans.map((plan, index) => {
                  const sanitasFee = getPlanSanitasFee(plan);
                  const enrollmentFeeInfo = getPlanEnrollmentFee(plan);
                  const firstMonthVal = getPlanFirstMonth(plan);
                  const isMedMax = isMedMaxPlan(plan);
                  const isGuard = isGuardPlan(plan);
                  const isAffordableChoice = isAffordableChoicePlan(plan);
                  const isPresidio = isPresidioPlan(plan);
                  const isHpg = isHpgPlan(plan);
                  const isBmiPhcs = isBmiPhcsPlan(plan);
                  const isAfi = isAfiPlan(plan);
                  const isAcusa = isAcusaPlan(plan);
                  const isPremierMm = isPremierMmPlan(plan);
                  const isPremierMax = isPremierMaxPlan(plan);
                  const isSanitas = isSanitasPlan(plan) && !isHospitalWisePlan(plan);
                  const isHospitalWise = isHospitalWisePlan(plan);
                  const currentHpgLevel: HpgPlanLevel =
                    plan.hpgLevel || detectHpgLevelFromText(`${plan.planName} ${plan.tier}`);
                  const currentGuardLevel: GuardPlanLevel =
                    plan.guardLevel || detectGuardLevelFromText(`${plan.planName} ${plan.tier}`);
                  const currentAcLevel: AffordableChoiceLevel =
                    plan.affordableChoiceLevel ||
                    detectAffordableChoiceLevelFromText(`${plan.planName} ${plan.tier}`);
                  const currentAcAge: AffordableChoiceAge =
                    plan.affordableChoiceAge &&
                    AFFORDABLE_CHOICE_AGES.includes(plan.affordableChoiceAge as AffordableChoiceAge)
                      ? (plan.affordableChoiceAge as AffordableChoiceAge)
                      : detectClosestAffordableChoiceAge(clientAges);
                  const currentAcGroup: AffordableChoiceGroupKey = (plan.tier || '')
                    .toLowerCase()
                    .includes('solo niños')
                    ? 'solo_ninos'
                    : plan.medmaxFamilyTier || detectAffordableChoiceGroupKey(clientMembers, clientAges);
                  const currentPresidioLevel: PresidioLevel =
                    plan.presidioLevel || detectPresidioLevelFromText(`${plan.planName} ${plan.tier}`);

                  const currentMedMaxAge: MedMaxAgeBracket =
                    plan.medmaxAgeBracket || detectMedMaxAgeBracket(clientAges);
                  const currentMedMaxFam: EnrollFamilyTier =
                    plan.medmaxFamilyTier || detectEnrollFamilyTier(clientMembers, clientAges);
                  const currentMedMaxScope: MedMaxScope =
                    plan.medmaxScope || (currentMedMaxFam === 'empleado' ? 'individual' : 'familiar');
                  const currentMedMaxDedTier: MedMaxDeductibleTier =
                    plan.medmaxDeductibleTier || 750;
                  const medmaxDedCheck = isMedMax
                    ? validateMedMaxDeductible(plan.deductible, currentMedMaxScope)
                    : { isValid: true, reason: '', closestTier: 750 as MedMaxDeductibleTier };

                  const currentBmiLevel: BmiPhcsLevel =
                    plan.bmiLevel || detectBmiPhcsLevelFromText(`${plan.planName} ${plan.tier}`);
                  const currentAfiLevel: AfiLevel =
                    plan.afiLevel || (plan.planName.toLowerCase().includes('hsa') ? 'hsa3500' : 'copay3500');
                  const currentAcusaLevel: AcusaLevel =
                    plan.acusaLevel || (plan.planName.toLowerCase().includes('bronze') ? 'bronze2' : 'silver2');
                  const currentPremierMmLevel: PremierMmLevel =
                    plan.premierMmLevel || detectPremierMmLevelFromText(`${plan.planName} ${plan.tier}`);
                  const currentPremierMaxLevel: PremierMaxLevel =
                    plan.premierMaxLevel || detectPremierMaxLevelFromText(`${plan.planName} ${plan.tier}`);

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
                            placeholder="Compañía"
                            className="font-black text-slate-900 text-xs sm:text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#008be3] outline-none w-full"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <select
                            value={plan.planCategory || 'custom'}
                            onChange={e => updatePlan(plan.id, 'planCategory', e.target.value as QuotePlanCategory)}
                            className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-200 rounded-lg text-slate-700 outline-none"
                            title="Ficha oficial del plan"
                          >
                            <option value="custom">Personalizado</option>
                            <option value="medmax">MedMax (ERISA)</option>
                            <option value="hpg4000">HPG 2000/4000/5000</option>
                            <option value="guard">Guard Plans (4000/5000/6000)</option>
                            <option value="affordable_choice">Affordable Choice (ManhattanLife)</option>
                            <option value="presidio">Presidio Fortress (Solo TX)</option>
                            <option value="bmi_phcs">BMI-PHCS (Red PHCS)</option>
                            <option value="afi">AFI Major Medical (3500)</option>
                            <option value="acusa">ACUSA Vault (Bronze/Silver)</option>
                            <option value="premier_mm">Premier Major Medical (Cigna PPO)</option>
                            <option value="premier_max">Premier Max (PHCS / First Health PPO)</option>
                            <option value="sanitas">Sanitas Care Plus</option>
                            <option value="hospitalwise">HospitalWise (Basic / Bundle 1 / 2)</option>
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

                      {/* Selector Exacto HospitalWise (Basic / Bundle 1 / Bundle 2) */}
                      {isHospitalWise && (() => {
                        const currentHwLevel: HospitalWiseLevel =
                          plan.hospitalwiseLevel || detectHospitalWiseLevelFromText(`${plan.planName} ${plan.tier}`);
                        return (
                          <div className="bg-cyan-50 p-2.5 rounded-xl border border-cyan-200 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-cyan-950">
                              Nivel Oficial HospitalWise® (Golden Rule / UHC — Efectivo Directo):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {(['basic', 'bundle1', 'bundle2'] as HospitalWiseLevel[]).map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => changeHospitalWiseLevel(plan.id, lvl)}
                                  className={`px-3 py-1 rounded-lg text-[11px] font-black border transition cursor-pointer ${
                                    currentHwLevel === lvl
                                      ? 'bg-cyan-700 text-white border-cyan-800 shadow-xs'
                                      : 'bg-white text-cyan-950 border-cyan-200 hover:bg-cyan-100'
                                  }`}
                                >
                                  {HOSPITALWISE_SPECS[lvl].shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Selector Exacto de Nivel Guard Plans (Guard 4000 / Guard 5000 / Guard 6000) */}
                      {isGuard && (
                        <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase text-blue-950">
                            Nivel Oficial Guard Plans (Golden Rule / UHC Choice Plus — Efectivo Fijo):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(['guard4000', 'guard5000', 'guard6000'] as GuardPlanLevel[]).map(lvl => (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => changeGuardLevel(plan.id, lvl)}
                                className={`px-3 py-1 rounded-lg text-[11px] font-black border transition cursor-pointer ${
                                  currentGuardLevel === lvl
                                    ? 'bg-blue-700 text-white border-blue-800 shadow-xs'
                                    : 'bg-white text-blue-950 border-blue-200 hover:bg-blue-100'
                                }`}
                              >
                                {GUARD_SPECS[lvl].shortLabel}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Selector Exacto ManhattanLife Affordable Choice (Classic / Classic+ / Elite / Elite+ + Edad + Grupo) */}
                      {isAffordableChoice && (
                        <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-rose-950">
                              ManhattanLife Affordable Choice (Sin períodos de espera • Red libre):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {(['classic', 'classic_plus', 'elite', 'elite_plus'] as AffordableChoiceLevel[]).map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => updateAffordableChoiceConfig(plan.id, { level: lvl })}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition cursor-pointer ${
                                    currentAcLevel === lvl
                                      ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                                      : 'bg-white text-rose-950 border-rose-200 hover:bg-rose-100'
                                  }`}
                                >
                                  {AFFORDABLE_CHOICE_SPECS[lvl].shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <span className="block text-[9.5px] font-bold text-rose-900 mb-1">
                                Edad de referencia (tarifa de muestra oficial):
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {AFFORDABLE_CHOICE_AGES.map(ageOpt => (
                                  <button
                                    key={ageOpt}
                                    type="button"
                                    onClick={() => updateAffordableChoiceConfig(plan.id, { age: ageOpt })}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                      currentAcAge === ageOpt
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-rose-900 border-rose-200 hover:bg-rose-100'
                                    }`}
                                  >
                                    {ageOpt}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="block text-[9.5px] font-bold text-rose-900 mb-1">
                                Grupo familiar (Edad {currentAcAge}):
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {[
                                  { key: 'empleado' as AffordableChoiceGroupKey, label: '1 Persona' },
                                  { key: 'pareja' as AffordableChoiceGroupKey, label: 'Pareja' },
                                  { key: 'hijos' as AffordableChoiceGroupKey, label: 'Padre+Hijos' },
                                  { key: 'familiar' as AffordableChoiceGroupKey, label: 'Familia' },
                                  { key: 'solo_ninos' as AffordableChoiceGroupKey, label: 'Solo Niños' }
                                ].map(opt => (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => updateAffordableChoiceConfig(plan.id, { groupKey: opt.key })}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                      currentAcGroup === opt.key
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-rose-900 border-rose-200 hover:bg-rose-100'
                                    }`}
                                  >
                                    {opt.label} (${AFFORDABLE_CHOICE_SPECS[currentAcLevel].ratesByAge[currentAcAge][opt.key].toFixed(2)})
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Selector Exacto Presidio Healthcare Fortress Plan (SOLO TX) */}
                      {isPresidio && (
                        <div
                          className={`p-2.5 rounded-xl border space-y-2 ${
                            geoAge.detectedState && !geoAge.presidioAvailable
                              ? 'bg-rose-50/90 border-rose-300'
                              : 'bg-amber-50/80 border-amber-300'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-amber-950 flex items-center gap-1.5">
                              <span>Presidio Fortress Plan ($0 Ded. • 50% Coas. • 100% post-MOOP):</span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-900 text-white text-[9px]">SOLO TX</span>
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {(['elite2500', 'secure5000', 'value7500', 'essential10000'] as PresidioLevel[]).map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => changePresidioLevel(plan.id, lvl)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition cursor-pointer ${
                                    currentPresidioLevel === lvl
                                      ? 'bg-amber-700 text-white border-amber-800 shadow-xs'
                                      : 'bg-white text-amber-950 border-amber-300 hover:bg-amber-100'
                                  }`}
                                >
                                  {PRESIDIO_SPECS[lvl].shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                          {geoAge.detectedState && !geoAge.presidioAvailable ? (
                            <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-[11px] font-bold">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" />
                              <span>
                                ALERTA GEOGRÁFICA: Presidio Fortress aplica EXCLUSIVAMENTE en Texas (TX). El estado actual detectado ({geoAge.detectedState}) no es elegible para emitir este plan.
                              </span>
                            </div>
                          ) : (
                            <p className="text-[10.5px] font-bold text-amber-900">
                              ✓ Válido SOLO en Texas (TDI). Referencia folleto {PRESIDIO_SPECS[currentPresidioLevel].shortLabel}:{' '}
                              {PRESIDIO_SPECS[currentPresidioLevel].sampleRateHint}.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Selector Exacto de Nivel HPG (Select 2000 / Preferred 4000 / Premier 5000) */}
                      {isHpg && (
                        <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-200 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase text-sky-900">
                            Nivel Oficial Health ProtectorGuard (carga montos exactos sin mezclas):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(['select2000', 'preferred4000', 'premier5000'] as HpgPlanLevel[]).map(lvl => (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => changeHpgLevel(plan.id, lvl)}
                                className={`px-3 py-1 rounded-lg text-[11px] font-black border transition cursor-pointer ${
                                  currentHpgLevel === lvl
                                    ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                                    : 'bg-white text-sky-900 border-sky-200 hover:bg-sky-100'
                                }`}
                              >
                                {HPG_SPECS[lvl].shortLabel}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Configurador Exacto MedMax: Modalidad Ind/Fam, Edad, Categoría y Deducible Oficial */}
                      {isMedMax && (
                        <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-300 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-amber-950">
                              Configuración Oficial MedMax (Edad + Deducible Individual/Familiar):
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-amber-900">Deducible:</span>
                              {(['individual', 'familiar'] as MedMaxScope[]).map(sc => (
                                <button
                                  key={sc}
                                  type="button"
                                  onClick={() => updateMedMaxConfig(plan.id, { scope: sc })}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer transition ${
                                    currentMedMaxScope === sc
                                      ? 'bg-amber-700 text-white border-amber-800 shadow-xs'
                                      : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-100'
                                  }`}
                                >
                                  {sc === 'individual' ? 'Individual ($9,200 MOOP)' : 'Familiar ($18,400 MOOP)'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <span className="block text-[10px] font-bold text-amber-900 mb-1">
                                Rango de Edad (auto-calcula tarifa mensual):
                              </span>
                              <div className="grid grid-cols-4 gap-1">
                                {(['18-29', '30-44', '45-54', '55-64'] as MedMaxAgeBracket[]).map(age => (
                                  <button
                                    key={age}
                                    type="button"
                                    onClick={() => updateMedMaxConfig(plan.id, { ageBracket: age })}
                                    className={`py-1 px-1.5 rounded-lg text-[10px] font-black border cursor-pointer transition ${
                                      currentMedMaxAge === age
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    {age} años
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <span className="block text-[10px] font-bold text-amber-900 mb-1">
                                Categoría de Tarifa MedMax:
                              </span>
                              <div className="grid grid-cols-4 gap-1">
                                {[
                                  { key: 'empleado' as EnrollFamilyTier, label: 'Empleado' },
                                  { key: 'pareja' as EnrollFamilyTier, label: 'Emp.+Cóny.' },
                                  { key: 'hijos' as EnrollFamilyTier, label: 'Emp.+Hijos' },
                                  { key: 'familiar' as EnrollFamilyTier, label: 'Familiar' }
                                ].map(item => (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => updateMedMaxConfig(plan.id, { familyTier: item.key })}
                                    className={`py-1 px-1 rounded-lg text-[10px] font-black border cursor-pointer transition ${
                                      currentMedMaxFam === item.key
                                        ? 'bg-[#005b9f] text-white border-[#005b9f]'
                                        : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="block text-[10px] font-bold text-amber-900 mb-1">
                              Opciones Oficiales de Deducible ({currentMedMaxScope === 'individual' ? 'Individual' : 'Familiar'}):
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                              {MEDMAX_DEDUCTIBLE_OPTIONS.map(opt => {
                                const priceForOpt = getMedMaxQuotePricing(
                                  currentMedMaxAge,
                                  currentMedMaxFam,
                                  opt.tier
                                ).monthlyPrice;
                                const isActive = currentMedMaxDedTier === opt.tier;
                                return (
                                  <button
                                    key={opt.tier}
                                    type="button"
                                    onClick={() => updateMedMaxConfig(plan.id, { deductibleTier: opt.tier })}
                                    className={`py-1.5 px-2 rounded-lg text-[10px] font-black border cursor-pointer transition text-center ${
                                      isActive
                                        ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                        : 'bg-white text-amber-950 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    <span className="block">
                                      {currentMedMaxScope === 'individual'
                                        ? `${opt.indLabel} Ind.`
                                        : `${opt.famLabel} Fam.`}
                                    </span>
                                    <span className={`text-[9px] font-bold ${isActive ? 'text-amber-100' : 'text-slate-500'}`}>
                                      ${priceForOpt}/mes
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {!medmaxDedCheck.isValid && (
                            <div className="bg-rose-50 border border-rose-300 rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-rose-900 font-bold">
                              <span>⚠️ {medmaxDedCheck.reason}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateMedMaxConfig(plan.id, { deductibleTier: medmaxDedCheck.closestTier })
                                }
                                className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px] cursor-pointer hover:bg-rose-700"
                              >
                                Corregir a Deducible Oficial
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Selector BMI-PHCS (Classic / Choice / Basic / Value / Advantage + Grupo Familiar) */}
                      {isBmiPhcs && (
                        <div className="bg-teal-50/70 p-2.5 rounded-xl border border-teal-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-teal-950">
                              Nivel BMI-PHCS (Red PHCS • $0 Deducible):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {(['classic', 'choice', 'basic', 'value', 'advantage'] as BmiPhcsLevel[]).map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => updateBmiConfig(plan.id, { level: lvl })}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                    currentBmiLevel === lvl
                                      ? 'bg-teal-700 text-white border-teal-800'
                                      : 'bg-white text-teal-900 border-teal-200 hover:bg-teal-100'
                                  }`}
                                >
                                  {BMI_PHCS_SPECS[lvl].shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {[
                              { key: 'empleado' as EnrollFamilyTier, label: 'Individual' },
                              { key: 'pareja' as EnrollFamilyTier, label: 'Titular+Cónyuge' },
                              { key: 'hijos' as EnrollFamilyTier, label: 'Titular+Hijo(s)' },
                              { key: 'familiar' as EnrollFamilyTier, label: 'Familia Completa' }
                            ].map(opt => (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => updateBmiConfig(plan.id, { familyTier: opt.key })}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                  currentMedMaxFam === opt.key
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-teal-900 border-teal-200 hover:bg-teal-100'
                                }`}
                              >
                                {opt.label} (${BMI_PHCS_SPECS[currentBmiLevel].rates[opt.key].toFixed(2)})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Selector AFI Major Medical */}
                      {isAfi && (
                        <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-blue-950">
                              AFI Major Medical (Deducible $3,500/$7,000 + $75 Solicitud):
                            </span>
                            <div className="flex gap-1.5">
                              {(['hsa3500', 'copay3500'] as AfiLevel[]).map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => updateAfiConfig(plan.id, { level: lvl })}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                    currentAfiLevel === lvl
                                      ? 'bg-blue-700 text-white border-blue-800'
                                      : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-100'
                                  }`}
                                >
                                  {AFI_SPECS[lvl].shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {[
                              { key: 'empleado' as EnrollFamilyTier, label: 'Individual' },
                              { key: 'pareja' as EnrollFamilyTier, label: 'Titular+Cónyuge' },
                              { key: 'hijos' as EnrollFamilyTier, label: 'Titular+Hijo(s)' },
                              { key: 'familiar' as EnrollFamilyTier, label: 'Familia Completa' }
                            ].map(opt => (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => updateAfiConfig(plan.id, { familyTier: opt.key })}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                  currentMedMaxFam === opt.key
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-100'
                                }`}
                              >
                                {opt.label} (${AFI_SPECS[currentAfiLevel].rates[opt.key].toFixed(2)})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Selector ACUSA Vault Health Plan */}
                      {isAcusa && (
                        <div className="bg-orange-50/70 p-2.5 rounded-xl border border-orange-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-orange-950">
                              ACUSA • Vault Health Plan (Guaranteed Issue + $75 App Fee):
                            </span>
                            <div className="flex gap-1.5">
                              {(['bronze2', 'silver2'] as AcusaLevel[]).map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => updateAcusaConfig(plan.id, { level: lvl })}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                    currentAcusaLevel === lvl
                                      ? 'bg-orange-600 text-white border-orange-700'
                                      : 'bg-white text-orange-900 border-orange-200 hover:bg-orange-100'
                                  }`}
                                >
                                  {ACUSA_SPECS[lvl].shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {[
                              { key: 'empleado' as EnrollFamilyTier, label: 'Individual' },
                              { key: 'pareja' as EnrollFamilyTier, label: 'Cónyuge' },
                              { key: 'hijos' as EnrollFamilyTier, label: 'Hijo(s)' },
                              { key: 'familiar' as EnrollFamilyTier, label: 'Familiar' }
                            ].map(opt => (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => updateAcusaConfig(plan.id, { familyTier: opt.key })}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                  currentMedMaxFam === opt.key
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-orange-900 border-orange-200 hover:bg-orange-100'
                                }`}
                              >
                                {opt.label} (${ACUSA_SPECS[currentAcusaLevel].rates[opt.key].toFixed(2)})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Selector Premier Major Medical (2500 / 5000 / 7500 + Edad + Grupo Familiar) */}
                      {isPremierMm && (
                        <div className="bg-violet-50/70 p-2.5 rounded-xl border border-violet-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-violet-950">
                              Premier Major Medical (Red Cigna PPO • 20% Coaseguro • Tarifas ACH):
                            </span>
                            <div className="flex gap-1.5">
                              {(['mm2500', 'mm5000', 'mm7500'] as PremierMmLevel[]).map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => updatePremierMmConfig(plan.id, { level: lvl })}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                    currentPremierMmLevel === lvl
                                      ? 'bg-violet-700 text-white border-violet-800'
                                      : 'bg-white text-violet-900 border-violet-200 hover:bg-violet-100'
                                  }`}
                                >
                                  Deducible ${PREMIER_MM_SPECS[lvl].shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[10px] font-bold text-violet-900 mr-1">Edad:</span>
                              {(['18-29', '30-44', '45-54', '55-64'] as MedMaxAgeBracket[]).map(bracket => (
                                <button
                                  key={bracket}
                                  type="button"
                                  onClick={() => updatePremierMmConfig(plan.id, { ageBracket: bracket })}
                                  className={`px-2 py-0.5 rounded text-[10px] font-black border cursor-pointer ${
                                    currentMedMaxAge === bracket
                                      ? 'bg-violet-700 text-white border-violet-800'
                                      : 'bg-white text-violet-900 border-violet-200 hover:bg-violet-100'
                                  }`}
                                >
                                  {bracket}
                                </button>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {[
                                { key: 'empleado' as EnrollFamilyTier, label: 'Individual' },
                                { key: 'pareja' as EnrollFamilyTier, label: 'Emp.+Cóny.' },
                                { key: 'hijos' as EnrollFamilyTier, label: 'Emp.+Hijo(s)' },
                                { key: 'familiar' as EnrollFamilyTier, label: 'Familiar' }
                              ].map(opt => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => updatePremierMmConfig(plan.id, { familyTier: opt.key })}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                    currentMedMaxFam === opt.key
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white text-violet-900 border-violet-200 hover:bg-violet-100'
                                  }`}
                                >
                                  {opt.label} (${PREMIER_MM_SPECS[currentPremierMmLevel].rates[currentMedMaxAge][opt.key].toFixed(2)})
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Selector Premier Max (1000 / 2000 / 3000 + Edad + Grupo Familiar) */}
                      {isPremierMax && (
                        <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-rose-950">
                              Premier Max (PHCS o First Health PPO • Límites de Visitas • Tarifas ACH):
                            </span>
                            <div className="flex gap-1.5">
                              {(['max1000', 'max2000', 'max3000'] as PremierMaxLevel[]).map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => updatePremierMaxConfig(plan.id, { level: lvl })}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                    currentPremierMaxLevel === lvl
                                      ? 'bg-rose-700 text-white border-rose-800'
                                      : 'bg-white text-rose-900 border-rose-200 hover:bg-rose-100'
                                  }`}
                                >
                                  Deducible ${PREMIER_MAX_SPECS[lvl].shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[10px] font-bold text-rose-900 mr-1">Edad:</span>
                              {(['18-29', '30-44', '45-54', '55-64'] as MedMaxAgeBracket[]).map(bracket => (
                                <button
                                  key={bracket}
                                  type="button"
                                  onClick={() => updatePremierMaxConfig(plan.id, { ageBracket: bracket })}
                                  className={`px-2 py-0.5 rounded text-[10px] font-black border cursor-pointer ${
                                    currentMedMaxAge === bracket
                                      ? 'bg-rose-700 text-white border-rose-800'
                                      : 'bg-white text-rose-900 border-rose-200 hover:bg-rose-100'
                                  }`}
                                >
                                  {bracket}
                                </button>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {[
                                { key: 'empleado' as EnrollFamilyTier, label: 'Individual' },
                                { key: 'pareja' as EnrollFamilyTier, label: 'Emp.+Cóny.' },
                                { key: 'hijos' as EnrollFamilyTier, label: 'Emp.+Hijo(s)' },
                                { key: 'familiar' as EnrollFamilyTier, label: 'Familiar' }
                              ].map(opt => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => updatePremierMaxConfig(plan.id, { familyTier: opt.key })}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                    currentMedMaxFam === opt.key
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white text-rose-900 border-rose-200 hover:bg-rose-100'
                                  }`}
                                >
                                  {opt.label} (${PREMIER_MAX_SPECS[currentPremierMaxLevel].rates[currentMedMaxAge][opt.key].toFixed(2)})
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500">Nombre Exacto del Plan</label>
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
                              ? 'Prima con Crédito Fiscal ($/mes) *'
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
                            placeholder={isHospitalWise ? 'Ej. 25.79 o 110.18' : 'Ej. 89.00'}
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

                      {/* Fila Costos Base (Deducible Anual + Máximo de Bolsillo) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label
                              className={`block text-[10px] font-bold ${
                                isMedMax ? 'text-amber-800 font-black' : 'text-slate-500'
                              }`}
                            >
                              {isMedMax ? 'Deducible Anual MedMax (Ind/Fam) *' : 'Deducible Anual'}
                            </label>
                          </div>
                          <input
                            type="text"
                            value={plan.deductible}
                            onChange={e => updatePlan(plan.id, 'deductible', e.target.value)}
                            className={`w-full px-2.5 py-1.5 text-xs bg-white rounded-lg font-bold ${
                              isMedMax
                                ? medmaxDedCheck.isValid
                                  ? 'border-2 border-amber-400 text-amber-950'
                                  : 'border-2 border-rose-500 text-rose-900'
                                : 'border border-slate-200'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#005b9f] mb-0.5">
                            Máximo de Bolsillo (Out-of-Pocket Max) *
                          </label>
                          <input
                            type="text"
                            value={plan.moop}
                            onChange={e => updatePlan(plan.id, 'moop', e.target.value)}
                            placeholder="$1,500"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-sky-200 rounded-lg font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      {/* Campos Específicos para Plan ACA (Obamacare) */}
                      {plan.planCategory === 'aca' && (
                        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-emerald-900">
                                ID del Plan ACA
                              </label>
                              <input
                                type="text"
                                value={plan.planIdCode || ''}
                                onChange={e => updatePlan(plan.id, 'planIdCode', e.target.value)}
                                placeholder="Ej. 21525FL0020035"
                                className="w-full px-2.5 py-1 text-xs bg-white border border-emerald-200 rounded-lg font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-emerald-900">
                                Crédito Fiscal / Ahorro Mensual
                              </label>
                              <input
                                type="text"
                                value={plan.subsidyAmount || ''}
                                onChange={e => updatePlan(plan.id, 'subsidyAmount', e.target.value)}
                                placeholder="Ej. $485.00/mes"
                                className="w-full px-2.5 py-1 text-xs bg-white border border-emerald-200 rounded-lg font-bold text-emerald-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-emerald-900">
                                Requisito de Referido
                              </label>
                              <input
                                type="text"
                                value={plan.referralRequired || ''}
                                onChange={e => updatePlan(plan.id, 'referralRequired', e.target.value)}
                                placeholder="Ej. No requiere referido"
                                className="w-full px-2.5 py-1 text-xs bg-white border border-emerald-200 rounded-lg font-semibold"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-emerald-900">
                                1. Primario y Telemedicina
                              </label>
                              <input
                                type="text"
                                value={plan.primaryCare}
                                onChange={e => updatePlan(plan.id, 'primaryCare', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-emerald-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-emerald-900">
                                1b. Especialista
                              </label>
                              <input
                                type="text"
                                value={plan.specialist}
                                onChange={e => updatePlan(plan.id, 'specialist', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-emerald-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-emerald-900">
                                2. Laboratorios e Imágenes
                              </label>
                              <input
                                type="text"
                                value={plan.acaLabsImaging || ''}
                                onChange={e => updatePlan(plan.id, 'acaLabsImaging', e.target.value)}
                                placeholder="Labs $0 / Rayos X $15 / MRI 20%"
                                className="w-full px-2 py-1 text-xs bg-white border border-emerald-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-emerald-900">
                                3. Urgencias, Emergencias y Hospitalización
                              </label>
                              <input
                                type="text"
                                value={plan.acaErHospital || plan.urgencies}
                                onChange={e => {
                                  updatePlan(plan.id, 'acaErHospital', e.target.value);
                                  updatePlan(plan.id, 'urgencies', e.target.value);
                                }}
                                placeholder="UC $25 / ER $150 / Hospital $150/día"
                                className="w-full px-2 py-1 text-xs bg-white border border-emerald-200 rounded-lg"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-emerald-900">
                              4. Medicamentos por Niveles
                            </label>
                            <input
                              type="text"
                              value={plan.acaRxTiers || plan.genericRx}
                              onChange={e => {
                                updatePlan(plan.id, 'acaRxTiers', e.target.value);
                                updatePlan(plan.id, 'genericRx', e.target.value);
                              }}
                              placeholder="Nivel 1 Genéricos $3 / Nivel 2 Preferidos $15 / Nivel 3 Marca $35"
                              className="w-full px-2 py-1 text-xs bg-white border border-emerald-200 rounded-lg"
                            />
                          </div>
                        </div>
                      )}

                      {/* Ajuste Rápido Sanitas Care Plus + Validación Solo Florida */}
                      {isSanitas && (
                        <div className="bg-teal-50/70 p-2.5 rounded-xl border border-teal-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-teal-900">
                              Tarifas Oficiales Sanitas Care Plus (+$40.00 fee 1.er mes):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { label: 'Individual $89 (1.er $129)', price: '89.00', group: 'Individual (Solo Adulto)' },
                                { label: 'Titular+1 Niño $125 (1.er $165)', price: '125.00', group: 'Titular + 1 Niño' },
                                { label: 'Pareja $159 (1.er $199)', price: '159.00', group: 'Pareja (2 Adultos)' },
                                { label: 'Familiar $170 (1.er $210)', price: '170.00', group: 'Familiar' },
                                { label: '2A+1N $195 (1.er $235)', price: '195.00', group: 'Familia 2 Adultos + 1 Niño' },
                                { label: '2A+2N $240 (1.er $280)', price: '240.00', group: 'Familia 2 Adultos + 2 Niños' }
                              ].map(opt => (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => {
                                    updatePlan(plan.id, 'premium', opt.price);
                                    updatePlan(plan.id, 'planName', `Sanitas Care Plus (${opt.group})`);
                                    updatePlan(plan.id, 'hasSanitasFee', true);
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
                          {geoAge.sanitasAvailability === 'unavailable_non_fl' ? (
                            <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-[11px] font-bold">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" />
                              <span>
                                ALERTA GEOGRÁFICA: Sanitas Care aplica EXCLUSIVAMENTE en Florida (FL) por ahora. El estado actual detectado ({geoAge.detectedState}) no es elegible para emitir este plan.
                              </span>
                            </div>
                          ) : (
                            <p className="text-[10.5px] font-bold text-teal-900">
                              ✓ Válido SOLO en Florida (FL) • +50 centros médicos Sanitas en Florida.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Toggle Fee Sanitas + Toggle Combinar en Paquete */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-[#005b9f]">
                            <input
                              type="checkbox"
                              checked={Boolean(plan.includeInCombinedTotal)}
                              onChange={e => updatePlan(plan.id, 'includeInCombinedTotal', e.target.checked)}
                              className="w-4 h-4 rounded text-[#008be3] focus:ring-[#008be3]"
                            />
                            <span>Combinar / Sumar en Paquete</span>
                          </label>

                          {Boolean(plan.includeInCombinedTotal) && !hasCombinedPackage && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[10px]">
                              Marca otro plan más para sumarlos
                            </span>
                          )}

                          {Boolean(plan.includeInCombinedTotal) && hasCombinedPackage && (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-[#005b9f] font-black text-[10px]">
                              ✓ Sumado en Paquete Combinado
                            </span>
                          )}

                          {(isSanitas || sanitasFee > 0) && (
                            <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-teal-800">
                              <input
                                type="checkbox"
                                checked={sanitasFee > 0}
                                onChange={e => updatePlan(plan.id, 'hasSanitasFee', e.target.checked)}
                                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                              />
                              <span>Fee Único Sanitas (+$40.00 en 1.er Mes)</span>
                            </label>
                          )}

                          {(isAfi || isAcusa || isBmiPhcs) && (
                            <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-blue-800">
                              <input
                                type="checkbox"
                                checked={Boolean(plan.hasEnrollmentFee)}
                                onChange={e => {
                                  updatePlan(plan.id, 'hasEnrollmentFee', e.target.checked);
                                  if (e.target.checked && !plan.enrollmentFee) {
                                    updatePlan(plan.id, 'enrollmentFee', '75.00');
                                  }
                                }}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span>Cargo Único Inscripción / Solicitud (+$75.00 solo 1.er Mes)</span>
                            </label>
                          )}

                          {enrollmentFeeInfo.amount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 font-black text-[11px] tabular-nums">
                              1.er Mes Plan: ${formatMoney(firstMonthVal)}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-bold text-slate-400">
                          {plan.planCategory && plan.planCategory !== 'aca' && plan.planCategory !== 'custom'
                            ? '✓ Ficha Oficial Cerrada Activa (cero mezclas)'
                            : 'Editable'}
                        </span>
                      </div>

                      {/* Alerta Obligatoria MedMax */}
                      {isMedMax && (
                        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-950 font-semibold">
                          <strong className="uppercase font-black text-amber-900 flex items-center gap-1 mb-0.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Alerta Obligatoria MedMax (incluida en PDF y Correo):
                          </strong>
                          {plan.deductibleWarning || MEDMAX_DEFAULT_WARNING}
                        </div>
                      )}

                      {/* Campos para planes personalizados */}
                      {(!plan.planCategory || plan.planCategory === 'custom') && (
                        <div className="space-y-2 pt-1">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400">Dr. Primario</label>
                              <input
                                type="text"
                                value={plan.primaryCare}
                                onChange={e => updatePlan(plan.id, 'primaryCare', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400">Especialista</label>
                              <input
                                type="text"
                                value={plan.specialist}
                                onChange={e => updatePlan(plan.id, 'specialist', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400">Med. Genérica</label>
                              <input
                                type="text"
                                value={plan.genericRx}
                                onChange={e => updatePlan(plan.id, 'genericRx', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400">Urgencias</label>
                              <input
                                type="text"
                                value={plan.urgencies}
                                onChange={e => updatePlan(plan.id, 'urgencies', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={plan.clientSummary}
                              onChange={e => updatePlan(plan.id, 'clientSummary', e.target.value)}
                              placeholder="Nota breve para el cliente..."
                              className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => generatePlanSummaryWithAI(plan.id)}
                              className="px-2.5 py-1.5 bg-cyan-50 text-[#008be3] rounded-lg font-bold text-[11px] border border-cyan-200 cursor-pointer flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" /> IA
                            </button>
                            <button
                              type="button"
                              onClick={() => searchPlanBenefitsOnline(plan.id)}
                              className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold text-[11px] border border-slate-200 cursor-pointer flex items-center gap-1"
                            >
                              <Globe className="w-3 h-3" /> Google
                            </button>
                          </div>
                        </div>
                      )}
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
        className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:overflow-visible print:rounded-none print:shadow-none print:border-none"
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
                  Documento ejecutivo para <strong className="text-[#008be3]">{clientName.trim() || 'el cliente'}</strong> sin mezclas ni repeticiones.
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => openEmailGenerator()}
                className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Generar Correo</span>
              </button>
              <button
                type="button"
                onClick={copyShortTextMessage}
                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Copiar SMS</span>
              </button>
              <button
                type="button"
                onClick={copyWhatsAppMessage}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
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
                          {q.plans.filter(p => Boolean(p.includeInCombinedTotal)).length >= 2
                            ? `Comb. $${q.totalMonthlyPremium.toFixed(2)}/mes`
                            : q.plans.length > 1
                              ? `Opción $${q.totalMonthlyPremium.toFixed(2)}/mes`
                              : `$${q.totalMonthlyPremium.toFixed(2)}/mes`}
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
                    Para: <strong className="text-teal-300">{clientName.trim() || 'Prospecto'}</strong>
                    {clientLocation.trim() ? ` • ${clientLocation.trim()}` : ''}
                    {clientAges.trim() ? ` • Edades: ${clientAges.trim()}` : ''}
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
                      Alternativas privadas + ficha exacta + zona
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
                      Crédito fiscal + copagos Día 1 por categoría
                    </span>
                  </div>
                </button>
              </div>
            </div>

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
              Para analizar capturas de cotizaciones y extraer automáticamente planes ACA, HPG, Guard, Affordable Choice, Presidio (TX), MedMax, BMI-PHCS, AFI, ACUSA, Premier Major Medical, Premier Max, Sanitas o HospitalWise, conecta tu API Key de Gemini.
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
                    {plans.length === 1 ? 'opción' : 'opciones'} • Cero mezclas ni repeticiones
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
                ✓ Documento ejecutivo listo para entregar o guardar en PDF con encabezado Agente Contigo y cuadro comparativo.
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
