import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { env } from './env.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorMiddleware } from './middleware/error.js';
import { healthRoute } from './routes/health.js';
import { messagesRoute } from './routes/messages.js';
import { usersRoute } from './routes/users.js';
import { devicesRoute } from './routes/devices.js';
import { authRoute } from './routes/auth.js';

const app = new Hono();

app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', corsMiddleware);
app.use('*', errorMiddleware);

app.route('/api/health', healthRoute);
app.route('/api/auth', authRoute);
app.route('/api/messages', messagesRoute);
app.route('/api/users', usersRoute);
app.route('/api/devices', devicesRoute);

app.notFound((c) =>
  c.json({ error: { code: 'not_found', message: `No route for ${c.req.method} ${c.req.path}` } }, 404),
);

const port = env.PORT;
serve({ fetch: app.fetch, port, hostname: env.HOST }, ({ port: actualPort }) => {
  console.info(`[skymessage-server] listening on http://${env.HOST}:${actualPort}`);
});
