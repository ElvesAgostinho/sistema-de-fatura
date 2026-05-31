import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { rateLimiter, authRateLimiter } from '@/lib/redis';

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const path = request.nextUrl.pathname;

  // 1. Rate Limiting Restrito para Autenticação (Login/Registo)
  if (path.startsWith('/api/auth') || path === '/login' || path === '/register') {
    if (authRateLimiter) {
      const { success, limit, reset } = await authRateLimiter.limit(ip);
      if (!success) {
        return new NextResponse('Too Many Requests - Please try again later', { 
          status: 429,
          headers: { 'Retry-After': reset.toString(), 'X-RateLimit-Limit': limit.toString() }
        });
      }
    }
  } 
  // 2. Rate Limiting Geral para APIs
  else if (path.startsWith('/api/')) {
    if (rateLimiter) {
      const { success, limit, reset } = await rateLimiter.limit(ip);
      if (!success) {
        return new NextResponse('Too Many Requests', { 
          status: 429,
          headers: { 'Retry-After': reset.toString(), 'X-RateLimit-Limit': limit.toString() }
        });
      }
    }
  }

  // 3. Sessão do Supabase
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
