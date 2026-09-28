import { wrap } from '../_lib/util.js';
import { Moodle, profile } from '../_lib/moodle.js';
import { readToken } from '../_lib/session.js';
import { mapelList, links, ELEARNING } from '../_lib/config.js';

export default wrap(async (req) => {
  const s = readToken(req);
  const user = await profile(new Moodle(s.jar), s.username);
  return { site: ELEARNING.name, user, mapel: mapelList(), links: links() };
});
