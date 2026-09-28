import { wrap, UserError } from '../_lib/util.js';
import { Moodle, logout } from '../_lib/moodle.js';
import { readToken, sameOrigin } from '../_lib/session.js';

export default wrap(async (req) => {
  if (req.method !== 'POST') throw new UserError('Gunakan POST');
  sameOrigin(req);
  try {
    const s = readToken(req);
    await logout(new Moodle(s.jar), s.sesskey); // akhiri juga sesi di e-learning
  } catch { /* token sudah tidak valid: anggap sudah keluar */ }
  return {};
});
