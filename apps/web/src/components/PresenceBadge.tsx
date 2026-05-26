'use client';

import { Box, Chip, Tooltip } from '@mui/material';

interface PresenceBadgeProps {
  isOnline: boolean;
  lastSeenAt: string | null;
}

function relative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function PresenceBadge({ isOnline, lastSeenAt }: PresenceBadgeProps) {
  if (isOnline) {
    return (
      <Tooltip title="Desktop app is connected">
        <Chip
          size="small"
          label="Online"
          sx={{
            bgcolor: 'rgba(34, 197, 94, 0.12)',
            color: 'rgb(21, 128, 61)',
            fontWeight: 600,
            '& .MuiChip-label': { display: 'flex', alignItems: 'center', gap: 0.75 },
          }}
          icon={
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'rgb(34, 197, 94)',
                boxShadow: '0 0 0 4px rgba(34, 197, 94, 0.18)',
                ml: 1,
              }}
            />
          }
        />
      </Tooltip>
    );
  }

  if (!lastSeenAt) {
    return (
      <Tooltip title="No desktop app connected yet">
        <Chip
          size="small"
          label="Offline"
          variant="outlined"
          sx={{ fontWeight: 600 }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title="They'll see your banner the next time they unlock their PC.">
      <Chip
        size="small"
        label={`Last seen ${relative(lastSeenAt)}`}
        variant="outlined"
        sx={{ fontWeight: 600, color: 'text.secondary' }}
      />
    </Tooltip>
  );
}
