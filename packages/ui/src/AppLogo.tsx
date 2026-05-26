import { Box, Typography } from '@mui/material';
import { AirplaneIcon } from './AirplaneIcon';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function AppLogo({ size = 'md' }: AppLogoProps) {
  const fontSize = size === 'sm' ? 18 : size === 'lg' ? 32 : 22;
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 30 : 22;

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <AirplaneIcon sx={{ fontSize: iconSize, color: 'primary.main' }} />
      <Typography
        component="span"
        sx={{
          fontWeight: 600,
          fontSize,
          letterSpacing: '-0.01em',
          fontFeatureSettings: '"ss01"',
        }}
      >
        SkyMessage
      </Typography>
    </Box>
  );
}
