import { notFound } from 'next/navigation';
import { Avatar, Box, Container, Stack, Typography } from '@mui/material';
import { MessageComposer } from '@/components/MessageComposer';
import { PresenceBadge } from '@/components/PresenceBadge';
import { PUBLIC_ENV } from '@/lib/env';
import type { PublicProfileResponse } from '@skymessage/types';

interface ProfileWithPresence extends PublicProfileResponse {
  lastSeenAt: string | null;
  isOnline: boolean;
}

async function getProfile(handle: string): Promise<ProfileWithPresence | null> {
  try {
    const res = await fetch(`${PUBLIC_ENV.API_BASE_URL}/api/users/${encodeURIComponent(handle)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ProfileWithPresence;
  } catch {
    return null;
  }
}

export default async function HandlePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getProfile(handle);
  if (!profile) notFound();

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={6}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
          <Avatar
            src={profile.user.avatarUrl ?? undefined}
            alt={profile.user.displayName}
            sx={{ width: 96, height: 96, fontSize: 40, bgcolor: 'primary.main' }}
          >
            {profile.user.displayName.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography component="h1" variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                {profile.user.displayName}
              </Typography>
              <PresenceBadge isOnline={profile.isOnline} lastSeenAt={profile.lastSeenAt} />
            </Stack>
            <Typography variant="h6" color="text.secondary">
              @{profile.user.handle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {profile.acceptsAnonymous
                ? 'Accepts banners from anyone.'
                : 'Only accepts banners from approved senders.'}
            </Typography>
          </Box>
        </Stack>

        <MessageComposer
          recipientHandle={profile.user.handle}
          recipientDisplayName={profile.user.displayName}
        />
      </Stack>
    </Container>
  );
}
