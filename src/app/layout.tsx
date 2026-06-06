import './globals.css';
import type { Metadata } from 'next';
import { getClientConfig } from '@/lib/client-config';
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper';

export const metadata: Metadata = {
  title: 'Mission Control · First Word Read',
  description: 'Per-client AI Operations Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const client = getClientConfig();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;550;600;650;700;750;800&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <title>{`Mission Control · ${client.name}`}</title>
      </head>
      <body>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
