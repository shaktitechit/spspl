const express = require('express');
const router = express.Router();
const departmentController = require('./department.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

router.get('/', requireAuth, departmentController.listDepartments);
router.post('/seed', requireAuth, departmentController.seedDepartments);
router.get('/:id', requireAuth, departmentController.getDepartment);
router.post('/', requireAuth, departmentController.createDepartment);
router.put('/:id', requireAuth, departmentController.updateDepartment);
router.delete('/:id', requireAuth, departmentController.deleteDepartment);

module.exports = router;
