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

const getXeroMenus = (role?: string, isPlatformAdmin?: boolean) => {
  const isCompanyAdmin = role === 'admin' || isPlatformAdmin;
  
  const baseMenus = [
    {
      title: 'Painel',
      href: '/dashboard',
      items: []
    },
    {
      title: 'Negócios',
      items: [
        { href: '/invoices', label: 'Faturas de Clientes' },
        { href: '/invoices/new', label: 'Nova Fatura' },
        { href: '/recurring', label: 'Avenças' },
        { href: '/pos-close', label: 'Fecho de Caixa' },
        { divider: true },
        { href: '/purchases', label: 'Faturas de Fornecedores' },
        { href: '/purchases/new', label: 'Nova Compra' },
        { divider: true },
        { href: '/products', label: 'Produtos e Serviços' },
      ]
    },
    {
      title: 'Contactos',
      items: [
        { href: '/clients', label: 'Clientes' },
        { href: '/suppliers', label: 'Fornecedores' },
      ]
    }
  ];

  if (isCompanyAdmin) {
    baseMenus.splice(2, 0, {
      title: 'Contabilidade',
      items: [
        { href: '/reports', label: 'Relatórios' },
        { href: '/taxes', label: 'Impostos e SAF-T' },
        { href: '/audit', label: 'Auditoria' },
        { href: '/settings', label: 'Configurações Avançadas' },
      ]
    });
  }

  // Se for apenas caixa, limitar opções no Negócios
  if (role === 'caixa') {
    const negociosIndex = baseMenus.findIndex(m => m.title === 'Negócios');
    if (negociosIndex !== -1) {
      baseMenus[negociosIndex].items = [
        { href: '/invoices', label: 'Faturas de Clientes' },
        { href: '/invoices/new', label: 'Nova Fatura' },
        { href: '/pos-close', label: 'Fecho de Caixa' },
        { divider: true },
        { href: '/products', label: 'Consulta de Artigos' },
      ];
    }
  }

  return baseMenus;
};

