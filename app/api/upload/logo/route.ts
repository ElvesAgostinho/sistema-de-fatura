import { NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { generatePresignedUploadUrl, getFileUrl } from '@/lib/s3';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { fileName, contentType } = body ?? {};
    if (!fileName || !contentType) return NextResponse.json({ error: 'fileName e contentType obrigatórios' }, { status: 400 });
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(fileName, contentType, true);
    const publicUrl = await getFileUrl(cloud_storage_path, true);
    return NextResponse.json({ uploadUrl, cloud_storage_path, publicUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro upload' }, { status: 500 });
  }
}
