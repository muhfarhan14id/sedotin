import { wrap, detect, cobalt, finish, UserError } from './_lib/util.js';
import { tiktokVideo } from './_lib/tiktok.js';
import { instagramVideo } from './_lib/instagram.js';
import { youtubeVideo } from './_lib/youtube.js';
import { twitterVideo } from './_lib/twitter.js';

const PROVIDERS = { tiktok: tiktokVideo, instagram: instagramVideo, youtube: youtubeVideo, twitter: twitterVideo };

export default wrap(async (req) => {
  const url = String(req.query.url || '').trim();
  const platform = detect(url);
  if (!platform) throw new UserError('Link tidak dikenali. Pakai link TikTok, Instagram, YouTube, atau X/Twitter.');
  try {
    return await PROVIDERS[platform](url);
  } catch (err) {
    const alt = await cobalt(url).catch(() => null);
    if (!alt?.items?.length) throw err;
    return finish({ platform, author: '', ...alt });
  }
});
