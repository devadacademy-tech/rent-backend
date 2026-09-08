const asyncHandler = require("express-async-handler");
const { runReminderSweep } = require("../services/reminderService");

// @desc    Trigger the full reminder sweep across ALL landlords' tenants.
//          Designed to be called by an external scheduler (cron-job.org,
//          GitHub Actions, Render Cron Job, etc.) instead of relying on
//          the in-process node-cron job, which dies whenever a free-tier
//          Render service spins down from inactivity.
// @route   POST /api/cron/trigger-reminders
// @access  Public, but requires header: x-cron-secret: <CRON_SECRET>
const triggerReminderSweep = asyncHandler(async (req, res) => {
  const secret = req.headers["x-cron-secret"];

  if (!process.env.CRON_SECRET) {
    res.status(500);
    throw new Error("CRON_SECRET is not configured on the server");
  }

  if (!secret || secret !== process.env.CRON_SECRET) {
    res.status(401);
    throw new Error("Invalid or missing cron secret");
  }

  const summary = await runReminderSweep();
  const sent = summary.filter((s) => !s.skipped && !s.error).length;

  res.json({
    success: true,
    checked: summary.length,
    sent,
    data: summary,
  });
});

module.exports = { triggerReminderSweep };
