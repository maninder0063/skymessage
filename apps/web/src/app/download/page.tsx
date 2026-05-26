import { Box, Button, Container, Paper, Stack, Typography, Alert } from '@mui/material';
import Link from 'next/link';

/**
 * Public download page. The Windows installer URL is read from
 * NEXT_PUBLIC_DOWNLOAD_WIN_URL — set this to your GitHub Releases /
 * Dropbox / GDrive link after you upload the .exe.
 */
const WIN_URL = process.env.NEXT_PUBLIC_DOWNLOAD_WIN_URL ?? '';

export default function DownloadPage() {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 12 } }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
            Desktop app
          </Typography>
          <Typography component="h1" variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            Get banners on your desktop.
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, fontSize: 18 }}>
            Install once, sign in with your SkyMessage account, and planes fly across the screen
            the next time you unlock your PC.
          </Typography>
        </Box>

        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Windows 10 / 11
              </Typography>
              <Typography variant="body2" color="text.secondary">
                64-bit installer · ~150 MB · launches on login
              </Typography>
            </Box>
            {WIN_URL ? (
              <Button component="a" href={WIN_URL} variant="contained" size="large">
                Download .exe
              </Button>
            ) : (
              <Button variant="contained" size="large" disabled>
                Coming soon
              </Button>
            )}
          </Stack>
        </Paper>

        {!WIN_URL && (
          <Alert severity="info">
            The installer URL hasn't been set yet. Set <code>NEXT_PUBLIC_DOWNLOAD_WIN_URL</code> in
            your Vercel environment variables and redeploy.
          </Alert>
        )}

        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            How it works
          </Typography>
          <Typography color="text.secondary">
            On first launch you'll see a small sign-in window. Use the same email and password you
            created on this site. SkyMessage then sits in the system tray, polls every few minutes,
            and only animates when you come back to your desk.
          </Typography>
        </Box>

        <Box>
          <Button component={Link} href="/auth/signup" variant="outlined">
            Don't have an account yet? Sign up
          </Button>
        </Box>
      </Stack>
    </Container>
  );
}
