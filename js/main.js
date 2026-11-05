import { effect } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';
import { init, search, act, total, status, view, query, low, mode, toast, rpc } from './store.js';
import { APP_NAME, APP_VERSION } from './config.js';
import { el, ask, modal } from './ui/kit.js';
import { mountWelcome, mountHome, mountOrders, mountFinance, openProduct, addProductFlow } from './ui/views.js';
import './components/virtual-list.js';

const $ = id => document.getElementById(id), VIEWS = ['welcome', 'beranda', 'stok', 'pesanan', 'keuangan'];
document.title = APP_NAME; $('brand').textContent = `${APP_NAME} v${APP_VERSION}`;
mountWelcome($('v-welcome')); mountHome($('v-beranda')); mountOrders($('v-pesanan')); mountFinance($('v-keuangan'));

effect(() => {
  for (const s of VIEWS) $('v-' + s).hidden = view.value !== s;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === view.value));
  $('tabs').hidden = view.value === 'welcome'; $('banner').hidden = mode.value !== 'demo' || view.value === 'welcome';
});
effect(() => { $('count').textContent = total.value.toLocaleString('id-ID') + ' produk'; });
effect(() => { $('status').textContent = status.value; });
effect(() => { $('low').checked = low.value; if ($('q').value !== query.value) $('q').value = query.value; });
let tt; effect(() => {
  const m = toast.value?.m; if (!m) return;
  $('toast').textContent = m; $('toast').classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => $('toast').classList.remove('show'), 3200);
});

document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { view.value = b.dataset.v; });
let t; $('q').oninput = e => { clearTimeout(t); t = setTimeout(() => search(e.target.value), 120); };
$('low').onchange = e => search(query.value, e.target.checked);
$('add').onclick = addProductFlow;
document.addEventListener('card-open', e => openProduct(e.detail.id));

async function wipe(title, intro) {
  if (!await ask({ title, intro, ok: 'Ya, hapus' })) return;
  query.value = ''; low.value = false;
  if (await act('reset', null, 'Data dihapus. Anda mulai dari kosong.')) { mode.value = 'real'; view.value = 'beranda'; }
}
$('clearDemo').onclick = () => wipe('Hapus data contoh?', 'Semua produk contoh dan pesanan yang Anda coba akan dihapus. Aplikasi kembali kosong.');

async function backup() { // File System Access API (butuh gestur pengguna)
  if (!window.showSaveFilePicker) { toast.value = { m: 'Peramban ini belum mendukung penyimpanan cadangan ke file' }; return; }
  try {
    const fh = await showSaveFilePicker({ suggestedName: `cadangan-${Date.now()}.sqlite3` });
    const w = await fh.createWritable(); await w.write(await rpc('export')); await w.close();
    toast.value = { m: 'Cadangan tersimpan' };
  } catch (e) { if (e.name !== 'AbortError') toast.value = { m: '⚠ ' + e.message }; }
}
$('gear').onclick = () => modal('Pengaturan', [
  el('p', 'hint', 'Cadangan adalah salinan seluruh data Anda dalam satu file. Simpan di tempat aman (flashdisk, Google Drive) agar data tidak hilang bila peramban dibersihkan.'),
  el('small', 'hint', `${APP_NAME} versi ${APP_VERSION}`)],
[['Simpan cadangan', backup], ['Hapus semua data', () => wipe('Hapus SEMUA data?', 'Seluruh produk, pesanan, dan catatan keuangan dihapus permanen dari perangkat ini. Simpan cadangan dulu bila perlu.'), 'ghost'], ['Tutup', null, 'ghost']]);

init();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
