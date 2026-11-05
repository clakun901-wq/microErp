import * as DB from './db.js';
import { buildPipeline, PLATFORMS } from './pricing.js';
import { move } from './inventory.js';
import * as Orders from './orders.js';
import { dashboard } from './finance.js';

const pipe = buildPipeline();
let items = [], view = [], byId = new Map(), q = '', low = false;

const isLow = i => i.stock - i.reserved <= i.reorder;
function calc(it) {
  const r = pipe.handle({ cost: it.cost, marginBp: it.marginBp, ...PLATFORMS[it.plat] });
  it.price = r.price; it.profit = r.profit; it.platName = PLATFORMS[it.plat].name;
}
const filter = () => (view = items.filter(i => (!q || i.key.includes(q)) && (!low || isLow(i)))).length;
const stockOp = (id, m) => { const it = byId.get(id); DB.tx(() => move(it, m)); calc(it); return true; };

function hydrate() { // muat ulang cache memori dari DB (sumber kebenaran)
  let list = DB.loadAll();
  if (!list.length) { DB.seed(10000); list = DB.loadAll(); }
  byId = new Map();
  items = list.map(r => { r.key = (r.name + ' ' + r.sku).toLowerCase(); calc(r); byId.set(r.id, r); return r; });
}

const H = {
  async init() { await DB.open(); hydrate(); return filter(); },
  query(p) { q = p.q.trim().toLowerCase(); low = !!p.low; return filter(); },
  range({ start, count }) {
    return view.slice(start, start + count).map(({ key, ...r }) => ({ ...r, avail: r.stock - r.reserved, low: isLow(r) }));
  },
  adjust: ({ id, delta }) => stockOp(id, { type: 'adjust', qty: delta, ref: 'manual' }),
  purchase: ({ id, qty, unitCost }) => stockOp(id, { type: 'purchase', qty, unitCost, ref: 'pembelian' }),
  orderCreate: p => Orders.create(byId, p),
  orderAdvance: ({ id }) => Orders.advance(byId, id),
  orderCancel: ({ id }) => Orders.cancel(byId, id),
  orders: () => Orders.list(),
  dashboard: () => dashboard(),
  export: () => DB.exportBytes(),
};
// Setelah operasi order, hitung ulang cache harga item yang berubah HPP/stoknya.
const MUTATING = new Set(['adjust', 'purchase', 'orderCreate', 'orderAdvance', 'orderCancel']);
const AFTER = new Set(['orderAdvance', 'orderCancel']);

onmessage = async ({ data: { id, type, p } }) => {
  try {
    const res = await H[type](p);
    if (AFTER.has(type)) items.forEach(calc);
    postMessage({ id, res }, res instanceof Uint8Array ? [res.buffer] : []);
  } catch (e) {
    if (MUTATING.has(type)) { hydrate(); filter(); } // rollback DB → samakan cache memori
    postMessage({ id, err: String(e?.message || e) }); }
};
