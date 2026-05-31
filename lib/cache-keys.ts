/**
 * Cache Keys — Chaves Redis centralizadas
 * Evita colisões entre empresas e garante consistência nos TTLs.
 */

export const CacheKeys = {
  // Dashboard metrics por empresa
  dashboardStats: (companyId: string) => `company:${companyId}:dashboard:stats`,

  // Listagem de faturas paginada
  invoiceList: (companyId: string, params: string) =>
    `company:${companyId}:invoices:list:${params}`,

  // Detalhe de uma fatura
  invoice: (companyId: string, invoiceId: string) =>
    `company:${companyId}:invoice:${invoiceId}`,

  // Listagem de clientes
  clientList: (companyId: string) => `company:${companyId}:clients:list`,

  // Listagem de produtos
  productList: (companyId: string) => `company:${companyId}:products:list`,

  // Configuração fiscal
  fiscalConfig: (companyId: string) => `company:${companyId}:fiscal:config`,

  // Contadores de série por ano/tipo
  invoiceSeries: (companyId: string, docType: string, year: number) =>
    `company:${companyId}:series:${docType}:${year}`,
} as const;

/** TTLs em segundos */
export const CacheTTL = {
  dashboard: 60,       // 1 minuto — métricas podem ter 1min de atraso
  invoiceList: 30,     // 30s — lista de faturas (invalidada no POST)
  invoice: 300,        // 5 minutos — detalhe de fatura (imutável após emissão)
  clientList: 120,     // 2 minutos
  productList: 120,    // 2 minutos
  fiscalConfig: 300,   // 5 minutos — muda raramente
} as const;
