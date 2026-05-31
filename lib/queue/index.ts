import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Conexão IORedis genérica para as Filas (suporta Docker local ou Upstash Redis caso Upstash seja exposto via Redis TCP)
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

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
