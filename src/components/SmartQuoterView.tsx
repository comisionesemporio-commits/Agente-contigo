import React, { useState, useEffect, useRef } from 'react';
import { HpgPlanLevel, QuotePlan, QuotePlanCategory, SavedQuote } from '../types';
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
  AHW4_OFFICIAL_BULLETS,
  FAMILY_GROUP_PRESETS,
  HOSPITALWISE_OFFICIAL_BULLETS,
  HPG_SPECS,
  MEDMAX_DEFAULT_WARNING,
  MEDMAX_OFFICIAL_BULLETS,
  SANITAS_OFFICIAL_BULLETS,
  detectHpgLevelFromText,
  enforceOfficialCatalogOnPlan,
  evaluateGeoAndAgeEligibility,
  formatMoney,
  getExactOfficialBulletsForPlan,
  getPlanFirstMonth,
  getPlanSanitasFee,
  getSanitasPricingForFamily,
  isHpgPlan,
  isHospitalWisePlan,
  isMedMaxPlan,
  isSanitasPlan,
  parseMoney
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

  // Plans List State
  const [plans, setPlans] = useState<QuotePlan[]>([
    {
      id: 'plan_demo_1',
      tag: 'OPCIÓN PRINCIPAL RECOMENDADA',
      planCategory: 'aca',
      company: 'UnitedHealthcare',
      planName: 'Silver Value Copay',
      tier: 'Plata CSR',
      planIdCode: '21525FL0020035',
      referralRequired: 'No requiere referido de PCP',
      subtitleTag: 'MERCADO DE SALUD ACA (OBAMACARE) • PLATA CSR',
      premium: '0.00',
      subsidyAmount: '$485.00/mes',
      deductible: '$0',
      moop: '$1,500',
      primaryCare: '$0 | Telemedicina $0',
      specialist: '$15',
      acaLabsImaging: 'Laboratorios $0 / Imágenes $15',
      acaErHospital: 'Urgencias $30 / Emergencias $150 / Hospital $150 por día',
      acaRxTiers: 'Nivel 1 Genéricos $3 / Nivel 2 Preferidos $15 / Nivel 3 Marca $35',
      genericRx: '$3',
      urgencies: '$30 UC / $150 ER',
      extraBenefit: 'Plan ACA con crédito fiscal aplicado y prevención al 100%',
      clientSummary: 'Cobertura médica mayor ACA con $0 deducible y copagos desde el día 1.',
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
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
        document.body.classList.remove('is-printing-proposal');
      }, 1000);
    }, 150);
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
    const created: QuotePlan = {
      id: newId,
      tag: 'PLAN MEDMAX',
      planCategory: 'medmax',
      company: 'MedMax',
      planName: 'Plan MedMax',
      tier: 'Deductible Value Plan',
      subtitleTag: 'DEDUCTIBLE VALUE PLAN • COPAGOS APLICAN TRAS DEDUCIBLE',
      premium: '',
      deductible: '$1,500',
      moop: '$7,500',
      primaryCare: '$50 (tras deducible)',
      specialist: '$50 (tras deducible)',
      genericRx: '$0 preventivos',
      urgencies: '$50 UC / $250 ER (tras deducible)',
      deductibleWarning: MEDMAX_DEFAULT_WARNING,
      highlights: MEDMAX_OFFICIAL_BULLETS,
      extraBenefit: 'Preventivo y telemedicina 24/7 (RelyMD) a $0 inmediato.',
      clientSummary: 'Plan MedMax con copagos tras cumplir el deducible anual (preventivo y RelyMD $0 inmediato).',
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast('MedMax Agregado', 'Ingresa la prima mensual y selecciona/edita el deducible anual ($750, $1,500, etc.).', 'success');
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

  const addAhw4Plan = () => {
    const newId = 'plan_ahw4_' + Date.now();
    const created: QuotePlan = {
      id: newId,
      tag: 'PLAN DE SALUD AHW 4',
      planCategory: 'ahw4',
      company: 'AHW 4 (Red First Health)',
      planName: 'Plan de Salud AHW 4 (Red First Health)',
      tier: 'Red First Health • Hospital, Farmacia y Prevención',
      subtitleTag: 'RED FIRST HEALTH • HOSPITAL $1,000/DÍA • FARMACIA $0/$5/$40',
      premium: '',
      deductible: '$0',
      moop: 'Tope Hospital $10,000/año • Tope Cirugía $2,000/año',
      primaryCare: 'Cuidado preventivo $0 (red First Health, no hospital)',
      specialist: 'Según red First Health',
      genericRx: '$0 Prev. / $5 Pref. / $40 Marca (30 días)',
      urgencies: 'Emergencia $1,000 / Ambulancia $500',
      highlights: AHW4_OFFICIAL_BULLETS,
      extraBenefit: 'Cuidado preventivo en centros no hospitalarios de la red First Health.',
      clientSummary: 'Plan de Salud AHW 4 con beneficios hospitalarios fijos, farmacia y cuidado preventivo.',
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast('AHW 4 Agregado', 'Beneficios exactos de AHW 4 (First Health) cargados. Ingresa la prima mensual.', 'success');
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
    const zipWarn =
      geoAge.sanitasAvailability === 'verify_zip'
        ? ' ⚠️ Verifica disponibilidad en este ZIP Code.'
        : '';
    onShowToast(
      'Sanitas Care Plus Agregado',
      `${pricing.tierLabel}: $${pricing.monthlyPrice}/mes → 1.er mes $${pricing.firstMonthPrice} (con $40.00 de fee único).${zipWarn}`,
      geoAge.sanitasAvailability === 'verify_zip' ? 'info' : 'success'
    );
  };

  const addHospitalWisePlan = () => {
    const newId = 'plan_hospitalwise_' + Date.now();
    const created: QuotePlan = {
      id: newId,
      tag: 'HOSPITALWISE BUNDLE 1',
      planCategory: 'hospitalwise',
      company: 'Golden Rule Insurance Company',
      planName: 'HospitalWise® Bundle 1',
      tier: 'Indemnización Hospitalaria en Efectivo',
      subtitleTag: 'GOLDEN RULE INSURANCE COMPANY • RESPALDO HOSPITALARIO EN EFECTIVO',
      premium: '',
      hasSanitasFee: false,
      deductible: '$0 (Sin deducible)',
      moop: 'Hospital/UCI $1,000/día (máx. 10 días) • Observación $1,000/día (máx. 4 días/año)',
      primaryCare: '$100/día consultorio (máx. 4 días/año)',
      specialist: '$100/día médico',
      genericRx: 'No aplica',
      urgencies: 'ER $500/día • UC $250/día',
      highlights: HOSPITALWISE_OFFICIAL_BULLETS,
      extraBenefit: 'Beneficios en efectivo por hospitalización, observación, UCI, ER, UC, cirugía y ambulancia.',
      clientSummary: 'HospitalWise Bundle 1 de Golden Rule Insurance Company.',
      isRecommended: false
    };
    setPlans(prev => [...prev, created]);
    setLastAddedPlanId(newId);
    onShowToast(
      'HospitalWise Bundle 1 Agregado',
      'Beneficios oficiales cargados. Ingresa la prima mensual (ej. 25.79 o 110.18).',
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

  const updatePlan = (id: string, field: keyof QuotePlan, value: any) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        let next: QuotePlan = { ...p, [field]: value };

        // Si cambia de categoría en el selector, aplicar ficha oficial exacta
        if (field === 'planCategory') {
          if (value === 'medmax') {
            next = enforceOfficialCatalogOnPlan({ ...next, planCategory: 'medmax', planName: 'Plan MedMax' });
          } else if (value === 'hpg4000') {
            next = enforceOfficialCatalogOnPlan({
              ...next,
              planCategory: 'hpg4000',
              hpgLevel: next.hpgLevel || 'preferred4000',
              planName: HPG_SPECS[next.hpgLevel || 'preferred4000'].title
            });
          } else if (value === 'ahw4') {
            next = enforceOfficialCatalogOnPlan({ ...next, planCategory: 'ahw4', planName: 'Plan de Salud AHW 4 (Red First Health)' });
          } else if (value === 'sanitas') {
            next = enforceOfficialCatalogOnPlan({ ...next, planCategory: 'sanitas', hasSanitasFee: true, enrollmentFee: '40.00' });
          } else if (value === 'hospitalwise') {
            next = enforceOfficialCatalogOnPlan({ ...next, planCategory: 'hospitalwise', hasSanitasFee: false, planName: 'HospitalWise® Bundle 1' });
          } else if (value === 'aca') {
            next = {
              ...next,
              planCategory: 'aca',
              hasSanitasFee: false,
              subtitleTag: 'MERCADO DE SALUD ACA (OBAMACARE)'
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
1. Si identificas un plan del catálogo cerrado (Sanitas Care Plus, Health ProtectorGuard Select 2000, Preferred 4000, Premier 5000, MedMax, AHW 4 o HospitalWise Bundle 1), indica exactamente su categoría en "planCategory" y su nivel exacto en "hpgLevel" ("select2000", "preferred4000" o "premier5000") si es HPG, junto con la prima mensual y el deducible mostrados.
2. Si es un plan ACA (Obamacare), extrae EXACTAMENTE de la captura/PDF: Aseguradora, Nombre exacto del plan, Nivel (Bronce/Plata/Oro), ID del plan ("planIdCode"), Prima con crédito fiscal ("premium"), Ahorro mensual o crédito fiscal ("subsidyAmount"), Deducible anual ("deductible"), Máximo de bolsillo ("moop"), Requisito de referido ("referralRequired"), y desglosa las 4 áreas médicas exactas ("primaryCare", "specialist", "acaLabsImaging", "acaErHospital", "acaRxTiers").

Responde ÚNICAMENTE un array JSON válido con esta estructura:
[
  {
    "company": "Aseguradora",
    "planName": "Nombre exacto del plan",
    "tier": "Nivel (Bronce / Plata / Oro / etc.)",
    "planCategory": "Una de: medmax | hpg4000 | ahw4 | sanitas | hospitalwise | aca | custom",
    "hpgLevel": "Solo si es HPG: select2000 | preferred4000 | premier5000",
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
        const mapped: QuotePlan[] = parsedPlans.map((p, idx) => {
          const combinedName = `${p.company || ''} ${p.planName || ''} ${p.tier || ''}`.toLowerCase();
          const detectedCategory: QuotePlanCategory =
            p.planCategory &&
            ['medmax', 'hpg4000', 'ahw4', 'sanitas', 'hospitalwise', 'aca', 'custom'].includes(p.planCategory)
              ? p.planCategory
              : combinedName.includes('medmax')
                ? 'medmax'
                : combinedName.includes('hospitalwise')
                  ? 'hospitalwise'
                  : combinedName.includes('protectorguard') || /\bhpg\b/.test(combinedName)
                    ? 'hpg4000'
                    : combinedName.includes('ahw')
                      ? 'ahw4'
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

          const basePlan: QuotePlan = {
            id: 'plan_ai_' + Date.now() + '_' + idx,
            tag: idx === 0 ? 'OPCIÓN PRINCIPAL RECOMENDADA' : 'OPCIÓN DE COBERTURA',
            planCategory: detectedCategory,
            hpgLevel: hpgLevelDetected,
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

          // Forzar la ficha cerrada oficial en planes no-ACA (cero mezclas / cero errores)
          return enforceOfficialCatalogOnPlan(basePlan);
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
    const hasHPGOrHW = plans.some(p => isHpgPlan(p) || isHospitalWisePlan(p));
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
        `Espero que se encuentre muy bien. Con mucho gusto le comparto su cotización personalizada de salud para ${quoteYear} (${clientMembers}${agesSegment} • ${clientLocation}) de parte de Agente Contigo.`
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
        `Espero que se encuentre muy bien. Es un gusto compartirle su cotización oficial de cobertura médica a través del Mercado de Salud ACA (Obamacare) para ${quoteYear} (${clientMembers}${agesSegment} • ${clientLocation}) de parte de Agente Contigo.`
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
      } else if (geoAge.sanitasAvailability === 'essential_az_tx') {
        geoNotes.push(
          `✓ Validación geográfica Sanitas Care (${geoAge.detectedState}): Confirmaremos disponibilidad de centro Sanitas en el código postal ${geoAge.zipCode || clientLocation}.`
        );
      } else {
        geoNotes.push(
          `• Nota geográfica Sanitas Care (${clientLocation}): Validaremos el centro médico o cobertura Sanitas activa en su código postal antes de procesar la membresía.`
        );
      }
    }
    if (hasHPGOrHW && geoAge.hpgRestrictedState) {
      geoNotes.push(
        `• Nota estatal (${geoAge.detectedState}): Validaremos disponibilidad y reglas estatales específicas de suscripción para su estado antes de emitir.`
      );
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
      const fee = getPlanSanitasFee(p);
      const firstM = getPlanFirstMonth(p);
      const bullets = getExactOfficialBulletsForPlan(p);

      lines.push(`OPCIÓN ${idx + 1}: ${p.planName} (${p.company})`);
      lines.push(`• Mensualidad Regular: $${formatMoney(reg)}/mes${p.planCategory === 'aca' && p.subsidyAmount ? ` (Crédito fiscal / ahorro mensual: ${p.subsidyAmount})` : ''}`);
      if (fee > 0) {
        lines.push(`• Inversión 1.er Mes: $${formatMoney(firstM)} (incluye +$${formatMoney(fee)} fee único de inscripción de Sanitas Care)`);
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

    if (plans.length > 1 || hasSanitas) {
      lines.push(`--------------------------------------------------`);
      lines.push(`CUADRO RESUMEN DE INVERSIÓN:`);
      if (hasSanitas) {
        lines.push(`• Total 1.er Mes (con +$${formatMoney(totalFirst - totalReg)} fee único de inscripción Sanitas): $${formatMoney(totalFirst)}`);
      }
      lines.push(`• Total Mensual Regular: $${formatMoney(totalReg)}/mes`);
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
    let msg = `Hola ${clientName}, te saluda ${agentName || 'tu asesor'} de Agente Contigo.\n`;
    msg += `Cotización ${quoteYear} para ${clientLocation}${clientAges ? ` (Edades: ${clientAges})` : ''}:\n\n`;

    plans.forEach((plan, i) => {
      const fee = getPlanSanitasFee(plan);
      const firstM = getPlanFirstMonth(plan);
      msg += `Opción ${i + 1}: ${plan.planName}\n`;
      msg += `• Mensualidad: $${formatMoney(parseMoney(plan.premium))}/mes`;
      if (fee > 0) msg += ` (1.er mes: $${formatMoney(firstM)} con fee Sanitas $${formatMoney(fee)})`;
      msg += `\n`;
      msg += `• Deducible: ${plan.deductible} | Máx. Bolsillo: ${plan.moop || 'N/A'}\n`;
      if (isMedMaxPlan(plan)) {
        msg += `• Importante: Copagos aplican tras cumplir el deducible anual (preventivo y telemedicina $0).\n`;
      }
      msg += `\n`;
    });

    const total = plans.reduce((acc, p) => acc + parseMoney(p.premium), 0);
    const totalFirst = plans.reduce((acc, p) => acc + getPlanFirstMonth(p), 0);
    if (plans.length > 1 || totalFirst > total) {
      if (totalFirst > total) msg += `Total 1.er mes: $${formatMoney(totalFirst)}\n`;
      msg += `Mensualidad regular: $${formatMoney(total)}/mes\n\n`;
    }

    msg += `Te envié el PDF oficial con todo el detalle y cuadro comparativo. ¿Cuál opción revisamos hoy?`;
    navigator.clipboard.writeText(msg);
    onShowToast('¡SMS Copiado!', 'Mensaje resumido listo para enviar.', 'success');
  };

  // WhatsApp Message Generator (sin repeticiones, datos exactos)
  const copyWhatsAppMessage = () => {
    let msg = `🏥 *COTIZACIÓN OFICIAL DE SALUD ${quoteYear} — AGENTE CONTIGO*\n`;
    msg += `👋 ¡Hola ${clientName}! Te comparto tus opciones para ${clientMembers}${clientAges ? ` (Edades: ${clientAges})` : ''} en ${clientLocation}:\n\n`;

    plans.forEach((plan, i) => {
      const fee = getPlanSanitasFee(plan);
      const firstM = getPlanFirstMonth(plan);
      const bullets = getExactOfficialBulletsForPlan(plan);
      msg += `📌 *OPCIÓN ${i + 1}: ${plan.planName}*\n`;
      msg += `• 💰 *Mensualidad Regular:* $${formatMoney(parseMoney(plan.premium))}/mes\n`;
      if (fee > 0) {
        msg += `• 🧾 *1.er Mes (incluye fee único Sanitas +$${formatMoney(fee)}):* $${formatMoney(firstM)}\n`;
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

    const total = plans.reduce((acc, p) => acc + parseMoney(p.premium), 0);
    const totalFirst = plans.reduce((acc, p) => acc + getPlanFirstMonth(p), 0);
    if (plans.length > 1 || totalFirst > total) {
      if (totalFirst > total) msg += `🧾 *Total 1.er Mes:* $${formatMoney(totalFirst)}\n`;
      msg += `💵 *Total Mensual Regular:* $${formatMoney(total)}/mes\n\n`;
    }

    msg += `📲 ¿Cuál de estas opciones te gustaría revisar o activar hoy?`;
    navigator.clipboard.writeText(msg);
    onShowToast('¡WhatsApp Copiado!', 'Propuesta exacta lista para pegar en WhatsApp.', 'success');
  };

  // Save Quote to Supabase and Local (INTACTO: mismas columnas y variables Supabase)
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

  const totalMonthly = plans.reduce((acc, p) => acc + (parseFloat(p.premium) || 0), 0);
  const totalSanitasFee = plans.reduce((acc, p) => acc + getPlanSanitasFee(p), 0);
  const totalFirstMonth = totalMonthly + totalSanitasFee;

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
              Propuesta de Protección Médica Familiar • Período {quoteYear}
            </p>
          </div>
        </div>

        {/* Barra Resumen Titular / Grupo Familiar / Edades / ZIP / Asesoría */}
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

      {/* Opciones Ejecutivas (SIN REPETICIONES) */}
      <div className="p-6 sm:p-8 space-y-5">
        {plans.map((plan, idx) => {
          const regularMonthly = parseMoney(plan.premium);
          const sanitasFee = getPlanSanitasFee(plan);
          const firstMonth = regularMonthly + sanitasFee;
          const isMedMax = isMedMaxPlan(plan);
          const bullets = getExactOfficialBulletsForPlan(plan);

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-5 space-y-3 print-avoid-break ${
                plan.isRecommended
                  ? 'border-[#00a396] ring-1 ring-[#00c9b7]/40 bg-white shadow-sm'
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
                      1.er mes: ${formatMoney(firstMonth)} (incluye +${formatMoney(sanitasFee)} fee único de inscripción)
                    </span>
                  ) : plan.planCategory === 'aca' && plan.subsidyAmount ? (
                    <span className="text-[11px] font-bold text-emerald-700 block mt-1">
                      Prima con crédito fiscal (Ahorro: {plan.subsidyAmount})
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-500 block mt-1">
                      Prima mensual ({clientMembers})
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
        <div className="pt-2 print-avoid-break">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2.5">
            CUADRO COMPARATIVO DE INVERSIÓN ({clientMembers.toUpperCase()})
          </h3>
          <div className="overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800">
                  <th className="py-2.5 px-3 font-black">Alternativa de Cobertura</th>
                  <th className="py-2.5 px-3 font-black">Deducible y Máximo de Bolsillo</th>
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
                        Opción {idx + 1}: {plan.planName}
                        <span className="block text-[10px] font-semibold text-slate-500">{plan.company}</span>
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
          Cotización elaborada para {clientName} ({clientMembers}
          {clientAges ? ` • Edades: ${clientAges}` : ''} • {clientLocation}). Las coberturas y montos corresponden a la
          ficha oficial de cada plan y están sujetos a elegibilidad geográfica y condiciones de suscripción vigentes.
        </div>
      </div>

      {/* Footer Oficial */}
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
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
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
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
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
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

              {/* Validación Geográfica en Tiempo Real */}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
              {/* 1. + MedMax */}
              <button
                type="button"
                onClick={addMedMaxPlan}
                className="p-3 rounded-2xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 text-left transition shadow-xs cursor-pointer flex flex-col justify-between gap-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-xs">+ MedMax</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </div>
                <span className="text-[10px] font-bold opacity-85">Copagos tras Deducible</span>
              </button>

              {/* 2. + HPG (2000/4000/5000) con selector exacto de nivel */}
              <div className="p-2.5 rounded-2xl border border-sky-300 bg-sky-50/70 text-sky-950 flex flex-col justify-between gap-1.5 shadow-xs">
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

              {/* 3. + AHW 4 */}
              <button
                type="button"
                onClick={addAhw4Plan}
                className="p-3 rounded-2xl border border-indigo-300 bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-950 text-left transition shadow-xs cursor-pointer flex flex-col justify-between gap-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-xs">+ AHW 4</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </div>
                <span className="text-[10px] font-bold opacity-85">Red First Health</span>
              </button>

              {/* 4. + Sanitas Care */}
              <button
                type="button"
                onClick={addSanitasCarePlan}
                className="p-3 rounded-2xl border border-teal-300 bg-teal-50/80 hover:bg-teal-100/80 text-teal-950 text-left transition shadow-xs cursor-pointer flex flex-col justify-between gap-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-xs">+ Sanitas Care</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </div>
                <span className="text-[10px] font-bold opacity-85">+$40 Fee 1.er Mes Auto</span>
              </button>

              {/* 5. + HospitalWise Bundle 1 */}
              <button
                type="button"
                onClick={addHospitalWisePlan}
                className="p-3 rounded-2xl border border-cyan-300 bg-cyan-50/80 hover:bg-cyan-100/80 text-cyan-950 text-left transition shadow-xs cursor-pointer flex flex-col justify-between gap-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-xs">+ HospitalWise Bundle 1</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </div>
                <span className="text-[10px] font-bold opacity-85">Golden Rule • Efectivo Hospital</span>
              </button>

              {/* 6. + Plan ACA (Obamacare) */}
              <button
                type="button"
                onClick={addAcaPlan}
                className="p-3 rounded-2xl border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950 text-left transition shadow-xs cursor-pointer flex flex-col justify-between gap-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-xs">+ Plan ACA (Obamacare)</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </div>
                <span className="text-[10px] font-bold opacity-85">Con Subsidio + Día 1</span>
              </button>
            </div>
          </div>

          {/* Panel 3: Editor de Planes */}
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
                  const firstMonthVal = getPlanFirstMonth(plan);
                  const isMedMax = isMedMaxPlan(plan);
                  const isHpg = isHpgPlan(plan);
                  const isSanitas = isSanitasPlan(plan) && !isHospitalWisePlan(plan);
                  const isHospitalWise = isHospitalWisePlan(plan);
                  const currentHpgLevel: HpgPlanLevel =
                    plan.hpgLevel || detectHpgLevelFromText(`${plan.planName} ${plan.tier}`);

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
                            <option value="medmax">MedMax (Ficha Oficial)</option>
                            <option value="hpg4000">HPG 2000/4000/5000</option>
                            <option value="ahw4">AHW 4 (First Health)</option>
                            <option value="sanitas">Sanitas Care Plus</option>
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
                              {isMedMax ? 'Deducible Anual MedMax *' : 'Deducible Anual'}
                            </label>
                            {isMedMax && (
                              <div className="flex gap-1">
                                {['$750', '$1,500', '$3,000'].map(d => (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => updatePlan(plan.id, 'deductible', d)}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-black border cursor-pointer ${
                                      plan.deductible === d
                                        ? 'bg-amber-600 text-white border-amber-700'
                                        : 'bg-white text-amber-900 border-amber-200'
                                    }`}
                                  >
                                    {d}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            value={plan.deductible}
                            onChange={e => updatePlan(plan.id, 'deductible', e.target.value)}
                            className={`w-full px-2.5 py-1.5 text-xs bg-white rounded-lg font-bold ${
                              isMedMax ? 'border-2 border-amber-400 text-amber-950' : 'border border-slate-200'
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

                      {/* Ajuste Rápido Sanitas Care Plus + Checkbox Fee $40 */}
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
                        </div>
                      )}

                      {/* Toggle Fee Sanitas + Resumen 1.er Mes */}
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
                              1.er Mes Total: ${formatMoney(firstMonthVal)}
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
                  Documento ejecutivo para <strong className="text-[#008be3]">{clientName}</strong> sin mezclas ni repeticiones.
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
              Para analizar capturas de cotizaciones y extraer automáticamente planes ACA, HPG, MedMax, AHW 4, Sanitas o HospitalWise, conecta tu API Key de Gemini.
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
