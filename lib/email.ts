import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const APP_URL = process.env.NEXTAUTH_URL ?? 'https://rapido.topconsultores.pt';
const APP_NAME = 'FaturaAO';

// Resend client — gracefully disabled when key is not configured
export const resend = apiKey ? new Resend(apiKey) : null;
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${APP_NAME} <noreply@rapido.topconsultores.pt>`;

/**
 * Sends a transactional email. Returns { ok, error }.
 * Never throws — caller decides how to handle failures.
 */
export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not configured — email skipped');
    return { ok: false, error: 'Serviço de email não configurado (adicione RESEND_API_KEY)' };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Erro desconhecido ao enviar email' };
  }
}

// ── HTML Templates ───────────────────────────────────────────────────────────

function baseLayout(title: string, badge: string, badgeColor: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#0f172a;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#0284c7,#0ea5e9);padding:28px 40px;text-align:center;">
    <span style="color:#fff;font-size:22px;font-weight:700;">📄 ${APP_NAME}</span>
    <div style="margin-top:8px;display:inline-block;background:rgba(255,255,255,0.2);border-radius:20px;padding:4px 14px;font-size:12px;color:#e0f2fe;font-weight:600;">${badge}</div>
  </td></tr>
  <tr><td style="padding:36px 40px;color:#f1f5f9;">${content}</td></tr>
  <tr><td style="padding:20px 40px;border-top:1px solid #334155;text-align:center;">
    <p style="margin:0;font-size:12px;color:#64748b;">Sistema de Faturação Electrónica · Angola<br/>
    <a href="${APP_URL}" style="color:#0ea5e9;text-decoration:none;">${APP_URL}</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ── Aprovação ─────────────────────────────────────────────────────────────────
export async function sendApprovalEmail(data: {
  to: string; fullName: string; companyName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const html = baseLayout(
    `Conta Aprovada — ${APP_NAME}`,
    '✅ Conta Aprovada',
    '#22c55e',
    `<div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:12px;">🎉</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f1f5f9;">A sua conta foi aprovada!</h1>
      <p style="margin:0;color:#94a3b8;font-size:14px;">Bem-vindo(a) ao ${APP_NAME}</p>
    </div>
    <p style="color:#cbd5e1;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Olá <strong style="color:#f1f5f9;">${data.fullName || data.to}</strong>,<br/>
      a conta da empresa <strong style="color:#f1f5f9;">${data.companyName}</strong> foi <strong style="color:#4ade80;">aprovada</strong>. Já pode começar a emitir documentos fiscais conformes com a AGT Angola.
    </p>
    <div style="background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.2);border-radius:12px;padding:20px;margin-bottom:28px;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#38bdf8;text-transform:uppercase;letter-spacing:0.5px;">O que pode fazer agora</p>
      <div style="font-size:14px;color:#cbd5e1;line-height:2;">
        📄 Emitir Facturas, Recibos e Notas de Crédito<br/>
        🏪 Usar o POS para vendas rápidas em loja<br/>
        📊 Relatórios e exportação SAF-T para AGT<br/>
        📱 Acesso mobile de qualquer lugar
      </div>
    </div>
    <div style="text-align:center;">
      <a href="${APP_URL}/login" style="display:inline-block;background:linear-gradient(135deg,#0284c7,#0ea5e9);color:#fff;text-decoration:none;padding:14px 40px;border-radius:10px;font-weight:600;font-size:15px;">Entrar no Sistema →</a>
    </div>`
  );
  return sendEmail({ to: data.to, subject: `✅ Conta aprovada — ${APP_NAME}`, html });
}

// ── Rejeição ──────────────────────────────────────────────────────────────────
export async function sendRejectionEmail(data: {
  to: string; fullName: string; companyName: string; reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  const html = baseLayout(
    `Pedido Não Aprovado — ${APP_NAME}`,
    '❌ Pedido Não Aprovado',
    '#ef4444',
    `<div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:12px;">😔</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f1f5f9;">Pedido não aprovado</h1>
      <p style="margin:0;color:#94a3b8;font-size:14px;">Revisão necessária antes de continuar</p>
    </div>
    <p style="color:#cbd5e1;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Olá <strong style="color:#f1f5f9;">${data.fullName || data.to}</strong>,<br/>
      o pedido de registo da empresa <strong style="color:#f1f5f9;">${data.companyName}</strong> não foi aprovado pela administração.
    </p>
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:20px;margin-bottom:28px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#f87171;text-transform:uppercase;letter-spacing:0.5px;">Motivo da rejeição</p>
      <p style="margin:0;font-size:14px;color:#fca5a5;line-height:1.6;">${data.reason}</p>
    </div>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Se acreditar que houve um engano ou se corrigiu os dados, pode submeter um novo pedido.
    </p>
    <div style="text-align:center;">
      <a href="${APP_URL}/register" style="display:inline-block;background:#1e293b;border:1px solid #475569;color:#f1f5f9;text-decoration:none;padding:14px 40px;border-radius:10px;font-weight:600;font-size:15px;">Tentar novamente</a>
    </div>`
  );
  return sendEmail({ to: data.to, subject: `❌ Pedido não aprovado — ${APP_NAME}`, html });
}

// ── Pendente (confirmação de registo) ─────────────────────────────────────────
export async function sendPendingConfirmationEmail(data: {
  to: string; fullName: string; companyName: string; nif: string;
}): Promise<{ ok: boolean; error?: string }> {
  const html = baseLayout(
    `Pedido Recebido — ${APP_NAME}`,
    '⏳ A Aguardar Aprovação',
    '#f59e0b',
    `<div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:12px;">📬</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f1f5f9;">Pedido recebido!</h1>
      <p style="margin:0;color:#94a3b8;font-size:14px;">A aguardar aprovação pela administração</p>
    </div>
    <p style="color:#cbd5e1;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Olá <strong style="color:#f1f5f9;">${data.fullName}</strong>,<br/>
      recebemos o pedido de registo para a empresa <strong style="color:#f1f5f9;">${data.companyName}</strong> (NIF: <code style="background:#0f172a;padding:2px 6px;border-radius:4px;font-size:13px;">${data.nif}</code>).
    </p>
    <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#fbbf24;text-transform:uppercase;letter-spacing:0.5px;">Próximos passos</p>
      <div style="font-size:14px;color:#cbd5e1;line-height:2.2;">
        <span style="color:#fbbf24;">1.</span> A nossa equipa vai verificar os seus dados (normalmente em 24–48h)<br/>
        <span style="color:#fbbf24;">2.</span> Receberá um email de confirmação assim que for aprovado<br/>
        <span style="color:#fbbf24;">3.</span> Após aprovação, pode entrar e começar a faturar
      </div>
    </div>
    <p style="color:#64748b;font-size:12px;text-align:center;margin:0;">Não solicitou este registo? Pode ignorar este email.</p>`
  );
  return sendEmail({ to: data.to, subject: `⏳ Pedido recebido — ${APP_NAME}`, html });
}
