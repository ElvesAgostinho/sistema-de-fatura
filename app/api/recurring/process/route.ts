import { NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { ApiResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx?.profile) return ApiResponse.unauthorized();
    
    if (ctx.profile.role !== 'admin' && ctx.profile.role !== 'contabilista') {
      return NextResponse.json({ error: 'Permissões insuficientes' }, { status: 403 });
    }

    const db = createAdminClient();
    
    // 1. Obter todas as avenças pendentes de processamento até hoje
    const today = new Date().toISOString().split('T')[0];
    
    const { data: recurrings, error: fetchErr } = await db
      .from('recurring_invoices')
      .select('*, client:clients(id, name, nif)')
      .eq('company_id', ctx.profile.company_id)
      .eq('is_active', true)
      .lte('next_issue_date', today);

    if (fetchErr) throw fetchErr;
    if (!recurrings || recurrings.length === 0) {
      return NextResponse.json({ message: 'Nenhuma avença pendente para hoje.' });
    }

    const invoicesToInsert = [];
    const invoiceItemsToInsert = [];
    const recurringUpdates = [];

    let processedCount = 0;

    for (const rec of recurrings) {
      // Create an invoice payload
      const invoiceId = crypto.randomUUID();
      const invoiceNumber = `FT DRAFT/${new Date().getFullYear()}/${Math.floor(Math.random() * 10000)}`;

      invoicesToInsert.push({
        id: invoiceId,
        company_id: ctx.profile.company_id,
        client_id: rec.client_id,
        number: invoiceNumber,
        issue_date: today,
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 dias de vencimento padrão
        subtotal: rec.amount,
        tax_total: 0,
        total: rec.amount,
        status: 'draft', // Seguro e Profissional: Cria como Rascunho para revisão
        type: 'FT',
        currency: 'AOA',
        hash: 'pending',
        hash_control: '1'
      });

      // Item payload
      invoiceItemsToInsert.push({
        invoice_id: invoiceId,
        description: rec.description || 'Avença de Serviços',
        quantity: 1,
        unit_price: rec.amount,
        tax_rate: 0,
        total: rec.amount,
        product_id: null // Pode ser associado posteriormente se a avença tiver produto
      });

      // Calcular a próxima data de emissão
      const nextDate = new Date(rec.next_issue_date);
      if (rec.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
      else if (rec.frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
      else if (rec.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
      
      recurringUpdates.push({
        id: rec.id,
        next_issue_date: nextDate.toISOString().split('T')[0]
      });

      processedCount++;
    }

    // Inserção Transacional Simples (Usando inserções massivas)
    if (invoicesToInsert.length > 0) {
      const { error: invErr } = await db.from('invoices').insert(invoicesToInsert);
      if (invErr) throw invErr;

      const { error: itemsErr } = await db.from('invoice_items').insert(invoiceItemsToInsert);
      if (itemsErr) throw itemsErr;

      // Update recurrings
      for (const update of recurringUpdates) {
        await db.from('recurring_invoices').update({ next_issue_date: update.next_issue_date }).eq('id', update.id);
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: processedCount,
      message: `${processedCount} avenças geradas como rascunho com sucesso.`
    });

  } catch (error: any) {
    console.error('Batch process error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
