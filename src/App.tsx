import React, { useState, useEffect, useMemo } from 'react';
import {
  ClientPolicy, Agent, DailyTask, Role, ToastMessage, CommissionItem, CalendarEvent, CarrierConfig
} from './types';
import {
  MONTHS_LIST, DEFAULT_SELLERS, DEFAULT_CARRIERS, DEFAULT_STATUSES,
  loadClients, saveClients, sanitizeClients, loadTasks, saveTasks, loadAgents, saveAgents,
  loadCalendarEvents, saveCalendarEvents, formatToUSDate, calculateAgeFromDBO,
  getCurrentFormattedDateAndYear,
  loadCarrierConfigs, saveCarrierConfigs, autoRegisterCarriersFromClients, autoRegisterSingleCarrier,
  setSellerCustomPass, removeSellerCustomPass, getSellerPass
} from './services/storage';
import {
  initSupabase, mapClientToSupabaseRow, mapSupabaseRowToClient, getSupabaseConfig,
  mapCalendarEventToSupabaseRow, mapSupabaseRowToCalendarEvent,
  saveVendedorToSupabase, deleteVendedorFromSupabase, fetchVendedoresFromSupabase,
  saveCompaniaToSupabase, deleteCompaniaFromSupabase, fetchCompaniasFromSupabase
} from './services/supabase';
import { exportToExcelFile, downloadExcelTemplate, parseExcelOrCSVBuffer } from './services/excelService';

// Components
import { LoginView } from './components/LoginView';
import { CalendarAgendaView } from './components/CalendarAgendaView';
import { PoliciesView } from './components/PoliciesView';
import { CommissionsView } from './components/CommissionsView';
import { AgentsDirectoryView } from './components/AgentsDirectoryView';
import { MonthlyReportsView } from './components/MonthlyReportsView';
import { SalesPortalView } from './components/SalesPortalView';
import { KanbanView } from './components/KanbanView';
import { DashboardChartsView } from './components/DashboardChartsView';
import { SettingsView } from './components/SettingsView';
import { SmartQuoterView } from './components/SmartQuoterView';
import { PovertyTableView } from './components/PovertyTableView';

// Modals
import { ClientModal } from './components/Modals/ClientModal';
import { CommissionMatrixModal } from './components/Modals/CommissionMatrixModal';
import { AgentModal } from './components/Modals/AgentModal';
import { PinModal } from './components/Modals/PinModal';
import { CloudModal } from './components/Modals/CloudModal';

// Icons
import {
  Users, CheckSquare, DollarSign, IdCard, BarChart3,
  Send, Columns, PieChart, Sliders, Plus, RotateCw,
  LogOut, Menu, X, Shield, Camera, Download, Upload,
  Calendar, CheckCircle2, AlertCircle, Info, Lock,
  Sparkles, FileText
} from 'lucide-react';

