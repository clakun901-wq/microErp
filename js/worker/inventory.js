import * as DB from './db.js';
import { roundDiv } from '../core/money.js';

// Semua perubahan stok = baris mutasi baru (audit trail). HPP = Average Cost bergerak.
export function move(it, { type, qty, unitCost = 0, ref = '' }) {
  if (type === 'purchase') {
    if (qty <= 0) throw new Error('Qty pembelian harus > 0');
    const n = it.stock + qty;
    it.cost = roundDiv(it.stock * it.cost + qty * unitCost, n); it.stock = n;
  } else if (type === 'reserve') it.reserved += qty;
  else if (type === 'release') it.reserved -= qty;
  else { if (it.stock + qty < 0) throw new Error('Stok tidak cukup'); it.stock += qty; } // adjust | sale
  DB.run('INSERT INTO stock_moves(ts,pid,qty,unit_cost,type,ref) VALUES(?,?,?,?,?,?)',
    [Date.now(), it.id, qty, type === 'purchase' ? unitCost : it.cost, type, ref]);
  DB.run('UPDATE products SET cost=?,stock=?,reserved=? WHERE id=?', [it.cost, it.stock, it.reserved, it.id]);
}
