const mongoose = require("mongoose");

const reminderLogSchema = new mongoose.Schema(
  {
    milestone: { type: String, required: true }, // e.g. "7", "3", "1", "0", "overdue-3"
    sentAt: { type: Date, default: Date.now },
    cycleExpiryDate: { type: Date, required: true }, // ties the log entry to a specific rent cycle
    channel: { type: String, enum: ["email", "sms", "both"], default: "both" },
  },
  { _id: false }
);

const tenantSchema = new mongoose.Schema(
  {
    landlord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Landlord",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true,   default: ""},
    propertyAddress: { type: String, trim: true,   default: "" },
    unitNumber: { type: String, trim: true, default: "" },
    rentAmount: { type: Number, min: 0,   default: 0 },
    currency: { type: String, default: "NGN" },
    rentStartDate: { type: Date, required: true },
    rentExpiryDate: { type: Date, required: true }, // next date rent is due/expires
    status: {
      type: String,
      enum: ["active", "expired", "vacated"],
      default: "active",
    },
    notes: { type: String, trim: true, default: "" },
    remindersEnabled: { type: Boolean, default: true },
    reminderLog: { type: [reminderLogSchema], default: [] },
  },
  { timestamps: true }
);

tenantSchema.index({ landlord: 1, rentExpiryDate: 1 });

// Virtual: days left until expiry (negative = overdue)
tenantSchema.virtual("daysUntilExpiry").get(function () {
  const now = new Date();
  const expiry = new Date(this.rentExpiryDate);
  const diffMs =
    Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate()) -
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
});

tenantSchema.set("toJSON", { virtuals: true });
tenantSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Tenant", tenantSchema);
