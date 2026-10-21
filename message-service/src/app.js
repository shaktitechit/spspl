/**
 * @fileoverview Express application definition for message-service.
 * @module app
 */
const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors');
const { JSON_BODY_LIMIT } = require('./config/env');
const { authMiddleware } = require('./middlewares/auth.middleware');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { notFound } = require('./middlewares/notFound.middleware');

const messageRoutes = require('./modules/messages/message.routes');
const emailRoutes = require('./modules/messages/email.routes');
const autoEmailRoutes = require('./modules/autoEmails/autoEmail.routes');
const communicationRoutes = require('./modules/communication/communication.routes');

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT || '50mb', extended: true }));

app.use(authMiddleware);

app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'message-service',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/messages', messageRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/auto-emails', autoEmailRoutes);
app.use('/api/communication', communicationRoutes);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
