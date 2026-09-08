const asyncHandler = require("express-async-handler");
const Tenant = require("../models/Tenant");
const { daysBetween } = require("../utils/dateHelpers");

// @desc    Get dashboard stats for the logged-in landlord
// @route   GET /api/dashboard
// @access  Private
const getDashboard = asyncHandler(async (req, res) => {
  const tenants = await Tenant.find({ landlord: req.landlord._id });

  const stats = {
    totalTenants: tenants.length,
    activeTenants: 0,
    expiredTenants: 0,
    vacatedTenants: 0,
    expiringWithin7Days: 0,
    overdue: 0,
    totalMonthlyRentExpected: 0,
  };

  const expiringSoonList = [];
  const overdueList = [];

  tenants.forEach((t) => {
    stats.totalMonthlyRentExpected += t.rentAmount || 0;
    if (t.status === "active") stats.activeTenants++;
    if (t.status === "expired") stats.expiredTenants++;
    if (t.status === "vacated") stats.vacatedTenants++;

    const daysLeft = daysBetween(t.rentExpiryDate);
    if (daysLeft < 0 && t.status !== "vacated") {
      stats.overdue++;
      overdueList.push({ id: t._id, name: t.name, daysOverdue: Math.abs(daysLeft) });
    } else if (daysLeft >= 0 && daysLeft <= 7 && t.status !== "vacated") {
      stats.expiringWithin7Days++;
      expiringSoonList.push({ id: t._id, name: t.name, daysLeft });
    }
  });

  res.json({
    success: true,
    data: { ...stats, expiringSoonList, overdueList },
  });
});

module.exports = { getDashboard };
