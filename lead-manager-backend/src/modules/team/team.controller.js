/**
 * @fileoverview HTTP handlers for Lead Manager team / reporting hierarchy.
 * @module modules/team/team.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const teamService = require('./team.service');

exports.getTree = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await teamService.getTree(req.user) });
});

exports.getMyTeam = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await teamService.getMyTeam(req.user) });
});

exports.listEdges = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await teamService.listEdges(req.user) });
});

exports.upsertEdge = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await teamService.upsertEdge(req.body || {}, req.user) });
});

exports.removeEdge = asyncHandler(async (req, res) => {
  const managerId =
    req.query.manager ||
    req.query.manager_id ||
    req.body?.manager ||
    req.body?.manager_id;
  res.json({
    success: true,
    data: await teamService.removeEdge(req.params.subordinateId, managerId, req.user),
  });
});
