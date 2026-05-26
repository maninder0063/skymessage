'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { PUBLIC_ENV } from '@/lib/env';
import { AppLogo } from '@skymessage/ui';

export default function SignupPage() {
  const router = useRouter();
  const redirectTo =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('next') ?? '/account'
      : '/account';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = supabaseBrowser();
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, handle: handle.toLowerCase() } },
      });
      if (err) {
        setError(err.message);
        return;
      }
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError('Account created — please check your email to confirm, then sign in.');
        return;
      }
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
      const initRes = await fetch(`${PUBLIC_ENV.API_BASE_URL}/api/auth/init-bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ handle: handle.toLowerCase(), displayName, timezone: tz }),
      });
      if (!initRes.ok) {
        const body = await initRes.json().catch(() => ({}));
        setError(body?.error?.message ?? 'Could not create profile. Try a different handle.');
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    });
  }

  const handleValid = /^[a-z0-9][a-z0-9_-]{1,29}$/.test(handle.toLowerCase());

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <AppLogo />
      </Box>
      <Paper component="form" onSubmit={onSubmit} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Create an account
          </Typography>
          <TextField
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            inputProps={{ maxLength: 40 }}
            required
            fullWidth
          />
          <TextField
            label="Handle (used in your URL: skymessage.app/HANDLE)"
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            error={handle.length > 0 && !handleValid}
            helperText={
              handle.length === 0
                ? 'lowercase letters, digits, hyphens'
                : handleValid
                  ? `skymessage.app/${handle.toLowerCase()}`
                  : 'invalid handle'
            }
            inputProps={{ maxLength: 30, autoCapitalize: 'none' }}
            required
            fullWidth
          />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputProps={{ minLength: 8 }}
            helperText="At least 8 characters"
            required
            fullWidth
          />
          {error && <Alert severity={error.startsWith('Account created') ? 'info' : 'error'}>{error}</Alert>}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={pending || !email || password.length < 8 || !displayName || !handleValid}
            startIcon={pending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {pending ? 'Creating...' : 'Create account'}
          </Button>
          <Typography variant="body2" color="text.secondary" align="center">
            Already have one?{' '}
            <Link href={`/auth/login?next=${encodeURIComponent(redirectTo)}`} style={{ color: 'inherit', fontWeight: 600 }}>
              Sign in
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}
