'use client';

import { useResource } from '@/lib/hooks/use-resource';

/**
 * MOTOR DE AQUECIMENTO (Resource Prefetcher) v2
 * Alinhado com as URLs exatas das visualizações para eliminar o piscar.
 */
export function ResourcePrefetcher() {
  // Endpoints que não mudam de URL
  useResource('/api/dashboard', { ttl: 60_000 });
  useResource('/api/clients', { ttl: 60_000 });
  useResource('/api/products', { ttl: 60_000 });
  useResource('/api/suppliers', { ttl: 60_000 });
  
  // Listagens com as queries padrão (Default State)
  // Isto garante que ao clicar em 'Faturas' ou 'Compras', o dado já está lá.
  useResource('/api/invoices?page=1&page_size=20', { ttl: 60_000 });
  useResource('/api/purchases?page=1&search=', { ttl: 60_000 });
  
  return null;
}
