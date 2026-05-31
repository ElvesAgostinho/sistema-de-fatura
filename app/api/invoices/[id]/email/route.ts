import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { buildInvoiceHtml, generateInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { sendEmail } from '@/lib/email';
import { buildInvoiceEmailHtml } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;

  const body = await req.json().catch(() => ({} as any));
  const customRecipient = typeof body?.email === 'string' ? body.email.trim() : '';

  const { data: invoice } = await admin.from('invoices')
    .select('*, items:invoice_items(*), client:clients(id, name, email)')
    .eq('id', params.id).eq('company_id', companyId).maybeSingle();
  if (!invoice) return NextResponse.json({ error: 'Factura não encontrada' }, { status: 404 });
  if (invoice.status !== 'issued') return NextResponse.json({ error: 'Apenas facturas emitidas podem ser enviadas' }, { status: 400 });

  const clientEmail: string | undefined = customRecipient || invoice.client?.email || undefined;
  if (!clientEmail) return NextResponse.json({ error: 'Cliente não tem email registado. Actualize o cadastro do cliente.' }, { status: 400 });

  const { data: company } = await admin.from('companies').select('*').eq('id', companyId).maybeSingle();
  const { data: fcfg } = await admin.from('fiscal_config')
    .select('mode, agt_certificado_numero').eq('company_id', companyId).maybeSingle();

  try {
    // 1. Build PDF
    const html = await buildInvoiceHtml(invoice, invoice.items ?? [], company, fcfg);
    const pdfBuf = await generateInvoicePdfBuffer(html);
    const pdfBase64 = pdfBuf.toString('base64');
    const filename = `${invoice.invoice_number.replace(/[^a-zA-Z0-9\-]/g, '_')}.pdf`;

    // 2. Build email body
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const invoiceUrl = `${appUrl}/f/${invoice.public_token || invoice.id}`; 
    
    const htmlBody = buildInvoiceEmailHtml({
      companyName: company?.name ?? 'FaturaAO',
      companyNif: company?.nif ?? '',
      companyEmail: company?.email,
      companyAddress: company?.address,
      clientName: invoice.client_name,
      invoiceNumber: invoice.invoice_number,
      documentType: invoice.document_type,
      issuedAt: invoice.issued_at,
      subtotal: new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(invoice.subtotal),
      tax: new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(invoice.tax),
      total: new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(invoice.total),
      status: invoice.status,
      invoiceUrl,
      logoUrl: company?.logo_url,
    });

    const subject = `Factura ${invoice.invoice_number} - ${company?.name ?? 'FaturaAO'}`;

    // 3. Send using Resend client with attachment
    const { resend, FROM_EMAIL } = await import('@/lib/email');
    if (!resend) {
      return NextResponse.json({ error: 'Serviço de email não configurado (RESEND_API_KEY em falta)' }, { status: 500 });
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      subject,
      html: htmlBody,
      replyTo: company?.email ?? undefined,
      attachments: [{
        filename,
        content: pdfBase64,
      }]
    });

    if (error) {
      throw new Error(error.message);
    }

    // 4. Audit log
    await admin.from('audit_logs').insert({
      company_id: companyId,
      user_id: ctx.profile.id,
      action: 'invoice.email_sent',
      entity: 'invoice',
      entity_id: invoice.id,
      details: { recipient: clientEmail, invoice_number: invoice.invoice_number },
    });

    return NextResponse.json({ ok: true, recipient: clientEmail });
  } catch (err: any) {
    console.error('Email send error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro ao enviar email' }, { status: 500 });
  }
}
