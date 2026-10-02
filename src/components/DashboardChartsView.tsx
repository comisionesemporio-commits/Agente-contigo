import React from 'react';
import { ClientPolicy } from '../types';
import { PieChart, BarChart2, TrendingUp, Users, Building, Activity } from 'lucide-react';
import { MONTHS_LIST } from '../services/storage';

interface DashboardChartsViewProps {
  clients: ClientPolicy[];
  selectedYear: string;
}

export const DashboardChartsView: React.FC<DashboardChartsViewProps> = ({
  clients,
  selectedYear
}) => {
  const yearClients = clients.filter(c => String(c.createdYear || "2026") === String(selectedYear));

  // Carriers distribution
  const carrierCounts: Record<string, number> = {};
  yearClients.forEach(c => {
    const car = c.carrier || 'General';
    carrierCounts[car] = (carrierCounts[car] || 0) + 1;
  });

  const carrierEntries = Object.entries(carrierCounts).sort((a, b) => b[1] - a[1]);
  const totalCarrierCount = yearClients.length || 1;

  // Status distribution
  const statusCounts = {
    'Nuevos / Pendientes': yearClients.filter(c => c.estatus === 'Nuevo' || c.estatus === 'Subido / Listo' || c.estatus === 'Pendiente').length,
    'Activos': yearClients.filter(c => c.estatus === 'Activo').length,
    'Cancelados': yearClients.filter(c => c.estatus === 'Cancelado').length,
    'Robados': yearClients.filter(c => c.estatus === 'Robado').length,
  };

  // Monthly intake
  const monthlyIntake = MONTHS_LIST.map(m => {
    const count = yearClients.filter(c => c.mesIngreso === m).length;
    return { month: m, count };
  });

  const maxMonthVal = Math.max(...monthlyIntake.map(m => m.count), 1);

  // Colors for carriers
  const palette = ['#059669', '#06B6D4', '#2563EB', '#D97706', '#9333EA', '#E11D48', '#475569'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart 1: Carrier Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 flex items-center uppercase tracking-wider gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" />
            Distribución por Compañía ({selectedYear})
          </h3>

          <div className="space-y-3 pt-2">
            {carrierEntries.length === 0 ? (
              <div className="text-center p-8 text-slate-400 text-xs">Sin pólizas en este año</div>
            ) : (
              carrierEntries.map(([car, count], idx) => {
                const pct = Math.round((count / totalCarrierCount) * 100);
                const color = palette[idx % palette.length];
                return (
                  <div key={car} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                        {car}
                      </span>
                      <span className="font-mono text-slate-600 font-bold tabular-nums">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 2: Status Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 flex items-center uppercase tracking-wider gap-2">
            <BarChart2 className="w-4 h-4 text-emerald-600" />
            Estatus Global de Clientes ({selectedYear})
          </h3>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-emerald-800 block">Pólizas Activas</span>
              <h4 className="text-2xl font-black text-emerald-900 mt-1 tabular-nums">{statusCounts['Activos']}</h4>
              <span className="text-[10px] text-emerald-700 font-medium">
                {Math.round((statusCounts['Activos'] / totalCarrierCount) * 100)}% del total
              </span>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-blue-800 block">Nuevos / Proceso</span>
              <h4 className="text-2xl font-black text-blue-900 mt-1 tabular-nums">{statusCounts['Nuevos / Pendientes']}</h4>
              <span className="text-[10px] text-blue-700 font-medium">
                {Math.round((statusCounts['Nuevos / Pendientes'] / totalCarrierCount) * 100)}% del total
              </span>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-rose-800 block">Canceladas</span>
              <h4 className="text-2xl font-black text-rose-900 mt-1 tabular-nums">{statusCounts['Cancelados']}</h4>
              <span className="text-[10px] text-rose-700 font-medium">
                {Math.round((statusCounts['Cancelados'] / totalCarrierCount) * 100)}% del total
              </span>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-purple-800 block">Robadas</span>
              <h4 className="text-2xl font-black text-purple-900 mt-1 tabular-nums">{statusCounts['Robados']}</h4>
              <span className="text-[10px] text-purple-700 font-medium">
                {Math.round((statusCounts['Robados'] / totalCarrierCount) * 100)}% del total
              </span>
            </div>
          </div>
        </div>

        {/* Chart 3: Monthly Intake Trend (12 Months) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm md:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 flex items-center uppercase tracking-wider gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              Ingreso de Pólizas por Mes ({selectedYear})
            </h3>
            <span className="text-[11px] font-bold text-slate-500">
              Total {yearClients.length} Pólizas en {selectedYear}
            </span>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-4 items-end h-48 border-b border-slate-100 pb-2">
            {monthlyIntake.map(m => {
              const heightPercent = Math.max(Math.round((m.count / maxMonthVal) * 100), 8);
              return (
                <div key={m.month} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-bold font-mono text-slate-600 opacity-0 group-hover:opacity-100 transition">
                    {m.count}
                  </span>
                  <div className="w-full max-w-[28px] bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end h-32">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        m.count > 0 ? 'bg-gradient-to-t from-emerald-600 to-teal-400' : 'bg-slate-200'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 truncate w-full text-center">
                    {m.month.substring(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
