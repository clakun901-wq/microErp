import { signal } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';

export const total = signal(0);
export const query = signal('');
export const version = signal(0); // naik setiap data berubah → daftar dimuat ulang
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
export async function search(q) { query.value = q; total.value = await rpc('query', { q }); }
export async function update(p) { await rpc('update', p); version.value++; }
