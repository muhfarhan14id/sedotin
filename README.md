# Sedotin

1. **Downloader** video **TikTok & Instagram** (tempel link → unduh).
2. **Portal Siswa SMK Bina Rahayu**: siswa login ke e-learning sekolah lewat tampilan yang enak, lihat **nama, username, profil**, dan **nilai kuis** dengan memasukkan **ID mapel** dari guru.

Tanpa build step, tanpa dependency — langsung jalan di Vercel.

## Deploy

```bash
npm run deploy      # = npx vercel --prod --yes
```

Portal siswa **tidak butuh secret key** atau env apa pun. Env di bawah semuanya opsional (Vercel → Settings → Environment Variables, lalu redeploy):

| Nama | Wajib? | Fungsi |
|------|--------|--------|
| `MAPEL_LIST` | Tidak | JSON daftar kuis dari guru → jadi tombol pilihan setelah login. Contoh: `[{"id":123,"nama":"Jaringan Dasar - UH 1"}]` |
| `ELEARNING_BASE_URL` | Tidak | Default `https://e-learning.smkbinarahayu.sch.id` |
| `IG_SESSIONID` | Tidak | Cookie `sessionid` Instagram (akun cadangan) supaya Instagram stabil. |

Lokal: `npm run dev` → http://localhost:3000 (buat file `.env` dari `.env.example`).

## Struktur

```
public/index.html          UI (satu file): tab Downloader + Portal Siswa
api/download.js            GET  /api/download?url=…        metadata + link unduhan (TikTok/IG)
api/proxy.js               GET  /api/proxy?u=…&n=nama.mp4  stream file (allowlist CDN TikTok/IG)
api/portal/login.js        POST /api/portal/login          {username,password}
api/portal/me.js           GET  /api/portal/me             nama, username, profil
api/portal/quiz.js         GET  /api/portal/quiz?id=123    nilai/percobaan kuis
api/portal/logout.js       POST /api/portal/logout         akhiri sesi
api/_lib/config.js         URL e-learning (baseUrl, loginUrl, quizUrlTemplate, dst.) + MAPEL_LIST
api/_lib/moodle.js         klien Moodle: login token, cookie jar, parser profil & kuis
api/_lib/session.js        token sesi stateless (validasi ketat), cek origin, rate limit login
api/_lib/tiktok.js, instagram.js, util.js
```

## Cara kerja Portal Siswa (stateless, tanpa secret key)

1. Siswa isi username + sandi → server login ke `/login/index.php` (dengan `logintoken`) atas nama siswa. Sandi hanya dipakai sekali ini, **tidak disimpan/dicatat** dan tidak dikirim ulang.
2. Server membalas dengan **token** berisi cookie sesi Moodle milik siswa itu sendiri. Server tidak menyimpan apa pun.
3. Browser menyimpan token di `sessionStorage` (hilang saat tab ditutup) dan mengirimnya lewat header `x-portal-token` di tiap request (`/me`, `/quiz`, `/logout`). Server memvalidasi token dengan ketat lalu meneruskannya ke e-learning.
4. Profil dari `/user/profile.php`; nilai dari `quizUrlTemplate` (`/mod/quiz/view.php?id={id}`). ID hanya boleh angka, host tujuan dikunci ke e-learning sekolah.
5. **Keluar** juga memanggil logout di Moodle, jadi sesi langsung mati. Masa berlaku sesi ditentukan Moodle sendiri.

Guru cukup memberi siswa ID kuis (angka di URL `.../mod/quiz/view.php?id=123`), atau isi `MAPEL_LIST` supaya siswa tinggal klik.

## Catatan

- Parser membaca HTML Moodle standar (tema Boost). Kalau tema sekolah beda dan ada bagian yang tidak terbaca, UI tetap menampilkan "teks asli halaman" sebagai cadangan; tinggal sesuaikan regex di `api/_lib/moodle.js`.
- Pembatas login (8/menit/IP) bersifat best-effort per instance serverless.
- TikTok via tikwm.com, Instagram via API privat/embed (sering diblokir IP datacenter → isi `IG_SESSIONID`).
