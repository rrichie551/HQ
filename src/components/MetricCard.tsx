import { Icon } from './Icon';
import { SparkLine } from './SparkLine';

export type MetricItem = {
  id: string;
  label: string;
  value: string;
  trend: string;
  dir: 'up-good' | 'up-bad' | 'down-good' | 'flat';
  spark?: number[];
};

export function MetricCard({ m }: { m: MetricItem }) {
  const arrow = m.dir.startsWith('down') ? 'arrowDown' : m.dir === 'flat' ? 'arrowUp' : 'arrowUp';
  return (
    <div className="metric">
      <div className="metric-label">{m.label}</div>
      <div className="metric-row">
        <span className="metric-value">{m.value}</span>
        <span className={`metric-trend ${m.dir}`}>
          <Icon name={arrow} style={{ width: 11, height: 11 }} />
          {m.trend.replace(/^[+−-]/, '')}
        </span>
      </div>
      <SparkLine data={m.spark ?? []} />
    </div>
  );
}
