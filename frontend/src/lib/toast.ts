'use client';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastPayload {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

type ToastInput = Omit<ToastPayload, 'id' | 'variant'> & {
  variant?: ToastVariant;
};

type ToastListener = (toast: ToastPayload) => void;

const listeners = new Set<ToastListener>();
let counter = 0;

const emit = (input: ToastInput): string => {
  const id = `toast-${Date.now()}-${counter++}`;
  const toast: ToastPayload = {
    id,
    title: input.title,
    description: input.description,
    variant: input.variant ?? 'info',
    duration: input.duration ?? 4000,
  };

  listeners.forEach((listener) => listener(toast));
  return id;
};

export const toast = {
  show: emit,
  success: (title: string, description?: string, duration?: number) =>
    emit({ title, description, duration, variant: 'success' }),
  error: (title: string, description?: string, duration?: number) =>
    emit({ title, description, duration, variant: 'error' }),
  info: (title: string, description?: string, duration?: number) =>
    emit({ title, description, duration, variant: 'info' }),
  subscribe(listener: ToastListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
