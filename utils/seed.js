// Seeds one sample landlord + a few sample tenants (with varied expiry
// dates so you can see reminders trigger for "due soon" and "overdue"
// cases). Run with: npm run seed
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Landlord = require("../models/Landlord");
const Tenant = require("../models/Tenant");

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const run = async () => {
  await connectDB();

  await Landlord.deleteMany({ email: "landlord@example.com" });
  const landlord = await Landlord.create({
    fullName: "Demo Landlord",
    email: "landlord@example.com",
    phone: "08012345678",
    password: "password123",
    companyName: "Demo Properties Ltd",
  });

  await Tenant.deleteMany({ landlord: landlord._id });

  const sampleTenants = [
    {
      name: "Chinedu Okafor",
      email: "chinedu@example.com",
      phone: "08023456789",
      propertyAddress: "12 Aba Road, Port Harcourt",
      unitNumber: "Flat B",
      rentAmount: 850000,
      rentStartDate: daysFromNow(-358),
      rentExpiryDate: daysFromNow(7), // due in 7 days
    },
    {
      name: "Amina Yusuf",
      email: "amina@example.com",
      phone: "08034567890",
      propertyAddress: "5 Trans Amadi Layout, Port Harcourt",
      unitNumber: "Shop 3",
      rentAmount: 1200000,
      rentStartDate: daysFromNow(-360),
      rentExpiryDate: daysFromNow(0), // due today
    },
    {
      name: "Tunde Bakare",
      email: "tunde@example.com",
      phone: "08045678901",
      propertyAddress: "9 Woji Road, Port Harcourt",
      unitNumber: "",
      rentAmount: 600000,
      rentStartDate: daysFromNow(-370),
      rentExpiryDate: daysFromNow(-3), // 3 days overdue
    },
    {
      name: "Ngozi Eze",
      email: "ngozi@example.com",
      phone: "08056789012",
      propertyAddress: "21 GRA Phase 2, Port Harcourt",
      unitNumber: "Flat A",
      rentAmount: 950000,
      rentStartDate: daysFromNow(-300),
      rentExpiryDate: daysFromNow(60), // safely active
    },
  ].map((t) => ({ ...t, landlord: landlord._id }));

  await Tenant.insertMany(sampleTenants);

  console.log("Seed complete.");
  console.log("Landlord login -> email: landlord@example.com, password: password123");
  console.log(`Inserted ${sampleTenants.length} sample tenants.`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
