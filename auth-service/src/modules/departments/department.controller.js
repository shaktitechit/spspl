const departmentService = require('./department.service');
const { assertCreateDepartment, assertUpdateDepartment } = require('./department.validation');

async function listDepartments(req, res, next) {
  try {
    const departments = await departmentService.listDepartments(req.query);
    res.json({ success: true, data: departments, departments });
  } catch (err) {
    next(err);
  }
}

async function getDepartment(req, res, next) {
  try {
    const department = await departmentService.getDepartmentById(req.params.id);
    res.json({ success: true, data: department, department });
  } catch (err) {
    next(err);
  }
}

async function createDepartment(req, res, next) {
  try {
    assertCreateDepartment(req.body);
    const department = await departmentService.createDepartment(req.body);
    res.status(201).json({ success: true, data: department, department });
  } catch (err) {
    next(err);
  }
}

async function updateDepartment(req, res, next) {
  try {
    assertUpdateDepartment(req.body);
    const department = await departmentService.updateDepartment(req.params.id, req.body);
    res.json({ success: true, data: department, department });
  } catch (err) {
    next(err);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    const result = await departmentService.deleteDepartment(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function seedDepartments(req, res, next) {
  try {
    const results = await departmentService.seedDefaultDepartments();
    res.json({ success: true, message: 'Default departments seeded successfully', results });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  seedDepartments,
};
