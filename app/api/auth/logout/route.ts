import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
