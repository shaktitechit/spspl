/**
 * @fileoverview HTTP Controller for Company Info
 * @module modules/companyInfo/companyInfo.controller
 */
const service = require('./companyInfo.service');
const validation = require('./companyInfo.validation');

async function get(req, res, next) {
  try {
    // Authenticated callers (Bearer present via global authMiddleware) get full record
    const data = req.user
      ? await service.getCompanyInfo()
      : await service.getPublicCompanyInfo();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getData(req, res, next) {
  try {
    const data = await service.getCompanyAggregatedData();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    validation.assertUpdate(req.body || {});
    const data = await service.updateCompanyInfo(req.body || {}, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  get,
  getData,
  update,
};
