import { effect } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';
import { total, query, version, rpc } from '../store.js';
import './product-card.js';

const ROW = 140, BUF = 3;
const sheet = new CSSStyleSheet();
sheet.replaceSync(`:host{display:block;overflow:auto;contain:strict}
.sp{position:relative;width:100%}
product-card{position:absolute;left:0;right:0;height:${ROW - 8}px;will-change:transform}`);

class VirtualList extends HTMLElement {
  pool = []; raf = 0; token = 0;
  connectedCallback() {
    const r = this.attachShadow({ mode: 'open' });
    r.adoptedStyleSheets = [sheet];
    this.sp = document.createElement('div'); this.sp.className = 'sp'; r.append(this.sp);
    this.addEventListener('scroll', () => this.schedule(), { passive: true });
    new ResizeObserver(() => this.schedule()).observe(this);
    this.stop = effect(() => { // reaktif terhadap sinyal
      this.sp.style.height = total.value * ROW + 'px';
      query.value; version.value; this.schedule();
    });
  }
  disconnectedCallback() { this.stop?.(); }
  schedule() { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => this.render()); }
  async render() {
    const start = Math.max(0, Math.floor(this.scrollTop / ROW) - BUF);
    const count = Math.ceil(this.clientHeight / ROW) + BUF * 2;
    while (this.pool.length < count) { const c = document.createElement('product-card'); this.sp.append(c); this.pool.push(c); }
    const t = ++this.token;
    const data = await rpc('range', { start, count });
    if (t !== this.token) return; // abaikan respons usang
    this.pool.forEach((c, i) => {
      c.row.value = data[i] ?? null;
      c.style.transform = `translateY(${(start + i) * ROW}px)`;
    });
  }
}
customElements.define('virtual-list', VirtualList);
