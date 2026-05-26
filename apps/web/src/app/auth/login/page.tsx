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
import { AppLogo } from '@skymessage/ui';

export default function LoginPage() {
  const router = useRouter();
  const redirectTo =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('next') ?? '/account'
      : '/account';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = supabaseBrowser();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    });
  }

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <AppLogo />
      </Box>
      <Paper component="form" onSubmit={onSubmit} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Sign in
          </Typography>
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={pending || !email || !password}
            startIcon={pending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {pending ? 'Signing in...' : 'Sign in'}
          </Button>
          <Typography variant="body2" color="text.secondary" align="center">
            New here?{' '}
            <Link href={`/auth/signup?next=${encodeURIComponent(redirectTo)}`} style={{ color: 'inherit', fontWeight: 600 }}>
              Create an account
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}
