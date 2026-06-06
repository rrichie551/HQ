'use client';

import { AdminFileEditor } from '@/components/AdminFileEditor';

type MemFile = { name: string; size: number; modified: string };

export function MemoryClient({ initialFiles, initialName }: { initialFiles: MemFile[]; initialName?: string }) {
  return (
    <AdminFileEditor
      items={initialFiles}
      initialName={initialName}
      createLabel="+ New memory file"
      emptyMessage="No memory files yet."
      fetchItem={async (name) => {
        const res = await fetch(`/api/admin/memory?name=${encodeURIComponent(name)}`);
        if (!res.ok) return null;
        const j = await res.json();
        return { content: j.content };
      }}
      saveItem={async (name, content) => {
        const res = await fetch('/api/admin/memory', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, content }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          return { ok: false, error: j.error ?? 'save failed' };
        }
        return { ok: true };
      }}
    />
  );
}
