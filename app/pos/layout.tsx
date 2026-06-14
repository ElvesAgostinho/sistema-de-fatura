/**
 * POS Layout — standalone, outside the AppShell group.
 * Runs auth check independently so no navbar/sidebar is rendered.
 */
import { redirect } from 'next/navigation';
import { getCurrentUserContext } from '@/lib/auth';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'POS — Ponto de Venda | FaturaAO',
  description: 'Sistema de ponto de venda profissional para retalho e supermercados',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
};

export default async function POSRootLayout({ children }: { children: React.ReactNode }): Promise<any> {
  const ctx = await getCurrentUserContext();
  if (!ctx?.user) redirect('/login');
  if (!ctx.profile) redirect('/login');

  const status = (ctx.profile as any).status;
  if (status === 'pending') redirect('/pending');
  if (status === 'rejected') redirect('/rejected');

  // POS renders full-screen — no AppShell, no navbar, no sidebar
  return <>{children}</>;
}
