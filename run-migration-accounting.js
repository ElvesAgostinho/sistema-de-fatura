require('dotenv').config({path: '.env.local'});
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const sqlFile = path.join(__dirname, 'migrations', '05_accounting_module.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  // Split the SQL file by statements if needed, or run it directly. 
  // Prisma $executeRawUnsafe can run blocks of SQL.
  console.log('Running migration...');
  await prisma.$executeRawUnsafe(sql);
  console.log('MIGRATION SUCCESSFUL');
}

main().catch(console.error).finally(() => prisma.$disconnect());
