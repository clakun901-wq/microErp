import { effect } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.8.0/+esm';
import { view, version, rpc, act, start, search, query, orderFilter } from '../store.js';
import { fmtMoney, fmtBp, parseMoney } from '../core/money.js';
import { CHANNEL_NAMES, PLATFORM_NAMES } from '../config.js';
import { el, btn, kv, ask, modal } from './kit.js';

const go = (v, f) => { if (f) orderFilter.value = f; view.value = v; };
const num = s => parseInt(s || '0', 10) || 0;
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

const STEPS = [
  ['1', 'Isi stok', 'Tambah produk dan jumlah barang', 'stok'],
  ['2', 'Terima pesanan', 'Pilih produk → Jual produk ini', 'stok'],
  ['3', 'Kemas & kirim', 'Ikuti status di menu Pesanan', 'pesanan'],
  ['4', 'Cairkan dana', 'Catat uang masuk, lihat laba di Keuangan', 'keuangan'],
];
function stepper(clickable) {
  const o = el('div', 'steps');
  for (const [n, t, d, to] of STEPS) {
    const c = el(clickable ? 'button' : 'div', 'step'); if (clickable) { c.type = 'button'; c.onclick = () => go(to); }
    c.append(el('b', '', `${n}. ${t}`), el('small', 'hint', d)); o.append(c);
  }
  return o;
}

export function mountWelcome(root) {
  root.append(el('h2', '', 'Selamat datang 👋'),
    el('p', 'hint', 'Aplikasi ini membantu Anda mencatat stok, pesanan marketplace, dan menghitung laba — tanpa perlu paham akuntansi. Semua data tersimpan aman di perangkat Anda.'),
    el('h3', '', 'Cara kerjanya'), stepper(false), el('h3', '', 'Mau mulai dari mana?'),
    btn('Coba dengan data contoh', () => start('demo')),
    el('p', 'hint', 'Berisi ribuan produk contoh agar Anda bisa langsung mencoba. Bisa dihapus kapan saja.'),
    btn('Mulai dari kosong', () => start('real'), 'ghost'));
}

export function mountHome(root) {
  effect(() => {
    if (view.value !== 'beranda') return; version.value;
    rpc('home').then(h => {
      const kids = [el('h2', '', 'Beranda')], tasks = [];
      for (const [s, t] of [['Diterima', 'pesanan baru perlu dikemas'], ['Dikemas', 'pesanan siap dikirim'],
        ['Terkirim', 'pesanan terkirim, tinggal diselesaikan'], ['Selesai', 'pesanan selesai, menunggu dana cair']])
        if (h.orders[s]) tasks.push([`${h.orders[s]} ${t}`, '', () => go('pesanan', s)]);
      if (h.low) tasks.push([`${h.low} produk hampir habis`, h.lowItems.join(', '), () => { search('', true); go('stok'); }]);
      if (h.held > 0) tasks.push([`${fmtMoney(h.held)} dana belum cair`, 'Uang sudah terjual, masih di marketplace', () => go('keuangan')]);
      kids.push(el('h3', '', 'Perlu dikerjakan'));
      if (tasks.length) for (const [t, d, fn] of tasks) {
        const c = el('button', 'card tap'); c.type = 'button'; c.onclick = fn; c.append(el('b', '', t)); if (d) c.append(el('small', 'hint', d)); kids.push(c);
      } else {
        const c = el('div', 'card');
        if (!h.products) { c.append(el('b', '', 'Langkah 1: tambahkan produk pertama'), btn('+ Tambah produk', addProductFlow)); }
        else if (!sum(h.orders)) { c.append(el('b', '', 'Langkah 2: buat pesanan pertama'), el('small', 'hint', 'Buka Stok, ketuk sebuah produk, lalu pilih "Jual produk ini".'), btn('Ke Stok', () => go('stok'))); }
        else c.append(el('b', '', 'Semua beres 🎉'), el('small', 'hint', 'Tidak ada yang menunggu. Cek Keuangan untuk melihat laba.'));
        kids.push(c);
      }
      kids.push(el('h3', '', 'Alur kerja'), stepper(true));
      root.replaceChildren(...kids);
    });
  });
}

