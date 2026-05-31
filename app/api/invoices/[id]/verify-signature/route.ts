import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { getFiscalConfig } from '@/lib/fiscal-config';
import { buildInvoiceSignaturePayload, verifyWithPublicKey } from '@/lib/crypto-keys';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invoices/[id]/verify-signature
 *
 * Verifies the RSA-SHA256 signature stored with the invoice against the
 * canonical payload rebuilt from the immutable invoice fields.
 *
 * Key resolution strategy:
 *  1. If invoice.signature_key_id is set, use the archived public key from
 *     fiscal_keys (this is the key actually used at emission).
 *  2. Otherwise, fall back to the current public key in fiscal_config (legacy).
 *
 * Returns:
 *   { signed, valid, reason?, keySource: 'archived'|'current' }
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: invoice, error } = await admin
    .from('invoices')
    .select('id, invoice_number, issued_at, total, previous_hash, signature, signature_key_id, company_id')
    .eq('id', params.id)
    .eq('company_id', ctx.profile.company_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

  if (!invoice.signature) {
    return NextResponse.json({ signed: false, valid: false, reason: 'Fatura emitida sem assinatura digital (chaves ainda não configuradas nessa altura).' });
  }

  // Prefer the exact key used at emission (archived in fiscal_keys).
  let publicKey: string | null = null;
  let keySource: 'archived' | 'current' = 'current';
  if (invoice.signature_key_id) {
    const { data: keyRow } = await admin
      .from('fiscal_keys')
      .select('public_key')
      .eq('id', invoice.signature_key_id)
      .eq('company_id', invoice.company_id)
      .maybeSingle();
    if (keyRow?.public_key) {
      publicKey = keyRow.public_key;
      keySource = 'archived';
    }
  }

  if (!publicKey) {
    const fcfg = await getFiscalConfig(invoice.company_id);
    publicKey = fcfg?.chave_publica ?? null;
  }

  if (!publicKey) {
    return NextResponse.json({ signed: true, valid: false, reason: 'Chave pública não encontrada — impossível verificar.', keySource });
  }

  const payload = buildInvoiceSignaturePayload({
    invoice_number: invoice.invoice_number,
    issued_at: invoice.issued_at,
    total: invoice.total,
    previous_hash: invoice.previous_hash,
  });

  const valid = verifyWithPublicKey(publicKey, payload, invoice.signature);
  return NextResponse.json({
    signed: true,
    valid,
    keySource,
    reason: valid
      ? undefined
      : (keySource === 'archived'
        ? 'Assinatura inválida — os dados da fatura foram alterados ou a chave arquivada está corrompida.'
        : 'Assinatura inválida — os dados foram alterados, ou a chave pública atual já não corresponde à usada na emissão (regeneração sem histórico).'),
  });
}
