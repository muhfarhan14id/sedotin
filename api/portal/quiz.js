import { wrap } from '../_lib/util.js';
import { Moodle, quiz } from '../_lib/moodle.js';
import { readToken } from '../_lib/session.js';

export default wrap(async (req) => {
  const s = readToken(req);
  return quiz(new Moodle(s.jar), String(req.query.id || '').trim());
});
