import { Box, Container, Grid, Stack, Typography } from '@mui/material';
import { HeroSection } from '@/components/HeroSection';
import { AirplaneIcon } from '@skymessage/ui';

const features = [
  {
    title: 'Only on unlock',
    body: 'Banners are queued. They animate when your coworker unlocks, resumes from sleep, or returns from idle — never mid-focus.',
  },
  {
    title: 'Cinematic, not loud',
    body: 'A single plane with a cloth-textured banner. 60fps PixiJS overlay. No sound. No popups.',
  },
  {
    title: 'Schedule for the right moment',
    body: 'Send "good luck" the night before. SkyMessage waits for tomorrow morning, in their timezone.',
  },
  {
    title: 'Anti-spam, by default',
    body: 'Max three banners per sender per day. Profanity filter. Recipients can pause animations or block senders entirely.',
  },
];

export default function Page() {
  return (
    <Box component="main">
      <HeroSection />

      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 14 } }}>
        <Stack spacing={2} sx={{ mb: 6, maxWidth: 720 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
            How it feels
          </Typography>
          <Typography component="h2" sx={{ fontSize: { xs: 32, md: 44 }, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Like a screensaver — not a chat client.
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 18 }}>
            The whole product is built around one rule: never interrupt the work. Every interaction
            optimizes for delight on return, not engagement during.
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          {features.map((f) => (
            <Grid key={f.title} size={{ xs: 12, sm: 6, md: 6 }}>
              <Box
                sx={{
                  p: 3,
                  height: '100%',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  transition: 'transform 240ms ease, box-shadow 240ms ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
                  },
                }}
              >
                <AirplaneIcon sx={{ color: 'primary.main', mb: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {f.title}
                </Typography>
                <Typography color="text.secondary">{f.body}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
