import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isSuperAdmin = ctx.profile.email === 'elvessacapuri57@gmail.com';
  if (ctx.profile.role !== 'admin' && !isSuperAdmin) {
    return NextResponse.json({ error: 'Apenas administradores podem anular faturas' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const reason = String(body?.reason ?? '').trim();
    if (!reason || reason.length < 5) return NextResponse.json({ error: 'Motivo do cancelamento obrigatório (min. 5 caracteres)' }, { status: 400 });

    const admin = createAdminClient();
    const { data: invoice } = await admin.from('invoices').select('*').eq('id', params.id).eq('company_id', ctx.profile.company_id).maybeSingle();
    if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    if (invoice.status === 'cancelled') return NextResponse.json({ error: 'Fatura já está cancelada' }, { status: 400 });

    const { data: updated, error } = await admin.from('invoices')
      .update({ status: 'cancelled', cancellation_reason: reason, cancelled_at: new Date().toISOString() })
      .eq('id', params.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Reverse stock movements (re-add stock on cancel)
    const { data: movements } = await admin.from('stock_movements')
      .select('product_id, quantity')
      .eq('invoice_id', params.id)
      .eq('movement_type', 'venda');
    if (movements && movements.length > 0) {
      const productIds = Array.from(new Set(movements.map((m: any) => m.product_id)));
      const { data: products } = await admin.from('products')
        .select('id, quantity_in_stock')
        .in('id', productIds);
      const pMap = new Map((products ?? []).map((p: any) => [p.id, Number(p.quantity_in_stock ?? 0)]));
      for (const m of movements) {
        const qtyToRestore = Math.abs(Number(m.quantity ?? 0));
        const current = pMap.get(m.product_id) ?? 0;
        const newBalance = current + qtyToRestore;
        pMap.set(m.product_id, newBalance);
        await admin.from('products').update({ quantity_in_stock: newBalance }).eq('id', m.product_id);
        await admin.from('stock_movements').insert({
          company_id: ctx.profile.company_id,
          product_id: m.product_id,
          invoice_id: params.id,
          movement_type: 'anulacao',
          quantity: qtyToRestore,
          balance_after: newBalance,
          notes: `Anulação de ${invoice.invoice_number}`,
        });
      }
    }

    await admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: ctx.profile.company_id,
      action: 'invoice.cancel', entity: 'invoice', entity_id: params.id,
      details: { invoice_number: invoice.invoice_number, reason },
    });

    return NextResponse.json({ invoice: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}
