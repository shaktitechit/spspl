/**
 * @fileoverview Schema for User Visit Template & Dynamic Field Templates.
 * Stores the single visit template (create & outcome phases) configured per user.
 * @module models/UserVisitTemplate
 */
const mongoose = require('mongoose');

const userVisitTemplateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    template_title: {
      type: String,
      default: 'Standard Field Visit Template',
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    create_template: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: 'Pre-Visit Planning Details' },
      description: { type: String, default: '' },
      fields: { type: Array, default: [] },
    },
    outcome_template: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: 'Post-Visit Debrief & Outcomes' },
      description: { type: String, default: '' },
      fields: { type: Array, default: [] },
    },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = userVisitTemplateSchema;
