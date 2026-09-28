import { getJson, UserError, finish } from './util.js';

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
