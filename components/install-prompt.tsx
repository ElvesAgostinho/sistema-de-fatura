'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'faturaao_install_dismissed_at';
const DISMISS_DAYS = 365;

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed (standalone display mode)
    if (typeof window === 'undefined') return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Don't show if dismissed recently
    try {
      const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (ts && Date.now() - ts < DISMISS_DAYS * 24 * 3600 * 1000) return;
    } catch {}

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS doesn't fire beforeinstallprompt; show a hint for Safari users
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !/crios|fxios/i.test(window.navigator.userAgent);
    if (isIos) setVisible(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
    setVisible(false);
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  const isIos = typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !/crios|fxios/i.test(window.navigator.userAgent);

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Instalar FaturaAO</div>
          {isIos && !deferred ? (
            <p className="text-xs text-muted-foreground mt-1">
              Toque em <span className="font-semibold">Partilhar</span> → <span className="font-semibold">Adicionar ao Ecrã Principal</span> para instalar.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Use a aplicação online, atalho no ecrã principal, experiência full-screen.</p>
          )}
          <div className="flex gap-2 mt-3">
            {deferred && (
              <button onClick={install} className="px-3 py-1.5 rounded text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90">
                Instalar agora
              </button>
            )}
            <button onClick={dismiss} className="px-3 py-1.5 rounded text-xs font-medium text-muted-foreground hover:bg-secondary">
              {deferred ? 'Mais tarde' : 'Fechar'}
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="p-1 rounded hover:bg-secondary flex-shrink-0" aria-label="Fechar">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
