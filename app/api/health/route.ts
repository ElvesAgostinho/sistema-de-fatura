import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VERSION = process.env.npm_package_version ?? '1.0.0';

export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {};

  // ── Database check ───────────────────────────────────────────────────────────
  try {
    const dbStart = Date.now();
    const admin = createAdminClient();
    const { error } = await admin.from('companies').select('id').limit(1);
    checks.database = {
      status: error ? 'error' : 'ok',
      latencyMs: Date.now() - dbStart,
      ...(error ? { error: error.message } : {}),
    };
  } catch (err: any) {
    checks.database = { status: 'error', error: err?.message ?? 'unknown' };
  }

  // ── Redis check ──────────────────────────────────────────────────────────────
  if (redis) {
    try {
      const redisStart = Date.now();
      await redis.ping();
      checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
    } catch (err: any) {
      checks.redis = { status: 'error', error: err?.message ?? 'unknown' };
    }
  } else {
    checks.redis = { status: 'error', error: 'Redis not configured' };
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');
  const httpStatus = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      version: VERSION,
      environment: process.env.NODE_ENV ?? 'unknown',
      uptimeMs: process.uptime() * 1000,
      totalLatencyMs: Date.now() - start,
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Health-Check': 'true',
      },
    }
  );
}
