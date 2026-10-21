/**
 * @fileoverview Schema for User Task Catalog & Dynamic Field Templates.
 * Stores custom tasks and dynamic create/outcome templates configured per user.
 * @module models/UserTaskCatalog
 */
const mongoose = require('mongoose');

const userTaskCatalogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    tasks: [
      {
        id: { type: String, required: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: '' },
        category: { type: String, trim: true, default: '' },
        is_default: { type: Boolean, default: false },
        planned_start_time: { type: String, trim: true, default: '' },
        planned_end_time: { type: String, trim: true, default: '' },
        create_template: {
          enabled: { type: Boolean, default: true },
          title: { type: String, default: 'Task Planning Requirements' },
          description: { type: String, default: '' },
          fields: { type: Array, default: [] },
        },
        outcome_template: {
          enabled: { type: Boolean, default: true },
          title: { type: String, default: 'Task Outcome & Completion Report' },
          description: { type: String, default: '' },
          fields: { type: Array, default: [] },
        },
        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now },
      },
    ],
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = userTaskCatalogSchema;
