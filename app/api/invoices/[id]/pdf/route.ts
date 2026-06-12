import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { buildInvoiceHtml, generateInvoicePdfBuffer } from '@/lib/invoice-pdf';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const viaParam = searchParams.get('via');
  const viaLabel = viaParam === '2' ? '2ª Via em conformidade com o original' : 'Original';
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: invoice } = await admin.from('invoices')
    .select('*, items:invoice_items(*), client:clients(id, name, email, phone, address, nif)')
    .eq('id', params.id).eq('company_id', ctx.profile.company_id).maybeSingle();
  if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

  // Enrich invoice with client details for PDF
  const enriched = {
    ...invoice,
    client_email:   invoice.client_email   || invoice.client?.email   || null,
    client_phone:   invoice.client_phone   || invoice.client?.phone   || null,
    client_address: invoice.client_address || invoice.client?.address || null,
  };

  const company = ctx.company;
  const items = invoice.items ?? [];

  const { data: fcfg } = await admin.from('fiscal_config')
    .select('mode, agt_certificado_numero').eq('company_id', ctx.profile.company_id).maybeSingle();

  try {
    const html = await buildInvoiceHtml(enriched, items, company, fcfg, viaLabel);
    const buf = await generateInvoicePdfBuffer(html);
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${enriched.invoice_number.replace(/[^a-zA-Z0-9\-]/g, '_')}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro PDF' }, { status: 500 });
  }
}
