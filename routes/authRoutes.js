const express = require("express");
const router = express.Router();
const {
  registerLandlord,
  loginLandlord,
  getMe,
  updateMe,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", registerLandlord);
router.post("/login", loginLandlord);
router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);

module.exports = router;
