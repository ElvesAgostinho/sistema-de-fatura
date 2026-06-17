require('dotenv').config({path: '.env.local'});
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const sql = fs.readFileSync('supabase/migrations/07_add_receipt_allocations.sql', 'utf8');
  await prisma.$executeRawUnsafe(sql);
  console.log('MIGRATION RECEIPT ALLOCATIONS SUCCESSFUL');
}

main().catch(console.error).finally(() => prisma.$disconnect());
