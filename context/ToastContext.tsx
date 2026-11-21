'use client';

// The toast host: the thing that makes a failure nobody wrote a handler for
// visible anyway. Every rejected request reaches it through lib/toastBus, and
// components can raise their own messages with useToast().
//
// Behaviour, from the design:
// - bottom-right on desktop, above the bottom navigation on mobile
// - auto-dismiss after 8 seconds, dismissible early
// - identical consecutive messages collapse into one with a count, so one
//   broken thing cannot stack a wall of popups
// - a connection failure replaces itself instead of counting up: with three
//   polling pages, an outage would otherwise tick upward forever

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useT } from '@/context/I18nContext';
import { describeError, describeKind, type ErrorKind } from '@/lib/errors';
import { onToast, type ToastRequest } from '@/lib/toastBus';

const DISMISS_MS = 8000;
const MAX_VISIBLE = 3;

type Tone = 'error' | 'success';

interface Toast {
  id: number;
  text: string;
  tone: Tone;
  repeats: number;      // 1 = shown once
  countable: boolean;   // false for connection failures: they replace themselves
}

interface ToastValue {
  showError: (e: unknown) => void;
  showMessage: (text: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  // A component outside the provider should not crash for want of a popup.
  return value ?? { showError: () => {}, showMessage: () => {} };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const arm = useCallback((id: number) => {
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(id, setTimeout(() => dismiss(id), DISMISS_MS));
  }, [dismiss]);

  const push = useCallback((text: string, tone: Tone, countable: boolean) => {
    if (!text) return;
    setToasts(prev => {
      const twin = prev.find(toast => toast.text === text && toast.tone === tone);
      if (twin) {
        // Same message again: keep one line on screen, restart its clock, and
        // count it only where counting tells the reader something.
        arm(twin.id);
        return countable
          ? prev.map(toast => (toast.id === twin.id ? { ...toast, repeats: toast.repeats + 1 } : toast))
          : prev;
      }
      const id = nextId.current++;
      arm(id);
      const next = [...prev, { id, text, tone, repeats: 1, countable }];
      // Drop the oldest rather than growing a column off the screen.
      return next.slice(-MAX_VISIBLE);
    });
  }, [arm]);

  const showMessage = useCallback((text: string, tone: Tone = 'success') => {
    push(text, tone, true);
  }, [push]);

  const showErrorKind = useCallback((kind: ErrorKind) => {
    // A connection failure is not countable: see the note at the top.
    push(describeKind(kind, t), 'error', kind.kind !== 'offline');
  }, [push, t]);

  const showError = useCallback((e: unknown) => {
    push(describeError(e, t), 'error', true);
  }, [push, t]);

  // Everything the axios interceptor rejects arrives here.
  useEffect(() => {
    return onToast((request: ToastRequest) => {
      if (request.tone === 'success') return showMessage(request.text, 'success');
      if ('text' in request) return push(request.text, 'error', true);
      showErrorKind(request.error);
    });
  }, [push, showMessage, showErrorKind]);

  // Clear pending timers on unmount so nothing fires into a dead tree.
  useEffect(() => {
    const pending = timers.current;
    return () => { pending.forEach(clearTimeout); pending.clear(); };
  }, []);

  return (
    <ToastContext.Provider value={{ showError, showMessage }}>
      {children}
      {/* Above the mobile bottom navigation (fixed, ~64px) and clear of the
          desktop edge. aria-live so a screen reader hears the failure too. */}
      <div aria-live="polite" aria-atomic="false"
        className="fixed z-[100] bottom-24 left-4 right-4 md:bottom-6 md:right-6 md:left-auto md:w-96 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-lg border backdrop-blur ${
              toast.tone === 'error'
                ? 'bg-error-container/95 border-error/40'
                : 'bg-surface-container-lowest/95 border-outline-variant/40'
            }`}>
            <span className={`material-symbols-outlined text-[20px] shrink-0 ${
              toast.tone === 'error' ? 'text-error' : 'text-primary'
            }`}>
              {toast.tone === 'error' ? 'error' : 'check_circle'}
            </span>
            <p className="text-sm font-semibold text-on-surface flex-1 break-words">
              {toast.text}
              {toast.repeats > 1 && (
                <span className="ml-1.5 font-bold text-on-surface-variant">×{toast.repeats}</span>
              )}
            </p>
            <button onClick={() => dismiss(toast.id)} aria-label={t('common.dismiss')}
              className="text-on-surface-variant hover:text-on-surface shrink-0">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
