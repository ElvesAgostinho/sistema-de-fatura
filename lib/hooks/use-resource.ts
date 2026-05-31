'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * MOTOR DE DADOS ULTRA-ESTÁVEL (SaaS Engine v5 - Recovery Mode)
 * Focado em: VOLTAR A FUNCIONAR e ESTABILIDADE TOTAL.
 */

const CACHE = new Map<string, { data: any; at: number }>();

if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('fatura_ao_cache');
    if (saved) {
      const parsed = JSON.parse(saved);
      for (const [k, v] of Object.entries(parsed)) {
        CACHE.set(k, v as any);
      }
    }
  } catch {}
}

function persistCache() {
  if (typeof window === 'undefined') return;
  try {
    const obj = Object.fromEntries(CACHE.entries());
    localStorage.setItem('fatura_ao_cache', JSON.stringify(obj));
  } catch {}
}

export function invalidateCache(url?: string) {
  if (url) {
    CACHE.delete(url);
  } else {
    CACHE.clear();
    if (typeof window !== 'undefined') localStorage.removeItem('fatura_ao_cache');
  }
  persistCache();
}

export async function prefetchResource(url: string, ttl = 60000) {
  if (typeof window === 'undefined' || !url) return;
  const entry = CACHE.get(url);
  if (entry && (Date.now() - entry.at < ttl)) return;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      CACHE.set(url, { data, at: Date.now() });
      persistCache();
    }
  } catch {}
}

export function useResource<T = any>(url: string | null, opts: any = {}) {
  const { skip, ttl = 60000, refreshInterval = 0, transform, onError } = opts;

  const [data, setData] = useState<T | undefined>(() => {
    if (typeof window === 'undefined' || !url) return undefined;
    return CACHE.get(url)?.data;
  });
  
  const [loading, setLoading] = useState<boolean>(() => {
    if (!url || skip) return false;
    return !CACHE.get(url);
  });
  
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Efeito para sincronizar quando o URL muda
  useEffect(() => {
    if (!url || skip) {
      setData(undefined);
      setLoading(false);
      return;
    }

    const entry = CACHE.get(url);
    setData(entry?.data);
    setLoading(!entry);
    setError(null);
  }, [url, skip]);

  const run = useCallback(async (isRefresh: boolean) => {
    if (!url || skip) return;

    const entry = CACHE.get(url);
    const now = Date.now();
    
    // SWR: Se temos dados e não é refresh forçado, não bloqueamos
    if (!isRefresh && entry && (now - entry.at < ttl)) {
      setLoading(false);
      return;
    }

    if (!entry) setLoading(true);
    setValidating(true);

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const myId = ++reqIdRef.current;

    try {
      const r = await fetch(url, { signal: ac.signal, cache: 'no-store' });
      const text = await r.text();
      
      if (r.status === 401) {
        if (typeof window !== 'undefined') window.location.href = '/login';
        return;
      }

      if (!r.ok) {
        throw new Error(text || `Erro ${r.status}`);
      }

      if (ac.signal.aborted || myId !== reqIdRef.current) return;

      const raw = text ? JSON.parse(text) : null;
      const finalData = transform ? transform(raw) : raw;

      if (finalData !== null) {
        CACHE.set(url, { data: finalData, at: Date.now() });
        persistCache();
        setData(finalData);
      }
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError' || ac.signal.aborted || myId !== reqIdRef.current) return;
      setError(err);
      onError?.(err);
    } finally {
      if (myId === reqIdRef.current) {
        setLoading(false);
        setValidating(false);
      }
    }
  }, [url, skip, ttl, transform, onError]);

  useEffect(() => {
    run(false);
  }, [run]);

  useEffect(() => {
    if (!refreshInterval || skip || !url) return;
    const itv = setInterval(() => run(true), refreshInterval);
    return () => clearInterval(itv);
  }, [url, skip, refreshInterval, run]);

  // Refetch on window focus
  useEffect(() => {
    if (typeof window === 'undefined' || skip || !url) return;
    const onFocus = () => run(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [url, skip, run]);

  const mutate = useCallback((updater: (prev: T | undefined) => T | undefined) => {
    if (!url) return;
    const current = CACHE.get(url)?.data;
    const next = updater(current);
    if (next !== undefined) {
      CACHE.set(url, { data: next, at: Date.now() });
      persistCache();
      setData(next);
    }
  }, [url]);

  return { data, loading, validating, error, reload: () => run(true), mutate };
}
