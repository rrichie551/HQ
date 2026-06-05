import { DashboardClient } from '@/components/DashboardClient';
import { loadDashboardData } from '@/lib/dashboard-data';
import { getClientConfig } from '@/lib/client-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const client = getClientConfig();
  const data = await loadDashboardData();
  const filters = [
    { id: 'all', label: 'All Agents' },
    ...data.agents.map((a) => ({ id: a.slug, label: a.name, color: a.color })),
  ];
  return <DashboardClient client={client} initial={data} filters={filters} />;
}
