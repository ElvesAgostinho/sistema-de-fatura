'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, X, Printer,
  CreditCard, Banknote, Smartphone, ChevronLeft, ChevronDown,
  Package, LogOut, RefreshCw, CheckCircle2, Loader2,
  Calculator, Tag, Clock, Receipt, Scan, Wifi, WifiOff,
  Shield, AlertCircle, Percent, BarChart3, AlertTriangle, KeyRound,
  Star, Pause, Play, Monitor, Tablet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProfile } from '@/lib/hooks/use-profile';
import type { POSProduct, POSCartItem, PaymentMethod, POSSession } from '@/lib/pos/types';
import {
  printReceiptFallback, printToThermal, connectThermalPrinter,
  isThermalConnected, openCashDrawer, type ReceiptData,
} from '@/lib/pos/thermal-printer';

/* ─── Design Tokens ───────────────────────────────────────────────────────── */
const XERO = {
  navy:    '#0b4a6f',
  navyDk:  '#093c5a',
  cyan:    '#13b5ea',
  cyanDk:  '#0e9fd4',
  bg:      '#F4F5F8',
  card:    '#ffffff',
  border:  '#e2e4e9',
  text:    '#202f3f',
  muted:   '#627284',
  success: '#21ab6b',
  warning: '#f9a806',
  danger:  '#e6193c',
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const kz = (n: number) =>
  `${n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

function calcLine(item: POSCartItem): POSCartItem {
  const eff = item.price * (1 - item.discount_pct / 100);
  const sub = +(eff * item.quantity).toFixed(2);
  const tax = +(sub * (item.tax_rate / 100)).toFixed(2);
  return { ...item, line_subtotal: sub, line_tax: tax, line_total: +(sub + tax).toFixed(2) };
}

const CAT_EMOJI: Record<string, string> = {
  'Alimentação':'🥦','Bebidas':'🍺','Higiene':'🧴','Limpeza':'🧹',
  'Mercearia':'🥫','Frios':'❄️','Padaria':'🍞','Talho':'🥩',
  'Peixaria':'🐟','Frutas':'🍎','Electrónica':'📱','Vestuário':'👕',
  'Bebidas Alcoólicas':'🍷','Laticínios':'🥛','Confeitaria':'🍫',
};

const PAY_ICONS: Record<PaymentMethod, React.ReactNode> = {
  'Dinheiro':   <Banknote className="w-4 h-4" />,
  'Multicaixa': <CreditCard className="w-4 h-4" />,
  'TPA':        <Smartphone className="w-4 h-4" />,
  'Crédito':    <Tag className="w-4 h-4" />,
  'Misto':      <Calculator className="w-4 h-4" />,
};

/* ─── Haptic feedback helper ──────────────────────────────────────────────── */
function vibrate(ms = 40) {
  try { if ('vibrate' in navigator) navigator.vibrate(ms); } catch {}
}

/* ─── ProductCard ─────────────────────────────────────────────────────────── */
function ProductCard({
  product, onAdd, touchMode = false, isFavorite = false, onFavorite,
}: {
  product: POSProduct;
  onAdd: (p: POSProduct) => void;
  touchMode?: boolean;
  isFavorite?: boolean;
  onFavorite?: (id: string) => void;
}) {
  const qty        = product.quantity_in_stock ?? Infinity;
  const lowStock   = product.track_stock && qty < 5 && qty > 0;
  const outOfStock = product.track_stock && qty <= 0;

  const handleAdd = () => {
    if (outOfStock) return;
    vibrate(30);
    onAdd(product);
  };

  return (
    <div className="relative group">
      <button
        onClick={handleAdd}
        disabled={outOfStock}
        style={{
          background: XERO.card,
          borderColor: isFavorite ? `${XERO.warning}80` : XERO.border,
          minHeight: touchMode ? '148px' : '100px',
        }}
        className={[
          'relative flex flex-col items-center w-full rounded-xl border text-center select-none',
          touchMode ? 'p-3 gap-1' : 'p-2.5',
          'transition-all duration-150',
          outOfStock
            ? 'opacity-40 cursor-not-allowed'
            : 'cursor-pointer hover:border-[#13b5ea] hover:shadow-md active:scale-95 active:shadow-sm',
        ].join(' ')}
      >
        {/* Product image / emoji */}
        <div className={touchMode ? 'text-4xl leading-none mb-1' : 'text-2xl leading-none mb-1'}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt=""
              className={touchMode ? 'w-14 h-14 object-cover rounded-lg' : 'w-9 h-9 object-cover rounded-md'}
            />
          ) : (
            CAT_EMOJI[product.category ?? ''] ?? '📦'
          )}
        </div>

        {/* Name */}
        <p
          className={[
            'font-semibold leading-tight text-slate-700 line-clamp-2 w-full',
            touchMode ? 'text-[13px]' : 'text-[11px]',
          ].join(' ')}
        >
          {product.name}
        </p>

        {/* Price */}
        <p
          className={['font-bold tabular-nums mt-auto', touchMode ? 'text-sm' : 'text-[12px]'].join(' ')}
          style={{ color: XERO.cyan }}
        >
          {kz(product.price)}
        </p>

        {/* Low stock badge */}
        {lowStock && (
          <span
            className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: `${XERO.warning}20`, color: XERO.warning }}
          >
            {qty}
          </span>
        )}

        {/* Out of stock overlay */}
        {outOfStock && (
          <span className="absolute inset-0 rounded-xl flex items-center justify-center bg-white/80 text-red-500 text-xs font-bold">
            Esgotado
          </span>
        )}

        {/* Hover add indicator */}
        {!outOfStock && (
          <div
            className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ background: `${XERO.cyan}12` }}
          >
            <Plus className="w-6 h-6" style={{ color: XERO.cyan }} />
          </div>
        )}

        {/* Favorite glow border */}
        {isFavorite && (
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ boxShadow: `inset 0 0 0 2px ${XERO.warning}50` }}
          />
        )}
      </button>

      {/* Favorite star button — visible on hover (desktop) / always subtle (touch) */}
      {onFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(product.id); vibrate(20); }}
          className={[
            'absolute top-1.5 left-1.5 z-10 rounded-full p-1 transition-all',
            touchMode
              ? isFavorite ? 'opacity-100' : 'opacity-30 hover:opacity-80'
              : isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100',
          ].join(' ')}
          style={{ color: isFavorite ? XERO.warning : XERO.muted }}
          title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Star className="w-3.5 h-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  );
}

/* ─── CartItemRow ─────────────────────────────────────────────────────────── */
function CartItemRow({
  item, onQtyChange, onRemove, onDiscount, touchMode = false,
}: {
  item: POSCartItem;
  onQtyChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onDiscount: (id: string) => void;
  touchMode?: boolean;
}) {
  const [pendingRemove, setPendingRemove] = useState(false);

  const handleRemove = () => {
    if (item.quantity >= 5) {
      // ask for confirmation only for large quantities
      setPendingRemove(true);
      setTimeout(() => setPendingRemove(false), 3000);
    } else {
      vibrate(30);
      onRemove(item.product_id);
    }
  };

  const btnSize    = touchMode ? 'w-11 h-11' : 'w-6 h-6';
  const iconSize   = touchMode ? 'w-4 h-4' : 'w-3 h-3';
  const actionSize = touchMode ? 'w-9 h-9' : 'w-5 h-5';

  return (
    <div
      className={[
        'flex items-center gap-2 rounded-xl border group transition-all hover:shadow-sm',
        touchMode ? 'py-3 px-3' : 'py-2 px-3',
      ].join(' ')}
      style={{ background: XERO.card, borderColor: XERO.border }}
    >
      {/* Item info */}
      <div className="flex-1 min-w-0">
        <p
          className={['font-semibold truncate', touchMode ? 'text-sm' : 'text-xs'].join(' ')}
          style={{ color: XERO.text }}
        >
          {item.name}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: XERO.muted }}>
          {kz(item.price)}
          {item.discount_pct > 0 && (
            <span className="ml-1 font-bold" style={{ color: XERO.warning }}>
              -{item.discount_pct}%
            </span>
          )}
          {' · IVA '}{item.tax_rate}%
        </p>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => { vibrate(20); onQtyChange(item.product_id, item.quantity - 1); }}
          className={`${btnSize} rounded-lg border flex items-center justify-center transition-colors hover:bg-slate-100 active:bg-slate-200 active:scale-95`}
          style={{ borderColor: XERO.border, color: XERO.muted }}
        >
          <Minus className={iconSize} />
        </button>
        <span
          className={['text-center font-bold tabular-nums', touchMode ? 'w-10 text-base' : 'w-8 text-sm'].join(' ')}
          style={{ color: XERO.text }}
        >
          {item.quantity}
        </span>
        <button
          onClick={() => { vibrate(20); onQtyChange(item.product_id, item.quantity + 1); }}
          className={`${btnSize} rounded-lg border flex items-center justify-center transition-colors hover:bg-slate-100 active:bg-slate-200 active:scale-95`}
          style={{ borderColor: XERO.border, color: XERO.muted }}
        >
          <Plus className={iconSize} />
        </button>
      </div>

      {/* Line total */}
      <p
        className={['text-right font-bold tabular-nums shrink-0', touchMode ? 'w-20 text-sm' : 'w-[72px] text-xs'].join(' ')}
        style={{ color: XERO.text }}
      >
        {kz(item.line_total)}
      </p>

      {/* Actions — always visible in touch mode, hover-only on desktop */}
      <div
        className={[
          'flex flex-col gap-0.5 shrink-0',
          touchMode ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity',
        ].join(' ')}
      >
        {/* Discount */}
        <button
          onClick={() => onDiscount(item.product_id)}
          className={`${actionSize} rounded-lg flex items-center justify-center transition-colors hover:bg-amber-50 active:scale-95`}
          style={{ color: XERO.warning }}
          title="Desconto"
        >
          <Percent className={iconSize} />
        </button>

        {/* Remove / Confirm */}
        {pendingRemove ? (
          <button
            onClick={() => { vibrate(50); onRemove(item.product_id); setPendingRemove(false); }}
            className={`${actionSize} rounded-lg flex items-center justify-center bg-red-50 border border-red-200 transition-colors active:scale-95`}
            style={{ color: XERO.danger }}
            title="Confirmar remoção"
          >
            <CheckCircle2 className={iconSize} />
          </button>
        ) : (
          <button
            onClick={handleRemove}
            className={`${actionSize} rounded-lg flex items-center justify-center transition-colors hover:bg-red-50 active:scale-95`}
            style={{ color: XERO.danger }}
            title="Remover"
          >
            <X className={iconSize} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── PaymentModal ────────────────────────────────────────────────────────── */
function PaymentModal({
  total, method, onMethodChange, onConfirm, onClose, processing,
}: {
  total: number; method: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  onConfirm: (tendered: number) => void;
  onClose: () => void;
  processing: boolean;
}) {
  const [tendered, setTendered] = useState(total.toFixed(2));
  const tenderedNum = parseFloat(tendered) || 0;
  const change      = Math.max(0, tenderedNum - total);
  const inputRef    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTendered(total.toFixed(2));
    setTimeout(() => inputRef.current?.select(), 80);
  }, [total, method]);

  const numpadPress = (val: string) => {
    vibrate(20);
    setTendered(prev => {
      if (val === '⌫') return prev.slice(0, -1) || '0';
      if (val === '.' && prev.includes('.')) return prev;
      if (prev === '0' && val !== '.') return val;
      return prev + val;
    });
  };

  const NUMPAD: string[] = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];
  const METHODS: PaymentMethod[] = ['Dinheiro', 'Multicaixa', 'TPA', 'Crédito'];

  const quickAmounts = useMemo(() => {
    const cands = [
      Math.ceil(total / 500) * 500,
      Math.ceil(total / 1000) * 1000,
      5000, 10000, 20000, 50000,
    ];
    const seen = new Set<number>();
    return cands
      .filter(a => { if (seen.has(a) || a <= 0) return false; seen.add(a); return true; })
      .slice(0, 4)
      .map(a => ({
        a,
        label: a >= 1000
          ? `${(a / 1000) % 1 === 0 ? a / 1000 : (a / 1000).toFixed(1)}k`
          : `${a}`,
      }));
  }, [total]);

  const canConfirm = !processing && (method !== 'Dinheiro' || tenderedNum >= total);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end sm:justify-center sm:items-center"
      style={{
        background: 'rgba(9,60,90,0.75)',
        backdropFilter: 'blur(8px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: XERO.card,
          maxHeight: 'calc(100dvh - env(safe-area-inset-top,0px) - 12px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ background: XERO.navy }}
        >
          <div className="flex items-center gap-2.5 text-white">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: XERO.cyan }}
            >
              <Receipt className="w-4 h-4" />
            </div>
            <span className="font-bold text-base">Pagamento</span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4" style={{ background: XERO.bg }}>

          {/* Total */}
          <div className="rounded-2xl p-5 text-center border" style={{ background: XERO.card, borderColor: XERO.border }}>
            <p className="text-[10px] uppercase tracking-widest mb-1 font-semibold" style={{ color: XERO.muted }}>
              Total a pagar
            </p>
            <p className="text-4xl font-black tabular-nums" style={{ color: XERO.text }}>
              {kz(total)}
            </p>
          </div>

          {/* Payment methods */}
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map(m => (
              <button
                key={m}
                onClick={() => { vibrate(20); onMethodChange(m); }}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-[11px] font-bold transition-all active:scale-95"
                style={{
                  borderColor: method === m ? XERO.cyan : XERO.border,
                  background: method === m ? `${XERO.cyan}12` : XERO.card,
                  color: method === m ? XERO.cyan : XERO.muted,
                }}
              >
                {PAY_ICONS[m]}
                {m}
              </button>
            ))}
          </div>

          {method === 'Dinheiro' && (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 block" style={{ color: XERO.muted }}>
                  Valor entregue
                </label>
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  value={tendered}
                  onChange={e => setTendered(e.target.value)}
                  className="w-full rounded-xl px-4 py-3.5 text-3xl font-black text-right tabular-nums focus:outline-none transition-colors border-2"
                  style={{
                    background: XERO.card,
                    borderColor: XERO.cyan,
                    color: XERO.text,
                  }}
                />
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map(({ a, label }) => (
                  <button
                    key={a}
                    onClick={() => { vibrate(20); setTendered(a.toFixed(2)); }}
                    className="py-3 rounded-xl text-sm font-bold transition-all active:scale-95 border"
                    style={{
                      background: tenderedNum === a ? XERO.cyan : XERO.card,
                      borderColor: tenderedNum === a ? XERO.cyan : XERO.border,
                      color: tenderedNum === a ? '#fff' : XERO.text,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Numpad — large touch-friendly keys */}
              <div className="grid grid-cols-3 gap-2">
                {NUMPAD.map(k => (
                  <button
                    key={k}
                    onClick={() => numpadPress(k)}
                    className="py-4 rounded-xl text-xl font-bold transition-all active:scale-95 border hover:border-[#13b5ea]"
                    style={{
                      background: k === '⌫' ? '#fee2e2' : XERO.card,
                      borderColor: k === '⌫' ? '#fca5a5' : XERO.border,
                      color: k === '⌫' ? '#ef4444' : XERO.text,
                      minHeight: '64px',
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Change */}
              {change > 0 && (
                <div
                  className="flex items-center justify-between rounded-xl px-5 py-3.5 border"
                  style={{ background: `${XERO.success}10`, borderColor: `${XERO.success}40` }}
                >
                  <span className="text-sm font-bold" style={{ color: XERO.success }}>Troco</span>
                  <span className="text-3xl font-black tabular-nums" style={{ color: XERO.success }}>{kz(change)}</span>
                </div>
              )}
            </>
          )}

          {method !== 'Dinheiro' && (
            <div className="rounded-xl p-6 text-center border" style={{ background: XERO.card, borderColor: XERO.border }}>
              {method === 'Multicaixa' && <><CreditCard className="w-10 h-10 mx-auto mb-2" style={{ color: XERO.cyan }} /><p className="text-sm" style={{ color: XERO.muted }}>Processe no TPA Multicaixa</p></>}
              {method === 'TPA'        && <><Smartphone className="w-10 h-10 mx-auto mb-2 text-purple-500" /><p className="text-sm" style={{ color: XERO.muted }}>Aguarde confirmação do terminal TPA</p></>}
              {method === 'Crédito'    && <><Tag className="w-10 h-10 mx-auto mb-2" style={{ color: XERO.warning }} /><p className="text-sm" style={{ color: XERO.muted }}>Venda registada a crédito</p></>}
            </div>
          )}
        </div>

        {/* Confirm */}
        <div className="px-5 py-4 border-t shrink-0" style={{ background: XERO.card, borderColor: XERO.border }}>
          <button
            onClick={() => { vibrate(50); onConfirm(tenderedNum); }}
            disabled={!canConfirm}
            className="w-full rounded-xl font-black text-lg text-white tracking-wide transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            style={{ background: canConfirm ? XERO.cyan : XERO.muted, minHeight: '60px' }}
          >
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {processing ? 'A processar…' : 'Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SessionModal — Abrir Caixa ──────────────────────────────────────────── */
function SessionModal({
  onOpen, onClose, isCaixa = false,
}: {
  onOpen: (n: string, b: number) => void;
  onClose: () => void;
  isCaixa?: boolean;
}) {
  const [name,    setName]    = useState('Caixa 1');
  const [balance, setBalance] = useState('');
  const [opening, setOpening] = useState(false);

  const TERMINALS     = ['Caixa 1', 'Caixa 2', 'Caixa 3', 'Caixa 4'];
  const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000, 200000];
  const NUMPAD        = ['7','8','9','4','5','6','1','2','3','000','0','⌫'];

  const numpadPress = (val: string) => {
    vibrate(20);
    setBalance(prev => {
      if (val === '⌫') return prev.slice(0, -1);
      if (val === '000') return prev + '000';
      return prev + val;
    });
  };

  const balanceNum = parseFloat(balance) || 0;

  const handleOpen = async () => {
    if (opening) return;
    vibrate(50);
    setOpening(true);
    await onOpen(name, balanceNum);
    setOpening(false);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(9,60,90,0.95)', backdropFilter: 'blur(10px)' }}
      onClick={isCaixa ? undefined : onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: '#fff', maxHeight: '96dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 shrink-0" style={{ background: '#0b4a6f' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#13b5ea' }}>
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-black text-lg">Abrir Caixa</h3>
              <p className="text-white/50 text-xs">Declare o fundo inicial para começar o turno</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4 bg-slate-50">

          {/* Terminal selector */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-400">
              Terminal
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {TERMINALS.map(t => (
                <button
                  key={t}
                  onClick={() => { vibrate(20); setName(t); }}
                  className="py-3 rounded-lg text-xs font-bold border-2 transition-all active:scale-95"
                  style={{
                    background:  name === t ? '#0b4a6f' : '#fff',
                    borderColor: name === t ? '#13b5ea' : '#e2e8f0',
                    color:       name === t ? '#fff' : '#64748b',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amount display */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-400">
              Fundo de Caixa
            </label>
            <div
              className="rounded-2xl border-2 px-5 py-4 text-right bg-white"
              style={{ borderColor: balanceNum > 0 ? '#13b5ea' : '#e2e8f0' }}
            >
              <p className="text-4xl font-black tabular-nums text-slate-800">
                {balanceNum > 0 ? balanceNum.toLocaleString('pt-AO') : '0'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Kwanzas (Kz)</p>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="grid grid-cols-3 gap-1.5">
            {QUICK_AMOUNTS.map(a => (
              <button
                key={a}
                onClick={() => { vibrate(20); setBalance(String(a)); }}
                className="py-3 rounded-xl text-xs font-black border-2 transition-all active:scale-95"
                style={{
                  background:  balanceNum === a ? '#f59e0b15' : '#fff',
                  borderColor: balanceNum === a ? '#f59e0b' : '#e2e8f0',
                  color:       balanceNum === a ? '#f59e0b' : '#64748b',
                }}
              >
                {a >= 1000 ? `${a / 1000}k` : a}
              </button>
            ))}
          </div>

          {/* Numpad — large touch keys */}
          <div className="grid grid-cols-3 gap-2">
            {NUMPAD.map(k => (
              <button
                key={k}
                onClick={() => numpadPress(k)}
                className="rounded-xl font-black text-xl border-2 transition-all active:scale-95 active:shadow-inner"
                style={{
                  background:  k === '⌫' ? '#fee2e2' : '#fff',
                  borderColor: k === '⌫' ? '#fca5a5' : '#e2e8f0',
                  color:       k === '⌫' ? '#ef4444' : '#1e293b',
                  minHeight:   '64px',
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-4 py-4 shrink-0 border-t border-slate-100 bg-white">
          <button
            onClick={handleOpen}
            disabled={opening}
            className="w-full rounded-2xl font-black text-xl text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
            style={{ background: opening ? '#64748b' : '#13b5ea', minHeight: '60px' }}
          >
            {opening
              ? <><Loader2 className="w-6 h-6 animate-spin" /> A abrir…</>
              : <><CheckCircle2 className="w-6 h-6" /> Iniciar Turno</>
            }
          </button>
          <button
            onClick={onClose}
            className="w-full mt-2 py-3 rounded-xl text-sm font-semibold border transition-colors hover:bg-slate-50 flex items-center justify-center gap-2"
            style={{ borderColor: '#e2e8f0', color: '#64748b' }}
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── DiscountModal ───────────────────────────────────────────────────────── */
function DiscountModal({
  productId, current, onApply, onClose,
}: {
  productId: string; current: number;
  onApply: (id: string, pct: number) => void;
  onClose: () => void;
}) {
  const [pct, setPct] = useState(String(current));
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(9,60,90,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xs rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: XERO.card }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4" style={{ background: XERO.navy }}>
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Percent className="w-4 h-4" style={{ color: XERO.warning }} />
            Aplicar Desconto
          </h3>
        </div>
        <div className="p-4 space-y-3" style={{ background: XERO.bg }}>
          <div className="grid grid-cols-3 gap-2">
            {[5,10,15,20,25,50].map(q => (
              <button
                key={q}
                onClick={() => { vibrate(20); setPct(String(q)); }}
                className="py-3 rounded-lg text-sm font-bold border transition-all active:scale-95"
                style={{
                  background:  pct === String(q) ? XERO.warning : XERO.card,
                  borderColor: pct === String(q) ? XERO.warning : XERO.border,
                  color:       pct === String(q) ? '#fff' : XERO.text,
                }}
              >
                {q}%
              </button>
            ))}
          </div>
          <input
            type="number"
            min="0"
            max="100"
            value={pct}
            onChange={e => setPct(e.target.value)}
            className="w-full rounded-lg border-2 px-4 py-3 text-xl font-bold text-center focus:outline-none"
            style={{ borderColor: XERO.warning, color: XERO.text, background: XERO.card }}
          />
        </div>
        <div className="flex gap-2 px-4 py-4 border-t" style={{ borderColor: XERO.border, background: XERO.card }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border font-semibold text-sm transition-colors hover:bg-slate-50"
            style={{ borderColor: XERO.border, color: XERO.muted }}
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              vibrate(30);
              onApply(productId, Math.max(0, Math.min(100, parseFloat(pct) || 0)));
              onClose();
            }}
            className="flex-1 py-3 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: XERO.warning }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SuccessOverlay ──────────────────────────────────────────────────────── */
function SuccessOverlay({ sale, onClose }: { sale: any; onClose: () => void }) {
  useEffect(() => {
    vibrate(100);
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center cursor-pointer"
      style={{ background: 'rgba(9,60,90,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div className="text-center px-8 py-10 rounded-2xl shadow-2xl max-w-xs w-full" style={{ background: XERO.card }}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"
          style={{ background: `${XERO.success}20` }}
        >
          <CheckCircle2 className="w-11 h-11" style={{ color: XERO.success }} />
        </div>
        <p className="text-2xl font-black mb-1" style={{ color: XERO.text }}>Venda Registada!</p>
        <p className="font-mono font-bold text-base mb-4" style={{ color: XERO.cyan }}>{sale?.invoice_number}</p>
        {sale?.change > 0 && (
          <div
            className="rounded-xl px-6 py-3 border"
            style={{ background: `${XERO.success}10`, borderColor: `${XERO.success}30` }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: XERO.success }}>Troco</p>
            <p className="text-4xl font-black tabular-nums" style={{ color: XERO.success }}>{kz(sale.change)}</p>
          </div>
        )}
        <p className="text-xs mt-5" style={{ color: XERO.muted }}>Toque para continuar</p>
      </div>
    </div>
  );
}

/* ─── VoidSaleModal ───────────────────────────────────────────────────────── */
function VoidSaleModal({
  invoiceId, invoiceNumber, total, isCaixa, onClose, onVoided,
}: {
  invoiceId: string; invoiceNumber: string; total: number;
  isCaixa: boolean; onClose: () => void; onVoided: () => void;
}) {
  const [reason,     setReason]     = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [needPin,    setNeedPin]    = useState(isCaixa);

  const kzFmt = (n: number) =>
    `${n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

  const handleVoid = async () => {
    if (reason.trim().length < 5) { toast.error('Escreva o motivo (mínimo 5 caracteres)'); return; }
    setLoading(true);
    try {
      const body: any = { invoice_id: invoiceId, reason: reason.trim() };
      if (needPin) body.manager_pin = managerPin;
      const r = await fetch('/api/pos/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        if (j.error?.includes('PIN')) {
          toast.error('PIN inválido');
          setManagerPin('');
        } else {
          toast.error(j.error ?? 'Erro ao anular venda');
        }
        return;
      }
      toast.success(`Venda ${invoiceNumber} anulada com sucesso`);
      onVoided();
    } catch {
      toast.error('Erro de rede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center"
      style={{ background: 'rgba(9,60,90,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: XERO.card }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#dc2626' }}>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-black text-lg">Anular Venda</h3>
            <p className="text-white/70 text-xs">{invoiceNumber} · {kzFmt(total)}</p>
          </div>
        </div>

        <div className="p-6 space-y-4" style={{ background: '#fef2f2' }}>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: '#374151' }}>
              Motivo da anulação *
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Descreva o motivo (mínimo 5 caracteres)…"
              rows={3}
              className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none resize-none transition-colors"
              style={{
                borderColor: reason.trim().length >= 5 ? '#16a34a' : '#e5e7eb',
                background: '#fff',
              }}
            />
          </div>

          {needPin && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: '#7c3aed' }}>
                <KeyRound className="w-3 h-3 inline mr-1" />
                PIN do Gestor / Administrador
              </label>
              <input
                type="password"
                value={managerPin}
                onChange={e => setManagerPin(e.target.value)}
                placeholder="●●●●"
                maxLength={8}
                className="w-full h-11 px-4 rounded-xl border text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2"
                style={{ borderColor: '#7c3aed40', background: '#f5f3ff' }}
              />
              <p className="text-xs mt-1.5" style={{ color: '#7c3aed' }}>
                🔒 O gestor/administrador deve introduzir o seu PIN de autorização POS.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid #f3f4f6', background: '#f9fafb' }}>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-xl border font-semibold text-sm hover:bg-gray-50"
            style={{ borderColor: '#e5e7eb', color: '#374151' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleVoid}
            disabled={loading || reason.trim().length < 5}
            className="flex-1 py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: loading || reason.trim().length < 5 ? '#9ca3af' : '#dc2626' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {loading ? 'A anular...' : 'Confirmar Anulação'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── TouchActionBar — Rodapé de ações ────────────────────────────────────── */
function TouchActionBar({
  touchMode,
  onNewSale,
  onSuspend,
  onResume,
  suspendedCart,
  onPayment,
  canPay,
  onPrint,
  lastSale,
}: {
  touchMode: boolean;
  onNewSale: () => void;
  onSuspend: () => void;
  onResume: () => void;
  suspendedCart: POSCartItem[] | null;
  onPayment: () => void;
  canPay: boolean;
  onPrint: () => void;
  lastSale: any;
}) {
  const btnH = touchMode ? '52px' : '36px';

  const actions = [
    {
      key: 'F2',
      label: 'Nova Venda',
      icon: <ShoppingCart className={touchMode ? 'w-5 h-5' : 'w-3.5 h-3.5'} />,
      onClick: onNewSale,
      bg: XERO.navy,
      color: '#fff',
      border: 'transparent',
    },
    {
      key: 'F3',
      label: suspendedCart ? 'Retomar Venda' : 'Suspender',
      icon: suspendedCart
        ? <Play className={touchMode ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
        : <Pause className={touchMode ? 'w-5 h-5' : 'w-3.5 h-3.5'} />,
      onClick: suspendedCart ? onResume : onSuspend,
      bg: suspendedCart ? XERO.success : XERO.card,
      color: suspendedCart ? '#fff' : XERO.muted,
      border: suspendedCart ? XERO.success : XERO.border,
      badge: suspendedCart ? '1' : undefined,
    },
    lastSale
      ? {
          key: 'F9',
          label: 'Reimprimir',
          icon: <Printer className={touchMode ? 'w-5 h-5' : 'w-3.5 h-3.5'} />,
          onClick: onPrint,
          bg: XERO.card,
          color: XERO.muted,
          border: XERO.border,
        }
      : null,
  ].filter(Boolean) as any[];

  return (
    <div
      className="flex items-center gap-2 px-3 border-t shrink-0"
      style={{
        background: XERO.card,
        borderColor: XERO.border,
        minHeight: touchMode ? '68px' : '44px',
        paddingTop: touchMode ? '8px' : '6px',
        paddingBottom: touchMode ? '8px' : '6px',
      }}
    >
      {actions.map((action: any) => (
        <button
          key={action.key}
          onClick={() => { vibrate(30); action.onClick(); }}
          className="relative flex items-center gap-2 rounded-xl font-bold transition-all active:scale-95 border shrink-0"
          style={{
            background: action.bg,
            color: action.color,
            borderColor: action.border,
            height: btnH,
            paddingLeft: touchMode ? '16px' : '10px',
            paddingRight: touchMode ? '16px' : '10px',
            fontSize: touchMode ? '14px' : '11px',
          }}
        >
          {action.icon}
          <span>{action.label}</span>
          {!touchMode && (
            <kbd
              className="ml-1 font-mono opacity-40"
              style={{ fontSize: '9px' }}
            >
              {action.key}
            </kbd>
          )}
          {action.badge && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center bg-red-500 text-white">
              {action.badge}
            </span>
          )}
        </button>
      ))}

      <div className="flex-1" />

      {/* Keyboard shortcut hints — only in desktop mode */}
      {!touchMode && (
        <div className="flex items-center gap-3 text-[10px]" style={{ color: XERO.muted }}>
          {[['F4','Cobrar'],['F5','Limpar'],['ESC','Fechar']].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1 whitespace-nowrap">
              <kbd
                className="px-1.5 py-0.5 rounded font-mono border"
                style={{ borderColor: XERO.border, background: XERO.bg, fontSize: '9px' }}
              >
                {k}
              </kbd>
              {l}
            </span>
          ))}
          {lastSale?.invoice_id && (
            <button
              onClick={onPrint}
              className="flex items-center gap-1 font-semibold hover:underline"
              style={{ color: XERO.cyan }}
            >
              <Printer className="w-3 h-3" /> Reimprimir
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main POSView ────────────────────────────────────────────────────────── */
export default function POSView() {
  const router = useRouter();

  /* State */
  const [products,        setProducts]        = useState<POSProduct[]>([]);
  const [categories,      setCategories]      = useState<string[]>([]);
  const [activeCategory,  setActiveCategory]  = useState('Todos');
  const [search,          setSearch]          = useState('');
  const [cart,            setCart]            = useState<POSCartItem[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [processing,      setProcessing]      = useState(false);
  const [showPayment,     setShowPayment]     = useState(false);
  const [showSession,     setShowSession]     = useState(false);
  const [showDiscount,    setShowDiscount]    = useState<string | null>(null);
  const [showVoid,        setShowVoid]        = useState(false);
  const [session,         setSession]         = useState<POSSession | null>(null);
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>('Dinheiro');
  const [lastSale,        setLastSale]        = useState<any>(null);
  const [clock,           setClock]           = useState(new Date());
  const [companyInfo,     setCompanyInfo]     = useState<any>(null);
  const [online,          setOnline]          = useState(true);
  const [printerOk,       setPrinterOk]       = useState(false);

  /* Touch mode */
  const [touchMode,       setTouchMode]       = useState(false);

  /* Favorites */
  const [favorites,       setFavorites]       = useState<string[]>([]);

  /* Suspended cart (pause/resume) */
  const [suspendedCart,   setSuspendedCart]   = useState<POSCartItem[] | null>(null);

  const { profile } = useProfile();
  const isCaixa = profile?.role === 'caixa';

  const searchRef    = useRef<HTMLInputElement>(null);
  const scanStart    = useRef<number>(0);

  /* ── Barcode scanner refs (global USB HID / Bluetooth HID listener) ──────── */
  const barcodeBuffer   = useRef('');
  const barcodeTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barcodeKeyTimes = useRef<number[]>([]);  // timestamps per char
  const productsRef     = useRef<POSProduct[]>([]); // always-fresh ref for event handlers
  const sessionRef      = useRef<POSSession | null>(null);
  const addToCartRef    = useRef<(p: POSProduct) => void>(() => {});

  /* ── Clock ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── Online ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setOnline(navigator.onLine);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* ── Touch mode detection ──────────────────────────────────────────────── */
  useEffect(() => {
    // Check localStorage override first
    const saved = localStorage.getItem('pos_touch_mode');
    if (saved !== null) {
      setTouchMode(saved === 'true');
    } else {
      // Auto-detect: coarse pointer = touchscreen
      const mq = window.matchMedia('(pointer: coarse)');
      setTouchMode(mq.matches);
      const handler = (e: MediaQueryListEvent) => {
        if (localStorage.getItem('pos_touch_mode') === null) setTouchMode(e.matches);
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  const toggleTouchMode = useCallback(() => {
    setTouchMode(prev => {
      const next = !prev;
      localStorage.setItem('pos_touch_mode', String(next));
      toast.success(next ? '🖐 Modo Tátil activado' : '🖱 Modo Teclado activado', { duration: 1500 });
      return next;
    });
  }, []);

  /* ── Favorites ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pos_favorites');
      if (saved) setFavorites(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem('pos_favorites', JSON.stringify(next));
      return next;
    });
  }, []);

  /* ── Keep always-fresh refs for use inside event handlers ──────────────── */
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { sessionRef.current  = session;  }, [session]);
  useEffect(() => { addToCartRef.current = addToCart; }, [addToCart]);

  /* ── Global scanner + keyboard shortcuts (single listener) ──────────────── */
  useEffect(() => {
    /*
     * USB HID / Bluetooth HID barcode scanner detection:
     *  - Scanner types each char in < 30 ms (hardware limit)
     *  - Human typing averages 150–400 ms per char
     *  - Scanner always ends with Enter (\r or \n)
     *
     * Strategy:
     *  1. Capture printable chars globally (outside inputs) into barcodeBuffer
     *  2. On Enter → if avg interval < SCANNER_INTERVAL_MS → process as barcode
     *  3. After SCAN_TIMEOUT_MS with no new chars → auto-process if fast enough
     *  4. If chars are slow (human) and no input is focused → focus search field
     */
    const SCANNER_INTERVAL_MS = 50;  // max ms between scanner chars
    const SCAN_TIMEOUT_MS     = 120; // ms idle before auto-processing buffer
    const MIN_BARCODE_LEN     = 3;   // minimum chars to consider a barcode

    const processBarcode = (raw: string) => {
      const code = raw.trim();
      if (code.length < MIN_BARCODE_LEN) { barcodeBuffer.current = ''; barcodeKeyTimes.current = []; return; }
      const prods = productsRef.current;
      const match = prods.find(
        p => p.sku === code || (p as any).barcode === code
      );
      if (match) {
        addToCartRef.current(match);
        setSearch('');
        toast.success(`✓ ${match.name}`, { duration: 1200 });
      } else {
        // Show what was scanned in search field so the cashier can see it
        setSearch(code);
        searchRef.current?.focus();
        toast.error(`Código não encontrado: "${code}"`, { duration: 2500, icon: '📷' });
      }
      barcodeBuffer.current   = '';
      barcodeKeyTimes.current = [];
    };

    const isScanner = () => {
      const times = barcodeKeyTimes.current;
      if (times.length < 2) return false;
      const totalMs = times[times.length - 1] - times[0];
      const avgMs   = totalMs / (times.length - 1);
      return avgMs < SCANNER_INTERVAL_MS;
    };

    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const isInput      = tag === 'input' || tag === 'textarea' || tag === 'select';
      const isSearchField = target === searchRef.current;

      /* ── Function-key shortcuts (work everywhere except typed inputs) ── */
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === 'F4') {
        e.preventDefault();
        setShowPayment(prev => {
          if (!prev && cart.length > 0) { vibrate(40); return true; }
          return prev;
        });
        return;
      }
      if (e.key === 'F5') { e.preventDefault(); setCart([]); return; }
      if (e.key === 'F9') { e.preventDefault(); if (lastSale) handlePrint(lastSale); return; }
      if (e.key === 'Escape') { e.preventDefault(); setShowPayment(false); setShowDiscount(null); return; }

      /* ── Ignore if user is typing in a modal / other input ── */
      if (isInput && !isSearchField) return;

      /* ── Enter key: process barcode buffer ── */
      if (e.key === 'Enter') {
        const buf = barcodeBuffer.current;
        if (buf.length >= MIN_BARCODE_LEN) {
          e.preventDefault();
          if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
          processBarcode(buf);
        } else if (isSearchField && search.length >= MIN_BARCODE_LEN) {
          // User pressed Enter in search field manually
          e.preventDefault();
          processBarcode(search);
        }
        return;
      }

      /* ── Only capture single printable chars ── */
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();

      /* When NOT in any input, redirect all chars to barcode buffer */
      if (!isInput) e.preventDefault();

      barcodeBuffer.current   += e.key;
      barcodeKeyTimes.current  = [...barcodeKeyTimes.current, now];

      /* Reset inactivity timer */
      if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
      barcodeTimer.current = setTimeout(() => {
        const buf = barcodeBuffer.current;
        if (buf.length >= MIN_BARCODE_LEN && isScanner()) {
          processBarcode(buf);
        } else if (buf.length > 0 && !isInput) {
          /* Slow typing outside an input → redirect to search */
          setSearch(buf);
          searchRef.current?.focus();
          barcodeBuffer.current   = '';
          barcodeKeyTimes.current = [];
        } else {
          barcodeBuffer.current   = '';
          barcodeKeyTimes.current = [];
        }
      }, SCAN_TIMEOUT_MS);
    };

    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('keydown', h);
      if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, lastSale, search]);

  /* ── Load products & session ────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    const CACHE_KEY = 'pos_products_v2';
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const prods: POSProduct[] = JSON.parse(cached);
        setProducts(prods);
        setCategories(Array.from(new Set(prods.map(p => p.category).filter(Boolean))) as string[]);
        setLoading(false);
      } catch {}
    }

    let hasSession = false;
    try {
      const [sR, cR] = await Promise.all([fetch('/api/pos/session'), fetch('/api/company')]);
      const [sJ, cJ] = await Promise.all([sR.json(), cR.json()]);
      if (sJ.session) { setSession(sJ.session); hasSession = true; }
      if (cJ.company) setCompanyInfo(cJ.company);
    } catch {}

    if (!hasSession) setShowSession(true);

    if (!cached) setLoading(true);
    try {
      const pR = await fetch('/api/products?limit=300&active=true');
      const pJ = await pR.json();
      const prods: POSProduct[] = pJ.products ?? [];
      setProducts(prods);
      setCategories(Array.from(new Set(prods.map(p => p.category).filter(Boolean))) as string[]);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(prods)); } catch {}
    } catch { toast.error('Erro ao carregar produtos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Filtered + sorted (favorites first) ───────────────────────────────── */
  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== 'Todos') list = list.filter(p => p.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        (p as any).barcode?.includes(q)
      );
    }
    return list;
  }, [products, activeCategory, search]);

  const sortedFiltered = useMemo(() => {
    if (!favorites.length) return filtered;
    return [...filtered].sort((a, b) => {
      const af = favorites.includes(a.id) ? 0 : 1;
      const bf = favorites.includes(b.id) ? 0 : 1;
      return af - bf;
    });
  }, [filtered, favorites]);

  /* ── Cart ──────────────────────────────────────────────────────────────── */
  const addToCart = useCallback((product: POSProduct) => {
    if (!session) {
      setShowSession(true);
      toast.error('Abra a caixa antes de adicionar produtos', { duration: 2500, icon: '🔒' });
      return;
    }
    vibrate(30);
    setCart(prev => {
      const ex = prev.find(i => i.product_id === product.id);
      if (ex) return prev.map(i => i.product_id === product.id ? calcLine({ ...i, quantity: i.quantity + 1 }) : i);
      return [...prev, calcLine({
        product_id: product.id, name: product.name, price: product.price,
        tax_rate: product.tax_rate, quantity: 1, discount_pct: 0,
        line_subtotal: 0, line_tax: 0, line_total: 0,
      })];
    });
  }, [session]);

  const changeQty      = useCallback((id: string, qty: number) => {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.product_id !== id)); return; }
    setCart(prev => prev.map(i => i.product_id === id ? calcLine({ ...i, quantity: qty }) : i));
  }, []);
  const removeFromCart = useCallback((id: string) => setCart(prev => prev.filter(i => i.product_id !== id)), []);
  const applyDiscount  = useCallback((id: string, pct: number) => setCart(prev => prev.map(i => i.product_id === id ? calcLine({ ...i, discount_pct: pct }) : i)), []);

  /* ── Suspend / Resume ──────────────────────────────────────────────────── */
  const suspendSale = useCallback(() => {
    if (!cart.length) { toast.error('Carrinho vazio — nada para suspender'); return; }
    setSuspendedCart(cart);
    setCart([]);
    toast.success('Venda suspensa', { icon: '⏸️', duration: 2000 });
  }, [cart]);

  const resumeSale = useCallback(() => {
    if (!suspendedCart) return;
    if (cart.length > 0 && !confirm('Substituir o carrinho actual pela venda suspensa?')) return;
    setCart(suspendedCart);
    setSuspendedCart(null);
    toast.success('Venda retomada', { icon: '▶️', duration: 2000 });
  }, [suspendedCart, cart]);

  /* ── Totals ────────────────────────────────────────────────────────────── */
  const totals = useMemo(() => ({
    subtotal: +cart.reduce((s, i) => s + i.line_subtotal, 0).toFixed(2),
    tax:      +cart.reduce((s, i) => s + i.line_tax,      0).toFixed(2),
    total:    +cart.reduce((s, i) => s + i.line_total,    0).toFixed(2),
    items:     cart.reduce((s, i) => s + i.quantity,       0),
  }), [cart]);

  /* ── Search field onChange — just update state; global listener handles barcode ── */
  const onSearchChange = (val: string) => {
    setSearch(val);
    if (!val) { barcodeBuffer.current = ''; barcodeKeyTimes.current = []; }
  };

  /* ── onKeyDown on the search field — Enter is handled by global listener ── */
  const onSearchKeyDown = (_e: React.KeyboardEvent<HTMLInputElement>) => { /* global handler manages Enter */ };

  /* ── Print ─────────────────────────────────────────────────────────────── */
  const handlePrint = async (saleData?: any) => {
    const sale = saleData ?? lastSale;
    if (!sale) { toast.error('Nenhuma venda para imprimir'); return; }
    const data: ReceiptData = {
      companyName:    companyInfo?.name ?? 'Empresa',
      companyNif:     companyInfo?.nif ?? '',
      companyAddress: companyInfo?.address ?? '',
      documentType:   'FR',
      invoiceNumber:  sale.invoice_number ?? '',
      issuedAt:       sale.issued_at ?? new Date().toISOString(),
      cashierName:    sale.cashierName,
      terminalName:   session?.terminal_name,
      hash:           sale.hash,
      items: (sale.items ?? cart).map((i: any) => ({
        name: i.name, qty: i.quantity, price: i.price,
        total: i.line_total ?? i.total,
        tax_rate: i.tax_rate,
      })),
      subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
      paymentMethod: sale.paymentMethod ?? paymentMethod,
      amountTendered: sale.amountTendered, change: sale.change,
    };
    if (isThermalConnected()) {
      const r = await printToThermal(data);
      if (!r.ok) { toast.error(r.error ?? 'Falha térmica'); printReceiptFallback(data); }
      else toast.success('Impresso na impressora térmica ✓');
    } else {
      printReceiptFallback(data);
    }
  };

  const connectPrinter = async () => {
    const r = await connectThermalPrinter();
    if (r.ok) { setPrinterOk(true); toast.success('Impressora térmica conectada!'); }
    else toast.error(r.error ?? 'Falha ao conectar');
  };

  /* ── Session ───────────────────────────────────────────────────────────── */
  const openSession = async (name: string, balance: number) => {
    try {
      const r = await fetch('/api/pos/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', terminal_name: name, opening_balance: balance }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error); return; }
      setSession(j.session);
      setShowSession(false);
      toast.success(`Caixa "${name}" aberta!`);
    } catch { toast.error('Erro ao abrir sessão'); }
  };

  const closeSession = async () => {
    if (!session || !confirm('Fechar sessão? Será redirecionado para o Fecho de Caixa.')) return;
    const r = await fetch('/api/pos/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close', session_id: session.id }),
    });
    const j = await r.json();
    if (r.ok) {
      const sid = session.id;
      setSession(null);
      toast.success('Sessão fechada com sucesso');
      router.push(`/pos-close?session_id=${sid}`);
    } else {
      toast.error(j.error ?? 'Erro ao fechar sessão');
    }
  };

  /* ── Checkout ──────────────────────────────────────────────────────────── */
  const handleCheckout = async (amountTendered: number) => {
    if (!cart.length) return;
    setProcessing(true);
    const snap = [...cart];
    try {
      const r = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session?.id ?? null, client_id: null,
          items: cart, payment_method: paymentMethod,
          amount_tendered: amountTendered, notes: null, tax_exempt: false,
        }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error ?? 'Erro no pagamento'); return; }
      const sale = j.invoice ?? j;
      const meta = { ...sale, paymentMethod, amountTendered, change: j.change ?? 0, items: snap };
      setLastSale(meta);
      setCart([]);
      setShowPayment(false);

      // Auto-print
      const data: ReceiptData = {
        companyName:    companyInfo?.name ?? 'Empresa',
        companyNif:     companyInfo?.nif ?? '',
        companyAddress: companyInfo?.address ?? '',
        documentType:   'FR',
        invoiceNumber:  sale.invoice_number,
        issuedAt:       sale.issued_at ?? new Date().toISOString(),
        cashierName:    meta.cashierName,
        terminalName:   session?.terminal_name,
        hash:           sale.hash,
        items: snap.map(i => ({
          name: i.name, qty: i.quantity, price: i.price,
          total: i.line_total, tax_rate: i.tax_rate,
        })),
        subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        paymentMethod,
        amountTendered: paymentMethod === 'Dinheiro' ? amountTendered : undefined,
        change: j.change,
      };
      if (isThermalConnected()) printToThermal(data).then(res => { if (!res.ok) printReceiptFallback(data); });
      else printReceiptFallback(data);

      if (paymentMethod === 'Dinheiro' && isThermalConnected()) {
        openCashDrawer().catch(() => {});
      }
    } catch (e: any) { toast.error(e?.message ?? 'Erro inesperado'); }
    finally { setProcessing(false); }
  };

  /* ── Loading skeleton ──────────────────────────────────────────────────── */
  if (loading && products.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: XERO.bg }}>
        <div className="h-12 shrink-0 flex items-center gap-3 px-4" style={{ background: XERO.navy }}>
          <div className="w-6 h-6 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="w-24 h-4 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="flex-1" />
          <div className="w-16 h-6 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 content-start overflow-auto">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="rounded-xl animate-pulse" style={{ background: XERO.card, minHeight: '120px', opacity: 1 - i * 0.02 }} />
            ))}
          </div>
          <div className="w-80 shrink-0 border-l p-3 space-y-3 hidden lg:block" style={{ borderColor: XERO.border, background: XERO.card }}>
            <div className="h-6 w-32 rounded animate-pulse" style={{ background: XERO.bg }} />
            <div className="h-48 rounded-xl animate-pulse" style={{ background: XERO.bg }} />
            <div className="h-20 rounded-xl animate-pulse" style={{ background: XERO.bg }} />
            <div className="h-14 rounded-xl animate-pulse" style={{ background: `${XERO.cyan}30` }} />
          </div>
        </div>
      </div>
    );
  }

  /*
   * ── Responsive grid columns ─────────────────────────────────────────────
   *  Breakpoints:  sm=640  md=768  lg=1024(15")  xl=1280(17")  2xl=1536(21.5")
   *  Touch mode uses fewer, larger columns; desktop mode uses more, smaller.
   */
  const gridCols = touchMode
    ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
    : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';

  /*
   * ── Responsive cart panel width ─────────────────────────────────────────
   *  15" (lg/1024): narrower  →  17" (xl/1280): normal  →  21.5" (2xl/1536): wider
   *  Touch mode adds ~40px extra so buttons are comfortable.
   */
  const cartWidthClass = touchMode
    ? 'w-[280px] lg:w-[320px] xl:w-[380px] 2xl:w-[440px]'
    : 'w-[260px] lg:w-[300px] xl:w-[360px] 2xl:w-[420px]';

  /* ─── RENDER ──────────────────────────────────────────────────────────────── */
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: XERO.bg, paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* ── TOP BAR ────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center gap-2 px-4 shrink-0 shadow"
        style={{ background: XERO.navy, height: touchMode ? '56px' : '48px' }}
      >
        {/* Back to dashboard */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="w-4 h-4 text-white/60" />
          <div
            className="w-6 h-6 rounded flex items-center justify-center font-black text-xs text-white"
            style={{ background: XERO.cyan }}
          >
            FA
          </div>
          <span className="font-bold text-white text-sm hidden sm:block">FaturaAO</span>
        </button>

        <div className="h-4 w-px mx-1 bg-white/20" />

        {/* POS label */}
        <div className="flex items-center gap-1.5">
          <ShoppingCart className="w-4 h-4" style={{ color: XERO.cyan }} />
          <span className="font-bold text-white text-sm">Ponto de Venda</span>
          {companyInfo && (
            <span className="text-white/40 text-xs hidden md:block">· {companyInfo.name}</span>
          )}
        </div>

        {/* Session badge */}
        {session ? (
          <span
            className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ml-2"
            style={{ background: `${XERO.success}20`, color: XERO.success, border: `1px solid ${XERO.success}40` }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: XERO.success }} />
            {session.terminal_name}
          </span>
        ) : (
          <button
            onClick={() => setShowSession(true)}
            className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ml-2 transition-opacity hover:opacity-80"
            style={{ background: `${XERO.warning}20`, color: XERO.warning, border: `1px solid ${XERO.warning}40` }}
          >
            <Clock className="w-3 h-3" />
            Abrir Caixa
          </button>
        )}

        {/* Suspended cart badge */}
        {suspendedCart && (
          <button
            onClick={resumeSale}
            className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ml-1 transition-all hover:opacity-80 animate-pulse"
            style={{ background: `${XERO.warning}20`, color: XERO.warning, border: `1px solid ${XERO.warning}40` }}
          >
            <Pause className="w-3 h-3" />
            Venda Suspensa
          </button>
        )}

        <div className="flex-1" />

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Online indicator */}
          <span title={online ? 'Online' : 'Sem ligação'} className="flex items-center justify-center w-8 h-8">
            {online
              ? <Wifi className="w-3.5 h-3.5" style={{ color: XERO.success }} />
              : <WifiOff className="w-3.5 h-3.5 animate-pulse" style={{ color: XERO.danger }} />
            }
          </span>

          {/* AGT badge */}
          <span title="Certificação AGT" className="flex items-center justify-center w-8 h-8">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
          </span>

          {/* Clock */}
          <span className="text-xs tabular-nums text-white/50 font-mono hidden sm:block px-2">
            {clock.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>

          {/* Touch mode toggle */}
          <button
            onClick={toggleTouchMode}
            title={touchMode ? 'Desactivar modo tátil' : 'Activar modo tátil'}
            className="flex items-center justify-center w-8 h-8 rounded transition-colors hover:bg-white/10"
            style={{ color: touchMode ? XERO.cyan : 'rgba(255,255,255,0.5)' }}
          >
            {touchMode
              ? <Tablet className="w-3.5 h-3.5" />
              : <Monitor className="w-3.5 h-3.5" />
            }
          </button>

          {/* Printer */}
          <button
            onClick={connectPrinter}
            title={printerOk ? 'Impressora conectada' : 'Conectar impressora térmica'}
            className="flex items-center justify-center w-8 h-8 rounded transition-colors hover:bg-white/10"
            style={{ color: printerOk ? XERO.success : 'rgba(255,255,255,0.5)' }}
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Refresh */}
          <button
            onClick={loadData}
            title="Actualizar"
            className="flex items-center justify-center w-8 h-8 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Close session */}
          {session && (
            <button
              onClick={closeSession}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold text-white/50 hover:text-red-400 hover:bg-white/10 transition-colors ml-1"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:block">Fechar Caixa</span>
            </button>
          )}
        </div>
      </header>

      {/* ── BODY (70 / 30 split) ─────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT — Products (70%) */}
        <div className="flex flex-col flex-1 min-w-0 border-r" style={{ borderColor: XERO.border }}>

          {/* Search bar */}
          <div
            className="px-3 border-b shrink-0"
            style={{ background: XERO.card, borderColor: XERO.border, paddingTop: touchMode ? '10px' : '8px', paddingBottom: touchMode ? '10px' : '8px' }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: XERO.muted }} />
              <Scan className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: XERO.cyan }} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Pesquisar produto, SKU ou código de barras… (F2 / Enter)"
                className="w-full rounded-lg border pl-9 pr-9 focus:outline-none transition-colors"
                style={{
                  borderColor: search ? XERO.cyan : XERO.border,
                  background: XERO.bg,
                  color: XERO.text,
                  fontSize: touchMode ? '15px' : '14px',
                  padding: touchMode ? '10px 36px' : '8px 36px',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-8 top-1/2 -translate-y-1/2"
                  style={{ color: XERO.muted }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div
            className="flex gap-2 px-3 border-b shrink-0 overflow-x-auto scrollbar-none"
            style={{
              background: XERO.card,
              borderColor: XERO.border,
              paddingTop: touchMode ? '10px' : '8px',
              paddingBottom: touchMode ? '10px' : '8px',
            }}
          >
            {['Todos', ...categories].map(cat => (
              <button
                key={cat}
                onClick={() => { vibrate(20); setActiveCategory(cat); }}
                className="flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap transition-all border active:scale-95 shrink-0"
                style={{
                  background:   activeCategory === cat ? XERO.cyan : 'transparent',
                  borderColor:  activeCategory === cat ? XERO.cyan : XERO.border,
                  color:        activeCategory === cat ? '#fff' : XERO.muted,
                  fontSize:     touchMode ? '13px' : '11px',
                  paddingLeft:  touchMode ? '16px' : '12px',
                  paddingRight: touchMode ? '16px' : '12px',
                  paddingTop:   touchMode ? '8px'  : '5px',
                  paddingBottom:touchMode ? '8px'  : '5px',
                  minHeight:    touchMode ? '40px' : '28px',
                }}
              >
                {CAT_EMOJI[cat] && <span>{CAT_EMOJI[cat]}</span>}
                {cat}
                {cat === 'Todos' && <span className="opacity-60">({products.length})</span>}
              </button>
            ))}
          </div>

          {/* Favorites label */}
          {favorites.length > 0 && activeCategory === 'Todos' && !search && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold shrink-0"
              style={{ background: `${XERO.warning}08`, color: XERO.warning, borderBottom: `1px solid ${XERO.warning}20` }}
            >
              <Star className="w-3 h-3" fill="currentColor" />
              {favorites.length} favorito{favorites.length !== 1 ? 's' : ''} no topo
            </div>
          )}

          {/* Products grid */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{ background: XERO.bg, padding: touchMode ? '12px' : '10px' }}
          >
            {sortedFiltered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48" style={{ color: XERO.muted }}>
                <Package className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">
                  {search ? `Sem resultados para "${search}"` : 'Nenhum produto disponível'}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="mt-2 text-xs font-medium hover:underline"
                    style={{ color: XERO.cyan }}
                  >
                    Limpar pesquisa
                  </button>
                )}
              </div>
            ) : (
              <div className={`grid ${gridCols}`} style={{ gap: touchMode ? '10px' : '8px' }}>
                {sortedFiltered.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onAdd={addToCart}
                    touchMode={touchMode}
                    isFavorite={favorites.includes(p.id)}
                    onFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer action bar */}
          <TouchActionBar
            touchMode={touchMode}
            onNewSale={() => { setCart([]); searchRef.current?.focus(); }}
            onSuspend={suspendSale}
            onResume={resumeSale}
            suspendedCart={suspendedCart}
            onPayment={() => { if (cart.length > 0) { vibrate(40); setShowPayment(true); } }}
            canPay={cart.length > 0 && !!session}
            onPrint={() => handlePrint(lastSale)}
            lastSale={lastSale}
          />
        </div>

        {/* RIGHT — Cart (~30%, responsive 15"→17"→21.5") */}
        <div
          className={`flex flex-col shrink-0 relative ${cartWidthClass}`}
          style={{ background: XERO.card }}
        >
          {/* Session gate overlay */}
          {!session && !loading && (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 text-center px-6"
              style={{ background: `${XERO.navy}f2`, backdropFilter: 'blur(6px)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse"
                style={{ background: `${XERO.warning}20`, border: `2px solid ${XERO.warning}50` }}
              >
                <Calculator className="w-7 h-7" style={{ color: XERO.warning }} />
              </div>
              <p className="font-black text-white text-base">Caixa não aberta</p>
              <button
                onClick={() => setShowSession(true)}
                className="px-5 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-95"
                style={{ background: XERO.cyan }}
              >
                Abrir Caixa
              </button>
            </div>
          )}

          {/* Cart header */}
          <div
            className="flex items-center justify-between px-4 shrink-0 border-b"
            style={{
              borderColor: XERO.border,
              background: XERO.navy,
              minHeight: touchMode ? '52px' : '44px',
            }}
          >
            <div className="flex items-center gap-2 text-white">
              <ShoppingCart className="w-4 h-4" style={{ color: XERO.cyan }} />
              <span className="font-bold text-sm">Carrinho</span>
              {cart.length > 0 && (
                <span
                  className="text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: XERO.cyan, color: '#fff' }}
                >
                  {totals.items}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => { vibrate(30); setCart([]); }}
                className="flex items-center gap-1 text-[11px] font-semibold hover:opacity-80 transition-opacity"
                style={{ color: `${XERO.danger}cc` }}
              >
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>

          {/* Cart items */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{ background: XERO.bg, padding: touchMode ? '10px 10px' : '8px 10px', gap: touchMode ? '8px' : '6px', display: 'flex', flexDirection: 'column' }}
          >
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10" style={{ color: XERO.muted }}>
                <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Carrinho vazio</p>
                <p className="text-xs mt-1 opacity-60">Toque num produto para adicionar</p>
              </div>
            ) : (
              cart.map(item => (
                <CartItemRow
                  key={item.product_id}
                  item={item}
                  onQtyChange={changeQty}
                  onRemove={removeFromCart}
                  onDiscount={id => setShowDiscount(id)}
                  touchMode={touchMode}
                />
              ))
            )}
          </div>

          {/* Totals */}
          <div
            className="px-4 border-t shrink-0"
            style={{ borderColor: XERO.border, background: XERO.card, paddingTop: touchMode ? '12px' : '10px', paddingBottom: touchMode ? '8px' : '6px' }}
          >
            <div className="flex justify-between text-xs mb-1" style={{ color: XERO.muted }}>
              <span>{totals.items} artigo{totals.items !== 1 ? 's' : ''}</span>
              <span className="tabular-nums">Subtotal: {kz(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs mb-2" style={{ color: XERO.muted }}>
              <span>IVA 14%</span>
              <span className="tabular-nums">{kz(totals.tax)}</span>
            </div>
            <div
              className="flex justify-between font-black border-t pt-2"
              style={{ borderColor: XERO.border, color: XERO.text, fontSize: touchMode ? '22px' : '18px' }}
            >
              <span>TOTAL</span>
              <span className="tabular-nums" style={{ color: XERO.cyan }}>{kz(totals.total)}</span>
            </div>
          </div>

          {/* Payment method selector */}
          <div
            className="grid grid-cols-4 gap-1.5 px-3 py-2 border-t shrink-0"
            style={{ borderColor: XERO.border, background: XERO.bg }}
          >
            {(['Dinheiro', 'Multicaixa', 'TPA', 'Crédito'] as PaymentMethod[]).map(m => (
              <button
                key={m}
                onClick={() => { vibrate(20); setPaymentMethod(m); }}
                className="flex flex-col items-center gap-1 rounded-lg border text-[10px] font-bold transition-all active:scale-95"
                style={{
                  borderColor: paymentMethod === m ? XERO.cyan : XERO.border,
                  background:  paymentMethod === m ? `${XERO.cyan}12` : XERO.card,
                  color:       paymentMethod === m ? XERO.cyan : XERO.muted,
                  padding:     touchMode ? '10px 4px' : '7px 4px',
                  minHeight:   touchMode ? '52px' : '40px',
                }}
              >
                {PAY_ICONS[m]}
                {m}
              </button>
            ))}
          </div>

          {/* COBRAR button */}
          <div className="px-3 pb-3 pt-2 shrink-0" style={{ background: XERO.bg }}>
            <button
              onClick={() => { if (cart.length > 0) { vibrate(50); setShowPayment(true); } }}
              disabled={cart.length === 0 || processing || !session}
              className="w-full rounded-xl font-black text-white tracking-wide transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              style={{
                background: cart.length > 0 && session ? XERO.cyan : XERO.muted,
                fontSize:   touchMode ? '22px' : '18px',
                minHeight:  touchMode ? '72px' : '56px',
              }}
            >
              <Receipt className="w-5 h-5" />
              COBRAR
              {!touchMode && <span className="text-sm font-semibold opacity-60">F4</span>}
              {cart.length > 0 && (
                <span className="text-sm font-semibold opacity-80 ml-1">· {kz(totals.total)}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      {showPayment && (
        <PaymentModal
          total={totals.total}
          method={paymentMethod}
          onMethodChange={setPaymentMethod}
          onConfirm={handleCheckout}
          onClose={() => setShowPayment(false)}
          processing={processing}
        />
      )}
      {showSession && (
        <SessionModal
          onOpen={openSession}
          onClose={() => {
            setShowSession(false);
            if (!session) router.push('/dashboard');
          }}
          isCaixa={false}
        />
      )}
      {showDiscount && (
        <DiscountModal
          productId={showDiscount}
          current={cart.find(i => i.product_id === showDiscount)?.discount_pct ?? 0}
          onApply={applyDiscount}
          onClose={() => setShowDiscount(null)}
        />
      )}
      {lastSale && <SuccessOverlay sale={lastSale} onClose={() => setLastSale(null)} />}

      {showVoid && lastSale?.invoice_id && (
        <VoidSaleModal
          invoiceId={lastSale.invoice_id}
          invoiceNumber={lastSale.invoice_number}
          total={lastSale.total ?? totals.total}
          isCaixa={isCaixa}
          onClose={() => setShowVoid(false)}
          onVoided={() => { setShowVoid(false); setLastSale(null); }}
        />
      )}
    </div>
  );
}
