const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],
    portals: [
      {
        portal: { type: mongoose.Schema.Types.ObjectId, ref: "Portal" },
        portal_code: { type: String, required: true, trim: true },
        access_roles: [{ type: String, trim: true }],
      },
    ],
    is_active: { type: Boolean, default: true },
    last_login_at: Date,
  },
  { timestamps: true }
);

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { is_active: true },
  }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
