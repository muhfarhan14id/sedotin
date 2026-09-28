import { wrap, AuthError } from '../_lib/util.js';
import { Moodle, profile } from '../_lib/moodle.js';
import { requireSession, clearSession } from '../_lib/session.js';
import { mapelList, links, ELEARNING } from '../_lib/config.js';

export default wrap(async (req, res) => {
  const s = requireSession(req, res);
  try {
    const user = await profile(new Moodle(s.j), s.u);
    return { site: ELEARNING.name, user, mapel: mapelList(), links: links() };
  } catch (e) {
    if (e instanceof AuthError) clearSession(req, res);
    throw e;
  }
});
