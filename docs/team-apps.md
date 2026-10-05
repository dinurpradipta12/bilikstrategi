# Aplikasi Tim mandiri

Halaman `/team-apps` di Bilik Strategi adalah katalog pusat untuk aplikasi tim yang terpisah. Tabel `team_app_instances` menyimpan identitas awal tim dan tautannya. Tabel ini **tidak** membuat workspace baru dalam database Bilik Strategi dan tidak mengubah integrasi ClickUp yang sudah ada.

## Aktifkan katalog

1. Jalankan migrasi `supabase/migrations/20261005000000_team_app_instances.sql` pada project Supabase Bilik Strategi yang lama.
2. Pastikan server aplikasi memiliki `SUPABASE_SERVICE_ROLE_KEY` dan URL Supabase yang benar. Jangan menaruh service role key di variabel `NEXT_PUBLIC_*`.
3. Deploy branch yang berisi halaman dan API ini.
4. Masuk lewat OAuth ClickUp dengan akun yang tercatat sebagai `owner` aktif di `app_user_roles`. Katalog sengaja menolak login berbasis cookie nama/email saja.

Owner dapat menambahkan rancangan tim, memilih nama, slug, email Owner tim, dan warna. Semua modul ada pada template aplikasi tim baru `codex/team-template-standalone`; setelah aplikasi tim tersedia, Owner tim dapat mengubah logo, ikon, warna, dan modul dari Pengaturan di aplikasi tersebut.

## Status aktivasi

Karena penyedia hosting belum dipilih, tombol “Tambah Tim” saat ini hanya menyimpan rancangan. Ia belum membuat project Supabase, menjalankan migrasi template, menyiapkan login Owner, atau menerbitkan URL. Jika aplikasi tim sudah dideploy secara terpisah, Owner dapat mencatat tautan HTTPS dan penyedia hostingnya di katalog. Tautan yang dicatat belum diverifikasi otomatis.

Untuk aktivasi otomatis dari aplikasi, tahap berikutnya perlu menghubungkan akun Supabase Management API dan penyedia hosting pilihan, menyimpan kredensial di server secara aman, membuat database khusus tim, menerapkan seluruh migrasi template, menyiapkan Owner pertama, lalu membuat deployment dan memantau hasilnya. Proses ini harus punya status yang dapat dilanjutkan jika salah satu langkah gagal agar tidak membuat project ganda.
