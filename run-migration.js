require('dotenv').config({path: '.env.local'});
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_name TEXT;');
  await prisma.$executeRawUnsafe('ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_account TEXT;');
  await prisma.$executeRawUnsafe('ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_iban TEXT;');
  console.log('MIGRATION SUCCESSFUL');
}
main().catch(console.error).finally(() => prisma.$disconnect());
