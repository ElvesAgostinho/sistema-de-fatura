import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUserContext } from '@/lib/auth';
import LogoutButton from './logout-button';
import { Clock, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PendingPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.user) redirect('/login');
  // If user somehow became approved, go to app
  if ((ctx.profile as any)?.status === 'approved') redirect('/dashboard');
  if ((ctx.profile as any)?.status === 'rejected') redirect('/rejected');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-secondary/30">
      <div className="ms-card max-w-lg w-full p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <Clock className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Conta a aguardar aprovação</h1>
          <p className="text-sm text-muted-foreground mt-2">
            A sua conta <span className="font-mono">{ctx.user.email}</span> foi criada com sucesso mas ainda precisa de ser aprovada pela administração.
          </p>
        </div>
        <div className="text-left bg-secondary rounded p-4 text-sm space-y-2">
          <p className="flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary" /> Será notificado por email assim que a sua conta for aprovada.</p>
          <p className="text-xs text-muted-foreground">Se não receber resposta em 48 horas, contacte o suporte em <a className="underline" href="mailto:suporte@topconsultores.pt">suporte@topconsultores.pt</a>.</p>
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <LogoutButton />
          <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4 self-center">Início</Link>
        </div>
      </div>
    </div>
  );
}
