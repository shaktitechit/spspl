/**
 * @fileoverview Order delivery routes.
 * @module modules/orderDelivery/orderDelivery.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const controller = require('./orderDelivery.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/deleted', controller.listDeleted);
router.get('/', controller.list);
router.post('/log-shipment', controller.logShipmentDelivery);
router.delete('/:id', controller.softDelete);
router.post('/:id/restore', controller.restore);
router.get('/:id', controller.get);
router.patch('/:id', controller.patch);

module.exports = router;
