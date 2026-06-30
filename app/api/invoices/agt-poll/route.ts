import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = createAdminClient();
    
    // 1. Encontrar todas as faturas que estão a aguardar resposta da AGT
    const { data: pendingInvoices } = await admin
      .from('invoices')
      .select('id, agt_request_id, company_id, invoice_number')
      .eq('agt_status', 'SYNCING')
      .not('agt_request_id', 'is', null);

    if (!pendingInvoices || pendingInvoices.length === 0) {
      return NextResponse.json({ message: 'Nenhuma submissão pendente.' });
    }

    // 2. Agrupar por empresa para não estar sempre a pedir a mesma credencial
    const companyIds = Array.from(new Set(pendingInvoices.map(i => i.company_id)));
    const { data: configs } = await admin
      .from('fiscal_config')
      .select('company_id, agt_username, agt_password')
      .in('company_id', companyIds);
      
    const configMap = new Map((configs || []).map(c => [c.company_id, c]));
    
    const results = [];

    // 3. Consultar a AGT para cada documento pendente
    for (const inv of pendingInvoices) {
      const config = configMap.get(inv.company_id);
      
      if (!config || !config.agt_username || !config.agt_password) {
        results.push({ invoice: inv.invoice_number, status: 'SKIPPED', reason: 'Credenciais AGT em falta' });
        continue;
      }

      const authHeader = 'Basic ' + Buffer.from(`${config.agt_username}:${config.agt_password}`).toString('base64');
      const agtStatusEndpoint = `https://sifphml.minfin.gov.ao/sigt/fe/v1/consultarEstado/${inv.agt_request_id}`;

      try {
        const response = await fetch(agtStatusEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        });

        const respJson = await response.json().catch(() => null);

        if (response.ok && respJson) {
          // O estado pode variar conforme a AGT: VALIDADO, REJEITADO, PROCESSANDO
          const estadoAGT = respJson.estado?.toUpperCase();
          
          if (estadoAGT === 'VALIDADO' || estadoAGT === 'ACEITE') {
            await admin.from('invoices').update({ agt_status: 'SYNCED' }).eq('id', inv.id);
            results.push({ invoice: inv.invoice_number, status: 'SYNCED' });
          } else if (estadoAGT === 'REJEITADO' || estadoAGT === 'ERRO') {
            const erroMsg = respJson.erro || respJson.mensagem || 'Rejeitado pela AGT';
            
            await admin.from('invoices').update({ agt_status: 'FAILED' }).eq('id', inv.id);
            
            await admin.from('agt_submissions').insert({
              company_id: inv.company_id,
              invoice_id: inv.id,
              request_payload: { endpoint: agtStatusEndpoint, action: 'POLL_STATUS' },
              response_payload: respJson,
              status: 'ERROR',
              error_message: erroMsg
            });
            
            results.push({ invoice: inv.invoice_number, status: 'FAILED', reason: erroMsg });
          } else {
            // Ainda a processar, não fazer nada
            results.push({ invoice: inv.invoice_number, status: 'PENDING' });
          }
        } else {
          results.push({ invoice: inv.invoice_number, status: 'ERROR', reason: `HTTP ${response.status}` });
        }
      } catch (err: any) {
        results.push({ invoice: inv.invoice_number, status: 'ERROR', reason: err.message });
      }
    }

    return NextResponse.json({ message: 'Polling concluído', results });
  } catch (err: any) {
    console.error('AGT Poll Error:', err);
    return NextResponse.json({ error: 'Erro interno ao consultar AGT' }, { status: 500 });
  }
}
