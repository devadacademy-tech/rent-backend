const cron = require("node-cron");
const { runReminderSweep } = require("../services/reminderService");

const startReminderCron = () => {
  const schedule = process.env.REMINDER_CRON || "0 8 * * *"; // default: 8 AM daily

  if (!cron.validate(schedule)) {
    console.error(
      `Invalid REMINDER_CRON expression "${schedule}" — reminder cron not started`
    );
    return;
  }

  cron.schedule(schedule, async () => {
    console.log(`[reminder-cron] Running rent reminder sweep @ ${new Date().toISOString()}`);
    try {
      const summary = await runReminderSweep();
      const sentCount = summary.filter((s) => !s.skipped && !s.error).length;
      console.log(
        `[reminder-cron] Sweep complete. ${sentCount} reminder(s) sent out of ${summary.length} tenant(s) checked.`
      );
    } catch (error) {
      console.error("[reminder-cron] Sweep failed:", error.message);
    }
  });

  console.log(`Reminder cron scheduled: "${schedule}"`);
};

module.exports = startReminderCron;
