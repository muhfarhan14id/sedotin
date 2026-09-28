import { UA, UserError, finish, safeName } from './util.js';

const VER = '1.60.19';
const ID_RE = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([\w-]{11})/;
export const ytId = (u) => u.match(ID_RE)?.[1];

async function player(id) {
  const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': `com.google.android.apps.youtube.vr.oculus/${VER} (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip`,
      'x-youtube-client-name': '28',
      'x-youtube-client-version': VER,
      origin: 'https://www.youtube.com',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'ANDROID_VR', clientVersion: VER, deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, osName: 'Android', osVersion: '12L', hl: 'en', gl: 'US' } },
      videoId: id, contentCheckOk: true, racyCheckOk: true,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json();
  if (j.playabilityStatus?.status !== 'OK') {
    throw new UserError(`YouTube: ${j.playabilityStatus?.reason || 'video tidak bisa diputar'}. Bila muncul "Sign in to confirm you're not a bot", isi COBALT_API_URL sebagai fallback.`);
  }
  return j;
}

// Dipanggil oleh /api/proxy: resolve ulang di invocation yang sama karena URL googlevideo terikat IP.
export async function ytResolve(id, itag) {
  const j = await player(id);
  const all = [...(j.streamingData?.formats || []), ...(j.streamingData?.adaptiveFormats || [])];
  const f = all.find((x) => String(x.itag) === String(itag) && x.url);
  if (!f) throw new UserError('Format YouTube tidak tersedia');
  return f.url;
}

export async function youtubeVideo(url) {
  const id = ytId(url);
  if (!id) throw new UserError('Link YouTube tidak valid');
  const j = await player(id);
  const vd = j.videoDetails || {};
  const title = vd.title || `youtube-${id}`;
  const link = (itag, ext) => `/api/proxy?yt=${id}&itag=${itag}&n=${encodeURIComponent(safeName(title, ext))}`;

  const items = (j.streamingData?.formats || [])
    .filter((f) => f.url && f.mimeType?.startsWith('video/mp4'))
    .sort((a, b) => (b.height || 0) - (a.height || 0))
    .map((f) => ({ label: `MP4 ${f.qualityLabel || f.height + 'p'}`, ext: 'mp4', kind: 'video', href: link(f.itag, 'mp4') }));

  const audio = (j.streamingData?.adaptiveFormats || [])
    .filter((f) => f.url && f.mimeType?.startsWith('audio/mp4'))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  if (audio) items.push({ label: 'Audio M4A', ext: 'm4a', kind: 'audio', href: link(audio.itag, 'm4a') });
  if (!items.length) throw new UserError('Tidak ada format yang bisa diunduh untuk video ini');

  return finish({
    platform: 'youtube',
    title,
    author: vd.author,
    thumbnail: vd.thumbnail?.thumbnails?.at(-1)?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration: Number(vd.lengthSeconds) || undefined,
    stats: { views: Number(vd.viewCount) || undefined },
    items,
  });
}
