import { wrap, detect, finish, UserError } from './_lib/util.js';
import { tiktokVideo } from './_lib/tiktok.js';
import { instagramVideo } from './_lib/instagram.js';

const PROVIDERS = { tiktok: tiktokVideo, instagram: instagramVideo };

export default wrap(async (req) => {
  const url = String(req.query.url || '').trim();
  const platform = detect(url);
  if (!platform) throw new UserError('Link tidak dikenali. Pakai link TikTok atau Instagram.');
  return PROVIDERS[platform](url);
});
