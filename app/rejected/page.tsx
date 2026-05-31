import { redirect } from 'next/navigation';
import { getCurrentUserContext } from '@/lib/auth';
import LogoutButton from '../pending/logout-button';
import { XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function RejectedPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.user) redirect('/login');
  if ((ctx.profile as any)?.status === 'approved') redirect('/dashboard');
  if ((ctx.profile as any)?.status === 'pending') redirect('/pending');

  const reason = (ctx.profile as any)?.rejection_reason as string | null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-secondary/30">
      <div className="ms-card max-w-lg w-full p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <XCircle className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Acesso não autorizado</h1>
          <p className="text-sm text-muted-foreground mt-2">
            O seu pedido de registo foi rejeitado pela administração.
          </p>
        </div>
        {reason && (
          <div className="text-left bg-secondary rounded p-4 text-sm">
            <div className="text-xs uppercase text-muted-foreground mb-1 font-semibold">Motivo</div>
            <div>{reason}</div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Se considera que foi um erro, contacte-nos em <a className="underline" href="mailto:suporte@topconsultores.pt">suporte@topconsultores.pt</a>.
        </p>
        <div className="pt-2"><LogoutButton /></div>
      </div>
    </div>
  );
}
