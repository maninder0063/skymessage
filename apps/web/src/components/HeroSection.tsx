'use client';

import { Box, Button, Container, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import { AirplaneIcon } from '@skymessage/ui';

export function HeroSection() {
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        py: { xs: 10, md: 16 },
        overflow: 'hidden',
        background:
          'radial-gradient(1200px 600px at 70% -20%, rgba(61,90,254,0.18), transparent 60%),' +
          'radial-gradient(900px 400px at 10% 110%, rgba(255,138,101,0.12), transparent 60%)',
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={4} alignItems="flex-start" maxWidth={760}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'rgba(61,90,254,0.10)',
              color: 'primary.main',
              px: 1.5,
              py: 0.5,
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            <AirplaneIcon sx={{ fontSize: 16 }} />
            Now in private beta
          </Box>

          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 44, sm: 60, md: 76 },
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
            }}
          >
            Banners that arrive
            <Box component="span" sx={{ display: 'block', color: 'primary.main' }}>
              when your coworker comes back.
            </Box>
          </Typography>

          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 620, fontWeight: 400 }}>
            SkyMessage flies a small plane across the desktop the moment your coworker unlocks
            their PC. Not a chat app. Not a notification. A pleasant surprise — once.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 2 }}>
            <Button component={Link} href="/send/demo" variant="contained" color="primary" size="large">
              Try it on the demo profile
            </Button>
            <Button component={Link} href="/demo" variant="outlined" color="inherit" size="large">
              See a profile page
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Messages only appear on unlock, on resume from sleep, or after a coworker steps away
            and comes back. Never during focused work.
          </Typography>
        </Stack>
      </Container>

      {/* Decorative drifting plane */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          right: { xs: -40, md: 40 },
          top: { xs: 'auto', md: 64 },
          bottom: { xs: 32, md: 'auto' },
          opacity: 0.18,
          transform: 'rotate(-12deg)',
          color: 'primary.main',
          pointerEvents: 'none',
        }}
      >
        <AirplaneIcon sx={{ fontSize: { xs: 180, md: 320 } }} />
      </Box>
    </Box>
  );
}
