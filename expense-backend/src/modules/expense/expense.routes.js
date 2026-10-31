/**
 * @fileoverview Express router for Expense Portal: Claims, Approvals, Advances, Ledgers, Settlements.
 * @module modules/expense/expense.routes
 */
const { Router } = require('express');
const router = Router();
const controller = require('./expense.controller');
const {
  requireExpensePortalAccess,
  requireExpenseAdmin,
  requireExpenseFinance,
  requireExpenseRole,
} = require('../../middlewares/expenseAuth.middleware');

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// All routes require authenticated user with Expense Portal access (admin or finance)
router.use(requireExpensePortalAccess);

// 1. Work Planner Users Directory
router.get('/work-planner-users', controller.listWorkPlannerUsers);

// 2. High-level KPI Summary
router.get('/kpi-summary', controller.getExpenseKpiSummary);

// 3. File Uploads (Receipts, Odometer pictures, Disbursement proofs, Voucher attachments)
router.post('/upload', upload.single('file'), controller.uploadExpenseFile);
router.post('/attachments/upload', upload.single('file'), controller.uploadExpenseFile);

// 4. Advances Management
router.get('/advances', controller.listAdvances);
router.post('/advances', requireExpenseAdmin, controller.createAdvance); // Admin creates advance for WP user
router.get('/advances/active', controller.getActiveAdvances);
router.get('/advances/active/:userId', controller.getActiveAdvances);

// Admin Advance Approvals
router.post('/advances/:id/approve', requireExpenseAdmin, controller.approveAdvance);
router.patch('/advances/:id/approve', requireExpenseAdmin, controller.approveAdvance);

router.post('/advances/:id/reject', requireExpenseAdmin, controller.rejectAdvance);
router.patch('/advances/:id/reject', requireExpenseAdmin, controller.rejectAdvance);

// Finance Advance Disbursements & Refunds
router.post('/advances/:id/disburse', requireExpenseFinance, controller.disburseAdvance);
router.patch('/advances/:id/disburse', requireExpenseFinance, controller.disburseAdvance);

router.post('/advances/:id/refund', requireExpenseFinance, controller.refundAdvance);
router.patch('/advances/:id/refund', requireExpenseFinance, controller.refundAdvance);

// 5. Settlements Management (Finance only executes)
router.get('/settlements', controller.listSettlements);
router.get('/settlements/:id', controller.getSettlement);
router.post('/settlements', requireExpenseFinance, controller.createSettlement);

// 6. Ledgers, Balances & Passbook (Accessible by both Admin and Finance, primary for Finance)
router.get('/balances', controller.getExecutiveBalances);
router.get('/ledgers', controller.getExecutiveBalances);
router.get('/passbook', controller.getExecutivePassbook);
router.get('/passbook/:userId', controller.getExecutivePassbook);

// 7. Expense Claims (Admin approves; Finance reviews approved)
router.get('/claims', controller.listExpenses);
router.get('/claims/:id', controller.getExpenseById);
router.post('/claims', controller.createExpense);

router.post('/claims/:id/approve', requireExpenseAdmin, controller.approveExpense);
router.patch('/claims/:id/approve', requireExpenseAdmin, controller.approveExpense);
router.post('/claims/bulk-approve', requireExpenseAdmin, controller.bulkApproveExpenses);

router.post('/claims/:id/reject', requireExpenseAdmin, controller.rejectExpense);
router.patch('/claims/:id/reject', requireExpenseAdmin, controller.rejectExpense);

// Direct root aliases for claims
router.get('/', controller.listExpenses);
router.get('/:id', controller.getExpenseById);
router.post('/', controller.createExpense);
router.post('/:id/approve', requireExpenseAdmin, controller.approveExpense);
router.patch('/:id/approve', requireExpenseAdmin, controller.approveExpense);
router.post('/:id/reject', requireExpenseAdmin, controller.rejectExpense);
router.patch('/:id/reject', requireExpenseAdmin, controller.rejectExpense);

module.exports = router;

