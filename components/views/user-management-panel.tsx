'use client';

import { useState } from 'react';
import { Loader2, Users, UserPlus, Trash2, ShieldAlert, ShieldCheck, UserCog, Lock, Mail, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useResource } from '@/lib/hooks/use-resource';
import { useProfile } from '@/lib/hooks/use-profile';
import ConfirmModal from '@/components/modals/confirm-modal';

type TeamUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

const ROLE_CONFIG: Record<string, { label: string; color: string; description: string; icon: React.ReactNode }> = {
  admin: {
    label: 'Administrador',
    color: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300',
    description: 'Acesso total: faturas, clientes, produtos, configurações, utilizadores, relatórios',
    icon: <ShieldCheck className="w-3 h-3" />,
  },
  gestor: {
    label: 'Gestor',
    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
    description: 'Gerir faturas, clientes, produtos e relatórios. Não pode gerir utilizadores nem configurações.',
    icon: <UserCog className="w-3 h-3" />,
  },
  caixa: {
    label: 'Operador de Caixa',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
    description: 'Acesso apenas ao POS: abrir caixa, vender, fechar caixa. Não vê preços de custo.',
    icon: <Lock className="w-3 h-3" />,
  },
  user: {
    label: 'Utilizador',
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    description: 'Acesso básico de leitura.',
    icon: <Users className="w-3 h-3" />,
  },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.user;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function getInitials(name: string | null, email: string) {
  if (name && name.trim()) {
    return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getDisplayName(user: TeamUser) {
  if (user.full_name && user.full_name.trim()) return user.full_name;
  return user.email.split('@')[0]; // usa parte do email como nome
}

function isPendingInvite(user: TeamUser) {
  return !user.full_name || user.full_name.trim() === '';
}

export default function UserManagementPanel() {
  const { profile } = useProfile();
  const { data, loading, reload } = useResource<{ users: TeamUser[] }>('/api/company/users', { ttl: 10_000 });
  const users = data?.users ?? [];

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('caixa');
  const [inviting, setInviting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<TeamUser | null>(null);
  const [showRoleHelp, setShowRoleHelp] = useState(false);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const r = await fetch('/api/company/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password || undefined, role }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha ao adicionar utilizador'); return; }
      toast.success(password
        ? `✓ ${ROLE_CONFIG[role]?.label ?? role} criado — pode iniciar sessão imediatamente`
        : `✓ Convite enviado para ${email.trim()}`
      );
      setEmail('');
      setPassword('');
      reload();
    } catch {
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
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });
      if (!r.ok) { const j = await r.json(); toast.error(j?.error ?? 'Falha'); return; }
      toast.success(`Perfil alterado para ${ROLE_CONFIG[newRole]?.label ?? newRole}`);
      reload();
    } catch { toast.error('Erro de conexão'); }
  };

  const onDelete = async () => {
    if (!userToDelete) return;
    try {
      const r = await fetch(`/api/company/users?user_id=${userToDelete.id}`, { method: 'DELETE' });
      if (!r.ok) { const j = await r.json(); toast.error(j?.error ?? 'Falha ao remover'); return; }
      toast.success('Utilizador removido da empresa');
      setUserToDelete(null);
      reload();
    } catch { toast.error('Erro ao remover'); }
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

      {/* ── COMO FUNCIONA ────────────────────────────────────────────── */}
      <div className="ms-card p-5 bg-primary/5 border-primary/20">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-primary">
          <Users className="w-4 h-4" /> Como funciona a gestão de equipa
        </h4>
        <div className="grid sm:grid-cols-3 gap-3">
          {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'user').map(([key, cfg]) => (
            <div key={key} className="bg-background rounded-lg border border-border p-3">
              <div className="mb-1.5"><RoleBadge role={key} /></div>
              <p className="text-xs text-muted-foreground leading-relaxed">{cfg.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-primary/10 flex gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-primary" /><strong>Convite por email</strong> — utilizador define a própria senha</span>
          <span className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-primary" /><strong>Senha directa</strong> — admin define a senha, acesso imediato</span>
        </div>
      </div>

      {/* ── FORMULÁRIO ADICIONAR ─────────────────────────────────────── */}
      <div className="ms-card p-6">
        <h3 className="font-semibold flex items-center gap-2 mb-5">
          <UserPlus className="w-4 h-4 text-primary" /> Adicionar Membro da Equipa
        </h3>
        <form onSubmit={onInvite} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email do colaborador *</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="colaborador@empresa.ao"
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Senha <span className="font-normal">(opcional — para acesso imediato)</span>
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Deixe em branco para enviar convite por email"
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Selector de perfil com descrição */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nível de acesso *</label>
            <div className="grid sm:grid-cols-3 gap-2">
              {(['caixa', 'gestor', 'admin'] as const).map(r => (
                <button
                  key={r} type="button" onClick={() => setRole(r)}
                  className={`p-3 rounded-lg border text-left transition-all ${role === r ? 'border-primary bg-primary/8 ring-1 ring-primary' : 'border-border hover:border-primary/40'}`}
                >
                  <div className="mb-1"><RoleBadge role={r} /></div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ROLE_CONFIG[r].description.split('.')[0]}.</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {password
                ? <><CheckCircle2 className="w-3 h-3 inline text-emerald-500 mr-1" />Acesso imediato — o colaborador usa o email e esta senha</>
                : <><Mail className="w-3 h-3 inline text-primary mr-1" />Sem senha → será enviado um link de convite por email</>
              }
            </p>
            <button type="submit" disabled={inviting} className="ms-btn-primary disabled:opacity-60 min-w-[120px]">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> Adicionar</>}
            </button>
          </div>
        </form>
      </div>

      {/* ── LISTA DA EQUIPA ──────────────────────────────────────────── */}
      <div className="ms-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Equipa
            <span className="text-xs text-muted-foreground font-normal">({users.length} {users.length === 1 ? 'membro' : 'membros'})</span>
          </h3>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum utilizador encontrado.</div>
        ) : (
          <div className="divide-y divide-border">
            {users.map(u => {
              const isMe      = u.id === profile?.id;
              const pending   = isPendingInvite(u);
              const initials  = getInitials(u.full_name, u.email);
              const name      = getDisplayName(u);

              return (
                <div key={u.id} className={`flex items-center gap-4 px-5 py-4 transition-colors ${!isMe ? 'hover:bg-secondary/30' : 'bg-primary/5'}`}>
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{name}</span>
                      {pending && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                          ✉ Convite pendente
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-medium">
                          Você
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>

                  {/* Role selector */}
                  <div className="shrink-0">
                    {isMe ? (
                      <RoleBadge role={u.role} />
                    ) : (
                      <select
                        value={u.role}
                        onChange={e => onRoleChange(u.id, e.target.value)}
                        className="text-xs h-8 px-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        title="Alterar perfil"
                      >
                        <option value="caixa">Operador de Caixa</option>
                        <option value="gestor">Gestor</option>
                        <option value="admin">Administrador</option>
                      </select>
                    )}
                  </div>

                  {/* Delete */}
                  <div className="shrink-0 w-8">
                    {!isMe && (
                      <button
                        onClick={() => setUserToDelete(u)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remover da empresa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {userToDelete && (
        <ConfirmModal
          title="Remover da empresa"
          message={`Remover ${getDisplayName(userToDelete)} (${userToDelete.email}) da equipa? O acesso ao sistema será revogado imediatamente.`}
          confirmLabel="Remover"
          destructive
          onClose={() => setUserToDelete(null)}
          onConfirm={onDelete}
        />
      )}
    </div>
  );
}
