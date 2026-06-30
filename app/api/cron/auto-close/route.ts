import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Autenticação simples para o Cron job (ex: cron-secret no header ou query)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    // 1. Procurar todas as sessões de POS que ficaram abertas
    const { data: openSessions, error: findError } = await admin
      .from('pos_sessions')
      .select('id, company_id')
      .eq('status', 'OPEN');

    if (findError) throw findError;

    let closedCount = 0;

    // 2. Fechar as sessões assumindo "fecho cego perfeito" (closing_balance = expected)
    if (openSessions && openSessions.length > 0) {
      for (const session of openSessions) {
        // Chamada direta RPC do supabase se existir (increment_pos_session) ou manual
        await admin.from('pos_sessions').update({
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
          notes: 'Fecho Automático do Sistema (Cron)'
        }).eq('id', session.id);
        
        closedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cron executado. Sessões encerradas: ${closedCount}` 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
