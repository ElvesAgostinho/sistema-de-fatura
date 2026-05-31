/**
 * Professional HTML email template for invoice delivery.
 * Renders a clean, branded email with invoice summary and PDF download link.
 */
export function buildInvoiceEmailHtml(params: {
  companyName: string;
  companyNif: string;
  companyEmail?: string | null;
  companyAddress?: string | null;
  clientName: string;
  invoiceNumber: string;
  documentType: string;
  issuedAt: string;
  subtotal: string;
  tax: string;
  total: string;
  status: string;
  invoiceUrl: string; // public link or app link
  logoUrl?: string | null;
}): string {
  const docTypeLabels: Record<string, string> = {
    FT: 'Fatura', FR: 'Fatura-Recibo', NC: 'Nota de Crédito',
    ND: 'Nota de Débito', RC: 'Recibo',
  };
  const docLabel = docTypeLabels[params.documentType] ?? params.documentType;
  const year = new Date(params.issuedAt).getFullYear();

  return `<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${docLabel} ${params.invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#0a3d62 0%,#1a6891 100%);padding:32px 40px;">
            <table role="presentation" width="100%">
              <tr>
                <td>
                  ${params.logoUrl ? `<img src="${params.logoUrl}" alt="${params.companyName}" style="max-height:48px;margin-bottom:12px;display:block;"/>` : ''}
                  <div style="color:#ffffff;font-size:20px;font-weight:700;">${params.companyName}</div>
                  <div style="color:#a8d4f0;font-size:13px;margin-top:2px;">NIF: ${params.companyNif}</div>
                </td>
                <td align="right">
                  <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:12px 20px;text-align:center;">
                    <div style="color:#a8d4f0;font-size:11px;text-transform:uppercase;letter-spacing:1px;">${docLabel}</div>
                    <div style="color:#ffffff;font-size:18px;font-weight:700;font-family:monospace;margin-top:4px;">${params.invoiceNumber}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- GREETING -->
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0;font-size:16px;font-weight:600;color:#1a1a2e;">Olá, ${params.clientName},</p>
            <p style="margin:12px 0 0;font-size:14px;color:#5a5a7a;line-height:1.6;">
              Segue em anexo o documento fiscal <strong>${params.invoiceNumber}</strong> emitido por <strong>${params.companyName}</strong>.
              Por favor, guarde este documento para os seus registos.
            </p>
          </td>
        </tr>

        <!-- INVOICE SUMMARY -->
        <tr>
          <td style="padding:24px 40px;">
            <table role="presentation" width="100%" style="background:#f8f9ff;border-radius:8px;overflow:hidden;border:1px solid #e8eaf6;">
              <tr style="background:#e8eaf6;">
                <td colspan="2" style="padding:12px 20px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#5a5a7a;">
                  Resumo do documento
                </td>
              </tr>
              <tr>
                <td style="padding:10px 20px;font-size:13px;color:#5a5a7a;border-bottom:1px solid #e8eaf6;">Número</td>
                <td style="padding:10px 20px;font-size:13px;font-weight:600;font-family:monospace;text-align:right;border-bottom:1px solid #e8eaf6;">${params.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding:10px 20px;font-size:13px;color:#5a5a7a;border-bottom:1px solid #e8eaf6;">Data de emissão</td>
                <td style="padding:10px 20px;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #e8eaf6;">${new Date(params.issuedAt).toLocaleDateString('pt-PT')}</td>
              </tr>
              <tr>
                <td style="padding:10px 20px;font-size:13px;color:#5a5a7a;border-bottom:1px solid #e8eaf6;">Subtotal</td>
                <td style="padding:10px 20px;font-size:13px;font-family:monospace;text-align:right;border-bottom:1px solid #e8eaf6;">${params.subtotal}</td>
              </tr>
              <tr>
                <td style="padding:10px 20px;font-size:13px;color:#5a5a7a;border-bottom:1px solid #e8eaf6;">IVA</td>
                <td style="padding:10px 20px;font-size:13px;font-family:monospace;text-align:right;border-bottom:1px solid #e8eaf6;">${params.tax}</td>
              </tr>
              <tr style="background:#0a3d62;">
                <td style="padding:14px 20px;font-size:15px;font-weight:700;color:#ffffff;">TOTAL (AOA)</td>
                <td style="padding:14px 20px;font-size:15px;font-weight:700;font-family:monospace;color:#ffffff;text-align:right;">${params.total}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA BUTTON -->
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            <a href="${params.invoiceUrl}" style="display:inline-block;background:linear-gradient(135deg,#0a3d62,#1a6891);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;">
              Ver / Descarregar Documento
            </a>
            <p style="margin:16px 0 0;font-size:12px;color:#9a9ab0;">
              Se o botão não funcionar, copie e cole este link no seu browser:<br/>
              <a href="${params.invoiceUrl}" style="color:#1a6891;">${params.invoiceUrl}</a>
            </p>
          </td>
        </tr>

        <!-- COMPLIANCE NOTE -->
        <tr>
          <td style="padding:16px 40px;background:#f8f9ff;border-top:1px solid #e8eaf6;">
            <p style="margin:0;font-size:11px;color:#9a9ab0;line-height:1.5;text-align:center;">
              Este documento foi gerado eletronicamente por <strong>FaturaAO</strong> e é válido sem assinatura manual.<br/>
              Os seus dados estão protegidos por hash SHA-256 encadeado em conformidade com a AGT Angola.
            </p>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#b0b0c0;">
              © ${year} ${params.companyName} · Processado por FaturaAO<br/>
              ${params.companyAddress ? `${params.companyAddress}<br/>` : ''}
              ${params.companyEmail ? `<a href="mailto:${params.companyEmail}" style="color:#1a6891;">${params.companyEmail}</a>` : ''}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Payment reminder email template
 */
export function buildPaymentReminderHtml(params: {
  companyName: string;
  clientName: string;
  invoiceNumber: string;
  issuedAt: string;
  total: string;
  amountDue: string;
  daysOverdue: number;
  invoiceUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-AO">
<head><meta charset="utf-8"/><title>Lembrete de Pagamento</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#b91c1c,#dc2626);padding:28px 40px;text-align:center;">
            <div style="color:#ffffff;font-size:18px;font-weight:700;">${params.companyName}</div>
            <div style="color:#fca5a5;font-size:13px;margin-top:4px;">Lembrete de pagamento em atraso</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 16px;font-size:16px;font-weight:600;">Olá, ${params.clientName},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#5a5a7a;line-height:1.6;">
              Gostaríamos de lembrá-lo(a) que a fatura <strong>${params.invoiceNumber}</strong> emitida em 
              <strong>${new Date(params.issuedAt).toLocaleDateString('pt-PT')}</strong> encontra-se por liquidar 
              há <strong style="color:#dc2626;">${params.daysOverdue} dia(s)</strong>.
            </p>
            <table role="presentation" width="100%" style="background:#fff5f5;border-radius:8px;border:2px solid #fca5a5;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:13px;color:#5a5a7a;">Fatura: <strong>${params.invoiceNumber}</strong></div>
                <div style="font-size:13px;color:#5a5a7a;margin-top:4px;">Total da fatura: <strong style="font-family:monospace;">${params.total}</strong></div>
                <div style="font-size:15px;font-weight:700;color:#dc2626;margin-top:8px;">Valor em dívida: <span style="font-family:monospace;">${params.amountDue}</span></div>
              </td></tr>
            </table>
            <p style="margin:0 0 24px;font-size:13px;color:#5a5a7a;">Se já realizou o pagamento, por favor ignore este email. Caso contrário, agradecemos que proceda à liquidação o mais breve possível.</p>
            <a href="${params.invoiceUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">Ver fatura</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px;background:#f8f9ff;border-top:1px solid #e8eaf6;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9a9ab0;">Este é um lembrete automático enviado por FaturaAO. Para dúvidas, contacte ${params.companyName}.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
