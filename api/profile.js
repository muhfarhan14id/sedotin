import { wrap, detect, UserError } from './_lib/util.js';
import { tiktokProfile } from './_lib/tiktok.js';
import { instagramProfile } from './_lib/instagram.js';

function userFromUrl(raw, platform) {
  const seg = new URL(raw).pathname.split('/').filter(Boolean);
  if (platform === 'instagram' && ['p', 'reel', 'reels', 'tv', 'stories', 'explore'].includes(seg[0])) {
    throw new UserError('Ini link video, bukan profil. Pindah ke tab "Link video".');
  }
  return (seg[0] || '').replace(/^@/, '');
}

export default wrap(async (req) => {
  let platform = String(req.query.platform || '');
  let user = String(req.query.q || '').trim();
  if (!user) throw new UserError('Masukkan username atau link profil');

  const detected = detect(user);
  if (detected) {
    if (!['tiktok', 'instagram'].includes(detected)) throw new UserError('Scrape profil hanya untuk TikTok dan Instagram');
    platform = detected;
    user = userFromUrl(user, platform);
  }
  user = user.replace(/^@/, '');
  if (!['tiktok', 'instagram'].includes(platform)) throw new UserError('Pilih platform: TikTok atau Instagram');
  if (!/^[\w.]{1,40}$/.test(user)) throw new UserError('Username tidak valid');

  return platform === 'tiktok' ? tiktokProfile(user) : instagramProfile(user);
});
