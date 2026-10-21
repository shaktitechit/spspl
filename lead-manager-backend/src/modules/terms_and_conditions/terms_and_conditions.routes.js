/**
 * @fileoverview Express routes for TermsAndConditions and TermsText.
 * @module modules/terms_and_conditions/terms_and_conditions.routes
 */
const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  requireLeadManagerAccess,
  requireLeadManagerElevatedRole,
} = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./terms_and_conditions.controller');

const router = express.Router();

router.use(requireAuth);
router.use(requireLeadManagerAccess);

router.get('/default', controller.getDefault);
router.get('/', controller.list);
router.post('/', requireLeadManagerElevatedRole, controller.create);
router.get('/:id', controller.getById);
router.put('/:id', requireLeadManagerElevatedRole, controller.update);
router.delete('/:id', requireLeadManagerElevatedRole, controller.remove);

router.post('/:id/text', requireLeadManagerElevatedRole, controller.addText);
router.put('/text/:textId', requireLeadManagerElevatedRole, controller.updateText);
router.delete('/text/:textId', requireLeadManagerElevatedRole, controller.deleteText);

module.exports = router;
