/**
 * Lightweight, zero-dependency IndexedDB key-value cache for Kinopoisk API responses.
 * Persists across mobile tab closes & PWA restarts (unlike sessionStorage).
 * Gracefully degrades to no-op in SSR or restricted private-browsing contexts.
 */

const DB_NAME = "cinemix_api_cache_db";
const DB_VERSION = 1;
const STORE_NAME = "responses";
const MAX_ENTRIES = 1200;

interface StoredEntry<T = unknown> {
  key: string;
  data: T;
  expiresAt: number;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
let writeCountSincePrune = 0;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
          store.createIndex("expiresAt", "expiresAt", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result as StoredEntry<T> | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        if (entry.expiresAt <= Date.now()) {
          void idbDelete(key);
          resolve(null);
          return;
        }
        resolve(entry.data);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet<T>(
  key: string,
  data: T,
  expiresAt: number,
): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const entry: StoredEntry<T> = {
        key,
        data,
        expiresAt,
        updatedAt: Date.now(),
      };
      store.put(entry);
      tx.oncomplete = () => {
        writeCountSincePrune += 1;
        if (writeCountSincePrune >= 40) {
          writeCountSincePrune = 0;
          void idbPrune();
        }
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbClear(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbPrune(): Promise<void> {
  const db = await openDb();
  if (!db) return;

  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const now = Date.now();

    // 1. Delete expired entries
    const expIndex = store.index("expiresAt");
    const expRange = IDBKeyRange.upperBound(now);
    const expCursorReq = expIndex.openCursor(expRange);
    expCursorReq.onsuccess = () => {
      const cursor = expCursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // 2. Cap total entries by evicting oldest updatedAt
    const countReq = store.count();
    countReq.onsuccess = () => {
      const total = countReq.result;
      if (total <= MAX_ENTRIES) return;
      let toDelete = total - MAX_ENTRIES + 150;
      const updIndex = store.index("updatedAt");
      const updCursorReq = updIndex.openCursor();
      updCursorReq.onsuccess = () => {
        const cursor = updCursorReq.result;
        if (cursor && toDelete > 0) {
          cursor.delete();
          toDelete -= 1;
          cursor.continue();
        }
      };
    };
  } catch {
    // ignore background prune errors
  }
}
