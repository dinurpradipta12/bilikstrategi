# Kantor 3D — modul 1

## Review

- `npm run dev -- --port 3014`, buka `/office-preview` untuk simulasi tanpa login.
- Pilih Eka → Check-in: avatar masuk melalui jalur masuk, melewati lorong, lalu duduk di meja 5.
- Pilih Istirahat: avatar tetap di meja, gerakan mengetik berhenti, bubble istirahat muncul.
- Pilih Checkout: avatar berjalan ke pintu keluar, kemudian hilang; meja tetap tersedia.
- Tambah anggota ketujuh: area kedua muncul. Hapus anggota: meja dan avatar hilang.
- Pilih Jeda animasi: perubahan presensi langsung menampilkan posisi akhir, tanpa perjalanan. Preferensi reduced motion mengikuti sistem.
- `/dashboard` membuka tab Kantor 3D. Tab dashboard statistik dan personal tetap tersedia.

Preview hanya memakai state React dan data fiktif. Tombol simulasi tidak menulis ke Supabase atau ClickUp.

## Sumber data dan batas modul

`GET /api/spatial-office` memverifikasi token ClickUp melalui `/user`, keanggotaan workspace yang dikonfigurasi, dan status akun dari `app_user_roles`. Cookie nama/email/role tidak dipakai untuk otorisasi. Endpoint didaftarkan pada catch-all API agar kompatibel dengan deployment saat ini.

Roster menggunakan workspace ClickUp yang sama dengan halaman Team. Presensi menggunakan `active_sessions`. Pencocokan mendahulukan ID/email; data legacy tanpa keduanya harus memiliki nama atau alias yang persis sama dan unik. Tidak ada pencocokan substring. Email dan catatan presensi tidak dikirim ke scene.

Realtime Supabase menginvalidasi snapshot; polling 10 detik dan refresh ketika kembali ke tab menjadi fallback. Roster server boleh dicache selama 30 detik. Nama duplikat yang hanya memiliki presensi legacy tidak dianggap hadir secara otomatis. Snapshot gagal tidak dianggap sebagai checkout; respons 401/403 menghapus data yang sudah tidak boleh dilihat.

Meja mengikuti ID anggota, tetap stabil selama tampilan terbuka, dan slot kosong dipakai oleh anggota baru. Saat halaman dibuka ulang, urutan awal ditentukan dari ID. Penetapan denah lintas perangkat yang dapat diedit dan disimpan merupakan modul lanjutan. Satu area memakai meja komunal panjang dengan tiga kursi berhadapan di setiap sisi, tanpa membatasi jumlah anggota keseluruhan.

Tidak memerlukan migration SQL baru. Server menggunakan koneksi baca Supabase yang sama dengan presensi serta token ClickUp pengguna yang diverifikasi. Modul ini tidak membutuhkan service-role key tambahan. Login cookie simulasi lokal tidak cukup untuk membaca data asli.

## Aset dan rendering

- Sumber: `src/Char-assets` milik pengguna; disalin ke `public/spatial-assets` oleh lifecycle predev/prebuild/prepages:build. Hasil salinan tidak dikomit.
- Three.js dimuat hanya saat tab kantor dibuka. `GLTFLoader` memuat model dan `OrbitControls` mengatur kamera.
- Semua karakter/furnitur/floor/wall memakai GLB yang disediakan. Sistem sumber Z-up dikonversi menjadi Y-up.
- GLB tidak memiliki skeleton, skin, atau animation clip. Gerakan berjalan, duduk dan mengetik berupa artikulasi terbatas dari mesh tubuh bernama. Ini bukan motion capture atau rig humanoid.
- Furnitur digabung per aset dan karakter digabung per sendi agar draw call lebih sedikit. Geometry/material dilepas saat instance dihapus, observer/listener/renderer dilepas saat unmount.
- Maksimum 30 FPS, DPR maksimum 1.5; rendering berhenti saat halaman tersembunyi atau scene di luar viewport. Kamera menyesuaikan layar portrait. Daftar anggota tetap bisa digunakan tanpa WebGL.
- Bubble adalah status/project presensi dan ilustrasi suasana; tidak membuat percakapan atas nama anggota atau menyimpulkan produktivitas.

## Verifikasi

```sh
node --experimental-strip-types --test tests/spatial-office.test.mjs
npx tsc --noEmit
npx eslint components/spatial-office lib/spatial-office app/api/spatial-office app/office-preview
npm run build -- --webpack
```

Review browser lokal mencakup pemuatan GLB, check-in → duduk, checkout → keluar, penambahan/hapus anggota, perpindahan area, serta portrait tanpa overflow horizontal. Endpoint tanpa token dan cookie identitas palsu mengembalikan 401. Data asli dipilih melalui mode Data tim langsung atau dashboard, sedangkan mode Simulasi desain selalu memakai nama contoh.

## Aset yang disarankan berikutnya

Untuk gerakan lebih natural: karakter GLB dengan skeleton + skin dan klip `Idle`, `Walk`, `SitDown`, `Typing`, `StandUp`. Pertahankan skala dan orientasi konsisten. Aset sekarang tetap bisa dipakai untuk review tata ruang. Denah yang bisa disimpan dan pemilihan avatar per anggota dapat dikerjakan sebagai modul berikutnya setelah review visual.

Referensi implementasi: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).
