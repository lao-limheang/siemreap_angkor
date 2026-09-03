import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ModalContext = createContext(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}

export default function ModalProvider({ children }) {
  const [modal, setModal] = useState(null);
  const resolveRef = useRef(null);

  /**
   * Show an alert-style modal popup (replaces native alert()).
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {string} title
   * @param {string} message
   */
  const showModal = useCallback((type, title, message) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModal({ mode: 'alert', type, title, message });
    });
  }, []);

  /**
   * Show a confirm-style modal popup (replaces native confirm()).
   * Returns a Promise<boolean>.
   * @param {string} title
   * @param {string} message
   * @param {string} [confirmLabel='Confirm']
   * @param {'danger'|'warning'|'info'} [type='warning']
   */
  const showConfirm = useCallback((title, message, confirmLabel = 'Confirm', type = 'warning') => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModal({ mode: 'confirm', type, title, message, confirmLabel });
    });
  }, []);

  const handleClose = useCallback((result = false) => {
    if (resolveRef.current) resolveRef.current(result);
    resolveRef.current = null;
    setModal(null);
  }, []);

  const iconMap = {
    success: 'fa-circle-check',
    error: 'fa-triangle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info',
    danger: 'fa-triangle-exclamation'
  };

  const colorMap = {
    success: 'bg-emerald-100 text-emerald-600',
    error: 'bg-rose-100 text-rose-600',
    warning: 'bg-amber-100 text-amber-600',
    info: 'bg-blue-100 text-blue-600',
    danger: 'bg-rose-100 text-rose-600'
  };

  const btnColorMap = {
    success: 'bg-emerald-600 hover:bg-emerald-700',
    error: 'bg-rose-600 hover:bg-rose-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    info: 'bg-blue-600 hover:bg-blue-700',
    danger: 'bg-rose-600 hover:bg-rose-700'
  };

  return (
    <ModalContext.Provider value={{ showModal, showConfirm }}>
      {children}

      {/* Global Modal Overlay */}
      {modal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
          onClick={() => handleClose(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 text-center"
            style={{ animation: 'zoomIn 0.15s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-4 ${colorMap[modal.type] || colorMap.info}`}>
              <i className={`fa-solid ${iconMap[modal.type] || iconMap.info}`}></i>
            </div>

            {/* Title */}
            <h4 className="font-bold text-lg text-stone-900 mb-2">{modal.title}</h4>

            {/* Message */}
            <p className="text-sm text-stone-500 mb-6 leading-relaxed whitespace-pre-line">{modal.message}</p>

            {/* Buttons */}
            {modal.mode === 'alert' ? (
              <button
                onClick={() => handleClose(true)}
                className={`w-full px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-colors shadow-sm ${btnColorMap[modal.type] || btnColorMap.info}`}
                autoFocus
              >
                OK
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => handleClose(false)}
                  className="flex-1 px-5 py-2.5 bg-white border border-stone-200 text-stone-700 text-sm font-bold rounded-xl hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleClose(true)}
                  className={`flex-1 px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-colors shadow-sm ${btnColorMap[modal.type] || btnColorMap.danger}`}
                  autoFocus
                >
                  {modal.confirmLabel || 'Confirm'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </ModalContext.Provider>
  );
}
