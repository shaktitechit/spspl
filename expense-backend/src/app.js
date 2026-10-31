/**
 * @fileoverview Express App Setup for expense-backend.
 * @module app
 */
const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors');
const { JSON_BODY_LIMIT } = require('./config/env');
const { authMiddleware } = require('./middlewares/auth.middleware');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { notFound } = require('./middlewares/notFound.middleware');
const { auditContextMiddleware } = require('./middlewares/auditContext.middleware');

const expenseRoutes = require('./modules/expense/expense.routes');
const { proxyToNotificationService } = require('./utils/proxyToNotificationService');

const app = express();

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT || '50mb', extended: true }));

app.use(auditContextMiddleware);
app.use(authMiddleware);

app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'expense-backend',
    portal: 'expense',
    timestamp: new Date().toISOString(),
  });
});

// File streaming and preview endpoints
app.get(
  [
    '/api/files/:fileId/preview',
    '/api/files/:fileId/view',
    '/api/files/:fileId',
    '/api/attachments/:fileId/preview',
    '/api/attachments/:fileId/view',
    '/api/attachments/:fileId',
    '/api/work-planner/attachments/:fileId/preview',
    '/api/work-planner/attachments/:fileId/view',
  ],
  async (req, res) => {
    const { streamFileToResponse } = require('./services/fileManagement');
    await streamFileToResponse(req.params.fileId, res, { disposition: 'inline' });
  }
);

app.get(
  [
    '/api/files/:fileId/download',
    '/api/attachments/:fileId/download',
    '/api/work-planner/attachments/:fileId/download',
  ],
  async (req, res) => {
    const { streamFileToResponse } = require('./services/fileManagement');
    await streamFileToResponse(req.params.fileId, res, { disposition: 'attachment' });
  }
);

// Expense Portal Routes
app.use(
  [
    '/api/expenses',
    '/api/v1/expenses',
    '/api/expense-portal',
    '/api/work-planner/expenses',
  ],
  expenseRoutes
);

// Notifications proxy to notification-service
app.use('/api/notifications', proxyToNotificationService);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
