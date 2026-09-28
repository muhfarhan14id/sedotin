import { wrap, UserError } from '../_lib/util.js';
import { login, profile } from '../_lib/moodle.js';
import { setSession, sameOrigin, rateLimit } from '../_lib/session.js';
import { mapelList, links, ELEARNING } from '../_lib/config.js';

export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw new UserError('Gunakan POST');
  sameOrigin(req);
  rateLimit(req);
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) throw new UserError('Isi username dan sandi.');
  if (username.length > 100 || password.length > 200) throw new UserError('Input terlalu panjang.');

  const { m, sesskey } = await login(username, password);
  const user = await profile(m, username);
  // Yang disimpan hanya cookie sesi Moodle (bukan sandi).
  setSession(req, res, { j: m.jar, u: username, k: sesskey });
  return { site: ELEARNING.name, user, mapel: mapelList(), links: links() };
});
