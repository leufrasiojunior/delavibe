"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
};

type ToastContextValue = {
  show: (input: { type: ToastType; message: string; durationMs?: number }) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4500;

let counter = 0;
function nextId() {
  counter += 1;
  return `toast-${counter}-${Date.now()}`;
}

const TYPE_LABEL: Record<ToastType, string> = {
  success: "Sucesso",
  error: "Erro",
  info: "Aviso",
};

const TYPE_ICON: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "i",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (input: { type: ToastType; message: string; durationMs?: number }) => {
      const id = nextId();
      const durationMs = input.durationMs ?? DEFAULT_DURATION_MS;
      setToasts((current) => [...current, { id, type: input.type, message: input.message, durationMs }]);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, durationMs) => show({ type: "success", message, durationMs }),
      error: (message, durationMs) => show({ type: "error", message, durationMs }),
      info: (message, durationMs) => show({ type: "info", message, durationMs }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const handle = window.setTimeout(onDismiss, toast.durationMs);
    return () => window.clearTimeout(handle);
  }, [toast.durationMs, onDismiss]);

  return (
    <div className={`toast toast-${toast.type}`} role="status">
      <span className="toast-icon" aria-hidden>
        {TYPE_ICON[toast.type]}
      </span>
      <div className="toast-body">
        <strong>{TYPE_LABEL[toast.type]}</strong>
        <span>{toast.message}</span>
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label="Fechar notificação"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast precisa estar dentro de <ToastProvider>");
  }
  return ctx;
}
