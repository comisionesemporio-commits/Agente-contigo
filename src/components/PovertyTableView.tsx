import React, { useState } from 'react';
import { Search, Printer, CheckCircle2, Info, Building } from 'lucide-react';
import { FPL_TABLE_2027, NON_EXPANSION_STATES } from '../services/storage';

export const PovertyTableView: React.FC = () => {
  const [stateInput, setStateInput] = useState('');

  const trimmedState = stateInput.trim().toUpperCase();

  // Check if non-expansion (100% FPL)
  const is100State = Object.entries(NON_EXPANSION_STATES).find(
    ([code, name]) => code === trimmedState || name.toUpperCase().includes(trimmedState)
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between no-print px-2 text-xs">
        <span className="font-semibold text-slate-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00c9b7] animate-pulse"></span>
          Material Oficial para Agentes • Tabla FPL 2027
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition shadow-sm border border-slate-200 flex items-center gap-2 cursor-pointer"
        >
          <Printer className="w-4 h-4 text-[#008be3]" />
          <span>Imprimir / Guardar en PDF</span>
        </button>
      </div>

      {/* Verificador Rápido por Estado (No Imprimible) */}
      <div className="no-print bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-[#00c9b7]" />
              Verificador Rápido por Estado
            </h2>
            <p className="text-xs text-slate-500">
              Escribe el estado para ver de inmediato si inicia en 100% o 138% FPL
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={stateInput}
              onChange={e => setStateInput(e.target.value)}
              placeholder="Ej. Florida, TX, NC, California..."
              className="w-full px-4 py-2.5 pl-10 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00c9b7] focus:bg-white transition font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>
        </div>

        {/* State result card */}
        {trimmedState && (
          <div className="mt-4 transition-all">
            {is100State ? (
              <div className="p-4 rounded-2xl bg-teal-50 border border-[#00c9b7]/40 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#00c9b7] text-white font-extrabold text-xs shadow-sm">
                      {is100State[0]}
                    </span>
                    <span className="text-slate-900 font-extrabold text-sm">{is100State[1]}</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-teal-100 text-[#008f82] font-black text-xs">
                    INICIA AL 100% FPL
                  </span>
                </div>
                <p className="text-slate-700 font-medium pt-1">
                  En este estado el subsidio del Mercado (Obamacare) comienza en <strong>100% FPL ($15,960 para 1 persona)</strong>.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-sky-50 border border-[#008be3]/40 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#008be3] text-white font-extrabold text-xs shadow-sm">
                      {trimmedState}
                    </span>
                    <span className="text-slate-900 font-extrabold text-sm">Estado con Expansión Medicaid</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-sky-100 text-[#006fae] font-black text-xs">
                    INICIA AL 138% FPL
                  </span>
                </div>
                <p className="text-slate-700 font-medium pt-1">
                  En este estado las personas con menos del 138% FPL van a Medicaid. El subsidio de Obamacare inicia desde el <strong>138% FPL ($22,025 para 1 persona)</strong>.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FLYER OFICIAL IMPRIMIBLE */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border-none">
        {/* Banner Encabezado */}
        <div className="pt-8 pb-6 px-4 sm:px-8 text-center relative overflow-hidden bg-gradient-to-b from-cyan-50/50 via-white to-white">
          <div className="flex items-center justify-center gap-3 mb-4">
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

          <div className="inline-block bg-gradient-to-r from-[#00c9b7] to-[#008be3] text-white px-8 sm:px-14 py-3 rounded-2xl shadow-md mb-2">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
              TABLA DE POBREZA 2027
            </h1>
          </div>

          <p className="text-sm sm:text-base font-bold text-slate-700 mt-2">
            Para Obamacare / Marketplace (Límites Oficiales FPL)
          </p>
        </div>

        {/* Tabla Principal */}
        <div className="px-3 sm:px-8 pb-6">
          <div className="overflow-x-auto rounded-2xl border border-[#00c9b7]/30 shadow-sm">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-[#00c9b7] to-[#008be3] text-white text-xs sm:text-sm font-extrabold uppercase tracking-wider">
                  <th className="py-3.5 px-3 border-r border-white/20">Personas</th>
                  <th className="py-3.5 px-3 border-r border-white/20 bg-[#00b0a1]">100%</th>
                  <th className="py-3.5 px-3 border-r border-white/20 bg-[#009bd8]">138%</th>
                  <th className="py-3.5 px-3 border-r border-white/20">150%</th>
                  <th className="py-3.5 px-3 border-r border-white/20">200%</th>
                  <th className="py-3.5 px-3 border-r border-white/20">250%</th>
                  <th className="py-3.5 px-3 border-r border-white/20">300%</th>
                  <th className="py-3.5 px-3">400%</th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm font-semibold divide-y divide-slate-100 text-slate-800">
                {FPL_TABLE_2027.map(row => (
                  <tr
                    key={row.personas}
                    className={`hover:bg-cyan-50/40 transition-colors ${
                      row.personas % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'
                    }`}
                  >
                    <td className="py-3 px-3 font-extrabold text-slate-900 border-r border-slate-100">
                      {row.personas}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#008f82] bg-[#00c9b7]/[0.08] border-r border-slate-100 tabular-nums">
                      ${row.fpl100.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#006fae] bg-[#008be3]/[0.08] border-r border-slate-100 tabular-nums">
                      ${row.fpl138.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 border-r border-slate-100 tabular-nums">
                      ${row.fpl150.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 border-r border-slate-100 tabular-nums">
                      ${row.fpl200.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 border-r border-slate-100 tabular-nums">
                      ${row.fpl250.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 border-r border-slate-100 tabular-nums">
                      ${row.fpl300.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 tabular-nums">
                      ${row.fpl400.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pie de Tabla */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3 px-1">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00c9b7]"></span>
                100% = Inicio en FL, TX, GA, etc.
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-[#008be3]"></span>
                138% = Inicio en CA, NY, NC, etc.
              </span>
            </div>

            <span className="font-semibold text-slate-400">Ingresos anuales • 48 estados + DC</span>
          </div>
        </div>

        {/* Footer */}
        <div className="py-3 bg-slate-50 border-t border-slate-100 text-center">
          <span className="text-xs font-bold text-[#008be3] tracking-wide">
            Agente Contigo • Juntos Cuidamos Tu Bienestar
          </span>
        </div>
      </div>
    </div>
  );
};
