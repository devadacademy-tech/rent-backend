
// Seed/import the Bright Amechi Foundation tenant dataset.
//
// IMPORTANT:
// - Does NOT delete existing landlords.
// - Does NOT delete existing tenants.
// - Adds only tenants that are not already in the database.
// - Safe to run npm run seed multiple times.
// - Accepts missing phone numbers and missing rent amounts.
// - Imports the supplied Bright Amechi Foundation dataset.
//
// Run:
//   npm run seed

require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");

const Landlord = require("../models/Landlord");
const Tenant = require("../models/Tenant");

// ------------------------------------------------------------
// Demo/import landlord
// ------------------------------------------------------------

const LANDLORD_EMAIL = "landlord@example.com";

const landlordData = {
  fullName: "Demo Landlord",
  email: LANDLORD_EMAIL,
  phone: "08012345678",
  password: "password123",
  companyName: "Bright Amechi Foundation",
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function parseMonthYear(value) {
  if (!value) return null;

  const text = String(value).trim();

  const match = text.match(/^([A-Za-z]{3})-(\d{2})$/);

  if (!match) {
    throw new Error(`Invalid month/year date: "${value}"`);
  }

  const monthText = match[1].toLowerCase();
  const yearShort = Number(match[2]);

  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  if (!(monthText in months)) {
    throw new Error(`Invalid month: "${value}"`);
  }

  // 24 -> 2024, 25 -> 2025, 26 -> 2026, etc.
  const year = 2000 + yearShort;

  // Use the first day of the month.
  return new Date(Date.UTC(year, months[monthText], 1));
}

function extractPhone(name) {
  if (!name) {
    return "";
  }

  // Nigerian numbers appearing at the end of the name.
  const match = String(name).match(/(?:0\d{9,10}|234\d{10})$/);

  if (!match) {
    return "";
  }

  return match[0];
}

function cleanName(name) {
  if (!name) return "";

  return String(name)
    .replace(/\s+(?:0\d{9,10}|234\d{10})$/, "")
    .trim();
}

function cleanUnit(unit) {
  if (!unit) return "";

  return String(unit).trim();
}

function makeEmail(name, index) {
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `tenant-${index + 1}-${slug}@example.com`;
}

// ------------------------------------------------------------
// Actual Bright Amechi Foundation dataset
// ------------------------------------------------------------

const dataset = [
  {
    name: "Madam Obiageli (Soap)",
    phone: "08061154932",
    unitNumber: "5 Rooms",
    rentStartDate: "Jan-26",
    rentExpiryDate: "Jan-29",
    rentAmount: 2000000,
  },

  {
    name: "Madam Obiageli (Soap)",
    phone: "08061154932",
    unitNumber: "2 Rooms",
    rentStartDate: "Dec-24",
    rentExpiryDate: "Dec-28",
    rentAmount: 960000,
  },

  {
    name: "Living Faith Church (Winners Chapel) Main Hall",
    phone: "",
    unitNumber: "4 Rooms",
    rentStartDate: "Feb-25",
    rentExpiryDate: "Feb-26",
    rentAmount: 500000,
  },

  {
    name: "Living Faith Church (Winners Chapel) Children Dept.",
    phone: "07069181040",
    unitNumber: "2 Rooms",
    rentStartDate: "Jun-25",
    rentExpiryDate: "Jun-26",
    rentAmount: 240000,
  },

  {
    name: "Mountain of Fire Church",
    phone: "08036302966",
    unitNumber: "2 Rooms",
    rentStartDate: "Feb-25",
    rentExpiryDate: "Feb-26",
    rentAmount: 250000,
  },

  {
    name: "Kingsley Adaka (Hot Drinks)",
    phone: "07062895816",
    unitNumber: "1 Room",
    rentStartDate: "Oct-25",
    rentExpiryDate: "Oct-26",
    rentAmount: 250000,
  },

  {
    name: "Madam Goldlove (Fashion & Design)",
    phone: "080335045166",
    unitNumber: "2 Rooms",
    rentStartDate: "Aug-25",
    rentExpiryDate: "Aug-26",
    rentAmount: 240000,
  },

  {
    name: "Madam Joy (Provision)",
    phone: "0916451056",
    unitNumber: "Chinwendu Store, 2 Rooms",
    rentStartDate: "Oct-25",
    rentExpiryDate: "Oct-26",
    rentAmount: 240000,
  },

  {
    name: "Emeka Biscuit Elee/Me",
    phone: "",
    unitNumber: "2 Rooms",
    rentStartDate: "Apr-25",
    rentExpiryDate: "Apr-26",
    rentAmount: 240000,
  },

  {
    name: "Madam Uchechi (Tyre Sale)",
    phone: "09054957563",
    unitNumber: "1 Room",
    rentStartDate: "Mar-25",
    rentExpiryDate: "Mar-26",
    rentAmount: 120000,
  },

  {
    name: "Madam Nnenna (Ice Block)",
    phone: "",
    unitNumber: "1 Room",
    rentStartDate: "May-25",
    rentExpiryDate: "May-26",
    rentAmount: 120000,
  },

  {
    name: "Madam Nmesoma (Minerals/Drinks)",
    phone: "",
    unitNumber: "2 Rooms",
    rentStartDate: "Aug-25",
    rentExpiryDate: "Aug-26",
    rentAmount: 0,
  },

  {
    name: "Food Store Madam Felicia Store",
    phone: "",
    unitNumber: "1 Room",
    rentStartDate: "Feb-26",
    rentExpiryDate: "Feb-27",
    rentAmount: 150000,
  },

  {
    name: "BetNija",
    phone: "07037993509",
    unitNumber: "1 Room",
    rentStartDate: "Feb-25",
    rentExpiryDate: "Feb-26",
    rentAmount: 0,
  },

  {
    name: "Madam Electrical",
    phone: "08062618229",
    unitNumber: "4 Rooms",
    rentStartDate: "Dec-25",
    rentExpiryDate: "Dec-26",
    rentAmount: 300000,
  },

  {
    name: "Church Training Centre (Up)",
    phone: "",
    unitNumber: "2 Rooms, 1 Room",
    rentStartDate: "Feb-26",
    rentExpiryDate: "Feb-27",
    rentAmount: 800000,
  },
];

// ------------------------------------------------------------
// Find or create landlord
// ------------------------------------------------------------

async function getOrCreateLandlord() {
  let landlord = await Landlord.findOne({
    email: LANDLORD_EMAIL,
  });

  if (landlord) {
    console.log(`Using existing landlord: ${landlord.email}`);
    return landlord;
  }

  landlord = await Landlord.create(landlordData);

  console.log(`Created landlord: ${landlord.email}`);

  return landlord;
}

// ------------------------------------------------------------
// Check whether tenant already exists
// ------------------------------------------------------------
//
// We use landlord + name + unitNumber + expiry date.
//
// This allows the same person to legitimately have multiple
// units/rent cycles without being treated as a duplicate.
//
// ------------------------------------------------------------

async function tenantAlreadyExists(landlordId, tenant) {
  return Tenant.findOne({
    landlord: landlordId,
    name: tenant.name,
    unitNumber: tenant.unitNumber,
    rentExpiryDate: tenant.rentExpiryDate,
  });
}

// ------------------------------------------------------------
// Main seed
// ------------------------------------------------------------

async function run() {
  try {
    await connectDB();

    const landlord = await getOrCreateLandlord();

    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < dataset.length; i++) {
      const row = dataset[i];

      const phoneFromName = extractPhone(row.name);

      const phone = row.phone || phoneFromName || "";

      const name = cleanName(row.name);

      const unitNumber = cleanUnit(row.unitNumber);

      const rentStartDate = parseMonthYear(row.rentStartDate);

      const rentExpiryDate = parseMonthYear(row.rentExpiryDate);

      if (!name) {
        console.log(`Skipping row ${i + 1}: missing name`);
        skipped++;
        continue;
      }

      if (!rentStartDate || !rentExpiryDate) {
        console.log(
          `Skipping ${name}: missing/invalid rent dates`
        );
        skipped++;
        continue;
      }

      const tenantData = {
        landlord: landlord._id,

        name,

        email: makeEmail(name, i),

        phone,

        propertyAddress: "",

        unitNumber,

        rentAmount: Number(row.rentAmount) || 0,

        currency: "NGN",

        rentStartDate,

        rentExpiryDate,

        status:
          rentExpiryDate < new Date()
            ? "expired"
            : "active",

        notes:
          "Imported from Bright Amechi Foundation dataset.",

        remindersEnabled: true,

        reminderLog: [],
      };

      const exists = await tenantAlreadyExists(
        landlord._id,
        tenantData
      );

      if (exists) {
        console.log(
          `SKIPPED: ${name} - ${unitNumber} - ${row.rentExpiryDate}`
        );

        skipped++;
        continue;
      }

      await Tenant.create(tenantData);

      console.log(
        `ADDED: ${name} - ${unitNumber} - ${row.rentExpiryDate}`
      );

      inserted++;
    }

    console.log("");
    console.log("========================================");
    console.log("SEED / IMPORT COMPLETE");
    console.log("========================================");
    console.log(`Landlord: ${landlord.email}`);
    console.log(`Dataset records: ${dataset.length}`);
    console.log(`Added: ${inserted}`);
    console.log(`Skipped: ${skipped}`);
    console.log("Existing tenants were NOT deleted.");
    console.log("========================================");
    console.log("");
    console.log(
      "Login:"
    );
    console.log(
      `Email: ${landlord.email}`
    );
    console.log(
      "Password: password123"
    );

    await mongoose.connection.close();

    process.exit(0);
  } catch (error) {
    console.error("");
    console.error("SEED FAILED");
    console.error(error);

    try {
      await mongoose.connection.close();
    } catch (_) {}

    process.exit(1);
  }
}

run();