import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { UserError, AuthError } from './util.js';

// Sesi disimpan di cookie httpOnly milik browser siswa, dienkripsi AES-256-GCM.
// Isinya HANYA cookie sesi Moodle + username + sesskey. Sandi tidak pernah disimpan.
const NAME = 'sdt_portal';
const TTL = 2 * 60 * 60; // detik

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET belum diatur di server (min. 16 karakter). Hubungi admin.');
  return createHash('sha256').update(s).digest();
}

export function seal(data) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify({ ...data, e: Date.now() + TTL * 1000 }), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
}

export function unseal(tok) {
  try {
    const b = Buffer.from(tok, 'base64url');
    const d = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    const o = JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
    return o.e > Date.now() ? o : null;
  } catch (e) {
    if (/SESSION_SECRET/.test(e.message)) throw e;
    return null;
  }
}

const secure = (req) => ((req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '');

export function setSession(req, res, data) {
  res.setHeader('set-cookie', `${NAME}=${seal(data)}; HttpOnly; SameSite=Strict; Path=/api/portal; Max-Age=${TTL}${secure(req)}`);
}
export function clearSession(req, res) {
  res.setHeader('set-cookie', `${NAME}=; HttpOnly; SameSite=Strict; Path=/api/portal; Max-Age=0${secure(req)}`);
}
export function getSession(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${NAME}=([^;]+)`));
  return m ? unseal(m[1]) : null;
}
export function requireSession(req, res) {
  const s = getSession(req);
  if (!s) { clearSession(req, res); throw new AuthError('Sesi habis, silakan login lagi.'); }
  return s;
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
