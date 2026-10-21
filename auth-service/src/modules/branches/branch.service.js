const mongoose = require('mongoose');
const Branch = require('../../models/Branch');
const CompanyInfo = require('../../models/CompanyInfo');
const { ApiError } = require('../../utils/ApiError');
const { toPlain } = require('../../utils/mongoJson');

/**
 * Ensure default Head Office branch exists seeded from CompanyInfo
 */
async function ensureDefaultBranch() {
  const count = await Branch.countDocuments();
  if (count > 0) return;

  const company = await CompanyInfo.findOne({ is_default: true }).lean();
  if (!company) return;

  const hqData = {
    company_id: company._id,
    branch_code: 'HQ-MAIN',
    branch_name: company.trade_name ? `${company.trade_name} (Head Office)` : 'Head Office',
    branch_type: 'head_office',
    is_head_office: true,
    is_active: true,
    address: {
      street: company.address || '',
      city: company.city || '',
      state: company.state || '',
      state_code: '',
      pincode: company.pincode || '',
      country: company.country || 'India',
      currency: company.currency || 'INR',
      timezone: company.timezone || 'Asia/Kolkata',
      financial_year: company.financial_year || '',
    },
    taxation: {
      gstin: company.gstin || '',
      pan: company.pan || '',
      cin: company.cin || '',
      drug_license: company.drug_license || '',
      fssai_license: company.fssai_license || '',
      invoice_footer_note: company.invoice_footer_note || '',
    },
    contact: {
      manager_name: 'Corporate HQ Admin',
      email: company.email || '',
      billing_email: company.billing_email || '',
      phone: company.phone || '',
      website: company.website || '',
    },
    banking: [
      {
        bank_name: company.bank_name || '',
        account_name: company.account_name || '',
        account_number: company.account_number || '',
        ifsc_code: company.ifsc_code || '',
        branch_name: company.branch_name || '',
        account_type: company.account_type || 'Current Account',
        upi_id: company.upi_id || '',
        swift_code: company.swift_code || '',
        is_primary: true,
      },
    ],
    invoicing: {
      invoice_prefix: 'HQ/',
      challan_prefix: 'DC/',
      quotation_prefix: 'QT/',
    },
  };

  try {
    await Branch.create(hqData);
  } catch (err) {
    console.warn('Could not auto-seed default Head Office branch:', err.message);
  }
}

async function listBranches(query = {}) {
  await ensureDefaultBranch();

  const filter = {};
  if (query.include_inactive !== 'true') {
    filter.is_active = { $ne: false };
  }
  if (query.branch_type) {
    filter.branch_type = query.branch_type;
  }
  if (query.search) {
    const q = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { branch_name: q },
      { branch_code: q },
      { 'address.city': q },
      { 'address.state': q },
      { 'taxation.gstin': q },
    ];
  }

  const rows = await Branch.find(filter)
    .sort({ is_head_office: -1, branch_name: 1 })
    .lean();

  return rows.map(toPlain);
}

async function getBranchById(id) {
  const doc = await Branch.findById(id).lean();
  if (!doc) throw new ApiError(404, 'Branch not found');
  return toPlain(doc);
}

async function getHeadOfficeBranch() {
  await ensureDefaultBranch();
  let doc = await Branch.findOne({ is_head_office: true, is_active: true }).lean();
  if (!doc) {
    doc = await Branch.findOne().sort({ createdAt: 1 }).lean();
  }
  return doc ? toPlain(doc) : null;
}

async function createBranch(data, user) {
  const code = String(data.branch_code || '').toUpperCase().trim();
  if (!code) throw new ApiError(400, 'Branch code is required');
  if (!data.branch_name || !String(data.branch_name).trim()) {
    throw new ApiError(400, 'Branch name is required');
  }

  const existing = await Branch.findOne({ branch_code: code }).lean();
  if (existing) {
    throw new ApiError(409, `Branch with code '${code}' already exists`);
  }

  // If this branch is marked as head_office, unset any other head office
  if (data.is_head_office) {
    await Branch.updateMany({}, { $set: { is_head_office: false } });
  }

  // Resolve company_id safely
  let companyId = data.company_id;
  if (!companyId || !mongoose.isValidObjectId(companyId)) {
    const defaultCo = await CompanyInfo.findOne({ is_default: true }).select('_id').lean();
    companyId = defaultCo ? defaultCo._id : undefined;
  }

  const cleanBanking = Array.isArray(data.banking)
    ? data.banking.map((b) => {
        const item = { ...b };
        delete item._id;
        return item;
      })
    : [];

  const createPayload = {
    branch_code: code,
    branch_name: String(data.branch_name).trim(),
    branch_type: data.branch_type || 'regional_office',
    is_head_office: Boolean(data.is_head_office),
    is_active: data.is_active !== false,
    address: {
      street: data.address?.street || '',
      landmark: data.address?.landmark || '',
      city: data.address?.city || '',
      state: data.address?.state || '',
      state_code: data.address?.state_code || '',
      pincode: data.address?.pincode || '',
      country: data.address?.country || 'India',
      currency: data.address?.currency || 'INR',
      timezone: data.address?.timezone || 'Asia/Kolkata',
      financial_year: data.address?.financial_year || '',
    },
    taxation: {
      gstin: String(data.taxation?.gstin || '').toUpperCase().trim(),
      pan: String(data.taxation?.pan || '').toUpperCase().trim(),
      cin: String(data.taxation?.cin || '').toUpperCase().trim(),
      drug_license: data.taxation?.drug_license || '',
      fssai_license: data.taxation?.fssai_license || '',
      invoice_footer_note: data.taxation?.invoice_footer_note || '',
    },
    contact: {
      manager_name: data.contact?.manager_name || '',
      email: data.contact?.email || '',
      billing_email: data.contact?.billing_email || '',
      phone: data.contact?.phone || '',
      alternate_phone: data.contact?.alternate_phone || '',
      website: data.contact?.website || '',
    },
    banking: cleanBanking,
    invoicing: {
      invoice_prefix: data.invoicing?.invoice_prefix || '',
      challan_prefix: data.invoicing?.challan_prefix || '',
      quotation_prefix: data.invoicing?.quotation_prefix || '',
    },
  };

  if (companyId) createPayload.company_id = companyId;
  const uid = user?._id || user?.id;
  if (uid && mongoose.isValidObjectId(uid)) {
    createPayload.updated_by = uid;
  }

  const doc = await Branch.create(createPayload);

  return toPlain(await Branch.findById(doc._id).lean());
}

