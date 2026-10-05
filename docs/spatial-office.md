# Kantor 3D — perilaku, ruangan, dan avatar

## Review

- `npm run dev -- --port 3014`, buka `/office-preview` untuk simulasi tanpa login.
- Saat halaman dibuka, anggota yang sudah check-in langsung menempati meja (atau pantry jika siklus kopi sedang berjalan). Tidak mengulang masuk dari pintu. Pilih Eka → Check-in: berjalan dari lounge ke meja 5.
- Pilih Istirahat: avatar berjalan melalui pintu kaca ke lounge; bubble menunjukkan presensi dijeda.
- Pilih Checkout: avatar berpindah ke lounge dengan label offline, tidak dihitung sebagai check-in. Meja tetap tersedia. Menghapus anggota dari roster menghilangkan avatarnya.
- Tambah anggota ketujuh: area kedua muncul. Setiap area memiliki meja, lounge, dan pantry. Hapus anggota: label, perlengkapan meja dan avatar hilang; meja komunal tetap utuh.
- Simulasi 15 menit → pantry: karakter berjalan ke pantry, memegang/minum kopi, lalu kembali setelah siklus 60 detik. Timer memakai accumulated_seconds + interval kerja aktif; tidak menulis presensi.
- Ubah avatar: pilih model, rambut, warna rambut/pakaian, dan kacamata. Pratinjau langsung, Simpan atau Batal. Simulasi disimpan di browser; akun asli disimpan di database.
- Pilih Jeda animasi: perubahan presensi langsung menampilkan posisi akhir, tanpa perjalanan. Preferensi reduced motion mengikuti sistem.
- `/dashboard` membuka tab Kantor 3D. Tab dashboard statistik dan personal tetap tersedia.

Preview memakai data fiktif; pilihan avatar simulasi disimpan dalam localStorage. Tombol simulasi tidak menulis ke Supabase atau ClickUp.

## Sumber data dan batas modul

`GET /api/spatial-office` memverifikasi token ClickUp melalui `/user`, keanggotaan workspace yang dikonfigurasi, dan status akun dari `app_user_roles`. Cookie nama/email/role tidak dipakai untuk otorisasi. Endpoint didaftarkan pada catch-all API agar kompatibel dengan deployment saat ini.

Roster menggunakan workspace ClickUp yang sama dengan halaman Team. Presensi menggunakan `active_sessions`. Pencocokan mendahulukan ID/email; data legacy tanpa keduanya harus memiliki nama atau alias yang persis sama dan unik. Tidak ada pencocokan substring. Email dan catatan presensi tidak dikirim ke scene.

Realtime Supabase menginvalidasi snapshot; polling 10 detik dan refresh ketika kembali ke tab menjadi fallback. Roster server boleh dicache selama 30 detik. Nama duplikat yang hanya memiliki presensi legacy tidak dianggap hadir secara otomatis. Snapshot gagal tidak dianggap sebagai checkout; respons 401/403 menghapus data yang sudah tidak boleh dilihat.

Meja mengikuti ID anggota, tetap stabil selama tampilan terbuka, dan slot kosong dipakai oleh anggota baru. Saat halaman dibuka ulang, urutan awal ditentukan dari ID. Penetapan denah lintas perangkat yang dapat diedit dan disimpan merupakan modul lanjutan. Satu area memakai meja komunal panjang dengan tiga kursi berhadapan di setiap sisi, tanpa membatasi jumlah anggota keseluruhan.

Tidak memerlukan migration SQL baru jika tabel bawaan `app_settings` sudah tersedia. Presensi memakai koneksi baca yang sama. Penyimpanan avatar memerlukan `SUPABASE_SERVICE_ROLE_KEY` di server dan tabel `app_settings`; tanpa itu presensi dan pratinjau tetap berjalan, tetapi UI menjelaskan bahwa penyimpanan akun belum tersedia. `PUT /api/spatial-office` memverifikasi token, anggota workspace, akun aktif, origin, dan pilihan avatar. Key `spatial-avatar:<workspace>:<verified-user-id>` ditentukan server, tidak menerima ID pemilik dari client. Secret tidak dikirim ke browser. Login cookie simulasi lokal tidak cukup untuk membaca data asli.

## Aset dan rendering

- Sumber: `src/Char-assets` milik pengguna; disalin ke `public/spatial-assets` oleh lifecycle predev/prebuild/prepages:build. Hasil salinan tidak dikomit.
- Three.js dimuat hanya saat tab kantor dibuka. `GLTFLoader` memuat model dan `OrbitControls` mengatur kamera.
- Karakter, rambut, furnitur, lantai dan dinding belakang memakai GLB yang disediakan. Partisi kaca, pintu geser, kanopi transparan, dan mesin kopi sederhana dibuat dari geometri Three.js agar seluruh sisi tertutup dengan interior tetap terlihat. Sistem sumber Z-up dikonversi menjadi Y-up.
- GLB tidak memiliki skeleton, skin, atau animation clip. Gerakan berjalan, duduk dan mengetik berupa artikulasi terbatas dari mesh tubuh bernama. Ini bukan motion capture atau rig humanoid.
- Furnitur digabung per aset dan karakter digabung per sendi agar draw call lebih sedikit. Geometry/material dilepas saat instance dihapus, observer/listener/renderer dilepas saat unmount.
- Maksimum 30 FPS, DPR maksimum 1.5; rendering berhenti saat halaman tersembunyi atau scene di luar viewport. Kamera menyesuaikan layar portrait. Daftar anggota tetap bisa digunakan tanpa WebGL.
- Bubble berganti setiap 8 detik mengikuti project presensi dan tugas aktif dari `task_cache`, dicocokkan dengan assignee ID/email; tanpa tugas, gunakan status/project yang tersedia. Bubble pantry diberi label ilustrasi; tidak membuat percakapan atas nama anggota atau menyimpulkan produktivitas.

## Verifikasi

```sh
node --experimental-strip-types --test tests/spatial-office.test.mjs tests/spatial-office-api.test.mjs
npx tsc --noEmit
npx eslint components/spatial-office lib/spatial-office app/api/spatial-office app/office-preview
npm run build -- --webpack
```

Versi ruangan/avatar: build, TypeScript, lint, dan 17 pengujian lulus, mencakup siklus pantry, timer jeda/resume, rute yang membalik arah, kontak tangan dengan keyboard, penugasan task, validasi avatar, penolakan identitas palsu/akun nonaktif/anggota asing/origin asing, dan penyimpanan yang tidak tersedia. Pemeriksaan visual versi ini belum selesai: alat browser menolak navigasi localhost berdasarkan kebijakan URL. Review manual: gunakan kontrol Semua/Meja/Lounge/Pantry, coba perpindahan dan reload saat sudah check-in, lalu simpan avatar pada akun deployment yang telah login. Tidak ada data presensi produksi yang diubah untuk pengujian.

## Aset yang disarankan berikutnya

Untuk gerakan lebih natural: karakter GLB dengan skeleton + skin dan klip `Idle`, `Walk`, `SitDown`, `Typing`, `StandUp`. Pertahankan skala dan orientasi konsisten. Aset sekarang tetap bisa dipakai untuk review tata ruang. Untuk peningkatan berikutnya, siapkan animasi `DrinkCoffee` dan model mesin kopi yang lebih detail. Denah yang dapat diedit/disimpan tetap merupakan modul terpisah.

Referensi implementasi: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).
