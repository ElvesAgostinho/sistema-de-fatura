/**
 * POS Layout — overrides the AppShell for full-screen mode.
 * The POS runs as a standalone full-screen experience without
 * the normal navigation header/sidebar.
 */
import { redirect } from 'next/navigation';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.user) redirect('/login');
  if (!ctx.profile) redirect('/login');

  const status = (ctx.profile as any).status;
  if (status === 'pending') redirect('/pending');
  if (status === 'rejected') redirect('/rejected');

  // POS renders full-screen — no AppShell wrapper
  return <>{children}</>;
}
