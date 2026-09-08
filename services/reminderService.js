const Tenant = require("../models/Tenant");
const { sendEmail } = require("./emailService");
const { sendSMS } = require("./smsService");
const { daysBetween, formatDate, formatMoney } = require("../utils/dateHelpers");

const MILESTONES = (process.env.REMINDER_DAYS_BEFORE || "7,3,1,0")
  .split(",")
  .map((d) => parseInt(d.trim(), 10))
  .filter((n) => !Number.isNaN(n));

const OVERDUE_INTERVAL = parseInt(
  process.env.OVERDUE_REMINDER_INTERVAL_DAYS || "3",
  10
);
const OVERDUE_MAX_DAYS = parseInt(
  process.env.OVERDUE_REMINDER_MAX_DAYS || "60",
  10
);

// ---- Message builders -------------------------------------------------

const tenantMessage = (tenant, daysLeft) => {
  const amount = formatMoney(tenant.rentAmount, tenant.currency);
  const expiry = formatDate(tenant.rentExpiryDate);

  let line;
  if (daysLeft > 0) {
    line = `your rent of ${amount} for ${tenant.propertyAddress}${
      tenant.unitNumber ? " (Unit " + tenant.unitNumber + ")" : ""
    } is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}, on ${expiry}.`;
  } else if (daysLeft === 0) {
    line = `your rent of ${amount} for ${tenant.propertyAddress}${
      tenant.unitNumber ? " (Unit " + tenant.unitNumber + ")" : ""
    } is due TODAY (${expiry}).`;
  } else {
    line = `your rent of ${amount} for ${tenant.propertyAddress}${
      tenant.unitNumber ? " (Unit " + tenant.unitNumber + ")" : ""
    } was due on ${expiry} and is now ${Math.abs(
      daysLeft
    )} day${Math.abs(daysLeft) === 1 ? "" : "s"} overdue. Please make payment as soon as possible.`;
  }

  return {
    subject:
      daysLeft >= 0
        ? "Rent Payment Reminder"
        : "Overdue Rent Payment Notice",
    sms: `Hi ${tenant.name}, ${line} - Rent Manager`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px;">
        <h2>Rent Reminder</h2>
        <p>Hi ${tenant.name},</p>
        <p>${line}</p>
        <p><strong>Property:</strong> ${tenant.propertyAddress}${
      tenant.unitNumber ? " (Unit " + tenant.unitNumber + ")" : ""
    }</p>
        <p><strong>Amount:</strong> ${amount}</p>
        <p><strong>Due date:</strong> ${expiry}</p>
        <p>Kindly contact your landlord if you have already made this payment.</p>
      </div>
    `,
  };
};

const landlordMessage = (tenant, daysLeft) => {
  const amount = formatMoney(tenant.rentAmount, tenant.currency);
  const expiry = formatDate(tenant.rentExpiryDate);

  let line;
  if (daysLeft > 0) {
    line = `${tenant.name}'s rent (${amount}) at ${tenant.propertyAddress}${
      tenant.unitNumber ? " (Unit " + tenant.unitNumber + ")" : ""
    } is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}, on ${expiry}.`;
  } else if (daysLeft === 0) {
    line = `${tenant.name}'s rent (${amount}) at ${tenant.propertyAddress}${
      tenant.unitNumber ? " (Unit " + tenant.unitNumber + ")" : ""
    } is due TODAY (${expiry}).`;
  } else {
    line = `${tenant.name}'s rent (${amount}) at ${tenant.propertyAddress}${
      tenant.unitNumber ? " (Unit " + tenant.unitNumber + ")" : ""
    } was due on ${expiry} and is now ${Math.abs(
      daysLeft
    )} day${Math.abs(daysLeft) === 1 ? "" : "s"} overdue.`;
  }

  return {
    subject:
      daysLeft >= 0
        ? "Tenant Rent Due Reminder"
        : "Tenant Rent Overdue Alert",
    sms: `Landlord alert: ${line} - Rent Manager`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px;">
        <h2>Tenant Rent Alert</h2>
        <p>${line}</p>
        <p><strong>Tenant phone:</strong> ${tenant.phone}</p>
        <p><strong>Tenant email:</strong> ${tenant.email || "N/A"}</p>
      </div>
    `,
  };
};

