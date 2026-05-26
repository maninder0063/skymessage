import { Hono } from 'hono';

export const healthRoute = new Hono();

healthRoute.get('/', (c) =>
  c.json({
    status: 'ok',
    service: 'skymessage-server',
    time: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.0',
  }),
);
