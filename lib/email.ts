import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;

// Resend client — gracefully disabled when key is not configured
export const resend = apiKey ? new Resend(apiKey) : null;

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'FaturaAO <noreply@faturaao.com>';

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
