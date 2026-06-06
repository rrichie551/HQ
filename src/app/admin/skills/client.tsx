'use client';

import { AdminFileEditor } from '@/components/AdminFileEditor';

type Skill = { name: string; size: number; modified: string; preview?: string };

export function SkillsClient({ initialSkills, initialName }: { initialSkills: Skill[]; initialName?: string }) {
  return (
    <AdminFileEditor
      items={initialSkills}
      initialName={initialName}
      createLabel="+ New skill"
      emptyMessage="No skills found. Create your first one above."
      fetchItem={async (name) => {
        const res = await fetch(`/api/admin/skills/${encodeURIComponent(name)}`);
        if (!res.ok) return null;
        const j = await res.json();
        return { content: j.content };
      }}
      saveItem={async (name, content) => {
        const res = await fetch('/api/admin/skills', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, content }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          return { ok: false, error: j.error ?? 'save failed' };
        }
        return { ok: true };
      }}
      deleteItem={async (name) => {
        const res = await fetch(`/api/admin/skills/${encodeURIComponent(name)}`, { method: 'DELETE' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          return { ok: false, error: j.error ?? 'delete failed' };
        }
        return { ok: true };
      }}
    />
  );
}
