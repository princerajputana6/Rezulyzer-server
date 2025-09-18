import { Hono } from 'hono';
import { cors } from '@hono/cors';

// Minimal Worker app to enable Cloudflare Workers deployment inside server/
// This does NOT run the Express app. Use this as a migration surface.

const app = new Hono();

// CORS: allow only the specified client origin
app.use('*',
  cors({
    origin: 'https://rezulyzer-client.pages.dev',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Length'],
    credentials: true,
    maxAge: 86400,
  })
);

// Health check compatible with existing route
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    message: 'Worker is running',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  });
});

// Placeholder handlers for your existing API groups
const notImplemented = (c) =>
  c.json(
    {
      success: false,
      message:
        'This route is not yet implemented on Cloudflare Workers. Port the Express handler to Hono to enable.',
      path: c.req.path,
      method: c.req.method,
    },
    501,
  );

app.all('/api/*', notImplemented);

export default app;
