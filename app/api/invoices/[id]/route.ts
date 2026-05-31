import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { validateInvoiceHash } from '@/lib/hash';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();

  const { data: invoice, error } = await admin.from('invoices')
    .select('*, items:invoice_items(*), client:clients(*)')
    .eq('id', params.id).eq('company_id', ctx.profile.company_id).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

  const integrityValid = validateInvoiceHash({
    invoice_number: invoice.invoice_number,
    client_nif: invoice.client_nif,
    total: invoice.total,
    issued_at: invoice.issued_at,
    previous_hash: invoice.previous_hash,
    hash: invoice.hash,
  });

  return NextResponse.json({ invoice, integrityValid, company: ctx.company });
}
