import React, { useState, useEffect } from 'react';
import {
  ClientPolicy, Agent, DailyTask, Role, ToastMessage, CommissionItem, CalendarEvent
} from './types';
import {
  MONTHS_LIST, DEFAULT_SELLERS, DEFAULT_CARRIERS, DEFAULT_STATUSES,
  loadClients, saveClients, loadTasks, saveTasks, loadAgents, saveAgents,
  loadCalendarEvents, saveCalendarEvents, formatToUSDate, calculateAgeFromDBO
} from './services/storage';
import {
  initSupabase, mapClientToSupabaseRow, mapSupabaseRowToClient, getSupabaseConfig,
  mapCalendarEventToSupabaseRow, mapSupabaseRowToCalendarEvent
} from './services/supabase';

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

  // Catalogs
  const [customSellers, setCustomSellers] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('polizas_vendedores');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_SELLERS;
  });

  const [customCarriers, setCustomCarriers] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('polizas_custom_carriers');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_CARRIERS;
  });

  const [customStatuses, setCustomStatuses] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('polizas_custom_statuses');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_STATUSES;
  });

  // Data
  const [clients, setClients] = useState<ClientPolicy[]>(loadClients);
  const [tasks, setTasks] = useState<DailyTask[]>(loadTasks);
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
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription notice:', err);
    }

    return () => {
      if (channel && sb) {
        try {
          sb.removeChannel(channel);
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
        console.warn('Notice loading calendar from Supabase:', error.message);
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
        const mapped = data.map((row: any) => mapSupabaseRowToClient(row, selectedYear));
        setClients(mapped);
        saveClients(mapped);
        setCloudStatus({ connected: true, message: 'Supabase Conectado' });
        showToast('Supabase Sincronizado', `${mapped.length} clientes cargados desde la nube.`, 'success');
      } else {
        setCloudStatus({ connected: true, message: 'Supabase Listo' });
      }

      // Sincronizar también el calendario en la misma llamada
      await syncCalendarFromSupabase();
    } catch (err: any) {
      console.warn('Supabase sync notice:', err);
      setCloudStatus({ connected: false, message: 'Supabase (Modo Local)' });
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
        await sb.from('clientes').upsert([payload]);
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
      const { error } = await sb.from('clientes').upsert([payload]);
      if (error) {
        console.warn('Could not save single client to Supabase:', error);
        showToast('Aviso Supabase', `No se pudo guardar en Supabase: ${error.message || 'Verifica la conexión'}`, 'error');
        setCloudStatus({ connected: false, message: 'Error de Sincronización' });
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
    const fullClient: ClientPolicy = {
      ...(clientData as ClientPolicy),
      id: clientId,
      dbo: usDbo,
      edad: finalAge,
      ingresoFecha: clientData.ingresoFecha ? formatToUSDate(clientData.ingresoFecha) : '',
      createdDate: clientData.createdDate ? formatToUSDate(clientData.createdDate) : ''
    };

    const existingIdx = clients.findIndex(c => c.id === clientId);
    let updated: ClientPolicy[];

    if (existingIdx >= 0) {
      updated = [...clients];
      updated[existingIdx] = fullClient;
    } else {
      updated = [fullClient, ...clients];
    }

    setClients(updated);
    saveClients(updated);
    setIsClientModalOpen(false);
    setEditingClient(null);
    showToast('Guardado', `Expediente de ${fullClient.nombre} actualizado.`, 'success');
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

  const handleRenewClient = (clientData: ClientPolicy) => {
    const nextYear = String(parseInt(clientData.createdYear || selectedYear) + 1);
    const renewed: ClientPolicy = {
      ...clientData,
      id: 'client-renov-' + Date.now(),
      createdYear: nextYear,
      estatus: 'Activo',
      pagoRealizado: 'TRUE',
      notas: `[Renovado ${nextYear}] ` + (clientData.notas || ''),
      commissions: {}
    };

    const updated = [renewed, ...clients];
    setClients(updated);
    saveClients(updated);
    setSelectedYear(nextYear);
    setIsClientModalOpen(false);
    setEditingClient(null);
    showToast('¡Renovado!', `${renewed.nombre} renovado con éxito para el año ${nextYear}.`, 'success');
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
    if (!customSellers.includes(s)) {
      const updated = [...customSellers, s];
      setCustomSellers(updated);
      localStorage.setItem('polizas_vendedores', JSON.stringify(updated));
    }
  };

  const handleRemoveSeller = (s: string) => {
    const updated = customSellers.filter(x => x !== s);
    setCustomSellers(updated);
    localStorage.setItem('polizas_vendedores', JSON.stringify(updated));
    showToast('Vendedor Removido', `"${s}" retirado de la lista.`, 'info');
  };

  const handleAddCarrier = (c: string) => {
    if (!customCarriers.includes(c)) {
      const updated = [...customCarriers, c];
      setCustomCarriers(updated);
      localStorage.setItem('polizas_custom_carriers', JSON.stringify(updated));
    }
  };

  const handleRemoveCarrier = (c: string) => {
    const updated = customCarriers.filter(x => x !== c);
    setCustomCarriers(updated);
    localStorage.setItem('polizas_custom_carriers', JSON.stringify(updated));
    showToast('Compañía Removida', `"${c}" retirada de la lista.`, 'info');
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

  // CSV Export
  const exportToCSV = () => {
    let csv = "ID,Vendedor,Agente,numPoliza,Nombres,Estatus,Carrier,Plan,Peso,Altura,Banco,TipoCuenta,Titular,Routing,Cuenta,ActivoDesde,Ingreso,Prima,Telefono,Social,DBO,Edad,Direccion,createdYear\n";
    clients.forEach(c => {
      csv += `"${c.id}","${c.vendedor || ''}","${c.agente || ''}","${c.numPoliza || ''}","${c.nombre || ''}","${c.estatus || ''}","${c.carrier || ''}","${c.nombrePlan || ''}","${c.peso || ''}","${c.altura || ''}","${c.bancoNombre || ''}","${c.bancoTipoCuenta || ''}","${c.bancoTitular || ''}","${c.bancoRouting || ''}","${c.bancoCuenta || ''}","${c.mesIngreso || ''}",${c.ingresoMonto || 0},${c.primaMonto || 0},"${c.telefono || ''}","${c.ssn || ''}","${c.dbo || ''}",${c.edad || 0},"${c.direccion || ''}","${c.createdYear || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Polizas_AgenteContigo_${selectedYear}.csv`;
    link.click();
    showToast('Exportado', 'Archivo CSV descargado.', 'success');
  };

  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      if (lines.length <= 1) return;

      const newClients: ClientPolicy[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');
        if (cols.length >= 4) {
          const newC: ClientPolicy = {
            id: 'client-imp-' + Date.now() + '-' + i,
            vendedor: (cols[1] || 'General').replace(/"/g, ''),
            numPoliza: (cols[2] || '').replace(/"/g, ''),
            nombre: (cols[3] || 'Sin Nombre').replace(/"/g, ''),
            estatus: (cols[4] || 'Activo').replace(/"/g, ''),
            carrier: (cols[5] || 'Oscar').replace(/"/g, ''),
            nombrePlan: (cols[6] || '').replace(/"/g, ''),
            peso: (cols[7] || '').replace(/"/g, ''),
            altura: (cols[8] || '').replace(/"/g, ''),
            bancoNombre: (cols[9] || '').replace(/"/g, ''),
            bancoTipoCuenta: 'Corriente (Checking)',
            bancoTitular: '',
            bancoRouting: '',
            bancoCuenta: '',
            cuestionarioSalud: {},
            mesIngreso: (cols[14] || 'Enero').replace(/"/g, ''),
            docStatus: 'Documento Completos',
            estatusMigratorio: 'Ciudadano',
            ingresoFecha: '',
            ingresoMonto: parseFloat((cols[15] || '0').replace(/"/g, '')) || 0,
            primaMonto: parseFloat((cols[16] || '0').replace(/"/g, '')) || 0,
            metodoPago: 'Tarjeta de Crédito',
            estadoUSA: 'GA',
            telefono: (cols[17] || '').replace(/"/g, ''),
            email: '',
            ssn: (cols[18] || '').replace(/"/g, ''),
            dbo: (cols[19] || '').replace(/"/g, ''),
            edad: parseInt(cols[20] || '0') || 0,
            direccion: (cols[21] || '').replace(/"/g, ''),
            numDependientes: 0,
            pagoRealizado: 'TRUE',
            notas: 'Importado vía CSV',
            createdDate: new Date().toLocaleDateString(),
            createdYear: (cols[22] || selectedYear).replace(/"/g, '').trim() || selectedYear,
            commissions: {}
          };
          newClients.push(newC);
          saveSingleClientToSupabase(newC);
        }
      }

      if (newClients.length > 0) {
        const merged = [...newClients, ...clients];
        setClients(merged);
        saveClients(merged);
        showToast('Importación Exitosa', `${newClients.length} pólizas añadidas al sistema.`, 'success');
      }
    };
    reader.readAsText(file);
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
                  className="w-full py-2 px-3 bg-amber-600/90 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Link Vendedores</span>
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-2.5 rounded-xl text-[11px] font-bold transition border border-slate-700 cursor-pointer flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Importar</span>
                    <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" />
                  </label>

                  <button
                    type="button"
                    onClick={exportToCSV}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-2.5 rounded-xl text-[11px] font-bold transition border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Exportar</span>
                  </button>
                </div>
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
              <button
                type="button"
                onClick={syncFromSupabase}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold rounded-xl border border-emerald-300 text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Actualizar desde Supabase"
              >
                <RotateCw className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Sincronizar</span>
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
                onRefreshData={syncFromSupabase}
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
                onAddSeller={handleAddSeller}
                onRemoveSeller={handleRemoveSeller}
                onAddCarrier={handleAddCarrier}
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
