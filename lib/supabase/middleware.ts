import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Fast-path: skip Supabase validation entirely for routes that don't need it.
  // API routes do their own auth in the handler; static/_next assets never need it.
  const skipAuth =
    path.startsWith('/_next') ||
    path.startsWith('/api/') ||
    path === '/' ||
    path.includes('.');

  if (skipAuth) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Middleware: Supabase configuration error - Missing URL or Key');
    // We continue to avoid breaking the whole app, but auth won't work
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/auth');
  const isGateRoute = path === '/pending' || path === '/rejected';

  // Helper to redirect preserving cookies
  const redirect = (toPath: string) => {
    const url = request.nextUrl.clone();
    url.pathname = toPath;
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c.name, c.value, c);
    });
    return redirectResponse;
  };

  if (!user && !isAuthRoute) {
    return redirect('/login');
  }

  if (user && isAuthRoute && path !== '/auth/callback') {
    return redirect('/dashboard');
  }

  // Authenticated users on gate routes: OK, just pass through
  if (user && isGateRoute) {
    return response;
  }

  return response;
}
