const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const controller = require('./branch.controller');

// Public routes: list branches and get branch details (consistent with company-info)
router.get('/', controller.listBranches);
router.get('/head-office', controller.getHeadOffice);
router.get('/:id', controller.getBranch);

// Authenticated routes: branch creation, modification, deletion
router.use(requireAuth);

router.post('/', controller.createBranch);
router.put('/:id', controller.updateBranch);
router.patch('/:id', controller.updateBranch);
router.post('/:id/set-head-office', controller.setHeadOffice);
router.delete('/:id', controller.deleteBranch);

module.exports = router;
