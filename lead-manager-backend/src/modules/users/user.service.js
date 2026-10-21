/**
 * @fileoverview Lead Manager user roster (assignees, signatories, sales rep pickers).
 * Not User Manager CRUD — that stays on auth-service via proxy.
 */
const { getModels } = require('../../data/mongoRegistry');

async function listRoster(_actor) {
  const { User } = getModels();
  const docs = await User.find({ is_active: { $ne: false } })
    .select('_id name email phone department role roles role_codes portals is_active')
    .sort({ name: 1 })
    .lean();
  return docs;
}

module.exports = {
  listRoster,
};
