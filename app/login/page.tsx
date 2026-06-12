'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FileText, Mail, Lock, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Show success toast when redirected from pending page after approval
  useEffect(() => {
    if (searchParams.get('approved') === '1') {
      toast.success('Conta aprovada! Pode entrar agora.', {
        icon: <CheckCircle2 className="text-green-500" />,
        duration: 6000,
      });
    }
  }, [searchParams]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message || 'Falha no login');
        return;
      }
      toast.success('Bem-vindo!');
      // Role-based redirect: caixa goes directly to POS
      const meRes = await fetch('/api/auth/me');
      const meJson = await meRes.json();
      const role = meJson?.profile?.role;
      if (role === 'caixa') {
        router.replace('/pos');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro inesperado');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar à página inicial
        </Link>
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded bg-primary text-primary-foreground flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <span className="text-xl font-semibold">FaturaAO</span>
        </Link>

        <div className="ms-card p-8">
          <h1 className="text-2xl font-bold mb-2">Entrar na sua conta</h1>
          <p className="text-sm text-muted-foreground mb-6">Acesso ao sistema de faturação</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="empresa@exemplo.ao"
                  className="w-full h-10 pl-10 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-10 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm transition-colors inline-flex items-center justify-center gap-2 h-10 disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Não tem conta? <Link href="/register" className="text-primary font-medium hover:underline">Criar empresa</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
