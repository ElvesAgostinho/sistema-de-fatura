import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { rateLimiter, authRateLimiter } from '@/lib/redis';


// ─── Allowed origins for CORS ─────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  'https://faturaao.ao',
  'https://www.faturaao.ao',
].filter(Boolean);

// ─── Suspicious user-agent patterns (basic bot blocking) ─────────────────────
const BLOCKED_UA_PATTERNS = [/sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i];

function generateRequestId(): string {
  // Use crypto.randomUUID if available (Node 19+), fallback to timestamp
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

function jsonResponse(body: object, status: number, extraHeaders?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export async function middleware(request: NextRequest) {
  const ip =
    request.ip ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1';
  const path = request.nextUrl.pathname;
  const requestId = generateRequestId();

  // ── 1. Block suspicious user-agents ─────────────────────────────────────────
  const ua = request.headers.get('user-agent') ?? '';
  if (BLOCKED_UA_PATTERNS.some((p) => p.test(ua))) {
    return jsonResponse({ error: 'Forbidden' }, 403, { 'X-Request-ID': requestId });
  }

  // ── 2. CORS — only for API routes ────────────────────────────────────────────
  if (path.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const reqOrigin = request.nextUrl.origin;
    const isAllowedOrigin = !origin || origin === reqOrigin || ALLOWED_ORIGINS.includes(origin);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': isAllowedOrigin ? (origin ?? '*') : 'null',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
          'Access-Control-Max-Age': '86400',
          'X-Request-ID': requestId,
        },
      });
    }

    // Removed strict CORS origin block that caused 'CORS: origin not allowed' in production 
    // due to internal URL rewrites or Vercel proxies modifying the origin header.
  }

  // ── 3. Rate Limiting — Auth endpoints ────────────────────────────────────────
  if (path.startsWith('/api/auth') || path === '/login' || path === '/register') {
    if (authRateLimiter) {
      const { success, limit, reset, remaining } = await authRateLimiter.limit(ip);
      if (!success) {
        return jsonResponse(
          {
            error: 'Demasiadas tentativas. Tente novamente mais tarde.',
            retryAfter: reset,
          },
          429,
          {
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-Request-ID': requestId,
          }
        );
      }
    }
  }
  // ── 4. Rate Limiting — General API ────────────────────────────────────────────
  else if (path.startsWith('/api/')) {
    if (rateLimiter) {
      const { success, limit, reset, remaining } = await rateLimiter.limit(ip);
      if (!success) {
        return jsonResponse(
          { error: 'Limite de pedidos excedido. Tente novamente em breve.' },
          429,
          {
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-Request-ID': requestId,
          }
        );
      }
    }
  }

  // ── 5. Supabase Session ────────────────────────────────────────────────────────
  const response = await updateSession(request);

  // Attach request ID to response for tracing
  response.headers.set('X-Request-ID', requestId);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

