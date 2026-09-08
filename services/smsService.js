const axios = require("axios");

const TERMII_BASE_URL =
  process.env.TERMII_BASE_URL || "https://api.ng.termii.com";

/**
 * Normalizes a Nigerian phone number to Termii's expected international
 * format (e.g. 08012345678 -> 2348012345678, +234801... -> 234801...).
 */
const normalizePhone = (rawPhone) => {
  if (!rawPhone) return "";
  let phone = String(rawPhone).trim().replace(/[\s-]/g, "");

  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = "234" + phone.slice(1);
  if (phone.startsWith("234")) return phone;

  // Fallback: assume already in correct international format
  return phone;
};

/**
 * Send an SMS via Termii.
 * @param {Object} opts
 * @param {string} opts.to - recipient phone number (any common Nigerian format)
 * @param {string} opts.message
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendSMS = async ({ to, message }) => {
  if (!to) {
    return { success: false, error: "No recipient phone number provided" };
  }

  if (!process.env.TERMII_API_KEY) {
    console.warn("TERMII_API_KEY not set — skipping SMS send");
    return { success: false, error: "TERMII_API_KEY not configured" };
  }

  const recipient = normalizePhone(to);

  try {
    const response = await axios.post(
      `${TERMII_BASE_URL}/api/sms/send`,
      {
        api_key: process.env.TERMII_API_KEY,
        to: recipient,
        from: process.env.TERMII_SENDER_ID,
        sms: message,
        type: "plain",
        channel: process.env.TERMII_CHANNEL || "generic",
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      }
    );

    const data = response.data;

    // Termii returns { code: "ok", message_id, ... } on success
    if (data && (data.code === "ok" || data.message_id)) {
      return { success: true, messageId: data.message_id };
    }

    return { success: false, error: JSON.stringify(data) };
  } catch (error) {
    const errMsg =
      error.response?.data?.message ||
      error.response?.data ||
      error.message ||
      "Unknown SMS error";
    console.error("Termii SMS send failed:", errMsg);
    return { success: false, error: errMsg };
  }
};

module.exports = { sendSMS, normalizePhone };
