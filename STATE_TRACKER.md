# STATE TRACKER — Micro-ERP e-commerce (nama final: BELUM DITENTUKAN)
**Versi saat ini: 0.2.1** · Skema DB: `user_version = 2` · Diperbarui: 2026-11-05

## 0. Cara melanjutkan (instruksi untuk asisten)
Pengguna melampirkan file ini + `micro-erp-vX.Y.Z.zip`. Lakukan:
1. Baca tracker ini dan ekstrak ZIP. Jangan minta penjelasan ulang.
2. Kerjakan HANYA modul berstatus **NEXT** di bagian 6 (kecuali pengguna menyebut modul lain). Satu modul per sesi.
3. Setelah selesai: naikkan versi (MINOR untuk modul/fitur, PATCH untuk perbaikan), perbarui `js/config.js` (`APP_VERSION`), nama cache di `sw.js`, `CHANGELOG.md`, dan tracker ini (status, riwayat, isu).
4. Keluarkan 2 lampiran: `micro-erp-vX.Y.Z.zip` dan `STATE_TRACKER.md` terbaru (juga disalin di dalam ZIP).
5. Nyatakan jujur apa yang belum teruji. Nama aplikasi tetap placeholder sampai pengguna menentukan.

## 1. Peran & aturan mutlak (dari pengguna, wajib tanpa pengecualian)
Peran: Senior Arsitek PWA & pakar Vanilla JS (Off-Main-Thread, optimasi mesin peramban). Target: 10.000+ produk, performa setara native, 100% client-side.
1. **Tanpa server/framework/build tools.** HTML + CSS + Vanilla JS (ES Modules). Library hanya via CDN dengan versi dipin (kini: `@preact/signals-core@1.8.0`, `@sqlite.org/sqlite-wasm@3.46.1-build4`).
2. **Integer Math.** Dilarang `parseFloat` untuk harga/margin/pajak. Uang = integer sen (Rp×100); tarif = basis points (1% = 100). Bagi 100 hanya saat tampil.
3. **OPFS + SQLite Wasm**, bukan localStorage untuk data utama. Append-Only Log + Delta Compression. File System Access API untuk cadangan permanen.
4. **UI:** dilarang `innerHTML` untuk pembaruan dinamis; Signals; Native Web Components (Shadow DOM) untuk kartu produk.
5. **Main thread hanya render.** Semua logika berat (harga, filter, ERP, SQL) di Web Worker.
6. **Harga = Chain of Responsibility** (pipa linier).
7. **Struktur modular** dalam satu folder siap-ZIP; jangan satu file HTML monolitik.

## 2. Cetak biru fungsional (ringkas, dari PDF pengguna)
SCM (master produk: SKU, nama, kategori, dimensi, berat; audit trail mutasi; HPP Average Cost; notifikasi Reorder Point) · Keuangan (pricing pipeline, buku besar append-only + jurnal pembalik, kas & rekonsiliasi saldo tertahan/cair per marketplace) · Pesanan (multi-channel Tokopedia/Shopee/TikTok Shop/Manual; Diterima→Dikemas→Terkirim→Selesai→Dana Cair; reservasi stok saat Dikemas) · Pengadaan (pemasok & PO) · EPM (laba-rugi real-time, Pareto) · Keamanan (ekspor .sqlite, sync-queue untuk cloud di masa depan).

## 3. Peta file
```
index.html  manifest.json  sw.js  CHANGELOG.md  STATE_TRACKER.md
css/app.css   icons/icon.svg
js/main.js            entry: binding UI, tombol, aksi kartu, backup
js/config.js          APP_NAME, APP_VERSION
js/store.js           signals (total, query, low, view, version, status) + rpc() ke worker + act()
js/core/money.js      roundDiv, ceilDiv, parseMoney, fmtMoney, fmtBp (tanpa float)
js/components/product-card.js    <product-card> Shadow DOM, row = signal
js/components/virtual-list.js    <virtual-list> windowing (ROW=140), pool kartu
js/ui/views.js        mountOrders, mountDash (DOM via createElement)
js/worker/worker.js   router pesan RPC + cache memori items/view/byId + hydrate()
js/worker/db.js       SQLite/OPFS, migrasi, trigger, helper all/run/one/tx/lastId, seed, export
js/worker/pricing.js  pipa: BaseCost→EffectiveRate→GrossUp→RoundUp→Fees→Profit; PLATFORMS, CHANNELS, PPN_BP=1100
js/worker/inventory.js move(it,{type,qty,unitCost,ref}) — satu-satunya jalur ubah stok
js/worker/orders.js   FLOW, create, advance, cancel, list
js/worker/finance.js  post (jurnal seimbang), reverseAll, dashboard (+Pareto)
```

