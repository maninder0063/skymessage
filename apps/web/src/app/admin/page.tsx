import { Alert, Container, Typography } from '@mui/material';

export default function AdminPage() {
  return (
    <Container maxWidth="md" sx={{ py: 10 }}>
      <Typography variant="h3" sx={{ fontWeight: 700, mb: 2, letterSpacing: '-0.02em' }}>
        Moderation
      </Typography>
      <Alert severity="info">
        The full moderation UI lands in a follow-up. Schema, RLS and admin flag already exist
        — see <code>users.is_admin</code> and the <code>blocked_users</code> table.
      </Alert>
    </Container>
  );
}
