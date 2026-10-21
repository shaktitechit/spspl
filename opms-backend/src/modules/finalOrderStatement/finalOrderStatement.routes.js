/**
 * @fileoverview Final order statement routes.
 * @module modules/finalOrderStatement/finalOrderStatement.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const controller = require('./finalOrderStatement.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/', controller.list);
router.get('/order/:orderId', controller.getByOrder);

module.exports = router;
