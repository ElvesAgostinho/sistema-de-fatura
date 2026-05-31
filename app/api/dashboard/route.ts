import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { getCachedOrFetch } from '@/lib/redis';
import { CacheKeys, CacheTTL } from '@/lib/cache-keys';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role === 'caixa') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  
  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;

  const cacheKey = CacheKeys.dashboardStats(companyId);

  const dashboardData = await getCachedOrFetch(cacheKey, async () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const firstDayYear = new Date(now.getFullYear(), 0, 1).toISOString();

    const [monthlyRes, ytdRes, recentRes, issuedRes, cancelledRes, clientsRes, productsRes, topClientsRes, topItemsRes, unpaidRes, lowStockRes] = await Promise.all([
      admin.from('invoices')
        .select('subtotal, tax, total, status')
        .eq('company_id', companyId)
        .gte('issued_at', firstDay),
      admin.from('invoices')
        .select('issued_at, total, tax, status')
        .eq('company_id', companyId).gte('issued_at', firstDayYear).order('issued_at'),
      admin.from('invoices')
        .select('id, invoice_number, total, status, issued_at, payment_status, amount_paid, client:clients(name, nif)')
        .eq('company_id', companyId).order('issued_at', { ascending: false }).limit(5),
      admin.from('invoices').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'issued'),
      admin.from('invoices').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'cancelled'),
      admin.from('clients').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
      admin.from('products').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
      admin.from('invoices')
        .select('total, client:clients(id, name)')
        .eq('company_id', companyId).eq('status', 'issued').gte('issued_at', firstDayYear),
      admin.from('invoice_items')
        .select('quantity, price, product:products(id, name), invoice:invoices!inner(status, issued_at, company_id)')
        .eq('invoice.company_id', companyId).eq('invoice.status', 'issued').gte('invoice.issued_at', firstDayYear)
        .limit(2000),
      admin.from('invoices')
        .select('id, invoice_number, total, amount_paid, payment_status, issued_at, client:clients(name)')
        .eq('company_id', companyId).eq('status', 'issued')
        .in('payment_status', ['pendente', 'parcial'])
        .order('issued_at', { ascending: true }).limit(10),
      admin.from('products')
        .select('id, name, quantity_in_stock, stock_alert_threshold')
        .eq('company_id', companyId).eq('is_active', true).eq('track_stock', true)
        .limit(1000),
    ]);

    const monthly = monthlyRes.data ?? [];
    const ytdInvoices = ytdRes.data ?? [];
    const recent = recentRes.data ?? [];

    const issuedMonthly = monthly.filter((x: any) => x.status === 'issued');
    const monthRevenue = issuedMonthly.reduce((s: number, x: any) => s + Number(x.total ?? 0), 0);
    const monthTax = issuedMonthly.reduce((s: number, x: any) => s + Number(x.tax ?? 0), 0);
    const monthCount = issuedMonthly.length;

    const monthlyChart: { month: string; revenue: number; tax: number; count: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const label = new Date(2000, m, 1).toLocaleString('pt-PT', { month: 'short' });
      monthlyChart.push({ month: label, revenue: 0, tax: 0, count: 0 });
    }
    (ytdInvoices ?? []).forEach((x: any) => {
      if (x.status !== 'issued') return;
      const m = new Date(x.issued_at).getMonth();
      monthlyChart[m].revenue += Number(x.total ?? 0);
      monthlyChart[m].tax += Number(x.tax ?? 0);
      monthlyChart[m].count += 1;
    });

    const clientMap = new Map<string, { id: string; name: string; total: number; count: number }>();
    (topClientsRes.data ?? []).forEach((row: any) => {
      const c = Array.isArray(row.client) ? row.client[0] : row.client;
      if (!c?.id) return;
      const prev = clientMap.get(c.id) ?? { id: c.id, name: c.name, total: 0, count: 0 };
      prev.total += Number(row.total ?? 0);
      prev.count += 1;
      clientMap.set(c.id, prev);
    });
    const topClients = Array.from(clientMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

    const productMap = new Map<string, { id: string; name: string; total: number; qty: number }>();
    (topItemsRes.data ?? []).forEach((row: any) => {
      const p = Array.isArray(row.product) ? row.product[0] : row.product;
      if (!p?.id) return;
      const prev = productMap.get(p.id) ?? { id: p.id, name: p.name, total: 0, qty: 0 };
      prev.total += Number(row.quantity ?? 0) * Number(row.price ?? 0);
      prev.qty += Number(row.quantity ?? 0);
      productMap.set(p.id, prev);
    });
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

    const unpaidList = unpaidRes.data ?? [];
    const unpaidTotal = unpaidList.reduce((s: number, x: any) => s + (Number(x.total ?? 0) - Number(x.amount_paid ?? 0)), 0);

    const lowStock = (lowStockRes.data ?? []).filter((p: any) => Number(p.quantity_in_stock ?? 0) <= Number(p.stock_alert_threshold ?? 0));

    return {
      monthRevenue, monthTax, monthCount,
      totalIssued: issuedRes.count ?? 0,
      totalCancelled: cancelledRes.count ?? 0,
      clientsCount: clientsRes.count ?? 0,
      productsCount: productsRes.count ?? 0,
      monthlyChart,
      recent,
      topClients,
      topProducts,
      unpaid: { list: unpaidList, total: unpaidTotal, count: unpaidList.length },
      lowStock,
    };
  }, CacheTTL.dashboard);

  return NextResponse.json(dashboardData);
}
