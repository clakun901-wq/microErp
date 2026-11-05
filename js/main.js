import { effect } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';
import { init, search, act, total, status, view, query, low, rpc } from './store.js';
import { parseMoney } from './core/money.js';
import { APP_NAME, APP_VERSION } from './config.js';
import { mountOrders, mountDash } from './ui/views.js';
import './components/virtual-list.js';

const $ = id => document.getElementById(id);
document.title = $('brand').textContent = `${APP_NAME} v${APP_VERSION}`;
mountOrders($('v-pesanan')); mountDash($('v-dasbor'));

effect(() => { $('count').textContent = total.value.toLocaleString('id-ID') + ' produk'; });
effect(() => { $('status').textContent = status.value; });
effect(() => {
  for (const s of ['produk', 'pesanan', 'dasbor']) $('v-' + s).hidden = view.value !== s;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === view.value));
  $('bar').hidden = view.value !== 'produk';
});
document.querySelectorAll('nav button').forEach(b => b.onclick = () => { view.value = b.dataset.v; });

let t;
$('q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => search(e.target.value), 120); });
$('low').onchange = e => search(query.value, e.target.checked);

document.addEventListener('card-action', ({ detail: { id, a, v } }) => {
  if (a === 'stock') act('adjust', { id, delta: v });
  if (a === 'order') act('orderCreate', { channel: $('channel').value, lines: [{ pid: id, qty: 1 }] });
  if (a === 'buy') {
    const qty = parseInt(prompt('Jumlah dibeli:') || '0', 10), c = prompt('HPP per unit (Rp):');
    if (qty > 0 && c) act('purchase', { id, qty, unitCost: parseMoney(c) });
  }
});

$('backup').onclick = async () => { // File System Access API (butuh gestur pengguna)
  if (!window.showSaveFilePicker) { status.value = 'Peramban tidak mendukung File System Access API'; return; }
  try {
    const fh = await showSaveFilePicker({ suggestedName: `backup-${Date.now()}.sqlite3` });
    const w = await fh.createWritable(); await w.write(await rpc('export')); await w.close();
    status.value = 'Cadangan tersimpan';
  } catch (e) { if (e.name !== 'AbortError') status.value = 'Gagal: ' + e.message; }
};

init();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
