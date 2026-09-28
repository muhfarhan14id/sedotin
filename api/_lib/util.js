export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export class UserError extends Error {}
export class AuthError extends UserError {}

export function detect(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  const h = u.hostname.toLowerCase();
  const is = (d) => h === d || h.endsWith('.' + d);
  if (is('tiktok.com')) return 'tiktok';
  if (is('instagram.com') || is('instagr.am')) return 'instagram';
  return null;
}

export async function getJson(url, opts = {}) {
  const { headers, timeout = 15000, ...rest } = opts;
  const r = await fetch(url, {
    ...rest,
    headers: { 'user-agent': UA, accept: 'application/json', ...(headers || {}) },
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} dari ${new URL(url).hostname}`);
  return r.json();
}

export const safeName = (s, ext) =>
  ((s || 'video').replace(/[\\/:*?"<>|\r\n#%]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70) || 'video') +
  '.' + ext;

export const proxied = (u, name) =>
  `/api/proxy?u=${encodeURIComponent(u)}` + (name ? `&n=${encodeURIComponent(name)}` : '');

export const img = (u) => (u ? proxied(u) : null);

// Ubah item {url|href} menjadi link unduhan lewat proxy kita.
export function finish(meta) {
  const title = meta.title || `${meta.platform}-video`;
  meta.items = meta.items.map(({ url, href, ...i }) => ({
    ...i,
    href: href || proxied(url, safeName(i.kind === 'video' ? title : `${title} - ${i.label}`, i.ext)),
  }));
  meta.thumbnail = img(meta.thumbnail);
  return meta;
}

export const wrap = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    res.setHeader('cache-control', 'no-store');
    res.status(200).json({ ok: true, ...data });
  } catch (e) {
    res.status(e instanceof AuthError ? 401 : e instanceof UserError ? 400 : 502).json({ ok: false, error: e.message || 'Terjadi kesalahan' });
  }
};
