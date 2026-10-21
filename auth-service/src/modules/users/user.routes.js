const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireUserManagerAdmin } = require('../../middlewares/userManagerAuth.middleware');

router.use(requireAuth);

/** Any authenticated portal user (Lead Manager, OPMS, etc.). */
router.get('/roles', userController.listRoles);
router.get('/', userController.listUsers);
router.get('/:id', userController.getUser);
router.patch('/:id', userController.updateUser);

/** User Manager admin only. */
router.use(requireUserManagerAdmin);

router.post('/roles/seed', userController.seedRoles);
router.post('/roles', userController.createRole);
router.put('/roles/:id', userController.updateRole);
router.delete('/roles/:id', userController.deleteRole);

router.post('/', userController.createUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
