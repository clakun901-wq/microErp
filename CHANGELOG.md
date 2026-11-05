# Changelog (SemVer: MAJOR.MINOR.PATCH — MINOR = 1 modul/fitur selesai, PATCH = perbaikan)

## 0.2.1 — Perbaikan
- Fix: cache memori worker kini dimuat ulang dari DB bila transaksi gagal/rollback (sebelumnya bisa menyimpang dari DB).
- Tampilkan nomor versi di header; `APP_VERSION` di `js/config.js`.

## 0.2.0 — Inti Cetak Biru
- Skema DB v2 (migrasi via PRAGMA user_version), mutasi stok append-only + HPP Average Cost.
- Pesanan multi-channel + siklus status + reservasi stok.
- Buku besar append-only + jurnal pembalik, saldo tertahan vs cair.
- Dasbor laba-rugi + Pareto, sync_queue pasif (trigger), notifikasi restok.

## 0.1.0 — Fondasi
- PWA vanilla ES modules, Web Worker, SQLite Wasm + OPFS (sahpool), Signals, Web Component <product-card> + virtual list.
- Pipa harga Chain of Responsibility, matematika integer, cadangan File System Access API.
