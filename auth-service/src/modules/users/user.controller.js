const userService = require('./user.service');
const { assertCreate, assertPatch } = require('./user.validation');

async function listUsers(req, res, next) {
  try {
    const data = await userService.list(req.query);
    res.json({ success: true, data, users: data });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const data = await userService.get(req.params.id);
    res.json({ success: true, data, user: data });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    assertCreate(req.body);
    const data = await userService.create(req.body, req.user);
    res.status(201).json({ success: true, data, user: data });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    assertPatch(req.body);
    const data = await userService.update(req.params.id, req.body, req.user);
    res.json({ success: true, data, user: data });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const data = await userService.remove(req.params.id, req.user);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

async function listRoles(req, res, next) {
  try {
    const roles = await userService.listRoles(req.query);
    res.json({ success: true, data: roles, roles });
  } catch (err) {
    next(err);
  }
}

async function createRole(req, res, next) {
  try {
    const role = await userService.createRole(req.body);
    res.status(201).json({ success: true, data: role, role });
  } catch (err) {
    next(err);
  }
}

async function updateRole(req, res, next) {
  try {
    const role = await userService.updateRole(req.params.id, req.body);
    res.json({ success: true, data: role, role });
  } catch (err) {
    next(err);
  }
}

async function deleteRole(req, res, next) {
  try {
    const result = await userService.deleteRole(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function seedRoles(req, res, next) {
  try {
    const results = await userService.seedDefaultRoles();
    res.json({ success: true, message: 'Default roles seeded successfully', results });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  seedRoles,
};