async function updateBranch(id, data, user) {
  const branch = await Branch.findById(id);
  if (!branch) throw new ApiError(404, 'Branch not found');

  if (data.branch_code) {
    const newCode = String(data.branch_code).toUpperCase().trim();
    if (newCode !== branch.branch_code) {
      const existing = await Branch.findOne({ branch_code: newCode, _id: { $ne: id } }).lean();
      if (existing) {
        throw new ApiError(409, `Branch code '${newCode}' is already in use by another branch`);
      }
      branch.branch_code = newCode;
    }
  }

  if (data.branch_name !== undefined) branch.branch_name = String(data.branch_name).trim();
  if (data.branch_type !== undefined) branch.branch_type = data.branch_type;
  if (data.is_active !== undefined) branch.is_active = Boolean(data.is_active);

  if (data.is_head_office !== undefined) {
    if (data.is_head_office) {
      await Branch.updateMany({ _id: { $ne: id } }, { $set: { is_head_office: false } });
      branch.is_head_office = true;
    } else {
      branch.is_head_office = false;
    }
  }

  if (data.address && typeof data.address === 'object') {
    branch.address = {
      ...branch.address?.toObject?.() || branch.address || {},
      ...data.address,
    };
  }

  if (data.taxation && typeof data.taxation === 'object') {
    branch.taxation = {
      ...branch.taxation?.toObject?.() || branch.taxation || {},
      ...data.taxation,
      gstin: data.taxation.gstin !== undefined ? String(data.taxation.gstin).toUpperCase().trim() : branch.taxation?.gstin,
      pan: data.taxation.pan !== undefined ? String(data.taxation.pan).toUpperCase().trim() : branch.taxation?.pan,
      cin: data.taxation.cin !== undefined ? String(data.taxation.cin).toUpperCase().trim() : branch.taxation?.cin,
    };
  }

  if (data.contact && typeof data.contact === 'object') {
    branch.contact = {
      ...branch.contact?.toObject?.() || branch.contact || {},
      ...data.contact,
    };
  }

  if (Array.isArray(data.banking)) {
    branch.banking = data.banking;
  }

  if (data.invoicing && typeof data.invoicing === 'object') {
    branch.invoicing = {
      ...branch.invoicing?.toObject?.() || branch.invoicing || {},
      ...data.invoicing,
    };
  }

  const uid = user?._id || user?.id;
  if (uid && mongoose.isValidObjectId(uid)) {
    branch.updated_by = uid;
  }
  await branch.save();

  return toPlain(await Branch.findById(id).lean());
}

async function setHeadOffice(id, user) {
  const branch = await Branch.findById(id);
  if (!branch) throw new ApiError(404, 'Branch not found');

  await Branch.updateMany({ _id: { $ne: id } }, { $set: { is_head_office: false } });
  branch.is_head_office = true;
  const uid = user?._id || user?.id;
  if (uid && mongoose.isValidObjectId(uid)) {
    branch.updated_by = uid;
  }
  await branch.save();

  return toPlain(await Branch.findById(id).lean());
}

async function deleteBranch(id) {
  const branch = await Branch.findById(id);
  if (!branch) throw new ApiError(404, 'Branch not found');

  if (branch.is_head_office) {
    const totalCount = await Branch.countDocuments();
    if (totalCount > 1) {
      throw new ApiError(400, 'Cannot delete the designated Head Office branch. Set another branch as Head Office first.');
    }
  }

  await Branch.findByIdAndDelete(id);
  return { success: true, message: 'Branch deleted successfully' };
}

module.exports = {
  listBranches,
  getBranchById,
  getHeadOfficeBranch,
  createBranch,
  updateBranch,
  setHeadOffice,
  deleteBranch,
};
