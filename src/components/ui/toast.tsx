"use client";

// Minimal toast system. We have @radix-ui/react-toast in deps but no
// UI was built on top of it, so this is a tiny self-contained context-
// based replacement: provider holds an array, each entry auto-dismisses
// after 4.5s, and components call useToast().toast({...}) to show one.
//
// API mirrors sonner / shadcn-toast so it can be swapped later without
// touching call sites.

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "error";
type Toast = { id: number; title?: string; description?: string; variant?: Variant };

type ToastCtx = {
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((p) => p.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { ...t, id }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <Ctx.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </Ctx.Provider>
  );
}

function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ t, onClose }: { t: Toast; onClose: () => void }) {
  const variant = t.variant ?? "default";
  const styles = {
    default: "bg-white border-slate-200",
    success: "bg-emerald-50 border-emerald-300",
    error: "bg-rose-50 border-rose-300",
  };
  const Icon = variant === "success" ? CheckCircle2 : variant === "error" ? AlertCircle : null;
  const iconColor = variant === "success" ? "text-emerald-600" : variant === "error" ? "text-rose-600" : "";
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto rounded-lg border shadow-lg px-4 py-3 flex items-start gap-3 animate-in slide-in-from-top-2 fade-in duration-200",
        styles[variant]
      )}
    >
      {Icon && <Icon size={18} className={cn("mt-0.5 shrink-0", iconColor)} />}
      <div className="flex-1 min-w-0">
        {t.title && <div className="text-sm font-semibold text-slate-900">{t.title}</div>}
        {t.description && <div className="text-sm text-slate-700 mt-0.5 break-words">{t.description}</div>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-slate-400 hover:text-slate-700 shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
