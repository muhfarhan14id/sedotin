import { UserError, AuthError } from './util.js';

// Tanpa secret key & tanpa penyimpanan di server (stateless).
// Setelah login, server mengirim "token" = cookie sesi Moodle milik siswa itu sendiri.
// Browser menyimpannya (sessionStorage) dan mengirimnya lagi lewat header di tiap request.
// Sandi hanya dipakai sekali saat login dan tidak pernah dikirim ulang / disimpan.

export function makeToken({ jar, username, sesskey }) {
  return Buffer.from(JSON.stringify({ j: jar, u: username, k: sesskey }), 'utf8').toString('base64url');
}

// Token berasal dari klien -> validasi ketat (cegah injeksi header Cookie).
export function readToken(req) {
  const raw = String(req.headers['x-portal-token'] || '');
  if (!raw || raw.length > 4000) throw new AuthError('Kamu belum login.');
  let o;
  try { o = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')); } catch { throw new AuthError('Sesi tidak valid, silakan login lagi.'); }
  const jar = o?.j;
  const ok =
    jar && typeof jar === 'object' && !Array.isArray(jar) &&
    Object.keys(jar).length > 0 && Object.keys(jar).length <= 8 &&
    Object.entries(jar).every(([k, v]) => /^[\w.-]{1,64}$/.test(k) && typeof v === 'string' && /^[\w%.~+=\/-]{1,512}$/.test(v)) &&
    typeof o.u === 'string' && o.u.length <= 100 &&
    (o.k === '' || /^\w{1,32}$/.test(o.k));
  if (!ok) throw new AuthError('Sesi tidak valid, silakan login lagi.');
  return { jar, username: o.u, sesskey: o.k };
}

// Tolak POST lintas-origin (CSRF).
export function sameOrigin(req) {
  const o = req.headers.origin;
  if (o && new URL(o).host !== req.headers.host) throw new UserError('Permintaan ditolak (origin tidak cocok).');
}

// Pembatas login sederhana per-IP (best effort, per instance serverless).
const hits = new Map();
export function rateLimit(req, max = 8, windowMs = 60_000) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new UserError('Terlalu banyak percobaan login. Tunggu semenit lalu coba lagi.');
  arr.push(now);
  hits.set(ip, arr);
}
