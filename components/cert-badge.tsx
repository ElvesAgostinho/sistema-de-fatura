'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';

type BadgeData = { label: string; tone: 'muted' | 'warn' | 'success' };

export default function CertBadge({ variant = 'sidebar' }: { variant?: 'sidebar' | 'inline' }) {
  const [badge, setBadge] = useState<BadgeData | null>(null);

  useEffect(() => { (async () => {
    try {
      const r = await fetch('/api/fiscal-config', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok && j?.badge) setBadge(j.badge);
    } catch {}
  })(); }, []);

  if (!badge) return null;

  const Icon = badge.tone === 'success' ? ShieldCheck : badge.tone === 'warn' ? ShieldAlert : Shield;
  const cls = badge.tone === 'success'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
    : badge.tone === 'warn'
      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
      : 'bg-secondary text-muted-foreground border-border';

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium ${cls}`}>
        <Icon className="w-3 h-3" /> {badge.label}
      </span>
    );
  }

  return (
    <Link
      href="/settings"
      title="Abrir configurações de certificação"
      className={`mt-2 flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium ${cls} hover:opacity-90 transition`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span className="truncate">{badge.label}</span>
    </Link>
  );
}
