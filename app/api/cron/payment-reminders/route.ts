import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { buildPaymentReminderHtml } from '@/lib/email-templates';

// This endpoint should be triggered by n8n or Vercel Cron daily.
// It finds unpaid invoices that are X days overdue and sends a reminder.

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Use a secret key in header or query param for security in production
  const url = new URL(req.url);
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && url.searchParams.get('key') !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Find issued invoices that are not paid
  const { data: invoices, error } = await admin
    .from('invoices')
    .select('*, client:clients(id, name, email), company:companies(name, email)')
    .eq('status', 'issued')
    .neq('payment_status', 'pago');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoices || invoices.length === 0) return NextResponse.json({ ok: true, sent: 0, message: 'Sem facturas em dívida' });

  const now = new Date().getTime();
  let sentCount = 0;
  const results = [];

  for (const inv of invoices) {
    // Only send if client has email
    if (!inv.client?.email) continue;

    const issuedAt = new Date(inv.issued_at).getTime();
    const daysOverdue = Math.floor((now - issuedAt) / (1000 * 60 * 60 * 24));

    // Remind at 15 days, 30 days, 45 days, 60+ days (every 15 days)
    if (daysOverdue > 0 && daysOverdue % 15 === 0) {
      const debt = Number(inv.total) - Number(inv.amount_paid || 0);
      if (debt <= 0) continue;

      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const invoiceUrl = `${appUrl}/f/${inv.public_token || inv.id}`;
      
      const htmlBody = buildPaymentReminderHtml({
        companyName: inv.company?.name || 'FaturaAO',
        clientName: inv.client.name,
        invoiceNumber: inv.invoice_number,
        issuedAt: inv.issued_at,
        total: new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(inv.total),
        amountDue: new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(debt),
        daysOverdue,
        invoiceUrl
      });

      const { resend, FROM_EMAIL } = await import('@/lib/email');
      if (resend) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: [inv.client.email],
          subject: `Lembrete: Fatura ${inv.invoice_number} em atraso`,
          html: htmlBody,
          replyTo: inv.company?.email
        });

        // Log
        await admin.from('audit_logs').insert({
          company_id: inv.company_id,
          action: 'invoice.reminder_sent',
          entity: 'invoice',
          entity_id: inv.id,
          details: { daysOverdue, debt, recipient: inv.client.email }
        });

        sentCount++;
        results.push(`Enviado ${inv.invoice_number} para ${inv.client.email}`);
      }
    }
  }

  return NextResponse.json({ ok: true, sent: sentCount, results });
}
