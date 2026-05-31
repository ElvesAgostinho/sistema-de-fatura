import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import DashboardView from '@/components/views/dashboard-view';

export const metadata = { title: 'Dashboard · FaturaAO' };
export default async function Page() {
  const { profile } = await requireUser();
  if ((profile as any).role === 'caixa') redirect('/invoices/new');
  return <DashboardView />;
}
