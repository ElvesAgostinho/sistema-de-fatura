'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  const logout = async () => {
    try {
      const sb = createClient();
      await sb.auth.signOut();
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  };
  return (
    <button onClick={logout} className="px-4 py-2 rounded bg-secondary hover:bg-secondary/70 text-sm font-medium">
      Terminar sessão
    </button>
  );
}
