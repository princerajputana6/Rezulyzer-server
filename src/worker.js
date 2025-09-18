import { Hono } from 'hono';
import * as bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

// Minimal Worker app to enable Cloudflare Workers deployment inside server/
// This does NOT run the Express app. Use this as a migration surface.

const app = new Hono();

// CORS: allow configured client origins (production + localhost for dev)
const ALLOWED_ORIGINS = new Set([
  'https://rezulyzer-client.pages.dev',
  'http://localhost:3000',
  'http://localhost:5173',
]);

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const isAllowed = origin && ALLOWED_ORIGINS.has(origin);

  // Preflight
  if (c.req.method === 'OPTIONS') {
    const reqHeaders = c.req.header('Access-Control-Request-Headers') || 'Content-Type, Authorization, X-Requested-With';
    const reqMethod = c.req.header('Access-Control-Request-Method') || 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

    if (isAllowed && origin) {
      return c.body(null, 204, {
        'Access-Control-Allow-Origin': origin,
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
  if (isAllowed && origin) {
    c.res.headers.set('Access-Control-Allow-Origin', origin);
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

// Helper: call MongoDB Atlas Data API
async function mongoFindOne(c, { collection, filter }) {
  const base = c.env.MONGODB_DATA_API_BASE; // e.g., https://ap-south-1.aws.data.mongodb-api.com/app/APP_ID/endpoint/data/v1
  const dataSource = c.env.MONGODB_DATA_SOURCE;
  const database = c.env.MONGODB_DATABASE;
  const apiKey = c.env.MONGODB_DATA_API_KEY; // secret
  if (!base || !dataSource || !database || !apiKey) {
    return { error: 'MongoDB Data API env vars are not fully configured.' };
  }
  const url = base.replace(/\/?$/, '/') + 'action/findOne';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      dataSource,
      database,
      collection,
      filter,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    return { error: `MongoDB Data API error ${resp.status}: ${text}` };
  }
  const data = await resp.json();
  return { document: data.document || null };
}

// Helper: issue JWT
async function issueJwt(c, payload) {
  const secret = c.env.JWT_SECRET; // set via wrangler secret
  const issuer = c.env.JWT_ISSUER || 'rezulyzer';
  const audience = c.env.JWT_AUDIENCE || 'rezulyzer-client';
  const expiresIn = c.env.JWT_EXPIRES_IN || '7d';
  if (!secret) throw new Error('JWT_SECRET is not set');
  const key = new TextEncoder().encode(secret);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(expiresIn)
    .sign(key);
}

// Auth: POST /api/auth/login
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ success: false, message: 'Email and password are required' }, 400);
    }

    const { document: user, error } = await mongoFindOne(c, {
      collection: c.env.MONGODB_COLLECTION_USERS || 'users',
      filter: { email: String(email).toLowerCase() },
    });
    if (error) {
      return c.json({ success: false, message: error }, 500);
    }
    if (!user || !user.password) {
      return c.json({ success: false, message: 'Invalid credentials' }, 401);
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return c.json({ success: false, message: 'Invalid credentials' }, 401);
    }

    const token = await issueJwt(c, { sub: String(user._id || user.id || user.email), email: user.email, role: user.role || 'user' });
    // Shape response similar to typical Express auth
    return c.json({
      success: true,
      token,
      user: {
        id: String(user._id || user.id || ''),
        name: user.name || '',
        email: user.email,
        role: user.role || 'user',
      },
    });
  } catch (err) {
    return c.json({ success: false, message: err.message || 'Login failed' }, 500);
  }
});

// Reverse proxy: forward all other /api/* routes to your existing backend
app.all('/api/*', async (c) => {
  const backendOrigin = c.env?.BACKEND_ORIGIN;
  if (!backendOrigin) {
    return c.json(
      {
        success: false,
        message: 'No backend proxy configured and route not implemented on Worker.',
        path: c.req.path,
        method: c.req.method,
      },
      500,
    );
  }

  // Build target URL preserving path and query
  const incomingUrl = new URL(c.req.url);
  const target = new URL(incomingUrl.pathname + incomingUrl.search, backendOrigin);

  // Clone headers excluding hop-by-hop and Cloudflare-specific
  const hopByHop = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'host',
  ]);
  const outgoingHeaders = new Headers();
  for (const [k, v] of c.req.raw.headers.entries()) {
    const key = k.toLowerCase();
    if (hopByHop.has(key) || key.startsWith('cf-')) continue;
    outgoingHeaders.set(k, v);
  }

  // Prepare body if applicable
  const method = c.req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? await c.req.arrayBuffer() : undefined;

  const proxyReq = new Request(target.toString(), {
    method,
    headers: outgoingHeaders,
    body,
    redirect: 'manual',
  });

  const resp = await fetch(proxyReq);

  // Stream back response, preserving headers (CORS headers are added by our middleware above)
  const respHeaders = new Headers(resp.headers);
  // Remove hop-by-hop from response as well
  for (const key of hopByHop) {
    respHeaders.delete(key);
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders,
  });
});

export default app;
