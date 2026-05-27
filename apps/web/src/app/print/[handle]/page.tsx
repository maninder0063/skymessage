import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { PUBLIC_ENV } from '@/lib/env';
import type { PublicProfileResponse } from '@skymessage/types';
import { PrintButton } from './PrintButton';
import './print.css';

interface PrintProps {
  params: Promise<{ handle: string }>;
}

async function getProfile(handle: string): Promise<PublicProfileResponse | null> {
  try {
    const res = await fetch(`${PUBLIC_ENV.API_BASE_URL}/api/users/${encodeURIComponent(handle)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicProfileResponse;
  } catch {
    return null;
  }
}

export default async function PrintQRPage({ params }: PrintProps) {
  const { handle } = await params;
  const profile = await getProfile(handle);
  if (!profile) notFound();

  const sendUrl = `${PUBLIC_ENV.SITE_URL}/send/${handle}`;
  const qrSvg = await QRCode.toString(sendUrl, {
    type: 'svg',
    margin: 1,
    width: 480,
    color: { dark: '#0F172A', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });

  return (
    <div className="qr-print-root">
      <div className="qr-toolbar">
        <a className="qr-back" href={`/${handle}`}>← back to profile</a>
        <PrintButton />
      </div>

      <article className="qr-card">
        <header className="qr-header">
          <span className="qr-brand">SkyMessage</span>
        </header>

        <div className="qr-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />

        <h1 className="qr-handle">@{profile.user.handle}</h1>
        <p className="qr-tagline">Scan to fly me a banner.</p>

        <footer className="qr-footer">
          <span className="qr-url">{sendUrl.replace(/^https?:\/\//, '')}</span>
        </footer>
      </article>

      <div className="qr-bottom-bar">
        <PrintButton label="Print this page" variant="big" />
        <span className="qr-hint">or press Ctrl+P</span>
      </div>
    </div>
  );
}
