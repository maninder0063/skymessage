import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { SiteHeader } from '@/components/SiteHeader';
import { PUBLIC_ENV } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_ENV.SITE_URL),
  title: { default: 'SkyMessage', template: '%s — SkyMessage' },
  description:
    'Send airplane banners to coworkers. They fly across the screen the moment they unlock their PC.',
  applicationName: 'SkyMessage',
  openGraph: {
    title: 'SkyMessage',
    description: 'Cinematic banners delivered the moment your coworker comes back to their desk.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B1020',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
