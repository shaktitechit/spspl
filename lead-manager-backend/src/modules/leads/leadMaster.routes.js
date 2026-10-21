const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  requireLeadManagerAccess,
  requireLeadManagerRole,
} = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./leadMaster.controller');

const router = express.Router();

router.use(requireAuth);
router.use(requireLeadManagerAccess);

/* --- Lead Sources --- */
router.get('/sources', controller.listSources);
router.post('/sources', requireLeadManagerRole('admin'), controller.createSource);
router.put('/sources/:id', requireLeadManagerRole('admin'), controller.updateSource);
router.delete('/sources/:id', requireLeadManagerRole('admin'), controller.deleteSource);

/* --- Lead Lost Reasons --- */
router.get('/lost-reasons', controller.listLostReasons);
router.post('/lost-reasons', requireLeadManagerRole('admin'), controller.createLostReason);
router.put('/lost-reasons/:id', requireLeadManagerRole('admin'), controller.updateLostReason);
router.delete('/lost-reasons/:id', requireLeadManagerRole('admin'), controller.deleteLostReason);

module.exports = router;
