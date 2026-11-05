# Changelog (SemVer: MAJOR.MINOR.PATCH — MINOR = 1 modul/fitur selesai, PATCH = perbaikan)

## 0.3.0 — Alur & Navigasi (UX ramah pemula)
- Navigasi bawah: Beranda · Stok · Pesanan · Keuangan; Pengaturan di header.
- Beranda: daftar "Perlu dikerjakan" (klik langsung ke layar terkait) + panduan alur 4 langkah.
- Layar sambutan: "Coba data contoh" atau "Mulai dari kosong"; banner & tombol Hapus data contoh; Hapus semua data.
- Stok: kartu ringkas, ketuk → detail dengan penjelasan istilah + aksi Tambah stok / Koreksi / Jual produk ini; form Tambah produk.
- Pesanan: filter status, penjelasan tiap status, satu tombol utama berkata kerja jelas, konfirmasi pembatalan.
- Keuangan: label bahasa awam + keterangan, keadaan kosong. Notifikasi (toast) setelah tiap aksi. `prompt()` dihapus.
- DB skema v3 (tabel `meta`), RPC baru: start, reset, home, product, productAdd.

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
