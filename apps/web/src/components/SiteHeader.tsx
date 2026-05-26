import { AppBar, Box, Button, Container, Toolbar } from '@mui/material';
import Link from 'next/link';
import { AppLogo } from '@skymessage/ui';
import { supabaseServer } from '@/lib/supabase-server';

export async function SiteHeader() {
  const supabase = await supabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  let handle: string | null = null;
  if (authData.user) {
    const { data: profile } = await supabase
      .from('users')
      .select('handle')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    handle = profile?.handle ?? null;
  }

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'rgba(255,255,255,0.78)',
        backdropFilter: 'saturate(180%) blur(14px)',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: 64, gap: 2 }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <AppLogo />
          </Link>
          <Box sx={{ flexGrow: 1 }} />
          <Button component={Link} href="/download" color="inherit" sx={{ fontWeight: 600 }}>
            Download
          </Button>
          {authData.user ? (
            <>
              {handle && (
                <Button component={Link} href={`/${handle}`} color="inherit" sx={{ fontWeight: 600 }}>
                  @{handle}
                </Button>
              )}
              <Button component={Link} href="/account" variant="contained" color="primary">
                Account
              </Button>
            </>
          ) : (
            <>
              <Button component={Link} href="/auth/login" color="inherit" sx={{ fontWeight: 600 }}>
                Sign in
              </Button>
              <Button component={Link} href="/auth/signup" variant="contained" color="primary">
                Sign up
              </Button>
            </>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}
