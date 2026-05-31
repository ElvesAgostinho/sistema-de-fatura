'use client';

import { useState } from 'react';
import { Loader2, Users, UserPlus, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useResource } from '@/lib/hooks/use-resource';
import { useProfile } from '@/lib/hooks/use-profile';
import ConfirmModal from '@/components/modals/confirm-modal';

type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

export default function UserManagementPanel() {
  const { profile } = useProfile();
  const { data, loading, reload } = useResource<{ users: User[] }>('/api/company/users', { ttl: 10_000 });
  const users = data?.users ?? [];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('caixa');
  const [inviting, setInviting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const r = await fetch('/api/company/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password || undefined, role })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha ao adicionar utilizador'); return; }
      toast.success(password ? 'Utilizador criado com sucesso' : 'Convite enviado com sucesso');
      setEmail('');
      setPassword('');
      reload();
    } catch (err: any) {
      toast.error('Erro de conexão');
    } finally {
      setInviting(false);
    }
  };

  const onRoleChange = async (userId: string, newRole: string) => {
    try {
      const r = await fetch('/api/company/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: newRole })
      });
      if (!r.ok) {
        const j = await r.json();
        toast.error(j?.error ?? 'Falha ao alterar perfil');
        return;
      }
      toast.success('Perfil atualizado');
      reload();
    } catch (err: any) {
      toast.error('Erro de conexão');
    }
  };

  const onDelete = async () => {
    if (!userToDelete) return;
    try {
      const r = await fetch(`/api/company/users?user_id=${userToDelete.id}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json();
        toast.error(j?.error ?? 'Falha ao remover utilizador');
        return;
      }
      toast.success('Utilizador removido');
      setUserToDelete(null);
      reload();
    } catch (err: any) {
      toast.error('Erro ao remover');
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="ms-card p-10 flex flex-col items-center justify-center text-center">
        <ShieldAlert className="w-10 h-10 text-destructive mb-3" />
        <h3 className="font-semibold text-lg">Acesso Restrito</h3>
        <p className="text-muted-foreground text-sm max-w-sm mt-1">Apenas administradores podem gerir os utilizadores da empresa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Form */}
      <div className="ms-card p-6">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><UserPlus className="w-4 h-4 text-primary" /> Adicionar Utilizador</h3>
        <form onSubmit={onInvite} className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 w-full">
            <label className="text-xs text-muted-foreground mb-1 block">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com" 
              className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
            />
          </div>
          <div className="flex-1 w-full">
            <label className="text-xs text-muted-foreground mb-1 block">Senha (Opcional - acesso imediato)</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Definir senha para o caixa..." 
              className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
            />
          </div>
          <div className="w-full sm:w-48">
            <label className="text-xs text-muted-foreground mb-1 block">Perfil</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="caixa">Operador de Caixa</option>
              <option value="admin">Administrador (Dono)</option>
            </select>
          </div>
          <button type="submit" disabled={inviting} className="w-full sm:w-auto h-10 px-4 rounded bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-60 inline-flex justify-center items-center gap-2">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}
          </button>
        </form>
        <p className="text-xs text-muted-foreground mt-3">
          Se definir uma senha, o operador de caixa poderá iniciar sessão imediatamente com o email e a senha indicados. Se não definir senha, será enviado um link de convite por email.
        </p>
      </div>

      {/* Users List */}
      <div className="ms-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Equipa</h3>
        </div>
        
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum utilizador encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-3 px-5">Utilizador</th>
                  <th className="py-3 px-5">Perfil</th>
                  <th className="py-3 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => {
                  const isMe = u.id === profile.id;
                  return (
                    <tr key={u.id} className="hover:bg-secondary/40">
                      <td className="py-3 px-5">
                        <div className="font-medium">{u.full_name || 'Convite Pendente / Sem Nome'}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-3 px-5">
                        <select
                          value={u.role}
                          disabled={isMe}
                          onChange={(e) => onRoleChange(u.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded border ${u.role === 'admin' ? 'bg-primary/10 border-primary/30 text-primary font-medium' : 'bg-secondary border-border'}`}
                        >
                          <option value="user">Utilizador</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td className="py-3 px-5 text-right">
                        {!isMe && (
                          <button 
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-destructive" 
                            title="Remover utilizador"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {isMe && <span className="text-xs text-muted-foreground">Você</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {userToDelete && (
        <ConfirmModal
          title="Remover Utilizador"
          message={`Tem certeza que deseja remover ${userToDelete.email} do sistema?`}
          confirmLabel="Remover"
          destructive
          onClose={() => setUserToDelete(null)}
          onConfirm={onDelete}
        />
      )}
    </div>
  );
}
