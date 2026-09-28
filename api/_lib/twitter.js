import { getJson, UserError, finish } from './util.js';

export async function twitterVideo(url) {
  const id = url.match(/status(?:es)?\/(\d+)/)?.[1];
  if (!id) throw new UserError('Link X/Twitter tidak valid (harus link tweet)');

  // 1) FxTwitter
  try {
    const t = (await getJson(`https://api.fxtwitter.com/status/${id}`)).tweet;
    const vids = t?.media?.videos || [];
    const photos = t?.media?.photos || [];
    if (vids.length || photos.length) {
      const items = [
        ...vids.map((v, i) => ({ label: vids.length > 1 ? `Video ${i + 1}` : 'MP4', ext: 'mp4', kind: 'video', url: v.url })),
        ...photos.map((p, i) => ({ label: `Foto ${i + 1}`, ext: 'jpg', kind: 'image', url: p.url })),
      ];
      return finish({
        platform: 'twitter',
        title: t.text,
        author: t.author ? `${t.author.name} (@${t.author.screen_name})` : '',
        thumbnail: vids[0]?.thumbnail_url || photos[0]?.url,
        duration: vids[0]?.duration ? Math.round(vids[0].duration) : undefined,
        stats: { likes: t.likes, views: t.views },
        items,
      });
    }
  } catch { /* lanjut ke fallback */ }

  // 2) VxTwitter
  const v = await getJson(`https://api.vxtwitter.com/Twitter/status/${id}`);
  const media = (v.media_extended || []).filter((m) => m.url);
  if (!media.length) throw new UserError('Tweet ini tidak berisi video atau foto');
  return finish({
    platform: 'twitter',
    title: v.text,
    author: `${v.user_name} (@${v.user_screen_name})`,
    thumbnail: media[0].thumbnail_url || media[0].url,
    stats: { likes: v.likes },
    items: media.map((m, i) => ({
      label: m.type === 'image' ? `Foto ${i + 1}` : media.length > 1 ? `Video ${i + 1}` : 'MP4',
      ext: m.type === 'image' ? 'jpg' : 'mp4',
      kind: m.type === 'image' ? 'image' : 'video',
      url: m.url,
    })),
  });
}
