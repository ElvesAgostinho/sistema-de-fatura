'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Loader2, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: '', companyName: '', nif: '', address: '', phone: '',
    email: '', password: '',
  });

  const onChange = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nif || form.nif.length < 9) { toast.error('NIF inválido'); return; }
    setLoading(true);
    try {
      // 1) Sign up via Supabase Auth
      const supabase = createClient();
      const { data: auth, error } = await supabase.auth.signUp({
        email: form.email, password: form.password,
      });
      if (error) { toast.error(error.message); return; }
      if (!auth?.user) { toast.error('Não foi possível criar conta'); return; }

      // 2) Create the company + user profile via our signup endpoint
      const resp = await fetch('/api/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: auth.user.id,
          email: form.email,
          companyName: form.companyName,
          nif: form.nif,
          address: form.address,
          phone: form.phone,
          fullName: form.fullName,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) { toast.error(json?.error ?? 'Falha ao criar empresa'); return; }

      // 3) Ensure session is set (sign in again if not auto-confirmed)
      if (!auth.session) {
        const { error: err2 } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (err2) { toast.error('Conta criada. Por favor entre.'); router.replace('/login'); return; }
      }

      toast.success('Pedido enviado — aguarde aprovação');
      router.replace('/pending');
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro inesperado');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4 py-10">
      <div className="w-full max-w-lg">
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
          <h1 className="text-2xl font-bold mb-2">Criar a sua empresa</h1>
          <p className="text-sm text-muted-foreground mb-6">Comece a emitir faturas em minutos</p>

          <div className="mb-5 p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
            ⓘ Após submeter, o seu pedido fica a aguardar aprovação pela administração da plataforma. Receberá um email quando a conta for aprovada.
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome completo (responsável)</label>
                <input required value={form.fullName} onChange={(e) => onChange('fullName', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="João Manuel Silva" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome da empresa</label>
                <input required value={form.companyName} onChange={(e) => onChange('companyName', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Empresa Exemplo, Lda" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">NIF</label>
                  <input required value={form.nif} onChange={(e) => onChange('nif', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="5417000000" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Telefone</label>
                  <input value={form.phone} onChange={(e) => onChange('phone', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="+244 900 000 000" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Endereço</label>
                <input value={form.address} onChange={(e) => onChange('address', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Luanda, Angola" />
              </div>
              <div className="h-px bg-border my-2" />
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email (login)</label>
                <input type="email" required value={form.email} onChange={(e) => onChange('email', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Senha</label>
                <input type="password" required minLength={6} value={form.password} onChange={(e) => onChange('password', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Mínimo 6 caracteres" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full ms-btn-primary justify-center h-10 disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar empresa'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta? <Link href="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
