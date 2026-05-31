import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { parseBuffer, pick, type ParsedRow } from '@/lib/import-parser';
import { isValidNIF } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type ImportResult = {
  format: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; nif: string | null; reason: string }[];
};

// POST /api/clients/import
// Body: multipart/form-data with `file` field. Supports CSV, XLSX, XLS, XML.
// Optional query: ?upsert=true (default) — updates existing clients by NIF. false → skip duplicates.
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role !== 'admin') return NextResponse.json({ error: 'Apenas administradores podem importar clientes' }, { status: 403 });

  const url = new URL(req.url);
  const upsert = url.searchParams.get('upsert') !== 'false';

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Formato de pedido inválido (esperado multipart/form-data)' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Ficheiro em falta no campo "file"' }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: 'Ficheiro vazio' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Ficheiro demasiado grande (máximo 10 MB)' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = parseBuffer(file.name, buf);
  } catch (e: any) {
    return NextResponse.json({ error: `Falha a interpretar o ficheiro: ${e?.message ?? 'erro desconhecido'}` }, { status: 400 });
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: 'Nenhuma linha encontrada no ficheiro' }, { status: 400 });
  }
  if (parsed.rows.length > 5000) {
    return NextResponse.json({ error: 'Máximo 5000 linhas por importação' }, { status: 400 });
  }

  const admin = createAdminClient();
  // Load existing clients once to detect duplicates by NIF (case-insensitive)
  const { data: existing } = await admin
    .from('clients')
    .select('id, nif')
    .eq('company_id', ctx.profile.company_id);
  const existingByNif = new Map<string, string>(
    (existing ?? []).map((c) => [String(c.nif).trim().toLowerCase(), c.id])
  );

  const result: ImportResult = {
    format: parsed.format,
    totalRows: parsed.rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < parsed.rows.length; i++) {
    const row: ParsedRow = parsed.rows[i];
    const rowNumber = i + 2; // +1 for 0-index, +1 for header row

    const name = pick(row, ['name', 'nome', 'cliente', 'customer', 'client_name', 'razao_social', 'designacao']);
    const nif = pick(row, ['nif', 'tax_id', 'vat', 'contribuinte', 'n_contribuinte', 'numero_contribuinte']);
    const address = pick(row, ['address', 'morada', 'endereco', 'endereço']);
    const phone = pick(row, ['phone', 'telefone', 'tel', 'telemovel', 'mobile', 'contacto']);
    const email = pick(row, ['email', 'e_mail', 'correio_electronico']);

    if (!name) {
      result.errors.push({ row: rowNumber, nif, reason: 'Nome em falta' });
      result.skipped++;
      continue;
    }
    if (!nif) {
      result.errors.push({ row: rowNumber, nif: null, reason: 'NIF em falta' });
      result.skipped++;
      continue;
    }
    if (!isValidNIF(nif)) {
      result.errors.push({ row: rowNumber, nif, reason: 'NIF inválido' });
      result.skipped++;
      continue;
    }

    const nifKey = nif.trim().toLowerCase();
    const existingId = existingByNif.get(nifKey);

    if (existingId) {
      if (!upsert) {
        result.skipped++;
        continue;
      }
      const { error } = await admin
        .from('clients')
        .update({ name, address, phone, email })
        .eq('id', existingId)
        .eq('company_id', ctx.profile.company_id);
      if (error) {
        result.errors.push({ row: rowNumber, nif, reason: error.message });
        result.skipped++;
      } else {
        result.updated++;
      }
    } else {
      const { data: ins, error } = await admin
        .from('clients')
        .insert({ company_id: ctx.profile.company_id, name, nif, address, phone, email })
        .select('id')
        .single();
      if (error) {
        result.errors.push({ row: rowNumber, nif, reason: error.message });
        result.skipped++;
      } else if (ins) {
        existingByNif.set(nifKey, ins.id);
        result.created++;
      }
    }
  }

  await admin.from('audit_logs').insert({
    user_id: ctx.profile.id,
    company_id: ctx.profile.company_id,
    action: 'clients.imported',
    entity: 'client',
    details: {
      filename: file.name,
      ...result,
      // Persist only the first 20 errors to keep the log compact
      errors: result.errors.slice(0, 20),
    },
  });

  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({ error: 'Método não suportado. Use POST com multipart/form-data.' }, { status: 405 });
}
