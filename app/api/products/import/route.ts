import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { parseBuffer, pick, pickNumber, type ParsedRow } from '@/lib/import-parser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type ImportResult = {
  format: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; name: string | null; reason: string }[];
};

// POST /api/products/import
// Body: multipart/form-data with `file` field. Supports CSV, XLSX, XLS, XML.
// Optional query: ?upsert=true (default) — updates existing products by name.
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role !== 'admin') return NextResponse.json({ error: 'Apenas administradores podem importar produtos' }, { status: 403 });

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

  const { data: existing } = await admin
    .from('products')
    .select('id, name')
    .eq('company_id', ctx.profile.company_id);
  const existingByName = new Map<string, string>(
    (existing ?? []).map((p) => [String(p.name).trim().toLowerCase(), p.id])
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
    const rowNumber = i + 2;

    const name = pick(row, ['name', 'nome', 'designacao', 'designação', 'descricao_curta', 'produto', 'product_name', 'artigo']);
    const description = pick(row, ['description', 'descricao', 'descrição', 'detalhes', 'observacoes']);
    const price = pickNumber(row, ['price', 'preco', 'preço', 'valor', 'unit_price', 'preco_unitario', 'pvp']);
    const taxRate = pickNumber(row, ['tax_rate', 'iva', 'taxa_iva', 'vat', 'tax']);
    const rawType = pick(row, ['type', 'tipo', 'product_type', 'tipo_produto']) ?? 'P';
    const productType = rawType.trim().toUpperCase().startsWith('S') ? 'S' : 'P';

    if (!name) {
      result.errors.push({ row: rowNumber, name: null, reason: 'Nome em falta' });
      result.skipped++;
      continue;
    }
    if (price == null || price < 0) {
      result.errors.push({ row: rowNumber, name, reason: 'Preço em falta ou inválido' });
      result.skipped++;
      continue;
    }
    // Default VAT 14% (Angola) if not supplied
    const finalTaxRate = taxRate == null ? 14 : taxRate;
    if (finalTaxRate < 0 || finalTaxRate > 100) {
      result.errors.push({ row: rowNumber, name, reason: 'Taxa de IVA fora do intervalo 0–100' });
      result.skipped++;
      continue;
    }

    const nameKey = name.trim().toLowerCase();
    const existingId = existingByName.get(nameKey);

    if (existingId) {
      if (!upsert) {
        result.skipped++;
        continue;
      }
      const { error } = await admin
        .from('products')
        .update({ description, price, tax_rate: finalTaxRate, product_type: productType })
        .eq('id', existingId)
        .eq('company_id', ctx.profile.company_id);
      if (error) {
        result.errors.push({ row: rowNumber, name, reason: error.message });
        result.skipped++;
      } else {
        result.updated++;
      }
    } else {
      const { data: ins, error } = await admin
        .from('products')
        .insert({ company_id: ctx.profile.company_id, name, description, price, tax_rate: finalTaxRate, product_type: productType })
        .select('id')
        .single();
      if (error) {
        result.errors.push({ row: rowNumber, name, reason: error.message });
        result.skipped++;
      } else if (ins) {
        existingByName.set(nameKey, ins.id);
        result.created++;
      }
    }
  }

  await admin.from('audit_logs').insert({
    user_id: ctx.profile.id,
    company_id: ctx.profile.company_id,
    action: 'products.imported',
    entity: 'product',
    details: {
      filename: file.name,
      ...result,
      errors: result.errors.slice(0, 20),
    },
  });

  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({ error: 'Método não suportado. Use POST com multipart/form-data.' }, { status: 405 });
}