export default function App() {
  // App Role & Auth
  const [currentRole, setCurrentRole] = useState<Role>(() => {
    return (localStorage.getItem('app_current_role') as Role) || 'none';
  });
  const [currentSeller, setCurrentSeller] = useState<string>(() => {
    return localStorage.getItem('vendedor_activo') || '';
  });

  // Global Year
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // Navigation tab
  const [activeTab, setActiveTab] = useState<string>('polizas');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // App Logo
  const [appLogo, setAppLogo] = useState<string | null>(() => {
    return localStorage.getItem('app_custom_logo') || null;
  });

  const [customSellers, setCustomSellers] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('polizas_vendedores');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deletedNames = ['dani', 'carlos mendoza', 'oscar', 'maría rivas', 'maria rivas'];
          const cleaned = parsed.filter(
            s => typeof s === 'string' && s.trim() && !deletedNames.includes(s.trim().toLowerCase())
          );
          return cleaned;
        }
      }
    } catch (e) {}
    return DEFAULT_SELLERS;
  });

  const [carrierConfigs, setCarrierConfigs] = useState<CarrierConfig[]>(loadCarrierConfigs);
  const customCarriers = useMemo(() => carrierConfigs.map(c => c.name), [carrierConfigs]);

  const [customStatuses, setCustomStatuses] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('polizas_custom_statuses');
      if (stored) {
        let parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migrar 'En Proceso' a 'Procesado' y 'Pendiente' a 'Duplicado'
          parsed = parsed.map((s: string) => {
            const low = s.toLowerCase();
            if (low === 'en proceso' || low === 'proceso') return 'Procesado';
            if (low === 'pendiente') return 'Duplicado';
            return s;
          });
          // Asegurar que estén Autorizado, Procesado, Renovado y Duplicado
          if (!parsed.some((s: string) => s.toLowerCase() === 'autorizado')) parsed.splice(1, 0, 'Autorizado');
          if (!parsed.some((s: string) => s.toLowerCase() === 'procesado')) parsed.splice(2, 0, 'Procesado');
          if (!parsed.some((s: string) => s.toLowerCase() === 'renovado')) parsed.splice(3, 0, 'Renovado');
          if (!parsed.some((s: string) => s.toLowerCase() === 'duplicado')) parsed.push('Duplicado');
          // Eliminar cualquier 'En Proceso' o 'Pendiente' restante
          parsed = parsed.filter((s: string) => s.toLowerCase() !== 'en proceso' && s.toLowerCase() !== 'pendiente');
          const unique = Array.from(new Set(parsed)) as string[];
          localStorage.setItem('polizas_custom_statuses', JSON.stringify(unique));
          return unique;
        }
      }
    } catch (e) {}
    return DEFAULT_STATUSES;
  });

  // Data
  const [clients, setClients] = useState<ClientPolicy[]>(loadClients);
  const [tasks, setTasks] = useState<DailyTask[]>(loadTasks);

  // Conteo de pólizas activas por aseguradora
  const clientsCountByCarrier = useMemo(() => {
    const map: Record<string, number> = {};
    clients.forEach(c => {
      if (c.carrier) {
        const lower = c.carrier.trim().toLowerCase();
        map[lower] = (map[lower] || 0) + 1;
      }
    });
    return map;
  }, [clients]);

  // Auto-registrar en la configuración cualquier aseguradora presente en las pólizas subidas o importadas
  useEffect(() => {
    if (clients.length > 0) {
      const { configs, newAddedCount } = autoRegisterCarriersFromClients(clients, carrierConfigs);
      if (newAddedCount > 0) {
        setCarrierConfigs(configs);
      }
    }
  }, [clients]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(loadCalendarEvents);
  const [agents, setAgents] = useState<Agent[]>(loadAgents);

  // Commission PIN Lock
  const [isCommissionUnlocked, setIsCommissionUnlocked] = useState(false);
  const [pendingPinTarget, setPendingPinTarget] = useState<string | null>(null);

  // Supabase Status
  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseConfig);
  const [cloudStatus, setCloudStatus] = useState<{ connected: boolean; message: string }>({
    connected: false,
    message: 'Supabase Cloud'
  });

  // Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientPolicy | null>(null);

  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [matrixClient, setMatrixClient] = useState<ClientPolicy | null>(null);

  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);

  // Toast trigger
  const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString();
    setToast({ id, title, message, type });
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev));
    }, 4000);
  };

  // Sync with Supabase on mount
  useEffect(() => {
    syncFromSupabase();
  }, []);

  // Sincronización en tiempo real para eventos de calendario entre todas las sesiones
  useEffect(() => {
    const sb = initSupabase();
    if (!sb) return;

    let channel: any = null;
    try {
      channel = sb
        .channel('realtime:eventos_calendario')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'eventos_calendario' },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              const newEvt = mapSupabaseRowToCalendarEvent(payload.new);
              setCalendarEvents(prev => {
                if (prev.some(e => e.id === newEvt.id)) return prev;
                const next = [newEvt, ...prev];
                saveCalendarEvents(next);
                return next;
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedEvt = mapSupabaseRowToCalendarEvent(payload.new);
              setCalendarEvents(prev => {
                const next = prev.map(e => (e.id === updatedEvt.id ? updatedEvt : e));
                saveCalendarEvents(next);
                return next;
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                setCalendarEvents(prev => {
                  const next = prev.filter(e => e.id !== deletedId);
                  saveCalendarEvents(next);
                  return next;
                });
              }
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR') {
            // La tabla puede no estar habilitada para realtime aún en Supabase
            console.info('Aviso: Canal en tiempo real inactivo o pendiente de habilitar en Supabase.');
          }
        });
    } catch (err) {
      console.info('Aviso Realtime:', err);
    }

    return () => {
      if (channel && sb) {
        try {
          sb.removeChannel(channel);
        } catch (_) {}
      }
    };
  }, []);

  // Sincronización en tiempo real para la tabla de vendedores en Supabase
  useEffect(() => {
    const sb = initSupabase();
    if (!sb) return;

    let vChannel: any = null;
    try {
      vChannel = sb
        .channel('realtime:vendedores_app')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'vendedores' },
          async () => {
            try {
              const cloudVendedores = await fetchVendedoresFromSupabase();
              const deletedNames = ['dani', 'carlos mendoza', 'oscar', 'maría rivas', 'maria rivas'];
              const activeNames = cloudVendedores
                .map(v => v.nombre.trim())
                .filter(name => name.length > 0 && !deletedNames.includes(name.toLowerCase()));
              const unique = Array.from(new Set(activeNames));
              setCustomSellers(unique);
              localStorage.setItem('polizas_vendedores', JSON.stringify(unique));
              cloudVendedores.forEach(v => {
                if (v.clave) setSellerCustomPass(v.nombre, v.clave);
              });
            } catch (_) {}
          }
        )
        .subscribe();
    } catch (err) {
      console.info('Aviso Realtime Vendedores:', err);
    }

    return () => {
      if (vChannel && sb) {
        try {
          sb.removeChannel(vChannel);
        } catch (_) {}
      }
    };
  }, []);

  const syncCalendarFromSupabase = async (notify = false) => {
    const sb = initSupabase();
    if (!sb) return;
    try {
      const { data, error } = await sb.from('eventos_calendario').select('*').limit(1000);
      if (error) {
        // Si la tabla no ha sido creada en Supabase (Error 404 / PGRST205 / schema cache)
        if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
          console.info('Aviso Supabase: La tabla eventos_calendario aún no ha sido creada. Se sincronizará en modo local.');
        } else {
          console.warn('Aviso calendario Supabase:', error.message);
        }
        return;
      }
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const mapped = data.map(mapSupabaseRowToCalendarEvent);
          setCalendarEvents(mapped);
          saveCalendarEvents(mapped);
          localStorage.setItem('agente_calendar_synced_cloud', 'true');
          if (notify) {
            showToast('Calendario Actualizado', `${mapped.length} eventos sincronizados desde la nube.`, 'success');
          }
        } else {
          const wasSyncedBefore = localStorage.getItem('agente_calendar_synced_cloud');
          if (!wasSyncedBefore && calendarEvents.length > 0) {
            // Inicializar tabla en la nube si está vacía
            for (const evt of calendarEvents) {
              await sb.from('eventos_calendario').upsert([mapCalendarEventToSupabaseRow(evt)]);
            }
            localStorage.setItem('agente_calendar_synced_cloud', 'true');
          } else if (wasSyncedBefore) {
            // Se sincronizó antes y la nube tiene 0 eventos (fueron borrados)
            setCalendarEvents([]);
            saveCalendarEvents([]);
          }
        }
      }
    } catch (err) {
      console.warn('Could not sync calendar from Supabase:', err);
    }
  };

  const syncFromSupabase = async () => {
    const sb = initSupabase();
    if (!sb) {
      setCloudStatus({ connected: false, message: 'Modo Local' });
      return;
    }

    try {
      setCloudStatus({ connected: false, message: 'Sincronizando...' });
      const fetchPromise = sb.from('clientes').select('*').limit(2000);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de conexión a Supabase')), 8000)
      );

      const { data, error } = (await Promise.race([fetchPromise, timeoutPromise])) as any;

      if (error) throw error;

      if (Array.isArray(data) && data.length > 0) {
        const rawMapped = data.map((row: any) => mapSupabaseRowToClient(row, selectedYear));
        const mapped = sanitizeClients(rawMapped);
        setClients(mapped);
        saveClients(mapped);
        setCloudStatus({ connected: true, message: 'Supabase Conectado' });
        showToast('Supabase Sincronizado', `${mapped.length} clientes cargados desde la nube.`, 'success');
      } else {
        setCloudStatus({ connected: true, message: 'Supabase Listo' });
      }

      // Sincronizar también el calendario en la misma llamada
      await syncCalendarFromSupabase();

      // Sincronizar vendedores y sus claves desde Supabase (Fuente única y exclusiva de verdad)
      try {
        const cloudVendedores = await fetchVendedoresFromSupabase();
        if (Array.isArray(cloudVendedores)) {
          const deletedNames = ['dani', 'carlos mendoza', 'oscar', 'maría rivas', 'maria rivas'];
          const activeNames = cloudVendedores
            .map(v => v.nombre.trim())
            .filter(name => name.length > 0 && !deletedNames.includes(name.toLowerCase()));
          
          const unique = Array.from(new Set(activeNames));
          // Supabase es la fuente de verdad única para vendedores activos:
          if (unique.length > 0) {
            setCustomSellers(unique);
            localStorage.setItem('polizas_vendedores', JSON.stringify(unique));
            cloudVendedores.forEach(v => {
              if (v.clave) setSellerCustomPass(v.nombre, v.clave);
            });
          }
        }
      } catch (_) {}

      // Sincronizar companias desde Supabase
      try {
        const cloudCompanias = await fetchCompaniasFromSupabase();
        if (cloudCompanias.length > 0) {
          const merged = [...carrierConfigs];
          cloudCompanias.forEach(cc => {
            const idx = merged.findIndex(m => m.name.toLowerCase() === cc.name.toLowerCase());
            if (idx >= 0) {
              merged[idx] = cc;
            } else {
              merged.push(cc);
            }
          });
          setCarrierConfigs(merged);
          saveCarrierConfigs(merged);
        }
      } catch (_) {}
    } catch (err) {
      console.warn('Supabase sync notice:', err);
      setCloudStatus({ connected: false, message: 'Supabase (Modo Local)' });
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    showToast('Sincronizando...', 'Actualizando base de datos desde la nube...', 'info');
    try {
      await syncFromSupabase();
      showToast('Sincronización Exitosa', 'Base de datos y registros actualizados.', 'success');
    } catch (e) {
      showToast('Sincronización Local', 'Datos locales verificados y actualizados.', 'info');
    } finally {
      setIsSyncing(false);
    }
  };

  const pushClientsToSupabase = async () => {
    const sb = initSupabase();
    if (!sb) {
      showToast('Falta Configuración', 'Verifica la URL y Key de Supabase en Ajustes.', 'info');
      return;
    }

    showToast('Subiendo...', `Sincronizando pólizas, cotizaciones, tareas y calendario a Supabase...`, 'info');
    let clientsCount = 0;
    let quotesCount = 0;
    let tasksCount = 0;
    let calCount = 0;

    try {
      // 1. Pólizas / Clientes
      for (const c of clients) {
        const payload = mapClientToSupabaseRow(c);
        let { error } = await sb.from('clientes').upsert([payload]);
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
          const fallbackPayload: Record<string, any> = {
            id: payload.id,
            nombre: payload.nombre || '',
            apellido: payload.apellido || '',
            telefono: payload.telefono || '',
            ssn: payload.ssn || '',
            vendedor: payload.vendedor || 'General',
            estatus: payload.estatus || 'Activo',
            estado: payload.estado || 'GA',
            anio: payload.anio || 2026,
            enfermedades: payload.enfermedades
          };
          await sb.from('clientes').upsert([fallbackPayload]);
        }
        clientsCount++;
      }

      // 2. Cotizaciones
      const rawQuotes = localStorage.getItem('agente_quotes_saved');
      if (rawQuotes) {
        try {
          const parsedQ = JSON.parse(rawQuotes);
          if (Array.isArray(parsedQ)) {
            for (const q of parsedQ) {
              await sb.from('cotizaciones').upsert([{
                id: q.id,
                cliente_nombre: q.clientName,
                ubicacion: q.location,
                miembros: q.members,
                anio: q.year,
                agente: q.agentName,
                planes: q.plans,
                total_mensual: q.totalMonthlyPremium
              }]);
              quotesCount++;
            }
          }
        } catch (e) {}
      }

      // 3. Tareas Diarias
      for (const t of tasks) {
        try {
          await sb.from('tareas').upsert([{
            id: t.id,
            titulo: t.titulo,
            descripcion: t.descripcion || '',
            fecha_vencimiento: t.fechaVencimiento,
            prioridad: t.prioridad,
            categoria: t.categoria,
            estado: t.estado,
            cliente_relacionado: t.clienteRelacionado || '',
            asignado_a: t.asignadoA,
            creada_en: t.creadaEn
          }]);
          tasksCount++;
        } catch (e) {}
      }

      // 4. Eventos de Calendario
      for (const evt of calendarEvents) {
        try {
          const payload = mapCalendarEventToSupabaseRow(evt);
          await sb.from('eventos_calendario').upsert([payload]);
          calCount++;
        } catch (e) {}
      }
      localStorage.setItem('agente_calendar_synced_cloud', 'true');

      setCloudStatus({ connected: true, message: 'Supabase Conectado' });
      showToast('¡Sincronización Exitosa!', `${clientsCount} pólizas, ${quotesCount} cotizaciones, ${tasksCount} tareas y ${calCount} eventos del calendario sincronizados en Supabase.`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Aviso', 'Ocurrió un error al subir a Supabase. Revisa el script SQL en Ajustes.', 'error');
    }
  };

  const saveSingleClientToSupabase = async (client: ClientPolicy) => {
    const sb = initSupabase();
    if (!sb) return;
    try {
      const payload = mapClientToSupabaseRow(client);
      let { error } = await sb.from('clientes').upsert([payload]);

      // Si falla porque alguna columna opcional no existe en su tabla Supabase:
      if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
        console.warn('Reintentando guardar cliente en Supabase de forma compatible:', error.message);
        const fallbackPayload: Record<string, any> = {
          id: payload.id,
          nombre: payload.nombre || '',
          apellido: payload.apellido || '',
          telefono: payload.telefono || '',
          ssn: payload.ssn || '',
          vendedor: payload.vendedor || 'General',
          estatus: payload.estatus || 'Activo',
          estado: payload.estado || 'GA',
          anio: payload.anio || 2026,
          enfermedades: payload.enfermedades
        };
        const retryResult = await sb.from('clientes').upsert([fallbackPayload]);
        if (!retryResult.error) {
          setCloudStatus({ connected: true, message: 'Supabase Sincronizado' });
          return;
        }

        // Si la tabla original sólo tiene la columna 'nombre' simple (sin apellido):
        const minimalFallback: Record<string, any> = {
          id: payload.id,
          nombre: (payload.nombre + (payload.apellido ? ` ${payload.apellido}` : '')).trim(),
          telefono: payload.telefono || '',
          ssn: payload.ssn || '',
          vendedor: payload.vendedor || 'General',
          estatus: payload.estatus || 'Activo',
          estado: payload.estado || 'GA',
          anio: payload.anio || 2026,
          enfermedades: payload.enfermedades
        };
        const retryResult2 = await sb.from('clientes').upsert([minimalFallback]);
        if (!retryResult2.error) {
          setCloudStatus({ connected: true, message: 'Supabase Sincronizado' });
          return;
        }
      }

      if (error) {
        console.warn('Could not save single client to Supabase:', error);
      } else {
        setCloudStatus({ connected: true, message: 'Supabase Sincronizado' });
      }
    } catch (e: any) {
      console.warn('Could not save single client to Supabase:', e);
    }
  };

  const deleteSingleClientFromSupabase = async (clientId: string) => {
    const sb = initSupabase();
    if (!sb) return;
    try {
      await sb.from('clientes').delete().eq('id', clientId);
    } catch (e) {
      console.warn('Could not delete client from Supabase:', e);
    }
  };

  // Auth Handlers
  const handleLoginSeller = (seller: string) => {
    setCurrentRole('vendedor');
    setCurrentSeller(seller);
    localStorage.setItem('app_current_role', 'vendedor');
    localStorage.setItem('vendedor_activo', seller);
    setActiveTab('ventas-portal');
    showToast('Bienvenido(a)', `Portal de Ventas activado para ${seller}.`, 'success');
  };

  const handleLoginAdmin = () => {
    setCurrentRole('admin');
    localStorage.setItem('app_current_role', 'admin');
    setActiveTab('polizas');
    showToast('Acceso Concedido', 'Sesión de Administrador iniciada.', 'success');
  };

  const handleLogout = () => {
    setCurrentRole('none');
    localStorage.removeItem('app_current_role');
    setIsCommissionUnlocked(false);
    showToast('Sesión Cerrada', 'Has salido del sistema con seguridad.', 'info');
  };

  // Logo uploader
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const dataUrl = event.target?.result as string;
      setAppLogo(dataUrl);
      localStorage.setItem('app_custom_logo', dataUrl);
      showToast('Logotipo Actualizado', 'El logo se guardó correctamente.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    setAppLogo(null);
    localStorage.removeItem('app_custom_logo');
    showToast('Logotipo Restaurado', 'Se restableció el logotipo predeterminado.', 'info');
  };

  // Navigation tab switch
  const handleTabSwitch = (tab: string) => {
    const allowedSellerTabs = ['ventas-portal', 'calendario', 'tareas', 'cotizador', 'pobreza'];
    if (currentRole === 'vendedor' && !allowedSellerTabs.includes(tab)) {
      showToast('Acceso Restringido', 'Los vendedores tienen acceso al portal de ventas, calendario, cotizador, tabla FPL y tareas asignadas.', 'error');
      return;
    }

    if (tab === 'comisiones' && !isCommissionUnlocked) {
      setPendingPinTarget('comisiones');
      setIsPinModalOpen(true);
      return;
    }

    setActiveTab(tab);
    setSidebarOpen(false);

    if (tab === 'calendario' || tab === 'tareas') {
      syncCalendarFromSupabase();
    }
  };

  // Policies Handlers
  const handleSaveClient = (clientData: ClientPolicy | Omit<ClientPolicy, 'id'>) => {
    const clientId = ('id' in clientData && clientData.id) ? clientData.id : ('client-' + Date.now());
    const usDbo = formatToUSDate(clientData.dbo);
    const finalAge = clientData.edad || calculateAgeFromDBO(usDbo);
    const existingIdx = clients.findIndex(c => c.id === clientId);
    const isNew = existingIdx < 0;

    // Normalizar lista de dependientes y preservar estatus migratorio
    const cleanDeps = (clientData.dependientesList || []).map(d => ({
      ...d,
      estatusMigratorio: d.estatusMigratorio || clientData.estatusMigratorio || 'Ciudadano'
    }));

    const fullClient: ClientPolicy = {
      ...(clientData as ClientPolicy),
      id: clientId,
      dbo: usDbo,
      edad: finalAge,
      estatus: isNew ? (clientData.estatus || 'Nuevo') : (clientData.estatus || 'Activo'),
      tipoPoliza: clientData.tipoPoliza || 'obama',
      companiaSuplementaria: clientData.companiaSuplementaria || '',
      dependientesList: cleanDeps,
      datosDependientes: JSON.stringify(cleanDeps),
      numDependientes: cleanDeps.filter(d => d.aplica !== false).length,
      ingresoFecha: clientData.ingresoFecha ? formatToUSDate(clientData.ingresoFecha) : getCurrentFormattedDateAndYear().dateUS,
      createdDate: clientData.createdDate ? formatToUSDate(clientData.createdDate) : getCurrentFormattedDateAndYear().dateUS
    };

    let updated: ClientPolicy[];

    if (!isNew) {
      updated = [...clients];
      updated[existingIdx] = fullClient;
    } else {
      updated = [fullClient, ...clients];
    }

    setClients(updated);
    saveClients(updated);

    // Auto-registrar la aseguradora en configuración si es nueva (ej. Imperial)
    if (fullClient.carrier?.trim()) {
      const { configs, newAdded } = autoRegisterSingleCarrier(fullClient.carrier.trim(), carrierConfigs);
      if (newAdded) {
        setCarrierConfigs(configs);
      }
    }

    setIsClientModalOpen(false);
    setEditingClient(null);

    if (isNew) {
      showToast('¡Nuevo Registro Guardado!', `Póliza de ${fullClient.nombre} guardada con estatus "${fullClient.estatus}" para administración.`, 'success');
    } else {
      showToast('Guardado', `Expediente de ${fullClient.nombre} actualizado correctamente.`, 'success');
    }

    saveSingleClientToSupabase(fullClient);
  };

  const handleDeleteClient = (clientId: string) => {
    const updated = clients.filter(c => c.id !== clientId);
    setClients(updated);
    saveClients(updated);
    setIsClientModalOpen(false);
    setEditingClient(null);
    showToast('Eliminado', 'Expediente eliminado correctamente.', 'info');
    deleteSingleClientFromSupabase(clientId);
  };

  const handleRenewClient = (clientData: ClientPolicy, targetYearOverride?: string) => {
    const nextYear = targetYearOverride || (String(clientData.createdYear || selectedYear) === '2026' ? '2027' : String(parseInt(clientData.createdYear || selectedYear) + 1));
    const todayUS = getCurrentFormattedDateAndYear().dateUS;

    // Asegurar que los dependientes conserven su estatus migratorio intacto
    const cleanDeps = (clientData.dependientesList || []).map(d => ({
      ...d,
      estatusMigratorio: d.estatusMigratorio || clientData.estatusMigratorio || 'Ciudadano'
    }));

    const renewed: ClientPolicy = {
      ...clientData,
      id: 'client-renov-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      createdYear: nextYear,
      estatus: 'Renovado', // Cambiar automáticamente y limpiamente a "Renovado"
      tipoPoliza: clientData.tipoPoliza || 'obama',
      companiaSuplementaria: clientData.companiaSuplementaria || '',
      dependientesList: cleanDeps,
      datosDependientes: JSON.stringify(cleanDeps),
      pagoRealizado: 'TRUE',
      createdDate: todayUS,
      notas: `[Renovado ${nextYear}] ` + (clientData.notas || ''),
      commissions: {}
    };

    const updated = [renewed, ...clients];
    setClients(updated);
    saveClients(updated);
    setSelectedYear(nextYear);
    setIsClientModalOpen(false);
    setEditingClient(null);
    showToast('¡Renovación Exitosa!', `${renewed.nombre} duplicado y renovado con estatus "Renovado" para el año ${nextYear}.`, 'success');
    saveSingleClientToSupabase(renewed);
  };

  const handleUpdatePolicyStatus = (clientId: string, newStatus: string) => {
    const updated = clients.map(c => (c.id === clientId ? { ...c, estatus: newStatus } : c));
    setClients(updated);
    saveClients(updated);
    const client = updated.find(c => c.id === clientId);
    if (client) saveSingleClientToSupabase(client);
    showToast('Estatus Actualizado', `Póliza movida a "${newStatus}".`, 'success');
  };

  // Commissions Matrix Save
  const handleSaveMatrixCommissions = (clientId: string, updatedMonthComms: Record<string, CommissionItem>) => {
    const updated = clients.map(c => {
      if (c.id === clientId) {
        const comms = { ...(c.commissions || {}) };
        comms[selectedYear] = updatedMonthComms;
        return { ...c, commissions: comms };
      }
      return c;
    });

    setClients(updated);
    saveClients(updated);
    setIsMatrixModalOpen(false);
    setMatrixClient(null);
    showToast('Comisiones Guardadas', `Matriz de comisiones actualizada para ${selectedYear}.`, 'success');

    const updatedClient = updated.find(c => c.id === clientId);
    if (updatedClient) saveSingleClientToSupabase(updatedClient);
  };

  // Tasks Handlers
  const handleAddTask = (newTaskData: Omit<DailyTask, 'id' | 'creadaEn'>) => {
    const task: DailyTask = {
      ...newTaskData,
      id: 'task-' + Date.now(),
      creadaEn: new Date().toISOString().split('T')[0]
    };
    const updated = [task, ...tasks];
    setTasks(updated);
    saveTasks(updated);
    showToast('Tarea Creada', `"${task.titulo}" añadida a la agenda diaria.`, 'success');
  };

  const handleUpdateTask = (updatedTask: DailyTask) => {
    const updated = tasks.map(t => (t.id === updatedTask.id ? updatedTask : t));
    setTasks(updated);
    saveTasks(updated);
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    saveTasks(updated);
    showToast('Tarea Eliminada', 'La tarea se retiró de la lista.', 'info');
  };

  // Calendar Events Handlers (Sincronización en la nube con Supabase)
  const handleAddCalendarEvent = async (newEventData: Omit<CalendarEvent, 'id' | 'creadaEn'>) => {
    const event: CalendarEvent = {
      ...newEventData,
      id: 'evt-' + Date.now(),
      creadaEn: new Date().toISOString().split('T')[0]
    };
    const updated = [event, ...calendarEvents];
    setCalendarEvents(updated);
    saveCalendarEvents(updated);
    localStorage.setItem('agente_calendar_synced_cloud', 'true');

    const sb = initSupabase();
    if (sb) {
      try {
        const payload = mapCalendarEventToSupabaseRow(event);
        const { error } = await sb.from('eventos_calendario').upsert([payload]);
        if (error) {
          console.warn('Aviso guardando evento en Supabase:', error.message);
        }
      } catch (e) {
        console.warn('Error syncing event to Supabase:', e);
      }
    }
  };

  const handleUpdateCalendarEvent = async (updatedEvent: CalendarEvent) => {
    const updated = calendarEvents.map(e => (e.id === updatedEvent.id ? updatedEvent : e));
    setCalendarEvents(updated);
    saveCalendarEvents(updated);

    const sb = initSupabase();
    if (sb) {
      try {
        const payload = mapCalendarEventToSupabaseRow(updatedEvent);
        await sb.from('eventos_calendario').upsert([payload]);
      } catch (e) {
        console.warn('Error updating event in Supabase:', e);
      }
    }
  };

  const handleDeleteCalendarEvent = async (eventId: string) => {
    const updated = calendarEvents.filter(e => e.id !== eventId);
    setCalendarEvents(updated);
    saveCalendarEvents(updated);
    localStorage.setItem('agente_calendar_synced_cloud', 'true');

    const sb = initSupabase();
    if (sb) {
      try {
        const { error } = await sb.from('eventos_calendario').delete().eq('id', eventId);
        if (error) {
          console.warn('Aviso borrando evento en Supabase:', error.message);
        }
      } catch (e) {
        console.warn('Error deleting event from Supabase:', e);
      }
    }
    showToast('Evento Eliminado', 'El evento ha sido borrado de la agenda para todas las sesiones.', 'info');
  };

  // Agents Handlers
  const handleSaveAgent = (agentData: Agent) => {
    const idx = agents.findIndex(a => a.id === agentData.id);
    let updated: Agent[];
    if (idx >= 0) {
      updated = [...agents];
      updated[idx] = agentData;
    } else {
      updated = [...agents, agentData];
    }
    setAgents(updated);
    saveAgents(updated);
    setIsAgentModalOpen(false);
    setEditingAgent(null);
    showToast('Agente Guardado', `Ficha de ${agentData.nombre} guardada con éxito.`, 'success');
  };

  const handleDeleteAgent = (agentId: string) => {
    const updated = agents.filter(a => a.id !== agentId);
    setAgents(updated);
    saveAgents(updated);
    setIsAgentModalOpen(false);
    setEditingAgent(null);
    showToast('Agente Eliminado', 'Ficha del agente eliminada.', 'info');
  };

  // Catalogs Handlers
  const handleAddSeller = (s: string) => {
    handleAddSellerWithPass(s, 'Venta2026');
  };

  const handleAddSellerWithPass = async (sellerName: string, pass: string) => {
    const clean = sellerName.trim();
    if (!clean) return;
    if (!customSellers.includes(clean)) {
      const updated = [...customSellers, clean];
      setCustomSellers(updated);
      localStorage.setItem('polizas_vendedores', JSON.stringify(updated));
    }
    const finalPass = pass.trim() || 'Venta2026';
    setSellerCustomPass(clean, finalPass);

    await saveVendedorToSupabase({
      id: 'ven-' + clean.toLowerCase().replace(/\s+/g, '-'),
      nombre: clean,
      apellido: '',
      clave: finalPass,
      npn: '',
      licencias: '',
      compania: 'General',
      notas: ''
    });

    showToast('Vendedor Registrado', `"${clean}" guardado en el sistema y en Supabase con su clave.`, 'success');
  };

  const handleUpdateSeller = async (oldName: string, newName: string, newPass?: string) => {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanNew) return;

    const currentPass = newPass !== undefined ? newPass.trim() : getSellerPass(cleanOld);
    removeSellerCustomPass(cleanOld);
    setSellerCustomPass(cleanNew, currentPass);

    const updatedSellers = customSellers.map(s => s.toLowerCase() === cleanOld.toLowerCase() ? cleanNew : s);
    if (!updatedSellers.includes(cleanNew)) updatedSellers.push(cleanNew);
    setCustomSellers(updatedSellers);
    localStorage.setItem('polizas_vendedores', JSON.stringify(updatedSellers));

    // Si cambió el nombre del vendedor, actualizarlo en las pólizas
    if (cleanOld.toLowerCase() !== cleanNew.toLowerCase()) {
      let count = 0;
      const updatedClients = clients.map(c => {
        if ((c.vendedor || '').toLowerCase() === cleanOld.toLowerCase()) {
          count++;
          return { ...c, vendedor: cleanNew };
        }
        return c;
      });
      if (count > 0) {
        setClients(updatedClients);
        saveClients(updatedClients);
        updatedClients.filter(c => (c.vendedor || '').toLowerCase() === cleanNew.toLowerCase()).forEach(c => {
          saveSingleClientToSupabase(c);
        });
      }
    }

    await saveVendedorToSupabase({
      id: 'ven-' + cleanNew.toLowerCase().replace(/\s+/g, '-'),
      nombre: cleanNew,
      apellido: '',
      clave: currentPass,
      npn: '',
      licencias: '',
      compania: 'General',
      notas: ''
    });

    showToast('Vendedor Guardado', `"${cleanNew}" y su clave actualizados permanentemente en Supabase.`, 'success');
  };

  const handleRemoveSeller = async (s: string) => {
    const updated = customSellers.filter(x => x !== s);
    setCustomSellers(updated);
    localStorage.setItem('polizas_vendedores', JSON.stringify(updated));
    removeSellerCustomPass(s);
    await deleteVendedorFromSupabase(s);
    showToast('Vendedor Removido', `"${s}" retirado de la lista y eliminado en Supabase.`, 'info');
  };

  const handleAddCarrier = (c: string) => {
    const { configs, newAdded } = autoRegisterSingleCarrier(c, carrierConfigs);
    if (newAdded) {
      setCarrierConfigs(configs);
      showToast('Compañía Agregada', `"${c.trim()}" agregada al catálogo.`, 'success');
    }
  };

  const handleAddCarrierWithColor = async (name: string, colorKey: string) => {
    const clean = name.trim();
    if (!clean) return;
    const exists = carrierConfigs.some(car => car.name.toLowerCase() === clean.toLowerCase());
    if (exists) {
      showToast('Aviso', `La compañía "${clean}" ya existe en el sistema.`, 'info');
      return;
    }
    const newConfig: CarrierConfig = {
      id: 'car-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: clean,
      colorKey
    };
    const updated = [...carrierConfigs, newConfig];
    setCarrierConfigs(updated);
    saveCarrierConfigs(updated);
    await saveCompaniaToSupabase(newConfig);
    showToast('Compañía Agregada', `"${clean}" registrada con éxito y guardada en Supabase.`, 'success');
  };

  const handleUpdateCarrierName = async (oldName: string, newName: string) => {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanNew || cleanNew.toLowerCase() === cleanOld.toLowerCase()) return;

    const updatedConfigs = carrierConfigs.map(c => (
      c.name.toLowerCase() === cleanOld.toLowerCase() ? { ...c, name: cleanNew } : c
    ));
    setCarrierConfigs(updatedConfigs);
    saveCarrierConfigs(updatedConfigs);

    const changedCfg = updatedConfigs.find(c => c.name.toLowerCase() === cleanNew.toLowerCase());
    if (changedCfg) {
      await saveCompaniaToSupabase(changedCfg);
      // Remove old name from Supabase companias if it had a different id or name
      await deleteCompaniaFromSupabase(cleanOld);
    }

    // Actualizar nombre en todas las pólizas vinculadas
    let updatedClientsCount = 0;
    const updatedClients = clients.map(client => {
      if ((client.carrier || '').toLowerCase() === cleanOld.toLowerCase()) {
        updatedClientsCount++;
        return { ...client, carrier: cleanNew };
      }
      return client;
    });

    if (updatedClientsCount > 0) {
      setClients(updatedClients);
      saveClients(updatedClients);
      // Guardar cambios en Supabase en segundo plano
      updatedClients.filter(c => (c.carrier || '').toLowerCase() === cleanNew.toLowerCase()).forEach(c => {
        saveSingleClientToSupabase(c);
      });
    }

    showToast(
      'Compañía Renombrada',
      `"${cleanOld}" ahora es "${cleanNew}". ${updatedClientsCount > 0 ? `Se actualizaron ${updatedClientsCount} pólizas asociadas.` : ''}`,
      'success'
    );
  };

  const handleUpdateCarrierColor = async (carrierName: string, newColorKey: string) => {
    const updated = carrierConfigs.map(c => (
      c.name.toLowerCase() === carrierName.toLowerCase() ? { ...c, colorKey: newColorKey } : c
    ));
    setCarrierConfigs(updated);
    saveCarrierConfigs(updated);
    const target = updated.find(c => c.name.toLowerCase() === carrierName.toLowerCase());
    if (target) await saveCompaniaToSupabase(target);
    showToast('Color Actualizado', `Color distintivo de "${carrierName}" actualizado correctamente.`, 'success');
  };

  const handleRemoveCarrier = async (c: string) => {
    const updated = carrierConfigs.filter(x => x.name.toLowerCase() !== c.toLowerCase());
    setCarrierConfigs(updated);
    saveCarrierConfigs(updated);
    await deleteCompaniaFromSupabase(c);
    showToast('Compañía Removida', `"${c}" retirada de la lista y de Supabase.`, 'info');
  };

  const handleAddStatus = (st: string) => {
    if (!customStatuses.includes(st)) {
      const updated = [...customStatuses, st];
      setCustomStatuses(updated);
      localStorage.setItem('polizas_custom_statuses', JSON.stringify(updated));
    }
  };

  const handleRemoveStatus = (st: string) => {
    const updated = customStatuses.filter(x => x !== st);
    setCustomStatuses(updated);
    localStorage.setItem('polizas_custom_statuses', JSON.stringify(updated));
    showToast('Estatus Removido', `"${st}" retirado de la lista.`, 'info');
  };

  // Manejador centralizado de importación de clientes (desde Excel o CSV con columnas separadas)
  const handleImportClients = (newClients: ClientPolicy[]) => {
    if (!newClients || newClients.length === 0) return;

    // Auto-registrar compañías de las pólizas importadas si son nuevas
    const { configs, newAddedCount } = autoRegisterCarriersFromClients(newClients, carrierConfigs);
    if (newAddedCount > 0) {
      setCarrierConfigs(configs);
    }

    const merged = [...newClients, ...clients];
    setClients(merged);
    saveClients(merged);

    // Guardar en la nube Supabase en segundo plano
    newClients.forEach(c => {
      saveSingleClientToSupabase(c);
    });

    showToast(
      'Importación Exitosa',
      `${newClients.length} pólizas añadidas al sistema con formato de columnas separadas.`,
      'success'
    );
  };

  // Exportar a Excel (.xlsx) con columnas canónicas exactamente separadas
  const exportToExcelOrCSV = () => {
    try {
      const yearClients = clients.filter(c => String(c.createdYear || "2026") === String(selectedYear));
      exportToExcelFile(yearClients.length > 0 ? yearClients : clients, `Polizas_${selectedYear}_AgenteContigo.xlsx`);
      showToast('Exportación Exitosa', 'Archivo Excel descargado con todas las columnas organizadas.', 'success');
    } catch (e: any) {
      console.error('Error al exportar:', e);
      showToast('Error', 'No se pudo generar el archivo Excel.', 'error');
    }
  };

  // Importar desde archivo Excel (.xlsx, .xls) o CSV
  const importFromExcelOrCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const { clients: imported } = parseExcelOrCSVBuffer(buffer, selectedYear);
        if (imported.length === 0) {
          showToast('Aviso', 'No se encontraron registros de pólizas válidos en el archivo.', 'error');
          return;
        }
        handleImportClients(imported);
      } catch (err: any) {
        console.error('Error importando:', err);
        showToast('Error de Archivo', 'No se pudo procesar el archivo. Asegúrate de que sea Excel o CSV.', 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const copySalesPortalLink = () => {
    const url = window.location.href.split('#')[0];
    navigator.clipboard.writeText(url);
    showToast('Enlace Copiado', 'Enlace directo al Portal copiado al portapapeles.', 'success');
  };

  // If user is not logged in, show Login Screen
  if (currentRole === 'none') {
    return (
      <LoginView
        customSellers={customSellers}
        appLogo={appLogo}
        onLoginSeller={handleLoginSeller}
        onLoginAdmin={handleLoginAdmin}
        onLogoUpload={handleLogoUpload}
        onSyncSellers={(activeList) => {
          setCustomSellers(activeList);
          localStorage.setItem('polizas_vendedores', JSON.stringify(activeList));
        }}
      />
    );
  }

  // Active Year calculations for KPI
  const yearClients = clients.filter(c => String(c.createdYear || "2026") === String(selectedYear));
  const activeCount = yearClients.filter(c => c.estatus === 'Activo').length;
  const cancelCount = yearClients.filter(c => c.estatus === 'Cancelado').length;
  const robadoCount = yearClients.filter(c => c.estatus === 'Robado').length;

  let totalCommPaid = 0;
  yearClients.forEach(c => {
    MONTHS_LIST.forEach(m => {
      const comm = c.commissions?.[selectedYear]?.[m];
      if (comm?.paid) totalCommPaid += (comm.amount || 0);
      else if (!comm && c.mesIngreso === m && String(c.pagoRealizado).toUpperCase() === 'TRUE') {
        totalCommPaid += 30.00;
      }
    });
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Toast Banner */}
      {toast && (
        <div className="fixed top-16 right-5 z-50 transition-all duration-300 max-w-sm w-full bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 flex items-center space-x-3 pointer-events-auto no-print">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            ) : (
              <Info className="w-5 h-5 text-cyan-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white truncate">{toast.title}</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden no-print"
        ></div>
      )}

      <div className="flex-1 flex min-h-screen w-full relative">
        {/* VERTICAL SIDEBAR */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out shadow-2xl lg:static lg:translate-x-0 no-print ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Logo and Brand */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <label
                className="group relative flex items-center justify-center p-1 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 hover:border-emerald-400 shadow-sm backdrop-blur-md cursor-pointer transition"
                title="Haz clic para cambiar el logotipo"
              >
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                {appLogo ? (
                  <img
                    src={appLogo}
                    alt="Logo"
                    className="h-9 w-auto object-contain max-w-[110px] rounded-lg"
                  />
                ) : (
                  <div className="h-9 w-20 flex items-center justify-center bg-slate-800 rounded-lg text-emerald-400 font-extrabold text-xs">
                    Agente
                  </div>
                )}
                <div className="absolute inset-0 bg-slate-950/70 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-emerald-400 text-xs font-bold gap-1">
                  <Camera className="w-3.5 h-3.5" />
                </div>
              </label>

              <div className="min-w-0">
                <h1 className="text-sm font-black tracking-tight text-white leading-tight truncate">
                  Agente Contigo
                </h1>
                <p className="text-[10px] text-emerald-400 font-semibold truncate">
                  Panel de Gestión
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status Badge & Year Selector */}
          <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span
                onClick={() => setIsCloudModalOpen(true)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center cursor-pointer transition ${
                  cloudStatus.connected
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                }`}
                title="Configuración de Supabase"
              >
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cloudStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                <span>{cloudStatus.message}</span>
              </span>

              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1.5"></span>
                <span>En Línea</span>
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <label className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Año Activo:
              </label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="bg-slate-900 text-white font-black text-xs px-2.5 py-1 rounded-lg border border-slate-700 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
                <option value="2029">2029</option>
                <option value="2030">2030</option>
              </select>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-xs">
            <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Módulos de Trabajo
            </span>

            {/* Iniciar / Pólizas */}
            {currentRole === 'admin' && (
              <button
                type="button"
                onClick={() => handleTabSwitch('polizas')}
                className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                  activeTab === 'polizas'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Inicio / Pólizas</span>
                </span>
              </button>
            )}

            {/* Calendario Agenda Contigo (Always visible, key feature!) */}
            <button
              type="button"
              onClick={() => handleTabSwitch('calendario')}
              className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                activeTab === 'calendario' || activeTab === 'tareas'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Calendario Agenda Contigo</span>
              </span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono font-bold">
                {calendarEvents.filter(e => !e.completada).length}
              </span>
            </button>

            {/* Admin-only Modules */}
            {currentRole === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('comisiones')}
                  className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                    activeTab === 'comisiones'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span>Comisiones</span>
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                    {isCommissionUnlocked ? '🔓' : '🔒'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabSwitch('agentes')}
                  className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                    activeTab === 'agentes'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <IdCard className="w-4 h-4 text-indigo-400" />
                    <span>Directorio Agentes</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabSwitch('reportes')}
                  className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                    activeTab === 'reportes'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    <span>Reportes Mensuales</span>
                  </span>
                </button>
              </>
            )}

            {/* Portal Vendedores */}
            <button
              type="button"
              onClick={() => handleTabSwitch('ventas-portal')}
              className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                activeTab === 'ventas-portal'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-400" />
                <span>Portal Vendedores</span>
              </span>
            </button>

            {/* Cotizador Inteligente con IA (Accessible for both roles) */}
            <button
              type="button"
              onClick={() => handleTabSwitch('cotizador')}
              className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                activeTab === 'cotizador'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00c9b7]" />
                <span>Cotizador Inteligente IA</span>
              </span>
              <span className="text-[9px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-black border border-teal-500/30">
                IA
              </span>
            </button>

            {/* Tabla de Pobreza FPL 2027 (Accessible for both roles) */}
            <button
              type="button"
              onClick={() => handleTabSwitch('pobreza')}
              className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                activeTab === 'pobreza'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#008be3]" />
                <span>Tabla de Pobreza FPL</span>
              </span>
            </button>

            {/* Admin-only Kanban & Dashboard */}
            {currentRole === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('kanban')}
                  className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                    activeTab === 'kanban'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Columns className="w-4 h-4 text-blue-400" />
                    <span>Tablero Kanban</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabSwitch('dashboard')}
                  className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-purple-400" />
                    <span>Dashboard Gráficos</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabSwitch('ajustes')}
                  className={`w-full px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between text-left cursor-pointer ${
                    activeTab === 'ajustes'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <span>Configuración / Base</span>
                  </span>
                </button>
              </>
            )}

            {/* Admin Actions */}
            {currentRole === 'admin' && (
              <div className="pt-4 border-t border-slate-800/80 space-y-2">
                <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Acciones Rápidas
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setEditingClient(null);
                    setIsClientModalOpen(true);
                  }}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Nuevo Cliente</span>
                </button>

                <button
                  type="button"
                  onClick={copySalesPortalLink}
                  className="w-full py-2 px-3 bg-amber-600/90 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Link Vendedores</span>
                </button>
              </div>
            )}
          </div>

          {/* User Profile Bar */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-black flex items-center justify-center text-xs">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-200 block truncate">
                    {currentRole === 'admin' ? 'Administrador' : currentSeller}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold block">
                    Sesión Activa
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold transition cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN VIEWPORT */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between no-print">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                title="Abrir Menú Vertical"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  {activeTab === 'polizas' && <><Users className="w-4 h-4 text-emerald-600" /> Pólizas y Expedientes</>}
                  {activeTab === 'tareas' && <><CheckSquare className="w-4 h-4 text-teal-600" /> Gestión de Tareas Diarias</>}
                  {activeTab === 'comisiones' && <><DollarSign className="w-4 h-4 text-amber-500" /> Matriz de Comisiones</>}
                  {activeTab === 'agentes' && <><IdCard className="w-4 h-4 text-indigo-500" /> Directorio de Agentes</>}
                  {activeTab === 'reportes' && <><BarChart3 className="w-4 h-4 text-cyan-500" /> Reportes Mensuales</>}
                  {activeTab === 'ventas-portal' && <><Send className="w-4 h-4 text-amber-500" /> Portal de Vendedores</>}
                  {activeTab === 'cotizador' && <><Sparkles className="w-4 h-4 text-[#00c9b7]" /> Cotizador Inteligente Multicompañía con IA</>}
                  {activeTab === 'pobreza' && <><FileText className="w-4 h-4 text-[#008be3]" /> Tabla de Pobreza 2027 (Límites FPL)</>}
                  {activeTab === 'kanban' && <><Columns className="w-4 h-4 text-blue-500" /> Tablero Kanban</>}
                  {activeTab === 'dashboard' && <><PieChart className="w-4 h-4 text-purple-500" /> Dashboard Gráficos</>}
                  {activeTab === 'ajustes' && <><Sliders className="w-4 h-4 text-emerald-500" /> Configuración / Base</>}
                </h2>
                <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  Principal Agente Contigo • Gestión Integral ({selectedYear})
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Botón de Sincronización Manual */}
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition border border-slate-700 shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                title="Sincronizar de inmediato y refrescar base de datos"
              >
                <RotateCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                <span className="sm:hidden">{isSyncing ? '...' : 'Sinc'}</span>
              </button>

              {currentRole === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingClient(null);
                    setIsClientModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nuevo Cliente</span>
                </button>
              )}
            </div>
          </header>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
            {/* KPI Banner Section (Only on Admin overview tabs) */}
            {currentRole === 'admin' && (activeTab === 'polizas' || activeTab === 'dashboard' || activeTab === 'kanban') && (
              <section className="grid grid-cols-2 md:grid-cols-5 gap-4 no-print">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center text-lg font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Clientes ({selectedYear})
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 tabular-nums">
                      {yearClients.length}
                    </h3>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Activos</span>
                    <h3 className="text-xl font-extrabold text-emerald-600 tabular-nums">{activeCount}</h3>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-lg font-bold">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cancelados</span>
                    <h3 className="text-xl font-extrabold text-rose-600 tabular-nums">{cancelCount}</h3>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-bold">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Robados</span>
                    <h3 className="text-xl font-extrabold text-purple-600 tabular-nums">{robadoCount}</h3>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3 col-span-2 md:col-span-1">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Comisiones ({selectedYear})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (isCommissionUnlocked) setIsCommissionUnlocked(false);
                          else setIsPinModalOpen(true);
                        }}
                        className="text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md transition flex items-center gap-1 cursor-pointer"
                      >
                        {isCommissionUnlocked ? <Lock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        <span>{isCommissionUnlocked ? 'Bloquear' : 'Desbloquear'}</span>
                      </button>
                    </div>
                    <h3
                      onClick={() => !isCommissionUnlocked && setIsPinModalOpen(true)}
                      className="text-lg font-extrabold text-amber-600 flex items-center gap-1 cursor-pointer"
                    >
                      {isCommissionUnlocked ? (
                        <span className="text-emerald-600 tabular-nums">${totalCommPaid.toFixed(2)}</span>
                      ) : (
                        <span>🔒 $***</span>
                      )}
                    </h3>
                  </div>
                </div>
              </section>
            )}

            {/* TAB CONTENTS */}
            {activeTab === 'polizas' && (
              <PoliciesView
                clients={clients}
                agents={agents}
                selectedYear={selectedYear}
                customSellers={customSellers}
                customCarriers={customCarriers}
                customStatuses={customStatuses}
                isCommissionUnlocked={isCommissionUnlocked}
                onOpenPinModal={() => setIsPinModalOpen(true)}
                onEditClient={client => {
                  setEditingClient(client);
                  setIsClientModalOpen(true);
                }}
                onRenewClient={handleRenewClient}
                onRefreshData={handleManualSync}
                onUpdateStatus={handleUpdatePolicyStatus}
                onImportClients={handleImportClients}
                onShowToast={showToast}
              />
            )}

            {(activeTab === 'calendario' || activeTab === 'tareas') && (
              <CalendarAgendaView
                events={calendarEvents}
                clients={clients}
                onAddEvent={handleAddCalendarEvent}
                onUpdateEvent={handleUpdateCalendarEvent}
                onDeleteEvent={handleDeleteCalendarEvent}
                currentRole={currentRole}
                currentSeller={currentSeller}
                onShowToast={showToast}
                onSyncFromCloud={() => syncCalendarFromSupabase(true)}
                cloudConnected={cloudStatus.connected}
              />
            )}

            {activeTab === 'comisiones' && (
              <CommissionsView
                clients={clients}
                agents={agents}
                selectedYear={selectedYear}
                customCarriers={customCarriers}
                customSellers={customSellers}
                isUnlocked={isCommissionUnlocked}
                onLock={() => setIsCommissionUnlocked(false)}
                onOpenPinModal={() => setIsPinModalOpen(true)}
                onOpenMatrixModal={client => {
                  setMatrixClient(client);
                  setIsMatrixModalOpen(true);
                }}
                onOpenClientModal={client => {
                  setEditingClient(client);
                  setIsClientModalOpen(true);
                }}
              />
            )}

            {activeTab === 'agentes' && (
              <AgentsDirectoryView
                agents={agents}
                onOpenCreateAgentModal={() => {
                  setEditingAgent(null);
                  setIsAgentModalOpen(true);
                }}
                onEditAgent={agent => {
                  setEditingAgent(agent);
                  setIsAgentModalOpen(true);
                }}
                onDeleteAgent={handleDeleteAgent}
              />
            )}

            {activeTab === 'reportes' && (
              <MonthlyReportsView
                clients={clients}
                selectedYear={selectedYear}
                customSellers={customSellers}
              />
            )}

            {activeTab === 'ventas-portal' && (
              <SalesPortalView
                currentSeller={currentSeller}
                selectedYear={selectedYear}
                clients={clients}
                customCarriers={customCarriers}
                onSaveNewPolicy={handleSaveClient}
                onLogout={handleLogout}
                onCopyLink={copySalesPortalLink}
              />
            )}

            {activeTab === 'cotizador' && (
              <SmartQuoterView
                currentSeller={currentSeller}
                selectedYear={selectedYear}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'pobreza' && (
              <PovertyTableView />
            )}

            {activeTab === 'kanban' && (
              <KanbanView
                clients={clients}
                selectedYear={selectedYear}
                onEditClient={client => {
                  setEditingClient(client);
                  setIsClientModalOpen(true);
                }}
                onUpdateStatus={handleUpdatePolicyStatus}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardChartsView
                clients={clients}
                selectedYear={selectedYear}
              />
            )}

            {activeTab === 'ajustes' && (
              <SettingsView
                supabaseUrl={supabaseConfig.url}
                supabaseKey={supabaseConfig.key}
                onSaveSupabaseConfig={(url, key) => {
                  localStorage.setItem('app_supabase_url', url);
                  localStorage.setItem('app_supabase_key', key);
                  setSupabaseConfig({ url, key });
                  showToast('Guardado', 'Credenciales de Supabase actualizadas.', 'success');
                  syncFromSupabase();
                }}
                onSyncFromSupabase={syncFromSupabase}
                onPushToSupabase={pushClientsToSupabase}
                onLogoUpload={handleLogoUpload}
                onResetLogo={handleResetLogo}
                customSellers={customSellers}
                customCarriers={customCarriers}
                customStatuses={customStatuses}
                carrierConfigs={carrierConfigs}
                clientsCountByCarrier={clientsCountByCarrier}
                onAddSeller={handleAddSeller}
                onAddSellerWithPass={handleAddSellerWithPass}
                onUpdateSeller={handleUpdateSeller}
                onRemoveSeller={handleRemoveSeller}
                onAddCarrier={handleAddCarrier}
                onAddCarrierWithColor={handleAddCarrierWithColor}
                onUpdateCarrierName={handleUpdateCarrierName}
                onUpdateCarrierColor={handleUpdateCarrierColor}
                onRemoveCarrier={handleRemoveCarrier}
                onAddStatus={handleAddStatus}
                onRemoveStatus={handleRemoveStatus}
                onShowToast={showToast}
              />
            )}
          </main>
        </div>
      </div>

      {/* ALL MODALS */}
      <ClientModal
        isOpen={isClientModalOpen}
        client={editingClient}
        selectedYear={selectedYear}
        customCarriers={customCarriers}
        customStatuses={customStatuses}
        customSellers={customSellers}
        agents={agents}
        onClose={() => {
          setIsClientModalOpen(false);
          setEditingClient(null);
        }}
        onSave={handleSaveClient}
        onDelete={handleDeleteClient}
        onRenew={handleRenewClient}
      />

      <CommissionMatrixModal
        isOpen={isMatrixModalOpen}
        client={matrixClient}
        selectedYear={selectedYear}
        onClose={() => {
          setIsMatrixModalOpen(false);
          setMatrixClient(null);
        }}
        onSave={handleSaveMatrixCommissions}
      />

      <AgentModal
        isOpen={isAgentModalOpen}
        agent={editingAgent}
        onClose={() => {
          setIsAgentModalOpen(false);
          setEditingAgent(null);
        }}
        onSave={handleSaveAgent}
        onDelete={handleDeleteAgent}
      />

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={() => {
          setIsCommissionUnlocked(true);
          setIsPinModalOpen(false);
          showToast('Desbloqueado', 'Acceso al módulo de comisiones concedido.', 'success');
          if (pendingPinTarget) {
            setActiveTab(pendingPinTarget);
            setPendingPinTarget(null);
          }
        }}
      />

      <CloudModal
        isOpen={isCloudModalOpen}
        initialUrl={supabaseConfig.url}
        initialKey={supabaseConfig.key}
        onClose={() => setIsCloudModalOpen(false)}
        onSave={(url, key) => {
          localStorage.setItem('app_supabase_url', url);
          localStorage.setItem('app_supabase_key', key);
          setSupabaseConfig({ url, key });
          showToast('Configuración Guardada', 'Supabase actualizado.', 'success');
          syncFromSupabase();
        }}
        onPushAll={pushClientsToSupabase}
      />
    </div>
  );
}
