/**
 * @fileoverview Express router endpoints for Expense domain: KPIs, Advances, Settlements, Balances, and Passbook.
 * @module modules/workPlanner/expense/expense.routes
 */

const { Router } = require('express');
const router = Router();
const controller = require('./expense.controller');
const {
  requireWorkPlannerRole,
} = require('../../../middlewares/workPlannerAuth.middleware');

const elevatedRoles = requireWorkPlannerRole('coordinator', 'manager', 'admin');
const managerRoles = requireWorkPlannerRole('manager', 'admin');

const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// 1. KPI Summary
router.get('/kpi-summary', controller.getExpenseKpiSummary);

// 2. File Uploads
router.post('/upload', upload.single('file'), controller.uploadExpenseFile);
router.post('/attachments/upload', upload.single('file'), controller.uploadExpenseFile);

// 3. Advances (supports both POST and PATCH for approve/reject)
router.get('/advances', controller.listAdvances);
router.post('/advances', controller.requestAdvance);
router.post('/advances/issue', managerRoles, controller.issueDirectAdvance);
router.get('/advances/active', controller.getActiveAdvances);
router.get('/advances/active/:userId', controller.getActiveAdvances);

router.post('/advances/:id/approve', managerRoles, controller.approveAdvance);
router.patch('/advances/:id/approve', managerRoles, controller.approveAdvance);

router.post('/advances/:id/reject', managerRoles, controller.rejectAdvance);
router.patch('/advances/:id/reject', managerRoles, controller.rejectAdvance);

router.post('/advances/:id/disburse', managerRoles, controller.disburseAdvance);
router.patch('/advances/:id/disburse', managerRoles, controller.disburseAdvance);

router.post('/advances/:id/refund', managerRoles, controller.refundAdvance);
router.patch('/advances/:id/refund', managerRoles, controller.refundAdvance);

// 4. Settlements
router.get('/settlements', controller.listSettlements);
router.get('/settlements/:id', controller.getSettlement);
router.post('/settlements', managerRoles, controller.createSettlement);

// 5. Balances & Passbook
router.get('/balances', controller.getExecutiveBalances);
router.get('/passbook', controller.getExecutivePassbook);
router.get('/passbook/:userId', controller.getExecutivePassbook);

module.exports = router;
