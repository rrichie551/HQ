export type ClientConfig = {
  name: string;
  slug: string;
  owner: string;
  role: string;
  initials: string;
  timezone: string;
  tzLabel: string;
  description: string;
};

export function getClientConfig(): ClientConfig {
  const name = process.env.CLIENT_NAME ?? "Darcy's Business";
  const owner = process.env.CLIENT_OWNER ?? 'Darcy Mitchell';
  return {
    name,
    slug: process.env.CLIENT_SLUG ?? 'client',
    owner,
    role: process.env.CLIENT_ROLE ?? 'Founder',
    initials:
      process.env.CLIENT_INITIALS ??
      owner
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    timezone: process.env.CLIENT_TIMEZONE ?? 'America/Chicago',
    tzLabel: process.env.CLIENT_TZ_LABEL ?? 'Local',
    description: process.env.CLIENT_DESCRIPTION ?? 'AI Operations',
  };
}
