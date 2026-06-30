import { redirect } from 'next/navigation';

export default function AccountingIndexPage() {
  // Redireciona diretamente para o dashboard da contabilidade
  redirect('/accounting/dashboard');
}
