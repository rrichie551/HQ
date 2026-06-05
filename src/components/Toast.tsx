'use client';

import { Icon } from './Icon';

export type ToastItem = { id: string; msg: string; icon?: string };

export function Toast({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <Icon name={t.icon ?? 'check'} />
          {t.msg}
        </div>
      ))}
    </div>
  );
}
