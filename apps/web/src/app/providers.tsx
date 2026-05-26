'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { skyMessageTheme } from '@skymessage/ui';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={skyMessageTheme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>{children}</LocalizationProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
