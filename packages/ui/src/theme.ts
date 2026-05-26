import { createTheme, type ThemeOptions } from '@mui/material/styles';

/**
 * Shared Material 3 theme used by the web app and any future SkyMessage
 * surface. Deliberately calm: high contrast, generous radii, restrained
 * accent colour suggesting sky + dusk.
 */
const sharedTokens: ThemeOptions = {
  shape: { borderRadius: 14 },
  typography: {
    fontFamily:
      '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.03em' },
    h2: { fontWeight: 700, letterSpacing: '-0.025em' },
    h3: { fontWeight: 600, letterSpacing: '-0.02em' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '-0.005em' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 22, paddingBlock: 10 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
  },
};

export const skyMessageTheme = createTheme({
  ...sharedTokens,
  palette: {
    mode: 'light',
    primary:   { main: '#3D5AFE', contrastText: '#FFFFFF' },
    secondary: { main: '#FF8A65' },
    background: {
      default: '#F6F7FB',
      paper:   '#FFFFFF',
    },
    text: {
      primary:   '#0F172A',
      secondary: '#475569',
    },
    divider: 'rgba(15, 23, 42, 0.08)',
  },
});

export const skyMessageDarkTheme = createTheme({
  ...sharedTokens,
  palette: {
    mode: 'dark',
    primary:   { main: '#8AB4FF', contrastText: '#0B1020' },
    secondary: { main: '#FFB199' },
    background: {
      default: '#0B1020',
      paper:   '#11172A',
    },
    text: {
      primary:   '#F1F5F9',
      secondary: '#94A3B8',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
});
