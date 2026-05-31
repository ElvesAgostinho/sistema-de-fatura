'use client';
import { useEffect } from 'react';

export default function SwRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        // Auto-update when a new version is available
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              // A new SW is installed — activate it right away
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      } catch (e) {
        console.log('SW registration failed:', e);
      }
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
