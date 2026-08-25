const DB_NAME = 'ogs-offline-db';
const DB_VERSION = 1;

export interface PendingRecord {
  id?: number;
  table: string;
  operation: 'upsert' | 'insert' | 'update' | 'delete';
  data: unknown;
  conflictTarget?: string;
  timestamp: number;
  retries: number;
}

export interface CacheRecord {
  key: string;
  data: unknown;
  timestamp: number;
  ttl: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('pending')) {
        const store = db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
        store.createIndex('table', 'table');
        store.createIndex('timestamp', 'timestamp');
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(db: IDBDatabase, storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineStore = {
  async addPending(record: Omit<PendingRecord, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const db = await openDB();
    await tx(db, 'pending', 'readwrite', (store) =>
      store.add({ ...record, timestamp: Date.now(), retries: 0 })
    );
    db.close();
  },

  async getAllPending(): Promise<PendingRecord[]> {
    const db = await openDB();
    const result = await tx<PendingRecord[]>(db, 'pending', 'readonly', (store) => store.getAll());
    db.close();
    return result.sort((a, b) => a.timestamp - b.timestamp);
  },

  async deletePending(id: number): Promise<void> {
    const db = await openDB();
    await tx(db, 'pending', 'readwrite', (store) => store.delete(id));
    db.close();
  },

  async clearPending(): Promise<void> {
    const db = await openDB();
    await tx(db, 'pending', 'readwrite', (store) => store.clear());
    db.close();
  },

  async setCache(key: string, data: unknown, ttlMs = 1000 * 60 * 30): Promise<void> {
    const db = await openDB();
    await tx(db, 'cache', 'readwrite', (store) =>
      store.put({ key, data, timestamp: Date.now(), ttl: ttlMs })
    );
    db.close();
  },

  async getCache<T>(key: string): Promise<T | null> {
    const db = await openDB();
    const record = await tx<CacheRecord | undefined>(db, 'cache', 'readonly', (store) => store.get(key));
    db.close();
    if (!record) return null;
    if (Date.now() - record.timestamp > record.ttl) return null;
    return record.data as T;
  },
};
