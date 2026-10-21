const mongoose = require('mongoose');

const portalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, default: '' },
    access_roles: [{ type: String, trim: true }],
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Portal || mongoose.model('Portal', portalSchema);
