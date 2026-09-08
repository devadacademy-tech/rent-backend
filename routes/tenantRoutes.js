const express = require("express");
const router = express.Router();
const {
  addTenant,
  getTenants,
  getTenant,
  updateTenant,
  deleteTenant,
  renewTenant,
  runRemindersNow,
} = require("../controllers/tenantController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect); // every tenant route requires a logged-in landlord

router.route("/").post(addTenant).get(getTenants);
router.post("/reminders/run", runRemindersNow);

router
  .route("/:id")
  .get(getTenant)
  .put(updateTenant)
  .delete(deleteTenant);

router.patch("/:id/renew", renewTenant);
router.post("/:id/remind", runRemindersNow);

module.exports = router;
