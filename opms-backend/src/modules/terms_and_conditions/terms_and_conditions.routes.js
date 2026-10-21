/**
 * @fileoverview Express routes for TermsAndConditions and TermsText.
 * @module modules/terms_and_conditions/terms_and_conditions.routes
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const termsController = require('./terms_and_conditions.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/default', termsController.getDefault);
router.get('/', termsController.list);
router.post('/', termsController.create);
router.get('/:id', termsController.getById);
router.put('/:id', termsController.update);
router.delete('/:id', termsController.remove);

router.post('/:id/text', termsController.addText);
router.put('/text/:textId', termsController.updateText);
router.delete('/text/:textId', termsController.deleteText);

module.exports = router;
