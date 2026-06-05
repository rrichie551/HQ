'use client';

import { useState } from 'react';
import { Icon } from './Icon';

export type FeedItem = {
  id: string;
  kind: 'task' | 'email' | 'comms' | 'memory' | 'flag';
  agent_slug: string;
  agent_name: string;
  agent_color: string;
  agent_tint: string;
  agent_icon: string;
  description: string;
  created_at: string;
  comm?: { to_slug: string; to_name: string; to_color: string; to_tint: string; to_icon: string; topic: string };
};

function relTime(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function FeedEntry({ e, fresh, onOpenComms }: { e: FeedItem; fresh?: boolean; onOpenComms?: (e: FeedItem) => void }) {
  if (e.kind === 'comms' && e.comm) {
    return (
      <div className={`feed-entry${fresh ? ' fresh' : ''}`}>
        <span className="fe-ava" style={{ background: 'var(--accent-tint-2)', color: 'var(--accent)' }}>
          <Icon name="activity" />
        </span>
        <div className="fe-body">
          <div className="fe-text" dangerouslySetInnerHTML={{ __html: e.description }} />
          <div className="fe-tag" onClick={() => onOpenComms?.(e)}>
            <span className="comms-chips">
              <span className="ac-ava" style={{ width: 14, height: 14, borderRadius: 4, display: 'inline-grid', placeItems: 'center', background: e.agent_tint, color: e.agent_color }}><Icon name={e.agent_icon} /></span>
              {e.agent_name}
              <span className="comms-swap">↔</span>
              <span className="ac-ava" style={{ width: 14, height: 14, borderRadius: 4, display: 'inline-grid', placeItems: 'center', background: e.comm.to_tint, color: e.comm.to_color }}><Icon name={e.comm.to_icon} /></span>
              {e.comm.to_name}
            </span>
            · {e.comm.topic}
          </div>
          <div className="fe-time">{relTime(e.created_at)}</div>
        </div>
      </div>
    );
  }
  return (
    <div className={`feed-entry${fresh ? ' fresh' : ''}`}>
      <span className="fe-ava" style={{ background: e.agent_tint, color: e.agent_color }}><Icon name={e.agent_icon} /></span>
      <div className="fe-body">
        <div className="fe-text" dangerouslySetInnerHTML={{ __html: e.description }} />
        <div className="fe-time">{relTime(e.created_at)}</div>
      </div>
    </div>
  );
}

const FEED_TABS = [
  { id: 'all', label: 'All' },
  { id: 'task', label: 'Tasks' },
  { id: 'email', label: 'Email' },
  { id: 'comms', label: 'Comms' },
];

export function FeedBody({ feed, onOpenComms, freshId }: { feed: FeedItem[]; onOpenComms?: (e: FeedItem) => void; freshId?: string | null }) {
  const [tab, setTab] = useState<string>('all');
  const list = tab === 'all' ? feed : feed.filter((e) => e.kind === tab);
  return (
    <>
      <div className="feed-tabs">
        {FEED_TABS.map((t) => (
          <button key={t.id} className={`feed-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="feed-list scroll">
        {list.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 12, textAlign: 'center' }}>
            No activity in this view yet.
          </div>
        ) : list.map((e) => <FeedEntry key={e.id} e={e} fresh={e.id === freshId} onOpenComms={onOpenComms} />)}
      </div>
    </>
  );
}

export function RightColumn({
  metrics,
  feed,
  freshId,
  onOpenComms,
  children,
}: {
  metrics: React.ReactNode;
  feed: FeedItem[];
  freshId?: string | null;
  onOpenComms?: (e: FeedItem) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="col col-feed desktop-only">
      <div className="col-head">
        <span className="col-title">This Week</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>vs. last week</span>
      </div>
      <div className="metrics-grid">{metrics}</div>
      {children}
      <div className="feed-section">
        <div className="feed-head">
          <span className="col-title">Live Feed</span>
          <span className="count-badge" style={{ background: 'var(--bg)' }}>
            <span className="dot" style={{ background: 'var(--running)' }} /> live
          </span>
        </div>
        <FeedBody feed={feed} onOpenComms={onOpenComms} freshId={freshId} />
      </div>
    </div>
  );
}
