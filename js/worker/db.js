import sqlite3InitModule from 'https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.46.1-build4/sqlite-wasm/jswasm/sqlite3.mjs';

let sqlite3, db;
export const all = (sql, bind) => db.exec({ sql, bind, rowMode: 'object', returnValue: 'resultRows' });
export const run = (sql, bind) => db.exec({ sql, bind });
export const one = (sql, bind) => db.selectValue(sql, bind);
export const lastId = () => db.selectValue('SELECT last_insert_rowid()');
export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

const SYNC = (t, cols) => `CREATE TRIGGER IF NOT EXISTS sq_${t} AFTER INSERT ON ${t} BEGIN
  INSERT INTO sync_queue(ts,tbl,row) VALUES(strftime('%s','now')*1000,'${t}',json_object(${cols.map(c => `'${c}',NEW.${c}`).join(',')})); END;`;
const IMMUTABLE = t => `CREATE TRIGGER IF NOT EXISTS im_u_${t} BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT,'append-only'); END;
  CREATE TRIGGER IF NOT EXISTS im_d_${t} BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT,'append-only'); END;`;

export async function open() {
  sqlite3 = await sqlite3InitModule();
  const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'micro-erp' }); // OPFS, tanpa COOP/COEP
  db = new pool.OpfsSAHPoolDb('/erp.db');
  db.exec(`CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, sku TEXT, name TEXT,
             cost INTEGER, stock INTEGER, margin_bp INTEGER, plat INTEGER);`);
  if (db.selectValue('PRAGMA user_version') < 2) {
    for (const c of ["category TEXT DEFAULT ''", 'weight_g INTEGER DEFAULT 0', "dim_cm TEXT DEFAULT ''",
                     'reorder INTEGER DEFAULT 10', 'reserved INTEGER DEFAULT 0'])
      try { db.exec('ALTER TABLE products ADD COLUMN ' + c); } catch { /* kolom sudah ada */ }
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_moves(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, pid INTEGER, qty INTEGER, unit_cost INTEGER, type TEXT, ref TEXT);
      CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, journal INTEGER, account TEXT, debit INTEGER, credit INTEGER, ref TEXT, memo TEXT, reverses INTEGER);
      CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, channel TEXT, status TEXT);
      CREATE TABLE IF NOT EXISTS order_items(order_id INTEGER, pid INTEGER, qty INTEGER, price INTEGER, fee INTEGER, cogs INTEGER);
      CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY, name TEXT, contact TEXT);
      CREATE TABLE IF NOT EXISTS purchase_orders(id INTEGER PRIMARY KEY, supplier_id INTEGER, ts INTEGER, status TEXT);
      CREATE TABLE IF NOT EXISTS po_items(po_id INTEGER, pid INTEGER, qty INTEGER, unit_cost INTEGER);
      CREATE TABLE IF NOT EXISTS sync_queue(seq INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, tbl TEXT, row TEXT, sent INTEGER DEFAULT 0);
      ${IMMUTABLE('stock_moves')} ${IMMUTABLE('ledger')}
      ${SYNC('stock_moves', ['id', 'pid', 'qty', 'unit_cost', 'type', 'ref'])}
      ${SYNC('ledger', ['id', 'journal', 'account', 'debit', 'credit', 'ref', 'reverses'])}
      ${SYNC('orders', ['id', 'channel', 'status'])}
      PRAGMA user_version=2;`);
  }
}

export const loadAll = () => all(`SELECT id,sku,name,category,weight_g AS weight,reorder,reserved,cost,stock,
  margin_bp AS marginBp,plat FROM products ORDER BY id`);

export function seed(n) {
  let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const A = ['Kaos', 'Jaket', 'Celana', 'Tas', 'Sepatu', 'Topi', 'Kemeja', 'Dompet', 'Ikat Pinggang', 'Hoodie'];
  const B = ['Polos', 'Premium', 'Slim', 'Classic', 'Urban', 'Sport', 'Vintage', 'Basic'];
  tx(() => {
    const st = db.prepare('INSERT INTO products(sku,name,category,weight_g,cost,stock,margin_bp,plat,reorder) VALUES(?,?,?,?,?,?,?,?,?)');
    try {
      for (let i = 1; i <= n; i++) {
        const a = A[Math.floor(rnd() * A.length)];
        st.bind([`SKU-${String(i).padStart(6, '0')}`, `${a} ${B[Math.floor(rnd() * B.length)]} ${i}`, a,
          100 + Math.floor(rnd() * 2000), (5000 + Math.floor(rnd() * 195000)) * 100, Math.floor(rnd() * 200),
          1000 + Math.floor(rnd() * 20) * 100, Math.floor(rnd() * 3), 10]).stepReset();
      }
    } finally { st.finalize(); }
  });
}
export const exportBytes = () => sqlite3.capi.sqlite3_js_db_export(db);
