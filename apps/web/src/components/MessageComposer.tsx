'use client';

import { useState, useTransition } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { MESSAGE_MAX_LENGTH } from '@skymessage/shared/constants';
import { ScheduleField, type ScheduleValue } from './ScheduleField';
import { api, SkyMessageApiError } from '@/lib/api-client';

interface MessageComposerProps {
  recipientHandle: string;
  recipientDisplayName: string;
  recipientTimezone?: string;
}

export function MessageComposer({
  recipientHandle,
  recipientDisplayName,
  recipientTimezone,
}: MessageComposerProps) {
  const [senderName, setSenderName] = useState('');
  const [body, setBody] = useState('');
  const [schedule, setSchedule] = useState<ScheduleValue>({ kind: 'now' });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const overLimit = body.length > MESSAGE_MAX_LENGTH;
  const disabled = !senderName.trim() || !body.trim() || overLimit || pending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await api.sendMessage({
          recipientHandle,
          senderDisplayName: senderName.trim(),
          body: body.trim(),
          scheduledDeliveryAt: schedule.kind === 'later' ? schedule.iso : undefined,
        });
        setSent(true);
        setBody('');
      } catch (err) {
        if (err instanceof SkyMessageApiError) {
          setError(err.message);
        } else {
          setError('Something went wrong — try again.');
        }
      }
    });
  }

  if (sent) {
    return (
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Banner queued
          </Typography>
          <Typography color="text.secondary">
            {schedule.kind === 'now'
              ? `${recipientDisplayName} will see it the next time they unlock their PC.`
              : `${recipientDisplayName} will see it after ${new Date(
                  schedule.kind === 'later' ? schedule.iso : Date.now(),
                ).toLocaleString()}.`}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setSent(false)} variant="outlined">
              Send another
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper component="form" onSubmit={onSubmit} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Send a banner to {recipientDisplayName}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            It will fly across their screen the next time they come back to their desk.
          </Typography>
        </Box>

        <TextField
          label="Your name"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          inputProps={{ maxLength: 40, autoComplete: 'name' }}
          required
          fullWidth
        />

        <TextField
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Lunch tomorrow?"
          multiline
          minRows={2}
          maxRows={4}
          error={overLimit}
          helperText={
            overLimit
              ? `Too long — ${body.length}/${MESSAGE_MAX_LENGTH}`
              : `${body.length}/${MESSAGE_MAX_LENGTH} characters`
          }
          required
          fullWidth
        />

        <ScheduleField
          value={schedule}
          onChange={setSchedule}
          recipientTimezone={recipientTimezone}
        />

        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            disabled={disabled}
            startIcon={pending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {pending ? 'Sending...' : schedule.kind === 'now' ? 'Send now' : 'Schedule it'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            Max 3 banners per day. Profanity filtered.
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