export default function AppShell({ children, user, company, isPlatformAdmin, role }: {
  children: React.ReactNode;
  user: { email: string };
  company: { id: string; name: string; nif: string; email?: string; logo_url?: string | null } | null;
  isPlatformAdmin?: boolean;
  role?: string;
}) {
  const isCompanyAdmin = role === 'admin' || isPlatformAdmin;
  const XERO_MENUS = getXeroMenus(role, isPlatformAdmin);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  const isActive = (href?: string) => {
    if (!href) return false;
    if (optimisticHref) return href === optimisticHref;
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href !== '/dashboard' && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F5F8]">
      <NavProgress />
      
      {/* Topbar Desktop (Xero Style) */}
      <header className="hidden md:flex flex-col bg-[#0b4a6f] text-white sticky top-0 z-40 shadow">
        <div className="flex items-center justify-between px-4 h-12">
          
          {/* Left Side: Logo & Navigation */}
          <div className="flex items-center h-full">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-8">
              <div className="w-7 h-7 rounded bg-[#13b5ea] text-white flex items-center justify-center font-bold text-sm">
                FA
              </div>
              <span className="font-semibold text-lg tracking-tight">FaturaAO</span>
            </div>

            {/* Navigation Menus */}
            <nav className="flex items-center h-full gap-1">
              {XERO_MENUS.map((menu, idx) => {
                const hasItems = menu.items && menu.items.length > 0;
                const isMenuBtnActive = menu.href ? isActive(menu.href) : menu.items?.some(i => !i.divider && isActive(i.href));

                if (!hasItems) {
                  return (
                    <Link
                      key={idx}
                      href={menu.href!}
                      className={cn(
                        'h-full px-4 flex items-center text-sm font-medium transition-colors border-b-2',
                        isMenuBtnActive ? 'border-[#13b5ea] text-white bg-[#093c5a]' : 'border-transparent text-white/90 hover:bg-[#093c5a]'
                      )}
                    >
                      {menu.title}
                    </Link>
                  );
                }

                return (
                  <div key={idx} className="relative group h-full">
                    <button className={cn(
                      'h-full px-4 flex items-center gap-1 text-sm font-medium transition-colors border-b-2',
                      isMenuBtnActive ? 'border-[#13b5ea] text-white bg-[#093c5a]' : 'border-transparent text-white/90 group-hover:bg-[#093c5a]'
                    )}>
                      {menu.title}
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>

                    {/* Dropdown menu */}
                    <div className="absolute left-0 top-full hidden group-hover:block w-56 pt-1">
                      <div className="bg-white rounded-b-md shadow-lg border border-slate-200 py-2 overflow-hidden text-slate-800">
                        {menu.items.map((item, i) => {
                          if (item.divider) return <div key={i} className="my-1.5 border-t border-slate-100" />;
                          return (
                            <Link
                              key={i}
                              href={item.href!}
                              onClick={() => setOptimisticHref(item.href!)}
                              className={cn(
                                'block px-4 py-2 text-sm transition-colors',
                                isActive(item.href) ? 'bg-[#13b5ea]/10 text-[#13b5ea] font-medium' : 'hover:bg-slate-50'
                              )}
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
          
          {/* Right Side: Tools & Profile */}
          <div className="flex items-center gap-2 h-full">
            <Link href="/invoices/new" className="p-1.5 hover:bg-[#093c5a] rounded-full transition-colors text-white" title="Adicionar Rápido">
              <Plus className="w-5 h-5" />
            </Link>
            <CommandPalette />
            <NotificationBell />
            
            {/* User Profile Dropdown */}
            <div className="relative group h-full flex items-center ml-2 border-l border-white/20 pl-4">
              <button className="flex items-center gap-2 h-full hover:bg-[#093c5a] px-2 -mx-2 rounded transition-colors">
                <div className="w-7 h-7 rounded-full bg-[#13b5ea] text-white flex items-center justify-center text-xs font-bold">
                  {user.email.substring(0,2).toUpperCase()}
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[12px] font-bold leading-tight">{company?.name ?? '---'}</span>
                  <span className="text-[10px] text-white/70 leading-tight">NIF: {company?.nif}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 opacity-70 ml-1" />
              </button>
              
              <div className="absolute right-0 top-full hidden group-hover:block w-64 pt-1">
                <div className="bg-white rounded-b-md shadow-lg border border-slate-200 overflow-hidden text-slate-800">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="text-sm font-bold truncate">{user.email}</div>
                    <div className="text-xs text-slate-500 capitalize">{role === 'admin' ? 'Administrador' : 'Operador'}</div>
                    <div className="mt-2"><CertBadge /></div>
                  </div>
                  <div className="py-2">
                    <Link href="/settings" className="block px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"><Settings className="w-4 h-4 text-slate-400" /> Definições da conta</Link>
                    <button onClick={logout} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"><LogOut className="w-4 h-4 text-slate-400" /> Terminar sessão</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 h-14 bg-[#0b4a6f] text-white shadow-md flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#13b5ea] flex items-center justify-center font-bold">FA</div>
          <span className="font-semibold text-[15px]">FaturaAO</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={() => setOpen(!open)} className="p-2 rounded hover:bg-[#093c5a] transition-colors">
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
            {XERO_MENUS.map((menu, idx) => (
              <div key={idx} className="space-y-2">
                {menu.href ? (
                  <Link href={menu.href} onClick={() => setOpen(false)} className={cn("block text-[15px] font-bold mb-2", isActive(menu.href) ? "text-[#13b5ea]" : "text-slate-800")}>{menu.title}</Link>
                ) : (
                  <div className="text-[15px] font-bold text-slate-800 mb-2 border-b pb-1">{menu.title}</div>
                )}
                <div className="space-y-1">
                  {menu.items?.map((item, i) => {
                    if (item.divider) return null;
                    const active = isActive(item.href);
                    return (
                      <Link 
                        key={i} 
                        href={item.href!} 
                        onClick={() => { setOpen(false); setOptimisticHref(item.href!); }} 
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-[14px] font-medium transition-colors',
                          active ? 'bg-[#13b5ea]/10 text-[#0b4a6f]' : 'text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        {item.label}
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
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:py-8 md:px-0">
        {children}
      </main>
    </div>
  );
}
