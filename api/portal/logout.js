import { wrap, UserError } from '../_lib/util.js';
import { Moodle, logout } from '../_lib/moodle.js';
import { getSession, clearSession, sameOrigin } from '../_lib/session.js';

export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw new UserError('Gunakan POST');
  sameOrigin(req);
  const s = getSession(req);
  if (s) await logout(new Moodle(s.j), s.k); // akhiri juga sesi di e-learning
  clearSession(req, res);
  return {};
});
