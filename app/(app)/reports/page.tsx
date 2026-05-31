import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import ReportsView from '@/components/views/reports-view';

export const metadata = { title: 'Relatórios — FaturaAO' };
export default async function ReportsPage() {
  const { profile } = await requireUser();
  if ((profile as any).role === 'caixa') redirect('/dashboard');
  return <ReportsView />;
}
