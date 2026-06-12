'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, X, Printer,
  CreditCard, Banknote, Smartphone, ChevronLeft, ChevronDown,
  Package, LogOut, RefreshCw, CheckCircle2, Loader2,
  Calculator, Tag, Clock, Receipt, Scan, Wifi, WifiOff,
  Shield, AlertCircle, Percent, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import type { POSProduct, POSCartItem, PaymentMethod, POSSession } from '@/lib/pos/types';
import {
  printReceiptFallback, printToThermal, connectThermalPrinter,
  isThermalConnected, openCashDrawer, type ReceiptData,
} from '@/lib/pos/thermal-printer';

/* ─── Design Tokens (Xero Palette) ────────────────────────────────────────── */
const XERO = {
  navy:    '#0b4a6f',   // sidebar / topbar
  navyDk:  '#093c5a',   // hover on navy
  cyan:    '#13b5ea',   // primary action
  cyanDk:  '#0e9fd4',
  bg:      '#F4F5F8',   // app background
  card:    '#ffffff',   // card background
  border:  '#e2e4e9',
  text:    '#202f3f',   // foreground
  muted:   '#627284',   // secondary text
  success: '#21ab6b',
  warning: '#f9a806',
  danger:  '#e6193c',
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
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

/* ─── ProductCard ──────────────────────────────────────────────────────────── */
function ProductCard({ product, onAdd }: { product: POSProduct; onAdd: (p: POSProduct) => void }) {
  const qty = product.quantity_in_stock ?? Infinity;
  const lowStock   = product.track_stock && qty < 5 && qty > 0;
  const outOfStock = product.track_stock && qty <= 0;

  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      style={{ background: XERO.card, borderColor: outOfStock ? XERO.border : XERO.border }}
      className={`
        relative flex flex-col items-center p-2.5 rounded-lg border text-center
        transition-all duration-150 select-none group min-h-[100px]
        ${outOfStock
          ? 'opacity-40 cursor-not-allowed'
          : 'cursor-pointer hover:border-[#13b5ea] hover:shadow-md active:scale-95 active:shadow-sm'
        }
      `}
    >
      <div className="text-2xl mb-1 leading-none">
        {product.image_url
          ? <img src={product.image_url} alt="" className="w-9 h-9 object-cover rounded-md" />
          : (CAT_EMOJI[product.category ?? ''] ?? '📦')}
      </div>
      <p className="text-[11px] font-semibold leading-tight text-slate-700 line-clamp-2 w-full mb-1">
        {product.name}
      </p>
      <p className="text-[12px] font-bold tabular-nums" style={{ color: XERO.cyan }}>
        {kz(product.price)}
      </p>

      {lowStock && (
        <span
          className="absolute top-1 right-1 text-[9px] font-black px-1.5 py-0.5 rounded-full"
          style={{ background: XERO.warning + '20', color: XERO.warning }}
        >
          {qty}
        </span>
      )}
      {outOfStock && (
        <span className="absolute inset-0 rounded-lg flex items-center justify-center bg-white/80 text-red-500 text-xs font-bold">
          Esgotado
        </span>
      )}

      {/* Hover overlay */}
      {!outOfStock && (
        <div
          className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: XERO.cyan + '12' }}
        >
          <Plus className="w-6 h-6" style={{ color: XERO.cyan }} />
        </div>
      )}
    </button>
  );
}

/* ─── CartItemRow ──────────────────────────────────────────────────────────── */
function CartItemRow({ item, onQtyChange, onRemove, onDiscount }: {
  item: POSCartItem;
  onQtyChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onDiscount: (id: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 py-2 px-3 rounded-lg border group transition-all hover:shadow-sm"
      style={{ background: XERO.card, borderColor: XERO.border }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: XERO.text }}>{item.name}</p>
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

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onQtyChange(item.product_id, item.quantity - 1)}
          className="w-6 h-6 rounded border flex items-center justify-center transition-colors hover:bg-slate-100 active:bg-slate-200"
          style={{ borderColor: XERO.border, color: XERO.muted }}
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-8 text-center text-sm font-bold tabular-nums" style={{ color: XERO.text }}>
          {item.quantity}
        </span>
        <button
          onClick={() => onQtyChange(item.product_id, item.quantity + 1)}
          className="w-6 h-6 rounded border flex items-center justify-center transition-colors hover:bg-slate-100 active:bg-slate-200"
          style={{ borderColor: XERO.border, color: XERO.muted }}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <p className="w-[72px] text-right text-xs font-bold tabular-nums shrink-0" style={{ color: XERO.text }}>
        {kz(item.line_total)}
      </p>

      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onDiscount(item.product_id)}
          className="w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-amber-50"
          style={{ color: XERO.warning }}
          title="Desconto"
        >
          <Percent className="w-3 h-3" />
        </button>
        <button
          onClick={() => onRemove(item.product_id)}
          className="w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-red-50"
          style={{ color: XERO.danger }}
          title="Remover"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ─── PaymentModal ─────────────────────────────────────────────────────────── */
