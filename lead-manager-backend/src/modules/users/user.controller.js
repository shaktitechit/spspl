/**
 * @fileoverview HTTP handlers for Lead Manager user roster.
 */
const asyncHandler = require('../../utils/asyncHandler');
const userService = require('./user.service');

exports.listRoster = asyncHandler(async (req, res) => {
  const data = await userService.listRoster(req.user);
  res.json({ success: true, data, users: data });
});
