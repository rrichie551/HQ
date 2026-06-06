'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

type Item = { name: string; size: number; modified: string; preview?: string };

export function AdminFileEditor({
  items,
  fetchItem,
  saveItem,
  deleteItem,
  createLabel,
  emptyMessage,
  initialName,
}: {
  items: Item[];
  fetchItem: (name: string) => Promise<{ content: string; modified?: string } | null>;
  saveItem: (name: string, content: string) => Promise<{ ok: boolean; error?: string }>;
  deleteItem?: (name: string) => Promise<{ ok: boolean; error?: string }>;
  createLabel: string;
  emptyMessage: string;
  initialName?: string;
}) {
  const [current, setCurrent] = useState<string | null>(initialName ?? items[0]?.name ?? null);
  const [content, setContent] = useState<string>('');
  const [original, setOriginal] = useState<string>('');
  const [busy, setBusy] = useState<null | 'load' | 'save' | 'del'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    let alive = true;
    if (!current) {
      setContent(''); setOriginal('');
      return () => { alive = false; };
    }
    setBusy('load'); setErr(null);
    fetchItem(current).then((res) => {
      if (!alive) return;
      if (!res) setErr('Not found');
      else { setContent(res.content); setOriginal(res.content); }
      setBusy(null);
    }).catch((e) => {
      if (!alive) return;
      setErr(String(e)); setBusy(null);
    });
    return () => { alive = false; };
  }, [current, fetchItem]);

  const dirty = content !== original;

  async function onSave() {
    if (!current) return;
    setBusy('save'); setErr(null);
    const res = await saveItem(current, content);
    setBusy(null);
    if (!res.ok) setErr(res.error ?? 'save failed');
    else setOriginal(content);
  }

  async function onDelete() {
    if (!current || !deleteItem) return;
    if (!confirm(`Delete ${current}? This cannot be undone.`)) return;
    setBusy('del'); setErr(null);
    const res = await deleteItem(current);
    setBusy(null);
    if (!res.ok) setErr(res.error ?? 'delete failed');
    else location.reload();
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy('save'); setErr(null);
    const res = await saveItem(newName.trim(), '');
    setBusy(null);
    if (!res.ok) { setErr(res.error ?? 'create failed'); return; }
    location.href = `?name=${encodeURIComponent(newName.trim())}`;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn-outline" onClick={() => setCreating((c) => !c)}>
          <Icon name="check" /> {createLabel}
        </button>
        {creating && (
          <form onSubmit={onCreate} className="draft-section" style={{ padding: 12 }}>
            <input
              autoFocus
              placeholder="filename.md"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={busy === 'save'}>Create</button>
              <button type="button" className="btn btn-outline" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <div className="lane-empty" style={{ padding: 24 }}><p>{emptyMessage}</p></div>
        ) : (
          items.map((it) => (
            <button
              key={it.name}
              onClick={() => setCurrent(it.name)}
              className="mission"
              style={{
                textAlign: 'left',
                padding: 12,
                borderColor: current === it.name ? 'var(--accent)' : 'var(--border-soft)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{it.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {(it.size / 1024).toFixed(1)}kb · {new Date(it.modified).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
              {it.preview && (
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 36, overflow: 'hidden' }}>
                  {it.preview}
                </div>
              )}
            </button>
          ))
        )}
      </div>

      <div className="draft-editor">
        <div className="draft-section">
          {current ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{current}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {deleteItem && (
                    <button className="btn btn-outline" onClick={onDelete} disabled={busy !== null} style={{ flex: 'none' }}>
                      {busy === 'del' ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={onSave} disabled={!dirty || busy !== null} style={{ flex: 'none' }}>
                    <Icon name="check" /> {busy === 'save' ? 'Saving…' : dirty ? 'Save' : 'Saved'}
                  </button>
                </div>
              </div>
              {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
              <textarea
                rows={26}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                disabled={busy === 'load'}
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
              />
            </>
          ) : (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 32, fontSize: 13 }}>
              Select a file on the left or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
