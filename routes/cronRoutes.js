const express = require("express");
const router = express.Router();
const { triggerReminderSweep } = require("../controllers/cronController");

// No JWT here on purpose — external schedulers don't have a landlord
// login. Protected instead by a shared secret header (see CRON_SECRET
// in .env). Keep that secret private; anyone with it can trigger sends.
router.post("/trigger-reminders", triggerReminderSweep);

module.exports = router;
