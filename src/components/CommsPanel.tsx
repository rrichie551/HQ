'use client';

import { Icon } from './Icon';

export type CommThread = {
  from: { slug: string; name: string; role?: string; icon: string; color: string; tint: string };
  to: { slug: string; name: string; role?: string; icon: string; color: string; tint: string };
  topic: string;
  summary: string;
  log: { who: 'a' | 'b'; time: string; msg: string }[];
};

export function CommsPanel({ open, thread, onClose }: { open: boolean; thread: CommThread | null; onClose: () => void }) {
  return (
    <>
      <div className={`overlay-backdrop${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`comms-panel${open ? ' show' : ''}`} aria-hidden={!open}>
        {thread && (
          <>
            <div className="cp-head">
              <div>
                <div className="cp-title">Inter-agent comms</div>
                <div className="cp-sub">{thread.summary}</div>
              </div>
              <button className="cp-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
            </div>

            <div className="node-diagram">
              <div className="node">
                <div className="n-ava" style={{ background: thread.from.tint, color: thread.from.color }}><Icon name={thread.from.icon} /></div>
                <div className="n-name">{thread.from.name}</div>
                <div className="n-role">{thread.from.role ?? ''}</div>
              </div>
              <div className="node-link">
                <svg viewBox="0 0 120 80" preserveAspectRatio="none">
                  <path className="dash" d="M2 40 H118" />
                </svg>
                <span className="node-tag">{thread.topic}</span>
              </div>
              <div className="node">
                <div className="n-ava" style={{ background: thread.to.tint, color: thread.to.color }}><Icon name={thread.to.icon} /></div>
                <div className="n-name">{thread.to.name}</div>
                <div className="n-role">{thread.to.role ?? ''}</div>
              </div>
            </div>

            <div className="cp-log scroll">
              {thread.log.map((line, i) => {
                const who = line.who === 'a' ? thread.from : thread.to;
                return (
                  <div key={i} className={`chat ${line.who}`}>
                    <span className="c-ava" style={{ background: who.tint, color: who.color }}><Icon name={who.icon} /></span>
                    <div className="c-bubble">
                      <div className="c-who">{who.name}</div>
                      <div className="c-msg">{line.msg}</div>
                      <div className="c-time">{line.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
