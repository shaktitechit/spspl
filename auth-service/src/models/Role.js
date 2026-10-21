const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    is_system_role: { type: Boolean, default: false },
    is_default_role: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Role || mongoose.model("Role", roleSchema);
