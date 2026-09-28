import { getJson, UA, UserError, finish } from './util.js';

const IGH = () => ({
  'x-ig-app-id': '936619743392459',
  'x-requested-with': 'XMLHttpRequest',
  ...(process.env.IG_SESSIONID ? { cookie: `sessionid=${process.env.IG_SESSIONID}` } : {}),
});
const BLOCK_HINT =
  'Instagram menolak permintaan dari server (umum untuk IP datacenter Vercel). Isi env IG_SESSIONID di Vercel agar stabil, lalu redeploy.';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function shortcodeToId(code) {
  let id = 0n;
  for (const c of code.slice(0, 11)) id = id * 64n + BigInt(ALPHA.indexOf(c));
  return id.toString();
}

function collect(m, items, i) {
  const n = i == null ? '' : ` ${i + 1}`;
  if (m.video_versions?.length) items.push({ label: `MP4${n}`, ext: 'mp4', kind: 'video', url: m.video_versions[0].url });
  else if (m.image_versions2?.candidates?.length) items.push({ label: `Foto${n}`, ext: 'jpg', kind: 'image', url: m.image_versions2.candidates[0].url });
}

export async function instagramVideo(url) {
  const code = url.match(/\/(?:p|reel|reels|tv)\/([\w-]+)/)?.[1];
  if (!code) throw new UserError('Link Instagram harus berupa post atau reel (/p/… atau /reel/…)');

  // 1) API privat (butuh IG_SESSIONID) — paling stabil
  if (process.env.IG_SESSIONID) {
    try {
      const j = await getJson(`https://www.instagram.com/api/v1/media/${shortcodeToId(code)}/info/`, { headers: IGH() });
      const m = j.items?.[0];
      if (m) {
        const items = [];
        if (m.carousel_media) m.carousel_media.forEach((c, i) => collect(c, items, i));
        else collect(m, items);
        if (items.length) {
          return finish({
            platform: 'instagram',
            title: (m.caption?.text || '').split('\n')[0] || `instagram-${code}`,
            author: m.user?.username ? `@${m.user.username}` : '',
            thumbnail: m.image_versions2?.candidates?.[0]?.url,
            duration: m.video_duration ? Math.round(m.video_duration) : undefined,
            stats: { views: m.play_count || m.view_count, likes: m.like_count },
            items,
          });
        }
      }
    } catch { /* lanjut ke embed */ }
  }

  // 2) Scrape halaman embed (tanpa login, tapi sering diblokir dari datacenter)
  try {
    const r = await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, {
      headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(15000),
    });
    const html = await r.text();
    const grab = (key) => {
      const m = html.match(new RegExp(`${key}\\\\*"\\s*:\\s*\\\\*"(.*?)\\\\*"[,}]`));
      return m ? m[1].replace(/\\+u0026/g, '&').replace(/\\+\//g, '/').replace(/\\+/g, '') : null;
    };
    const video = grab('video_url');
    const photo = grab('display_url');
    const owner = html.match(/"username\\*":\s*\\*"([^"\\]+)/)?.[1];
    if (video || photo) {
      return finish({
        platform: 'instagram',
        title: `instagram-${code}`,
        author: owner ? `@${owner}` : '',
        thumbnail: photo,
        items: video
          ? [{ label: 'MP4', ext: 'mp4', kind: 'video', url: video }]
          : [{ label: 'Foto', ext: 'jpg', kind: 'image', url: photo }],
      });
    }
  } catch { /* jatuh ke error di bawah */ }

  throw new UserError(`Media Instagram tidak bisa diambil. Pastikan postingan publik. ${BLOCK_HINT}`);
}
