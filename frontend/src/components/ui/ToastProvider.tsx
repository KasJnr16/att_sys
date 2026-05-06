'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { toast, ToastPayload, ToastVariant } from '@/lib/toast';

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald-500/30 bg-slate-950/95 text-white shadow-emerald-950/20',
  error: 'border-rose-500/30 bg-slate-950/95 text-white shadow-rose-950/20',
  info: 'border-indigo-500/30 bg-slate-950/95 text-white shadow-indigo-950/20',
};

const accentStyles: Record<ToastVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-300',
  error: 'bg-rose-500/15 text-rose-300',
  info: 'bg-indigo-500/15 text-indigo-300',
};

const IconByVariant = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
};

export const ToastProvider = () => {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  useEffect(() => {
    return toast.subscribe((incomingToast) => {
      setToasts((current) => [...current, incomingToast]);
    });
  }, []);

  useEffect(() => {
    const timers = toasts.map((item) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id));
      }, item.duration ?? 4000)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  const dismissToast = (id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((item) => {
        const Icon = IconByVariant[item.variant];

        return (
          <div
            key={item.id}
            className={`pointer-events-auto overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl ${variantStyles[item.variant]}`}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="flex items-start gap-3 p-4">
              <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${accentStyles[item.variant]}`}>
                <Icon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
