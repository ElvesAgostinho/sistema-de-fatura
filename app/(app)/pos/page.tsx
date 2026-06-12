import type { Metadata } from 'next';
import POSView from '@/components/views/pos-view';

export const metadata: Metadata = {
  title: 'POS — Ponto de Venda | FaturaAO',
  description: 'Sistema de ponto de venda para retalho e supermercados',
};

// POS runs full-screen — dynamic to allow real-time operations
export const dynamic = 'force-dynamic';

export default function POSPage() {
  return <POSView />;
}
