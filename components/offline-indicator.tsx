'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { syncPendingInvoices } from '@/lib/offline-sync';
import { toast } from 'sonner';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleOffline() {
      setIsOffline(true);
      toast.warning('A trabalhar offline. As alterações serão sincronizadas depois.', {
        icon: <WifiOff className="w-4 h-4" />
      });
    }

    async function handleOnline() {
      setIsOffline(false);
      setIsSyncing(true);
      try {
        const res = await syncPendingInvoices();
        if (res.count > 0) {
          if (res.success) {
            toast.success(`${res.count} fatura(s) pendente(s) sincronizada(s) com sucesso!`, {
              icon: <Wifi className="w-4 h-4" />
            });
          } else {
            toast.error(`Sincronização concluída com erros. Falharam ${res.errors.length} fatura(s).`);
          }
        } else {
          toast.success('Ligação à internet restaurada.', {
            icon: <Wifi className="w-4 h-4" />
          });
        }
      } catch (e) {
        console.error('Failed to sync', e);
      } finally {
        setIsSyncing(false);
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    } else {
      // Background sync when app loads and is online
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !isSyncing) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 py-1 text-xs text-center font-medium transition-colors ${
      isOffline ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
    }`}>
      {isOffline ? (
        <span className="flex items-center justify-center gap-2">
          <WifiOff className="w-3 h-3" />
          Modo Offline Activo
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <Wifi className="w-3 h-3 animate-pulse" />
          A Sincronizar dados...
        </span>
      )}
    </div>
  );
}
