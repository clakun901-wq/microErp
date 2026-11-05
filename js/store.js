import { signal } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';

export const total = signal(0);
export const query = signal('');
export const low = signal(false);
export const view = signal('beranda'); // welcome | beranda | stok | pesanan | keuangan
export const mode = signal(null);      // null | demo | real
export const orderFilter = signal('Semua');
export const version = signal(0);      // naik tiap data berubah → semua tampilan memuat ulang
export const status = signal('Memuat database…');
export const toast = signal(null);     // {m: 'pesan'} (objek baru = tampil ulang)

const worker = new Worker(new URL('./worker/worker.js', import.meta.url), { type: 'module' });
const pending = new Map(); let seq = 0;
worker.onmessage = ({ data: { id, res, err } }) => {
  const [ok, fail] = pending.get(id); pending.delete(id);
  err ? fail(new Error(err)) : ok(res);
};
export const rpc = (type, p) => new Promise((ok, fail) => { pending.set(++seq, [ok, fail]); worker.postMessage({ id: seq, type, p }); });
const say = m => { toast.value = { m }; };

export async function init() {
  try {
    const r = await rpc('init'); total.value = r.count; mode.value = r.mode;
    view.value = r.mode ? 'beranda' : 'welcome'; status.value = '';
  } catch (e) { status.value = 'Gagal: ' + e.message; }
}
export async function start(kind) {
  status.value = 'Menyiapkan…';
  try {
    const r = await rpc('start', { kind }); total.value = r.count; mode.value = kind === 'demo' ? 'demo' : 'real';
    version.value++; view.value = 'beranda';
    say(kind === 'demo' ? 'Data contoh siap dipakai' : 'Siap! Mulai dengan menambah produk pertama');
  } catch (e) { say('⚠ ' + e.message); }
  status.value = '';
}
const refresh = async () => { total.value = await rpc('query', { q: query.value, low: low.value }); };
export async function search(q, l = low.value) { query.value = q; low.value = l; await refresh(); }
export async function act(type, p, okMsg) { // true bila berhasil
  try { await rpc(type, p); await refresh(); version.value++; if (okMsg) say(okMsg); return true; }
  catch (e) { say('⚠ ' + e.message); return false; }
}
