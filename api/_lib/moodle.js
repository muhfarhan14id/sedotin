import { ELEARNING as C } from './config.js';
import { UA, UserError, AuthError } from './util.js';

const ORIGIN = new URL(C.baseUrl).origin;

// ---------- helpers HTML ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = (s) =>
  s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1); return n ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
export const text = (h = '') =>
  decode(
    h.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|dd|dt|section|caption)>/gi, '\n')
      .replace(/<\/t[dh]>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  ).replace(/[ \t\r\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
const inline = (h) => text(h).replace(/\n+/g, ' · ');
const first = (html, res) => { for (const r of res) { const m = html.match(r); if (m && inline(m[1])) return inline(m[1]); } return ''; };

// ---------- klien HTTP + cookie jar ----------
export class Moodle {
  constructor(jar = {}) { this.jar = jar; }
  #cookie() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; '); }
  #store(res) {
    for (const sc of res.headers.getSetCookie?.() || []) {
      const [pair, ...attrs] = sc.split(';');
      const i = pair.indexOf('=');
      if (i < 1) continue;
      const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
      const dead = !v || v === 'deleted' || attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a) || /expires=.*\b1970\b/i.test(a));
      if (dead) delete this.jar[k]; else this.jar[k] = v;
    }
  }
  async get(path) { return this.#go(path, 'GET'); }
  async post(path, form) { return this.#go(path, 'POST', form); }
  async #go(path, method, form) {
    let url = new URL(path, C.baseUrl).href;
    let body = form ? new URLSearchParams(form).toString() : undefined;
    for (let hop = 0; hop < 8; hop++) {
      if (new URL(url).origin !== ORIGIN) throw new Error('Redirect ke host lain diblokir');
      const res = await fetch(url, {
        method, body, redirect: 'manual', signal: AbortSignal.timeout(20000),
        headers: { 'user-agent': UA, 'accept-language': 'id,en;q=0.8', cookie: this.#cookie(), ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      });
      this.#store(res);
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) { url = new URL(loc, url).href; method = 'GET'; body = undefined; continue; }
      return { url, status: res.status, html: await res.text() };
    }
    throw new Error('Terlalu banyak redirect dari e-learning');
  }
}

const isLoginPage = (r) => /\/login\/(index|forgot)/.test(new URL(r.url).pathname) || /name="logintoken"/.test(r.html);
const sesskeyOf = (html) => html.match(/logout\.php\?sesskey=([\w]+)/)?.[1] || '';

// ---------- login ----------
export async function login(username, password) {
  const m = new Moodle();
  const page = await m.get(C.loginUrl).catch(() => { throw new Error('e-Learning sekolah tidak bisa dihubungi. Coba lagi nanti.'); });
  const token =
    page.html.match(/name="logintoken"[^>]*value="([^"]*)"/)?.[1] ||
    page.html.match(/value="([^"]*)"[^>]*name="logintoken"/)?.[1] || '';
  const r = await m.post(C.loginUrl, { anchor: '', logintoken: token, username, password });

  const key = sesskeyOf(r.html);
  if (key && !isLoginPage(r)) return { m, sesskey: key, landing: r };

  const path = new URL(r.url).pathname;
  if (/change_password/.test(path)) throw new UserError(`Akunmu diminta ganti sandi dulu. Buka ${C.baseUrl}${C.changePasswordUrl}, lalu login lagi di sini.`);
  if (/policy/.test(path)) throw new UserError(`Akunmu perlu menyetujui kebijakan situs dulu. Buka ${C.baseUrl}${C.dashboardUrl} lalu setujui, kemudian login lagi di sini.`);
  const why = first(r.html, [/id="loginerrormessage"[^>]*>([\s\S]*?)<\/(?:div|span|p)>/i, /class="[^"]*alert-danger[^"]*"[^>]*>([\s\S]*?)<\/div>/i, /class="loginerrors"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i]);
  throw new UserError(why && why.length < 160 ? why : 'Username atau sandi salah.');
}

