const express = require("express");
const router = express.Router();
const { testNotifications } = require("../controllers/healthController");
const { protect } = require("../middleware/authMiddleware");

// Requires a logged-in landlord so random people can't use your Brevo/Termii
// credits by hitting this endpoint anonymously.
router.post("/notifications", protect, testNotifications);

module.exports = router;
