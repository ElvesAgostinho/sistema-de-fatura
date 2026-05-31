import { NextResponse } from 'next/server';

/**
 * Standardized API Response utility to ensure UTF-8 encoding
 * and consistent error/success structures.
 */
export const ApiResponse = {
  success(data: any, status = 200) {
    return new NextResponse(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  },

  error(message: string, status = 400, details?: any) {
    return new NextResponse(
      JSON.stringify({
        error: message,
        details: details || null,
        timestamp: new Date().toISOString(),
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );
  },

  unauthorized() {
    return this.error('Não autorizado. Por favor, faça login novamente.', 401);
  },

  forbidden() {
    return this.error('Acesso negado. Não tem permissões para realizar esta ação.', 403);
  },
};
