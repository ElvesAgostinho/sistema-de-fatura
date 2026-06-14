'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus, FileText, LayoutDashboard, Package, Users, Settings, Calculator, Search, Receipt } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <>
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background text-sm text-muted-foreground cursor-pointer hover:bg-secondary/50 transition-colors mx-3" onClick={() => setOpen(true)}>
        <Search className="w-4 h-4 opacity-50" />
        <span className="flex-1 text-left">Pesquisa rápida...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Escreva um comando ou pesquise..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Ações Rápidas">
            <CommandItem onSelect={() => runCommand(() => router.push('/invoices/new'))}>
              <FilePlus className="mr-2 h-4 w-4" />
              <span>Emitir Fatura</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/clients'))}>
              <Users className="mr-2 h-4 w-4" />
              <span>Adicionar Cliente</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/products'))}>
              <Package className="mr-2 h-4 w-4" />
              <span>Adicionar Produto/Serviço</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Navegação">
            <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/invoices'))}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Documentos Emitidos</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/pos-close'))}>
              <Calculator className="mr-2 h-4 w-4" />
              <span>Fecho de Caixa</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/reports'))}>
              <Receipt className="mr-2 h-4 w-4" />
              <span>Relatórios</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
