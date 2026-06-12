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
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

function jsonResponse(body: object, status: number, extraHeaders?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
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
  }

  // ── 3. Rate Limiting — Auth endpoints (strict: 5 req/min per IP) ─────────────
  // Only throttle POST submissions (login/signup form), not page loads (GET).
  const isAuthApiRoute = path.startsWith('/api/auth') || path === '/api/signup';
  const isAuthPagePost = (path === '/login' || path === '/register') && request.method === 'POST';
  if (isAuthApiRoute || isAuthPagePost) {
    if (authRateLimiter) {
      const { success, limit, reset, remaining } = await authRateLimiter.limit(ip);
      const rlHeaders = {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(reset),
        'X-Request-ID': requestId,
      };
      if (!success) {
        return jsonResponse(
          { error: 'Demasiadas tentativas. Tente novamente mais tarde.', retryAfter: reset },
          429,
          { ...rlHeaders, 'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))) }
        );
      }
    }
  }
  // ── 4. Rate Limiting — General API (50 req/10s per user or IP) ───────────────
  // Uses user_id when authenticated to avoid blocking shared NAT/4G IPs (common em Angola).
  else if (path.startsWith('/api/')) {
    if (rateLimiter) {
      const userId = request.headers.get('x-supabase-user-id');
      const limitKey = userId ? `user:${userId}` : `ip:${ip}`;
      const { success, limit, reset, remaining } = await rateLimiter.limit(limitKey);
      const rlHeaders = {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(reset),
        'X-Request-ID': requestId,
      };
      if (!success) {
        return jsonResponse(
          { error: 'Limite de pedidos excedido. Tente novamente em breve.' },
          429,
          { ...rlHeaders, 'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))) }
        );
      }
    }
  }

  // ── 5. Supabase Session ────────────────────────────────────────────────────────
  const response = await updateSession(request);
  response.headers.set('X-Request-ID', requestId);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
