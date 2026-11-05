import { signal, effect } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';
import { fmtMoney, fmtBp } from '../core/money.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
:host{display:block;contain:content}
.c{height:100%;display:grid;grid-template-columns:1fr auto;gap:6px 12px;padding:10px 12px;border-radius:12px;background:Canvas;color:CanvasText;border:1px solid #8883}
.n{font-weight:600}.s{font-size:12px;opacity:.65}
.g{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;font-size:12px}
.g b{display:block;font-size:14px}.lo{color:#dc2626}.ok{color:#059669}
.b{display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap;justify-content:flex-end}
button{border:1px solid #8884;background:transparent;color:inherit;border-radius:8px;padding:4px 10px;cursor:pointer}`);

const h = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

class ProductCard extends HTMLElement {
  row = signal(null);
  connectedCallback() {
    const r = this.attachShadow({ mode: 'open' });
    r.adoptedStyleSheets = [sheet];
    const c = h('div', 'c'), head = h('div'), name = h('div', 'n'), sku = h('div', 's');
    head.append(name, sku);
    const btns = h('div', 'b');
    const mk = (t, a, v) => { const b = h('button'); b.textContent = t;
      b.onclick = () => this.dispatchEvent(new CustomEvent('card-action', { bubbles: true, composed: true, detail: { id: this.row.value.id, a, v } }));
      return b; };
    btns.append(mk('−1', 'stock', -1), mk('+1', 'stock', 1), mk('Beli', 'buy'), mk('Pesan', 'order'));
    const g = h('div', 'g'), cells = {};
    for (const k of ['cost', 'price', 'profit', 'stock']) {
      const d = h('div'), l = h('span'), v = h('b');
      l.textContent = { cost: 'HPP', price: 'Harga Jual', profit: 'Laba Bersih', stock: 'Tersedia' }[k];
      d.append(l, v); g.append(d); cells[k] = v;
    }
    c.append(head, btns, g); r.append(c);
    this.stop = effect(() => { // signal → DOM, tanpa innerHTML
      const d = this.row.value; this.hidden = !d; if (!d) return;
      name.textContent = d.name; sku.textContent = `${d.sku} · ${d.platName} · margin ${fmtBp(d.marginBp)}${d.low ? ' · ⚠ RESTOK' : ''}`;
      cells.cost.textContent = fmtMoney(d.cost); cells.price.textContent = fmtMoney(d.price);
      cells.profit.textContent = fmtMoney(d.profit); cells.profit.className = d.profit < 0 ? 'lo' : 'ok';
      cells.stock.textContent = d.avail + (d.reserved ? ` (+${d.reserved} dipesan)` : ''); cells.stock.className = d.low ? 'lo' : '';
    });
  }
  disconnectedCallback() { this.stop?.(); }
}
customElements.define('product-card', ProductCard);
