import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pos/void-sale
 * Anula uma venda POS já emitida.
 *
 * Como nas grandes empresas (Retail Pro, Lightspeed, NCR):
 *  - Caixa comum: NÃO pode anular — precisa de autorização do gestor
 *  - Gestor/Admin: pode anular imediatamente com motivo
 *  - A anulação reverte stock e regista em audit_logs
 *  - A fatura recebe status='cancelled' e cancellation_reason
 *
 * Body: { invoice_id: string, reason: string, manager_pin?: string }
 */
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const { invoice_id, reason, manager_pin } = body ?? {};

  if (!invoice_id) return NextResponse.json({ error: 'invoice_id obrigatório' }, { status: 400 });
  if (!reason || String(reason).trim().length < 5) {
    return NextResponse.json({ error: 'Motivo de anulação obrigatório (mínimo 5 caracteres)' }, { status: 400 });
  }

  const admin  = createAdminClient();
  const role   = ctx.profile.role;
  const userId = ctx.user.id;

  // Se é caixa, verifica PIN do gestor
  if (role === 'caixa') {
    if (!manager_pin) {
      return NextResponse.json({
        error: 'Operador de caixa precisa de autorização do gestor para anular vendas',
        requires_manager_pin: true,
      }, { status: 403 });
    }
    // Verifica PIN: procura um gestor/admin com esse PIN na empresa
    const { data: managers } = await admin
      .from('users')
      .select('id, pos_manager_pin')
      .eq('company_id', ctx.profile.company_id)
      .in('role', ['admin', 'gestor']);

    const authorized = (managers ?? []).some(m => m.pos_manager_pin && m.pos_manager_pin === String(manager_pin).trim());
    if (!authorized) {
      return NextResponse.json({ error: 'PIN de gestor inválido. Chame o responsável.' }, { status: 403 });
    }
  } else if (!['admin', 'gestor'].includes(role)) {
    return NextResponse.json({ error: 'Sem permissão para anular vendas' }, { status: 403 });
  }

  // Busca a fatura
  const { data: invoice } = await admin
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('id', invoice_id)
    .eq('company_id', ctx.profile.company_id)
    .maybeSingle();

  if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
  if (invoice.status === 'cancelled') return NextResponse.json({ error: 'Fatura já está cancelada' }, { status: 400 });

  // Só pode anular faturas da sessão actual ou recentes (até 24h)
  const issuedAt  = new Date(invoice.issued_at);
  const diffHours = (Date.now() - issuedAt.getTime()) / (1000 * 60 * 60);
  if (diffHours > 24 && role === 'caixa') {
    return NextResponse.json({ error: 'Só é possível anular vendas das últimas 24 horas pelo caixa' }, { status: 400 });
  }

  // Reverte stock dos itens
  const items = invoice.items ?? [];
  for (const item of items) {
    if (!item.product_id) continue;
    const { data: prod } = await admin.from('products').select('stock').eq('id', item.product_id).maybeSingle();
    if (prod) {
      await admin.from('products').update({ stock: (prod.stock ?? 0) + Number(item.quantity) }).eq('id', item.product_id);
    }
  }

  // Marca fatura como cancelada
  await admin.from('invoices').update({
    status:              'cancelled',
    cancellation_reason: String(reason).trim(),
    cancelled_by:        userId,
    cancelled_at:        new Date().toISOString(),
  }).eq('id', invoice_id);

  // Reverte stock_movements se existirem
  await admin.from('stock_movements').delete().eq('invoice_id', invoice_id);

  // Audit log
  await admin.from('audit_logs').insert({
    company_id: ctx.profile.company_id,
    user_id:    userId,
    action:     'pos.void_sale',
    entity:     'invoice',
    entity_id:  invoice_id,
    details: {
      invoice_number: invoice.invoice_number,
      total:          invoice.total,
      reason:         String(reason).trim(),
      voided_by_role: role,
    },
  });

  return NextResponse.json({
    ok: true,
    invoice_number: invoice.invoice_number,
    message: `Venda ${invoice.invoice_number} anulada com sucesso`,
  });
}
