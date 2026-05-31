import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Kwanza (AOA) formatter
export function formatAOA(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '0,00 Kz';
  return new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + ' Kz';
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    return new Intl.DateTimeFormat('pt-AO', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
  } catch { return ''; }
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    return new Intl.DateTimeFormat('pt-AO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(date);
  } catch { return ''; }
}

// Validate NIF Angola - 9 digits (basic)
export function isValidNIF(nif: string | null | undefined): boolean {
  if (!nif) return false;
  const clean = nif.replace(/\s+/g, '');
  return /^[0-9A-Z]{9,14}$/.test(clean);
}
