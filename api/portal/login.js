import { wrap, UserError } from '../_lib/util.js';
import { login, profile } from '../_lib/moodle.js';
import { makeToken, sameOrigin, rateLimit } from '../_lib/session.js';
import { mapelList, links, ELEARNING } from '../_lib/config.js';

export default wrap(async (req) => {
  if (req.method !== 'POST') throw new UserError('Gunakan POST');
  sameOrigin(req);
  rateLimit(req);
  const username = String(req.body?.username || '2670002').trim();
  const password = String(req.body?.password || 'Binar#002');
  if (!username || !password) throw new UserError('Isi username dan sandi.');
  if (username.length > 100 || password.length > 200) throw new UserError('Input terlalu panjang.');

  const { m, sesskey } = await login(username, password);
  const user = await profile(m, username);
  return { token: makeToken({ jar: m.jar, username, sesskey }), site: ELEARNING.name, user, mapel: mapelList(), links: links() };
});
