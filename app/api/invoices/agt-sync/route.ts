import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { generateJWS } from '@/lib/agt-jws';

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
    const { data: inv } = await admin
      .from('invoices')
      .select('*, items:invoice_items(*), company:companies(nif, name), fiscal_config!inner(chave_privada, agt_username, agt_password)')
      .eq('id', invoice_id)
      .maybeSingle();
    
    if (!inv) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    const config = inv.fiscal_config;
    // Evitar quebra no dev se nao houver chaves AGT
    if (!config?.chave_privada || !config?.agt_username || !config?.agt_password) {
      await admin.from('invoices').update({ agt_status: 'FAILED' }).eq('id', invoice_id);
      return NextResponse.json({ error: 'Credenciais ou Chave Privada da AGT em falta' }, { status: 400 });
    }

    const { data: keyRow } = await admin
      .from('fiscal_keys')
      .select('id, version')
      .eq('company_id', inv.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    const kid = keyRow?.version || `${inv.company.nif}-Key1`;

    // Payload JSON AGT Base
    const payloadObject = {
      cabecalho: {
        tipoDocumento: inv.document_type,
        serie: inv.invoice_number.split('/')[0] || "2026",
        numero: parseInt(inv.invoice_number.split('/')[1] || "1"),
        dataEmissao: new Date(inv.issued_at).toISOString().split('T')[0],
        moeda: "AOA"
      },
      emitente: {
        nif: inv.company.nif,
        nome: inv.company.name
      },
      cliente: {
        nif: inv.client_nif || "999999999",
        nome: inv.client_name || "Consumidor Final"
      },
      linhas: inv.items.map((it: any) => ({
        descricao: it.description,
        quantidade: it.quantity,
        precoUnitario: it.price,
        taxaIVA: it.tax_rate
      })),
      totais: {
        subtotal: inv.subtotal,
        iva: inv.tax,
        total: inv.total
      }
    };

    // Assinar com JWS
    const jws = generateJWS(payloadObject, config.chave_privada, kid);
    const requestBody = { payload: jws };

    const authHeader = 'Basic ' + Buffer.from(`${config.agt_username}:${config.agt_password}`).toString('base64');
    const agtEndpoint = 'https://sifphml.minfin.gov.ao/sigt/fe/v1/registarFactura';
    
    const response = await fetch(agtEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const respJson = await response.json().catch(() => null);

    let status = 'ERROR';
    let agt_status = 'FAILED';
    let error_message = null;
    let requestID = null;

    if (response.ok && respJson?.requestID) {
      status = 'SUCCESS';
      agt_status = 'SYNCING';
      requestID = respJson.requestID;
    } else {
      error_message = respJson?.mensagem || respJson?.error || `HTTP Error ${response.status}`;
    }

    await admin.from('agt_submissions').insert({
      company_id: inv.company_id,
      invoice_id: inv.id,
      request_payload: requestBody,
      response_payload: respJson,
      status,
      error_message
    });

    await admin.from('invoices').update({ 
      agt_status,
      agt_request_id: requestID
    }).eq('id', invoice_id);

    return NextResponse.json({ success: status === 'SUCCESS', agt_status, requestID, error: error_message });
  } catch (err: any) {
    console.error('AGT Sync Error:', err);
    return NextResponse.json({ error: 'Erro interno ao sincronizar com AGT' }, { status: 500 });
  }
}
