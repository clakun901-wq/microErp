import { effect } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';
import { init, search, update, total, status, rpc } from './store.js';
import { parseMoney } from './core/money.js';
import './components/virtual-list.js';

const $ = id => document.getElementById(id);
effect(() => { $('count').textContent = total.value.toLocaleString('id-ID') + ' produk'; });
effect(() => { $('status').textContent = status.value; });

let t;
$('q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => search(e.target.value), 120); });

document.addEventListener('card-action', ({ detail: { id, a, v } }) => {
  if (a === 'stock') update({ id, stockDelta: v });
  if (a === 'cost') { const s = prompt('HPP baru (Rp):'); if (s) update({ id, cost: parseMoney(s) }); }
});

$('backup').onclick = async () => { // File System Access API (butuh gestur pengguna)
  if (!window.showSaveFilePicker) { status.value = 'Peramban tidak mendukung File System Access API'; return; }
  try {
    const fh = await showSaveFilePicker({ suggestedName: `erp-backup-${Date.now()}.sqlite3` });
    const bytes = await rpc('export');
    const w = await fh.createWritable(); await w.write(bytes); await w.close();
    status.value = 'Cadangan tersimpan';
  } catch (e) { if (e.name !== 'AbortError') status.value = 'Gagal: ' + e.message; }
};

init();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
