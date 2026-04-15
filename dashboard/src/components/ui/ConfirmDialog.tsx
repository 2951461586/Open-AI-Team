'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfirmType = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
  markdown?: string;
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const TYPE_CONFIG = {
  danger: {
    icon: AlertTriangle,
    iconClass: 'text-[var(--danger)]',
    bgClass: 'bg-[var(--danger-soft)]',
    buttonClass: 'bg-[var(--danger)] hover:opacity-90',
  },
  warning: {
    icon: AlertCircle,
    iconClass: 'text-[var(--warning)]',
    bgClass: 'bg-[var(--warning-soft)]',
    buttonClass: 'bg-[var(--warning)] hover:opacity-90',
  },
  info: {
    icon: Info,
    iconClass: 'text-[var(--accent)]',
    bgClass: 'bg-[var(--accent-soft)]',
    buttonClass: 'bg-[var(--accent)] hover:opacity-90',
  },
};

function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  markdown,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const [showMarkdown, setShowMarkdown] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
        if (e.key === 'Enter' && !loading) onConfirm();
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onCancel, onConfirm, loading]);

  if (!open) return null;

  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        className="relative w-full max-w-md mx-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl animate-scale-in"
      >
        <div className="flex items-start gap-4 p-6">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', config.bgClass)}>
            <Icon className={cn('h-6 w-6', config.iconClass)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-[var(--fg)]">{title}</h3>
            {message && (
              <p className="mt-1.5 text-sm text-[var(--fg-muted)]">{message}</p>
            )}
            {markdown && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowMarkdown(!showMarkdown)}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {showMarkdown ? 'Hide details' : 'Show details'}
                </button>
                {showMarkdown && (
                  <pre className="mt-2 p-3 rounded-lg bg-[var(--surface-subtle)] text-xs text-[var(--fg-muted)] overflow-auto max-h-40 whitespace-pre-wrap">
                    {markdown}
                  </pre>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 p-2 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--fg-muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-subtle)] disabled:opacity-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-opacity',
              config.buttonClass
            )}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmDanger: (title: string, message?: string, markdown?: string) => Promise<boolean>;
  confirmWarning: (title: string, message?: string, markdown?: string) => Promise<boolean>;
}

const ConfirmContext = typeof window !== 'undefined' ? createEmptyContext<ConfirmContextValue>() : null;

function createEmptyContext<T>() {
  return { current: null } as React.MutableRefObject<T | null>;
}

let confirmRef: React.MutableRefObject<ConfirmContextValue | null> | null = null;

if (typeof window !== 'undefined') {
  confirmRef = createEmptyContext<ConfirmContextValue>();
}

export function useConfirm() {
  const ref = confirmRef;
  if (!ref) {
    return {
      confirm: async () => false,
      confirmDanger: async () => false,
      confirmWarning: async () => false,
    };
  }

  const ctx = ref.current;
  if (!ctx) {
    return {
      confirm: async () => false,
      confirmDanger: async () => false,
      confirmWarning: async () => false,
    };
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({ open: false, options: null, resolve: null });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const confirmDanger = useCallback((title: string, message?: string, markdown?: string) => {
    return confirm({ title, message, type: 'danger', markdown });
  }, [confirm]);

  const confirmWarning = useCallback((title: string, message?: string, markdown?: string) => {
    return confirm({ title, message, type: 'warning', markdown });
  }, [confirm]);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState({ open: false, options: null, resolve: null });
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState({ open: false, options: null, resolve: null });
  }, [state.resolve]);

  useEffect(() => {
    if (confirmRef) {
      confirmRef.current = { confirm, confirmDanger, confirmWarning };
    }
  }, [confirm, confirmDanger, confirmWarning]);

  return (
    <>
      {children}
      {state.open && state.options && (
        <ConfirmDialog
          open={state.open}
          {...state.options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}

export default ConfirmDialog;
