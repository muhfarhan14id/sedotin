import { getJson, sleep, UserError, finish, img, proxied, safeName } from './util.js';

const API = 'https://www.tikwm.com';
const abs = (u) => (!u ? null : u.startsWith('http') ? u : API + u);

export async function tiktokVideo(url) {
  const j = await getJson(`${API}/api/?url=${encodeURIComponent(url)}&hd=1`);
  if (j.code !== 0) throw new UserError(j.msg || 'Video TikTok tidak ditemukan');
  const d = j.data;
  const items = [];
  if (Array.isArray(d.images) && d.images.length) {
    d.images.forEach((u, i) => items.push({ label: `Foto ${i + 1}`, ext: 'jpg', kind: 'image', url: u }));
  } else {
    if (d.hdplay) items.push({ label: 'MP4 HD', ext: 'mp4', kind: 'video', url: abs(d.hdplay) });
    if (d.play) items.push({ label: 'MP4 tanpa watermark', ext: 'mp4', kind: 'video', url: abs(d.play) });
    if (d.wmplay) items.push({ label: 'MP4 dengan watermark', ext: 'mp4', kind: 'video', url: abs(d.wmplay) });
  }
  if (d.music) items.push({ label: 'Audio MP3', ext: 'mp3', kind: 'audio', url: abs(d.music) });
  return finish({
    platform: 'tiktok',
    title: d.title,
    author: d.author ? `${d.author.nickname} (@${d.author.unique_id})` : '',
    thumbnail: d.cover,
    duration: d.duration,
    stats: { views: d.play_count, likes: d.digg_count },
    items,
  });
}

export async function tiktokProfile(username) {
  const info = await getJson(`${API}/api/user/info?unique_id=${encodeURIComponent(username)}`);
  if (info.code !== 0 || !info.data?.user) throw new UserError('Akun TikTok tidak ditemukan');
  const { user, stats } = info.data;

  let cursor = 0;
  const videos = [];
  for (let page = 0; page < 3; page++) {
    await sleep(1150); // tikwm membatasi ±1 request/detik
    const j = await getJson(`${API}/api/user/posts?unique_id=${encodeURIComponent(username)}&count=30&cursor=${cursor}`);
    if (j.code !== 0) break;
    videos.push(...(j.data?.videos || []));
    if (!j.data?.hasMore) break;
    cursor = j.data.cursor;
  }
  const pool = videos.filter((v) => v.play && !(v.images && v.images.length));
  if (!pool.length) throw new UserError('Tidak ada video publik yang bisa diambil dari akun ini');

  const top = [...pool].sort((a, b) => (b.play_count || 0) - (a.play_count || 0)).slice(0, 3).map((v, i) => {
    const title = v.title || `${username}-${v.video_id}`;
    const src = v.play.startsWith('http') ? v.play : API + v.play;
    return {
      rank: i + 1,
      title,
      cover: img(v.cover),
      duration: v.duration,
      views: v.play_count,
      likes: v.digg_count,
      link: `https://www.tiktok.com/@${username}/video/${v.video_id}`,
      items: [{ label: 'MP4', ext: 'mp4', kind: 'video', href: proxied(src, safeName(title, 'mp4')) }],
    };
  });

  return {
    platform: 'tiktok',
    profile: {
      username: user.uniqueId,
      name: user.nickname,
      avatar: img(user.avatarMedium || user.avatarThumb),
      bio: user.signature,
      verified: !!user.verified,
      followers: stats?.followerCount,
      posts: stats?.videoCount,
    },
    scanned: pool.length,
    top,
  };
}
