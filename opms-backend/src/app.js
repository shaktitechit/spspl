/**
 * @fileoverview Express app: CORS/auth middleware, mounts `/api/*` routers, 404 + error handlers.
 * @module app
 */
const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors');
const { JSON_BODY_LIMIT } = require('./config/env');
const { authMiddleware } = require('./middlewares/auth.middleware');
const { auditContextMiddleware } = require('./middlewares/auditContext.middleware');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { notFound } = require('./middlewares/notFound.middleware');
const swaggerUi = require('swagger-ui-express');
let swaggerDocument = null;
try {
  const swaggerModule = require('./docs/swagger');
  swaggerDocument = swaggerModule.spec || swaggerModule;
} catch (err) {
  console.warn('[WARN] Swagger documentation spec could not be loaded:', err.message);
}

const { proxyToAuthService } = require('./utils/proxyToAuthService');
const { proxyToProductService } = require('./utils/proxyToProductService');
const { proxyToPartyService } = require('./utils/proxyToPartyService');
const { proxyToMessageService } = require('./utils/proxyToMessageService');
const { proxyToNotificationService } = require('./utils/proxyToNotificationService');
const orderRoutes = require('./modules/orders/order.routes');
const approvalRoutes = require('./modules/approvals/approval.routes');
const financeRoutes = require('./modules/finance/finance.routes');
const orderApprovalRoutes = require('./modules/orderApproval/orderApproval.routes');
const dispatchRoutes = require('./modules/dispatch/dispatch.routes');
const transportRoutes = require('./modules/transport/transport.routes');
const orderDeliveryRoutes = require('./modules/orderDelivery/orderDelivery.routes');
const orderReturnRoutes = require('./modules/orderReturn/orderReturn.routes');
const orderDueSheetRoutes = require('./modules/orderDueSheet/orderDueSheet.routes');
const unbilledOrderRoutes = require('./modules/unbilledOrder/unbilledOrder.routes');
const finalOrderStatementRoutes = require('./modules/finalOrderStatement/finalOrderStatement.routes');
const flagRoutes = require('./modules/flags/flag.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const activityRoutes = require('./modules/activity/activity.routes');
const attachmentRoutes = require('./modules/attachments/attachment.routes');
const vehicleRoutes = require('./modules/fleet/vehicle.routes');
const driverRoutes = require('./modules/fleet/driver.routes');
const transportAgentRoutes = require('./modules/fleet/transportAgent.routes');
const filesRoutes = require('./modules/files/files.routes');
const reminderRoutes = require('./modules/reminders/reminder.routes');
const transportPlannerRoutes = require('./modules/transportPlanner/transportPlanner.routes');
const termsAndConditionsRoutes = require('./modules/terms_and_conditions/terms_and_conditions.routes');

const app = express();
app.use(cors(corsOptions));
app.use(express.json({
  limit: JSON_BODY_LIMIT,
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(auditContextMiddleware);
app.use(authMiddleware);

app.get(['/health', '/api/health'], (_req, res) => res.json({ ok: true }));

// Serve API Documentation
if (swaggerDocument) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
  app.use('/api-docs', (_req, res) => res.status(503).json({ ok: false, error: 'API documentation unavailable' }));
}

app.get('/', (_req, res) =>
  res.json({
    ok: true,
    service: 'opms-backend',
    message: 'Use paths under /api — the site root has no SPA.',
    health: '/health',
    api_docs: '/api-docs',
    examples: {
      login_post: '/api/auth/login',
      orders: '/api/orders',
      me: '/api/auth/me',
    },
  })
);

app.use('/api/auth', proxyToAuthService);
app.use('/api/users', proxyToAuthService);
app.use('/api/company-info', proxyToAuthService);
app.use('/api/portals', proxyToAuthService);
app.use('/api/departments', proxyToAuthService);

app.use('/api/products', proxyToProductService);
app.use('/api/product-groups', proxyToProductService);
app.use('/api/product-subgroups', proxyToProductService);
app.use('/api/product-brands', proxyToProductService);
app.use('/api/product-manufacturers', proxyToProductService);
app.use('/api/product-units', proxyToProductService);
app.use('/api/product-kit-items', proxyToProductService);

app.use('/api/parties', proxyToPartyService);
app.use('/api/zones', proxyToPartyService);
app.use('/api/party-countries', proxyToPartyService);
app.use('/api/party-states', proxyToPartyService);
app.use('/api/party-cities', proxyToPartyService);
app.use('/api/party-products', proxyToPartyService);
app.use('/api/party-order-products-rate', proxyToPartyService);
app.use('/api/orders', orderRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/order-approvals', orderApprovalRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/order-deliveries', orderDeliveryRoutes);
app.use('/api/order-returns', orderReturnRoutes);
app.use('/api/order-due-sheets', orderDueSheetRoutes);
app.use('/api/unbilled-orders', unbilledOrderRoutes);
app.use('/api/final-order-statements', finalOrderStatementRoutes);
app.use('/api/flags', flagRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', proxyToNotificationService);
app.use('/api/activity', activityRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/transport-agents', transportAgentRoutes);
app.use('/api/messages', proxyToMessageService);
app.use('/api/emails', proxyToMessageService);
app.use('/api/email', proxyToMessageService);
app.use('/api/auto-emails', proxyToMessageService);
app.use('/api/communication', proxyToMessageService);
app.use('/api/reminders', reminderRoutes);
app.use('/api/transport-plans', transportPlannerRoutes);
app.use('/api/terms-and-conditions', termsAndConditionsRoutes);
app.use('/api', filesRoutes);
app.use('/api', proxyToNotificationService);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
