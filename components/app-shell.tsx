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
  return (
    <div className="min-h-screen flex bg-slate-100">
      <NavProgress />
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-56 flex-col bg-[#F3F4F6] border-r border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)] fixed h-full z-20">
        <div className="h-12 px-4 flex items-center gap-2 bg-[#005A9E] text-white border-b border-[#004A82]">
          <div className="w-6 h-6 rounded bg-white/20 text-white flex items-center justify-center shadow-sm">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-sm tracking-wide">Primavera ERP</span>
        </div>
        <div className="px-3 py-3 border-b border-slate-200 bg-white">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Entidade Ativa</div>
          <div className="text-[13px] font-bold text-slate-800 truncate">{company?.name ?? '---'}</div>
          <div className="text-[11px] font-mono text-slate-500 mb-1">NIF: {company?.nif ?? '---'}</div>
          <CertBadge />
        </div>
        <div className="pt-2 pb-1 px-2">
          <CommandPalette />
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-3">
          {categories.map((category, idx) => (
            <div key={idx}>
              <div className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                {category.title}
              </div>
              <div className="space-y-0.5">
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
                        'flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-[12.5px] font-medium transition-colors border border-transparent',
                        active 
                          ? 'bg-[#0078D4] text-white shadow-sm border-[#005A9E]' 
                          : 'text-slate-700 hover:bg-slate-200/60 hover:border-slate-300'
                      )}
                    >
                      <Icon className={cn("w-4 h-4", active ? "text-white" : "text-slate-500")} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-300 bg-slate-200/50 space-y-1">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-[11px] text-slate-600 font-medium truncate flex-1">{user.email}</div>
            <NotificationBell />
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[12.5px] font-medium text-red-700 hover:bg-red-100 border border-transparent hover:border-red-200 transition">
            <LogOut className="w-3.5 h-3.5" /> Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-12 bg-[#005A9E] text-white shadow-md flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-sm">Primavera ERP</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button onClick={() => setOpen(!open)} className="p-1.5 rounded hover:bg-white/10">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 top-12 bg-slate-100 z-30 p-3 overflow-y-auto space-y-4 shadow-inner">
          {categories.map((category, idx) => (
            <div key={idx} className="bg-white rounded-md border border-slate-200 p-2 shadow-sm">
              <div className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 mt-1">
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
                        'flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium',
                        active ? 'bg-[#0078D4] text-white' : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      <Icon className={cn("w-4 h-4", active ? "text-white" : "text-slate-500")} /> {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-3 mt-4 rounded-md text-[13px] font-bold text-red-700 bg-red-50 border border-red-200 shadow-sm">
            <LogOut className="w-4 h-4" /> Encerrar Sessão
          </button>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 md:ml-56 pt-12 md:pt-0 min-h-screen bg-slate-100">
        <div className="max-w-[1400px] mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
