# Kantor 3D — beranda game, kepemilikan meja, dan editor kantor

## Review

- `npm run dev -- --port 3014`, buka `/office-preview` untuk simulasi tanpa login.
- Saat halaman dibuka, anggota yang sudah check-in langsung menempati meja (atau pantry jika siklus kopi sedang berjalan). Tidak mengulang masuk dari pintu. Pilih Eka → Check-in: berjalan dari lounge ke meja 5.
- Pilih Istirahat: avatar berjalan melalui pintu kaca ke lounge; bubble hanya menampilkan percakapan ilustrasi.
- Pilih Checkout: avatar menuju lounge pada jam kerja atau kamar tidur di luar jadwal; bubble offline disembunyikan. Meja tetap tersedia. Menghapus anggota dari roster menghilangkan avatarnya.
- Sepuluh meja permanen per area: lima kursi di setiap sisi meja komunal. Tambah anggota kesebelas untuk area kedua. Hapus anggota: avatar hilang dan meja menjadi kosong; perabot meja tetap tersedia.
- Simulasi 15 menit → pantry: karakter berjalan ke pantry, memegang/minum kopi, lalu kembali setelah siklus 60 detik. Timer memakai accumulated_seconds + interval kerja aktif; tidak menulis presensi.
- Ubah avatar: pilih model, rambut, warna rambut/pakaian, dan kacamata. Pratinjau langsung, Simpan atau Batal. Simulasi disimpan di browser; akun asli disimpan di database.
- Pilih Jeda animasi: perubahan presensi langsung menampilkan posisi akhir, tanpa perjalanan. Preferensi reduced motion mengikuti sistem.
- `/dashboard` langsung membuka kantor 3D layar penuh dengan branding, jam realtime, tombol kembali ke dashboard statistik, dock ringkas, floating presensi, dan sidebar aplikasi yang bisa dibuka dari kanan. Orbit bebas 360 derajat, tanpa tab kamera Semua/Meja/dll. Statistik dimuat terpisah hanya saat dibuka. Root `/`, callback login, dan start_url PWA menuju dashboard; tidak ada pengalihan mobile ke presensi.
- Permukaan meja 3D → pilih meja kosong → Klaim & pindah. Kepemilikan satu meja per pengguna, termasuk saat offline. Pindah otomatis melepas meja sebelumnya.
- Admin/owner → ikon Edit ruangan → pilih/seret meja (termasuk kursi dan perangkat) atau ornamen, putar meja 90 derajat atau ornamen 45 derajat, tambah atau hapus, lalu Simpan denah. Batal mengembalikan denah tersimpan. Lokasi lorong, dinding, meja/kursi dan sofa dilindungi dari ornamen.
- Preview default menampilkan UI game. Tombol Tampilan review mengembalikan panel lengkap. Dalam simulasi, pilih Tim → anggota → Mode admin/anggota untuk menguji kontrol editor tanpa menyentuh produksi.

Preview memakai data fiktif; avatar, denah, dan klaim meja simulasi disimpan dalam localStorage. Tombol simulasi tidak menulis ke Supabase atau ClickUp.

## Sumber data dan batas modul

`GET /api/spatial-office` memverifikasi token ClickUp melalui `/user`, keanggotaan workspace yang dikonfigurasi, dan status akun dari `app_user_roles`. Cookie nama/email/role tidak dipakai untuk otorisasi. Endpoint didaftarkan pada catch-all API agar kompatibel dengan deployment saat ini.

Roster menggunakan workspace ClickUp yang sama dengan halaman Team. Presensi menggunakan `active_sessions`. Pencocokan mendahulukan ID/email; data legacy tanpa keduanya harus memiliki nama atau alias yang persis sama dan unik. Tidak ada pencocokan substring. Email dan catatan presensi tidak dikirim ke scene.

Realtime Supabase menginvalidasi snapshot; polling 10 detik dan refresh ketika kembali ke tab menjadi fallback. Roster server boleh dicache selama 30 detik. Nama duplikat yang hanya memiliki presensi legacy tidak dianggap hadir secara otomatis. Snapshot gagal tidak dianggap sebagai checkout; respons 401/403 menghapus data yang sudah tidak boleh dilihat.

Meja ditetapkan otomatis bagi roster awal/anggota baru, lalu dapat diklaim ulang ke meja kosong. Pilihan yang tersimpan selalu dipertahankan lintas reload dan perangkat. Penambahan anggota tidak menggeser meja anggota lama; pengguna yang dihapus dari roster tidak mempertahankan klaim. Saat semua 10 meja penuh, anggota ke-11 mendapat area berikutnya.

Klaim dan ornamen disimpan dalam satu row `app_settings`, key `spatial-space:<workspace>:v1`. PATCH membandingkan JSON `revision` secara atomik pada database; insert awal memakai ignore-duplicates. Konflik dibaca ulang dan dicoba maksimal 3 kali. Klaim menolak meja milik orang lain dan tidak menerima ID pemilik dari client. Editor memeriksa `layoutRevision` agar dua admin tidak menimpa denah. Role admin/owner atau is_superuser dibaca dari `app_user_roles` menggunakan email dari token ClickUp yang diverifikasi; cookie role, identitas client, dan hardcoded email tidak memberi akses editor. `PATCH /api/spatial-office` hanya mendukung action claim/layout/activity. Klaim tidak mengganti status presensi.

