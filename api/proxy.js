import { Readable } from 'node:stream';
import { UA } from './_lib/util.js';
import { ytResolve } from './_lib/youtube.js';

// Hanya host CDN milik keempat platform yang boleh di-proxy (cegah open proxy / SSRF).
const ALLOW = [
  'tikwm.com', 'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokv.com', 'tiktokv.us', 'byteoversea.com', 'muscdn.com', 'ibytedtos.com', 'ibyteimg.com',
  'cdninstagram.com', 'fbcdn.net', 'instagram.com',
  'googlevideo.com', 'ytimg.com', 'ggpht.com', 'googleusercontent.com',
  'twimg.com',
];
function allowed(u) {
  let x;
  try { x = new URL(u); } catch { return false; }
  if (x.protocol !== 'https:') return false;
  const extra = process.env.COBALT_API_URL ? [new URL(process.env.COBALT_API_URL).hostname] : [];
  return [...ALLOW, ...extra].some((d) => x.hostname === d || x.hostname.endsWith('.' + d));
}

export default async function handler(req, res) {
  const fail = (code, msg) => (res.headersSent ? res.end() : res.status(code).json({ ok: false, error: msg }));
  try {
    const { u, yt, itag, n } = req.query;
    const target = yt ? await ytResolve(String(yt), itag) : String(u || '');
    if (!allowed(target)) return fail(400, 'URL tidak diizinkan');

    const up = await fetch(target, {
      headers: { 'user-agent': UA, ...(/tik/.test(new URL(target).hostname) ? { referer: 'https://www.tiktok.com/' } : {}) },
      redirect: 'follow',
    });
    if (!up.ok || !up.body) return fail(502, `Sumber membalas ${up.status}`);

    res.status(200);
    res.setHeader('content-type', up.headers.get('content-type') || 'application/octet-stream');
    if (up.headers.get('content-length') && !up.headers.get('content-encoding')) {
      res.setHeader('content-length', up.headers.get('content-length'));
    }
    if (n) {
      const name = String(n);
      const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
      res.setHeader('content-disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);
      res.setHeader('cache-control', 'no-store');
    } else {
      res.setHeader('cache-control', 'public, max-age=3600');
    }
    Readable.fromWeb(up.body).on('error', () => res.end()).pipe(res);
  } catch (e) {
    fail(502, e.message || 'Gagal mengambil file');
  }
}
