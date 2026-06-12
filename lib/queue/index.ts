import { Queue, QueueEvents } from 'bullmq';

// Use a plain connection options object to avoid ioredis version conflicts
// between the project's ioredis and bullmq's bundled ioredis.
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const parsed = new URL(redisUrl);
const connection = {
  host: parsed.hostname,
  port: parseInt(parsed.port) || 6379,
  password: parsed.password || undefined,
  maxRetriesPerRequest: null,
} as any;

/**
 * Fila principal do sistema FaturaAO.
 * Usada para processamento assíncrono:
 * - Geração de ficheiros SAF-T gigantes.
 * - Envio massivo de emails (faturas e lembretes de pagamento).
 * - Integrações com ERPs externos via Webhook.
 */
export const systemQueue = new Queue('faturaao-system-queue', { connection });

export const queueEvents = new QueueEvents('faturaao-system-queue', { connection });

/**
 * Adiciona um Job à fila.
 */
export async function enqueueJob(name: string, data: any, delayMs: number = 0) {
  return await systemQueue.add(name, data, { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
}
