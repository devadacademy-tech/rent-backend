const asyncHandler = require("express-async-handler");
const { sendEmail } = require("../services/emailService");
const { sendSMS } = require("../services/smsService");

// @desc    Send a one-off test email and/or SMS to verify Brevo & Termii
//          credentials are configured correctly — independent of any
//          tenant data.
// @route   POST /api/health/notifications
// @access  Private
// @body    { email?: string, phone?: string }  — at least one required
const testNotifications = asyncHandler(async (req, res) => {
  const { email, phone } = req.body;

  if (!email && !phone) {
    res.status(400);
    throw new Error("Provide at least an email or a phone number to test");
  }

  const result = {};

  if (email) {
    result.email = await sendEmail({
      to: email,
      toName: "Test Recipient",
      subject: "Rent Ledger — test email",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>It works 🎉</h2>
          <p>This is a test email from your Tenant Rent Reminder backend.</p>
          <p>If you received this, your <strong>Brevo</strong> configuration
          (API key + verified sender) is set up correctly.</p>
        </div>
      `,
    });
  }

  if (phone) {
    result.sms = await sendSMS({
      to: phone,
      message:
        "Rent Ledger test SMS: if you got this, your Termii configuration (API key, balance, sender ID/channel) is working.",
    });
  }

  const anyFailed = Object.values(result).some((r) => r && r.success === false);

  res.status(anyFailed ? 502 : 200).json({
    success: !anyFailed,
    data: result,
  });
});

module.exports = { testNotifications };
