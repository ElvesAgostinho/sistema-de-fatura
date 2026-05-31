'use client';

import { FileText, LayoutDashboard, FilePlus, Users, Package, Banknote, BarChart3, Settings, LogOut, UserCheck, Menu, X, Calendar, Calculator, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import NotificationBell from './notification-bell';
import { CommandPalette } from './command-palette';
import CertBadge from './cert-badge';
import NavProgress from './nav-progress';

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
    title: 'Compras',
    items: [
      { href: '/purchases/new', label: 'Registar Compra', icon: FilePlus },
      { href: '/purchases', label: 'Compras', icon: FileText },
      { href: '/suppliers', label: 'Fornecedores', icon: Users },
      { href: '/products', label: 'Produtos', icon: Package },
    ]
  }
];

const COMPANY_ADMIN_CATEGORY = {
  title: 'Gestão',
  items: [
    { href: '/reports', label: 'Relatórios', icon: BarChart3 },
    { href: '/taxes', label: 'Impostos & SAF-T', icon: Banknote },
    { href: '/audit', label: 'Auditoria', icon: ClipboardList },
    { href: '/settings', label: 'Configurações', icon: Settings },
  ]
};

const SUPER_ADMIN_CATEGORY = {
  title: 'SaaS',
  items: [
    { href: '/admin/approvals', label: 'Aprovações', icon: UserCheck },
  ]
};

// Reusable icons
function ClipboardList(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
}

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
  };

  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  useEffect(() => { setOptimisticHref(null); }, [pathname]);

  const logout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch('/api/auth/logout', { method: 'POST' });
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

  const isActive = (href: string) => {
    if (optimisticHref) return href === optimisticHref;
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href !== '/dashboard' && activeHref === href) return true;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F5F8]">
      <NavProgress />
      
      {/* Topbar Desktop */}
      <header className="hidden md:flex flex-col bg-[#0b4a6f] text-white sticky top-0 z-40 shadow-sm">
        {/* Superior Topbar (Logo & Perfil) */}
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#13b5ea] text-white flex items-center justify-center font-bold">
              FA
            </div>
            <span className="font-semibold text-lg tracking-wide">FaturaAO</span>
            <div className="ml-4 pl-4 border-l border-white/20">
              <div className="text-[13px] font-bold">{company?.name ?? '---'}</div>
              <div className="text-[11px] text-white/70">NIF: {company?.nif ?? '---'}</div>
            </div>
            <div className="ml-4">
              <CertBadge />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <CommandPalette />
            <NotificationBell />
            <div className="flex items-center gap-3 pl-4 border-l border-white/20">
              <div className="text-[13px] font-medium hidden lg:block">{user.email}</div>
              <button onClick={logout} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white" title="Encerrar Sessão">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Inferior Topbar (Menu Navigation) */}
        <div className="flex items-center px-6 h-12 bg-[#093c5a] overflow-x-auto no-scrollbar">
          <nav className="flex items-center gap-1 min-w-max">
            {categories.map((category, idx) => (
              <div key={idx} className="flex items-center">
                {idx > 0 && <div className="w-px h-6 bg-white/10 mx-2" />}
                <div className="flex items-center gap-1">
                  {category.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={true}
                        onMouseEnter={() => handleHoverPrefetch(item.href)}
                        onClick={() => setOptimisticHref(item.href)}
                        className={cn(
                          'px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap',
                          active 
                            ? 'bg-[#13b5ea] text-white' 
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 h-14 bg-[#0b4a6f] text-white shadow-md flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#13b5ea] flex items-center justify-center font-bold">
            FA
          </div>
          <span className="font-semibold text-[15px]">FaturaAO</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={() => setOpen(!open)} className="p-2 rounded hover:bg-white/10 transition-colors">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 top-14 bg-white z-30 overflow-y-auto shadow-inner animate-in slide-in-from-top-2">
          <div className="p-4 bg-[#f4f5f8] border-b border-slate-200">
            <div className="text-[14px] font-bold text-slate-800">{company?.name ?? '---'}</div>
            <div className="text-[12px] text-slate-500 mb-2">NIF: {company?.nif ?? '---'}</div>
            <CertBadge />
          </div>
          <div className="p-4 space-y-6">
            {categories.map((category, idx) => (
              <div key={idx} className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
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
                          'flex items-center gap-3 px-3 py-2.5 rounded-md text-[14px] font-medium transition-colors',
                          active ? 'bg-[#13b5ea]/10 text-[#0b4a6f]' : 'text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        <Icon className={cn("w-5 h-5", active ? "text-[#13b5ea]" : "text-slate-400")} /> {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-slate-100">
              <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-md text-[14px] font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                <LogOut className="w-4 h-4" /> Terminar Sessão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Area */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
