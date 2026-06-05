import React from 'react';

type IconName =
  | 'mail' | 'calendar' | 'chat' | 'brain' | 'bell' | 'check' | 'checkSmall'
  | 'slack' | 'close' | 'lock' | 'arrowUp' | 'arrowDown' | 'inbox'
  | 'sparkleEmpty' | 'activity' | 'x';

export function Icon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const p = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<string, React.ReactNode> = {
    mail: (<><rect x="3" y="5" width="18" height="14" rx="2.5" {...p} /><path d="M3.5 7l8.5 6 8.5-6" {...p} /></>),
    calendar: (<><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" {...p} /><path d="M3.5 9h17M8 3v3M16 3v3" {...p} /><circle cx="8" cy="13.5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="13.5" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="13.5" r="1" fill="currentColor" stroke="none" /></>),
    chat: (<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V17H4A1.5 1.5 0 0 1 2.5 15.5V7A1.5 1.5 0 0 1 4 5.5Z" {...p} />),
    brain: (<path d="M9.5 4.5A2.5 2.5 0 0 0 7 7a2.5 2.5 0 0 0-1.5 4.3A2.5 2.5 0 0 0 7 16a2.3 2.3 0 0 0 2.5 2.2V4.5Zm5 0A2.5 2.5 0 0 1 17 7a2.5 2.5 0 0 1 1.5 4.3A2.5 2.5 0 0 1 17 16a2.3 2.3 0 0 1-2.5 2.2V4.5Z" {...p} />),
    bell: (<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm3.5 9a2.5 2.5 0 0 0 5 0" {...p} />),
    check: (<path d="M5 12.5l4.5 4.5L19 7" {...p} />),
    checkSmall: (<path d="M4 8.5l3 3L13 5" {...p} />),
    slack: (<path d="M9 14a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5Zm4-5a2 2 0 1 1 2 2h-2V9Zm-1 0a2 2 0 1 1-4 0V4a2 2 0 1 1 4 0v5Z" fill="currentColor" stroke="none" />),
    close: (<path d="M6 6l12 12M18 6L6 18" {...p} />),
    x: (<path d="M6 6l12 12M18 6L6 18" {...p} />),
    lock: (<><rect x="5" y="11" width="14" height="9" rx="2" {...p} /><path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} /></>),
    arrowUp: (<path d="M12 19V5M6 11l6-6 6 6" {...p} />),
    arrowDown: (<path d="M12 5v14M6 13l6 6 6-6" {...p} />),
    inbox: (<><path d="M3.5 13h4l1.5 2.5h6L16.5 13h4" {...p} /><path d="M5 5.5h14l1.5 7.5v4a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17v-4L5 5.5Z" {...p} /></>),
    sparkleEmpty: (<><path d="M12 4v3M12 17v3M4 12h3M17 12h3" {...p} /><circle cx="12" cy="12" r="4.5" {...p} /><path d="M12 9.5v2.5l1.8 1.8" {...p} /></>),
    activity: (<path d="M3 12h4l2.5-7 5 14L17 12h4" {...p} />),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      {paths[name] ?? paths.activity}
    </svg>
  );
}

export type { IconName };
