import { getJson, UA, UserError, finish, img, proxied, safeName } from './util.js';

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

export async function instagramProfile(username) {
  let j;
  try {
    j = await getJson(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, { headers: IGH() });
  } catch (e) {
    throw new UserError(`${e.message}. ${BLOCK_HINT}`);
  }
  const user = j.data?.user;
  if (!user) throw new UserError('Akun Instagram tidak ditemukan');
  if (user.is_private) throw new UserError('Akun Instagram ini privat');

  const nodes = (user.edge_owner_to_timeline_media?.edges || []).map((e) => e.node);
  const vids = nodes.filter((n) => n.is_video && n.video_url);
  if (!vids.length) throw new UserError('Tidak ada video di 12 postingan terbaru akun ini');
  const score = (n) => n.video_view_count || n.video_play_count || n.edge_media_preview_like?.count || n.edge_liked_by?.count || 0;

  const top = [...vids].sort((a, b) => score(b) - score(a)).slice(0, 3).map((n, i) => {
    const title = n.edge_media_to_caption?.edges?.[0]?.node?.text?.split('\n')[0] || `${username}-${n.shortcode}`;
    return {
      rank: i + 1,
      title,
      cover: img(n.display_url || n.thumbnail_src),
      duration: n.video_duration ? Math.round(n.video_duration) : undefined,
      views: n.video_view_count || n.video_play_count,
      likes: n.edge_media_preview_like?.count ?? n.edge_liked_by?.count,
      link: `https://www.instagram.com/p/${n.shortcode}/`,
      items: [{ label: 'MP4', ext: 'mp4', kind: 'video', href: proxied(n.video_url, safeName(title, 'mp4')) }],
    };
  });

  return {
    platform: 'instagram',
    profile: {
      username: user.username,
      name: user.full_name,
      avatar: img(user.profile_pic_url_hd || user.profile_pic_url),
      bio: user.biography,
      verified: !!user.is_verified,
      followers: user.edge_followed_by?.count,
      posts: user.edge_owner_to_timeline_media?.count,
    },
    scanned: vids.length,
    note: 'Instagram hanya membuka 12 postingan terbaru tanpa login, jadi "teratas" dihitung dari video di dalamnya.',
    top,
  };
}