function PaymentModal({ total, method, onMethodChange, onConfirm, onClose, processing }: {
  total: number; method: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  onConfirm: (tendered: number) => void;
  onClose: () => void;
  processing: boolean;
}) {
  const [tendered, setTendered] = useState(total.toFixed(2));
  const tenderedNum = parseFloat(tendered) || 0;
  const change = Math.max(0, tenderedNum - total);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTendered(total.toFixed(2));
    setTimeout(() => inputRef.current?.select(), 80);
  }, [total, method]);

  const numpadPress = (val: string) => {
    setTendered(prev => {
      if (val === '⌫') return prev.slice(0, -1) || '0';
      if (val === '.' && prev.includes('.')) return prev;
      if (prev === '0' && val !== '.') return val;
      return prev + val;
    });
  };

  const NUMPAD = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];
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
        background: 'rgba(9,60,90,0.7)',
        backdropFilter: 'blur(6px)',
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

        {/* Header — Xero navy */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ background: XERO.navy }}
        >
          <div className="flex items-center gap-2.5 text-white">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: XERO.cyan }}
            >
              <Receipt className="w-4 h-4" />
            </div>
            <span className="font-bold text-base">Pagamento</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4" style={{ background: XERO.bg }}>

          {/* Total */}
          <div
            className="rounded-xl p-4 text-center border"
            style={{ background: XERO.card, borderColor: XERO.border }}
          >
            <p className="text-[10px] uppercase tracking-widest mb-1 font-semibold" style={{ color: XERO.muted }}>
              Total a pagar
            </p>
            <p className="text-4xl font-black tabular-nums" style={{ color: XERO.text }}>
              {kz(total)}
            </p>
          </div>

          {/* Methods */}
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map(m => (
              <button
                key={m}
                onClick={() => onMethodChange(m)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-[11px] font-bold transition-all active:scale-95"
                style={{
                  borderColor: method === m ? XERO.cyan : XERO.border,
                  background: method === m ? XERO.cyan + '12' : XERO.card,
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
                  className="w-full rounded-xl px-4 py-3 text-2xl font-black text-right tabular-nums focus:outline-none transition-colors border-2"
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
                    onClick={() => setTendered(a.toFixed(2))}
                    className="py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border"
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

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2">
                {NUMPAD.map(k => (
                  <button
                    key={k}
                    onClick={() => numpadPress(k)}
                    className="py-3.5 rounded-xl text-lg font-semibold transition-all active:scale-95 border hover:border-[#13b5ea]"
                    style={{ background: XERO.card, borderColor: XERO.border, color: XERO.text }}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Change */}
              {change > 0 && (
                <div
                  className="flex items-center justify-between rounded-xl px-5 py-3 border"
                  style={{ background: '#21ab6b10', borderColor: XERO.success + '40' }}
                >
                  <span className="text-sm font-bold" style={{ color: XERO.success }}>Troco</span>
                  <span className="text-2xl font-black tabular-nums" style={{ color: XERO.success }}>{kz(change)}</span>
                </div>
              )}
            </>
          )}

          {method !== 'Dinheiro' && (
            <div
              className="rounded-xl p-5 text-center border"
              style={{ background: XERO.card, borderColor: XERO.border }}
            >
              {method === 'Multicaixa' && <><CreditCard className="w-8 h-8 mx-auto mb-2" style={{ color: XERO.cyan }} /><p className="text-sm" style={{ color: XERO.muted }}>Processe no TPA Multicaixa</p></>}
              {method === 'TPA' && <><Smartphone className="w-8 h-8 mx-auto mb-2 text-purple-500" /><p className="text-sm" style={{ color: XERO.muted }}>Aguarde confirmação do terminal TPA</p></>}
              {method === 'Crédito' && <><Tag className="w-8 h-8 mx-auto mb-2" style={{ color: XERO.warning }} /><p className="text-sm" style={{ color: XERO.muted }}>Venda registada a crédito</p></>}
            </div>
          )}
        </div>

        {/* Confirm — always visible */}
        <div className="px-5 py-4 border-t shrink-0" style={{ background: XERO.card, borderColor: XERO.border }}>
          <button
            onClick={() => onConfirm(tenderedNum)}
            disabled={!canConfirm}
            className="w-full py-4 rounded-xl font-black text-lg text-white tracking-wide transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            style={{ background: canConfirm ? XERO.cyan : XERO.muted }}
          >
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {processing ? 'A processar…' : 'Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SessionModal — Professional Supermarket Flow ──────────────────────────── */
function SessionModal({ onOpen, onClose, isCaixa = false }: {
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

  const numpadPress = (val: string) =>
    setBalance(prev => {
      if (val === '⌫') return prev.slice(0, -1);
      if (val === '000') return prev + '000';
      return prev + val;
    });

  const balanceNum = parseFloat(balance) || 0;

  const handleOpen = async () => {
    if (opening) return;
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
                <button key={t} onClick={() => setName(t)}
                  className="py-2 rounded-lg text-xs font-bold border-2 transition-all active:scale-95"
                  style={{
                    background:   name === t ? '#0b4a6f' : '#fff',
                    borderColor:  name === t ? '#13b5ea' : '#e2e8f0',
                    color:        name === t ? '#fff' : '#64748b',
                  }}>
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
            <div className="rounded-2xl border-2 px-5 py-4 text-right bg-white"
              style={{ borderColor: balanceNum > 0 ? '#13b5ea' : '#e2e8f0' }}>
              <p className="text-4xl font-black tabular-nums text-slate-800">
                {balanceNum > 0 ? balanceNum.toLocaleString('pt-AO') : '0'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Kwanzas (Kz)</p>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="grid grid-cols-3 gap-1.5">
            {QUICK_AMOUNTS.map(a => (
              <button key={a} onClick={() => setBalance(String(a))}
                className="py-2.5 rounded-xl text-xs font-black border-2 transition-all active:scale-95"
                style={{
                  background:  balanceNum === a ? '#f59e0b15' : '#fff',
                  borderColor: balanceNum === a ? '#f59e0b' : '#e2e8f0',
                  color:       balanceNum === a ? '#f59e0b' : '#64748b',
                }}>
                {a >= 1000 ? `${a/1000}k` : a}
              </button>
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {NUMPAD.map(k => (
              <button key={k} onClick={() => numpadPress(k)}
                className="py-4 rounded-xl font-black text-xl border-2 transition-all active:scale-95 active:shadow-inner"
                style={{
                  background:  k === '⌫' ? '#fee2e2' : '#fff',
                  borderColor: k === '⌫' ? '#fca5a5' : '#e2e8f0',
                  color:       k === '⌫' ? '#ef4444' : '#1e293b',
                }}>
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Confirm button */}
        <div className="px-4 py-4 shrink-0 border-t border-slate-100 bg-white">
          <button
            onClick={handleOpen}
            disabled={opening}
            className="w-full py-4 rounded-2xl font-black text-xl text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
            style={{ background: opening ? '#64748b' : '#13b5ea' }}
          >
            {opening
              ? <><Loader2 className="w-6 h-6 animate-spin" /> A abrir…</>
              : <><CheckCircle2 className="w-6 h-6" /> Iniciar Turno</>
            }
          </button>
          {!isCaixa && (
            <button onClick={onClose}
              className="w-full mt-2 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
              Cancelar (entrar sem sessão)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── DiscountModal ────────────────────────────────────────────────────────── */
function DiscountModal({ productId, current, onApply, onClose }: {
  productId: string; current: number;
  onApply: (id: string, pct: number) => void;
  onClose: () => void;
}) {
  const [pct, setPct] = useState(String(current));
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" style={{ background: 'rgba(9,60,90,0.65)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full sm:max-w-xs rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl" style={{ background: XERO.card }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4" style={{ background: XERO.navy }}>
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Percent className="w-4 h-4" style={{ color: XERO.warning }} />
            Aplicar Desconto
          </h3>
        </div>
        <div className="p-4 space-y-3" style={{ background: XERO.bg }}>
          <div className="grid grid-cols-3 gap-2">
            {[5,10,15,20,25,50].map(q => (
              <button key={q} onClick={() => setPct(String(q))}
                className="py-2.5 rounded-lg text-sm font-bold border transition-all active:scale-95"
                style={{
                  background: pct === String(q) ? XERO.warning : XERO.card,
                  borderColor: pct === String(q) ? XERO.warning : XERO.border,
                  color: pct === String(q) ? '#fff' : XERO.text,
                }}>
                {q}%
              </button>
            ))}
          </div>
          <input type="number" min="0" max="100" value={pct} onChange={e => setPct(e.target.value)}
            className="w-full rounded-lg border-2 px-4 py-3 text-xl font-bold text-center focus:outline-none"
            style={{ borderColor: XERO.warning, color: XERO.text, background: XERO.card }} />
        </div>
        <div className="flex gap-2 px-4 py-4 border-t" style={{ borderColor: XERO.border, background: XERO.card }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border font-semibold text-sm transition-colors hover:bg-slate-50" style={{ borderColor: XERO.border, color: XERO.muted }}>Cancelar</button>
          <button onClick={() => { onApply(productId, Math.max(0, Math.min(100, parseFloat(pct)||0))); onClose(); }}
            className="flex-1 py-3 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90"
            style={{ background: XERO.warning }}>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SuccessOverlay ───────────────────────────────────────────────────────── */
function SuccessOverlay({ sale, onClose }: { sale: any; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center cursor-pointer" style={{ background: 'rgba(9,60,90,0.85)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="text-center px-8 py-10 rounded-2xl shadow-2xl max-w-xs w-full" style={{ background: XERO.card }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce" style={{ background: XERO.success + '20' }}>
          <CheckCircle2 className="w-9 h-9" style={{ color: XERO.success }} />
        </div>
        <p className="text-xl font-black mb-1" style={{ color: XERO.text }}>Venda Registada!</p>
        <p className="font-mono font-bold text-base mb-4" style={{ color: XERO.cyan }}>{sale?.invoice_number}</p>
        {sale?.change > 0 && (
          <div className="rounded-xl px-6 py-3 border" style={{ background: XERO.success + '10', borderColor: XERO.success + '30' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: XERO.success }}>Troco</p>
            <p className="text-3xl font-black tabular-nums" style={{ color: XERO.success }}>{kz(sale.change)}</p>
          </div>
        )}
        <p className="text-xs mt-4" style={{ color: XERO.muted }}>Toque para continuar</p>
      </div>
    </div>
  );
}

/* ─── Main POSView ─────────────────────────────────────────────────────────── */
export default function POSView() {
  const router = useRouter();

  const [products, setProducts]           = useState<POSProduct[]>([]);
  const [categories, setCategories]       = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [search, setSearch]               = useState('');
  const [cart, setCart]                   = useState<POSCartItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [processing, setProcessing]       = useState(false);
  const [showPayment, setShowPayment]     = useState(false);
  const [showSession, setShowSession]     = useState(false);
  const [showDiscount, setShowDiscount]   = useState<string | null>(null);
  const [session, setSession]             = useState<POSSession | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Dinheiro');
  const [lastSale, setLastSale]           = useState<any>(null);
  const [clock, setClock]                 = useState(new Date());
  const [companyInfo, setCompanyInfo]     = useState<any>(null);
  const [online, setOnline]               = useState(true);
  const [printerOk, setPrinterOk]         = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const scanStart = useRef<number>(0);

  // Clock
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);

  // Online
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setOnline(navigator.onLine);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F4') { e.preventDefault(); if (cart.length > 0) setShowPayment(true); }
      if (e.key === 'F5') { e.preventDefault(); setCart([]); }
      if (e.key === 'F9') { e.preventDefault(); if (lastSale) handlePrint(lastSale); }
      if (e.key === 'Escape') { setShowPayment(false); setShowDiscount(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [cart, lastSale]);

  // ── Load (speed-optimised) ─────────────────────────────────────────────────
  // Strategy: show cached products instantly → fetch fresh in background
  const loadData = useCallback(async () => {
    // 1. Show cached products immediately (near-zero load time on revisit)
    const CACHE_KEY = 'pos_products_v2';
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const prods: POSProduct[] = JSON.parse(cached);
        setProducts(prods);
        setCategories(Array.from(new Set(prods.map(p => p.category).filter(Boolean))) as string[]);
        setLoading(false); // show immediately — refresh in background
      } catch {}
    }

    // 2. Fetch session + company first (fast) — products second
    let hasSession = false;
    try {
      const [sR, cR] = await Promise.all([
        fetch('/api/pos/session'),
        fetch('/api/company'),
      ]);
      const [sJ, cJ] = await Promise.all([sR.json(), cR.json()]);
      if (sJ.session) { setSession(sJ.session); hasSession = true; }
      if (cJ.company) setCompanyInfo(cJ.company);
    } catch {}

    // ✨ PROFESSIONAL: auto-open session modal if no session found
    if (!hasSession) setShowSession(true);

    // 3. Fetch products (heavier — but loading=false already if cached)
    if (!cached) setLoading(true);
    try {
      const pR = await fetch('/api/products?limit=300&active=true');
      const pJ = await pR.json();
      const prods: POSProduct[] = pJ.products ?? [];
      setProducts(prods);
      setCategories(Array.from(new Set(prods.map(p => p.category).filter(Boolean))) as string[]);
      // Cache for next time
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(prods)); } catch {}
    } catch { toast.error('Erro ao carregar produtos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtered ──────────────────────────────────────────────────────────────
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

  // ── Cart ──────────────────────────────────────────────────────────────────
  const addToCart = useCallback((product: POSProduct) => {
    // 🔒 Hard gate: no session = no sale (professional POS behaviour)
    if (!session) {
      setShowSession(true);
      toast.error('Abra a caixa antes de adicionar produtos', { duration: 2500, icon: '🔒' });
      return;
    }
    setCart(prev => {
      const ex = prev.find(i => i.product_id === product.id);
      if (ex) return prev.map(i => i.product_id === product.id ? calcLine({ ...i, quantity: i.quantity + 1 }) : i);
      return [...prev, calcLine({ product_id: product.id, name: product.name, price: product.price, tax_rate: product.tax_rate, quantity: 1, discount_pct: 0, line_subtotal: 0, line_tax: 0, line_total: 0 })];
    });
  }, [session]);

  const changeQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.product_id !== id)); return; }
    setCart(prev => prev.map(i => i.product_id === id ? calcLine({ ...i, quantity: qty }) : i));
  }, []);
  const removeFromCart = useCallback((id: string) => setCart(prev => prev.filter(i => i.product_id !== id)), []);
  const applyDiscount  = useCallback((id: string, pct: number) => setCart(prev => prev.map(i => i.product_id === id ? calcLine({ ...i, discount_pct: pct }) : i)), []);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    subtotal: +cart.reduce((s, i) => s + i.line_subtotal, 0).toFixed(2),
    tax:      +cart.reduce((s, i) => s + i.line_tax, 0).toFixed(2),
    total:    +cart.reduce((s, i) => s + i.line_total, 0).toFixed(2),
    items:     cart.reduce((s, i) => s + i.quantity, 0),
  }), [cart]);

  // ── Barcode ───────────────────────────────────────────────────────────────
  const onSearchChange = (val: string) => {
    if (!scanStart.current) scanStart.current = Date.now();
    setSearch(val);
    if (val.length > 4 && Date.now() - scanStart.current < 250) {
      const match = products.find(p => p.sku === val || (p as any).barcode === val);
      if (match) { addToCart(match); setSearch(''); scanStart.current = 0; toast.success(`${match.name} adicionado`, { duration: 1500 }); return; }
    }
    if (!val) scanStart.current = 0;
  };

  // ── Print ─────────────────────────────────────────────────────────────────
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
      cashierName:    sale.cashierName,  // Set at checkout time
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

  // ── Session ───────────────────────────────────────────────────────────────
  const openSession = async (name: string, balance: number) => {
    try {
      const r = await fetch('/api/pos/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', terminal_name: name, opening_balance: balance }) });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error); return; }
      setSession(j.session); setShowSession(false); toast.success(`Caixa "${name}" aberta!`);
    } catch { toast.error('Erro ao abrir sessão'); }
  };

  const closeSession = async () => {
    if (!session || !confirm('Fechar sessão? Será redirecionado para o Fecho de Caixa.')) return;
    const r = await fetch('/api/pos/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  // ── Checkout ──────────────────────────────────────────────────────────────
  const handleCheckout = async (amountTendered: number) => {
    if (!cart.length) return;
    setProcessing(true);
    const snap = [...cart];
    try {
      const r = await fetch('/api/pos/sale', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session?.id ?? null, client_id: null, items: cart, payment_method: paymentMethod, amount_tendered: amountTendered, notes: null, tax_exempt: false }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error ?? 'Erro no pagamento'); return; }
      const sale = j.invoice ?? j;
      const meta = { ...sale, paymentMethod, amountTendered, change: j.change ?? 0, items: snap };
      setLastSale(meta); setCart([]); setShowPayment(false);

      // Auto-print with full AGT fields
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
          total: i.line_total,
          tax_rate: i.tax_rate,
        })),
        subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        paymentMethod,
        amountTendered: paymentMethod === 'Dinheiro' ? amountTendered : undefined,
        change: j.change,
      };
      if (isThermalConnected()) printToThermal(data).then(res => { if (!res.ok) printReceiptFallback(data); });
      else printReceiptFallback(data);

      // ✨ Auto-open cash drawer when paying in cash with change
      if (paymentMethod === 'Dinheiro' && isThermalConnected()) {
        openCashDrawer().catch(() => {});
      }
    } catch (e: any) { toast.error(e?.message ?? 'Erro inesperado'); }
    finally { setProcessing(false); }
  };

  // ── Loading skeleton (shows immediately, never full-block) ────────────────
  // Only blocks on FIRST load with no cache
  if (loading && products.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: XERO.bg, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* Skeleton TopBar */}
        <div className="h-12 shrink-0 flex items-center gap-3 px-4" style={{ background: XERO.navy }}>
          <div className="w-6 h-6 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="w-24 h-4 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="flex-1" />
          <div className="w-16 h-6 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        {/* Skeleton grid */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 content-start overflow-auto">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg animate-pulse" style={{ background: XERO.card, opacity: 1 - i * 0.03 }} />
            ))}
          </div>
          <div className="w-72 shrink-0 border-l p-3 space-y-3 hidden lg:block" style={{ borderColor: XERO.border, background: XERO.card }}>
            <div className="h-6 w-32 rounded animate-pulse" style={{ background: XERO.bg }} />
            <div className="h-48 rounded-lg animate-pulse" style={{ background: XERO.bg }} />
            <div className="h-16 rounded-xl animate-pulse" style={{ background: XERO.bg }} />
            <div className="h-12 rounded-xl animate-pulse" style={{ background: XERO.cyan + '30' }} />
          </div>
        </div>
      </div>
    );
  }

  /* ─── RENDER ─────────────────────────────────────────────────────────────── */
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: XERO.bg, paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >

      {/* ── TOP BAR (Xero Navy) ────────────────────────────────────────────── */}
      <header
        className="flex items-center gap-2 px-4 h-12 shrink-0 shadow"
        style={{ background: XERO.navy }}
      >
        {/* Logo + Back */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="w-4 h-4 text-white/60" />
          <div className="w-6 h-6 rounded flex items-center justify-center font-black text-xs text-white" style={{ background: XERO.cyan }}>
            FA
          </div>
          <span className="font-bold text-white text-sm hidden sm:block">FaturaAO</span>
        </button>

        {/* Divider */}
        <div className="h-4 w-px mx-1 bg-white/20" />

        {/* POS label */}
        <div className="flex items-center gap-1.5">
          <ShoppingCart className="w-4 h-4" style={{ color: XERO.cyan }} />
          <span className="font-bold text-white text-sm">Ponto de Venda</span>
          {companyInfo && (
            <span className="text-white/40 text-xs hidden md:block">· {companyInfo.name}</span>
          )}
        </div>

        {/* Session */}
        {session
          ? (
            <span
              className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ml-2"
              style={{ background: XERO.success + '20', color: XERO.success, border: `1px solid ${XERO.success}40` }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: XERO.success }} />
              {session.terminal_name}
            </span>
          ) : (
            <button
              onClick={() => setShowSession(true)}
              className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ml-2 transition-opacity hover:opacity-80"
              style={{ background: XERO.warning + '20', color: XERO.warning, border: `1px solid ${XERO.warning}40` }}
            >
              <Clock className="w-3 h-3" />
              Abrir Caixa
            </button>
          )
        }

        <div className="flex-1" />

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Online */}
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
            title="Actualizar (F5)"
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

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT — Products */}
        <div className="flex flex-col flex-1 min-w-0 border-r" style={{ borderColor: XERO.border }}>

          {/* Search + Barcode */}
          <div className="px-3 py-2 border-b shrink-0" style={{ background: XERO.card, borderColor: XERO.border }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: XERO.muted }} />
              <Scan className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: XERO.cyan }} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Pesquisar produto, SKU ou código de barras… (F2)"
                className="w-full rounded-lg border pl-9 pr-9 py-2 text-sm focus:outline-none transition-colors"
                style={{
                  borderColor: search ? XERO.cyan : XERO.border,
                  background: XERO.bg,
                  color: XERO.text,
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
            className="flex gap-1.5 px-3 py-2 border-b shrink-0 overflow-x-auto scrollbar-none"
            style={{ background: XERO.card, borderColor: XERO.border }}
          >
            {['Todos', ...categories].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border"
                style={{
                  background: activeCategory === cat ? XERO.cyan : 'transparent',
                  borderColor: activeCategory === cat ? XERO.cyan : XERO.border,
                  color: activeCategory === cat ? '#fff' : XERO.muted,
                }}
              >
                {CAT_EMOJI[cat] && <span>{CAT_EMOJI[cat]}</span>}
                {cat}
                {cat === 'Todos' && <span className="opacity-60">({products.length})</span>}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div
            className="flex-1 overflow-y-auto p-3 overscroll-contain"
            style={{ background: XERO.bg }}
          >
            {filtered.length === 0
              ? (
                <div className="flex flex-col items-center justify-center h-48" style={{ color: XERO.muted }}>
                  <Package className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">
                    {search ? `Sem resultados para "${search}"` : 'Nenhum produto disponível'}
                  </p>
                  {search && (
                    <button onClick={() => setSearch('')} className="mt-2 text-xs font-medium hover:underline" style={{ color: XERO.cyan }}>
                      Limpar pesquisa
                    </button>
                  )}
                </div>
              )
              : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {filtered.map(p => (
                    <ProductCard key={p.id} product={p} onAdd={addToCart} />
                  ))}
                </div>
              )
            }
          </div>

          {/* Shortcuts bar */}
          <div
            className="flex items-center gap-4 px-3 py-1.5 border-t text-[10px] shrink-0 overflow-x-auto scrollbar-none"
            style={{ background: XERO.card, borderColor: XERO.border, color: XERO.muted }}
          >
            {[['F2','Pesquisar'],['F4','Cobrar'],['F5','Limpar'],['F9','Reimprimir'],['ESC','Fechar']].map(([k,l]) => (
              <span key={k} className="flex items-center gap-1 whitespace-nowrap">
                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono border" style={{ borderColor: XERO.border, background: XERO.bg }}>
                  {k}
                </kbd>
                {l}
              </span>
            ))}
            <div className="flex-1" />
            {lastSale && (
              <button
                onClick={() => handlePrint(lastSale)}
                className="flex items-center gap-1 font-semibold hover:underline"
                style={{ color: XERO.cyan }}
              >
                <Printer className="w-3 h-3" />
                Reimprimir
              </button>
            )}
          </div>
        </div>

        {/* RIGHT — Cart */}
        <div
          className="flex flex-col w-[300px] sm:w-[340px] lg:w-[380px] shrink-0 relative"
          style={{ background: XERO.card }}
        >
          {/* ⚠️ SESSION GATE — visual hint only, modal handles the real gate */}
          {!session && !loading && (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 text-center px-6"
              style={{ background: `${XERO.navy}f2`, backdropFilter: 'blur(6px)' }}
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse"
                style={{ background: XERO.warning + '20', border: `2px solid ${XERO.warning}50` }}>
                <Calculator className="w-7 h-7" style={{ color: XERO.warning }} />
              </div>
              <p className="font-black text-white text-base">A abrir caixa…</p>
              <p className="text-white/50 text-xs">Aguarde o modal de abertura</p>
            </div>
          )}

          {/* Cart header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ borderColor: XERO.border, background: XERO.navy }}
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
                onClick={() => setCart([])}
                className="flex items-center gap-1 text-[11px] font-semibold hover:opacity-80 transition-opacity"
                style={{ color: XERO.danger + 'cc' }}
              >
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 overscroll-contain" style={{ background: XERO.bg }}>
            {cart.length === 0
              ? (
                <div className="flex flex-col items-center justify-center h-full py-10" style={{ color: XERO.muted }}>
                  <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Carrinho vazio</p>
                  <p className="text-xs mt-1 opacity-60">Toque num produto para adicionar</p>
                </div>
              )
              : cart.map(item => (
                <CartItemRow
                  key={item.product_id} item={item}
                  onQtyChange={changeQty}
                  onRemove={removeFromCart}
                  onDiscount={id => setShowDiscount(id)}
                />
              ))
            }
          </div>

          {/* Totals */}
          <div className="px-4 py-3 border-t space-y-1.5 shrink-0" style={{ borderColor: XERO.border, background: XERO.card }}>
            <div className="flex justify-between text-xs" style={{ color: XERO.muted }}>
              <span>{totals.items} artigo{totals.items !== 1 ? 's' : ''}</span>
              <span className="tabular-nums">Subtotal: {kz(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs" style={{ color: XERO.muted }}>
              <span>IVA 14%</span>
              <span className="tabular-nums">{kz(totals.tax)}</span>
            </div>
            <div
              className="flex justify-between text-xl font-black border-t pt-2"
              style={{ borderColor: XERO.border, color: XERO.text }}
            >
              <span>TOTAL</span>
              <span className="tabular-nums" style={{ color: XERO.cyan }}>{kz(totals.total)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div
            className="grid grid-cols-4 gap-1.5 px-3 py-2 border-t shrink-0"
            style={{ borderColor: XERO.border, background: XERO.bg }}
          >
            {(['Dinheiro', 'Multicaixa', 'TPA', 'Crédito'] as PaymentMethod[]).map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className="flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-bold transition-all active:scale-95"
                style={{
                  borderColor: paymentMethod === m ? XERO.cyan : XERO.border,
                  background: paymentMethod === m ? XERO.cyan + '12' : XERO.card,
                  color: paymentMethod === m ? XERO.cyan : XERO.muted,
                }}
              >
                {PAY_ICONS[m]}
                {m}
              </button>
            ))}
          </div>

          {/* COBRAR */}
          <div className="px-3 pb-3 pt-2 shrink-0" style={{ background: XERO.bg }}>
            <button
              onClick={() => { if (cart.length > 0) setShowPayment(true); }}
              disabled={cart.length === 0 || processing}
              className="w-full py-4 rounded-xl font-black text-xl text-white tracking-wide transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              style={{ background: cart.length > 0 ? XERO.cyan : XERO.muted }}
            >
              <Receipt className="w-5 h-5" />
              COBRAR
              <span className="text-sm font-semibold opacity-60">F4</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
      {showPayment && (
        <PaymentModal
          total={totals.total} method={paymentMethod}
          onMethodChange={setPaymentMethod}
          onConfirm={handleCheckout}
          onClose={() => setShowPayment(false)}
          processing={processing}
        />
      )}
      {showSession && <SessionModal onOpen={openSession} onClose={() => setShowSession(false)} />}
      {showDiscount && (
        <DiscountModal
          productId={showDiscount}
          current={cart.find(i => i.product_id === showDiscount)?.discount_pct ?? 0}
          onApply={applyDiscount}
          onClose={() => setShowDiscount(null)}
        />
      )}
      {lastSale && <SuccessOverlay sale={lastSale} onClose={() => setLastSale(null)} />}
    </div>
  );
}
