'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, FilePlus, Users, Package, Settings, LogOut, Menu, X, ShieldCheck, ClipboardList, UserCheck, Receipt, BarChart3, Banknote, CreditCard, Calculator, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { invalidateCache, prefetchResource } from '@/lib/hooks/use-resource';
import CertBadge from './cert-badge';
import NavProgress from './nav-progress';
import NotificationBell from './notification-bell';
import { CommandPalette } from './command-palette';

const MENU_CATEGORIES = [
  {
    title: 'Vendas',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/invoices/new', label: 'Emitir Documento', icon: FilePlus },
      { href: '/invoices', label: 'Documentos Emitidos', icon: FileText },
      { href: '/recurring', label: 'Avenças', icon: Calendar },
      { href: '/pos-close', label: 'Fecho do Dia', icon: Calculator },
      { href: '/clients', label: 'Clientes', icon: Users },
    ]
  },
  {
    title: 'Compras & Stock',
    items: [
      { href: '/purchases/new', label: 'Registar Compra', icon: FilePlus },
      { href: '/purchases', label: 'Compras', icon: FileText },
      { href: '/suppliers', label: 'Fornecedores', icon: Users },
      { href: '/products', label: 'Produtos', icon: Package },
    ]
  }
];

const COMPANY_ADMIN_CATEGORY = {
  title: 'Gestão & Administração',
  items: [
    { href: '/reports', label: 'Relatórios', icon: BarChart3 },
    { href: '/taxes', label: 'Impostos & SAF-T', icon: Banknote },
    { href: '/audit', label: 'Auditoria', icon: ClipboardList },
    { href: '/settings', label: 'Configurações', icon: Settings },
  ]
};

const SUPER_ADMIN_CATEGORY = {
  title: 'SaaS (SuperAdmin)',
  items: [
    { href: '/admin/approvals', label: 'Aprovações', icon: UserCheck },
  ]
};

export default function AppShell({ children, user, company, isPlatformAdmin, role }: {
  children: React.ReactNode;
  user: { email: string };
  company: { id: string; name: string; nif: string; email?: string; logo_url?: string | null } | null;
  isPlatformAdmin?: boolean;
  role?: string;
}) {
  const isCompanyAdmin = role === 'admin' || isPlatformAdmin;
  const categories = [];
  
  if (role === 'caixa') {
    categories.push({
      title: 'Operações de Caixa',
      items: [
        { href: '/invoices/new', label: 'Emitir Fatura (POS)', icon: FilePlus },
        { href: '/invoices', label: 'Documentos Emitidos', icon: FileText },
        { href: '/pos-close', label: 'Fecho do Dia', icon: Calculator },
        { href: '/clients', label: 'Clientes', icon: Users },
        { href: '/products', label: 'Consulta de Artigos', icon: Package },
      ]
    });
  } else {
    categories.push(...MENU_CATEGORIES);
  }

  if (isCompanyAdmin) categories.push(COMPANY_ADMIN_CATEGORY);
  if (isPlatformAdmin) categories.push(SUPER_ADMIN_CATEGORY);
  const NAV = categories.flatMap(c => c.items);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleHoverPrefetch = (href: string) => {
    router.prefetch(href);
    let apiUrl = '';
    if (href === '/dashboard') apiUrl = '/api/dashboard';
    else if (href === '/invoices') apiUrl = '/api/invoices';
    else if (href === '/clients') apiUrl = '/api/clients';
    else if (href === '/products') apiUrl = '/api/products';
    else if (href === '/suppliers') apiUrl = '/api/suppliers';
    else if (href === '/purchases') apiUrl = '/api/purchases';
    
    if (apiUrl) prefetchResource(apiUrl);
  };

  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  useEffect(() => { setOptimisticHref(null); }, [pathname]);

  const logout = async () => {
    try {
      invalidateCache();
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch('/api/auth/logout', { method: 'POST' });
      // Força um carregamento completo para limpar a cache do router do Next.js
      window.location.href = '/login';
    } catch {
      toast.error('Erro ao terminar sessão');
    }
  };

  const activeHref = (() => {
    if (!pathname) return '';
    let best = '';
    for (const item of NAV) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        if (item.href.length > best.length) best = item.href;
      }
    }
    return best;
  })();
  const effectiveHref = optimisticHref ?? activeHref;
  const isActive = (href: string) => effectiveHref === href;

  return (
    <div className="min-h-screen flex bg-secondary/30">
      <NavProgress />
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border fixed h-full">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-border">
          <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <span className="font-semibold">FaturaAO</span>
        </div>
        <div className="px-3 py-4 border-b border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Empresa</div>
          <div className="text-sm font-semibold truncate">{company?.name ?? '---'}</div>
          <div className="text-xs font-mono text-muted-foreground">NIF: {company?.nif ?? '---'}</div>
          <CertBadge />
        </div>
        <div className="pt-3 pb-1">
          <CommandPalette />
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {categories.map((category, idx) => (
            <div key={idx}>
              <div className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                {category.title}
              </div>
              <div className="space-y-1">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      onMouseEnter={() => handleHoverPrefetch(item.href)}
                      onClick={() => setOptimisticHref(item.href)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-xs text-muted-foreground truncate flex-1">{user.email}</div>
            <NotificationBell />
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-card border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary text-primary-foreground flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <span className="font-semibold">FaturaAO</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button onClick={() => setOpen(!open)} className="p-2 rounded hover:bg-secondary">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 top-14 bg-background z-30 p-4 overflow-y-auto space-y-4">
          {categories.map((category, idx) => (
            <div key={idx}>
              <div className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                {category.title}
              </div>
              <div className="space-y-1">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link 
                      key={item.href} 
                      href={item.href} 
                      onClick={() => { setOpen(false); setOptimisticHref(item.href); }} 
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium',
                        active ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                      )}
                    >
                      <Icon className="w-4 h-4" /> {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-3 mt-4 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 min-h-screen">
        <div className="max-w-[1200px] mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
