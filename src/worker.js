import { Hono } from 'hono';

// Minimal Worker app to enable Cloudflare Workers deployment inside server/
// This does NOT run the Express app. Use this as a migration surface.

const app = new Hono();

// CORS: allow only the specified client origin (manual middleware)
const ALLOWED_ORIGIN = 'https://rezulyzer-client.pages.dev';

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const isAllowed = origin === ALLOWED_ORIGIN;

  // Preflight
  if (c.req.method === 'OPTIONS') {
    const reqHeaders = c.req.header('Access-Control-Request-Headers') || 'Content-Type, Authorization, X-Requested-With';
    const reqMethod = c.req.header('Access-Control-Request-Method') || 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

    if (isAllowed) {
      return c.body(null, 204, {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': reqMethod,
        'Access-Control-Allow-Headers': reqHeaders,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      });
    }
    // Not allowed origin: still respond safely
    return c.body(null, 204, {
      'Vary': 'Origin',
      'Access-Control-Max-Age': '86400',
    });
  }

  await next();

  // Set CORS headers on non-preflight responses
  if (isAllowed) {
    c.res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    c.res.headers.set('Vary', 'Origin');
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set('Access-Control-Expose-Headers', 'Content-Length');
  } else {
    c.res.headers.set('Vary', 'Origin');
  }
});

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
