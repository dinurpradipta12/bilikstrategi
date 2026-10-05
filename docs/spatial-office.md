# Kantor 3D — beranda game, kepemilikan meja, dan editor kantor

## Review

- `npm run dev -- --port 3014`, buka `/office-preview` untuk simulasi tanpa login.
- Saat halaman dibuka, anggota yang sudah check-in langsung menempati meja (atau pantry jika siklus kopi sedang berjalan). Tidak mengulang masuk dari pintu. Pilih Eka → Check-in: berjalan dari lounge ke meja 5.
- Pilih Istirahat: avatar berjalan melalui pintu kaca ke lounge; bubble menunjukkan presensi dijeda.
- Pilih Checkout: avatar berpindah ke lounge dengan label offline, tidak dihitung sebagai check-in. Meja tetap tersedia. Menghapus anggota dari roster menghilangkan avatarnya.
- Sepuluh meja permanen per area: lima kursi di setiap sisi meja komunal. Tambah anggota kesebelas untuk area kedua. Hapus anggota: avatar hilang dan meja menjadi kosong; perabot meja tetap tersedia.
- Simulasi 15 menit → pantry: karakter berjalan ke pantry, memegang/minum kopi, lalu kembali setelah siklus 60 detik. Timer memakai accumulated_seconds + interval kerja aktif; tidak menulis presensi.
- Ubah avatar: pilih model, rambut, warna rambut/pakaian, dan kacamata. Pratinjau langsung, Simpan atau Batal. Simulasi disimpan di browser; akun asli disimpan di database.
- Pilih Jeda animasi: perubahan presensi langsung menampilkan posisi akhir, tanpa perjalanan. Preferensi reduced motion mengikuti sistem.
- `/dashboard` langsung membuka kantor 3D layar penuh dengan HUD, dock Tim/Meja/Presensi/Avatar, kamera ruangan, dan menu Aplikasi. Statistik dimuat terpisah hanya saat dibuka. Root `/`, callback login, dan start_url PWA menuju dashboard; tidak ada pengalihan mobile ke presensi.
- Tombol Meja atau label pada meja → pilih meja kosong → Klaim & pindah. Kepemilikan satu meja per pengguna, termasuk saat offline. Pindah otomatis melepas meja sebelumnya.
- Admin/owner → Atur kantor → pilih/seret ornamen, putar 45 derajat, tambah atau hapus, lalu Simpan denah. Batal mengembalikan denah tersimpan. Lokasi lorong, dinding, meja/kursi dan sofa dilindungi dari ornamen.
- Preview default menampilkan UI game. Tombol Tampilan review mengembalikan panel lengkap. Dalam simulasi, pilih Tim → anggota → Mode admin/anggota untuk menguji kontrol editor tanpa menyentuh produksi.

Preview memakai data fiktif; avatar, denah, dan klaim meja simulasi disimpan dalam localStorage. Tombol simulasi tidak menulis ke Supabase atau ClickUp.

## Sumber data dan batas modul

`GET /api/spatial-office` memverifikasi token ClickUp melalui `/user`, keanggotaan workspace yang dikonfigurasi, dan status akun dari `app_user_roles`. Cookie nama/email/role tidak dipakai untuk otorisasi. Endpoint didaftarkan pada catch-all API agar kompatibel dengan deployment saat ini.

Roster menggunakan workspace ClickUp yang sama dengan halaman Team. Presensi menggunakan `active_sessions`. Pencocokan mendahulukan ID/email; data legacy tanpa keduanya harus memiliki nama atau alias yang persis sama dan unik. Tidak ada pencocokan substring. Email dan catatan presensi tidak dikirim ke scene.

Realtime Supabase menginvalidasi snapshot; polling 10 detik dan refresh ketika kembali ke tab menjadi fallback. Roster server boleh dicache selama 30 detik. Nama duplikat yang hanya memiliki presensi legacy tidak dianggap hadir secara otomatis. Snapshot gagal tidak dianggap sebagai checkout; respons 401/403 menghapus data yang sudah tidak boleh dilihat.

Meja ditetapkan otomatis bagi roster awal/anggota baru, lalu dapat diklaim ulang ke meja kosong. Pilihan yang tersimpan selalu dipertahankan lintas reload dan perangkat. Penambahan anggota tidak menggeser meja anggota lama; pengguna yang dihapus dari roster tidak mempertahankan klaim. Saat semua 10 meja penuh, anggota ke-11 mendapat area berikutnya.

Klaim dan ornamen disimpan dalam satu row `app_settings`, key `spatial-space:<workspace>:v1`. PATCH membandingkan JSON `revision` secara atomik pada database; insert awal memakai ignore-duplicates. Konflik dibaca ulang dan dicoba maksimal 3 kali. Klaim menolak meja milik orang lain dan tidak menerima ID pemilik dari client. Editor memeriksa `layoutRevision` agar dua admin tidak menimpa denah. Role admin/owner atau is_superuser dibaca dari `app_user_roles` menggunakan email dari token ClickUp yang diverifikasi; cookie role, identitas client, dan hardcoded email tidak memberi akses editor. `PATCH /api/spatial-office` hanya mendukung action claim/layout. Klaim tidak mengganti status presensi.

