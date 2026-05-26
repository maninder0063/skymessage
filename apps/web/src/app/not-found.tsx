import { Box, Button, Container, Typography } from '@mui/material';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Container maxWidth="sm" sx={{ py: 14, textAlign: 'center' }}>
      <Typography component="h1" sx={{ fontSize: 96, fontWeight: 700, letterSpacing: '-0.04em' }}>
        404
      </Typography>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        No one by that handle here.
      </Typography>
      <Box>
        <Button component={Link} href="/" variant="contained">
          Back to landing
        </Button>
      </Box>
    </Container>
  );
}
