import { Worker, Job } from 'bullmq';

// Plain connection options — avoids ioredis version conflict with bullmq
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const parsed = new URL(redisUrl);
const connection = {
  host: parsed.hostname,
  port: parseInt(parsed.port) || 6379,
  password: parsed.password || undefined,
  maxRetriesPerRequest: null,
} as any;

/**
 * Worker principal que processa a fila do FaturaAO
 */
export const systemWorker = new Worker('faturaao-system-queue', async (job: Job) => {
  console.log(`[WORKER] Iniciando job ${job.id} do tipo ${job.name}...`);

  try {
    switch (job.name) {
      case 'generate-saft':
        // Simulação de geração SAF-T (lógica real no webhook/cron)
        console.log(`Processando SAF-T para a empresa ${job.data.companyId}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;

      case 'send-email':
        console.log(`Enviando email para ${job.data.to}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        break;

      default:
        console.warn(`[WORKER] Tipo de job não reconhecido: ${job.name}`);
    }

    console.log(`[WORKER] Job ${job.id} concluído com sucesso.`);
    return { success: true };
  } catch (err: any) {
    console.error(`[WORKER] Erro no job ${job.id}:`, err);
    throw err;
  }
}, {
  connection,
  concurrency: 5
});

systemWorker.on('completed', job => {
  console.log(`[Queue] Job completed: ${job.id}`);
});

systemWorker.on('failed', (job, err) => {
  console.error(`[Queue] Job failed: ${job?.id}`, err);
});
