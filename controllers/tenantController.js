const asyncHandler = require("express-async-handler");
const Tenant = require("../models/Tenant");
const { daysBetween } = require("../utils/dateHelpers");
const {
  runReminderSweep,
  processTenantReminder,
} = require("../services/reminderService");

// @desc    Add a new tenant
// @route   POST /api/tenants
// @access  Private
const addTenant = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    propertyAddress,
    unitNumber,
    rentAmount,
    currency,
    rentStartDate,
    rentExpiryDate,
    notes,
    remindersEnabled,
  } = req.body;

  if (!name || !phone || !propertyAddress || !rentAmount || !rentStartDate || !rentExpiryDate) {
    res.status(400);
    throw new Error(
      "name, phone, propertyAddress, rentAmount, rentStartDate and rentExpiryDate are required"
    );
  }

  const tenant = await Tenant.create({
    landlord: req.landlord._id,
    name,
    email,
    phone,
    propertyAddress,
    unitNumber,
    rentAmount,
    currency,
    rentStartDate,
    rentExpiryDate,
    notes,
    remindersEnabled: remindersEnabled !== undefined ? remindersEnabled : true,
  });

  res.status(201).json({ success: true, data: tenant });
});

// @desc    Get all tenants for the logged-in landlord (with filters)
// @route   GET /api/tenants?status=&search=&expiringInDays=
// @access  Private
const getTenants = asyncHandler(async (req, res) => {
  const { status, search, expiringInDays } = req.query;
  const query = { landlord: req.landlord._id };

  if (status) query.status = status;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { propertyAddress: { $regex: search, $options: "i" } },
    ];
  }

  let tenants = await Tenant.find(query).sort({ rentExpiryDate: 1 });

  if (expiringInDays !== undefined) {
    const limit = parseInt(expiringInDays, 10);
    tenants = tenants.filter((t) => {
      const d = daysBetween(t.rentExpiryDate);
      return d <= limit;
    });
  }

  res.json({ success: true, count: tenants.length, data: tenants });
});

// @desc    Get single tenant
// @route   GET /api/tenants/:id
// @access  Private
const getTenant = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findOne({
    _id: req.params.id,
    landlord: req.landlord._id,
  });

  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }

  res.json({ success: true, data: tenant });
});

// @desc    Update tenant
// @route   PUT /api/tenants/:id
// @access  Private
const updateTenant = asyncHandler(async (req, res) => {
  let tenant = await Tenant.findOne({
    _id: req.params.id,
    landlord: req.landlord._id,
  });

  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }

  const allowedFields = [
    "name",
    "email",
    "phone",
    "propertyAddress",
    "unitNumber",
    "rentAmount",
    "currency",
    "rentStartDate",
    "rentExpiryDate",
    "status",
    "notes",
    "remindersEnabled",
  ];

  const prevExpiry = tenant.rentExpiryDate.getTime();

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) tenant[field] = req.body[field];
  });

  // If the expiry date changed (e.g. rent renewed), reset the reminder log
  // so notifications fire again for the new cycle.
  if (
    req.body.rentExpiryDate &&
    new Date(req.body.rentExpiryDate).getTime() !== prevExpiry
  ) {
    tenant.reminderLog = [];
    if (tenant.status === "expired") tenant.status = "active";
  }

  const updated = await tenant.save();
  res.json({ success: true, data: updated });
});

// @desc    Delete tenant
// @route   DELETE /api/tenants/:id
// @access  Private
const deleteTenant = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findOneAndDelete({
    _id: req.params.id,
    landlord: req.landlord._id,
  });

  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }

  res.json({ success: true, message: "Tenant deleted", data: { id: req.params.id } });
});

// @desc    Renew a tenant's rent (shortcut for extending expiry by N months/days)
// @route   PATCH /api/tenants/:id/renew
// @access  Private
const renewTenant = asyncHandler(async (req, res) => {
  const { newExpiryDate, months } = req.body;

  const tenant = await Tenant.findOne({
    _id: req.params.id,
    landlord: req.landlord._id,
  });

  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }

  if (newExpiryDate) {
    tenant.rentExpiryDate = new Date(newExpiryDate);
  } else if (months) {
    const base = new Date(tenant.rentExpiryDate);
    base.setMonth(base.getMonth() + parseInt(months, 10));
    tenant.rentExpiryDate = base;
  } else {
    res.status(400);
    throw new Error("Provide either newExpiryDate or months to renew by");
  }

  tenant.status = "active";
  tenant.reminderLog = []; // new cycle, allow reminders to fire again

  const updated = await tenant.save();
  res.json({ success: true, data: updated });
});

// @desc    Manually trigger reminder sweep for this landlord's tenants (or a single tenant)
// @route   POST /api/tenants/reminders/run
// @route   POST /api/tenants/:id/remind
// @access  Private
const runRemindersNow = asyncHandler(async (req, res) => {
  if (req.params.id) {
    const tenant = await Tenant.findOne({
      _id: req.params.id,
      landlord: req.landlord._id,
    }).populate("landlord", "fullName email phone");

    if (!tenant) {
      res.status(404);
      throw new Error("Tenant not found");
    }

    const result = await processTenantReminder(tenant, tenant.landlord);
    return res.json({ success: true, data: result });
  }

  const summary = await runReminderSweep({ landlordId: req.landlord._id });
  res.json({ success: true, count: summary.length, data: summary });
});

module.exports = {
  addTenant,
  getTenants,
  getTenant,
  updateTenant,
  deleteTenant,
  renewTenant,
  runRemindersNow,
};
