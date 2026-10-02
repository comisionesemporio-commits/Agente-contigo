import React, { useState } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus,
  Video, Phone, Users, Clock, CheckCircle2, Circle, AlertCircle,
  ExternalLink, Trash2, Edit3, X, CalendarCheck, Share2,
  Download, MapPin, Sparkles, User, FileText, Check
} from 'lucide-react';
import { CalendarEvent, EventType, ClientPolicy, Role } from '../types';

interface CalendarAgendaViewProps {
  events: CalendarEvent[];
  clients: ClientPolicy[];
  onAddEvent: (event: Omit<CalendarEvent, 'id' | 'creadaEn'>) => void;
  onUpdateEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  currentRole: Role;
  currentSeller: string;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const CalendarAgendaView: React.FC<CalendarAgendaViewProps> = ({
  events,
  clients,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  currentRole,
  currentSeller,
  onShowToast
}) => {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [viewMode, setViewMode] = useState<'mes' | 'semana' | 'lista'>('mes');
  const [filterType, setFilterType] = useState<string>('todos');
  const [filterSeller, setFilterSeller] = useState<string>('todos');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDayString, setSelectedDayString] = useState<string>(
    today.toISOString().split('T')[0]
  );
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(today.toISOString().split('T')[0]);
  const [formStartTime, setFormStartTime] = useState('10:00');
  const [formEndTime, setFormEndTime] = useState('11:00');
  const [formType, setFormType] = useState<EventType>('zoom');
  const [formClient, setFormClient] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formAssigned, setFormAssigned] = useState(currentSeller || 'Administrador');
  const [formDesc, setFormDesc] = useState('');

  // Month calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Filter events
  const filteredEvents = events.filter(evt => {
    if (filterType !== 'todos' && evt.tipo !== filterType) return false;
    if (filterSeller !== 'todos' && evt.asignadoA !== filterSeller) return false;
    return true;
  });

  const getEventsForDay = (dateStr: string) => {
    return filteredEvents.filter(e => e.fecha === dateStr);
  };

  // Open Add Event Modal
  const openNewEventModal = (dayDateStr?: string) => {
    setEditingEvent(null);
    setFormTitle('');
    setFormDate(dayDateStr || today.toISOString().split('T')[0]);
    setFormStartTime('10:00');
    setFormEndTime('11:00');
    setFormType('zoom');
    setFormClient('');
    setFormLink('');
    setFormAssigned(currentSeller || 'Administrador');
    setFormDesc('');
    setIsModalOpen(true);
  };

  const openEditEventModal = (evt: CalendarEvent) => {
    setEditingEvent(evt);
    setFormTitle(evt.titulo);
    setFormDate(evt.fecha);
    setFormStartTime(evt.horaInicio || '10:00');
    setFormEndTime(evt.horaFin || '11:00');
    setFormType(evt.tipo);
    setFormClient(evt.clienteRelacionado || '');
    setFormLink(evt.linkReunion || '');
    setFormAssigned(evt.asignadoA || currentSeller || 'Administrador');
    setFormDesc(evt.descripcion || '');
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      onShowToast("Falta Título", "Por favor ingresa el título de la reunión o actividad.", "info");
      return;
    }

    if (editingEvent) {
      onUpdateEvent({
        ...editingEvent,
        titulo: formTitle.trim(),
        fecha: formDate,
        horaInicio: formStartTime,
        horaFin: formEndTime,
        tipo: formType,
        clienteRelacionado: formClient.trim() || undefined,
        linkReunion: formLink.trim() || undefined,
        asignadoA: formAssigned,
        descripcion: formDesc.trim() || undefined
      });
      onShowToast("Actualizada", "La actividad ha sido actualizada en la agenda.", "success");
    } else {
      onAddEvent({
        titulo: formTitle.trim(),
        fecha: formDate,
        horaInicio: formStartTime,
        horaFin: formEndTime,
        tipo: formType,
        clienteRelacionado: formClient.trim() || undefined,
        linkReunion: formLink.trim() || undefined,
        asignadoA: formAssigned,
        descripcion: formDesc.trim() || undefined,
        completada: false
      });
      onShowToast("Reunión Agendada", "Nueva actividad añadida a tu Calendario Agenda Contigo.", "success");
    }

    setIsModalOpen(false);
  };

  // Google Calendar Link Generator
  const generateGoogleCalendarUrl = (evt: CalendarEvent) => {
    const cleanDate = evt.fecha.replace(/-/g, '');
    const startHour = (evt.horaInicio || '10:00').replace(':', '') + '00';
    const endHour = (evt.horaFin || '11:00').replace(':', '') + '00';
    const dates = `${cleanDate}T${startHour}/${cleanDate}T${endHour}`;
    
    let details = evt.descripcion || '';
    if (evt.linkReunion) {
      details += `\nEnlace de Reunión: ${evt.linkReunion}`;
    }
    if (evt.clienteRelacionado) {
      details += `\nCliente: ${evt.clienteRelacionado}`;
    }

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: evt.titulo,
      dates: dates,
      details: details,
      location: evt.linkReunion || 'Online / Agente Contigo'
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Download .ics file
  const downloadIcs = (evt: CalendarEvent) => {
    const cleanDate = evt.fecha.replace(/-/g, '');
    const startHour = (evt.horaInicio || '10:00').replace(':', '') + '00';
    const endHour = (evt.horaFin || '11:00').replace(':', '') + '00';

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Agente Contigo//Calendario Agenda//ES
BEGIN:VEVENT
UID:${evt.id}@agentecontigo.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${cleanDate}T${startHour}
DTEND:${cleanDate}T${endHour}
SUMMARY:${evt.titulo}
DESCRIPTION:${(evt.descripcion || '') + (evt.linkReunion ? ' - Link: ' + evt.linkReunion : '')}
LOCATION:${evt.linkReunion || 'Virtual / Zoom'}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${evt.titulo.replace(/\s+/g, '_')}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast("Descargado", "Evento .ics listo para abrir con Google Calendar o Apple Calendar.", "success");
  };

  // Type Badges & Colors
  const getTypeBadge = (type: EventType) => {
    switch (type) {
      case 'zoom':
        return {
          label: 'Zoom',
          icon: <Video className="w-3 h-3 text-blue-500" />,
          bg: 'bg-blue-500/10 text-blue-700 border-blue-300 dark:border-blue-800',
          dot: 'bg-blue-500'
        };
      case 'llamada':
        return {
          label: 'Llamada',
          icon: <Phone className="w-3 h-3 text-amber-500" />,
          bg: 'bg-amber-500/10 text-amber-700 border-amber-300',
          dot: 'bg-amber-500'
        };
      case 'cita':
        return {
          label: 'Cita Presencial',
          icon: <Users className="w-3 h-3 text-emerald-500" />,
          bg: 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
          dot: 'bg-emerald-500'
        };
      case 'seguimiento':
        return {
          label: 'Seguimiento',
          icon: <Clock className="w-3 h-3 text-indigo-500" />,
          bg: 'bg-indigo-500/10 text-indigo-700 border-indigo-300',
          dot: 'bg-indigo-500'
        };
      case 'pago':
        return {
          label: 'Pago',
          icon: <CalendarCheck className="w-3 h-3 text-teal-500" />,
          bg: 'bg-teal-500/10 text-teal-700 border-teal-300',
          dot: 'bg-teal-500'
        };
      default:
        return {
          label: 'Actividad',
          icon: <CalendarIcon className="w-3 h-3 text-slate-500" />,
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-500'
        };
    }
  };

  // Generate calendar days
  const calendarCells = [];

  // 1. Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevDate = new Date(year, month - 1, dayNum);
    const dateStr = prevDate.toISOString().split('T')[0];
    calendarCells.push({
      dateStr,
      dayNum,
      isCurrentMonth: false,
      isToday: false,
      events: getEventsForDay(dateStr)
    });
  }

  // 2. Current month days
  const todayStr = today.toISOString().split('T')[0];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(year, month, d);
    const dateStr = dayDate.toISOString().split('T')[0];
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      events: getEventsForDay(dateStr)
    });
  }

  // 3. Next month padding
  const totalCells = Math.ceil(calendarCells.length / 7) * 7;
  const remainingCells = totalCells - calendarCells.length;
  for (let d = 1; d <= remainingCells; d++) {
    const nextDate = new Date(year, month + 1, d);
    const dateStr = nextDate.toISOString().split('T')[0];
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: false,
      events: getEventsForDay(dateStr)
    });
  }

  // Unique sellers for filter
  const allSellers = Array.from(new Set(events.map(e => e.asignadoA).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-black uppercase tracking-wider mb-2">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendario Agenda Contigo</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Agenda Mensual & Reuniones
          </h1>
          <p className="text-xs text-slate-300 max-w-xl mt-1">
            Organiza tus reuniones de <strong>Zoom</strong>, llamadas de seguimiento, citas presenciales y pagos con vista completa de calendario y sincronización directa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openNewEventModal()}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva Reunión / Actividad</span>
          </button>
        </div>
      </div>

      {/* Calendar Controls & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs">
        {/* Navigation month & year */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition cursor-pointer"
              title="Mes Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-1 text-xs font-black text-slate-800 hover:bg-white rounded-lg transition cursor-pointer"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition cursor-pointer"
              title="Mes Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight ml-2">
            {MONTH_NAMES[month]} <span className="text-indigo-600">{year}</span>
          </h2>
        </div>

        {/* View Mode & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('mes')}
              className={`px-3 py-1.5 rounded-lg font-extrabold transition cursor-pointer ${
                viewMode === 'mes'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vista Mes
            </button>
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              className={`px-3 py-1.5 rounded-lg font-extrabold transition cursor-pointer ${
                viewMode === 'lista'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lista de Actividades
            </button>
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="todos">Todos los tipos</option>
            <option value="zoom">📹 Reuniones de Zoom</option>
            <option value="llamada">📞 Llamadas</option>
            <option value="cita">👥 Citas presenciales</option>
            <option value="seguimiento">🔄 Seguimiento</option>
            <option value="pago">💵 Pagos</option>
          </select>

          {/* Seller filter */}
          {allSellers.length > 0 && (
            <select
              value={filterSeller}
              onChange={e => setFilterSeller(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="todos">Todos los agentes</option>
              {allSellers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* CALENDAR MONTH GRID */}
      {viewMode === 'mes' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center py-2.5 text-xs font-black text-slate-600 uppercase tracking-wider">
            {WEEKDAY_NAMES.map((w, idx) => (
              <div key={w} className={idx === 0 || idx === 6 ? 'text-amber-700' : ''}>
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-slate-200">
            {calendarCells.map((cell, idx) => {
              const hasEvents = cell.events.length > 0;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDayString(cell.dateStr);
                    setIsDayDetailOpen(true);
                  }}
                  className={`min-h-[110px] md:min-h-[135px] p-1.5 md:p-2 bg-white flex flex-col justify-between transition group relative hover:bg-indigo-50/40 cursor-pointer ${
                    !cell.isCurrentMonth ? 'bg-slate-50/60 opacity-40 text-slate-400' : ''
                  } ${cell.isToday ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/20' : ''}`}
                >
                  {/* Day header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black rounded-lg w-6 h-6 flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-800'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openNewEventModal(cell.dateStr);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md bg-indigo-100 hover:bg-indigo-200 text-indigo-700 flex items-center justify-center transition cursor-pointer text-xs"
                      title="Agregar reunión este día"
                    >
                      +
                    </button>
                  </div>

                  {/* Day events pills */}
                  <div className="mt-1 space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                    {cell.events.slice(0, 3).map(evt => {
                      const badge = getTypeBadge(evt.tipo);
                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayString(cell.dateStr);
                            setIsDayDetailOpen(true);
                          }}
                          className={`px-1.5 py-1 rounded-md text-[10px] font-bold border truncate flex items-center gap-1 transition ${badge.bg} ${
                            evt.completada ? 'line-through opacity-50' : ''
                          }`}
                          title={`${evt.horaInicio || ''} - ${evt.titulo}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dot}`}></span>
                          {evt.horaInicio && (
                            <span className="font-mono text-[9px] opacity-80 shrink-0">
                              {evt.horaInicio}
                            </span>
                          )}
                          <span className="truncate">{evt.titulo}</span>
                        </div>
                      );
                    })}

                    {cell.events.length > 3 && (
                      <span className="text-[10px] font-extrabold text-indigo-600 block text-right px-1">
                        +{cell.events.length - 3} más
                      </span>
                    )}
                  </div>

                  {/* Empty state subtle hint */}
                  {!hasEvents && cell.isCurrentMonth && (
                    <div className="h-4"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AGENDA LIST VIEW */}
      {viewMode === 'lista' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-indigo-600" />
              Próximas Actividades y Reuniones Agendadas
            </h2>
            <span className="text-xs font-bold text-slate-500">
              Total: {filteredEvents.length} eventos
            </span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <CalendarIcon className="w-10 h-10 mx-auto opacity-30 text-indigo-500" />
              <p className="text-xs font-bold text-slate-600">No hay reuniones o actividades con los filtros actuales.</p>
              <button
                type="button"
                onClick={() => openNewEventModal()}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition cursor-pointer"
              >
                + Agendar primera reunión
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents
                .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio || '').localeCompare(b.horaInicio || ''))
                .map(evt => {
                  const badge = getTypeBadge(evt.tipo);
                  return (
                    <div
                      key={evt.id}
                      className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        evt.completada
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => onUpdateEvent({ ...evt, completada: !evt.completada })}
                          className="mt-0.5 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                        >
                          {evt.completada ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border flex items-center gap-1 ${badge.bg}`}>
                              {badge.icon}
                              <span>{badge.label}</span>
                            </span>
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                              {evt.fecha}
                            </span>
                            {evt.horaInicio && (
                              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-mono">
                                ⏰ {evt.horaInicio} {evt.horaFin ? `- ${evt.horaFin}` : ''}
                              </span>
                            )}
                          </div>

                          <h3 className={`text-sm font-extrabold text-slate-900 ${evt.completada ? 'line-through text-slate-500' : ''}`}>
                            {evt.titulo}
                          </h3>

                          {evt.descripcion && (
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {evt.descripcion}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                            {evt.clienteRelacionado && (
                              <span className="flex items-center gap-1 font-semibold text-slate-700">
                                <User className="w-3.5 h-3.5 text-indigo-500" />
                                Cliente: {evt.clienteRelacionado}
                              </span>
                            )}
                            {evt.asignadoA && (
                              <span className="flex items-center gap-1 font-semibold text-slate-600">
                                👤 Asignado: {evt.asignadoA}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right actions */}
                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                        {evt.linkReunion && (
                          <a
                            href={evt.linkReunion}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Unirse a Zoom</span>
                          </a>
                        )}

                        <a
                          href={generateGoogleCalendarUrl(evt)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                          title="Sincronizar con Google Calendar"
                        >
                          <Share2 className="w-3 h-3 text-emerald-600" />
                          <span>Google Cal</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => downloadIcs(evt)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Descargar archivo .ics"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditEventModal(evt)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Deseas eliminar "${evt.titulo}"?`)) {
                              onDeleteEvent(evt.id);
                              onShowToast("Eliminada", "Actividad removida de la agenda.", "info");
                            }
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* DAY DETAIL DRAWER / MODAL */}
      {isDayDetailOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Actividades para el {selectedDayString}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Reuniones de Zoom, citas y llamadas programadas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDayDetailOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {getEventsForDay(selectedDayString).length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <p className="font-semibold text-slate-500">No hay actividades agendadas para este día.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDayDetailOpen(false);
                      openNewEventModal(selectedDayString);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition cursor-pointer"
                  >
                    + Agendar Reunión para este día
                  </button>
                </div>
              ) : (
                getEventsForDay(selectedDayString).map(evt => {
                  const badge = getTypeBadge(evt.tipo);
                  return (
                    <div
                      key={evt.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border flex items-center gap-1 ${badge.bg}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-700">
                          ⏰ {evt.horaInicio || 'Sin hora'} {evt.horaFin ? `- ${evt.horaFin}` : ''}
                        </span>
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900">{evt.titulo}</h4>

                      {evt.descripcion && (
                        <p className="text-xs text-slate-600 leading-relaxed">{evt.descripcion}</p>
                      )}

                      {evt.clienteRelacionado && (
                        <p className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-indigo-500" />
                          Cliente: {evt.clienteRelacionado}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200 gap-2">
                        <div className="flex items-center gap-2">
                          {evt.linkReunion && (
                            <a
                              href={evt.linkReunion}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                            >
                              <Video className="w-3 h-3" />
                              <span>Zoom</span>
                            </a>
                          )}
                          <a
                            href={generateGoogleCalendarUrl(evt)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                          >
                            <Share2 className="w-3 h-3 text-emerald-600" />
                            <span>Google Cal</span>
                          </a>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsDayDetailOpen(false);
                              openEditEventModal(evt);
                            }}
                            className="p-1 text-slate-600 hover:text-indigo-600 transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`¿Deseas eliminar "${evt.titulo}"?`)) {
                                onDeleteEvent(evt.id);
                                onShowToast("Eliminada", "Actividad removida.", "info");
                              }
                            }}
                            className="p-1 text-rose-500 hover:text-rose-700 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsDayDetailOpen(false);
                  openNewEventModal(selectedDayString);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Reunión</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDayDetailOpen(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT EVENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {editingEvent ? 'Editar Actividad o Reunión' : 'Agendar Reunión o Actividad'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Programa Zoom, llamadas o citas para tu día a día
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Título de la Reunión o Actividad *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ej: Reunión de Zoom con Familia Morales / Llamada W-2"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Tipo</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as EventType)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="zoom">📹 Reunión de Zoom</option>
                    <option value="llamada">📞 Llamada telefónica</option>
                    <option value="cita">👥 Cita presencial</option>
                    <option value="seguimiento">🔄 Seguimiento de póliza</option>
                    <option value="pago">💵 Confirmación de pago</option>
                    <option value="otro">📌 Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={e => setFormStartTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Hora Fin</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={e => setFormEndTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Enlace de Reunión (Zoom / Google Meet)
                </label>
                <input
                  type="url"
                  value={formLink}
                  onChange={e => setFormLink(e.target.value)}
                  placeholder="https://zoom.us/j/8492019382 o https://meet.google.com/..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Cliente / Prospecto
                  </label>
                  <input
                    type="text"
                    value={formClient}
                    onChange={e => setFormClient(e.target.value)}
                    placeholder="Nombre del cliente..."
                    list="client-suggestions"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <datalist id="client-suggestions">
                    {clients.map(c => (
                      <option key={c.id} value={c.nombre} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Asignado a
                  </label>
                  <input
                    type="text"
                    value={formAssigned}
                    onChange={e => setFormAssigned(e.target.value)}
                    placeholder="Vendedor o Administrador"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Notas o Temas a tratar
                </label>
                <textarea
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="Detalles de la reunión, preguntas del cliente, puntos pendientes..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingEvent ? 'Guardar Cambios' : 'Agendar Reunión'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
