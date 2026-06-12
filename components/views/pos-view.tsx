'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, X, Printer,
  CreditCard, Banknote, Smartphone, ChevronLeft, ChevronRight,
  Package, BarChart3, Zap, User, LogOut, Settings, RefreshCw,
  CheckCircle2, AlertCircle, Loader2, Calculator, Tag, Clock,
  Wifi, WifiOff, Receipt, PlusCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { POSProduct, POSCartItem, PaymentMethod, POSSession } from '@/lib/pos/types';
import { printReceiptFallback } from '@/lib/pos/thermal-printer';

// ── Helpers ─────────────────────────────────────────────────────────────────
const kz = (n: number) => `${n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

function calcLine(item: POSCartItem): POSCartItem {
  const disc = item.discount_pct / 100;
  const effectivePrice = item.price * (1 - disc);
  const sub  = +(effectivePrice * item.quantity).toFixed(2);
  const tax  = +(sub * (item.tax_rate / 100)).toFixed(2);
  return { ...item, line_subtotal: sub, line_tax: tax, line_total: +(sub + tax).toFixed(2) };
}

const PAYMENT_ICONS: Record<PaymentMethod, React.ReactNode> = {
  'Dinheiro':   <Banknote className="w-5 h-5" />,
  'Multicaixa': <CreditCard className="w-5 h-5" />,
  'TPA':        <Smartphone className="w-5 h-5" />,
  'Crédito':    <Tag className="w-5 h-5" />,
  'Misto':      <Calculator className="w-5 h-5" />,
};

const CATEGORIES_EMOJI: Record<string, string> = {
  'Alimentação': '🥦', 'Bebidas': '🍺', 'Higiene': '🧴', 'Limpeza': '🧹',
  'Mercearia': '🥫', 'Frios': '❄️', 'Padaria': '🍞', 'Talho': '🥩',
  'Peixaria': '🐟', 'Frutas': '🍎', 'Electrónica': '📱', 'Vestuário': '👕',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function ProductCard({ product, onAdd }: { product: POSProduct; onAdd: (p: POSProduct) => void }) {
  const lowStock = product.track_stock && (product.quantity_in_stock ?? 0) < 5;
  const outOfStock = product.track_stock && (product.quantity_in_stock ?? 0) <= 0;

  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={`
        relative flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center
        transition-all duration-150 select-none group
        ${outOfStock
          ? 'opacity-40 cursor-not-allowed border-white/5 bg-white/3'
          : 'cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95 border-white/10 bg-white/5 hover:border-sky-500/60 hover:bg-sky-500/10'
        }
      `}
    >
      {/* Category emoji / image */}
      <div className="text-2xl mb-1.5">
        {product.image_url
          ? <img src={product.image_url} alt="" className="w-10 h-10 object-cover rounded-lg" />
          : CATEGORIES_EMOJI[product.category ?? ''] ?? '📦'}
      </div>

      <p className="text-xs font-medium leading-tight text-white/90 line-clamp-2 mb-1">{product.name}</p>
      <p className="text-sm font-bold text-sky-400">{kz(product.price)}</p>

      {lowStock && !outOfStock && (
        <span className="absolute top-1.5 right-1.5 bg-amber-500/80 text-amber-900 text-[9px] font-bold px-1 rounded">
          {product.quantity_in_stock}
        </span>
      )}
      {outOfStock && (
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-red-400 text-xs font-bold">
          Esgotado
        </span>
      )}
    </button>
  );
}

function CartItemRow({
  item, onQtyChange, onRemove, onDiscount,
}: {
  item: POSCartItem;
  onQtyChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onDiscount: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-white/5 group hover:bg-white/8 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 truncate">{item.name}</p>
        <p className="text-xs text-white/50">
          {kz(item.price)}
          {item.discount_pct > 0 && <span className="ml-1 text-amber-400">-{item.discount_pct}%</span>}
          {' · IVA '}{item.tax_rate}%
        </p>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onQtyChange(item.product_id, item.quantity - 1)}
          className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
        <button
          onClick={() => onQtyChange(item.product_id, item.quantity + 1)}
          className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <p className="w-24 text-right text-sm font-bold text-white tabular-nums">{kz(item.line_total)}</p>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onDiscount(item.product_id)} className="w-6 h-6 text-amber-400 hover:text-amber-300" title="Desconto">
          <Tag className="w-4 h-4" />
        </button>
        <button onClick={() => onRemove(item.product_id)} className="w-6 h-6 text-red-400 hover:text-red-300" title="Remover">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({
  total, method, onMethodChange, onConfirm, onClose, processing,
}: {
  total: number;
  method: PaymentMethod;
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
    setTimeout(() => inputRef.current?.select(), 50);
  }, [total, method]);

  const numpadPress = (val: string) => {
    if (val === '⌫') { setTendered(s => s.slice(0, -1) || '0'); return; }
    if (val === '.' && tendered.includes('.')) return;
    if (tendered === '0') { setTendered(val); return; }
    setTendered(s => s + val);
  };

  const NUMPAD = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];
  const METHODS: PaymentMethod[] = ['Dinheiro', 'Multicaixa', 'TPA', 'Crédito'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Pagamento</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Total */}
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 mb-5 text-center">
          <p className="text-sm text-sky-300 mb-1">Total a pagar</p>
          <p className="text-4xl font-black text-white tabular-nums">{kz(total)}</p>
        </div>

        {/* Payment methods */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {METHODS.map(m => (
            <button
              key={m}
              onClick={() => onMethodChange(m)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                method === m
                  ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30'
              }`}
            >
              {PAYMENT_ICONS[m]}
              {m}
            </button>
          ))}
        </div>

        {/* Cash input + numpad */}
        {method === 'Dinheiro' && (
          <>
            <div className="mb-4">
              <label className="text-xs text-white/50 mb-1 block">Valor entregue pelo cliente</label>
              <input
                ref={inputRef}
                type="number"
                value={tendered}
                onChange={e => setTendered(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-xl font-bold text-white text-right tabular-nums focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000, 5000, 10000].map(amt => (
                <button key={amt} onClick={() => setTendered(amt.toFixed(2))}
                  className="py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/70 transition-colors">
                  {(amt / 1000).toFixed(0)}k
                </button>
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {NUMPAD.map(k => (
                <button key={k} onClick={() => numpadPress(k)}
                  className="py-3 rounded-xl bg-white/8 hover:bg-white/15 active:bg-white/20 text-lg font-semibold text-white transition-all">
                  {k}
                </button>
              ))}
            </div>

            {/* Change */}
            {change > 0 && (
              <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-4">
                <span className="text-sm text-green-300 font-medium">Troco</span>
                <span className="text-2xl font-black text-green-400 tabular-nums">{kz(change)}</span>
              </div>
            )}
          </>
        )}

        {/* Confirm */}
        <button
          onClick={() => onConfirm(tenderedNum)}
          disabled={processing || (method === 'Dinheiro' && tenderedNum < total)}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {processing ? 'A processar...' : 'Confirmar Pagamento'}
        </button>
      </div>
    </div>
  );
}

// ── Session Modal ─────────────────────────────────────────────────────────────
function SessionModal({ onOpen, onClose }: { onOpen: (name: string, balance: number) => void; onClose: () => void }) {
  const [name, setName] = useState('Caixa 1');
  const [balance, setBalance] = useState('0');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-white mb-5">Abrir Sessão de Caixa</h2>
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Nome do Terminal</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Fundo de Caixa (Kz)</label>
            <input type="number" value={balance} onChange={e => setBalance(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-sky-500" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 font-semibold">Cancelar</button>
          <button onClick={() => onOpen(name, parseFloat(balance) || 0)}
            className="flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold">Abrir Caixa</button>
        </div>
      </div>
    </div>
  );
}

// ── Discount Modal ─────────────────────────────────────────────────────────────
function DiscountModal({ productId, current, onApply, onClose }: {
  productId: string; current: number; onApply: (id: string, pct: number) => void; onClose: () => void;
}) {
  const [pct, setPct] = useState(current.toString());
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-xs p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">Desconto (%)</h3>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[5, 10, 15, 20, 25, 30, 40, 50].map(d => (
            <button key={d} onClick={() => setPct(d.toString())}
              className={`py-2 rounded-lg text-sm font-bold transition-all ${pct === d.toString() ? 'bg-amber-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {d}%
            </button>
          ))}
        </div>
        <input type="number" min="0" max="100" value={pct} onChange={e => setPct(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-center text-xl font-bold mb-4 focus:outline-none focus:border-amber-500" />
        <div className="flex gap-3">
          <button onClick={() => { onApply(productId, 0); onClose(); }} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm">Remover</button>
          <button onClick={() => { onApply(productId, Math.min(100, parseFloat(pct) || 0)); onClose(); }}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">Aplicar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main POS View ─────────────────────────────────────────────────────────────
export default function POSView() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [products, setProducts]         = useState<POSProduct[]>([]);
  const [categories, setCategories]     = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [search, setSearch]             = useState('');
  const [cart, setCart]                 = useState<POSCartItem[]>([]);
  const [session, setSession]           = useState<POSSession | null>(null);
  const [loading, setLoading]           = useState(true);
  const [processing, setProcessing]     = useState(false);
  const [showPayment, setShowPayment]   = useState(false);
  const [showSession, setShowSession]   = useState(false);
  const [showDiscount, setShowDiscount] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Dinheiro');
  const [lastSale, setLastSale]         = useState<any>(null);
  const [clock, setClock]               = useState(new Date());
  const [companyInfo, setCompanyInfo]   = useState<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Load products + session ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, sessRes, compRes] = await Promise.all([
        fetch('/api/products?limit=500&active=true'),
        fetch('/api/pos/session'),
        fetch('/api/company'),
      ]);
      const [prodJson, sessJson, compJson] = await Promise.all([
        prodRes.json(), sessRes.json(), compRes.json(),
      ]);

      const prods: POSProduct[] = prodJson.products ?? [];
      setProducts(prods);

      const cats = Array.from(new Set(prods.map(p => p.category).filter(Boolean))) as string[];
      setCategories(cats);

      setSession(sessJson.session ?? null);
      setCompanyInfo(compJson.company ?? null);
    } catch {
      toast.error('Erro ao carregar dados do POS');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // F2 → focus search
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      // F4 → open payment
      if (e.key === 'F4' && cart.length > 0) { e.preventDefault(); setShowPayment(true); }
      // Escape → close modals / clear search
      if (e.key === 'Escape') { setShowPayment(false); setSearch(''); }
      // F5 → clear cart
      if (e.key === 'F5') { e.preventDefault(); setCart([]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart]);

  // ── Filtered products ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let res = products;
    if (activeCategory !== 'Todos') res = res.filter(p => p.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        (p as any).barcode?.toLowerCase().includes(q)
      );
    }
    return res;
  }, [products, activeCategory, search]);

  // ── Cart operations ────────────────────────────────────────────────────────
  const addToCart = useCallback((product: POSProduct) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id
          ? calcLine({ ...i, quantity: i.quantity + 1 })
          : i
        );
      }
      return [...prev, calcLine({
        product_id: product.id, name: product.name,
        price: product.price, tax_rate: product.tax_rate,
        quantity: 1, discount_pct: 0,
        line_subtotal: 0, line_tax: 0, line_total: 0,
      })];
    });
  }, []);

  const changeQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.product_id !== productId)); return; }
    setCart(prev => prev.map(i => i.product_id === productId ? calcLine({ ...i, quantity: qty }) : i));
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(i => i.product_id !== productId));
  }, []);

  const applyDiscount = useCallback((productId: string, pct: number) => {
    setCart(prev => prev.map(i => i.product_id === productId ? calcLine({ ...i, discount_pct: pct }) : i));
  }, []);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const subtotal = +cart.reduce((s, i) => s + i.line_subtotal, 0).toFixed(2);
    const tax      = +cart.reduce((s, i) => s + i.line_tax, 0).toFixed(2);
    const total    = +cart.reduce((s, i) => s + i.line_total, 0).toFixed(2);
    return { subtotal, tax, total, items: cart.reduce((s, i) => s + i.quantity, 0) };
  }, [cart]);

  // ── Session management ─────────────────────────────────────────────────────
  const openSession = async (name: string, balance: number) => {
    try {
      const res = await fetch('/api/pos/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', terminal_name: name, opening_balance: balance }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error); return; }
      setSession(json.session);
      setShowSession(false);
      toast.success(`${name} aberta com sucesso!`);
    } catch { toast.error('Erro ao abrir sessão'); }
  };

  const closeSession = async () => {
    if (!session) return;
    if (!confirm('Fechar sessão de caixa?')) return;
    try {
      const res = await fetch('/api/pos/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', session_id: session.id }),
      });
      if (res.ok) { setSession(null); toast.success('Sessão fechada'); }
    } catch { toast.error('Erro ao fechar sessão'); }
  };

  // ── Checkout ────────────────────────────────────────────────────────────────
  const handleCheckout = async (amountTendered: number) => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session?.id ?? null,
          client_id: null,
          items: cart,
          payment_method: paymentMethod,
          amount_tendered: amountTendered,
          notes: null,
          tax_exempt: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? 'Erro no pagamento'); return; }

      const sale = json.invoice ?? json;
      setLastSale({ ...sale, paymentMethod, amountTendered, change: json.change ?? 0 });
      setCart([]);
      setShowPayment(false);
      toast.success(`Venda registada · ${sale.invoice_number}`, { duration: 4000 });

      // Auto-print receipt
      printReceiptFallback({
        companyName:    companyInfo?.name ?? 'Empresa',
        companyNif:     companyInfo?.nif ?? '',
        companyAddress: companyInfo?.address ?? '',
        invoiceNumber:  sale.invoice_number,
        issuedAt:       sale.issued_at ?? new Date().toISOString(),
        items:          cart.map(i => ({ name: i.name, qty: i.quantity, price: i.price, total: i.line_total })),
        subtotal:       totals.subtotal,
        tax:            totals.tax,
        total:          totals.total,
        paymentMethod,
        amountTendered: paymentMethod === 'Dinheiro' ? amountTendered : undefined,
        change:         json.change,
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro inesperado');
    } finally {
      setProcessing(false);
    }
  };

  // ── Barcode scanner detection in search ───────────────────────────────────
  const searchStartTime = useRef<number>(0);
  const onSearchChange = (val: string) => {
    if (!searchStartTime.current) searchStartTime.current = Date.now();
    setSearch(val);
    // Auto-select if single product match after scanner input
    if (val.length > 4) {
      const elapsed = Date.now() - searchStartTime.current;
      const isScanner = elapsed < 300; // typed in < 300ms → scanner
      if (isScanner) {
        const match = products.find(p => p.sku === val || (p as any).barcode === val);
        if (match) {
          addToCart(match);
          setSearch('');
          searchStartTime.current = 0;
        }
      }
    }
    if (val === '') searchStartTime.current = 0;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#060d1a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-sky-500 animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">A carregar POS…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#060d1a] flex flex-col overflow-hidden text-white select-none">

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-[#0a1628] border-b border-white/5 shrink-0">
        <button onClick={() => router.push('/dashboard')}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white">
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm">POS</span>
          {companyInfo && <span className="text-white/40 text-xs hidden sm:block">· {companyInfo.name}</span>}
        </div>

        {/* Session indicator */}
        <div className="flex items-center gap-2 ml-2">
          {session
            ? <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                {session.terminal_name}
              </span>
            : <button onClick={() => setShowSession(true)}
                className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full hover:bg-amber-400/15 transition-colors">
                <Clock className="w-3 h-3" />
                Abrir Caixa
              </button>
          }
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Clock */}
          <span className="text-sm tabular-nums text-white/60 hidden sm:block">
            {clock.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>

          <button onClick={loadData} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors" title="Actualizar (F5)">
            <RefreshCw className="w-4 h-4" />
          </button>

          {session && (
            <button onClick={closeSession} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-red-400 hover:bg-red-400/10 px-2.5 py-1.5 rounded-lg transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              Fechar Caixa
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN AREA ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT — Products ─────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-white/5">

          {/* Search */}
          <div className="px-3 py-2.5 bg-[#0a1628] border-b border-white/5 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Pesquisar produto, SKU ou código de barras… (F2)"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/50 focus:bg-white/8"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 px-3 py-2 bg-[#080f1e] border-b border-white/5 shrink-0 overflow-x-auto scrollbar-none">
            {['Todos', ...categories].map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'bg-sky-600 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}>
                {CATEGORIES_EMOJI[cat] && <span>{CATEGORIES_EMOJI[cat]}</span>}
                {cat}
                {cat === 'Todos' && <span className="text-[10px] opacity-60">({products.length})</span>}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0
              ? <div className="flex flex-col items-center justify-center h-48 text-white/30">
                  <Package className="w-10 h-10 mb-2" />
                  <p className="text-sm">Nenhum produto encontrado</p>
                </div>
              : <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {filtered.map(p => (
                    <ProductCard key={p.id} product={p} onAdd={addToCart} />
                  ))}
                </div>
            }
          </div>

          {/* Keyboard shortcuts bar */}
          <div className="flex items-center gap-4 px-3 py-2 bg-[#0a1628] border-t border-white/5 text-[10px] text-white/30 shrink-0">
            <span><kbd className="bg-white/10 px-1 rounded">F2</kbd> Pesquisar</span>
            <span><kbd className="bg-white/10 px-1 rounded">F4</kbd> Cobrar</span>
            <span><kbd className="bg-white/10 px-1 rounded">F5</kbd> Limpar</span>
            <span><kbd className="bg-white/10 px-1 rounded">ESC</kbd> Fechar</span>
          </div>
        </div>

        {/* RIGHT — Cart ─────────────────────────────────────────────────── */}
        <div className="flex flex-col w-[340px] lg:w-[400px] shrink-0">

          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0a1628] border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-sky-400" />
              <span className="font-semibold text-sm">Carrinho</span>
              {cart.length > 0 && (
                <span className="bg-sky-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totals.items}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2 py-1 rounded-lg transition-colors">
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {cart.length === 0
              ? <div className="flex flex-col items-center justify-center h-full text-white/20 py-12">
                  <ShoppingCart className="w-12 h-12 mb-3" />
                  <p className="text-sm">Carrinho vazio</p>
                  <p className="text-xs mt-1">Clique num produto para adicionar</p>
                </div>
              : cart.map(item => (
                  <CartItemRow key={item.product_id} item={item}
                    onQtyChange={changeQty}
                    onRemove={removeFromCart}
                    onDiscount={id => setShowDiscount(id)}
                  />
                ))
            }
          </div>

          {/* Totals */}
          <div className="px-4 py-3 bg-[#0a1628] border-t border-white/5 space-y-1.5 shrink-0">
            <div className="flex justify-between text-sm text-white/60">
              <span>Subtotal</span>
              <span className="tabular-nums">{kz(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-white/60">
              <span>IVA (14%)</span>
              <span className="tabular-nums">{kz(totals.tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-black text-white border-t border-white/10 pt-2 mt-2">
              <span>TOTAL</span>
              <span className="tabular-nums text-sky-400">{kz(totals.total)}</span>
            </div>
          </div>

          {/* Payment method quick selector */}
          <div className="grid grid-cols-4 gap-1.5 px-3 py-2 bg-[#080f1e] border-t border-white/5 shrink-0">
            {(['Dinheiro', 'Multicaixa', 'TPA', 'Crédito'] as PaymentMethod[]).map(m => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                  paymentMethod === m
                    ? 'bg-sky-600/30 border border-sky-500/50 text-sky-300'
                    : 'bg-white/5 border border-transparent text-white/40 hover:text-white hover:bg-white/10'
                }`}>
                {PAYMENT_ICONS[m]}
                <span>{m}</span>
              </button>
            ))}
          </div>

          {/* COBRAR button */}
          <div className="px-3 pb-3 pt-2 bg-[#080f1e] shrink-0">
            <button
              onClick={() => { if (cart.length > 0) setShowPayment(true); }}
              disabled={cart.length === 0 || processing}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-700 to-sky-500 hover:from-sky-600 hover:to-sky-400 text-white font-black text-xl tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-98 shadow-lg shadow-sky-900/30 flex items-center justify-center gap-2"
            >
              <Receipt className="w-5 h-5" />
              COBRAR
              <span className="text-base font-semibold opacity-80">F4</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
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
        <SessionModal onOpen={openSession} onClose={() => setShowSession(false)} />
      )}

      {showDiscount && (
        <DiscountModal
          productId={showDiscount}
          current={cart.find(i => i.product_id === showDiscount)?.discount_pct ?? 0}
          onApply={applyDiscount}
          onClose={() => setShowDiscount(null)}
        />
      )}
    </div>
  );
}
