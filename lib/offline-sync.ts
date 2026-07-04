import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'faturaao-offline';
const STORE_INVOICES = 'pending-invoices';

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_INVOICES)) {
          const store = db.createObjectStore(STORE_INVOICES, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

export async function savePendingInvoice(invoiceData: any) {
  const db = await getDB();
  if (!db) return;
  const pendingInvoice = {
    ...invoiceData,
    id: invoiceData.id || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    isPendingSync: true,
  };
  await db.put(STORE_INVOICES, pendingInvoice);
  return pendingInvoice;
}

export async function getPendingInvoices() {
  const db = await getDB();
  if (!db) return [];
  return db.getAllFromIndex(STORE_INVOICES, 'createdAt');
}

export async function removePendingInvoice(id: string) {
  const db = await getDB();
  if (!db) return;
  await db.delete(STORE_INVOICES, id);
}

export async function syncPendingInvoices() {
  const pending = await getPendingInvoices();
  if (!pending || pending.length === 0) return { success: true, count: 0 };

  let successCount = 0;
  let errors = [];

  for (const invoice of pending) {
    try {
      // Remove local metadata before sending
      const { id, createdAt, isPendingSync, ...payload } = invoice;
      
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await removePendingInvoice(invoice.id);
        successCount++;
      } else {
        const errorData = await res.json().catch(() => ({}));
        errors.push({ id: invoice.id, error: errorData.message || res.statusText });
      }
    } catch (e: any) {
      errors.push({ id: invoice.id, error: e.message });
    }
  }

  return {
    success: errors.length === 0,
    count: successCount,
    errors,
  };
}
