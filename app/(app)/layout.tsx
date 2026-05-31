import { redirect } from 'next/navigation';
import { getCurrentUserContext } from '@/lib/auth';
import AppShell from '@/components/app-shell';
import { ResourcePrefetcher } from '@/components/resource-prefetcher';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.user) redirect('/login');
  if (!ctx.profile) redirect('/login');

  // Gate: block pending/rejected accounts from app
  if ((ctx.profile as any).status === 'pending') redirect('/pending');
  if ((ctx.profile as any).status === 'rejected') redirect('/rejected');

  const safeCompany = ctx.company ? {
    id: ctx.company.id, name: ctx.company.name, nif: ctx.company.nif,
    email: ctx.company.email, logo_url: ctx.company.logo_url,
  } : null;

  const isSuperAdmin = ctx.profile?.email === 'elvessacapuri57@gmail.com';
  const isPlatformAdmin = isSuperAdmin || Boolean((ctx.profile as any).is_platform_admin);

  return (
    <AppShell 
      user={{ email: ctx.user.email ?? '' }} 
      company={safeCompany} 
      isPlatformAdmin={isPlatformAdmin}
      role={(ctx.profile as any).role}
    >
      <ResourcePrefetcher />
      {children}
    </AppShell>
  );
}
