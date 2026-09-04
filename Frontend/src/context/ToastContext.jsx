import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((list) => [...list, { id, message, type }]);
    window.setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);

  const api = {
    toast,
    success: (message) => toast(message, 'success'),
    error: (message) => toast(message, 'error'),
    info: (message) => toast(message, 'info'),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-24 right-6 z-[90] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              t.type === 'error' ? 'bg-coral' : t.type === 'info' ? 'bg-blue' : 'bg-mint-deep'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { toast: () => {}, success: () => {}, error: () => {}, info: () => {} };
  }
  return ctx;
};