Editor memakai model GLB yang diizinkan (tanaman, lampu, rak buku, papan tulis, meja dekorasi, vas, karpet), maksimal 120 objek; validasi server dan client memeriksa tipe, koordinat, batas kantor/taman, lorong, dinding, dan tabrakan antardekorasi. Meja dapat digeser dan diputar: seluruh perangkat dan kursi mengikutinya. Server menolak tabrakan meja dan denah tanpa jalur menuju kursi. Jalur meja kustom dicari pada grid ruang kerja; sofa, pantry, taman dan kamar tidur memakai koridor tetap. Karakter berpindah melalui lorong saat pemilik mengubah meja, termasuk ketika perubahan berikutnya datang saat masih berjalan.

Tidak memerlukan migration SQL baru jika tabel bawaan `app_settings` sudah tersedia. Presensi memakai koneksi baca yang sama. Penyimpanan avatar, kepemilikan meja, dan editor kantor memerlukan `SUPABASE_SERVICE_ROLE_KEY` di server dan tabel `app_settings`; tanpa itu presensi dan pratinjau tetap berjalan, tetapi UI menjelaskan bahwa penyimpanan akun belum tersedia dan menonaktifkan klaim/editor. `PUT /api/spatial-office` memverifikasi token, anggota workspace, akun aktif, origin, dan pilihan avatar. Key `spatial-avatar:<workspace>:<verified-user-id>` ditentukan server, tidak menerima ID pemilik dari client. Secret tidak dikirim ke browser. Login cookie simulasi lokal tidak cukup untuk membaca data asli.

## Aset dan rendering

- Sumber: `src/Char-assets` milik pengguna; disalin ke `public/spatial-assets` oleh lifecycle predev/prebuild/prepages:build. Hasil salinan tidak dikomit.
- Three.js dimuat pada beranda kantor; statistik/Recharts dipisah ke chunk lain agar tidak ikut dimuat saat pertama membuka kantor. `GLTFLoader` memuat model dan `OrbitControls` mengatur kamera.
- Karakter, rambut, furnitur dan lantai memakai GLB yang disediakan. Jalan, trotoar, taman, dinding solid, pintu geser, ranjang dan mesin kopi sederhana dibuat dari geometri Three.js. Atap ditiadakan untuk tampilan cutaway; seluruh sisi ruangan dibatasi dinding biasa. Sistem sumber Z-up dikonversi menjadi Y-up.
- GLB tidak memiliki skeleton, skin, atau animation clip. Gerakan berjalan, duduk dan mengetik berupa artikulasi terbatas dari mesh tubuh bernama. Ini bukan motion capture atau rig humanoid.
- Furnitur digabung per aset dan karakter digabung per sendi agar draw call lebih sedikit. Geometry/material dilepas saat instance dihapus, observer/listener/renderer dilepas saat unmount.
- Maksimum 30 FPS, DPR maksimum 1.5; rendering berhenti saat halaman tersembunyi atau scene di luar viewport. Kamera menyesuaikan layar portrait. Daftar anggota tetap bisa digunakan tanpa WebGL.
- Percakapan ilustrasi berganti setiap 11 detik berdasarkan project/tugas aktif dan tujuan avatar. Tidak menampilkan bubble offline, tidur, atau narasi berjalan. Panel aktivitas menjelaskan bahwa teks dan gerakan bersifat ilustrasi, bukan pesan yang dikirim anggota. Tidak menyimpulkan penyelesaian tugas.

## Verifikasi

```sh
node --experimental-strip-types --test tests/spatial-office*.test.mjs
npx tsc --noEmit
npx eslint components/spatial-office lib/spatial-office app/api/spatial-office app/office-preview
npm run build -- --webpack
```

43 pengujian lulus (termasuk jadwal/shift malam, aktivitas sementara, kamar tidur/taman, meja bergerak, dan otorisasi aktivitas): timer/bubble, identitas, kontak keyboard, jalur sepuluh kursi, klaim yang bersamaan (row baru/lama), klaim bersamaan dengan editor, role admin, penolakan identitas palsu/origin asing, validasi ornamen, dan scene menggunakan GLB asli untuk perpindahan meja, posisi awal, serta tambah/geser/putar/hapus/batal dekorasi. Pemeriksaan skema live (read-only) mengonfirmasi kolom role dan filter revision PostgREST tersedia. Tidak ada klaim, denah, atau data presensi produksi yang diubah untuk pengujian.