// ---- Milestone resolution ----------------------------------------------

/**
 * Determine which milestone key (if any) applies today for a given
 * daysLeft value, respecting the configured upcoming milestones and the
 * overdue interval/max window.
 */
const resolveMilestone = (daysLeft) => {
  if (daysLeft >= 0) {
    return MILESTONES.includes(daysLeft) ? String(daysLeft) : null;
  }

  const overdueDays = Math.abs(daysLeft);
  if (overdueDays > OVERDUE_MAX_DAYS) return null;
  if (overdueDays % OVERDUE_INTERVAL === 0) return `overdue-${overdueDays}`;
  return null;
};

const alreadySent = (tenant, milestone) => {
  return tenant.reminderLog.some(
    (log) =>
      log.milestone === milestone &&
      new Date(log.cycleExpiryDate).getTime() ===
        new Date(tenant.rentExpiryDate).getTime()
  );
};

/**
 * Sends reminders (email + SMS) to a tenant and their landlord for a
 * single tenant document, if a milestone applies and hasn't already
 * been sent for this rent cycle. Returns a summary object.
 */
const processTenantReminder = async (tenant, landlord) => {
  const daysLeft = daysBetween(tenant.rentExpiryDate);
  const milestone = resolveMilestone(daysLeft);

  if (!milestone) return { tenantId: tenant._id, skipped: true, reason: "no-milestone" };
  if (!tenant.remindersEnabled)
    return { tenantId: tenant._id, skipped: true, reason: "reminders-disabled" };
  if (alreadySent(tenant, milestone))
    return { tenantId: tenant._id, skipped: true, reason: "already-sent" };

  const tMsg = tenantMessage(tenant, daysLeft);
  const lMsg = landlordMessage(tenant, daysLeft);

  const results = { tenantId: tenant._id, milestone, daysLeft, sent: {} };

  // Notify tenant
  if (tenant.email) {
    results.sent.tenantEmail = await sendEmail({
      to: tenant.email,
      toName: tenant.name,
      subject: tMsg.subject,
      html: tMsg.html,
    });
  }
  if (tenant.phone) {
    results.sent.tenantSMS = await sendSMS({ to: tenant.phone, message: tMsg.sms });
  }

  // Notify landlord
  if (landlord?.email) {
    results.sent.landlordEmail = await sendEmail({
      to: landlord.email,
      toName: landlord.fullName,
      subject: lMsg.subject,
      html: lMsg.html,
    });
  }
  if (landlord?.phone) {
    results.sent.landlordSMS = await sendSMS({ to: landlord.phone, message: lMsg.sms });
  }

  tenant.reminderLog.push({
    milestone,
    cycleExpiryDate: tenant.rentExpiryDate,
    channel: "both",
  });

  if (daysLeft < 0 && tenant.status === "active") {
    tenant.status = "expired";
  }

  await tenant.save();

  return results;
};

/**
 * Runs the reminder sweep across all active tenants (optionally scoped
 * to one landlord). Used by both the cron job and the manual
 * "run reminders now" endpoint.
 */
const runReminderSweep = async ({ landlordId } = {}) => {
  const query = { remindersEnabled: true, status: { $ne: "vacated" } };
  if (landlordId) query.landlord = landlordId;

  const tenants = await Tenant.find(query).populate(
    "landlord",
    "fullName email phone"
  );

  const summary = [];
  for (const tenant of tenants) {
    try {
      const result = await processTenantReminder(tenant, tenant.landlord);
      summary.push(result);
    } catch (err) {
      console.error(`Reminder failed for tenant ${tenant._id}:`, err.message);
      summary.push({ tenantId: tenant._id, error: err.message });
    }
  }

  return summary;
};

module.exports = {
  runReminderSweep,
  processTenantReminder,
  resolveMilestone,
  tenantMessage,
  landlordMessage,
};
