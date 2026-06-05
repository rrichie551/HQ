import { NextResponse } from 'next/server';
import { currentWeek, pctTrend, formatSeconds } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { this_week, last_week } = await currentWeek();
  return NextResponse.json({
    this_week,
    last_week,
    metrics: [
      {
        id: 'msg',
        label: 'Messages handled',
        value: this_week.messages_handled.toLocaleString(),
        ...pctTrend(this_week.messages_handled, last_week.messages_handled),
      },
      {
        id: 'draft',
        label: 'Drafts for approval',
        value: this_week.drafts_created.toLocaleString(),
        ...pctTrend(this_week.drafts_created, last_week.drafts_created),
      },
      {
        id: 'appr',
        label: 'Approvals completed',
        value: this_week.approvals_completed.toLocaleString(),
        ...pctTrend(this_week.approvals_completed, last_week.approvals_completed),
      },
      {
        id: 'rt',
        label: 'Avg response time',
        value: formatSeconds(this_week.avg_response_secs),
        ...pctTrend(this_week.avg_response_secs, last_week.avg_response_secs),
      },
    ],
  });
}
