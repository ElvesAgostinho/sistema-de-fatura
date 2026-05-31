import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { buildInvoiceHtml, generateInvoicePdfBuffer } from '@/lib/invoice-pdf';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: invoice } = await admin.from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('id', params.id).eq('company_id', ctx.profile.company_id).maybeSingle();
  if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

  const company = ctx.company;
  const items = invoice.items ?? [];

  const { data: fcfg } = await admin.from('fiscal_config')
    .select('mode, agt_certificado_numero').eq('company_id', ctx.profile.company_id).maybeSingle();

  try {
    const html = await buildInvoiceHtml(invoice, items, company, fcfg);
    const buf = await generateInvoicePdfBuffer(html);
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number.replace(/[^a-zA-Z0-9\-]/g, '_')}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro PDF' }, { status: 500 });
  }
}
