# Template aplikasi tim mandiri

Repositori ini adalah template aplikasi terpisah untuk **satu tim per instalasi**. Setiap tim mendapat repositori GitHub, URL deployment, dan proyek Supabase sendiri. Bilik Strategi yang sudah berjalan tetap memakai deployment aslinya dan dapat terus memakai ClickUp. Template ini memakai Supabase Auth dan database tim; tidak memerlukan akun, token, webhook, atau konfigurasi ClickUp.

## Modul

Semua modul tersedia sejak instalasi pertama: dashboard, project, tugas dan My Tasks, timeline/kalender, tim, chat, presensi, KPI/performance, approval, automasi, client, aset, content plan, content idea bank, fee calculator, invoice, penawaran, perjanjian, profitabilitas, finance, slip gaji, dan notifikasi. Owner/Admin dapat mengatur nama aplikasi, logo, favicon, warna, identitas perusahaan, anggota, serta hak akses anggota melalui **Settings**. Owner dapat mengatur modul yang aktif. Semua modul aktif secara default. Data tiap instalasi berada dalam proyek Supabase yang berbeda.

Beberapa nama kolom internal masih memakai awalan `clickup_` agar modul lama dapat membaca model data yang sama. Kolom ini dipakai sebagai ID/metadata aplikasi dan tidak memanggil layanan ClickUp.

## Membuat instalasi untuk tim baru

1. Buat **proyek Supabase baru dan kosong** khusus tim tersebut. Jangan gunakan proyek database Bilik Strategi yang aktif.
2. Gunakan **Use this template** di GitHub untuk membuat salinan di akun tim, lalu buat deployment Next.js 16 dari repositori baru tersebut, misalnya proyek Vercel atau server Node.js terpisah. Berikan domain atau subdomain unik, misalnya `tim-a.example.com`. Setiap deployment harus memiliki environment miliknya sendiri. Konfigurasi Cloudflare Pages lama tidak dipakai karena adaptor `next-on-pages` gagal membangun `proxy.ts` pada Next.js 16; Cloudflare Workers memerlukan konfigurasi adaptor dan pengujian runtime tersendiri.
3. Salin [`.env.team.example`](.env.team.example) ke `.env.local` untuk pengembangan lokal. Isi URL, publishable/anon key, dan secret/service role key dari **proyek Supabase tim yang sama**. Nama variabel di template tetap `NEXT_PUBLIC_SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` untuk kompatibilitas kode; nilainya dapat memakai kunci Supabase baru (`sb_publishable_` dan `sb_secret_`). Di hosting, set empat variabel yang sama sebagai environment variables. `SUPABASE_SERVICE_ROLE_KEY` dan `TEAM_SETUP_TOKEN` hanya untuk server; jangan berikan kepada anggota atau taruh dalam variabel `NEXT_PUBLIC_*`.
4. Jalankan `supabase/setup_all.sql` di SQL Editor proyek Supabase tim yang **baru dan kosong**. Berkas ini menggabungkan seluruh 29 migrasi dari `supabase/migrations/*.sql` secara berurutan. Migrasi terakhir `20261005000000_standalone_team_template.sql` memasang kebijakan RLS, tabel branding, serta tabel presensi dan aset. Jangan menyalin `seed.sql` atau data dari aplikasi lama.
5. Jalankan `npm ci` lalu `npm run build`; terbitkan deployment. Atur URL aplikasi tersebut di konfigurasi Auth proyek Supabase tim (Site URL dan URL redirect yang sesuai dengan domain tim).
6. Buka `https://DOMAIN_TIM/setup`. Masukkan kode dari `TEAM_SETUP_TOKEN`, nama tim, dan akun Owner pertama. Sesudah berhasil, buka `/login`, masuk, lalu atur branding dan anggota di `/settings`.
7. Ulangi langkah 1–6 untuk tim berikutnya dengan **Supabase project, environment, token setup, deployment, dan URL berbeda**. Jangan memakai satu service role key atau satu database untuk beberapa tim.

Contoh lokal:

```bash
cp .env.team.example .env.local
npm ci
npm run dev
```

`TEAM_SETUP_TOKEN` harus berupa nilai acak unik minimal 24 karakter. Simpan di secret manager hosting. Hapus atau rotasi setelah Owner pertama dibuat. Pembuatan anggota berikutnya dilakukan Owner/Admin dari aplikasi.

## Hak akses

Aplikasi memvalidasi pengguna melalui `supabase.auth.getUser()` lalu memeriksa profil, status, peran, dan izin halaman di database. Owner mengakses finance dan slip gaji. Admin dapat mengelola anggota dan branding. Pengaturan modul di Settings membatasi menu, API, dan kebijakan RLS untuk data modul terkait. Fitur dasar yang diperlukan untuk mengelola instalasi (dashboard, tim, notifikasi, settings) tetap tersedia.

## Verifikasi sebelum dipakai tim

Setelah migrasi dan deployment ke proyek baru, uji login Owner dan anggota, branding/favicon, pembuatan project/tugas, komentar/subtask, chat, check-in/check-out presensi, akses finance Owner, serta penyimpanan invoice/penawaran/perjanjian dari dua akun pada dua browser. `npm run build` hanya memeriksa kode; keberhasilan database, Auth, RLS, realtime, dan deployment perlu diuji pada instalasi tim yang nyata.
