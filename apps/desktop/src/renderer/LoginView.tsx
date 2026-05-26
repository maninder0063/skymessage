import { useState } from 'react';

type Mode = 'login' | 'signup';

export function LoginView() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
      const res =
        mode === 'login'
          ? await window.skymessage.login({ email, password })
          : await window.skymessage.signup({
              email,
              password,
              handle: handle.toLowerCase(),
              displayName,
              timezone: tz,
            });
      if (!res.ok) {
        setError(res.error ?? 'Sign-in failed');
        return;
      }
      setInfo('Signed in. You can close this window.');
      setTimeout(() => window.skymessage.closeAuthWindow(), 400);
    } finally {
      setPending(false);
    }
  }

  const handleValid =
    mode === 'login' || /^[a-z0-9][a-z0-9_-]{1,29}$/.test(handle.toLowerCase());
  const valid =
    !!email &&
    password.length >= (mode === 'signup' ? 8 : 1) &&
    (mode === 'login' || (!!displayName && handleValid));

  return (
    <div style={styles.root}>
      <form onSubmit={submit} style={styles.card}>
        <div style={styles.brandRow}>
          <svg width={22} height={22} viewBox="0 0 24 24" style={{ color: '#3D5AFE' }}>
            <path d="M3.2 11.6 21 4l-7.6 17.8-2.1-7.9-8.1-2.3z" fill="currentColor" />
          </svg>
          <div style={styles.brand}>SkyMessage</div>
        </div>

        <div style={styles.tabs}>
          <button
            type="button"
            style={mode === 'login' ? styles.tabActive : styles.tab}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            style={mode === 'signup' ? styles.tabActive : styles.tab}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>

        {mode === 'signup' && (
          <>
            <label style={styles.label}>Your name</label>
            <input
              style={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              required
            />

            <label style={styles.label}>Handle</label>
            <input
              style={styles.input}
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              maxLength={30}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="e.g. alice"
              required
            />
            <div style={styles.help}>{handle ? `skymessage.app/${handle.toLowerCase()}` : 'lowercase, letters/digits/hyphens'}</div>
          </>
        )}

        <label style={styles.label}>Email</label>
        <input
          style={styles.input}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={mode === 'signup' ? 8 : 1}
          required
        />
        {mode === 'signup' && <div style={styles.help}>At least 8 characters.</div>}

        {error && <div style={styles.error}>{error}</div>}
        {info && <div style={styles.info}>{info}</div>}

        <button
          type="submit"
          style={{ ...styles.submit, opacity: pending || !valid ? 0.6 : 1 }}
          disabled={pending || !valid}
        >
          {pending ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <div style={styles.footnote}>
          We poll for new banners every time you unlock your PC. Nothing is sent before you ask.
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #F6F7FB 0%, #E8ECF7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily:
      '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    color: '#0F172A',
    pointerEvents: 'auto',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  brand: { fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' },
  tabs: { display: 'flex', gap: 6, padding: 4, background: '#F1F5F9', borderRadius: 999, marginBottom: 16 },
  tab: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    padding: '8px 12px',
    borderRadius: 999,
    fontWeight: 600,
    cursor: 'pointer',
    color: '#475569',
    fontSize: 14,
  },
  tabActive: {
    flex: 1,
    border: 'none',
    background: '#FFFFFF',
    padding: '8px 12px',
    borderRadius: 999,
    fontWeight: 700,
    cursor: 'pointer',
    color: '#0F172A',
    fontSize: 14,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
  },
  label: { fontSize: 13, fontWeight: 600, color: '#475569', marginTop: 8, marginBottom: 4 },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 15,
    borderRadius: 10,
    border: '1px solid rgba(15, 23, 42, 0.14)',
    outline: 'none',
    background: '#FFFFFF',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  help: { fontSize: 12, color: '#64748B', marginTop: 4 },
  error: {
    background: 'rgba(220, 38, 38, 0.08)',
    color: '#9F1239',
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 13,
    marginTop: 12,
  },
  info: {
    background: 'rgba(34, 197, 94, 0.10)',
    color: '#166534',
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 13,
    marginTop: 12,
  },
  submit: {
    marginTop: 16,
    padding: '12px 16px',
    fontSize: 15,
    fontWeight: 600,
    color: '#FFFFFF',
    background: '#3D5AFE',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  footnote: { fontSize: 11, color: '#94A3B8', marginTop: 16, textAlign: 'center', lineHeight: 1.5 },
};
