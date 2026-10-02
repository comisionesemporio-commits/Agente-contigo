import React, { useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { getMasterPin } from '../../services/storage';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [pin, setPin] = useState('');
  const [hasError, setHasError] = useState(false);

  if (!isOpen) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === getMasterPin()) {
      setPin('');
      setHasError(false);
      onSuccess();
    } else {
      setHasError(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 text-center space-y-4">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl mx-auto border border-amber-200">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 uppercase">
            Acceso Protegido a Comisiones
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Ingresa la clave maestra para ver comisiones y montos.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-3">
          <div>
            <input
              type="password"
              autoFocus
              value={pin}
              onChange={e => { setPin(e.target.value); setHasError(false); }}
              placeholder="••••••••"
              className="w-full text-center tracking-widest text-lg font-extrabold py-2.5 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            {hasError && (
              <p className="text-[11px] text-rose-600 font-bold mt-1.5 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Clave maestra incorrecta. Intenta nuevamente.</span>
              </p>
            )}
          </div>

          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-1/2 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer"
            >
              Ingresar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