const TYPE = { purchase: 'Beli', adjust: 'Koreksi', sale: 'Terjual', reserve: 'Dikunci', release: 'Kunci dilepas' };
export async function openProduct(id) {
  const p = await rpc('product', { id });
  const hist = p.moves.length ? p.moves.map(m => kv(`${TYPE[m.type] ?? m.type} · ${new Date(m.ts).toLocaleDateString('id-ID')}`, (m.qty > 0 ? '+' : '') + m.qty)) : [el('small', 'hint', 'Belum ada riwayat.')];
  modal(p.name, [el('small', 'hint', `${p.sku}${p.category ? ' · ' + p.category : ''}`),
    kv('Stok tersedia', String(p.avail), `Fisik ${p.stock}, dikunci untuk pesanan ${p.reserved}`),
    kv('Modal per unit (HPP)', fmtMoney(p.cost), 'Rata-rata harga beli semua stok'),
    kv(`Harga jual saran (${p.platName})`, fmtMoney(p.price), `Sudah termasuk target untung ${fmtBp(p.marginBp)} & potongan marketplace`),
    kv('Laba bersih per unit', fmtMoney(p.profit), 'Setelah potongan, PPN, dan modal'),
    el('h3', '', 'Riwayat stok terakhir'), ...hist],
  [['Tambah stok', () => buyFlow(p)], ['Koreksi stok', () => adjustFlow(p), 'ghost'], ['Jual produk ini', () => sellFlow(p)], ['Tutup', null, 'ghost']]);
}
async function buyFlow(p) {
  const r = await ask({ title: `Tambah stok — ${p.name}`, intro: 'Catat barang yang baru Anda beli. Modal rata-rata dihitung ulang otomatis.', ok: 'Tambah stok', fields: [
    { name: 'qty', label: 'Jumlah dibeli', type: 'number', min: 1, required: true },
    { name: 'cost', label: 'Harga beli per unit (Rp)', type: 'number', min: 0, required: true, value: p.cost / 100 }] });
  if (r) act('purchase', { id: p.id, qty: num(r.qty), unitCost: parseMoney(r.cost) }, 'Stok bertambah');
}
async function adjustFlow(p) {
  const r = await ask({ title: `Koreksi stok — ${p.name}`, intro: 'Untuk barang rusak, hilang, atau selisih hitung. Gunakan angka minus untuk mengurangi.', ok: 'Simpan koreksi', fields: [
    { name: 'd', label: 'Selisih jumlah', type: 'number', required: true, hint: 'Contoh: -2 jika 2 barang rusak' }] });
  if (r && num(r.d)) act('adjust', { id: p.id, delta: num(r.d) }, 'Stok dikoreksi');
}
async function sellFlow(p) {
  const r = await ask({ title: `Jual — ${p.name}`, intro: 'Membuat pesanan baru. Stok belum berkurang sampai pesanan dikirim.', ok: 'Buat pesanan', fields: [
    { name: 'channel', label: 'Dijual lewat', options: CHANNEL_NAMES },
    { name: 'qty', label: 'Jumlah', type: 'number', min: 1, value: 1, required: true }] });
  if (r && await act('orderCreate', { channel: r.channel, lines: [{ pid: p.id, qty: Math.max(1, num(r.qty)) }] }, 'Pesanan dibuat. Lanjutkan di sini 👇')) go('pesanan', 'Diterima');
}
export async function addProductFlow() {
  const r = await ask({ title: 'Tambah produk', intro: 'Isi yang bertanda *. Sisanya bisa dilengkapi nanti.', ok: 'Tambah produk', fields: [
    { name: 'name', label: 'Nama produk *', required: true }, { name: 'category', label: 'Kategori' },
    { name: 'cost', label: 'Harga beli per unit (Rp) *', type: 'number', min: 0, required: true, hint: 'Modal Anda per barang (disebut HPP)' },
    { name: 'stock', label: 'Jumlah stok awal', type: 'number', min: 0, value: 0 },
    { name: 'margin', label: 'Target untung (%)', type: 'number', min: 0, value: 20, hint: 'Dipakai menghitung harga jual saran setelah potongan marketplace' },
    { name: 'plat', label: 'Marketplace utama', options: PLATFORM_NAMES },
    { name: 'reorder', label: 'Ingatkan restok saat stok ≤', type: 'number', min: 0, value: 10 }] });
  if (r) act('productAdd', { name: r.name, category: r.category, cost: parseMoney(r.cost), stock: num(r.stock), marginBp: parseMoney(r.margin),
    plat: PLATFORM_NAMES.indexOf(r.plat), reorder: num(r.reorder) }, 'Produk ditambahkan');
}

