const axios = require("axios");

const ROBASE_BASE_URL =
  process.env.ROBASE_BASE_URL || "https://api.robase.dev";

/**
 * Normalizes a Nigerian phone number to E.164 format.
 *
 * Examples:
 * 08012345678   -> +2348012345678
 * +2348012345678 -> +2348012345678
 * 2348012345678  -> +2348012345678
 */
const normalizePhone = (rawPhone) => {
  if (!rawPhone) return "";

  let phone = String(rawPhone)
    .trim()
    .replace(/[\s-]/g, "");

  // Remove leading +
  if (phone.startsWith("+")) {
    phone = phone.slice(1);
  }

  // Nigerian local format: 080...
  if (phone.startsWith("0")) {
    phone = "234" + phone.slice(1);
  }

  // Already Nigerian international format
  if (phone.startsWith("234")) {
    return "+" + phone;
  }

  // Fallback: assume it is already an international number
  return "+" + phone;
};

/**
 * Send an SMS via Robase.
 *
 * @param {Object} opts
 * @param {string} opts.to - recipient phone number
 * @param {string} opts.message - SMS message
 *
 * @returns {Promise<{
 *   success: boolean,
 *   messageId?: string,
 *   error?: string
 * }>}
 */
const sendSMS = async ({ to, message }) => {
  if (!to) {
    return {
      success: false,
      error: "No recipient phone number provided",
    };
  }

  if (!message) {
    return {
      success: false,
      error: "No SMS message provided",
    };
  }

  if (!process.env.ROBASE_API_KEY) {
    console.warn("ROBASE_API_KEY not set — skipping SMS send");

    return {
      success: false,
      error: "ROBASE_API_KEY not configured",
    };
  }

  const recipient = normalizePhone(to);

  if (!recipient) {
    return {
      success: false,
      error: "Invalid recipient phone number",
    };
  }

  try {
    const response = await axios.post(
      `${ROBASE_BASE_URL}/v1/sms/send`,
      {
        phone_number: recipient,
        message,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ROBASE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const data = response.data;

    /**
     * Robase returns something like:
     *
     * {
     *   "id": "sms_...",
     *   "status": "queued",
     *   "credit_cost": 1
     * }
     */

    if (data && data.id) {
      return {
        success: true,
        messageId: data.id,
      };
    }

    return {
      success: false,
      error: JSON.stringify(data),
    };
  } catch (error) {
    const errMsg =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.response?.data ||
      error.message ||
      "Unknown SMS error";

    console.error("Robase SMS send failed:", errMsg);

    return {
      success: false,
      error:
        typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
    };
  }
};

module.exports = {
  sendSMS,
  normalizePhone,
};