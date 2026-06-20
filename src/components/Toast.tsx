'use client';
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastProps = {
  toasts: ToastItem[];
  onRemove: (id: number) => void;
};

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 lg:bottom-6">
      {toasts.map((t) => (
        <ToastBubble key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastBubble({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, 2500);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const bg =
    toast.type === 'success' ? 'bg-pink text-white' :
    toast.type === 'error'   ? 'bg-red-500 text-white' :
                               'bg-ink text-white';

  const icon =
    toast.type === 'success' ? '✓' :
    toast.type === 'error'   ? '✕' : 'ℹ';

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black shadow-floating transition-all duration-300 ${bg} ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-xs">{icon}</span>
      {toast.message}
    </div>
  );
}
