/**
 * @fileoverview Express App Setup for lead-manager-backend.
 * @module app
 */
const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors');
const { JSON_BODY_LIMIT } = require('./config/env');
const { authMiddleware } = require('./middlewares/auth.middleware');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { notFound } = require('./middlewares/notFound.middleware');

const leadRoutes = require('./modules/leads/lead.routes');
const leadMasterRoutes = require('./modules/leads/leadMaster.routes');
const quotationRoutes = require('./modules/quotations/quotation.routes');
const attachmentRoutes = require('./modules/attachments/attachment.routes');
const termsAndConditionsRoutes = require('./modules/terms_and_conditions/terms_and_conditions.routes');
const teamRoutes = require('./modules/team/team.routes');
const leadUserRosterRoutes = require('./modules/users/user.routes');
const { proxyToAuthService } = require('./utils/proxyToAuthService');
const { proxyToMessageService } = require('./utils/proxyToMessageService');
const { proxyToNotificationService } = require('./utils/proxyToNotificationService');

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT || '50mb', extended: true }));

const { auditContextMiddleware } = require('./middlewares/auditContext.middleware');
app.use(auditContextMiddleware);
app.use(authMiddleware);

app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', service: 'lead-manager-backend', timestamp: new Date().toISOString() });
});

app.use('/api/users', leadUserRosterRoutes);
app.use('/api/users', proxyToAuthService);
app.use('/api/company-info', proxyToAuthService);
app.use('/api/branches', proxyToAuthService);

app.use('/api/leads', leadRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/lead-masters', leadMasterRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/terms-and-conditions', termsAndConditionsRoutes);
app.use('/api/notifications', proxyToNotificationService);
app.use('/api/emails', proxyToMessageService);
app.use('/api/messages', proxyToMessageService);
app.use('/api/auto-emails', proxyToMessageService);
app.use('/api/communication', proxyToMessageService);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
