import RecurringView from '@/components/views/recurring-view';
import { requireUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Avenças — FaturaAO' };

export default async function RecurringPage() {
  const { profile } = await requireUser();
  if ((profile as any).role === 'caixa') redirect('/dashboard');
  
  return <RecurringView />;
}
