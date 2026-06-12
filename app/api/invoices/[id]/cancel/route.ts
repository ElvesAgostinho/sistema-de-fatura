import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/invoices/[id]/cancel
 *
 * Quem pode cancelar (como nas grandes empresas):
 *   - admin      → pode sempre
 *   - gestor     → pode sempre (supervisor de vendas)
 *   - caixa      → NUNCA pode cancelar (apenas registar pagamentos)
 *   - superadmin → pode sempre
 *
 * AGT exige:
 *   - Motivo obrigatório (min 10 caracteres para AGT)
 *   - Registo de quem cancelou (cancelled_by)
 *   - Registo de quando cancelou (cancelled_at)
 *   - Factura NUNCA é apagada — só muda status para 'cancelled'
 *   - Stock é revertido automaticamente
 *   - Nota de Crédito (NC) deve ser emitida pelo operador separadamente
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isSuperAdmin = ctx.profile.email === 'elvessacapuri57@gmail.com';
  const canCancel = ['admin', 'gestor'].includes(ctx.profile.role) || isSuperAdmin;

  if (!canCancel) {
    const roleMsg = ctx.profile.role === 'caixa'
      ? 'O caixa não tem permissão para anular faturas. Contacte o supervisor.'
      : 'Apenas administradores e gestores podem anular faturas.';
    return NextResponse.json({ error: roleMsg }, { status: 403 });
  }

  try {
    const body = await req.json();
    const reason = String(body?.reason ?? '').trim();

    // AGT: motivo de cancelamento tem de ser descritivo (mín. 10 chars)
    if (!reason || reason.length < 10) {
      return NextResponse.json({
        error: 'Motivo de anulação obrigatório (mínimo 10 caracteres). A AGT exige justificação clara.',
      }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: invoice } = await admin
      .from('invoices')
      .select('*')
      .eq('id', params.id)
      .eq('company_id', ctx.profile.company_id)
      .maybeSingle();

    if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    if (invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Fatura já está anulada' }, { status: 400 });
    }

    // AGT: recibos (FR) e facturas pagas não devem ser anulados sem NC correspondente
    if (['RC', 'FR'].includes((invoice.document_type || '').toUpperCase()) && !body?.force) {
      return NextResponse.json({
        error: `Documentos do tipo ${invoice.document_type} normalmente exigem emissão de Nota de Crédito (NC). Use force=true para confirmar anulação directa.`,
        requiresNC: true,
      }, { status: 409 });
    }

    const { data: updated, error } = await admin
      .from('invoices')
      .update({
        status:               'cancelled',
        cancellation_reason:  reason,
        cancelled_at:         new Date().toISOString(),
        cancelled_by:         ctx.user.id,   // AGT: registo do operador
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Reverter movimentos de stock
    const { data: movements } = await admin
      .from('stock_movements')
      .select('product_id, quantity')
      .eq('invoice_id', params.id)
      .eq('movement_type', 'venda');

    if (movements && movements.length > 0) {
      const productIds = Array.from(new Set(movements.map((m: any) => m.product_id)));
      const { data: products } = await admin
        .from('products')
        .select('id, quantity_in_stock')
        .in('id', productIds);

      const pMap = new Map((products ?? []).map((p: any) => [p.id, Number(p.quantity_in_stock ?? 0)]));

      for (const m of movements) {
        const qtyToRestore = Math.abs(Number(m.quantity ?? 0));
        const current      = pMap.get(m.product_id) ?? 0;
        const newBalance   = current + qtyToRestore;
        pMap.set(m.product_id, newBalance);

        await admin.from('products')
          .update({ quantity_in_stock: newBalance })
          .eq('id', m.product_id);

        await admin.from('stock_movements').insert({
          company_id:    ctx.profile.company_id,
          product_id:    m.product_id,
          invoice_id:    params.id,
          movement_type: 'anulacao',
          quantity:      qtyToRestore,
          balance_after: newBalance,
          notes:         `Anulação de ${invoice.invoice_number} — ${reason}`,
        });
      }
    }

    // Audit log — obrigatório para rastreabilidade AGT
    await admin.from('audit_logs').insert({
      user_id:    ctx.user.id,
      company_id: ctx.profile.company_id,
      action:     'invoice.cancel',
      entity:     'invoice',
      entity_id:  params.id,
      details: {
        invoice_number:      invoice.invoice_number,
        document_type:       invoice.document_type,
        cancelled_by_role:   ctx.profile.role,
        cancelled_by_name:   ctx.profile.full_name ?? ctx.profile.email,
        reason,
        total:               invoice.total,
      },
    });

    return NextResponse.json({
      invoice: updated,
      message: `Fatura ${invoice.invoice_number} anulada com sucesso.`,
      note: 'Emita uma Nota de Crédito (NC) se necessário para regularização com o cliente.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
