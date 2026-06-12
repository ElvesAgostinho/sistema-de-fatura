'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Clock, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';

export default function PendingPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [checking, setChecking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(8);

  // Load initial user info
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return; }
      setEmail(data.user.email ?? '');
    });
  }, [router]);

  // Poll the status every 8 seconds
  useEffect(() => {
    const supabase = createClient();

    async function checkStatus() {
      setChecking(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }

        const { data: profile } = await supabase
          .from('users')
          .select('status')
          .eq('id', user.id)
          .maybeSingle();

        const s = profile?.status;
        setStatus(s ?? 'pending');

        if (s === 'approved') {
          // Small delay so the user sees the green state before redirect
          setTimeout(() => router.replace('/login?approved=1'), 1800);
        } else if (s === 'rejected') {
          router.replace('/rejected');
        }
      } finally {
        setChecking(false);
      }
    }

    // Check immediately on mount
    checkStatus();

    // Then poll every 8 seconds
    const interval = setInterval(checkStatus, 8000);

    // Countdown display
    const countdown = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) return 8;
        return s - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdown);
    };
  }, [router]);

  // Approved state — show success before redirect
  if (status === 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-secondary/30">
        <div className="ms-card max-w-lg w-full p-8 text-center space-y-5 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-600 dark:text-green-400">Conta aprovada!</h1>
            <p className="text-sm text-muted-foreground mt-2">A encaminhar para o login…</p>
          </div>
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-secondary/30">
      <div className="ms-card max-w-lg w-full p-8 text-center space-y-5">

        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <Clock className="w-7 h-7" />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold">Conta a aguardar aprovação</h1>
          {email && (
            <p className="text-sm text-muted-foreground mt-2">
              A sua conta <span className="font-mono text-foreground">{email}</span> foi criada
              com sucesso mas ainda precisa de ser aprovada pela administração.
            </p>
          )}
        </div>

        {/* Info */}
        <div className="text-left bg-secondary rounded-lg p-4 text-sm space-y-2">
          <p className="flex gap-2 items-start">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            Esta página verifica automaticamente o estado da sua conta.
          </p>
          <p className="text-xs text-muted-foreground">
            Será redirecionado automaticamente assim que a sua conta for aprovada.
            Não precisa de fazer refresh.
          </p>
        </div>

        {/* Auto-check indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          {checking
            ? <><Loader2 className="w-3 h-3 animate-spin" /> A verificar…</>
            : <><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" /> Próxima verificação em {secondsLeft}s</>
          }
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => { const s = createClient(); s.auth.signOut().then(() => router.replace('/login')); }}
            className="text-sm px-4 py-2 rounded-md border border-input bg-background hover:bg-secondary transition-colors"
          >
            Sair
          </button>
          <a href="/" className="text-sm text-muted-foreground underline underline-offset-4 self-center">
            Início
          </a>
        </div>

      </div>
    </div>
  );
}
