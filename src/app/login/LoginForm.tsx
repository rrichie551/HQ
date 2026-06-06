'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Icon } from '@/components/Icon';

function Form() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get('callbackUrl') ?? '/dashboard';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await signIn('credentials', { password, redirect: false, callbackUrl });
    setBusy(false);
    if (res?.ok) {
      // Hard navigation so the server re-evaluates the session (and the
      // header re-renders with the new role).
      window.location.href = callbackUrl;
    } else {
      setErr('Incorrect password.');
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="logo-mark" style={{ width: 44, height: 44, borderRadius: 11 }}>
          <span style={{ fontSize: 17 }}>FW</span>
        </div>
        <h1>Mission Control</h1>
        <p>Sign in with your team's dashboard password — or with the owner password to unlock /admin.</p>
        <form onSubmit={submit}>
          <label htmlFor="pw">Password</label>
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          {err && <div className="err">{err}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 16 }}>
            {busy ? 'Signing in…' : (<><Icon name="check" /> Sign in</>)}
          </button>
        </form>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="login-shell" />}>
      <Form />
    </Suspense>
  );
}
