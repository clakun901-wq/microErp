import { signal, effect } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';
import { fmtMoney } from '../core/money.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
:host{display:block;contain:content;cursor:pointer}
.c{height:100%;display:grid;grid-template-columns:1fr auto;gap:4px 10px;padding:10px 12px;border-radius:12px;background:Canvas;color:CanvasText;border:1px solid #8883}
.n{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.s{font-size:12px;opacity:.65}
.t{font-size:11px;font-weight:600;color:#dc2626}
.g{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-size:11px;opacity:.9}
.g b{display:block;font-size:13px}.lo{color:#dc2626}.ok{color:#059669}`);
const h = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

class ProductCard extends HTMLElement {
  row = signal(null);
  connectedCallback() {
    const r = this.attachShadow({ mode: 'open' }); r.adoptedStyleSheets = [sheet];
    this.setAttribute('role', 'button'); this.tabIndex = 0;
    const open = () => this.dispatchEvent(new CustomEvent('card-open', { bubbles: true, composed: true, detail: { id: this.row.value.id } }));
    this.onclick = open; this.onkeydown = e => { if (e.key === 'Enter') open(); };
    const c = h('div', 'c'), head = h('div'), name = h('div', 'n'), sub = h('div', 's'), tag = h('div', 't'), g = h('div', 'g'), cells = {};
    head.append(name, sub);
    for (const [k, l] of [['avail', 'Tersedia'], ['price', 'Harga jual saran'], ['profit', 'Laba/unit']]) {
      const d = h('div'), s = h('span'), v = h('b'); s.textContent = l; d.append(s, v); g.append(d); cells[k] = v;
    }
    c.append(head, tag, g); r.append(c);
    this.stop = effect(() => { // signal → DOM
      const d = this.row.value; this.hidden = !d; if (!d) return;
      name.textContent = d.name; sub.textContent = `${d.sku}${d.category ? ' · ' + d.category : ''}`;
      tag.textContent = d.low ? '⚠ Hampir habis' : '';
      cells.avail.textContent = d.avail; cells.avail.className = d.low ? 'lo' : '';
      cells.price.textContent = fmtMoney(d.price);
      cells.profit.textContent = fmtMoney(d.profit); cells.profit.className = d.profit < 0 ? 'lo' : 'ok';
    });
  }
  disconnectedCallback() { this.stop?.(); }
}
customElements.define('product-card', ProductCard);
