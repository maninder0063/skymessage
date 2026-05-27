import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar, Box, Button, Container, Paper, Stack, Typography, Chip } from '@mui/material';
import { supabaseServer, getSessionUser } from '@/lib/supabase-server';
import { PUBLIC_ENV } from '@/lib/env';

export default async function AccountPage() {
  const authUser = await getSessionUser();
  if (!authUser) {
    redirect('/auth/login?next=/account');
  }

  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from('users')
    .select('id, handle, display_name, email, avatar_url, timezone')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (!profile) {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Almost there...
          </Typography>
          <Typography color="text.secondary">
            Your authentication account is set up but your SkyMessage profile is missing. Try
            signing out and signing up again.
          </Typography>
          <Box sx={{ mt: 3 }}>
            <form action="/auth/logout" method="post">
              <Button type="submit" variant="outlined">Sign out</Button>
            </form>
          </Box>
        </Paper>
      </Container>
    );
  }

  const shareUrl = `${PUBLIC_ENV.SITE_URL}/${profile.handle}`;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
          <Avatar sx={{ width: 88, height: 88, fontSize: 36, bgcolor: 'primary.main' }}>
            {profile.display_name.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              {profile.display_name}
            </Typography>
            <Typography color="text.secondary">@{profile.handle}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip size="small" label={profile.email ?? ''} variant="outlined" />
              <Chip size="small" label={profile.timezone} variant="outlined" />
            </Stack>
          </Box>
        </Stack>

        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
            Your share link
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 600, my: 1 }}>{shareUrl}</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Send this to anyone — they can banner you a message without signing up.
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button component={Link} href={`/${profile.handle}`} variant="contained">
              View my profile
            </Button>
            <Button component={Link} href={`/print/${profile.handle}`} target="_blank" variant="outlined">
              Print QR for my desk
            </Button>
            <Button component={Link} href="/download" variant="outlined">
              Get the desktop app
            </Button>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
            Stick this on your desk
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 600, my: 1 }}>
            Print a QR code anyone can scan to send you a banner.
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Opens a print-ready page with your QR, handle, and send link. Hit Ctrl+P to print —
            also great as a screen wallpaper or Slack profile pic.
          </Typography>
          <Button
            component={Link}
            href={`/print/${profile.handle}`}
            target="_blank"
            variant="contained"
          >
            Open my QR page
          </Button>
        </Paper>

        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            How banners reach you
          </Typography>
          <Typography color="text.secondary">
            Install the SkyMessage desktop app, sign in with this same email and password, and
            banners fly across your screen the next time you unlock your PC.
          </Typography>
        </Paper>

        <Box>
          <form action="/auth/logout" method="post">
            <Button type="submit" variant="outlined" color="inherit">
              Sign out
            </Button>
          </form>
        </Box>
      </Stack>
    </Container>
  );
}
