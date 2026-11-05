import * as DB from './db.js';
import { move } from './inventory.js';
import { post, reverseAll } from './finance.js';
import { buildPipeline, CHANNELS } from './pricing.js';

export const FLOW = ['Diterima', 'Dikemas', 'Terkirim', 'Selesai', 'Dana Cair'];
const pipe = buildPipeline();

export function create(byId, { channel, lines }) {
  const ch = CHANNELS[channel]; if (!ch) throw new Error('Channel tidak dikenal');
  return DB.tx(() => {
    DB.run('INSERT INTO orders(ts,channel,status) VALUES(?,?,?)', [Date.now(), channel, FLOW[0]]);
    const oid = DB.lastId();
    for (const { pid, qty } of lines) {
      const it = byId.get(pid), r = pipe.handle({ cost: it.cost, marginBp: it.marginBp, ...ch });
      DB.run('INSERT INTO order_items VALUES(?,?,?,?,?,?)', [oid, pid, qty, r.price, r.fee + r.tax + ch.fixed, it.cost]);
    }
    return oid;
  });
}

const sums = items => items.reduce((a, i) => ({ gross: a.gross + i.price * i.qty, fees: a.fees + i.fee * i.qty,
  cogs: a.cogs + i.cogs * i.qty }), { gross: 0, fees: 0, cogs: 0 });

export function advance(byId, oid) {
  const o = DB.all('SELECT * FROM orders WHERE id=?', [oid])[0];
  const items = DB.all('SELECT * FROM order_items WHERE order_id=?', [oid]);
  const i = FLOW.indexOf(o?.status); if (i < 0 || i === FLOW.length - 1) throw new Error('Status tidak bisa dilanjutkan');
  const next = FLOW[i + 1], ref = 'ORD-' + oid;
  DB.tx(() => {
    if (next === 'Dikemas') for (const x of items) { // reservasi stok
      const p = byId.get(x.pid); if (p.stock - p.reserved < x.qty) throw new Error('Stok tersedia kurang: ' + p.name);
      move(p, { type: 'reserve', qty: x.qty, ref });
    }
    const s = sums(items);
    if (next === 'Terkirim') {
      for (const x of items) { const p = byId.get(x.pid);
        move(p, { type: 'sale', qty: -x.qty, ref }); move(p, { type: 'release', qty: x.qty, ref }); }
      post(ref, 'Pengiriman ' + o.channel, [['Piutang Marketplace', s.gross - s.fees, 0], ['Biaya Platform', s.fees, 0],
        ['Pendapatan', 0, s.gross], ['HPP', s.cogs, 0], ['Persediaan', 0, s.cogs]]);
    }
    if (next === 'Dana Cair') post(ref, 'Pencairan dana', [['Kas', s.gross - s.fees, 0], ['Piutang Marketplace', 0, s.gross - s.fees]]);
    DB.run('UPDATE orders SET status=? WHERE id=?', [next, oid]);
  });
}

export function cancel(byId, oid) {
  const o = DB.all('SELECT * FROM orders WHERE id=?', [oid])[0];
  if (!o || o.status === 'Batal') throw new Error('Pesanan tidak valid');
  const items = DB.all('SELECT * FROM order_items WHERE order_id=?', [oid]), ref = 'ORD-' + oid;
  DB.tx(() => {
    reverseAll(ref); // jurnal pembalik, bukan hapus
    for (const x of items) { const p = byId.get(x.pid);
      if (o.status === 'Dikemas') move(p, { type: 'release', qty: x.qty, ref });
      else if (['Terkirim', 'Selesai', 'Dana Cair'].includes(o.status)) move(p, { type: 'adjust', qty: x.qty, ref }); }
    DB.run("UPDATE orders SET status='Batal' WHERE id=?", [oid]);
  });
}

export const list = () => DB.all(`SELECT o.id,o.channel,o.status,
  (SELECT SUM(price*qty) FROM order_items WHERE order_id=o.id) total,
  (SELECT p.name FROM order_items i JOIN products p ON p.id=i.pid WHERE i.order_id=o.id LIMIT 1) first
  FROM orders o ORDER BY o.id DESC LIMIT 100`).map(r => ({ ...r, next: FLOW[FLOW.indexOf(r.status) + 1] ?? null }));