Build webpack, TypeScript, dan ESLint pada modul kantor lulus. Layout lama mempunyai dua peringatan lint `set-state-in-effect` pada pemeriksaan akses yang sudah ada; alur akses tidak diubah. Review browser HTTPS: tanpa overflow pada 1366 px; editor mobile 390 px berhasil menggeser meja 1 ke X=-4.50 dan menyimpan denah simulasi. Versi sebelumnya sudah menampilkan kamar tidur, karakter berbaring, langit malam, jam realtime dan neon. Bug gambar publik yang diarahkan ke login diperbaiki dengan static import. Simpan dengan akun produksi masih memerlukan sesi login; pengujian endpoint memakai fixture otorisasi, bukan menulis data tim produksi.

## Waktu, aktivitas, branding

- Jam realtime dan cahaya pagi/siang/sore/malam mengikuti timezone jadwal `/api/attendance/schedule`, default Asia/Makassar, Sen–Jum 08:30–17:30 bila jadwal belum tersedia. Langit/awan/bintang adalah suasana visual berdasar jam, bukan prakiraan cuaca meteorologis.
- Avatar tidak bekerja di luar jadwal berbaring di kamar tidur di sayap kiri. Check-in aktif tetap bekerja (termasuk lembur); istirahat pada jam kerja memakai lounge. Tidak mengubah jadwal atau catatan presensi.
- Otomatis: 15 menit kerja → pantry 1 menit; 30 menit → taman 2 menit; siklus berulang. Avatar sendiri bisa diarahkan ke taman/pantry/lounge selama 5 menit, lalu kembali otomatis. Pilihan disimpan di row kantor bersama, ditentukan menggunakan identitas server dan tidak menerima userId client. Anggota lain melihat aktivitas sesudah realtime/polling.
- Header dan neon box memakai satu sumber `lib/spatial-office/branding.ts`, sesuai logo `src/logobilik-hitam.png` yang sama dengan sidebar collapse, diimpor sebagai static asset agar dapat dimuat pada preview tanpa login. Deployment branding lain dapat mengisi `NEXT_PUBLIC_APP_NAME` dan `NEXT_PUBLIC_APP_LOGO`. Neon memakai teks transparan saja (tanpa latar putih atau gambar logo), dengan akhiran Agency dan running text; jeda animasi/reduced motion menghentikan pergerakannya.
- Tidak ada SQL baru: posisi meja, aktivitas, ornamen, dan klaim memakai row `app_settings` yang sama, dengan migrasi bentuk JSON secara kompatibel saat dibaca.

## Revisi ruangan dan library objek

- Kamar tidur pindah ke sayap kiri (X < -6), dihubungkan pintu samping pada Z=4.5. Pose tidur tidak memakai gerakan idle; nama tetap ada, bubble percakapan disembunyikan dan indikator zzz statis muncul.
- Ruang manager dan project lead berada di belakang workspace, masing-masing dengan satu meja terpisah, kursi kantor/tamu, laptop, keyboard, lampu, pena, lemari/rak, tanaman, karpet, dan lukisan. Meja set bawaan menggeser/memutar kursi dan perangkatnya bersama-sama. Ruang baru tidak mengubah sepuluh klaim meja yang sudah ada.
- Nomor meja tidak tampil di kanvas. Klik permukaan meja untuk membuka panel kepemilikan. Seret kamera tidak dianggap sebagai klik meja.
- Tombol mode kamera berganti antara Orbit dan Geser. Tombol mouse kanan juga menggeser, dua jari melakukan geser dan zoom. Orbit tetap bebas 360 derajat.
- Admin: Edit ruangan → Library objek → pilih kategori, cari aset, dan pilih ruangan penempatan. Ada 30 model GLB dari folder pengguna. Objek bisa digeser, diputar, diberi warna, diatur ketinggiannya (0,78 m untuk peralatan meja), atau dihapus. Denah dan warna tersimpan bersama revision yang sama; anggota biasa tidak dapat menulis layout.
- Bentuk JSON kantor naik ke version 2 ketika dibaca/disimpan. Klaim dan revisi lama tetap dipertahankan; perlengkapan dua kantor baru hanya ditambahkan sekali sehingga penghapusan berikutnya oleh admin tetap berlaku. Tidak ada SQL tambahan.
- Apple PWA status bar memakai `default`, HUD menghormati safe-area atas/kiri/kanan, dan dekorasi blur global tidak diterapkan ke shell kantor. Pengujian ukuran viewport tablet tidak menggantikan pemeriksaan pada iPad fisik.

## Aset yang disarankan berikutnya

Untuk gerakan lebih natural: karakter GLB dengan skeleton + skin dan klip `Idle`, `Walk`, `SitDown`, `Typing`, `StandUp`. Pertahankan skala dan orientasi konsisten. Aset sekarang tetap bisa dipakai untuk review tata ruang. Untuk peningkatan berikutnya, siapkan animasi `DrinkCoffee` dan model mesin kopi yang lebih detail. Untuk kamar tidur, tambahkan aset tempat tidur dan klip `LieDown`/`Sleep` agar lebih natural; versi saat ini memakai ranjang geometri dan artikulasi mesh GLB yang tersedia.

Referensi implementasi: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [filter JSON dan conditional PATCH PostgREST](https://docs.postgrest.org/en/stable/references/api/tables_views.html).
