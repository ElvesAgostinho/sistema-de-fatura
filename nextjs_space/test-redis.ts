import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

async function testRedis() {
  console.log('A validar as chaves do .env...');
  if (!redisUrl || !redisToken) {
    console.error('ERRO: Chaves do Redis não encontradas no .env!');
    process.exit(1);
  }

  try {
    const redis = new Redis({ url: redisUrl, token: redisToken });
    console.log('🌐 Ligando ao Upstash Redis na África do Sul...');
    
    // Testar escrita
    await redis.set('teste_de_fogo', 'O FaturaAO está ultra-rápido!');
    console.log('✅ Escrita bem sucedida no Redis.');

    // Testar leitura
    const valor = await redis.get('teste_de_fogo');
    console.log(`✅ Leitura bem sucedida. O valor lido foi: "${valor}"`);

    // Apagar chave
    await redis.del('teste_de_fogo');
    console.log('✅ Tudo a 100% (Limpeza efetuada).');
  } catch (error) {
    console.error('❌ Falha na conexão ao Redis:', error);
  }
}

testRedis();
