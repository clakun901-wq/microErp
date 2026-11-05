import { signal } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';

export const total = signal(0);
export const query = signal('');
export const low = signal(false);
export const view = signal('produk');   // produk | pesanan | dasbor
export const version = signal(0);       // naik tiap data berubah → semua tampilan memuat ulang
export const status = signal('Memuat database…');

const worker = new Worker(new URL('./worker/worker.js', import.meta.url), { type: 'module' });
const pending = new Map(); let seq = 0;
worker.onmessage = ({ data: { id, res, err } }) => {
  const [ok, fail] = pending.get(id); pending.delete(id);
  err ? fail(new Error(err)) : ok(res);
};
export const rpc = (type, p) => new Promise((ok, fail) => { pending.set(++seq, [ok, fail]); worker.postMessage({ id: seq, type, p }); });

export async function init() {
  try { total.value = await rpc('init'); status.value = ''; }
  catch (e) { status.value = 'Gagal: ' + e.message; }
}
const refresh = async () => { total.value = await rpc('query', { q: query.value, low: low.value }); };
export async function search(q, l = low.value) { query.value = q; low.value = l; await refresh(); }
export async function act(type, p) {
  try { await rpc(type, p); await refresh(); version.value++; status.value = ''; }
  catch (e) { status.value = e.message; }
}
