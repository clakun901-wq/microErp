import * as DB from './db.js';
import { buildPipeline, PLATFORMS } from './pricing.js';
import { move } from './inventory.js';
import * as Orders from './orders.js';
import { dashboard } from './finance.js';

const DEMO_COUNT = 2000;
const pipe = buildPipeline();
let items = [], view = [], byId = new Map(), q = '', low = false;

const isLow = i => i.stock - i.reserved <= i.reorder;
function calc(it) {
  const r = pipe.handle({ cost: it.cost, marginBp: it.marginBp, ...PLATFORMS[it.plat] });
  it.price = r.price; it.profit = r.profit; it.platName = PLATFORMS[it.plat].name;
}
const filter = () => (view = items.filter(i => (!q || i.key.includes(q)) && (!low || isLow(i)))).length;
function hydrate() { // cache memori ← DB (sumber kebenaran)
  byId = new Map();
  items = DB.loadAll().map(r => { r.key = (r.name + ' ' + r.sku).toLowerCase(); calc(r); byId.set(r.id, r); return r; });
}
const stockOp = (id, m) => { const it = byId.get(id); DB.tx(() => move(it, m)); calc(it); return true; };
const strip = ({ key, ...r }) => ({ ...r, avail: r.stock - r.reserved, low: isLow(r) });

const H = {
  async init() {
    await DB.open(); hydrate();
    let mode = DB.getMeta('mode');
    if (!mode && items.length) DB.setMeta('mode', (mode = 'demo')); // data lama dari versi sebelumnya = contoh
    return { count: filter(), mode: mode || null };
  },
  start({ kind }) {
    if (kind === 'demo') DB.seed(DEMO_COUNT);
    DB.setMeta('mode', kind === 'demo' ? 'demo' : 'real'); hydrate(); q = ''; low = false;
    return { count: filter() };
  },
  reset() { DB.resetAll(); DB.setMeta('mode', 'real'); hydrate(); q = ''; low = false; return filter(); },
  query(p) { q = p.q.trim().toLowerCase(); low = !!p.low; return filter(); },
  range({ start, count }) { return view.slice(start, start + count).map(strip); },
  product({ id }) {
    return { ...strip(byId.get(id)), moves: DB.all('SELECT ts,qty,type,unit_cost FROM stock_moves WHERE pid=? ORDER BY id DESC LIMIT 6', [id]) };
  },
  productAdd({ name, category, cost, stock, marginBp, plat, reorder }) {
    if (!name?.trim()) throw new Error('Nama produk wajib diisi');
    pipe.handle({ cost, marginBp, ...PLATFORMS[plat] }); // validasi: margin + biaya harus < 100%
    DB.tx(() => {
      DB.run('INSERT INTO products(sku,name,category,weight_g,cost,stock,margin_bp,plat,reorder) VALUES(?,?,?,?,?,?,?,?,?)',
        ['', name.trim(), category || '', 0, cost, 0, marginBp, plat, reorder]);
      const id = DB.lastId();
      DB.run('UPDATE products SET sku=? WHERE id=?', ['SKU-' + String(id).padStart(6, '0'), id]);
      if (stock > 0) move({ id, cost, stock: 0, reserved: 0 }, { type: 'purchase', qty: stock, unitCost: cost, ref: 'stok awal' });
    });
    hydrate(); filter(); return true;
  },
  home() {
    const orders = {};
    for (const r of DB.all('SELECT status s,COUNT(*) n FROM orders GROUP BY status')) orders[r.s] = r.n;
    const lows = items.filter(isLow);
    return { orders, products: items.length, low: lows.length, lowItems: lows.slice(0, 3).map(i => i.name),
      held: DB.one("SELECT COALESCE(SUM(debit-credit),0) FROM ledger WHERE account='Piutang Marketplace'") };
  },
  adjust: ({ id, delta }) => stockOp(id, { type: 'adjust', qty: delta, ref: 'koreksi' }),
  purchase: ({ id, qty, unitCost }) => stockOp(id, { type: 'purchase', qty, unitCost, ref: 'pembelian' }),
  orderCreate: p => Orders.create(byId, p),
  orderAdvance: ({ id }) => Orders.advance(byId, id),
  orderCancel: ({ id }) => Orders.cancel(byId, id),
  orders: () => Orders.list(),
  dashboard: () => dashboard(),
  export: () => DB.exportBytes(),
};
const MUTATING = new Set(['adjust', 'purchase', 'orderCreate', 'orderAdvance', 'orderCancel', 'productAdd', 'start', 'reset']);
const AFTER = new Set(['orderAdvance', 'orderCancel']);

onmessage = async ({ data: { id, type, p } }) => {
  try {
    const res = await H[type](p);
    if (AFTER.has(type)) items.forEach(calc);
    postMessage({ id, res }, res instanceof Uint8Array ? [res.buffer] : []);
  } catch (e) {
    if (MUTATING.has(type)) { hydrate(); filter(); } // rollback DB → samakan cache memori
    postMessage({ id, err: String(e?.message || e) });
  }
};
