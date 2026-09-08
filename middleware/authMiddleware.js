const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Landlord = require("../models/Landlord");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.landlord = await Landlord.findById(decoded.id).select("-password");

      if (!req.landlord) {
        res.status(401);
        throw new Error("Not authorized, landlord not found");
      }

      return next();
    } catch (error) {
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token provided");
  }
});

module.exports = { protect };
