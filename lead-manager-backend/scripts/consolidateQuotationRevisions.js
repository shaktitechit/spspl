/**
 * @fileoverview Consolidates legacy duplicate quotation records ending in -R1, -R2, etc.
 * into the root parent quotation's revision_history and soft-deletes the clones.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const envPath = fs.existsSync(path.resolve(__dirname, 'src/config/env.js'))
  ? path.resolve(__dirname, 'src/config/env')
  : path.resolve(__dirname, '../src/config/env');
const modelPath = fs.existsSync(path.resolve(__dirname, 'src/models/LeadQuotation.js'))
  ? path.resolve(__dirname, 'src/models/LeadQuotation')
  : path.resolve(__dirname, '../src/models/LeadQuotation');

const env = require(envPath);
const LeadQuotationModule = require(modelPath);
const LeadQuotation = LeadQuotationModule.default || LeadQuotationModule;

async function consolidate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const revisions = await LeadQuotation.find({
    quotation_no: /-R\d+$/,
    deletedAt: null,
  }).sort({ quotation_no: 1 });

  console.log(`Found ${revisions.length} revision clones to consolidate.`);

  for (const rev of revisions) {
    const baseQuotationNo = rev.quotation_no.replace(/-R\d+$/, '');
    const parent = await LeadQuotation.findOne({
      quotation_no: baseQuotationNo,
      deletedAt: null,
    });

    if (!parent) {
      console.warn(`Parent quotation not found for ${rev.quotation_no} (base: ${baseQuotationNo})`);
      continue;
    }

    console.log(`Consolidating ${rev.quotation_no} into parent ${parent.quotation_no} (${parent._id})`);

    if (!Array.isArray(parent.revision_history)) {
      parent.revision_history = [];
    }

    const existingVersions = new Set(parent.revision_history.map((r) => r.version));

    if (Array.isArray(rev.revision_history)) {
      for (const subRev of rev.revision_history) {
        if (!existingVersions.has(subRev.version)) {
          parent.revision_history.push(subRev);
          existingVersions.add(subRev.version);
          console.log(`  Merged sub-revision v${subRev.version} into parent`);
        }
      }
    }

    // Determine target version for snapshot of this clone
    const revVer = rev.version || (parent.version ? parent.version + 1 : 2);
    if (!existingVersions.has(revVer)) {
      parent.revision_history.push({
        version: revVer,
        items: rev.items || [],
        subtotal: rev.subtotal,
        discount_percentage: rev.discount_percentage,
        total_discount: rev.total_discount,
        total_taxable: rev.total_taxable,
        cgst_amount: rev.cgst_amount,
        sgst_amount: rev.sgst_amount,
        igst_amount: rev.igst_amount,
        total_gst: rev.total_gst,
        round_off: rev.round_off,
        grand_total: rev.grand_total,
        amount_in_words: rev.amount_in_words,
        terms_and_conditions: rev.terms_and_conditions,
        notes: rev.notes,
        customer_name: rev.customer_name,
        kind_attn: rev.kind_attn,
        phone: rev.phone,
        email: rev.email,
        gstin: rev.gstin,
        customer_ref: rev.customer_ref,
        subject: rev.subject,
        address: rev.address,
        valid_until: rev.valid_until,
        validity_days: rev.validity_days,
        signatory_name: rev.signatory_name,
        signatory_designation: rev.signatory_designation,
        signatory_email: rev.signatory_email,
        sales_person_name: rev.sales_person_name,
        sales_person_designation: rev.sales_person_designation,
        sales_person_phone: rev.sales_person_phone,
        sales_person_email: rev.sales_person_email,
        bank_details: rev.bank_details,
        status: rev.status,
        approval_status: rev.approval_status,
        saved_by: rev.updated_by || rev.created_by,
        saved_at: rev.updatedAt || rev.createdAt,
        change_summary: `Merged from legacy clone ${rev.quotation_no}`,
      });
      existingVersions.add(revVer);
      console.log(`  Created snapshot for v${revVer}`);
    }

    parent.revision_history.sort((a, b) => (a.version || 0) - (b.version || 0));

    if (rev.version && rev.version > (parent.version || 1)) {
      parent.version = rev.version;
    }

    await parent.save();

    rev.deletedAt = new Date();
    rev.is_deleted = true;
    rev.notes = (rev.notes ? rev.notes + '\n' : '') + `[Consolidated into ${parent.quotation_no}]`;
    await rev.save();

    console.log(`  Soft-deleted duplicate clone ${rev.quotation_no}`);
  }

  console.log('Consolidation complete.');
  await mongoose.disconnect();
}

consolidate().catch((err) => {
  console.error('Consolidation failed:', err);
  process.exit(1);
});
