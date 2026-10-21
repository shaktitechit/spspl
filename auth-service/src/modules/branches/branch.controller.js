const branchService = require('./branch.service');

async function listBranches(req, res, next) {
  try {
    const branches = await branchService.listBranches(req.query);
    res.json({ success: true, data: branches, branches });
  } catch (err) {
    next(err);
  }
}

async function getBranch(req, res, next) {
  try {
    const branch = await branchService.getBranchById(req.params.id);
    res.json({ success: true, data: branch, branch });
  } catch (err) {
    next(err);
  }
}

async function getHeadOffice(req, res, next) {
  try {
    const branch = await branchService.getHeadOfficeBranch();
    res.json({ success: true, data: branch, branch });
  } catch (err) {
    next(err);
  }
}

async function createBranch(req, res, next) {
  try {
    const branch = await branchService.createBranch(req.body, req.user);
    res.status(201).json({ success: true, data: branch, branch });
  } catch (err) {
    next(err);
  }
}

async function updateBranch(req, res, next) {
  try {
    const branch = await branchService.updateBranch(req.params.id, req.body, req.user);
    res.json({ success: true, data: branch, branch });
  } catch (err) {
    next(err);
  }
}

async function setHeadOffice(req, res, next) {
  try {
    const branch = await branchService.setHeadOffice(req.params.id, req.user);
    res.json({ success: true, data: branch, branch, message: 'Head Office set successfully' });
  } catch (err) {
    next(err);
  }
}

async function deleteBranch(req, res, next) {
  try {
    const result = await branchService.deleteBranch(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBranches,
  getBranch,
  getHeadOffice,
  createBranch,
  updateBranch,
  setHeadOffice,
  deleteBranch,
};
