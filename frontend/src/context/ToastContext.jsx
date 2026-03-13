import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

let _nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = "info", duration = 3500) => {
      const id = ++_nextId;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const toastSuccess = useCallback((msg) => toast(msg, "success"), [toast]);
  const toastError   = useCallback((msg) => toast(msg, "error", 5000), [toast]);
  const toastInfo    = useCallback((msg) => toast(msg, "info"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, toastSuccess, toastError, toastInfo }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} role="alert">
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                opacity: 0.6,
                fontSize: "1rem",
                lineHeight: 1,
                color: "inherit",
                padding: "0 0.1rem",
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
