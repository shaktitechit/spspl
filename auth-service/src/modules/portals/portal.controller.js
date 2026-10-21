const portalService = require('./portal.service');
const { assertCreatePortal, assertUpdatePortal } = require('./portal.validation');

async function listPortals(req, res, next) {
  try {
    const portals = await portalService.listPortals(req.query);
    res.json({ success: true, data: portals, portals });
  } catch (err) {
    next(err);
  }
}

async function getPortal(req, res, next) {
  try {
    const portal = await portalService.getPortalById(req.params.id);
    res.json({ success: true, data: portal, portal });
  } catch (err) {
    next(err);
  }
}

async function createPortal(req, res, next) {
  try {
    assertCreatePortal(req.body);
    const portal = await portalService.createPortal(req.body);
    res.status(201).json({ success: true, data: portal, portal });
  } catch (err) {
    next(err);
  }
}

async function updatePortal(req, res, next) {
  try {
    assertUpdatePortal(req.body);
    const portal = await portalService.updatePortal(req.params.id, req.body);
    res.json({ success: true, data: portal, portal });
  } catch (err) {
    next(err);
  }
}

async function deletePortal(req, res, next) {
  try {
    const result = await portalService.deletePortal(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function seedPortals(req, res, next) {
  try {
    const results = await portalService.seedDefaultPortals();
    res.json({ success: true, message: 'Default portals seeded successfully', results });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPortals,
  getPortal,
  createPortal,
  updatePortal,
  deletePortal,
  seedPortals,
};
