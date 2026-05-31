import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import AppShell from '@/components/app-shell';
import { ResourcePrefetcher } from '@/components/resource-prefetcher';
import { ErrorBoundary } from '@/components/error-boundary';

export const dynamic = 'force-dynamic';

// Skeleton shown while a page loads
function PageSkeleton() {
  return (
    <div style={{ padding: '2rem', animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div style={{ height: 28, background: 'hsl(var(--muted))', borderRadius: 6, width: '40%', marginBottom: '1.5rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[1,2,3].map(i => <div key={i} style={{ height: 100, background: 'hsl(var(--muted))', borderRadius: 8 }} />)}
      </div>
      <div style={{ height: 300, background: 'hsl(var(--muted))', borderRadius: 8 }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

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

  // Super admin check — use env var in production for security
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'elvessacapuri57@gmail.com';
  const isSuperAdmin = ctx.profile?.email === superAdminEmail;
  const isPlatformAdmin = isSuperAdmin || Boolean((ctx.profile as any).is_platform_admin);

  return (
    <AppShell
      user={{ email: ctx.user.email ?? '' }}
      company={safeCompany}
      isPlatformAdmin={isPlatformAdmin}
      role={(ctx.profile as any).role}
    >
      <ResourcePrefetcher />
      <ErrorBoundary section="App">
        <Suspense fallback={<PageSkeleton />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

