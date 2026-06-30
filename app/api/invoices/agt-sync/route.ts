import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id obrigatório' }, { status: 400 });
    }

    const admin = createAdminClient();
    
    // Marcar como 'SYNCING'
    await admin.from('invoices').update({ agt_status: 'SYNCING' }).eq('id', invoice_id);

    // Buscar fatura para construir payload
    const { data: inv } = await admin.from('invoices').select('*, company:companies(nif, name)').eq('id', invoice_id).maybeSingle();
    
    if (!inv) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    // Mock do Payload para AGT
    const payload = {
      TaxRegistrationNumber: inv.company?.nif,
      InvoiceNo: inv.invoice_number,
      InvoiceDate: inv.issued_at,
      Hash: inv.hash,
      GrossTotal: inv.total,
    };

    // Simulando tempo de resposta da API da AGT
    await new Promise(r => setTimeout(r, 1000));

    // Simular que 5% das vezes falha (para testes)
    const isSuccess = Math.random() > 0.05;
    
    const status = isSuccess ? 'SUCCESS' : 'ERROR';
    const agt_status = isSuccess ? 'SYNCED' : 'FAILED';
    const error_message = isSuccess ? null : 'A conexão ao WebService da AGT expirou (Timeout).';
    const responsePayload = isSuccess ? { code: 200, message: 'Documento recebido e validado com sucesso pela AGT.' } : null;

    // Registar submissão
    await admin.from('agt_submissions').insert({
      company_id: inv.company_id,
      invoice_id: inv.id,
      request_payload: payload,
      response_payload: responsePayload,
      status,
      error_message
    });

    // Atualizar estado final na fatura
    await admin.from('invoices').update({ agt_status }).eq('id', invoice_id);

    return NextResponse.json({ success: isSuccess, agt_status, error: error_message });
  } catch (err: any) {
    console.error('AGT Sync Error:', err);
    return NextResponse.json({ error: 'Erro interno ao sincronizar com AGT' }, { status: 500 });
  }
}
