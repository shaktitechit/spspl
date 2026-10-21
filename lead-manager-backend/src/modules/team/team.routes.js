/**
 * @fileoverview Routes for Lead Manager team / reporting hierarchy.
 * @module modules/team/team.routes
 */
const express = require('express');
const teamController = require('./team.controller');
const {
  requireLeadManagerAccess,
  requireLeadManagerRole,
  requireLeadManagerSalesTeamRole,
  requireLeadManagerElevatedRole,
} = require('../../middlewares/leadManagerAuth.middleware');

const router = express.Router();

router.use(requireLeadManagerAccess);

const adminOnly = requireLeadManagerRole('admin');
const elevated = requireLeadManagerElevatedRole;

router.get('/tree', adminOnly, teamController.getTree);
router.get('/my-team', requireLeadManagerSalesTeamRole, teamController.getMyTeam);
router.get('/edges', elevated, teamController.listEdges);
router.put('/edges', adminOnly, teamController.upsertEdge);
router.delete('/edges/:subordinateId', adminOnly, teamController.removeEdge);
router.delete('/edges/:subordinateId/:managerId', adminOnly, (req, res, next) => {
  if (req.params.managerId) req.query.manager = req.params.managerId;
  return teamController.removeEdge(req, res, next);
});

module.exports = router;