## 4. Skema DB v2
`products(id,sku,name,cost[=avg cost, sen],stock,margin_bp,plat,category,weight_g,dim_cm,reorder,reserved)` · `stock_moves(id,ts,pid,qty,unit_cost,type[purchase|adjust|sale|reserve|release],ref)` APPEND-ONLY · `ledger(id,ts,journal,account,debit,credit,ref,memo,reverses)` APPEND-ONLY · `orders(id,ts,channel,status)` · `order_items(order_id,pid,qty,price,fee[total potongan platform per unit termasuk fixed+PPN],cogs)` · `suppliers`, `purchase_orders`, `po_items` (skema ada, BELUM dipakai) · `sync_queue(seq,ts,tbl,row JSON,sent)` diisi trigger dari stock_moves/ledger/orders · `events` (sisa v1, tidak dipakai).
Akun buku besar: Kas, Piutang Marketplace, Pendapatan, Biaya Platform, HPP, Persediaan.
Jurnal Terkirim: Dr Piutang(gross−fees), Dr Biaya Platform(fees), Cr Pendapatan(gross), Dr HPP(cogs), Cr Persediaan(cogs). Dana Cair: Dr Kas, Cr Piutang. Pembatalan = jurnal pembalik (`reverses`=id jurnal asal).
Migrasi baru: tambahkan blok `if (user_version < N)` di `db.open()`, set `PRAGMA user_version=N`.

## 5. API RPC worker (main → worker, `rpc(type, payload)`)
`init` · `query{q,low}` → total · `range{start,count}` → baris (+avail, low) · `adjust{id,delta}` · `purchase{id,qty,unitCost}` · `orderCreate{channel,lines:[{pid,qty}]}` · `orderAdvance{id}` · `orderCancel{id}` · `orders` · `dashboard` · `export` → Uint8Array. Perubahan data dari UI lewat `act(type,payload)` (otomatis refresh + `version++`).

## 6. Roadmap modul
| Versi | Modul | Status |
|---|---|---|
| 0.1.0 | Fondasi (worker, OPFS/SQLite, signals, pipa harga, virtual list, backup) | SELESAI |
| 0.2.0–0.2.1 | Inti cetak biru: stok+Average Cost, pesanan+reservasi, buku besar, dasbor, sync_queue | SELESAI (belum diuji di peramban) |
| **0.3.0** | **Pengadaan: pemasok, PO (draft→dipesan→diterima), penerimaan PO → mutasi `purchase` + jurnal Persediaan/Utang** | **NEXT (usulan; pengguna boleh mengganti)** |
| 0.4.0 | Pesanan: keranjang multi-item, daftar pesanan terfilter per channel/status | TODO |
| 0.5.0 | Kas & rekonsiliasi per marketplace (tertahan vs cair, pencairan parsial) | TODO |
| 0.6.0 | Master produk: form tambah/ubah (kategori, dimensi, berat, reorder), impor CSV via worker | TODO |
| 0.7.0 | Restore dari cadangan + kompaksi/snapshot log | TODO |
| 0.8.0 | Adapter Sync-Queue (pengirim, penanda `sent`, idempotensi) | TODO |
| 1.0.0 | Uji menyeluruh, performa 10k+, aksesibilitas, finalisasi nama & branding | TODO |

## 7. Isu & hutang teknis yang diketahui
- KI-1: **Belum pernah dijalankan di peramban sungguhan** (sandbox tanpa jaringan). Uji manual dulu: seed 10k, pencarian, Pesan→Dikemas→Terkirim→Dana Cair→Batal, cek Dasbor, Cadangkan.
- KI-2: Versi `sqlite-wasm@3.46.1-build4` dipin dari ingatan; bila CDN menolak, sesuaikan di `db.js`.
- KI-3: VFS `opfs-sahpool` mengunci DB per origin → satu tab aktif saja.
- KI-4: Input memakai `prompt()` sementara (Beli, HPP); ganti form sungguhan di modul 0.6.0.
- KI-5: Pesanan baru = 1 produk per pesanan; tarif `PLATFORMS` = angka contoh.
- KI-6: Setelah `orderAdvance/orderCancel` worker menghitung ulang harga semua item (O(n)); optimalkan bila terasa lambat.
- KI-7: Tabel `events` v1 yatim; boleh di-drop di migrasi berikutnya.
- Diperbaiki di 0.2.1: cache memori kini `hydrate()` ulang dari DB bila transaksi rollback.

## 8. Keputusan desain yang sudah ditetapkan
Penamaan aplikasi ditunda (pakai `APP_NAME`). Pengerjaan bertahap per modul; tiap serah-terima = ZIP berversi + tracker ini.
