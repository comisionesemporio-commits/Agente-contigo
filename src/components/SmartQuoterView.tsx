import React, { useState, useEffect } from 'react';
import { QuotePlan, SavedQuote } from '../types';
import {
  Sparkles, Upload, Copy, Printer, Save, CheckCircle2,
  AlertCircle, Search, Plus, Trash2, Globe, FileText,
  DollarSign, Shield, HeartPulse, Building, User, Key,
  ChevronDown, ExternalLink, RefreshCw
} from 'lucide-react';
import {
  getGeminiApiKey, setGeminiApiKey, loadQuotes, saveQuotes
} from '../services/storage';
import { initSupabase } from '../services/supabase';

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
  const [clientMembers, setClientMembers] = useState('3 Personas');
  const [quoteYear, setQuoteYear] = useState('2027');
  const [agentName, setAgentName] = useState(() => currentSeller || 'Equipo Agente Contigo');

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
    }
  ]);

  // Saved Quotes
  const [savedQuotesList, setSavedQuotesList] = useState<SavedQuote[]>(loadQuotes);

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
    const validImages = files.filter(f => f.type.startsWith('image/'));
    if (validImages.length === 0) {
      onShowToast('Formato Incorrecto', 'Por favor sube solo imágenes (PNG, JPG, JPEG).', 'error');
      return;
    }

    validImages.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        setUploadedFiles(prev => [
          ...prev,
          { name: file.name, dataUrl, base64, mimeType: file.type }
        ]);
      };
      reader.readAsDataURL(file);
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
    const newPlan: QuotePlan = {
      id: 'plan_' + Date.now(),
      tag: 'OPCIÓN ADICIONAL',
      company: 'Nueva Aseguradora',
      planName: 'Silver Standard / Bronze',
      tier: 'Plata / CSR',
      premium: '0.00',
      deductible: '$0',
      moop: '$1,500',
      primaryCare: '$0',
      specialist: '$20',
      genericRx: '$3',
      urgencies: '$35',
      extraBenefit: 'Incluye exámenes preventivos al 100%',
      clientSummary: 'No pagas nada al mes y tus visitas médicas regulares están 100% cubiertas.',
      isRecommended: plans.length === 0
    };
    setPlans(prev => [...prev, newPlan]);
    onShowToast('Plan Agregado', 'Puedes editar los valores y copagos directamente.', 'info');
  };

  const deletePlan = (id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const updatePlan = (id: string, field: keyof QuotePlan, value: any) => {
    setPlans(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  // AI OCR / Extraction
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
    setAiStatusText('Enviando imágenes a Gemini 3.8 Flash...');

    try {
      // Direct client call to Gemini 3.8 Flash using the official API endpoint
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${keyToUse}`;

      const promptText = `Eres el asistente experto de 'Agente Contigo', una agencia de seguros de salud (Obamacare, UnitedHealthcare, ManhattanLife, Florida Blue, Ambetter, Oscar, Cigna, etc.).
Analiza cuidadosamente las imágenes adjuntas, que son capturas de pantalla de cotizaciones de seguros de salud.
Extrae cada plan de seguro que aparezca en las capturas con sus valores exactos.
Responde ÚNICAMENTE un array JSON válido con la siguiente estructura (sin texto antes ni después):
[
  {
    "company": "Nombre de la aseguradora (ej: UnitedHealthcare, ManhattanLife, Florida Blue, Ambetter, Oscar)",
    "planName": "Nombre completo del plan (ej: Silver Value Copay, Bronze Essential, etc.)",
    "tier": "Categoría o Metal (ej: Plata CSR, Bronce, Póliza Complementaria, Dental)",
    "premium": "Monto de la prima mensual en dólares (solo el número con decimales, ej: '0.00' o '45.20')",
    "deductible": "Deducible individual (ej: '$0' o '$1,500')",
    "moop": "Máximo de desembolso de bolsillo (MOOP) (ej: '$1,500')",
    "primaryCare": "Copago médico primario (ej: '$0' o '$10')",
    "specialist": "Copago especialista (ej: '$15' o '$30')",
    "genericRx": "Copago medicinas genéricas (ej: '$3' o '$0')",
    "urgencies": "Copago salas de urgencias / Urgent Care (ej: '$25' o '20%')",
    "extraBenefit": "Beneficios clave como dental, visión, recompensas o telemedicina",
    "clientSummary": "Explicación sencilla y amigable de 1 o 2 oraciones para el cliente sobre qué cubre y por qué le conviene.",
    "isRecommended": true
  }
]`;

      const parts: any[] = [{ text: promptText }];
      uploadedFiles.forEach(f => {
        parts.push({
          inlineData: {
            mimeType: f.mimeType || 'image/jpeg',
            data: f.base64
          }
        });
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Error HTTP ${response.status}`);
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('No se recibió texto estructurado de la IA.');

      const parsedPlans = JSON.parse(rawText);

      if (Array.isArray(parsedPlans) && parsedPlans.length > 0) {
        // Optional: web search grounding for benefits
        if (enableWebSearch) {
          setAiStatusText('🌐 Consultando internet para verificar beneficios oficiales...');
          for (let i = 0; i < parsedPlans.length; i++) {
            const p = parsedPlans[i];
            try {
              const searchPrompt = `Busca en internet información oficial y resumida de la póliza de seguro '${p.company} ${p.planName}'. Resume en 1 sola oración sus beneficios más atractivos.`;
              const searchRes = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: searchPrompt }] }],
                  tools: [{ google_search: {} }]
                })
              });
              if (searchRes.ok) {
                const searchData = await searchRes.json();
                const benefit = searchData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (benefit && benefit.length > 15) {
                  p.extraBenefit = benefit.replace(/[\n\r]+/g, ' ').trim();
                }
              }
            } catch (e) {
              console.warn('Google grounding notice:', e);
            }
          }
        }

        const mapped: QuotePlan[] = parsedPlans.map((p, idx) => ({
          id: 'plan_ai_' + Date.now() + '_' + idx,
          tag: idx === 0 ? 'OPCIÓN PRINCIPAL RECOMENDADA' : 'PLAN ADICIONAL / COMPLEMENTO',
          company: p.company || 'Aseguradora',
          planName: p.planName || 'Plan Médico',
          tier: p.tier || 'Estándar',
          premium: String(p.premium || '0.00').replace('$', '').trim(),
          deductible: p.deductible || '$0',
          moop: p.moop || '$0',
          primaryCare: p.primaryCare || '$0',
          specialist: p.specialist || '$0',
          genericRx: p.genericRx || '$0',
          urgencies: p.urgencies || '$0',
          extraBenefit: p.extraBenefit || 'Cobertura integral según términos oficiales',
          clientSummary: p.clientSummary || 'Plan seleccionado para tu tranquilidad y cobertura médica.',
          isRecommended: idx === 0
        }));

        setPlans(mapped);
        onShowToast('¡Extracción Exitosa!', `Se identificaron ${mapped.length} planes médicos con IA.`, 'success');
      } else {
        onShowToast('Aviso', 'No se pudieron extraer planes claros de la imagen.', 'info');
      }
    } catch (err: any) {
      console.error(err);
      onShowToast('Error al Procesar', err.message || 'Error al conectar con Gemini.', 'error');
    } finally {
      setIsAnalyzingAI(false);
      setAiStatusText('✓ Procesamiento finalizado');
    }
  };

  // AI Summary Generator for a plan
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
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${keyToUse}`;
      const prompt = `Actúa como un asesor estrella de seguros de 'Agente Contigo'. Escribe una explicación muy corta (máximo 1 o 2 oraciones, menos de 35 palabras) para ${clientName} sobre el plan '${plan.company} - ${plan.planName}'.
