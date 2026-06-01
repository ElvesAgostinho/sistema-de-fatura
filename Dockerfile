FROM node:20-alpine AS base

# 1. Instalar dependências (Layer isolada para cache)
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# 2. Build da Aplicação
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Arguments for Supabase (Required for Next.js browser bundle)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Desativar a recolha de telemetria do Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Compilar o código fonte. O next.config.js garante que é gerada a pasta standalone
RUN npm run build

# 3. Imagem Final em Produção
FROM base AS runner
WORKDIR /app

ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Configurar permissões de cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copiar APENAS os ficheiros estritamente necessários para produção
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# O server.js é gerado automaticamente pelo Next.js (output: standalone)
CMD ["node", "server.js"]
