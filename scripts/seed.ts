/**
 * Seed Mission Control with ~30 days of realistic demo data.
 * Run: npm run seed
 *
 * Wipes existing rows first. Safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_AGENTS } from '../src/lib/agents';

const prisma = new PrismaClient();

function rand(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const READ_DESCS = [
  'read an inbound email from a member',
  'read a comment on the latest Instagram post',
  'received a booking enquiry from the website',
  'triaged 4 messages in the partnerships queue',
  'parsed an overnight inbox batch (12 messages)',
];

const DRAFT_DESCS = [
  'drafted a reply to a class-pass enquiry',
  'drafted a welcome email for a new member',
  'drafted a goodwill 50% credit reply for a late cancellation',
  'drafted a sponsorship inquiry response',
  'drafted a follow-up to a refund question',
];

const SEND_DESCS = [
  'sent a confirmation for tomorrow\'s 7am session',
  'sent 9 welcome emails to new sign-ups',
  'published a reply on Instagram',
  'pushed a calendar update to 4 members',
];

const COMM_TOPICS = ['BOOKING_POLICY', 'BRAND_VOICE', 'PRICING', 'REFUND_RULES', 'TIMETABLE'];

const DRAFT_TITLES = [
  ['Refund request — late cancellation', 'HIGH', 'email', `Hi, I missed the cancellation window for the £42 workshop. Any chance for a refund?`],
  ['Corporate group booking — 12 people', 'MED', 'email', `Hello — we'd like to book a private Friday session for 12. Do you offer a group rate?`],
  ['Negative review reply — Instagram', 'MED', 'instagram_dm', `The studio was way too crowded last night. Disappointed.`],
  ['Sponsorship inquiry — outdoor brand', 'LOW', 'email', `Hi! We're interested in a paid partnership for our autumn launch. Available for a quick call?`],
  ['Welcome reply — new member onboarding', 'LOW', 'email', `Hello, just signed up — what's the best way to start as a complete beginner?`],
];

const DRAFT_REPLIES = [
  `Thanks so much for reaching out — our cancellation policy is 24 hours, but as a first-time goodwill exception we can offer you a 50% credit toward your next session. Let me know if you'd like me to apply it.`,
  `Lovely to hear from you! We can hold our 6pm studio for a private Friday class — group rate is £28/head for 10+. Want me to confirm the slot?`,
  `Really sorry to hear that — Friday's evening class was unusually busy. Can I send you a complimentary reformer session as an apology?`,
  `Hi there — thanks for thinking of us. Our autumn calendar is quite full but we'd love to chat. Would Tuesday at 3pm work for a 20-minute call?`,
  `Welcome! For total beginners I'd recommend starting with our Hatha Foundations class — Tuesdays and Saturdays at 9am. I can hold a spot for next week if you'd like.`,
];

async function clear() {
  await prisma.event.deleteMany({});
  await prisma.draft.deleteMany({});
  await prisma.agentComm.deleteMany({});
  await prisma.memorySnapshot.deleteMany({});
  await prisma.weeklyMetrics.deleteMany({});
  await prisma.agent.deleteMany({});
}

async function seed() {
  // eslint-disable-next-line no-console
  console.log('[seed] clearing existing data…');
  await clear();

  // eslint-disable-next-line no-console
  console.log('[seed] inserting agents');
  const now = Date.now();
  const agentRows = await Promise.all(
    DEFAULT_AGENTS.map((a, i) =>
      prisma.agent.create({
        data: {
          slug: a.slug,
          name: a.name,
          role: a.role,
          icon: a.icon,
          color: a.color,
          tint: a.tint,
          status: i === 3 ? 'paused' : i === 2 ? 'idle' : 'running',
          uptimeSince: new Date(now - rand(3, 21) * 86400 * 1000),
          lastActionAt: new Date(now - rand(10, 600) * 1000),
        },
      }),
    ),
  );

  // 30 days of events
  // eslint-disable-next-line no-console
  console.log('[seed] generating 30 days of events…');
  const days = 30;
  for (let d = days; d >= 0; d--) {
    const dayStart = new Date(now - d * 86400 * 1000);
    dayStart.setHours(8, 0, 0, 0);

    const numEvents = rand(20, 60); // events per day
    for (let i = 0; i < numEvents; i++) {
      const agent = pick(agentRows);
      const t = new Date(dayStart.getTime() + rand(0, 12 * 3600) * 1000);
      const kindRoll = Math.random();
      let actionType: string;
      let description: string;
      if (kindRoll < 0.35) {
        actionType = 'READ';
        description = `${agent.name} ${pick(READ_DESCS)}`;
      } else if (kindRoll < 0.6) {
        actionType = 'DRAFT';
        description = `${agent.name} ${pick(DRAFT_DESCS)}`;
      } else if (kindRoll < 0.85) {
        actionType = 'SEND';
        description = `${agent.name} ${pick(SEND_DESCS)}`;
      } else if (kindRoll < 0.93) {
        actionType = 'AGENT_COMM';
        const peer = agentRows.find((a) => a.slug !== agent.slug)!;
        const topic = pick(COMM_TOPICS);
        description = `${agent.name} ↔ ${peer.name} · ${topic}`;
        await prisma.event.create({
          data: {
            agentId: agent.id,
            actionType,
            description,
            metadata: JSON.stringify({ to: peer.slug, topic }),
            minutesSaved: rand(0, 6),
            createdAt: t,
          },
        });
        await prisma.agentComm.create({
          data: {
            fromAgentId: agent.id,
            toAgentId: peer.id,
            topic,
            question: `Quick check before I act — what's our current guidance on ${topic.toLowerCase().replace(/_/g, ' ')}?`,
            answer: `Latest version is in MEMORY.MD (updated recently). Applying the canonical wording so all agents stay consistent.`,
            createdAt: t,
          },
        });
        continue;
      } else if (kindRoll < 0.97) {
        actionType = 'MEMORY_UPDATE';
        description = `${agent.name} updated MEMORY.MD with a new entry`;
      } else {
        actionType = 'FLAG';
        description = `${agent.name} flagged an item for review`;
      }
      await prisma.event.create({
        data: {
          agentId: agent.id,
          actionType,
          description,
          minutesSaved: rand(0, 8),
          revenueEvent: Math.random() < 0.04,
          createdAt: t,
        },
      });
    }

    // 1–3 drafts per day, with random PENDING vs APPROVED status
    const drafts = rand(1, 3);
    for (let i = 0; i < drafts; i++) {
      const agent = pick(agentRows.slice(0, 3)); // not paused atlas
      const tplIdx = rand(0, DRAFT_TITLES.length - 1);
      const [title, priority, channel, original] = DRAFT_TITLES[tplIdx];
      const draftText = DRAFT_REPLIES[tplIdx];
      const created = new Date(dayStart.getTime() + rand(1800, 9 * 3600) * 1000);
      // Recent drafts (today + yesterday): keep some PENDING for the kanban
      const stillPending = d <= 1 && i < 2;
      const status = stillPending ? 'PENDING' : Math.random() < 0.85 ? 'SENT' : 'REJECTED';
      const approvedAt = stillPending ? null : new Date(created.getTime() + rand(60, 600) * 1000);
      await prisma.draft.create({
        data: {
          agentId: agent.id,
          title: title as string,
          originalMessage: original as string,
          draftText,
          priority: priority as string,
          channel: channel as string,
          status,
          approvedAt,
          approvedBy: status === 'SENT' ? 'dashboard' : status === 'REJECTED' ? 'dashboard' : null,
          sentAt: status === 'SENT' ? approvedAt : null,
          createdAt: created,
        },
      });
    }
  }

  // Memory snapshots
  // eslint-disable-next-line no-console
  console.log('[seed] memory snapshots');
  for (let i = 0; i < 24; i++) {
    await prisma.memorySnapshot.create({
      data: {
        memoryMdChars: rand(1800, 3600),
        userMdChars: rand(600, 1200),
        createdAt: new Date(now - i * 3600 * 1000),
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('[seed] done');
}

seed()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
