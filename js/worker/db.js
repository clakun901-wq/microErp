import sqlite3InitModule from 'https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.46.1-build4/sqlite-wasm/jswasm/sqlite3.mjs';

let sqlite3, db;
const rows = (sql, bind) => db.exec({ sql, bind, rowMode: 'object', returnValue: 'resultRows' });

export async function open() {
  sqlite3 = await sqlite3InitModule();
  // SAH-Pool VFS: persisten di OPFS, tanpa syarat header COOP/COEP.
  const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'micro-erp' });
  db = new pool.OpfsSAHPoolDb('/erp.db');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products(
      id INTEGER PRIMARY KEY, sku TEXT, name TEXT,
      cost INTEGER, stock INTEGER, margin_bp INTEGER, plat INTEGER);
    CREATE TABLE IF NOT EXISTS events(           -- append-only log
      seq INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, pid INTEGER, d TEXT);`);
}
export const loadAll = () => rows('SELECT id,sku,name,cost,stock,margin_bp AS marginBp,plat FROM products ORDER BY id');

export function seed(n) {
  let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const A = ['Kaos', 'Jaket', 'Celana', 'Tas', 'Sepatu', 'Topi', 'Kemeja', 'Dompet', 'Ikat Pinggang', 'Hoodie'];
  const B = ['Polos', 'Premium', 'Slim', 'Classic', 'Urban', 'Sport', 'Vintage', 'Basic'];
  db.exec('BEGIN');
  const st = db.prepare('INSERT INTO products(sku,name,cost,stock,margin_bp,plat) VALUES(?,?,?,?,?,?)');
  try {
    for (let i = 1; i <= n; i++) {
      const name = `${A[Math.floor(rnd() * A.length)]} ${B[Math.floor(rnd() * B.length)]} ${i}`;
      st.bind([`SKU-${String(i).padStart(6, '0')}`, name, (5000 + Math.floor(rnd() * 195000)) * 100,
               Math.floor(rnd() * 200), 1000 + Math.floor(rnd() * 20) * 100, Math.floor(rnd() * 3)]).stepReset();
    }
  } finally { st.finalize(); }
  db.exec('COMMIT');
}

// Delta compression: hanya selisih field yang berubah yang ditulis ke log (s=stok, c=HPP).
export function persist(id, delta, after) {
  db.exec({ sql: 'UPDATE products SET cost=?,stock=? WHERE id=?', bind: [after.cost, after.stock, id] });
  db.exec({ sql: 'INSERT INTO events(ts,pid,d) VALUES(?,?,?)', bind: [Date.now(), id, JSON.stringify(delta)] });
}
export const exportBytes = () => sqlite3.capi.sqlite3_js_db_export(db);
