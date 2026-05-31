import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase configuration error: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    // Fallback to empty strings to avoid crash during initialization, 
    // but the error above will help identify the root cause in the console.
    return createBrowserClient(
      supabaseUrl || '',
      supabaseAnonKey || ''
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