// ---------- profil ----------
export async function profile(m, username) {
  const r = await m.get(C.profileUrl);
  if (isLoginPage(r)) throw new AuthError('Sesi e-learning habis, silakan login lagi.');
  const name = first(r.html, [
    /<span[^>]*class="[^"]*\busertext\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    /<div[^>]*class="[^"]*page-header-headings[^"]*"[^>]*>\s*<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ]) || username;
  const fields = [];
  const seen = new Set();
  for (const [, dt, dd] of r.html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    const label = inline(dt), value = inline(dd);
    if (!label || !value || label.length > 40 || seen.has(label)) continue;
    seen.add(label);
    fields.push({ label, value: value.length > 220 ? value.slice(0, 220) + '…' : value });
  }
  const userId = new URL(r.url).searchParams.get('id') || '';
  return { name, username, userId, fields: fields.slice(0, 14) };
}

// ---------- kuis / nilai ----------
function tables(html) {
  const out = [];
  for (const [, cls, body] of html.matchAll(/<table[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/table>/gi)) {
    if (!/quizattemptsummary|generaltable/.test(cls)) continue;
    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => inline(c[1].replace(/<span/gi, ' <span'))));
    if (rows.length < 2) continue;
    out.push({ headers: rows[0], rows: rows.slice(1).filter((r) => r.some(Boolean)) });
  }
  return out;
}

export async function quiz(m, id) {
  if (!/^\d{1,10}$/.test(id)) throw new UserError('ID mapel harus berupa angka.');
  const r = await m.get(C.quizUrlTemplate.replace('{id}', id));
  if (isLoginPage(r)) throw new AuthError('Sesi e-learning habis, silakan login lagi.');

  const p = new URL(r.url).pathname;
  const err = first(r.html, [/class="[^"]*(?:alert-danger|errorbox)[^"]*"[^>]*>([\s\S]*?)<\/div>/i]);
  if (/\/enrol\//.test(p)) throw new UserError('Kamu belum terdaftar di mata pelajaran ini.');
  if (!/\/mod\/quiz\//.test(p) && !/\/mod\/quiz\//.test(r.html.slice(0, 20000))) throw new UserError(err || 'ID ini bukan kuis, atau kamu tidak punya akses.');

  const main = r.html.match(/<[^>]*(?:id="region-main"|role="main")[^>]*>([\s\S]*?)<footer/i)?.[1] || r.html;
  const flat = text(main);
  const tbs = tables(main);
  const flatNoTables = text(main.replace(/<table[\s\S]*?<\/table>/gi, ''));
  const gm = flat.match(/(?:Highest grade|Nilai tertinggi|final grade for this quiz is|Nilai akhir[^\d\n]{0,40}|Grade[^\d\n]{0,20}|Nilai[^\d\n]{0,20})[^\d\n]{0,40}(\d+(?:[.,]\d+)?)\s*(?:\/|out of|dari)\s*(\d+(?:[.,]\d+)?)/i);
  if (err && !tbs.length && !gm) throw new UserError(err);
  const lines = [...new Set(flatNoTables.split('\n').map((l) => l.trim()).filter((l) => l.length > 2 && l.length < 200 && /grade|nilai|attempt|percobaan|status|selesai|finished|batas|waktu|time|marks|skor|tidak ada|no attempts/i.test(l)))].slice(0, 12);

  return {
    id,
    title: first(r.html, [/<div[^>]*class="[^"]*page-header-headings[^"]*"[^>]*>\s*<h1[^>]*>([\s\S]*?)<\/h1>/i, /<h1[^>]*>([\s\S]*?)<\/h1>/i]) || first(r.html, [/<title>([\s\S]*?)<\/title>/i]),
    pageTitle: first(r.html, [/<title>([\s\S]*?)<\/title>/i]),
    grade: gm ? { score: gm[1].replace(',', '.'), max: gm[2].replace(',', '.') } : null,
    attempts: tbs[0] || null,
    lines,
    raw: flatNoTables.slice(0, 1500),
  };
}

export async function logout(m, sesskey) {
  if (sesskey) await m.get(`/login/logout.php?sesskey=${encodeURIComponent(sesskey)}`).catch(() => {});
}
