import { NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  return NextResponse.json({
    user: { email: ctx.user.email },
    profile: ctx.profile,
    company: ctx.company
  });
}
