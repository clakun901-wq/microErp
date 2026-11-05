import { effect } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';
import { view, version, rpc, act } from '../store.js';
import { fmtMoney, fmtBp } from '../core/money.js';

const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const btn = (t, fn) => { const b = el('button', '', t); b.onclick = fn; return b; };

export function mountOrders(root) {
  effect(() => {
    if (view.value !== 'pesanan') return; version.value;
    rpc('orders').then(rows => root.replaceChildren(...rows.map(o => {
      const r = el('div', 'row'), t = el('div');
      t.append(el('b', '', `#${o.id} · ${o.channel} · ${o.status}`), el('small', '', `${o.first ?? '-'} · ${fmtMoney(o.total ?? 0)}`));
      const a = el('div');
      if (o.next) a.append(btn('→ ' + o.next, () => act('orderAdvance', { id: o.id })));
      if (o.status !== 'Batal') a.append(btn('Batal', () => act('orderCancel', { id: o.id })));
      r.append(t, a); return r;
    })));
  });
}

export function mountDash(root) {
  effect(() => {
    if (view.value !== 'dasbor') return; version.value;
    rpc('dashboard').then(d => {
      const tiles = el('div', 'tiles');
      for (const [l, v] of [['Pendapatan Kotor', d.revenue], ['Potongan Platform', d.fees], ['HPP', d.cogs], ['Laba Bersih', d.net],
        ['Saldo Tertahan', d.held], ['Saldo Cair (Kas)', d.cash]]) {
        const t = el('div', 'tile'); t.append(el('small', '', l), el('b', '', fmtMoney(v))); tiles.append(t);
      }
      const t = el('div', 'tile'); t.append(el('small', '', 'Antrean Sync'), el('b', '', d.pending)); tiles.append(t);
      const list = (title, rows, f) => [el('h3', '', title), ...(rows.length ? rows.map(r => el('div', 'row', f(r))) : [el('small', '', 'Belum ada penjualan terkirim')])];
      root.replaceChildren(tiles, ...list('Fast-Moving', d.fast, r => `${r.name} — ${r.sold} terjual`),
        ...list('Margin Tertinggi', d.margin, r => `${r.name} — ${fmtBp(r.bp)}`));
    });
  });
}
