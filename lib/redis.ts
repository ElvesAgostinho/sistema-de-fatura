import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Usar Upstash REST API para compatibilidade total com Edge Runtime (Vercel) e Next.js
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Se as variáveis não estiverem configuradas, o sistema continua a funcionar (fallback) mas sem as restrições de cache/rate limit.
export const redis = (redisUrl && redisToken) 
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

/**
 * Rate Limiter Global (APIs)
 * Permite 50 requisições a cada 10 segundos por IP. Ideal para proteger APIs contra DDoS e Scrapers.
 */
export const rateLimiter = redis 
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(50, '10 s'),
      analytics: true,
      prefix: '@faturaao/api-limit',
    })
  : null;

/**
 * Rate Limiter de Autenticação (Login/Signup)
 * Muito restrito para impedir ataques de força bruta. Permite 5 tentativas por minuto.
 */
export const authRateLimiter = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
      prefix: '@faturaao/auth-limit',
    })
  : null;

/**
 * Cache Wrapper
 * Verifica se os dados existem no Redis. Se sim, devolve instantaneamente.
 * Se não, executa a query pesada à Base de Dados e guarda o resultado no Redis por X segundos.
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlInSeconds = 60
): Promise<T> {
  if (!redis) return fetcher();
  
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) return cached;
  } catch (error) {
    console.warn('[REDIS GET ERROR]', error);
  }

  const data = await fetcher();

  if (data !== undefined && data !== null) {
    try {
      await redis.set(key, data, { ex: ttlInSeconds });
    } catch (error) {
      console.warn('[REDIS SET ERROR]', error);
    }
  }

  return data;
}
