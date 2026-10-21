const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { JSON_BODY_LIMIT } = require('./config/env');
const corsOptions = require('./config/cors');
const { authMiddleware } = require('./middlewares/auth.middleware');
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const companyInfoRoutes = require('./modules/companyInfo/companyInfo.routes');
const portalRoutes = require('./modules/portals/portal.routes');
const departmentRoutes = require('./modules/departments/department.routes');
const branchRoutes = require('./modules/branches/branch.routes');
const { proxyToNotificationService } = require('./utils/proxyToNotificationService');
const { ApiError } = require('./utils/ApiError');

const app = express();

// Behind nginx / Docker published ports — needed for accurate rate-limit keys
app.set('trust proxy', 1);

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: JSON_BODY_LIMIT || '15mb' }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT || '15mb', extended: true }));

app.use(authMiddleware);

app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/company-info', companyInfoRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/portals', portalRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', proxyToNotificationService);

// 404
app.use((req, res, next) => {
  next(new ApiError(404, 'Endpoint not found'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({
    success: false,
    message,
    details: err.details || null,
  });
});

module.exports = app;