const INFO = {
  Diterima: ['Pesanan masuk. Belum ada stok yang dikunci.', 'Kemas pesanan'],
  Dikemas: ['Stok pesanan ini dikunci agar tidak terjual dua kali.', 'Tandai terkirim'],
  Terkirim: ['Barang dikirim: stok berkurang dan penjualan tercatat.', 'Selesaikan pesanan'],
  Selesai: ['Pesanan selesai. Menunggu uang dari marketplace.', 'Catat dana cair'],
  'Dana Cair': ['Uang sudah masuk ke kas. Pesanan tuntas.', null],
  Batal: ['Dibatalkan; pencatatan dibalik otomatis.', null],
};
export function mountOrders(root) {
  const chips = el('div', 'chips'), list = el('div'); root.append(el('h2', '', 'Pesanan'), chips, list);
  effect(() => {
    if (view.value !== 'pesanan') return; version.value; const f = orderFilter.value;
    rpc('orders').then(rows => {
      chips.replaceChildren(...['Semua', ...Object.keys(INFO)].map(s => btn(`${s} ${s === 'Semua' ? rows.length : rows.filter(r => r.status === s).length}`,
        () => { orderFilter.value = s; }, 'chip' + (s === f ? ' on' : ''))));
      const sel = f === 'Semua' ? rows : rows.filter(r => r.status === f);
      list.replaceChildren(...(sel.length ? sel.map(o => {
        const [d, label] = INFO[o.status], c = el('div', 'card'), h = el('div', 'between');
        h.append(el('b', '', `#${o.id} · ${o.channel}`), el('span', 'badge', o.status));
        c.append(h, el('small', 'hint', `${o.first ?? '-'} · ${fmtMoney(o.total ?? 0)}`), el('p', 'hint', d));
        const a = el('div', 'actions');
        if (label) a.append(btn(label, () => act('orderAdvance', { id: o.id }, `Pesanan #${o.id} → ${o.next}`)));
        if (o.status !== 'Batal') a.append(btn('Batalkan', async () => {
          if (await ask({ title: `Batalkan pesanan #${o.id}?`, intro: 'Stok dikembalikan dan catatan keuangan dibalik otomatis. Riwayat tetap tersimpan.', ok: 'Ya, batalkan' }))
            act('orderCancel', { id: o.id }, 'Pesanan dibatalkan');
        }, 'ghost'));
        c.append(a); return c;
      }) : [rows.length ? el('p', 'hint', 'Tidak ada pesanan dengan status ini.')
        : (() => { const c = el('div', 'card'); c.append(el('b', '', 'Belum ada pesanan'), el('small', 'hint', 'Buka Stok, ketuk produk, lalu pilih "Jual produk ini".'), btn('Ke Stok', () => go('stok'))); return c; })()]));
    });
  });
}

const TILES = [['Pendapatan kotor', 'revenue', 'Total penjualan sebelum potongan'], ['Potongan marketplace', 'fees', 'Komisi, biaya layanan, dan PPN'],
  ['Modal barang (HPP)', 'cogs', 'Harga beli barang yang sudah terjual'], ['Laba bersih', 'net', 'Pendapatan − potongan − modal'],
  ['Dana tertahan', 'held', 'Sudah terjual, uang belum cair'], ['Dana sudah cair', 'cash', 'Uang yang sudah masuk kas']];
export function mountFinance(root) {
  effect(() => {
    if (view.value !== 'keuangan') return; version.value;
    rpc('dashboard').then(d => {
      const t = el('div', 'tiles');
      for (const [l, k, h] of TILES) { const c = el('div', 'card'); c.append(el('small', 'hint', l), el('b', 'big', fmtMoney(d[k])), el('small', 'hint', h)); t.append(c); }
      const list = (title, rows, f) => [el('h3', '', title), ...(rows.length ? rows.map(r => el('div', 'card', f(r))) : [el('small', 'hint', 'Muncul setelah ada pesanan yang terkirim.')])];
      root.replaceChildren(el('h2', '', 'Keuangan'),
        ...(d.revenue === 0 ? [el('p', 'hint', 'Belum ada penjualan. Selesaikan satu pesanan sampai "Terkirim" untuk melihat laba di sini.')] : []), t,
        ...list('Paling laris', d.fast, r => `${r.name} — ${r.sold} terjual`), ...list('Untung tertinggi', d.margin, r => `${r.name} — untung ${fmtBp(r.bp)}`));
    });
  });
}
