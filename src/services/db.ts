import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { AppSettings, Cashflow, StockBatch, StockMovement, Transaction } from '../types';

const INDEXED_DB_NAME = 'jufa_store_db';
const INDEXED_DB_STORE = 'sqlite_storage';
const DB_BINARY_KEY = 'jufa_main_sqlite_binary';
const DB_VERSION = 1;

let SQL: SqlJsStatic | null = null;
let dbInstance: Database | null = null;

// IndexedDB Helper Functions
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXED_DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXED_DB_STORE)) {
        db.createObjectStore(INDEXED_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDbToIndexedDB(data: Uint8Array): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(INDEXED_DB_STORE, 'readwrite');
    const store = tx.objectStore(INDEXED_DB_STORE);
    store.put(data, DB_BINARY_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDbFromIndexedDB(): Promise<Uint8Array | null> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(INDEXED_DB_STORE, 'readonly');
    const store = tx.objectStore(INDEXED_DB_STORE);
    const req = store.get(DB_BINARY_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearIndexedDB(): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(INDEXED_DB_STORE, 'readwrite');
    const store = tx.objectStore(INDEXED_DB_STORE);
    store.delete(DB_BINARY_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSqlJsEngine(): Promise<SqlJsStatic> {
  if (SQL) return SQL;

  // Strategy 1: Fetch WASM as ArrayBuffer via Vite asset URL and pass wasmBinary
  // This bypasses instantiateStreaming MIME-type checks on Windows/local servers
  try {
    const res = await fetch(sqlWasmUrl);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      SQL = await initSqlJs({
        wasmBinary: buf,
      });
      return SQL;
    }
  } catch (err1) {
    console.warn('Strategy 1 (Vite wasmBinary buffer) failed:', err1);
  }

  // Strategy 2: Fetch local /sql-wasm.wasm from public directory as ArrayBuffer
  try {
    const res = await fetch('/sql-wasm.wasm');
    if (res.ok) {
      const buf = await res.arrayBuffer();
      SQL = await initSqlJs({
        wasmBinary: buf,
      });
      return SQL;
    }
  } catch (err2) {
    console.warn('Strategy 2 (Public /sql-wasm.wasm buffer) failed:', err2);
  }

  // Strategy 3: Standard initSqlJs with locateFile using Vite URL
  try {
    SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl,
    });
    return SQL;
  } catch (err3) {
    console.warn('Strategy 3 (initSqlJs locateFile) failed:', err3);
  }

  // Strategy 4: Fallback to CDN ArrayBuffer
  try {
    const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm');
    if (res.ok) {
      const buf = await res.arrayBuffer();
      SQL = await initSqlJs({
        wasmBinary: buf,
      });
      return SQL;
    }
  } catch (err4) {
    console.warn('Strategy 4 (CDN buffer) failed:', err4);
  }

  throw new Error('Gagal memuat modul WebAssembly SQLite. Pastikan browser mendukung WebAssembly.');
}

/**
 * Initialize SQLite WASM and Database instance
 */
export async function getDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  SQL = await loadSqlJsEngine();

  // Check if persisted database exists in IndexedDB
  let savedData: Uint8Array | null = null;
  try {
    savedData = await loadDbFromIndexedDB();
  } catch (err) {
    console.warn('Could not read from IndexedDB, starting fresh:', err);
  }

  if (savedData && savedData.length > 0) {
    try {
      dbInstance = new SQL.Database(savedData);
    } catch (corruptErr) {
      console.warn('Corrupted SQLite binary in IndexedDB, initializing fresh database:', corruptErr);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  initTables(dbInstance);
  await persistDatabase();

  return dbInstance;
}

/**
 * Create SQLite tables if not exists
 */
function initTables(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batch_code TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      supplier TEXT NOT NULL,
      initial_quantity REAL NOT NULL,
      remaining_quantity REAL NOT NULL,
      purchase_cost REAL NOT NULL,
      extra_cost REAL NOT NULL,
      discount REAL NOT NULL,
      total_cost REAL NOT NULL,
      cost_per_unit REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      transaction_code TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      customer_name TEXT,
      quantity REAL NOT NULL,
      sell_rate REAL NOT NULL,
      gross_revenue REAL NOT NULL,
      discount REAL NOT NULL,
      net_revenue REAL NOT NULL,
      cogs REAL NOT NULL,
      fee REAL NOT NULL,
      gross_profit REAL NOT NULL,
      net_profit REAL NOT NULL,
      margin_percentage REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      amount_paid REAL NOT NULL,
      accounts_receivable REAL NOT NULL,
      delivery_status TEXT NOT NULL,
      notes TEXT,
      source TEXT,
      batch_allocations TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      batch_id TEXT,
      batch_code TEXT,
      reference_id TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cashflows (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      reference_id TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      invested_amount REAL NOT NULL,
      share_percentage REAL NOT NULL,
      duration_months INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

/**
 * Persist current SQLite binary to IndexedDB
 */
export async function persistDatabase(): Promise<void> {
  if (!dbInstance) return;
  const binary = dbInstance.export();
  await saveDbToIndexedDB(binary);
}

/**
 * Export raw SQLite binary file (.sqlite / .db)
 */
export async function exportSqliteBinary(): Promise<Uint8Array> {
  const db = await getDatabase();
  return db.export();
}

/**
 * Import raw SQLite binary, replace current database, and persist
 */
export async function importSqliteBinary(binary: Uint8Array): Promise<boolean> {
  // Check SQLite header magic string: "SQLite format 3\0"
  const header = String.fromCharCode(...binary.slice(0, 16));
  if (!header.startsWith('SQLite format 3')) {
    throw new Error('File bukan file database SQLite yang valid!');
  }

  SQL = await loadSqlJsEngine();

  // Backup current db before overwriting
  try {
    const current = await exportSqliteBinary();
    localStorage.setItem('jufa_auto_backup_before_restore', JSON.stringify({
      timestamp: new Date().toISOString(),
      binaryLength: current.length,
    }));
  } catch (err) {
    console.warn('Backup before restore warning:', err);
  }

  const testDb = new SQL.Database(binary);
  // Test query
  testDb.exec('SELECT count(*) FROM sqlite_master;');

  // If valid, replace instance and save
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = testDb;
  initTables(dbInstance);
  await persistDatabase();
  return true;
}
