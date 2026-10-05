# Aplikasi Tim mandiri

Halaman `/team-apps` di Bilik Strategi adalah katalog pusat untuk aplikasi tim yang terpisah. Tabel `team_app_instances` menyimpan identitas awal tim dan tautannya. Tabel ini **tidak** membuat workspace baru dalam database Bilik Strategi dan tidak mengubah integrasi ClickUp yang sudah ada.

## Aktifkan katalog

1. Jalankan migrasi `supabase/migrations/20261005000000_team_app_instances.sql` pada project Supabase Bilik Strategi yang lama.
2. Pastikan server aplikasi memiliki `SUPABASE_SERVICE_ROLE_KEY` dan URL Supabase yang benar. Jangan menaruh service role key di variabel `NEXT_PUBLIC_*`.
3. Deploy branch yang berisi halaman dan API ini.
4. Masuk lewat OAuth ClickUp dengan akun yang tercatat sebagai `owner` aktif di `app_user_roles`. Katalog sengaja menolak login berbasis cookie nama/email saja.

Owner dapat menambahkan tim, memilih nama, slug, email Owner tim, dan warna. Setiap kartu tim langsung menyediakan link setup yang berlaku sekitar 30 hari. Link ini bisa dikirim kepada calon Owner tim dan tidak memberikan akses untuk mengubah data katalog pusat. Halaman setup hanya menampilkan identitas tim serta panduan penyalinan kode dan deployment; tidak menerima kunci Supabase, GitHub, atau hosting.

Kode aplikasi tim tersedia sebagai [repositori template GitHub](https://github.com/dinurpradipta12/bilik-strategi-team-template). Repositori ini berisi snapshot sumber tanpa riwayat Git aplikasi pusat. Penerima dapat memakai alur Vercel untuk membuat salinan GitHub sekaligus deployment, atau memakai GitHub “Use this template” dan hosting Next.js 16 lain. SQL gabungan 29 migrasi tersedia di `/team-template/setup_all.sql` untuk proyek Supabase baru dan kosong. Semua modul ada sejak instalasi awal; setelah Owner pertama dibuat di `/setup`, branding dan modul dapat diatur di `/settings`.

## Status aktivasi

Tombol “Tambah Tim” membuat entri katalog dan link panduan setup. Penerima masih harus membuat proyek Supabase, menjalankan SQL, memilih hosting, mengisi environment rahasia pada hostingnya, dan membuat Owner pertama. Langkah tersebut memakai akun milik penerima. Jika aplikasi tim sudah dideploy, Owner pusat dapat mencatat tautan HTTPS dan penyedia hostingnya di katalog; tautan yang dicatat belum diverifikasi otomatis.

Link setup ditandatangani dengan kunci server Bilik Strategi dan hanya menampilkan metadata tim. Penerima tidak perlu akun Bilik Strategi. Rotasi `SUPABASE_SERVICE_ROLE_KEY` pada aplikasi pusat membatalkan link lama; Owner bisa menyalin link baru dari kartu tim.
