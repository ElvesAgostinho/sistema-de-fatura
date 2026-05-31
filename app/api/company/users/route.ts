import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('id, email, full_name, role, created_at')
    .eq('company_id', ctx.profile.company_id)
    .order('created_at', { ascending: false });

  if (error) return ApiResponse.error(error.message, 500);

  return ApiResponse.success({ users: data });
}

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile || ctx.profile.role !== 'admin') return ApiResponse.unauthorized();

  try {
    const { email, password, role } = await req.json();
    if (!email) return ApiResponse.error('Email obrigatório');

    const admin = createAdminClient();
    
    let inviteData, inviteError;
    
    if (password) {
      // Create user directly with the provided password
      const res = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          company_id: ctx.profile.company_id,
          role: role || 'caixa',
        }
      });
      inviteData = res.data;
      inviteError = res.error;
    } else {
      // Send invite email (fallback)
      const res = await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          company_id: ctx.profile.company_id,
          role: role || 'caixa',
        }
      });
      inviteData = res.data;
      inviteError = res.error;
    }

    if (inviteError) {
      if (inviteError.message.includes('already exists')) {
         return ApiResponse.error('Este utilizador já existe no sistema. Utilize o fluxo de suporte se precisar adicionar a esta empresa.');
      }
      return ApiResponse.error(inviteError.message);
    }

    // Auth trigger should automatically insert into public.users if properly configured,
    // but just in case, we can ensure they are in the company:
    const { error: upsertError } = await admin.from('users').upsert({
      id: inviteData.user.id,
      email: email,
      company_id: ctx.profile.company_id,
      role: role || 'caixa',
    }, { onConflict: 'id' });

    if (upsertError) return ApiResponse.error(upsertError.message);

    return ApiResponse.success({ message: password ? 'Utilizador criado com sucesso' : 'Convite enviado' });
  } catch (err: any) {
    return ApiResponse.error(err.message, 500);
  }
}

export async function PATCH(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile || ctx.profile.role !== 'admin') return ApiResponse.unauthorized();

  try {
    const { user_id, role } = await req.json();
    if (!user_id || !role) return ApiResponse.error('Faltam parâmetros');

    const admin = createAdminClient();
    const { error } = await admin
      .from('users')
      .update({ role })
      .eq('id', user_id)
      .eq('company_id', ctx.profile.company_id);

    if (error) return ApiResponse.error(error.message);

    return ApiResponse.success({ message: 'Role atualizado' });
  } catch (err: any) {
    return ApiResponse.error(err.message, 500);
  }
}

export async function DELETE(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile || ctx.profile.role !== 'admin') return ApiResponse.unauthorized();

  const url = new URL(req.url);
  const user_id = url.searchParams.get('user_id');

  if (!user_id) return ApiResponse.error('ID do utilizador obrigatório');
  if (user_id === ctx.profile.id) return ApiResponse.error('Não pode remover-se a si próprio');

  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .delete()
    .eq('id', user_id)
    .eq('company_id', ctx.profile.company_id);

  if (error) return ApiResponse.error(error.message);

  return ApiResponse.success({ message: 'Utilizador removido' });
}
