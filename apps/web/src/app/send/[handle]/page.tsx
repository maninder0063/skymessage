import { notFound } from 'next/navigation';
import { Box, Container, Typography } from '@mui/material';
import { MessageComposer } from '@/components/MessageComposer';
import { PUBLIC_ENV } from '@/lib/env';
import type { PublicProfileResponse } from '@skymessage/types';

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

export default async function SendPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getProfile(handle);
  if (!profile) notFound();

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
          New banner
        </Typography>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          to @{profile.user.handle}
        </Typography>
      </Box>
      <MessageComposer
        recipientHandle={profile.user.handle}
        recipientDisplayName={profile.user.displayName}
      />
    </Container>
  );
}
