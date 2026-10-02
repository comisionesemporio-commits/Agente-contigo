import React, { useState } from 'react';
import { DailyTask, TaskCategory, TaskPriority, TaskStatus, ClientPolicy } from '../types';
import {
  CheckCircle2, Circle, Clock, AlertCircle, Plus, Search,
  Calendar, UserCheck, Trash2, Edit3, PhoneCall, FileText,
  RefreshCw, DollarSign, Layers, CheckSquare
} from 'lucide-react';

interface DailyTasksViewProps {
  tasks: DailyTask[];
  clients: ClientPolicy[];
  onAddTask: (task: Omit<DailyTask, 'id' | 'creadaEn'>) => void;
  onUpdateTask: (task: DailyTask) => void;
  onDeleteTask: (taskId: string) => void;
  currentRole: string;
  currentSeller: string;
  onOpenClientDetails?: (clientName: string) => void;
}

export const DailyTasksView: React.FC<DailyTasksViewProps> = ({
  tasks,
  clients,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  currentRole,
  currentSeller,
  onOpenClientDetails
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'hoy' | 'proximas' | 'todas'>('hoy');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Quick task input state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newPriority, setNewPriority] = useState<TaskPriority>('media');
  const [newCategory, setNewCategory] = useState<TaskCategory>('llamada');
  const [newClient, setNewClient] = useState('');
  const [newAssigned, setNewAssigned] = useState(() => (currentRole === 'vendedor' ? currentSeller : 'Administrador'));
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit task state
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddTask({
      titulo: newTitle.trim(),
      descripcion: newDesc.trim(),
      fechaVencimiento: newDueDate,
      prioridad: newPriority,
      categoria: newCategory,
      estado: 'pendiente',
      clienteRelacionado: newClient.trim() || undefined,
      asignadoA: newAssigned || (currentRole === 'vendedor' ? currentSeller : 'Administrador')
    });

    setNewTitle('');
    setNewDesc('');
    setNewClient('');
    setShowAddForm(false);
  };

  const toggleTaskStatus = (task: DailyTask) => {
    let nextStatus: TaskStatus = 'pendiente';
    if (task.estado === 'pendiente') nextStatus = 'en_progreso';
    else if (task.estado === 'en_progreso') nextStatus = 'completada';
    else nextStatus = 'pendiente';

    onUpdateTask({ ...task, estado: nextStatus });
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    // If seller role, default to showing tasks assigned to them or unassigned
    if (currentRole === 'vendedor' && t.asignadoA && t.asignadoA !== currentSeller && t.asignadoA !== 'Todos') {
      return false;
    }

    if (filterPeriod === 'hoy' && t.fechaVencimiento !== todayStr) return false;
    if (filterPeriod === 'proximas' && t.fechaVencimiento <= todayStr) return false;

    if (filterCategory && t.categoria !== filterCategory) return false;
    if (filterPriority && t.prioridad !== filterPriority) return false;
    if (filterStatus && t.estado !== filterStatus) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchTitle = t.titulo.toLowerCase().includes(q);
      const matchDesc = (t.descripcion || '').toLowerCase().includes(q);
      const matchClient = (t.clienteRelacionado || '').toLowerCase().includes(q);
      const matchAssigned = (t.asignadoA || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchClient && !matchAssigned) return false;
    }

    return true;
  });

  // Metrics
  const todayTasks = tasks.filter(t => t.fechaVencimiento === todayStr);
  const pendingCount = tasks.filter(t => t.estado === 'pendiente').length;
  const inProgressCount = tasks.filter(t => t.estado === 'en_progreso').length;
  const completedCount = tasks.filter(t => t.estado === 'completada').length;
  const urgentCount = tasks.filter(t => t.prioridad === 'alta' && t.estado !== 'completada').length;

  const getCategoryIcon = (cat: TaskCategory) => {
    switch (cat) {
      case 'llamada':
        return <PhoneCall className="w-3.5 h-3.5 text-blue-600" />;
      case 'documentos':
        return <FileText className="w-3.5 h-3.5 text-amber-600" />;
      case 'renovacion':
        return <RefreshCw className="w-3.5 h-3.5 text-purple-600" />;
      case 'pago':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'alta':
        return <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">Alta</span>;
      case 'media':
        return <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Media</span>;
      default:
        return <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Baja</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-teal-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full text-[10px] font-black uppercase tracking-wider inline-block mb-2">
            Organizador Diario de Operaciones
          </span>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-teal-400" />
            Gestión de Tareas y Agenda Diaria
          </h2>
          <p className="text-xs text-teal-200/80 mt-1">
            Organiza las llamadas, recolección de documentos, seguimientos de pagos y renovaciones de pólizas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nueva Tarea Diaria</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Para Hoy</span>
            <h4 className="text-lg font-black text-slate-900 tabular-nums">{todayTasks.length}</h4>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Urgentes</span>
            <h4 className="text-lg font-black text-rose-600 tabular-nums">{urgentCount}</h4>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">En Progreso</span>
            <h4 className="text-lg font-black text-amber-600 tabular-nums">{inProgressCount}</h4>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Circle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pendientes</span>
            <h4 className="text-lg font-black text-slate-700 tabular-nums">{pendingCount}</h4>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3 col-span-2 sm:col-span-1">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completadas</span>
            <h4 className="text-lg font-black text-emerald-600 tabular-nums">{completedCount}</h4>
          </div>
        </div>
      </div>

      {/* Quick Add Form Drawer */}
      {showAddForm && (
        <form onSubmit={handleCreateTask} className="bg-white p-5 rounded-2xl border border-teal-200 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-slate-800 uppercase flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-600" />
              Nueva Tarea o Recordatorio de Organización
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 uppercase mb-1">Título de la Tarea *</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Ej. Llamar a Carlos para confirmar firma de aplicación..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Fecha de Vencimiento</label>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Categoría</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value as TaskCategory)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-semibold"
              >
                <option value="llamada">📞 Llamada / Contacto</option>
                <option value="documentos">📄 Documentos / W2</option>
                <option value="renovacion">🔄 Renovación Póliza</option>
                <option value="pago">💳 Verificación de Pago</option>
                <option value="general">📌 Tarea General</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Prioridad</label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as TaskPriority)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-semibold"
              >
                <option value="alta">🔴 Alta / Urgente</option>
                <option value="media">🟡 Media</option>
                <option value="baja">🟢 Baja</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Cliente Vinculado</label>
              <input
                type="text"
                list="client-suggestions"
                value={newClient}
                onChange={e => setNewClient(e.target.value)}
                placeholder="Nombre del cliente..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <datalist id="client-suggestions">
                {clients.map(c => <option key={c.id} value={c.nombre} />)}
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Asignado A</label>
              <input
                type="text"
                value={newAssigned}
                onChange={e => setNewAssigned(e.target.value)}
                placeholder="Vendedor o Admin..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 uppercase mb-1">Detalles / Notas Opcionales</label>
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Instrucciones o contexto adicional..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Guardar Tarea
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterPeriod('hoy')}
              className={`px-3 py-1.5 rounded-lg font-bold transition text-xs ${filterPeriod === 'hoy' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              📅 Hoy ({todayTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('proximas')}
              className={`px-3 py-1.5 rounded-lg font-bold transition text-xs ${filterPeriod === 'proximas' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              ⏳ Próximas
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('todas')}
              className={`px-3 py-1.5 rounded-lg font-bold transition text-xs ${filterPeriod === 'todas' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Todas ({tasks.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar tareas..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none w-48 sm:w-64"
              />
            </div>

            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="py-1.5 px-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">Todas las Categorías</option>
              <option value="llamada">Llamadas</option>
              <option value="documentos">Documentos</option>
              <option value="renovacion">Renovaciones</option>
              <option value="pago">Pagos</option>
              <option value="general">General</option>
            </select>

            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="py-1.5 px-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">Todas las Prioridades</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No hay tareas pendientes en este filtro</h4>
            <p className="text-xs text-slate-500 mt-1">Estás al día con tus actividades. ¡Gran trabajo!</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredTasks.map(t => {
              const isDone = t.estado === 'completada';
              const isInProgress = t.estado === 'en_progreso';
              const isToday = t.fechaVencimiento === todayStr;

              return (
                <li
                  key={t.id}
                  className={`p-4 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isDone ? 'bg-slate-50/70 opacity-75' : 'hover:bg-slate-50/50'}`}
                >
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleTaskStatus(t)}
                      className="mt-0.5 text-slate-400 hover:text-teal-600 transition shrink-0 cursor-pointer"
                      title="Cambiar estado de la tarea"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                      ) : isInProgress ? (
                        <Clock className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-black text-slate-900 ${isDone ? 'line-through text-slate-400' : ''}`}>
                          {t.titulo}
                        </span>
                        {getPriorityBadge(t.prioridad)}
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {getCategoryIcon(t.categoria)}
                          <span className="capitalize">{t.categoria}</span>
                        </span>
                      </div>

                      {t.descripcion && (
                        <p className={`text-[11px] mt-1 text-slate-600 ${isDone ? 'line-through text-slate-400' : ''}`}>
                          {t.descripcion}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                        <span className={`flex items-center gap-1 font-semibold ${isToday ? 'text-teal-700 font-bold' : ''}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{t.fechaVencimiento} {isToday ? '(Hoy)' : ''}</span>
                        </span>

                        {t.clienteRelacionado && (
                          <span
                            onClick={() => onOpenClientDetails && onOpenClientDetails(t.clienteRelacionado!)}
                            className="flex items-center gap-1 font-bold text-indigo-700 hover:underline cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Cliente: {t.clienteRelacionado}</span>
                          </span>
                        )}

                        {t.asignadoA && (
                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <span>👤 {t.asignadoA}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <select
                      value={t.estado}
                      onChange={e => onUpdateTask({ ...t, estado: e.target.value as TaskStatus })}
                      className="text-[11px] font-bold border border-slate-300 rounded-lg px-2 py-1 bg-white focus:ring-1 focus:ring-teal-500 cursor-pointer"
                    >
                      <option value="pendiente">⚪ Pendiente</option>
                      <option value="en_progreso">🟡 En Proceso</option>
                      <option value="completada">🟢 Completada</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => onDeleteTask(t.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar tarea"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
