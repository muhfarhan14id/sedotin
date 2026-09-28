import { wrap } from '../_lib/util.js';
import { Moodle, quiz } from '../_lib/moodle.js';
import { requireSession, clearSession } from '../_lib/session.js';
import { AuthError } from '../_lib/util.js';

export default wrap(async (req, res) => {
  const s = requireSession(req, res);
  try {
    return await quiz(new Moodle(s.j), String(req.query.id || '').trim());
  } catch (e) {
    if (e instanceof AuthError) clearSession(req, res);
    throw e;
  }
});
