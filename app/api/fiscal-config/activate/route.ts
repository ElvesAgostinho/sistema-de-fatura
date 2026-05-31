import { NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { activateCertifiedMode } from '@/lib/fiscal-config';

export const dynamic = 'force-dynamic';

/**
 * Protected endpoint that actually flips the system into certified mode.
 * Requires:
 *   - authenticated admin
 *   - explicit confirmation phrase in the request body: { confirmation: "CERTIFICAR" }
 *   - all validation checks pass
 */
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isSuperAdmin = ctx.profile.email === 'elvessacapuri57@gmail.com';
  if (ctx.profile.role !== 'admin' && !isSuperAdmin) {
    return NextResponse.json({ error: 'Apenas administradores podem ativar o modo certificado' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const confirmation = typeof body?.confirmation === 'string' ? body.confirmation : '';

  const result = await activateCertifiedMode({
    companyId: ctx.profile.company_id,
    actorUserId: ctx.user.id,
    confirmation,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.errors.join(' · '), errors: result.errors }, { status: 400 });
  }

  return NextResponse.json({
    config: { ...result.config, chave_privada: null, has_private_key: true, has_public_key: Boolean(result.config.chave_publica) },
    message: `Sistema certificado ativado com sucesso. Certificado nº ${result.config.agt_certificado_numero}`,
  });
}