Datos clave del plan: Prima: $${plan.premium}/mes, Deducible: ${plan.deductible}, Médico Primario: ${plan.primaryCare}, Extra: ${plan.extraBenefit}.
Haz que suene claro, tranquilizador y amigable, explicando en palabras sencillas el beneficio principal sin términos complicados.`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const clean = text.replace(/[\n\r]+/g, ' ').replace(/^["']|["']$/g, '').trim();
          updatePlan(planId, 'clientSummary', clean);
          onShowToast('¡Listo!', 'Explicación sencilla redactada con IA.', 'success');
        }
      }
    } catch (e: any) {
      onShowToast('Error', 'No se pudo generar la explicación.', 'error');
    }
  };

  // Web search grounding for a single plan
  const searchPlanBenefitsOnline = async (planId: string) => {
    const keyToUse = geminiApiKey.trim();
    if (!keyToUse) {
      setShowApiKeyModal(true);
      return;
    }

    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    onShowToast('Buscando en Google...', `Buscando folleto de ${plan.company} en internet...`, 'info');

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${keyToUse}`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Busca en internet los beneficios oficiales de la póliza '${plan.company} ${plan.planName}'. Extrae en una sola oración concisa qué cubre (por ejemplo: pagos por día de hospital, cirugías, deducible de ambulancia, red médica o dinero directo).` }] }],
          tools: [{ google_search: {} }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const benefit = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (benefit) {
          const clean = benefit.replace(/[\n\r]+/g, ' ').trim();
          updatePlan(planId, 'extraBenefit', clean);
          onShowToast('¡Folleto Encontrado!', 'Beneficios verificados con Google Search.', 'success');
        }
      }
    } catch (e) {
      onShowToast('Aviso', 'No se pudo completar la búsqueda en este momento.', 'error');
    }
  };

  // WhatsApp Message Generator
  const copyWhatsAppMessage = () => {
    let msg = `🏥 *COTIZACIÓN DE SEGURO MÉDICO ${quoteYear}*\n`;
    msg += `👋 ¡Hola ${clientName}! Un gusto saludarte de parte de *Agente Contigo*.\n\n`;
    msg += `Te comparto el resumen de las mejores opciones que seleccionamos para ti en ${clientLocation} (${clientMembers}):\n\n`;

    plans.forEach((plan, i) => {
      msg += `📌 *OPCIÓN ${i + 1}: ${plan.company} - ${plan.planName}*\n`;
      msg += `   • 💰 *Prima Mensual:* $${plan.premium}/mes\n`;
      msg += `   • 🛡️ *Deducible:* ${plan.deductible}\n`;
      msg += `   • 🩺 *Médico Primario:* ${plan.primaryCare}\n`;
      msg += `   • 👨‍⚕️ *Especialista:* ${plan.specialist}\n`;
      msg += `   • 💊 *Medicinas:* ${plan.genericRx}\n`;
      if (plan.clientSummary) {
        msg += `   • 💡 *En palabras simples:* ${plan.clientSummary}\n`;
      }
      msg += `   • 🎁 *Beneficio extra:* ${plan.extraBenefit}\n\n`;
    });

    const total = plans.reduce((acc, p) => acc + (parseFloat(p.premium) || 0), 0);
    if (plans.length > 1) {
      msg += `💵 *Total Mensual Combinado:* $${total.toFixed(2)}/mes\n\n`;
    }

    msg += `✨ *¿Por qué con Agente Contigo?*\n`;
    msg += `✔ Tu asesoría y trámite son 100% GRATUITOS.\n`;
    msg += `✔ Te verificamos tus médicos y medicinas en la red.\n`;
    msg += `✔ Asistencia continua durante todo el año.\n\n`;
    msg += `📲 ¿Cuál de estas opciones te gustaría que dejemos activa hoy mismo?`;

    navigator.clipboard.writeText(msg);
    onShowToast('¡Mensaje Copiado!', 'Texto persuasivo listo para pegar en WhatsApp.', 'success');
  };

  // Save Quote to Supabase and Local
  const handleSaveQuote = async () => {
    const total = plans.reduce((acc, p) => acc + (parseFloat(p.premium) || 0), 0);
    const newQuote: SavedQuote = {
      id: 'quote-' + Date.now(),
      clientName,
      location: clientLocation,
      members: clientMembers,
      year: quoteYear,
      agentName,
      plans,
      totalMonthlyPremium: total,
      createdAt: new Date().toLocaleDateString()
    };

    const updated = [newQuote, ...savedQuotesList];
    setSavedQuotesList(updated);
    saveQuotes(updated);

    // Save to Supabase table cotizaciones if configured
    const sb = initSupabase();
    if (sb) {
      try {
        await sb.from('cotizaciones').upsert([{
          id: newQuote.id,
          cliente_nombre: newQuote.clientName,
          ubicacion: newQuote.location,
          miembros: newQuote.members,
          anio: newQuote.year,
          agente: newQuote.agentName,
          planes: newQuote.plans,
          total_mensual: newQuote.totalMonthlyPremium
        }]);
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
    setQuoteYear(q.year);
    setAgentName(q.agentName);
    setPlans(q.plans);
    onShowToast('Cotización Cargada', `Se cargó la propuesta de ${q.clientName}.`, 'info');
  };

  const totalMonthly = plans.reduce((acc, p) => acc + (parseFloat(p.premium) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Fast Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-teal-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full text-[10px] font-black uppercase tracking-wider inline-block mb-2">
            Módulo Oficial de Cotización
          </span>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-400" />
            Cotizador Inteligente Multicompañía con IA
          </h2>
          <p className="text-xs text-teal-200/80 mt-1">
            Genera propuestas oficiales, sube capturas para leer con IA y conecta con Google Search.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* AI Connection Status button */}
          <button
            type="button"
            onClick={() => setShowApiKeyModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700 flex items-center gap-2 shadow cursor-pointer"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                geminiApiKey ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            ></span>
            <span className="font-bold">
              {geminiApiKey ? 'IA Conectada' : 'Configurar Conexión IA'}
            </span>
          </button>

          <button
            type="button"
            onClick={copyWhatsAppMessage}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar para WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 no-print">
        {/* Panel 1: Datos del Prospecto */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-7 h-7 rounded-xl bg-cyan-100/70 text-[#00c9b7] flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Datos del Prospecto</h2>
              <p className="text-[11px] text-slate-500">Aparecerán en la propuesta final</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold uppercase text-slate-600 mb-1">Nombre Completo</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Ej. Familia Ramírez / Carlos Mendoza"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">Estado / Zip</label>
                <input
                  type="text"
                  value={clientLocation}
                  onChange={e => setClientLocation(e.target.value)}
                  placeholder="Ej. Florida (33166)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00c9b7] outline-none font-medium text-xs"
                />
              </div>
              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">Miembros</label>
                <input
                  type="text"
                  value={clientMembers}
                  onChange={e => setClientMembers(e.target.value)}
                  placeholder="Ej. 3 Personas"
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

          <div className="bg-cyan-50/60 p-3 rounded-2xl border border-cyan-100 text-[11px] text-slate-600 leading-relaxed">
            <strong className="text-[#008be3] font-bold">Consejo de Agente:</strong> Sube una o varias capturas de las compañías (Obamacare, United, Manhattan, etc.) y nuestro motor IA completará la propuesta automáticamente.
          </div>
        </div>

        {/* Panel 2: Subida Inteligente & Visión IA */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-100/70 text-[#008be3] flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Subir Capturas de los Cotizadores
                </h2>
                <p className="text-[11px] text-slate-500">
                  Arrastra o pega (<kbd className="px-1 py-0.5 bg-slate-100 border rounded font-mono">Ctrl + V</kbd>) capturas de los planes
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
              accept="image/*"
              multiple
              onChange={e => e.target.files && processIncomingFiles(Array.from(e.target.files))}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-cyan-100/80 flex items-center justify-center text-[#00c9b7]">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-800">
                Haz clic para subir o arrastra tus capturas aquí
              </p>
              <p className="text-[11px] text-slate-400">
                💡 Puedes tomar captura (<kbd className="px-1 bg-slate-200 rounded">Win+Shift+S</kbd> o <kbd className="px-1 bg-slate-200 rounded">Cmd+Shift+4</kbd>) y presionar <kbd className="px-1 bg-slate-200 rounded font-bold">Ctrl + V</kbd> para pegarla al instante.
              </p>
            </div>
          </div>

          {/* Thumbnails */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 shrink-0">
                  <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs opacity-90 hover:opacity-100 shadow transition cursor-pointer"
                    title="Remover imagen"
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
              Busca en la web folletos oficiales de planes como ManhattanLife, UHC, etc., para completar beneficios.
            </span>
          </div>

          {/* AI Trigger */}
          <div className="flex items-center justify-between pt-2 text-xs">
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

      {/* Panel 3: Planes a Presentar al Cliente Editor */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 no-print">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00c9b7]"></span>
            Planes a Presentar al Cliente ({plans.length})
          </h3>
          <p className="text-xs text-slate-400">Puedes editar cualquier número o texto en vivo</p>
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No hay planes agregados aún. Sube una captura o haz clic en "+ Agregar Plan Manual".
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan, index) => (
              <div
                key={plan.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#00c9b7] text-white flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={plan.company}
                      onChange={e => updatePlan(plan.id, 'company', e.target.value)}
                      placeholder="Compañía (ej. UnitedHealthcare)"
                      className="font-black text-slate-900 text-xs sm:text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#008be3] outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
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
                      className="text-slate-400 hover:text-red-500 p-1 text-xs transition"
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
                    <label className="block text-[10px] font-bold uppercase text-slate-500">Prima Mensual ($/mes)</label>
                    <input
                      type="text"
                      value={plan.premium}
                      onChange={e => updatePlan(plan.id, 'premium', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#00c9b7] outline-none font-bold text-[#008be3]"
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

                {/* Copay & Deductibles row */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400">Deducible</label>
                    <input
                      type="text"
                      value={plan.deductible}
                      onChange={e => updatePlan(plan.id, 'deductible', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400">Máx. Bolsillo</label>
                    <input
                      type="text"
                      value={plan.moop}
                      onChange={e => updatePlan(plan.id, 'moop', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400">Dr. Primario</label>
                    <input
                      type="text"
                      value={plan.primaryCare}
                      onChange={e => updatePlan(plan.id, 'primaryCare', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400">Especialista</label>
                    <input
                      type="text"
                      value={plan.specialist}
                      onChange={e => updatePlan(plan.id, 'specialist', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400">Med. Genérica</label>
                    <input
                      type="text"
                      value={plan.genericRx}
                      onChange={e => updatePlan(plan.id, 'genericRx', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400">Urgencias</label>
                    <input
                      type="text"
                      value={plan.urgencies}
                      onChange={e => updatePlan(plan.id, 'urgencies', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>
                </div>

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
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Beneficio Adicional o Coberturas Clave</label>
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
            ))}
          </div>
        )}
      </div>

      {/* Panel 4: PROPUESTA PERSONALIZADA IMPRIMIBLE (FLYER) */}
      <div id="printableProposal" className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border-none">
        {/* Header con Logo y Título */}
        <div className="pt-8 pb-6 px-4 sm:px-8 text-center relative overflow-hidden bg-gradient-to-b from-cyan-50/50 via-white to-white border-b border-slate-100">
          <div className="flex items-center justify-center gap-3 mb-3">
            <svg className="w-12 h-12" viewBox="0 0 100 100" fill="none">
              <circle cx="58" cy="27" r="13" fill="#008be3" />
              <circle cx="43" cy="33" r="10" fill="#00c9b7" />
              <path d="M42 42C29 44 24 55 24 67C24 81 37 90 53 90C67 90 77 82 77 69C77 56 69 49 61 47C56 52 50 56 42 42Z" fill="#00c9b7" fillOpacity="0.85" />
              <path d="M53 45C63 46 72 52 74 65C70 76 60 83 48 83C36 83 31 75 31 69C31 60 41 51 53 45Z" fill="#008be3" />
            </svg>
            <div className="text-left leading-none">
              <span className="text-3xl font-black tracking-tight text-[#00c9b7]">
                Agente<span className="text-[#008be3]">Contigo</span>
              </span>
            </div>
          </div>

          <div className="inline-block bg-gradient-to-r from-[#00c9b7] to-[#008be3] text-white px-8 sm:px-12 py-2.5 rounded-2xl shadow-sm mb-2">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
              PROPUESTA PERSONALIZADA DE SEGURO MÉDICO
            </h1>
          </div>

          <p className="text-xs sm:text-sm font-bold text-slate-600 mt-1">
            Cobertura y Beneficios Seleccionados • Período <span className="text-[#008be3]">{quoteYear}</span>
          </p>

          {/* Ficha Resumen del Cliente */}
          <div className="max-w-3xl mx-auto mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 text-left text-xs">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Cliente</span>
              <span className="font-black text-slate-800 text-sm truncate block">{clientName}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Ubicación</span>
              <span className="font-bold text-slate-700 block truncate">{clientLocation}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Integrantes</span>
              <span className="font-bold text-slate-700 block">{clientMembers}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Asesor de Confianza</span>
              <span className="font-bold text-[#008be3] block truncate">{agentName}</span>
            </div>
          </div>
        </div>

        {/* Tarjetas Comparativas de Planes */}
        <div className="p-4 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map((plan, idx) => (
              <div
                key={plan.id}
                className={`relative rounded-3xl border overflow-hidden flex flex-col justify-between transition-all ${
                  plan.isRecommended
                    ? 'border-[#00c9b7] ring-2 ring-[#00c9b7]/30 shadow-lg bg-white'
                    : 'border-slate-200 shadow-sm bg-white'
                }`}
              >
                {/* Tag Superior */}
                <div
                  className={`py-2 px-4 text-[11px] font-black tracking-wider uppercase flex items-center justify-between ${
                    plan.isRecommended
                      ? 'bg-gradient-to-r from-[#00c9b7] to-[#008be3] text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>{plan.isRecommended ? '★ OPCIÓN RECOMENDADA' : 'OPCIÓN DE COBERTURA'}</span>
                  <span className="text-[10px] opacity-90">{plan.tier}</span>
                </div>

                {/* Contenido */}
                <div className="p-5 flex-1 space-y-4 text-xs">
                  <div>
                    <span className="text-xs font-black uppercase text-[#008be3] tracking-wide block">
                      {plan.company}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                      {plan.planName}
                    </h3>
                  </div>

                  {/* Prima Mensual */}
                  <div className="p-3.5 rounded-2xl bg-cyan-50/50 border border-cyan-100/80 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-600">Prima Mensual:</span>
                    <div className="text-right">
                      <span className="text-2xl font-black text-[#008be3]">${plan.premium}</span>
                      <span className="text-[11px] font-bold text-slate-500">/mes</span>
                    </div>
                  </div>

                  {/* Tabla de Costos y Copagos */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Deducible Anual:</span>
                      <span className="font-extrabold text-slate-900">{plan.deductible}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Máx. Desembolso (MOOP):</span>
                      <span className="font-extrabold text-slate-900">{plan.moop}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Médico Primario (PCP):</span>
                      <span className="font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                        {plan.primaryCare}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Médico Especialista:</span>
                      <span className="font-extrabold text-slate-900">{plan.specialist}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Medicinas Genéricas:</span>
                      <span className="font-extrabold text-slate-900">{plan.genericRx}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-medium">Salas de Urgencias:</span>
                      <span className="font-extrabold text-slate-900">{plan.urgencies}</span>
                    </div>
                  </div>

                  {/* Explicación Sencilla */}
                  {plan.clientSummary && (
                    <div className="p-3 rounded-2xl bg-cyan-50/70 border border-cyan-100/90 text-[11px] text-slate-700 leading-snug">
                      <div className="flex items-center gap-1 text-[#008be3] font-extrabold mb-1 uppercase tracking-wider text-[10px]">
                        <span>💡</span> ¿En qué te beneficia este plan?
                      </div>
                      <p className="font-medium">{plan.clientSummary}</p>
                    </div>
                  )}

                  {/* Beneficio Extra */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-1.5">
                    <span className="text-[#00c9b7] font-bold">✓</span>
                    <span>{plan.extraBenefit}</span>
                  </div>
                </div>

                <div className="py-2.5 px-4 bg-slate-50/80 border-t border-slate-100 text-center">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Póliza Oficial Regulada
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen Mensual Combinado */}
          <div className="mt-8 p-5 rounded-2xl bg-gradient-to-r from-teal-50 to-sky-50 border border-[#00c9b7]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#00c9b7] to-[#008be3] text-white flex items-center justify-center font-black">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Total Mensual Estimado de la Cobertura</h4>
                <p className="text-xs text-slate-500">Incluye los planes seleccionados con subsidios y beneficios aplicados</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase font-extrabold text-slate-400 block">Inversión Mensual</span>
              <span className="text-2xl sm:text-3xl font-black text-[#008be3] tabular-nums">
                ${totalMonthly.toFixed(2)} <span className="text-xs text-slate-500">/mes</span>
              </span>
            </div>
          </div>

          {/* Beneficios de Marca Agente Contigo */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-teal-100 text-[#00c9b7] flex items-center justify-center font-bold shrink-0">
                ✦
              </div>
              <div>
                <strong className="text-slate-800 block font-bold">Asesoría 100% Gratuita</strong>
                <p className="text-slate-500 text-[11px]">Te acompañamos en reclamos, cartas y renovaciones sin costo.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-sky-100 text-[#008be3] flex items-center justify-center font-bold shrink-0">
                ✦
              </div>
              <div>
                <strong className="text-slate-800 block font-bold">Red de Médicos Verificada</strong>
                <p className="text-slate-500 text-[11px]">Validamos tus doctores y clínicas antes de activar la póliza.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                ✦
              </div>
              <div>
                <strong className="text-slate-800 block font-bold">Gestión de Documentos</strong>
                <p className="text-slate-500 text-[11px]">Subimos tus comprobantes al Marketplace para evitar cancelaciones.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="py-3 px-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span className="font-bold text-[#008be3]">Agente Contigo • Juntos Cuidamos Tu Bienestar</span>
          <span className="text-[11px] text-slate-400">
            Cotización sujeta a verificación de ingresos y elegibilidad oficial del Mercado.
          </span>
        </div>
      </div>

      {/* Historial de Cotizaciones Guardadas */}
      {savedQuotesList.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3 no-print">
          <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            Historial de Cotizaciones Guardadas ({savedQuotesList.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {savedQuotesList.map(q => (
              <div
                key={q.id}
                onClick={() => loadSavedQuote(q)}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-slate-50/60 transition cursor-pointer space-y-1.5"
              >
                <div className="flex justify-between items-center font-bold text-slate-900">
                  <span className="truncate">{q.clientName}</span>
                  <span className="font-mono text-emerald-700">${q.totalMonthlyPremium.toFixed(2)}/mes</span>
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between">
                  <span>{q.location} · {q.members}</span>
                  <span>{q.year}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {q.plans.length} planes · Asesor: {q.agentName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal API Key Gemini */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                1. Entra a <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[#008be3] underline font-bold">Google AI Studio (haz clic aquí)</a> con tu cuenta de Google.
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
    </div>
  );
};
