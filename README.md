# Sedotin

Downloader video **TikTok, Instagram, YouTube, X/Twitter** + scraper profil **TikTok & Instagram** (3 video teratas). Tanpa build step, tanpa dependency — langsung jalan di Vercel.

## Deploy (auto setup)

```bash
npm run deploy      # = npx vercel --prod --yes  (login + buat project otomatis)
```

Atau lewat Git: push folder ini ke GitHub → Vercel → **Add New Project** → Import → Deploy (tanpa ubah setting apa pun).

Lokal: `npm run dev` lalu buka http://localhost:3000

## Struktur

```
public/index.html        UI (satu file)
api/download.js          GET /api/download?url=…            metadata + link unduhan
api/profile.js           GET /api/profile?q=…&platform=…    profil + 3 video teratas
api/proxy.js             GET /api/proxy?u=…&n=nama.mp4      stream file (allowlist CDN)
api/_lib/*.js            provider per platform
```

## Sumber data per platform

| Platform  | Video | Profil / Top 3 | Sumber | Catatan |
|-----------|-------|----------------|--------|---------|
| TikTok    | ✅ | ✅ (dari ±90 video terbaru, urut tayangan) | tikwm.com | Paling stabil. Ada foto-slideshow & MP3. |
| X/Twitter | ✅ | – | FxTwitter → VxTwitter | Stabil. |
| YouTube   | ✅ | – | Innertube (ANDROID_VR) → cobalt | MP4 progresif (biasanya 360p) + audio M4A. Bisa diblokir di IP datacenter. |
| Instagram | ✅ | ✅ (dari 12 postingan terbaru) | API privat (butuh cookie) → embed | **Sering diblokir tanpa login.** Isi `IG_SESSIONID`. |

## Environment variable (opsional)

| Nama | Fungsi |
|------|--------|
| `IG_SESSIONID` | Cookie `sessionid` akun Instagram. Sangat disarankan supaya Instagram stabil. Pakai akun cadangan. |
| `COBALT_API_URL`, `COBALT_API_KEY` | Fallback via instance cobalt milikmu (untuk YouTube 720p+ dsb). |

Set di **Vercel → Project → Settings → Environment Variables**, lalu redeploy.

## Batasan yang perlu diketahui

- YouTube & Instagram membatasi permintaan dari IP datacenter; ini di luar kendali kode. Kalau error, isi env di atas.
- Proxy di-stream (tidak kena batas 4,5 MB), tapi durasi fungsi dibatasi 60 detik; file sangat besar bisa terputus.
- `api.tikwm.com` gratis dengan batas ±1 request/detik, jadi scrape profil butuh beberapa detik.
- Layanan pihak ketiga bisa berubah kapan saja; logikanya terisolasi di `api/_lib/` supaya mudah diganti.
