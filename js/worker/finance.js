import * as DB from './db.js';

// Buku besar append-only: koreksi hanya lewat jurnal pembalik (reverses = id jurnal asal).
export function post(ref, memo, lines, reverses = null) {
  const d = lines.reduce((s, l) => s + l[1], 0), c = lines.reduce((s, l) => s + l[2], 0);
  if (d !== c) throw new Error('Jurnal tidak seimbang');
  const j = DB.one('SELECT COALESCE(MAX(journal),0) FROM ledger') + 1;
  for (const [acc, dr, cr] of lines)
    DB.run('INSERT INTO ledger(ts,journal,account,debit,credit,ref,memo,reverses) VALUES(?,?,?,?,?,?,?,?)',
      [Date.now(), j, acc, dr, cr, ref, memo, reverses]);
  return j;
}
export function reverseAll(ref) {
  const open = DB.all(`SELECT DISTINCT journal FROM ledger WHERE ref=? AND reverses IS NULL
    AND journal NOT IN (SELECT reverses FROM ledger WHERE reverses IS NOT NULL)`, [ref]);
  for (const { journal } of open) {
    const ls = DB.all('SELECT account,debit,credit FROM ledger WHERE journal=?', [journal]);
    post(ref, 'Pembalik jurnal ' + journal, ls.map(l => [l.account, l.credit, l.debit]), journal);
  }
}

export function dashboard() {
  const b = {};
  for (const r of DB.all('SELECT account,SUM(debit) d,SUM(credit) c FROM ledger GROUP BY account')) b[r.account] = r;
  const dr = a => b[a]?.d ?? 0, cr = a => b[a]?.c ?? 0;
  const revenue = cr('Pendapatan') - dr('Pendapatan'), fees = dr('Biaya Platform') - cr('Biaya Platform'),
        cogs = dr('HPP') - cr('HPP');
  const rows = DB.all(`SELECT p.name,SUM(i.qty) sold,SUM(i.price*i.qty) rev,SUM((i.price-i.fee-i.cogs)*i.qty) profit
    FROM order_items i JOIN orders o ON o.id=i.order_id JOIN products p ON p.id=i.pid
    WHERE o.status IN ('Terkirim','Selesai','Dana Cair') GROUP BY i.pid`);
  return {
    revenue, fees, cogs, net: revenue - fees - cogs,
    held: dr('Piutang Marketplace') - cr('Piutang Marketplace'), cash: dr('Kas') - cr('Kas'),
    pending: DB.one('SELECT COUNT(*) FROM sync_queue WHERE sent=0'),
    fast: [...rows].sort((x, y) => y.sold - x.sold).slice(0, 5),
    margin: rows.filter(r => r.rev > 0).map(r => ({ ...r, bp: Math.floor(r.profit * 10000 / r.rev) }))
      .sort((x, y) => y.bp - x.bp).slice(0, 5),
  };
}
