import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const sqlPath = path.join(__dirname, '..', '..', 'supabase-setup.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// Use Supabase REST admin API via pg over PostgREST is not available.
// We will use the Supabase REST endpoint: POST /rest/v1/rpc/exec (not default).
// Instead, we will hit the direct /pg endpoint via the "database" REST.
// The cleanest approach: use the `pg` package.

import pg from 'pg';
const { Client } = pg;

// Build a connection string from the supabase URL, using service role as password is not correct.
// For supabase, the DB is typically at db.<ref>.supabase.co:5432
const ref = new URL(SUPABASE_URL).host.split('.')[0];
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.log('SUPABASE_DB_PASSWORD not set. Falling back to chunked execution via PostgREST is not possible.');
  console.log('Please run the SQL manually in the Supabase SQL editor: supabase-setup.sql');
  process.exit(0);
}

const client = new Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log('Schema applied.');
} finally {
  await client.end();
}
