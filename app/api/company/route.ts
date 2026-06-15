import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ company: ctx.company });
}

export async function PUT(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem alterar definições da empresa' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const {
      name, address, phone, email, city, postal_code, business_name,
      // Bank details
      bank_name,
      bank_account,
      bank_iban,
      // Branding da fatura
      logo_url,
      logo_position,
      logo_size,
      invoice_primary_color,
      invoice_header_bg,
      invoice_show_watermark,
      invoice_footer_text,
    } = body ?? {};

    // Validações de branding
    const VALID_POSITIONS = ['top-left', 'top-center', 'top-right', 'watermark'];
    const VALID_SIZES     = ['small', 'medium', 'large'];
    if (logo_position && !VALID_POSITIONS.includes(logo_position)) {
      return NextResponse.json({ error: `Posição inválida. Use: ${VALID_POSITIONS.join(', ')}` }, { status: 400 });
    }
    if (logo_size && !VALID_SIZES.includes(logo_size)) {
      return NextResponse.json({ error: `Tamanho inválido. Use: ${VALID_SIZES.join(', ')}` }, { status: 400 });
    }
    if (invoice_primary_color && !/^#[0-9A-Fa-f]{6}$/.test(invoice_primary_color)) {
      return NextResponse.json({ error: 'Cor primária inválida. Use formato hexadecimal: #RRGGBB' }, { status: 400 });
    }
    if (invoice_header_bg && !/^#[0-9A-Fa-f]{6}$/.test(invoice_header_bg)) {
      return NextResponse.json({ error: 'Cor de fundo inválida. Use formato hexadecimal: #RRGGBB' }, { status: 400 });
    }

    const admin = createAdminClient();
    const update: any = {};
    if (name !== undefined)                 update.name = name;
    if (address !== undefined)              update.address = address;
    if (phone !== undefined)                update.phone = phone;
    if (email !== undefined)                update.email = email;
    if (city !== undefined)                 update.city = city;
    if (postal_code !== undefined)          update.postal_code = postal_code;
    if (business_name !== undefined)        update.business_name = business_name;
    if (bank_name !== undefined)            update.bank_name = bank_name;
    if (bank_account !== undefined)         update.bank_account = bank_account;
    if (bank_iban !== undefined)            update.bank_iban = bank_iban;
    if (logo_url !== undefined)             update.logo_url = logo_url;
    if (logo_position !== undefined)        update.logo_position = logo_position;
    if (logo_size !== undefined)            update.logo_size = logo_size;
    if (invoice_primary_color !== undefined) update.invoice_primary_color = invoice_primary_color;
    if (invoice_header_bg !== undefined)    update.invoice_header_bg = invoice_header_bg;
    if (invoice_show_watermark !== undefined) update.invoice_show_watermark = Boolean(invoice_show_watermark);
    if (invoice_footer_text !== undefined)  update.invoice_footer_text = invoice_footer_text;

    const { data, error } = await admin
      .from('companies')
      .update(update)
      .eq('id', ctx.profile.company_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await admin.from('audit_logs').insert({
      user_id:    ctx.user.id,
      company_id: ctx.profile.company_id,
      action:     'company.update',
      entity:     'company',
      entity_id:  ctx.profile.company_id,
      details:    update,
    });

    return NextResponse.json({ company: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}