Editor memakai model GLB yang diizinkan (tanaman, lampu, rak buku, papan tulis, meja dekorasi, vas, karpet), maksimal 60 ornamen; validasi server dan client memeriksa tipe, koordinat, batas kantor/taman, lorong, dinding, dan tabrakan antardekorasi. Furnitur fungsional (meja kerja, kursi anggota, sofa presensi, pantry) mempertahankan jalur avatar. Karakter berpindah melalui lorong saat pemilik mengubah meja, termasuk ketika perubahan berikutnya datang saat masih berjalan.

Tidak memerlukan migration SQL baru jika tabel bawaan `app_settings` sudah tersedia. Presensi memakai koneksi baca yang sama. Penyimpanan avatar, kepemilikan meja, dan editor kantor memerlukan `SUPABASE_SERVICE_ROLE_KEY` di server dan tabel `app_settings`; tanpa itu presensi dan pratinjau tetap berjalan, tetapi UI menjelaskan bahwa penyimpanan akun belum tersedia dan menonaktifkan klaim/editor. `PUT /api/spatial-office` memverifikasi token, anggota workspace, akun aktif, origin, dan pilihan avatar. Key `spatial-avatar:<workspace>:<verified-user-id>` ditentukan server, tidak menerima ID pemilik dari client. Secret tidak dikirim ke browser. Login cookie simulasi lokal tidak cukup untuk membaca data asli.

## Aset dan rendering

- Sumber: `src/Char-assets` milik pengguna; disalin ke `public/spatial-assets` oleh lifecycle predev/prebuild/prepages:build. Hasil salinan tidak dikomit.
- Three.js dimuat pada beranda kantor; statistik/Recharts dipisah ke chunk lain agar tidak ikut dimuat saat pertama membuka kantor. `GLTFLoader` memuat model dan `OrbitControls` mengatur kamera.
- Karakter, rambut, furnitur, lantai dan dinding belakang memakai GLB yang disediakan. Jalan, trotoar, taman, partisi kaca, pintu geser, kanopi transparan, dan mesin kopi sederhana dibuat dari geometri Three.js agar seluruh sisi tertutup dengan interior tetap terlihat. Sistem sumber Z-up dikonversi menjadi Y-up.
- GLB tidak memiliki skeleton, skin, atau animation clip. Gerakan berjalan, duduk dan mengetik berupa artikulasi terbatas dari mesh tubuh bernama. Ini bukan motion capture atau rig humanoid.
- Furnitur digabung per aset dan karakter digabung per sendi agar draw call lebih sedikit. Geometry/material dilepas saat instance dihapus, observer/listener/renderer dilepas saat unmount.
- Maksimum 30 FPS, DPR maksimum 1.5; rendering berhenti saat halaman tersembunyi atau scene di luar viewport. Kamera menyesuaikan layar portrait. Daftar anggota tetap bisa digunakan tanpa WebGL.
- Bubble berganti setiap 8 detik mengikuti project presensi dan tugas aktif dari `task_cache`, dicocokkan dengan assignee ID/email; tanpa tugas, gunakan status/project yang tersedia. Bubble pantry diberi label ilustrasi; tidak membuat percakapan atas nama anggota atau menyimpulkan produktivitas.

## Verifikasi

```sh
node --experimental-strip-types --test tests/spatial-office.test.mjs tests/spatial-office-api.test.mjs tests/spatial-office-space.test.mjs tests/spatial-office-scene.test.mjs
npx tsc --noEmit
npx eslint components/spatial-office lib/spatial-office app/api/spatial-office app/office-preview
npm run build -- --webpack
```

32 pengujian lulus: timer/bubble, identitas, kontak keyboard, jalur sepuluh kursi, klaim yang bersamaan (row baru/lama), klaim bersamaan dengan editor, role admin, penolakan identitas palsu/origin asing, validasi ornamen, dan scene menggunakan GLB asli untuk perpindahan meja, posisi awal, serta tambah/geser/putar/hapus/batal dekorasi. Pemeriksaan skema live (read-only) mengonfirmasi kolom role dan filter revision PostgREST tersedia. Tidak ada klaim, denah, atau data presensi produksi yang diubah untuk pengujian.

Review visual interaktif dan simpan dengan akun produksi masih perlu dikonfirmasi: alat browser sebelumnya menolak navigasi localhost berdasarkan kebijakan URL. Pengujian GLB di Node memverifikasi state dan geometri, bukan hasil screenshot. Pemeriksaan manual: desktop/mobile, root dan peluncuran PWA, menu Statistik/kembali ke kantor, klaim meja kosong dengan dua akun, reload untuk persistensi, dan editor admin dengan Simpan/Batal. PWA yang sudah terpasang bisa perlu refresh manifest dari browser sebelum start_url baru digunakan.

## Aset yang disarankan berikutnya

Untuk gerakan lebih natural: karakter GLB dengan skeleton + skin dan klip `Idle`, `Walk`, `SitDown`, `Typing`, `StandUp`. Pertahankan skala dan orientasi konsisten. Aset sekarang tetap bisa dipakai untuk review tata ruang. Untuk peningkatan berikutnya, siapkan animasi `DrinkCoffee` dan model mesin kopi yang lebih detail. Editor denah dan klaim meja sudah tersedia pada modul ini.

Referensi implementasi: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [filter JSON dan conditional PATCH PostgREST](https://docs.postgrest.org/en/stable/references/api/tables_views.html).
