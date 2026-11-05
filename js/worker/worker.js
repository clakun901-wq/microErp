import * as DB from './db.js';
import { buildPipeline, PLATFORMS } from './pricing.js';

const pipe = buildPipeline();
let items = [], view = [], byId = new Map(), q = '';

function calc(it) {
  const r = pipe.handle({ cost: it.cost, marginBp: it.marginBp, ...PLATFORMS[it.plat] });
  it.price = r.price; it.profit = r.profit; it.fee = r.fee + r.tax; it.platName = PLATFORMS[it.plat].name;
}
function filter() {
  view = q ? items.filter(i => i.key.includes(q)) : items;
  return view.length;
}

const H = {
  async init() {
    await DB.open();
    let list = DB.loadAll();
    if (!list.length) { DB.seed(10000); list = DB.loadAll(); }
    items = list.map(r => { r.key = (r.name + ' ' + r.sku).toLowerCase(); calc(r); byId.set(r.id, r); return r; });
    return filter();
  },
  query(p) { q = p.q.trim().toLowerCase(); return filter(); },
  range({ start, count }) {
    return view.slice(start, start + count).map(({ key, ...r }) => r);
  },
  update({ id, stockDelta = 0, cost }) {
    const it = byId.get(id); if (!it) return false;
    const before = { cost: it.cost, stock: it.stock };
    if (stockDelta) it.stock = Math.max(0, it.stock + stockDelta);
    if (cost != null) it.cost = cost;
    calc(it);
    const delta = {};
    if (it.stock !== before.stock) delta.s = it.stock - before.stock;
    if (it.cost !== before.cost) delta.c = it.cost - before.cost;
    if (Object.keys(delta).length) DB.persist(id, delta, it);
    return true;
  },
  export() { return DB.exportBytes(); },
};

onmessage = async ({ data: { id, type, p } }) => {
  try {
    const res = await H[type](p);
    postMessage({ id, res }, res instanceof Uint8Array ? [res.buffer] : []);
  } catch (e) { postMessage({ id, err: String(e?.message || e) }); }
};
