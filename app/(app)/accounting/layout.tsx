"use client";

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PieChart, List, FileArchive, Settings } from 'lucide-react';

export default function AccountingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const links = [
    { href: '/accounting/dashboard', label: 'Painel Central', icon: PieChart },
    { href: '/accounting/invoices-registry', label: 'Livro de Faturas', icon: List },
    { href: '/accounting/closings', label: 'Fechos Globais', icon: FileArchive },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Menu lateral de contabilidade */}
      <aside className="w-full md:w-64 flex-shrink-0">
        <div className="ms-card p-4 sticky top-24">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Contabilidade
          </h2>
          <nav className="space-y-1">
            {links.map((link) => {
              const active = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/70 hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Conteúdo da página */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
