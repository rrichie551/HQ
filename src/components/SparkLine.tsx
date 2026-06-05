'use client';

import { useId } from 'react';

export function SparkLine({ data, color = '#C0603C', w = 100, h = 26 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const id = useId().replace(/:/g, '');
  if (!data || data.length < 2) {
    return <svg className="metric-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - 3 - ((v - min) / range) * (h - 6)] as const);
  const line = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className="metric-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />
    </svg>
  );
}
