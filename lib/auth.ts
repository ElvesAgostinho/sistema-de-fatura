import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerSupabaseClient, createAdminClient } from './supabase/server';

/**
 * Short-lived in-memory cache (per server instance) of user context keyed by
 * the Supabase access token. This drastically cuts down DB round-trips on
 * navigation because `getCurrentUserContext` is called in the layout for
 * every route change.
 */
type CtxCacheValue = {
  user: any;
  profile: any;
  company: any;
  expiresAt: number;
};
const CTX_CACHE = new Map<string, CtxCacheValue>();
const CTX_TTL_MS = 60_000; // 60s — profile/company rarely change

function pickAccessToken(): string | null {
  try {
    const jar = cookies();
    // Supabase cookies names vary per instance; find any that starts with 'sb-'
    const all = jar.getAll();
    for (const c of all) {
      if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) return c.value;
    }
    for (const c of all) {
      if (c.name.startsWith('sb-') && c.name.includes('-auth-token')) return c.value;
    }
  } catch {}
  return null;
}

async function loadContextFromDb() {
  const supabase = createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const admin = createAdminClient();
  // One round-trip: users + nested company via relationship
  const { data: profile } = await admin
    .from('users')
    .select('id, email, company_id, role, status, is_platform_admin, rejection_reason, full_name, company:companies(id, name, nif, address, phone, email, logo_url)')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return { user, profile: null, company: null };

  // Supabase may return the nested relation as either a single object or a
  // 1-element array depending on FK configuration. Normalize to single object.
  const rawCompany = (profile as any).company;
  const company = Array.isArray(rawCompany) ? (rawCompany[0] || null) : (rawCompany || null);
  // strip the nested field so the public shape matches the old API
  const { company: _omit, ...profileFlat } = profile as any;
  return { user, profile: profileFlat, company };
}

// React `cache` de-duplicates calls within a single request.
// We ALSO use a process-level TTL cache keyed by the auth cookie to survive
// across requests (Next.js re-runs the layout for every navigation).
export const getCurrentUserContext = cache(async () => {
  const token = pickAccessToken();
  if (token) {
    const cached = CTX_CACHE.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return { user: cached.user, profile: cached.profile, company: cached.company };
    }
  }

  const ctx = await loadContextFromDb();
  if (!ctx) return null;

  if (token) {
    CTX_CACHE.set(token, {
      user: ctx.user,
      profile: ctx.profile,
      company: ctx.company,
      expiresAt: Date.now() + CTX_TTL_MS,
    });
    // Light LRU: drop oldest if cache grows too big
    if (CTX_CACHE.size > 500) {
      const firstKey = CTX_CACHE.keys().next().value;
      if (firstKey) CTX_CACHE.delete(firstKey);
    }
  }

  return ctx;
});

/** Called after mutations to user/company to invalidate the cache entry. */
export function invalidateUserContextCache() {
  const token = pickAccessToken();
  if (token) CTX_CACHE.delete(token);
}

export async function requireUser() {
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.profile) throw new Error('UNAUTHORIZED');
  return ctx as { user: NonNullable<Awaited<ReturnType<typeof getCurrentUserContext>>>['user']; profile: NonNullable<Awaited<ReturnType<typeof getCurrentUserContext>>>['profile']; company: any; };
}
