const mongoose = require('mongoose');
const app = require('./app');
const { PORT, MONGO_URI } = require('./config/env');
const User = require('./models/User');
const departmentService = require('./modules/departments/department.service');
const userService = require('./modules/users/user.service');
const portalService = require('./modules/portals/portal.service');

async function syncUserIndexes() {
  try {
    const coll = mongoose.connection.collection('users');
    const indexes = await coll.indexes();
    console.log('[auth-service] Existing user indexes:', indexes.map((i) => i.name));
    for (const idx of indexes) {
      if (idx.name === 'email_1' && !idx.partialFilterExpression) {
        console.log('[auth-service] Dropping legacy non-partial email_1 index...');
        await coll.dropIndex('email_1');
        console.log('[auth-service] Successfully dropped legacy email_1 index');
      }
    }
    await User.createIndexes();
    console.log('[auth-service] User indexes synchronized with partial unique index');
  } catch (err) {
    console.warn('[auth-service] User index sync notice:', err?.message || err);
  }
}

async function ensureDefaults() {
  try {
    await syncUserIndexes();
    const deptResults = await departmentService.seedDefaultDepartments();
    const roleResults = await userService.seedDefaultRoles();
    await portalService.seedDefaultPortals();
    const createdDepts = deptResults.filter((r) => r.status === 'created').length;
    const createdRoles = roleResults.filter((r) => r.status === 'created').length;
    if (createdDepts || createdRoles) {
      console.log(
        `[auth-service] Seeded defaults: ${createdDepts} department(s), ${createdRoles} role(s)`
      );
    }
  } catch (err) {
    console.warn('[auth-service] Default department/role seed skipped:', err?.message || err);
  }
}

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[auth-service] Connected to MongoDB');

    await ensureDefaults();

    app.listen(PORT, () => {
      console.log(`[auth-service] Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[auth-service] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
