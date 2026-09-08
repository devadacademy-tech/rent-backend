const asyncHandler = require("express-async-handler");
const Landlord = require("../models/Landlord");
const generateToken = require("../utils/generateToken");

// @desc    Register a new landlord
// @route   POST /api/auth/register
// @access  Public
const registerLandlord = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, companyName } = req.body;

  if (!fullName || !email || !phone || !password) {
    res.status(400);
    throw new Error("fullName, email, phone and password are required");
  }

  const exists = await Landlord.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(400);
    throw new Error("A landlord with this email already exists");
  }

  const landlord = await Landlord.create({
    fullName,
    email,
    phone,
    password,
    companyName,
  });

  res.status(201).json({
    success: true,
    data: landlord.toSafeObject(),
    token: generateToken(landlord._id),
  });
});

// @desc    Login landlord
// @route   POST /api/auth/login
// @access  Public
const loginLandlord = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const landlord = await Landlord.findOne({ email: email.toLowerCase() });

  if (landlord && (await landlord.matchPassword(password))) {
    res.json({
      success: true,
      data: landlord.toSafeObject(),
      token: generateToken(landlord._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid email or password");
  }
});

// @desc    Get logged-in landlord profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.landlord });
});

// @desc    Update logged-in landlord profile
// @route   PUT /api/auth/me
// @access  Private
const updateMe = asyncHandler(async (req, res) => {
  const { fullName, phone, companyName, password } = req.body;

  const landlord = await Landlord.findById(req.landlord._id);
  if (!landlord) {
    res.status(404);
    throw new Error("Landlord not found");
  }

  if (fullName) landlord.fullName = fullName;
  if (phone) landlord.phone = phone;
  if (companyName !== undefined) landlord.companyName = companyName;
  if (password) landlord.password = password;

  const updated = await landlord.save();
  res.json({ success: true, data: updated.toSafeObject() });
});

module.exports = { registerLandlord, loginLandlord, getMe, updateMe };
