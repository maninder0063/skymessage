'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { addDays, setHours, setMinutes, startOfHour } from 'date-fns';

export type ScheduleValue =
  | { kind: 'now' }
  | { kind: 'later'; iso: string };

interface ScheduleFieldProps {
  value: ScheduleValue;
  onChange: (v: ScheduleValue) => void;
  recipientTimezone?: string;
}

function tomorrowAt(hour: number): Date {
  return setMinutes(setHours(startOfHour(addDays(new Date(), 1)), hour), 0);
}

const PRESETS: Array<{ label: string; build: () => Date }> = [
  { label: 'Tomorrow 9am', build: () => tomorrowAt(9) },
  { label: 'Tomorrow 1pm', build: () => tomorrowAt(13) },
  { label: 'Next Monday 9am', build: () => nextMondayAt(9) },
];

function nextMondayAt(hour: number): Date {
  const d = new Date();
  const day = d.getDay(); // 0 = sun
  const delta = ((8 - day) % 7) || 7;
  return setMinutes(setHours(startOfHour(addDays(d, delta)), hour), 0);
}

export function ScheduleField({ value, onChange, recipientTimezone }: ScheduleFieldProps) {
  const [date, setDate] = useState<Date | null>(
    value.kind === 'later' ? new Date(value.iso) : tomorrowAt(9),
  );

  const tzLabel = useMemo(() => {
    if (!recipientTimezone) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: recipientTimezone,
        timeZoneName: 'short',
      }).formatToParts(new Date());
      const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? recipientTimezone;
      return `Their local time: ${tz}`;
    } catch {
      return '';
    }
  }, [recipientTimezone]);

  function handleKind(kind: 'now' | 'later') {
    if (kind === 'now') {
      onChange({ kind: 'now' });
    } else {
      const d = date ?? tomorrowAt(9);
      setDate(d);
      onChange({ kind: 'later', iso: d.toISOString() });
    }
  }

  function handleDate(d: Date | null) {
    setDate(d);
    if (d) onChange({ kind: 'later', iso: d.toISOString() });
  }

  return (
    <FormControl component="fieldset">
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        When should it fly?
      </Typography>
      <RadioGroup
        row
        value={value.kind}
        onChange={(_, v) => handleKind(v as 'now' | 'later')}
        sx={{ mb: value.kind === 'later' ? 1.5 : 0 }}
      >
        <FormControlLabel value="now" control={<Radio />} label="Next time they unlock" />
        <FormControlLabel value="later" control={<Radio />} label="At a specific time" />
      </RadioGroup>

      {value.kind === 'later' && (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                onClick={() => handleDate(p.build())}
                variant="outlined"
              />
            ))}
          </Stack>
          <Box sx={{ maxWidth: 320 }}>
            <DateTimePicker
              label="Pick date and time"
              value={date}
              onChange={handleDate}
              minDateTime={new Date()}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Box>
          {tzLabel && (
            <Typography variant="caption" color="text.secondary">
              {tzLabel}
            </Typography>
          )}
        </Stack>
      )}
    </FormControl>
  );
}
